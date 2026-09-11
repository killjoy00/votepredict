import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  evaluateIntroductionStructuralModelChronologically,
  evaluateIntroductionTitleModelChronologically,
  type IntroductionObservation,
} from '../src/evaluation/introduction-model.js';
import {
  evaluateIntroductionTimingModelChronologically,
  type IntroductionTimingObservation,
} from '../src/evaluation/introduction-timing-model.js';
import { scoreStagePredictions, stageBaseRatePredictions, type BillStageObservation, type BillStagePrediction } from '../src/evaluation/stages.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secretValues: string[] = [];

type Row = {
  bill_id: string;
  session_slug: string;
  session_start: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  title: string;
  introduced_on: string | null;
  initial_document_on: string | null;
  initial_document_model_eligible: string | null;
  parser_version: string | null;
  outcome: boolean;
};

function mask(value: string) {
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

async function canConnect(value: string): Promise<boolean> {
  const probe = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8_000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function chooseDatabaseUrl(env: Record<string, string | undefined>): Promise<string> {
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await canConnect(value)) return value;
  }
  const cronSecret = env.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: `Bearer ${cronSecret}` } });
  if (!response.ok) throw new Error(`Authenticated Neon database bridge returned HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) throw new Error('Authenticated Neon database bridge returned an invalid database URL');
  secretValues.push(value);
  mask(value);
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}

function scoreBySession(predictions: readonly BillStagePrediction[], rows: readonly Row[]) {
  const sessionByBill = new Map(rows.map((row) => [row.bill_id, row.session_slug]));
  return Object.fromEntries([...new Set(rows.map((row) => row.session_slug))].sort().map((session) => [
    session,
    scoreStagePredictions(predictions.filter((row) => sessionByBill.get(row.billId) === session)),
  ]));
}

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  for (const value of secretValues.filter((value) => value.length > 3)) mask(value);

  const databaseUrl = await chooseDatabaseUrl(env);
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const result = await pool.query<Row>(`
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             s.starts_on::text AS session_start,
             c.slug AS chamber_slug,
             b.identifier,
             COALESCE(b.title, '') AS title,
             b.metadata #>> '{revisorIntroduction,introducedOn}' AS introduced_on,
             b.metadata #>> '{revisorIntroduction,initialDocument,insertedOn}' AS initial_document_on,
             b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS initial_document_model_eligible,
             b.metadata #>> '{revisorIntroduction,parserVersion}' AS parser_version,
             (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
       WHERE b.metadata ? 'revisorUniverse'
         AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true', 'false')
         AND b.metadata #>> '{sourceChamberPassage,targetStage}' = 'source_chamber_passage'
       ORDER BY s.starts_on, c.slug, b.identifier`);

    if (result.rows.length !== 31_010) throw new Error(`Expected authoritative 31,010-row universe, found ${result.rows.length}`);
    for (const row of result.rows) {
      if (row.parser_version !== 'revisor-introduction-v1' || !row.introduced_on || !row.initial_document_on) {
        throw new Error(`${row.identifier}: authoritative introduction metadata incomplete`);
      }
      if (row.initial_document_model_eligible !== 'true' && row.initial_document_model_eligible !== 'false') {
        throw new Error(`${row.identifier}: initial-document model eligibility is not explicit`);
      }
    }

    const intro: IntroductionObservation[] = result.rows.map((row) => ({
      billId: row.bill_id,
      sessionSlug: row.session_slug,
      sessionStart: row.session_start,
      chamber: row.chamber_slug,
      title: row.title,
      billNumber: parseBillNumber(row.identifier),
      outcome: row.outcome ? 1 : 0,
    }));
    const timing: IntroductionTimingObservation[] = result.rows.map((row) => {
      const available = row.initial_document_model_eligible === 'true';
      return {
        billId: row.bill_id,
        sessionSlug: row.session_slug,
        sessionStart: row.session_start,
        chamber: row.chamber_slug,
        title: row.title,
        billNumber: parseBillNumber(row.identifier),
        outcome: row.outcome ? 1 : 0,
        introducedOn: row.introduced_on!,
        initialDocumentOn: available ? row.initial_document_on! : null,
        initialDocumentAvailableAtIntroduction: available,
      };
    });
    const stage: BillStageObservation[] = intro.map((row) => ({
      billId: row.billId,
      asOf: `${row.sessionStart}T00:00:00Z`,
      targetKind: 'source_chamber_passage',
      outcome: row.outcome,
    }));

    const firstSession = [...new Set(result.rows.map((row) => row.session_slug))].sort()[0];
    const sessionByBill = new Map(result.rows.map((row) => [row.bill_id, row.session_slug]));
    const baseline = stageBaseRatePredictions(stage).filter((row) => sessionByBill.get(row.billId) !== firstSession);
    const v1 = evaluateIntroductionTitleModelChronologically(intro);
    const v2 = evaluateIntroductionStructuralModelChronologically(intro);
    const v3 = evaluateIntroductionTimingModelChronologically(timing);
    const all = [...baseline, ...v1, ...v2, ...v3];
    const eligible = result.rows.filter((row) => row.initial_document_model_eligible === 'true').length;

    console.log(JSON.stringify({
      evaluation: 'intro-title-timing-eb-v3',
      codeSha: process.env.GITHUB_SHA ?? null,
      target: 'source_chamber_passage',
      authoritativeUniverse: result.rows.length,
      initialDocumentAvailableAtIntroduction: eligible,
      initialDocumentUnavailableAtIntroduction: result.rows.length - eligible,
      holdoutDefinition: '2023-2024 and 2025-2026, each trained only on earlier biennia',
      holdout: scoreStagePredictions(all),
      bySession: scoreBySession([...v1, ...v2, ...v3], result.rows),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3)) message = message.split(value).join('[redacted]');
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]'));
  process.exitCode = 1;
});

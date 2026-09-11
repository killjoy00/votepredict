import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { evaluateIntroductionTitleModelChronologically, type IntroductionObservation } from '../src/evaluation/introduction-model.js';
import { evaluateIntroductionTextModelChronologically, type IntroductionTextObservation } from '../src/evaluation/introduction-text-model.js';
import { scoreStagePredictions, type BillStagePrediction } from '../src/evaluation/stages.js';

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
  raw_text: string | null;
  text_hash: string | null;
  text_model_eligible: string | null;
  outcome: boolean;
};

function mask(value: string) {
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

async function canConnect(value: string): Promise<boolean> {
  const probe = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8_000 });
  try { await probe.query('SELECT 1'); return true; } catch { return false; } finally { await probe.end().catch(() => undefined); }
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
  secretValues.push(value); mask(value);
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function scoreBySession(predictions: readonly BillStagePrediction[], rows: readonly Row[]) {
  const sessionByBill = new Map(rows.map((row) => [row.bill_id, row.session_slug]));
  return Object.fromEntries([...new Set(rows.map((row) => row.session_slug))].sort().map((session) => [
    session,
    scoreStagePredictions(predictions.filter((prediction) => sessionByBill.get(prediction.billId) === session)),
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

  const pool = new Pool({ connectionString: await chooseDatabaseUrl(env), max: 1 });
  try {
    const result = await pool.query<Row>(`
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             s.starts_on::text AS session_start,
             c.slug AS chamber_slug,
             b.identifier,
             COALESCE(b.title, '') AS title,
             bv.raw_text,
             bv.text_hash,
             b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS text_model_eligible,
             (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house','senate')
        JOIN bill_versions bv
          ON bv.bill_id = b.id
         AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
       WHERE b.metadata ? 'revisorUniverse'
         AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true','false')
         AND b.metadata #>> '{sourceChamberPassage,targetStage}' = 'source_chamber_passage'
       ORDER BY s.starts_on, c.slug, b.identifier`);

    if (result.rows.length !== 31_010) throw new Error(`Expected 31,010 authoritative initial versions, found ${result.rows.length}`);
    const missingText = result.rows.filter((row) => !row.raw_text || !row.text_hash);
    if (missingText.length) throw new Error(`Initial text corpus incomplete: ${31_010 - missingText.length}/31010`);
    const eligible = result.rows.filter((row) => row.text_model_eligible === 'true');
    const ineligible = result.rows.filter((row) => row.text_model_eligible === 'false');
    if (eligible.length !== 31_009 || ineligible.length !== 1) {
      throw new Error(`Unexpected introduction-time text eligibility: eligible=${eligible.length} ineligible=${ineligible.length}`);
    }

    const base: IntroductionObservation[] = result.rows.map((row) => ({
      billId: row.bill_id,
      sessionSlug: row.session_slug,
      sessionStart: row.session_start,
      chamber: row.chamber_slug,
      title: row.title,
      billNumber: parseBillNumber(row.identifier),
      outcome: row.outcome ? 1 : 0,
    }));
    const text: IntroductionTextObservation[] = result.rows.map((row) => ({
      billId: row.bill_id,
      sessionSlug: row.session_slug,
      sessionStart: row.session_start,
      chamber: row.chamber_slug,
      title: row.title,
      billNumber: parseBillNumber(row.identifier),
      outcome: row.outcome ? 1 : 0,
      initialText: row.text_model_eligible === 'true' ? row.raw_text : null,
      initialTextAvailableAtIntroduction: row.text_model_eligible === 'true',
    }));

    const v1 = evaluateIntroductionTitleModelChronologically(base);
    const v4 = evaluateIntroductionTextModelChronologically(text);
    const all = [...v1, ...v4];
    console.log(JSON.stringify({
      evaluation: 'intro-title-text-eb-v4',
      codeSha: process.env.GITHUB_SHA ?? null,
      target: 'source_chamber_passage',
      authoritativeUniverse: result.rows.length,
      initialTextAvailableAtIntroduction: eligible.length,
      initialTextUnavailableAtIntroduction: ineligible.length,
      frozenOptions: { textPriorStrength: 200, textMinSupport: 40, textMaxFeatures: 10, textScale: 0.18, preambleMaxChars: 8000 },
      holdoutDefinition: '2023-2024 and 2025-2026, each trained only on earlier biennia',
      holdout: scoreStagePredictions(all),
      bySession: scoreBySession(all, result.rows),
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

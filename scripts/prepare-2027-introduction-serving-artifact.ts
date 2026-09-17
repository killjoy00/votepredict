import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  trainIntroductionTextModel,
  type IntroductionTextObservation,
} from '../src/evaluation/introduction-text-model.js';
import { serializeIntroductionPriorModelV4 } from '../src/forecasting/introduction-prior-model.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const TARGET_SESSION_SLUG = '2027-2028';
const EXPECTED_TARGET_START = '2027-01-01';
const EXPECTED_TRAINING_SESSIONS = ['2021-2022', '2023-2024', '2025-2026'] as const;
const EXPECTED_TRAINING_ROWS = 31_010;
const EXPECTED_TRAINING_POSITIVES = 654;
const EVALUATION_COMMIT = '7826d9696e0766abce3b58bf4ae2e4a155b7a000';
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
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  if (!response.ok) throw new Error(`Authenticated Neon database bridge returned HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('Authenticated Neon database bridge returned an invalid database URL');
  }
  secretValues.push(value);
  mask(value);
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function observation(row: Row): IntroductionTextObservation {
  return {
    billId: row.bill_id,
    sessionSlug: row.session_slug,
    sessionStart: row.session_start,
    chamber: row.chamber_slug,
    title: row.title,
    billNumber: parseBillNumber(row.identifier),
    outcome: row.outcome ? 1 : 0,
    initialText: row.text_model_eligible === 'true' ? row.raw_text : null,
    initialTextAvailableAtIntroduction: row.text_model_eligible === 'true',
  };
}

function sameSessions(actual: string[]): boolean {
  return actual.length === EXPECTED_TRAINING_SESSIONS.length
    && actual.every((value, index) => value === EXPECTED_TRAINING_SESSIONS[index]);
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
    const targetSession = await pool.query<{ starts_on: string }>(`
      SELECT starts_on::text
        FROM legislative_sessions s
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE s.slug = $1
       LIMIT 1`, [TARGET_SESSION_SLUG]);
    if (targetSession.rows.length !== 1) throw new Error(`Target session ${TARGET_SESSION_SLUG} is not provisioned`);
    const targetSessionStart = targetSession.rows[0].starts_on;
    if (targetSessionStart !== EXPECTED_TARGET_START) {
      throw new Error(`Target session start changed: expected ${EXPECTED_TARGET_START}, found ${targetSessionStart}`);
    }

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
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
        JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house','senate')
        JOIN bill_versions bv
          ON bv.bill_id = b.id
         AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
       WHERE s.starts_on < $1::date
         AND b.metadata ? 'revisorUniverse'
         AND b.metadata #>> '{sourceChamberPassage,outcome}' IN ('true','false')
         AND b.metadata #>> '{sourceChamberPassage,targetStage}' = 'source_chamber_passage'
       ORDER BY s.starts_on, c.slug, substring(b.identifier from '[0-9]+$')::integer, b.identifier`, [targetSessionStart]);

    if (result.rows.length !== EXPECTED_TRAINING_ROWS) {
      throw new Error(`Expected ${EXPECTED_TRAINING_ROWS} completed prior-session rows, found ${result.rows.length}`);
    }
    if (result.rows.some((row) => !row.raw_text || !row.text_hash)) {
      throw new Error('Completed prior-session introduction text corpus is incomplete');
    }
    const trainingSessions = [...new Set(result.rows.map((row) => row.session_slug))];
    if (!sameSessions(trainingSessions)) {
      throw new Error(`Unexpected training sessions: ${JSON.stringify(trainingSessions)}`);
    }
    const trainingPositives = result.rows.filter((row) => row.outcome).length;
    if (trainingPositives !== EXPECTED_TRAINING_POSITIVES) {
      throw new Error(`Expected ${EXPECTED_TRAINING_POSITIVES} training positives, found ${trainingPositives}`);
    }

    const corpusLines = result.rows.map((row) => [
      row.bill_id,
      row.session_slug,
      row.chamber_slug,
      row.identifier,
      row.text_hash,
      row.text_model_eligible,
      row.outcome ? '1' : '0',
    ].join(':'));
    const trainingCorpusSha256 = createHash('sha256').update(corpusLines.join('\n')).digest('hex');

    const model = trainIntroductionTextModel(result.rows.map(observation));
    const artifact = serializeIntroductionPriorModelV4(model, {
      targetSessionSlug: TARGET_SESSION_SLUG,
      targetSessionStart,
      trainedThroughSessionSlug: EXPECTED_TRAINING_SESSIONS.at(-1)!,
      trainingSessions: [...EXPECTED_TRAINING_SESSIONS],
      trainingRows: result.rows.length,
      trainingPositives,
      provenance: {
        authoritativeUniverse: result.rows.length,
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        evaluationCommit: EVALUATION_COMMIT,
      },
    });

    const outputPath = resolve(process.env.INTRODUCTION_PRIOR_ARTIFACT_PATH ?? 'artifacts/introduction-v4-2027-2028.json');
    const summaryPath = resolve(process.env.INTRODUCTION_PRIOR_SUMMARY_PATH ?? 'artifacts/introduction-v4-2027-2028-summary.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
    const artifactSha256 = createHash('sha256').update(readFileSync(outputPath)).digest('hex');
    const summary = {
      readiness: 'candidate_generated_not_serving',
      targetSession: TARGET_SESSION_SLUG,
      targetSessionStart,
      model: artifact.model,
      targetKind: artifact.targetKind,
      trainingSessions,
      trainingRows: artifact.trainingRows,
      trainingPositives: artifact.trainingPositives,
      trainingCorpusSha256,
      artifactSha256,
      titleStats: artifact.titleStats.length,
      textStats: artifact.textStats.length,
      evaluationCommit: artifact.provenance.evaluationCommit,
      codeSha: artifact.provenance.codeSha,
      generatedAt: artifact.provenance.generatedAt,
      servingChanged: false,
      note: 'This workflow prepares a frozen 2027-2028 candidate from completed 2021-2026 biennia. Promotion remains a separate explicit serving change.',
    };
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ outputPath, summaryPath, ...summary }, null, 2));
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

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  predictIntroductionTextModel,
  trainIntroductionTextModel,
  type IntroductionTextObservation,
} from '../src/evaluation/introduction-text-model.js';
import {
  deserializeIntroductionPriorModelV4,
  serializeIntroductionPriorModelV4,
} from '../src/forecasting/introduction-prior-model.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const TARGET_SESSION_SLUG = '2025-2026';
const EXPECTED_UNIVERSE = 31_010;
const EXPECTED_TRAINING_ROWS = 20_538;
const EXPECTED_TRAINING_POSITIVES = 402;
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

    if (result.rows.length !== EXPECTED_UNIVERSE) throw new Error(`Expected ${EXPECTED_UNIVERSE} authoritative rows, found ${result.rows.length}`);
    if (result.rows.some((row) => !row.raw_text || !row.text_hash)) throw new Error('Authoritative introduction text corpus is incomplete');

    const targetRows = result.rows.filter((row) => row.session_slug === TARGET_SESSION_SLUG);
    if (!targetRows.length) throw new Error(`Target session ${TARGET_SESSION_SLUG} was not found`);
    const targetSessionStart = targetRows[0].session_start;
    if (targetRows.some((row) => row.session_start !== targetSessionStart)) throw new Error('Target session has inconsistent start dates');

    const trainingRows = result.rows.filter((row) => row.session_start < targetSessionStart);
    if (trainingRows.length !== EXPECTED_TRAINING_ROWS) throw new Error(`Expected ${EXPECTED_TRAINING_ROWS} training rows, found ${trainingRows.length}`);
    const trainingPositives = trainingRows.filter((row) => row.outcome).length;
    if (trainingPositives !== EXPECTED_TRAINING_POSITIVES) throw new Error(`Expected ${EXPECTED_TRAINING_POSITIVES} training positives, found ${trainingPositives}`);

    const training = trainingRows.map(observation);
    const model = trainIntroductionTextModel(training);
    const trainingSessions = [...new Set(trainingRows.map((row) => row.session_slug))];
    const priorRows = [...trainingRows].sort((a, b) => a.session_start.localeCompare(b.session_start));
    const trainedThroughSessionSlug = priorRows.at(-1)?.session_slug;
    if (!trainedThroughSessionSlug) throw new Error('Could not determine final training session');

    const artifact = serializeIntroductionPriorModelV4(model, {
      targetSessionSlug: TARGET_SESSION_SLUG,
      targetSessionStart,
      trainedThroughSessionSlug,
      trainingSessions,
      trainingRows: trainingRows.length,
      trainingPositives,
      provenance: {
        authoritativeUniverse: result.rows.length,
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        evaluationCommit: EVALUATION_COMMIT,
      },
    });

    const rehydrated = deserializeIntroductionPriorModelV4(artifact);
    let maximumDelta = 0;
    const predictionLines: string[] = [];
    for (const row of targetRows) {
      const input = observation(row);
      const direct = predictIntroductionTextModel(model, input);
      const serialized = predictIntroductionTextModel(rehydrated, input);
      const delta = Math.abs(direct - serialized);
      maximumDelta = Math.max(maximumDelta, delta);
      if (delta > 1e-15) throw new Error(`${row.identifier}: serialized prediction differs by ${delta}`);
      predictionLines.push(`${row.bill_id}:${serialized.toPrecision(17)}`);
    }

    const outputPath = resolve(process.env.INTRODUCTION_PRIOR_ARTIFACT_PATH ?? 'artifacts/introduction-v4-2025-2026.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
    const artifactSha256 = createHash('sha256').update(readFileSync(outputPath)).digest('hex');
    const predictionSha256 = createHash('sha256').update(predictionLines.join('\n')).digest('hex');
    console.log(JSON.stringify({
      outputPath,
      artifactSha256,
      predictionSha256,
      model: artifact.model,
      targetSession: artifact.targetSessionSlug,
      targetRows: targetRows.length,
      trainingRows: artifact.trainingRows,
      trainingPositives: artifact.trainingPositives,
      titleStats: artifact.titleStats.length,
      textStats: artifact.textStats.length,
      maximumSerializationPredictionDelta: maximumDelta,
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

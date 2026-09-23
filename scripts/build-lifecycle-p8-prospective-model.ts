import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-p8-prospective-model-v1';
const PLAN_PATH = 'data/evaluation/lifecycle-p8-prospective-plan-v1.json';
let secretValues: string[] = [];

type IntroRow = {
  bill_id: string;
  session_slug: string;
  session_start: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  title: string;
  raw_text: string | null;
  text_hash: string | null;
  model_eligible: string | null;
  outcome: boolean;
};

type PreActivationRow = {
  target_session_bills: string;
  strict_outcome_labels: string;
  forecast_revisions: string;
  vote_events: string;
  stage_events: string;
};

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]');
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
    throw new Error('Authenticated Neon database bridge returned an invalid database connection value');
  }
  secretValues.push(value);
  mask(value);
  if (!await canConnect(value)) {
    throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  }
  return value;
}

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function hashRows(rows: readonly unknown[]): string {
  const digest = createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row) + '\n');
  return digest.digest('hex');
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  for (const value of secretValues) mask(value);

  const databaseUrl = await chooseDatabaseUrl(env);
  secretValues.push(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { buildLifecycleP3SnapshotDataset } =
    await import('../src/evaluation/lifecycle-p3-snapshot-dataset.js');
  const {
    applyStaticIntroductionBenchmark,
    buildForwardChainedStagePassagePredictions,
  } = await import('../src/evaluation/lifecycle-p4-baselines.js');
  const {
    buildForwardChainedLifecycleP5Predictions,
    buildLifecycleP5Rows,
  } = await import('../src/evaluation/lifecycle-p5-evidence-allocation.js');
  const {
    evaluateIntroductionTextModelChronologically,
    trainIntroductionTextModel,
  } = await import('../src/evaluation/introduction-text-model.js');
  const { serializeIntroductionPriorModelV4 } =
    await import('../src/forecasting/introduction-prior-model.js');
  const {
    buildLifecycleP8ProspectiveModelArtifact,
    LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256,
  } = await import('../src/evaluation/lifecycle-p8-prospective.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const [p3, intro, preActivation] = await Promise.all([
      buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA ?? null),
      pool.query<IntroRow>(`
        SELECT b.id::text AS bill_id,
               s.slug AS session_slug,
               s.starts_on::text AS session_start,
               c.slug AS chamber_slug,
               b.identifier,
               COALESCE(b.title, '') AS title,
               bv.raw_text,
               bv.text_hash,
               b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
               (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
          JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
          JOIN bill_versions bv
            ON bv.bill_id=b.id
           AND bv.version_key=b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
         ORDER BY s.starts_on,c.slug,b.identifier`),
      pool.query<PreActivationRow>(`
        SELECT
          (SELECT count(*)
             FROM bills b
             JOIN legislative_sessions s ON s.id=b.session_id
             JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
            WHERE s.slug='2027-2028')::text AS target_session_bills,
          (SELECT count(*)
             FROM bills b
             JOIN legislative_sessions s ON s.id=b.session_id
             JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
            WHERE s.slug='2027-2028'
              AND b.metadata #>> '{sourceChamberPassage,outcome}' IS NOT NULL)::text AS strict_outcome_labels,
          (SELECT count(*)
             FROM forecast_revisions r
             JOIN forecasts f ON f.id=r.forecast_id
             JOIN legislative_sessions s ON s.id=f.session_id
            WHERE s.slug='2027-2028')::text AS forecast_revisions,
          (SELECT count(*)
             FROM vote_events ve
             JOIN legislative_sessions s ON s.id=ve.session_id
            WHERE s.slug='2027-2028')::text AS vote_events,
          (SELECT count(*)
             FROM legislative_stage_events se
             JOIN legislative_sessions s ON s.id=se.session_id
            WHERE s.slug='2027-2028')::text AS stage_events`),
    ]);

    if (intro.rows.length !== 31_010) {
      throw new Error(`Lifecycle P8 historical introduction population drift: ${intro.rows.length}/31010`);
    }
    if (intro.rows.some((row) => !row.raw_text || !row.text_hash)) {
      throw new Error('Lifecycle P8 historical introduction corpus has missing text/hash');
    }

    const observations = intro.rows.map((row) => ({
      billId: row.bill_id,
      sessionSlug: row.session_slug,
      sessionStart: row.session_start,
      chamber: row.chamber_slug,
      title: row.title,
      billNumber: parseBillNumber(row.identifier),
      outcome: row.outcome ? 1 as const : 0 as const,
      initialText: row.model_eligible === 'true' ? row.raw_text : null,
      initialTextAvailableAtIntroduction: row.model_eligible === 'true',
    }));

    const corpusLines = intro.rows.map((row) => [
      row.bill_id,
      row.session_slug,
      row.chamber_slug,
      row.identifier,
      row.text_hash,
      row.model_eligible,
      row.outcome ? '1' : '0',
    ].join(':'));
    const introductionTrainingCorpusSha256 =
      createHash('sha256').update(corpusLines.join('\n')).digest('hex');
    if (introductionTrainingCorpusSha256 !== LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256) {
      throw new Error('Lifecycle P8 introduction training corpus changed before model freeze');
    }

    const introductionModel = trainIntroductionTextModel(observations);
    const serialized = serializeIntroductionPriorModelV4(introductionModel, {
      targetSessionSlug: '2027-2028',
      targetSessionStart: '2027-01-01',
      trainedThroughSessionSlug: '2025-2026',
      trainingSessions: ['2021-2022', '2023-2024', '2025-2026'],
      trainingRows: intro.rows.length,
      trainingPositives: intro.rows.filter((row) => row.outcome).length,
      provenance: {
        authoritativeUniverse: intro.rows.length,
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        evaluationCommit: '7826d9696e0766abce3b58bf4ae2e4a155b7a000',
      },
    });
    const { provenance: _provenance, ...introductionModelContent } = serialized;

    const historicalIntroductionPredictions =
      evaluateIntroductionTextModelChronologically(observations);
    const stage = buildForwardChainedStagePassagePredictions(p3.snapshots);
    const stageKeys = new Set(stage.map((row) => `${row.billId}|${row.cutoffDateExclusive}`));
    const introduction = applyStaticIntroductionBenchmark(
      p3.snapshots,
      historicalIntroductionPredictions,
    ).filter((row) => stageKeys.has(`${row.billId}|${row.cutoffDateExclusive}`));
    const historicalP4PredictionSha256 = hashRows([...introduction, ...stage]);

    const p5Rows = buildLifecycleP5Rows(p3.snapshots);
    const p5Retained = buildForwardChainedLifecycleP5Predictions(p5Rows, {
      model: 'core_minus_companion',
      families: ['process_detail', 'bill_version'],
    });
    const historicalP5PredictionSha256 = hashRows(p5Retained);

    const pre = preActivation.rows[0];
    if (!pre) throw new Error('Lifecycle P8 pre-activation audit query returned no row');
    const planContents = readFileSync(PLAN_PATH, 'utf8');
    const artifact = buildLifecycleP8ProspectiveModelArtifact({
      snapshots: p3.snapshots,
      p3ObservedSha256: p3.manifest.snapshotContentSha256,
      introductionModel: introductionModelContent,
      introductionTrainingCorpusSha256,
      historicalP4PredictionSha256,
      historicalP5PredictionSha256,
      planSha256: createHash('sha256').update(planContents).digest('hex'),
      preActivation: {
        targetSessionBills: Number(pre.target_session_bills),
        strictOutcomeLabels: Number(pre.strict_outcome_labels),
        forecastRevisions: Number(pre.forecast_revisions),
        voteEvents: Number(pre.vote_events),
        stageEvents: Number(pre.stage_events),
      },
      generatedAt: new Date().toISOString(),
      codeSha: process.env.GITHUB_SHA ?? null,
    });

    const outputDir = process.env.VOTEPREDICT_P8_MODEL_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'model.json'), JSON.stringify(artifact, null, 2) + '\n', 'utf8');
    const summary = {
      schemaVersion: artifact.schemaVersion,
      targetSession: artifact.modelContent.targetSession,
      planSha256: artifact.planSha256,
      modelContentSha256: artifact.modelContentSha256,
      p3SnapshotContentSha256: artifact.frozenUpstream.p3SnapshotContentSha256,
      p4HistoricalPredictionSha256: artifact.frozenUpstream.p4HistoricalPredictionSha256,
      p5HistoricalPredictionSha256: artifact.frozenUpstream.p5HistoricalPredictionSha256,
      introductionTrainingCorpusSha256:
        artifact.modelContent.introduction.trainingCorpusSha256,
      introductionModelContentSha256:
        artifact.modelContent.introduction.modelContentSha256,
      p4TrainingRows: artifact.modelContent.p4Stage.trainingRows,
      p5TrainingRows: Object.fromEntries(
        Object.entries(artifact.modelContent.p5Retained.targets)
          .map(([target, value]) => [target, value.trainingRows]),
      ),
      preActivation: artifact.preActivation,
      revealNotBefore: artifact.policy.revealNotBefore,
      servingChanged: false,
      automaticPromotionAllowed: false,
    };
    await writeFile(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({ lifecycleP8ProspectiveModel: summary }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

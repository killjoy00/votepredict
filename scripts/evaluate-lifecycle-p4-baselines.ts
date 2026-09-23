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
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-p4-baselines-v1';
let secretValues: string[] = [];

type IntroRow = {
  bill_id: string;
  session_slug: string;
  session_start: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  title: string;
  introduced_on: string | null;
  model_eligible: string | null;
  raw_text: string | null;
  text_hash: string | null;
  outcome: boolean;
  in_authoritative_universe: boolean;
};

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? 'UNKNOWN');
  }
  return 'UNKNOWN';
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
    if (!value) continue;
    if (await canConnect(value)) return value;
    console.warn(JSON.stringify({ lifecycleP4DatabaseCandidate: { candidate: key, connected: false } }));
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
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}

function parseBillNumber(identifier: string): number | null {
  const match = identifier.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
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

  const { buildLifecycleP3SnapshotDataset } = await import('../src/evaluation/lifecycle-p3-snapshot-dataset.js');
  const { summarizeLifecycleP4Baselines } = await import('../src/evaluation/lifecycle-p4-baselines.js');
  const { evaluateIntroductionTextModelChronologically } = await import('../src/evaluation/introduction-text-model.js');
  const { scoreIntroductionPriorRow } = await import('../src/forecasting/introduction-prior-runtime.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const p3 = await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA ?? null);
    const intro = await pool.query<IntroRow>(`
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             s.starts_on::text AS session_start,
             c.slug AS chamber_slug,
             b.identifier,
             COALESCE(b.title, '') AS title,
             COALESCE(b.metadata #>> '{revisorIntroduction,introducedOn}', b.introduced_at::date::text) AS introduced_on,
             b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' AS model_eligible,
             bv.raw_text,
             bv.text_hash,
             (b.metadata #>> '{sourceChamberPassage,outcome}')::boolean AS outcome,
             (b.metadata ? 'revisorUniverse') AS in_authoritative_universe
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
        JOIN bill_versions bv
          ON bv.bill_id=b.id
         AND bv.version_key=b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
       ORDER BY s.starts_on,c.slug,b.identifier`);

    if (intro.rows.length !== 31_010) {
      throw new Error(`Lifecycle P4 introduction population drift: ${intro.rows.length}/31010`);
    }
    const p3Bills = new Set(p3.snapshots.map((row) => row.bill.billId));
    if (p3Bills.size !== 31_010 || intro.rows.some((row) => !p3Bills.has(row.bill_id))) {
      throw new Error('Lifecycle P4 introduction/P3 bill populations do not match exactly');
    }

    const introObservations = intro.rows.map((row) => ({
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
    const introductionPredictions = evaluateIntroductionTextModelChronologically(introObservations);

    const forward2025 = new Map(
      introductionPredictions
        .filter((row) => intro.rows.find((candidate) =>
          candidate.bill_id === row.billId)?.session_slug === '2025-2026')
        .map((row) => [row.billId, row.probability]),
    );
    let servingParity2025MaxDelta = 0;
    let servingParityRows = 0;
    for (const row of intro.rows.filter((candidate) => candidate.session_slug === '2025-2026')) {
      const served = scoreIntroductionPriorRow({
        session_slug: row.session_slug,
        session_start: row.session_start,
        originating_chamber: row.chamber_slug,
        title: row.title,
        introduced_on: row.introduced_on,
        model_eligible: row.model_eligible,
        raw_text: row.raw_text,
        text_hash: row.text_hash,
        in_authoritative_universe: row.in_authoritative_universe,
      });
      const historical = forward2025.get(row.bill_id);
      if (!served || historical === undefined) {
        throw new Error(`Missing 2025 introduction serving parity row for ${row.identifier}`);
      }
      servingParityRows += 1;
      servingParity2025MaxDelta = Math.max(
        servingParity2025MaxDelta,
        Math.abs(served.probability - historical),
      );
    }
    if (servingParityRows !== 10_472 || servingParity2025MaxDelta !== 0) {
      throw new Error(
        `Introduction serving parity failed: rows=${servingParityRows} maxDelta=${servingParity2025MaxDelta}`,
      );
    }

    const result = summarizeLifecycleP4Baselines({
      snapshots: p3.snapshots,
      introductionPredictions,
      p3ObservedSha256: p3.manifest.snapshotContentSha256,
      introductionServingParity2025MaxDelta: servingParity2025MaxDelta,
      codeSha: process.env.GITHUB_SHA ?? null,
    });

    const outputDir = process.env.VOTEPREDICT_P4_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'report.json'), `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
    await writeFile(
      join(outputDir, 'passage-predictions.ndjson'),
      `${result.passagePredictions.map((row) => JSON.stringify(row)).join('\n')}\n`,
      'utf8',
    );
    await writeFile(
      join(outputDir, 'hazard-predictions.ndjson'),
      `${result.hazardPredictions.map((row) => JSON.stringify(row)).join('\n')}\n`,
      'utf8',
    );

    console.log(JSON.stringify({
      lifecycleP4Baselines: {
        outputDir,
        schemaVersion: result.report.schemaVersion,
        p3SnapshotContentSha256: result.report.frozenP3.observedSnapshotContentSha256,
        bills: result.report.frozenP3.bills,
        snapshots: result.report.frozenP3.snapshots,
        holdoutBills: result.report.passage.holdoutBills,
        holdoutSnapshots: result.report.passage.holdoutEventTimeSnapshots,
        introductionServingParity2025MaxDelta: servingParity2025MaxDelta,
        passageAllEventTimeSnapshots: result.report.passage.allEventTimeSnapshots,
        hazard30Day: result.report.hazard30Day.allHoldouts,
        predictionDigests: result.report.predictionDigests,
        servingChanged: false,
      },
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

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
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-p6-end-to-end-v1';
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

type VersionRow = {
  id: string;
  bill_id: string;
  published_at: string;
  created_at: string;
  raw_text: string;
};

type RefRow = {
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  session_id: string;
  chamber_id: string;
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
  const { summarizeLifecycleP6EndToEnd } = await import('../src/evaluation/lifecycle-p6-end-to-end.js');
  const { evaluateIntroductionTextModelChronologically } = await import('../src/evaluation/introduction-text-model.js');
  const { loadHistoricalQuickReplayDataset } = await import('../src/evaluation/historical-quick-replay-dataset.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const p3 = await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA ?? null);
    const [intro, targetVersions, refs, floorDataset] = await Promise.all([
      pool.query<IntroRow>(`
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
         ORDER BY s.starts_on,c.slug,b.identifier`),
      pool.query<VersionRow>(`
        SELECT bv.id::text,
               bv.bill_id::text,
               to_char(bv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
               to_char(bv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
               bv.raw_text
          FROM bill_versions bv
          JOIN bills b ON b.id=bv.bill_id
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
           AND bv.published_at IS NOT NULL
           AND bv.raw_text IS NOT NULL
           AND length(bv.raw_text) >= 100
         ORDER BY bv.bill_id,bv.published_at,bv.created_at,bv.id`),
      pool.query<RefRow>(`
        SELECT DISTINCT s.slug AS session_slug,
               c.slug AS chamber_slug,
               s.id::text AS session_id,
               c.id::text AS chamber_id
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
          JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
         ORDER BY s.slug,c.slug`),
      loadHistoricalQuickReplayDataset(pool),
    ]);

    if (intro.rows.length !== 31_010) {
      throw new Error(`Lifecycle P6 introduction population drift: ${intro.rows.length}/31010`);
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

    const versionsByBill = new Map(floorDataset.versionsByBill);
    const knownVersionIds = new Set(
      [...versionsByBill.values()].flatMap((rows) => rows.map((row) => row.id)),
    );
    for (const row of targetVersions.rows) {
      if (knownVersionIds.has(row.id)) continue;
      const values = versionsByBill.get(row.bill_id) ?? [];
      values.push({
        id: row.id,
        billId: row.bill_id,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        rawText: row.raw_text,
      });
      versionsByBill.set(row.bill_id, values);
      knownVersionIds.add(row.id);
    }
    for (const values of versionsByBill.values()) {
      values.sort((left, right) =>
        left.publishedAt.localeCompare(right.publishedAt)
        || left.createdAt.localeCompare(right.createdAt)
        || left.id.localeCompare(right.id));
    }

    const sessionChamberRefs = new Map(refs.rows.map((row) => [
      `${row.session_slug}|${row.chamber_slug}`,
      {
        sessionSlug: row.session_slug,
        chamber: row.chamber_slug,
        sessionId: row.session_id,
        chamberId: row.chamber_id,
      },
    ]));

    const result = summarizeLifecycleP6EndToEnd({
      snapshots: p3.snapshots,
      introductionPredictions,
      p3ObservedSha256: p3.manifest.snapshotContentSha256,
      versionsByBill,
      passageEvents: floorDataset.events,
      memberships: floorDataset.memberships,
      historicalVotes: floorDataset.historicalVotes,
      sessionChamberRefs,
      codeSha: process.env.GITHUB_SHA ?? null,
    });

    const outputDir = process.env.VOTEPREDICT_P6_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'report.json'), `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
    await writeFile(
      join(outputDir, 'predictions.ndjson'),
      `${result.predictions.map((row) => JSON.stringify(row)).join('\n')}\n`,
      'utf8',
    );

    console.log(JSON.stringify({
      lifecycleP6EndToEnd: {
        outputDir,
        schemaVersion: result.report.schemaVersion,
        frozenUpstream: result.report.frozenUpstream,
        population: result.report.population,
        conditionalComponent: {
          servingMemberModelVersion: result.report.conditionalComponent.servingMemberModelVersion,
          memberDerivedRows: result.report.conditionalComponent.memberDerivedRows,
          fallbackRows: result.report.conditionalComponent.fallbackRows,
          passageVoteCutoffs: result.report.conditionalComponent.passageVoteCutoffs,
        },
        lifecycleCoverage: result.report.lifecycleCoverage,
        introductionSnapshots: result.report.scores.introductionSnapshots,
        allEventTimeSnapshots: result.report.scores.allEventTimeSnapshots,
        predictionSha256: result.report.predictionSha256,
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

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
  LIFECYCLE_P5_HOUSE_COMMITTEE_MANIFEST_SCHEMA,
  LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION,
  LIFECYCLE_P5_HOUSE_EXPECTED_BILLS,
  type LifecycleP5HouseCommitteeManifest,
} from '../src/evaluation/lifecycle-p5-house-committee.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT = 'artifacts/lifecycle-p5-house-committee-manifest-v1.json';
let secrets: string[] = [];

type Row = {
  bill_id: string;
  session_slug: string;
  identifier: string;
  introduced_on: string | null;
};

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const secret of secrets.filter((value) => value.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[redacted]');
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
    throw new Error('Authenticated Neon database bridge returned an invalid database URL');
  }
  secrets.push(value);
  mask(value);
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge URL is not portable');
  return value;
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const output = resolve(process.env.VOTEPREDICT_P5_HOUSE_MANIFEST_OUTPUT ?? DEFAULT_OUTPUT);
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  for (const value of secrets) mask(value);

  const databaseUrl = await chooseDatabaseUrl(env);
  secrets.push(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { buildLifecycleP3SnapshotDataset } = await import(
    '../src/evaluation/lifecycle-p3-snapshot-dataset.js'
  );
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const p3 = await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA ?? null);
    if (p3.manifest.snapshotContentSha256 !== FROZEN_LIFECYCLE_P3_CONTENT_SHA256) {
      throw new Error(
        `Lifecycle P5 refuses P3 drift: ${p3.manifest.snapshotContentSha256} != ${FROZEN_LIFECYCLE_P3_CONTENT_SHA256}`,
      );
    }

    const result = await pool.query<Row>(`
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             b.identifier,
             COALESCE(
               b.metadata #>> '{revisorIntroduction,introducedOn}',
               b.introduced_at::date::text
             ) AS introduced_on
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug='house'
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^HF[0-9]+$'
       ORDER BY s.starts_on,b.identifier`);

    const expectedTotal = Object.values(LIFECYCLE_P5_HOUSE_EXPECTED_BILLS).reduce((sum, value) => sum + value, 0);
    if (result.rows.length !== expectedTotal) {
      throw new Error(`Lifecycle P5 House universe drift: ${result.rows.length}/${expectedTotal}`);
    }
    const bySession = Object.fromEntries(
      Object.keys(LIFECYCLE_P5_HOUSE_EXPECTED_BILLS).sort().map((session) => [
        session,
        result.rows.filter((row) => row.session_slug === session).length,
      ]),
    );
    for (const [session, expected] of Object.entries(LIFECYCLE_P5_HOUSE_EXPECTED_BILLS)) {
      if (bySession[session] !== expected) {
        throw new Error(`Lifecycle P5 House universe drift for ${session}: ${bySession[session]}/${expected}`);
      }
    }
    if (result.rows.some((row) => !row.introduced_on)) {
      throw new Error('Lifecycle P5 House universe has bills without introduction dates');
    }

    const manifest: LifecycleP5HouseCommitteeManifest = {
      schemaVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_MANIFEST_SCHEMA,
      planVersion: LIFECYCLE_P5_HOUSE_COMMITTEE_PLAN_VERSION,
      generatedAt: new Date().toISOString(),
      codeSha: process.env.GITHUB_SHA ?? null,
      frozenP3ContentSha256: FROZEN_LIFECYCLE_P3_CONTENT_SHA256,
      metadata: {
        population: 'all_introduced_minnesota_house_hf_bills_2021_2026',
        selectionUsesFloorAccessOrOutcome: false,
        sourceDiscoveryUsesBillSpecificSearch: false,
        sameDayExcluded: true,
      },
      counts: {
        totalBills: result.rows.length,
        bySession,
      },
      bills: result.rows.map((row) => ({
        billId: row.bill_id,
        session: row.session_slug,
        identifier: row.identifier,
        introducedOn: row.introduced_on as string,
      })),
    };

    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({
      lifecycleP5HouseCommitteeManifest: {
        output,
        schemaVersion: manifest.schemaVersion,
        p3ContentSha256: manifest.frozenP3ContentSha256,
        totalBills: manifest.counts.totalBills,
        bySession: manifest.counts.bySession,
        selectionUsesFloorAccessOrOutcome: manifest.metadata.selectionUsesFloorAccessOrOutcome,
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

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
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-p5-evidence-allocation-v1';
let secretValues: string[] = [];

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
  const { summarizeLifecycleP5EvidenceAllocation } = await import('../src/evaluation/lifecycle-p5-evidence-allocation.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const p3 = await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA ?? null);
    const report = summarizeLifecycleP5EvidenceAllocation({
      snapshots: p3.snapshots,
      p3ObservedSha256: p3.manifest.snapshotContentSha256,
      codeSha: process.env.GITHUB_SHA ?? null,
    });

    const outputDir = process.env.VOTEPREDICT_P5_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const compact = Object.fromEntries(Object.entries(report.models).map(([model, value]) => [
      model,
      {
        predictionSha256: value.predictionSha256,
        byTarget: Object.fromEntries(Object.entries(value.byTarget).map(([target, targetValue]) => [
          target,
          targetValue ? {
            coverage: targetValue.coverage,
            overall: targetValue.overall,
          } : null,
        ])),
      },
    ]));

    console.log(JSON.stringify({
      lifecycleP5EvidenceAllocation: {
        outputDir,
        schemaVersion: report.schemaVersion,
        p3SnapshotContentSha256: report.frozenP3.snapshotContentSha256,
        bills: report.frozenP3.bills,
        snapshots: report.frozenP3.snapshots,
        familyEligibility: report.familyEligibility,
        models: compact,
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

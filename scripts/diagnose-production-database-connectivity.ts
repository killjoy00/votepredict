import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

type CandidateName = 'DATABASE_URL_UNPOOLED' | 'POSTGRES_URL_NON_POOLING' | 'DATABASE_URL' | 'POSTGRES_URL';

const CANDIDATES: CandidateName[] = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
];

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
}

function hostnameClass(value: string): 'dns-name' | 'single-label' | 'unparseable' {
  try {
    const hostname = new URL(value).hostname;
    if (!hostname) return 'unparseable';
    return hostname.includes('.') ? 'dns-name' : 'single-label';
  } catch {
    return 'unparseable';
  }
}

async function probe(name: CandidateName, connectionString: string | undefined): Promise<{
  candidate: CandidateName;
  present: boolean;
  hostnameClass: 'dns-name' | 'single-label' | 'unparseable' | null;
  connected: boolean;
  errorCode: string | null;
}> {
  const value = connectionString?.trim();
  if (!value) {
    return { candidate: name, present: false, hostnameClass: null, connected: false, errorCode: null };
  }

  const pool = new Pool({
    connectionString: value,
    max: 1,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 1_000,
  });
  try {
    await pool.query('SELECT 1');
    return { candidate: name, present: true, hostnameClass: hostnameClass(value), connected: true, errorCode: null };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? 'UNKNOWN')
      : 'UNKNOWN';
    return { candidate: name, present: true, hostnameClass: hostnameClass(value), connected: false, errorCode: code };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));

  for (const [key, value] of Object.entries(env)) {
    if (/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key) && typeof value === 'string') mask(value);
  }

  const results = [];
  for (const candidate of CANDIDATES) {
    results.push(await probe(candidate, env[candidate]));
  }
  console.log(JSON.stringify({ productionDatabaseConnectivity: results }));

  if (!results.some((result) => result.connected)) {
    throw new Error('No portable production database connection candidate succeeded from GitHub Actions');
  }
}

main().catch((error) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'UNKNOWN')
    : null;
  console.error(JSON.stringify({ productionDatabaseConnectivityFailed: { code } }));
  process.exitCode = 1;
});

import { readFileSync } from 'node:fs';
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
let secretValues: string[] = [];

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of secretValues.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
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

async function chooseDatabaseUrl(runtime: Record<string, string | undefined>): Promise<string> {
  for (const key of DATABASE_CANDIDATES) {
    const value = runtime[key]?.trim();
    if (value && await canConnect(value)) return value;
  }

  const cronSecret = runtime.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error('CRON_SECRET is unavailable for authenticated database bridge');
  mask(cronSecret);

  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  if (!response.ok) throw new Error(`Authenticated database bridge returned HTTP ${response.status}`);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('Authenticated database bridge returned an invalid database URL');
  }

  secretValues.push(value);
  mask(value);
  if (!await canConnect(value)) {
    throw new Error('Authenticated database bridge returned a non-portable database URL');
  }
  return value;
}

async function main(): Promise<void> {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');

  const runtime = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secretValues = Object.entries(runtime)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secretValues.forEach(mask);

  const databaseUrl = await chooseDatabaseUrl(runtime);
  process.env.DATABASE_URL_UNPOOLED = databaseUrl;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  await import('./ingest-senate-history.js');
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

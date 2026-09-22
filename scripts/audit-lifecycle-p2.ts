import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT = 'artifacts/lifecycle-p2-audit.json';

type DatabaseCandidate = typeof DATABASE_CANDIDATES[number];
type DatabaseSource = DatabaseCandidate | 'NEON_FUNCTION_BRIDGE';
let secretValues: string[] = [];

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
  let message = error instanceof Error ? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3).sort((left, right) => right.length - left.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]');
}

async function probeDatabase(name: DatabaseSource, value: string): Promise<boolean> {
  const probe = new Pool({
    connectionString: value,
    max: 1,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 1_000,
  });
  try {
    await probe.query('SELECT 1');
    console.log(JSON.stringify({ lifecycleP2DatabaseCandidate: { candidate: name, present: true, connected: true } }));
    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      lifecycleP2DatabaseCandidate: {
        candidate: name,
        present: true,
        connected: false,
        errorCode: errorCode(error),
      },
    }));
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function choosePortableDatabaseUrl(
  env: Record<string, string | undefined>,
): Promise<{ name: DatabaseSource; value: string }> {
  for (const name of DATABASE_CANDIDATES) {
    const value = env[name]?.trim();
    if (!value) {
      console.log(JSON.stringify({
        lifecycleP2DatabaseCandidate: { candidate: name, present: false, connected: false },
      }));
      continue;
    }
    if (await probeDatabase(name, value)) return { name, value };
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
  if (!await probeDatabase('NEON_FUNCTION_BRIDGE', value)) {
    throw new Error('Authenticated Neon database bridge returned a connection that is not portable from GitHub Actions');
  }
  return { name: 'NEON_FUNCTION_BRIDGE', value };
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

  const database = await choosePortableDatabaseUrl(env);
  secretValues.push(database.value);
  process.env.DATABASE_URL = database.value;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const outputPath = process.env.VOTEPREDICT_P2_AUDIT_OUTPUT?.trim() || DEFAULT_OUTPUT;
  const enforceGate = process.env.VOTEPREDICT_P2_ENFORCE_GATE?.trim().toLowerCase() !== 'false';

  const { buildLifecycleP2Audit } = await import('../src/evaluation/lifecycle-p2-audit.js');
  const { pool } = await import('../src/lib/db/index.js');

  try {
    const report = await buildLifecycleP2Audit();
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify({
      lifecycleP2Audit: {
        outputPath,
        databaseSource: database.name,
        parserVersion: report.parserVersion,
        auditVersion: report.auditVersion,
        targetBills: report.coverage.targetBills,
        parsedBills: report.coverage.parsedBills,
        auditedBills: report.coverage.auditedBills,
        parserCoverage: report.coverage.parserCoverage,
        auditCoverageOfParsed: report.coverage.auditCoverageOfParsed,
        otherUnclassifiedDatedActions: report.actionAudit.otherUnclassifiedDatedActions,
        eventsBeforeIntroduction: report.lifecycle.eventsBeforeIntroduction,
        eventsAfterSessionExpiration: report.lifecycle.eventsAfterSessionExpiration,
        passageMismatches:
          report.lifecycle.authoritativePassagesMissingProcessPassage
          + report.lifecycle.authoritativeNonPassagesWithProcessPassage,
        hardFailures: report.gate.hardFailures,
        taxonomyReviewRequired: report.gate.taxonomyReviewRequired,
        postTerminalReviewRequired: report.gate.postTerminalReviewRequired,
        passed: report.gate.passed,
        enforceGate,
      },
    }));

    if (enforceGate && !report.gate.passed) {
      throw new Error(`Lifecycle P2 gate failed: ${report.gate.hardFailures.join('; ')}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

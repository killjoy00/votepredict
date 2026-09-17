import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';

function parseEnvironment(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value.replace(/\\n/g, '\n');
  }
  return result;
}

type Readiness = {
  sourceReadiness?: {
    readyForLiveBootstrap?: boolean;
    blockers?: string[];
  };
};

function runChild(script: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status ?? 'unknown'}`);
}

async function verifyBootstrap(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query<{
      house_members: string;
      senate_members: string;
      house_bills: string;
      senate_bills: string;
    }>(`
      SELECT
        count(DISTINCT m.id) FILTER (WHERE c.slug = 'house')::text AS house_members,
        count(DISTINCT m.id) FILTER (WHERE c.slug = 'senate')::text AS senate_members,
        count(DISTINCT b.id) FILTER (WHERE bc.slug = 'house')::text AS house_bills,
        count(DISTINCT b.id) FILTER (WHERE bc.slug = 'senate')::text AS senate_bills
      FROM legislative_sessions s
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      LEFT JOIN memberships m ON m.session_id = s.id
      LEFT JOIN chambers c ON c.id = m.chamber_id
      LEFT JOIN bills b ON b.session_id = s.id AND b.metadata ? 'revisorUniverse'
      LEFT JOIN chambers bc ON bc.id = b.originating_chamber_id
      WHERE s.slug = '2027-2028'
      GROUP BY s.id`);
    if (result.rows.length !== 1) throw new Error('2027-2028 bootstrap verification could not resolve the session');
    const row = result.rows[0];
    const summary = {
      houseMembers: Number(row.house_members),
      senateMembers: Number(row.senate_members),
      houseBills: Number(row.house_bills),
      senateBills: Number(row.senate_bills),
    };
    if (summary.houseMembers < 130 || summary.senateMembers < 65) {
      throw new Error(`2027 roster remains implausible after bootstrap: ${JSON.stringify(summary)}`);
    }
    if (summary.houseBills + summary.senateBills < 1) {
      throw new Error(`2027 Revisor universe remains empty after bootstrap: ${JSON.stringify(summary)}`);
    }
    return summary;
  } finally {
    await pool.end();
  }
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const runtime = parseEnvironment(readFileSync(envFile, 'utf8'));
  const cronSecret = runtime.CRON_SECRET;
  const connectionString = runtime.DATABASE_URL_UNPOOLED || runtime.DATABASE_URL;
  if (!cronSecret) throw new Error('CRON_SECRET is missing from production environment');
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is missing from production environment');
  console.log(`::add-mask::${cronSecret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  console.log(`::add-mask::${connectionString.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);

  const response = await fetch('https://votepredict.vercel.app/api/operations/opening-day-readiness', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(310_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Production Opening Day readiness returned HTTP ${response.status}: ${body.slice(0, 1600)}`);
  const readiness = JSON.parse(body) as Readiness;
  if (!readiness.sourceReadiness?.readyForLiveBootstrap) {
    console.log(JSON.stringify({
      bootstrap: 'skipped',
      reason: 'authoritative_sources_not_ready',
      blockers: readiness.sourceReadiness?.blockers ?? [],
    }));
    return;
  }

  const childEnv = { ...process.env, ...runtime };
  runChild('scripts/ingest-lrl-memberships.ts', ['--session=2027-2028'], childEnv);
  runChild('scripts/ingest-live-revisor-universe.ts', [], childEnv);
  console.log(JSON.stringify({ bootstrap: 'complete', verification: await verifyBootstrap(connectionString) }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});

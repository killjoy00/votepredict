/**
 * Protected production run of the raw Senate pre-passage vote collector
 * (scripts/collect-senate-raw-votes.ts) against the existing VotePredict Neon
 * default primary, using the repository's existing NEON_API_KEY secret.
 *
 * Order: reviewed-main-push gate -> Neon discovery -> read-only preflight
 * (write privilege, migration ledger, baseline counts) -> collection for one
 * allow-listed session -> read-only readback. Never prints connection details.
 *
 * Only writes source_documents rows / metadata.rawPrepassageVotes (see the
 * collector). vote_events and member_votes are checked unchanged afterwards.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { SENATE_RAW_VOTE_PARSER_VERSION } from '../src/sources/minnesota/senate-raw-votes.js';

const ALLOWED_SESSIONS = ['2025-2026', '2023-2024', '2021-2022'] as const;

function assertReviewedMainPush(): void {
  const env = process.env;
  const sha = env.GITHUB_SHA ?? '';
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? '', 'utf8')) as {
    ref?: string; after?: string; deleted?: boolean; forced?: boolean;
    repository?: { full_name?: string }; head_commit?: { id?: string };
  };
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || env.GITHUB_EVENT_NAME !== 'push'
    || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.VOTEPREDICT_RAW_VOTES_INDEPENDENT_CI !== 'true'
    || !/^[a-f0-9]{40}$/.test(sha)
    || event.ref !== 'refs/heads/main'
    || event.repository?.full_name !== 'killjoy00/votepredict'
    || event.after !== sha || event.head_commit?.id !== sha
    || event.deleted === true || event.forced === true) {
    throw new Error('Raw Senate vote collection requires a first-attempt reviewed main push after independent CI');
  }
}

function connectionUrl(target: { host: string; port: number; role: string; password: string; database: string }): string {
  const url = new URL('postgresql://placeholder/none');
  url.hostname = target.host;
  url.port = String(target.port);
  url.username = target.role;
  url.password = target.password;
  url.pathname = `/${target.database}`;
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

const COUNTS_SQL = `
  SELECT (SELECT count(*) FROM vote_events)::int AS vote_events,
         (SELECT count(*) FROM member_votes)::int AS member_votes,
         (SELECT count(*) FROM source_documents
           WHERE metadata->'rawPrepassageVotes'->>'sessionSlug'=$1)::int AS raw_documents`;

const READBACK_SQL = `
  SELECT sd.source_kind,
         count(*)::int AS documents,
         coalesce(sum((sd.metadata->'rawPrepassageVotes'->'stats'->>'records')::int),0)::int AS records,
         coalesce(sum((sd.metadata->'rawPrepassageVotes'->'stats'->>'rollCalls')::int),0)::int AS roll_calls,
         coalesce(sum((sd.metadata->'rawPrepassageVotes'->'stats'->>'withNames')::int),0)::int AS with_names,
         coalesce(sum((sd.metadata->'rawPrepassageVotes'->'stats'->>'namesMismatchTally')::int),0)::int AS names_mismatch_tally,
         min(sd.metadata->'rawPrepassageVotes'->>'sourceDate') AS first_source_date,
         max(sd.metadata->'rawPrepassageVotes'->>'sourceDate') AS last_source_date
    FROM source_documents sd
   WHERE sd.metadata->'rawPrepassageVotes'->>'sessionSlug'=$1
     AND sd.metadata->'rawPrepassageVotes'->>'parserVersion'=$2
   GROUP BY sd.source_kind
   ORDER BY sd.source_kind`;

async function readOnly<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url, application_name: 'votepredict-senate-raw-votes-readonly', statement_timeout: 120_000 });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      return await run(client);
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const session = process.env.VOTEPREDICT_RAW_VOTES_SESSION ?? '';
  if (!(ALLOWED_SESSIONS as readonly string[]).includes(session)) throw new Error(`Session must be one of ${ALLOWED_SESSIONS.join(', ')}`);
  let phase = 'main_push_gate';
  try {
    assertReviewedMainPush();

    phase = 'existing_neon_default_primary_discovery';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE || undefined,
      requirePrimary: true,
    });
    const url = connectionUrl(target);
    const childEnv = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, NEON_API_KEY: '' };

    phase = 'read_only_preflight';
    const before = await readOnly(url, async (client) => {
      const privilege = await client.query<{ can_insert: boolean; can_update: boolean; jurisdiction: boolean }>(
        `SELECT has_table_privilege(current_user,'public.source_documents','INSERT') AS can_insert,
                has_table_privilege(current_user,'public.source_documents','UPDATE') AS can_update,
                EXISTS (SELECT 1 FROM jurisdictions WHERE slug='us-mn') AS jurisdiction`,
      );
      const row = privilege.rows[0];
      if (!row?.can_insert || !row.can_update || !row.jurisdiction) throw new Error('Existing primary lacks source_documents write privilege or the us-mn jurisdiction');
      return (await client.query(COUNTS_SQL, [session])).rows[0] as { vote_events: number; member_votes: number; raw_documents: number };
    });

    phase = 'migration_ledger_check';
    const ledger = spawnSync('node', ['--import', 'tsx', 'scripts/check-production-migration-drift.ts'], {
      env: { ...childEnv, VOTEPREDICT_REQUIRE_MIGRATION_LEDGER: '1' },
      stdio: 'inherit',
    });
    if (ledger.status !== 0) throw new Error('Production migration ledger does not match this commit');

    phase = 'raw_collection';
    const collect = spawnSync('node', [
      '--import', 'tsx', 'scripts/collect-senate-raw-votes.ts',
      '--session', session, '--source', 'all', '--skip-existing', '--delay-ms', '200',
    ], { env: childEnv, stdio: 'inherit' });
    if (collect.status !== 0) throw new Error(`Collector exited with status ${collect.status}`);

    phase = 'read_only_readback';
    const after = await readOnly(url, async (client) => ({
      counts: (await client.query(COUNTS_SQL, [session])).rows[0] as { vote_events: number; member_votes: number; raw_documents: number },
      bySource: (await client.query(READBACK_SQL, [session, SENATE_RAW_VOTE_PARSER_VERSION])).rows,
    }));
    if (after.counts.raw_documents === 0) throw new Error('Readback found no raw documents for this session');

    const summary = {
      session,
      parserVersion: SENATE_RAW_VOTE_PARSER_VERSION,
      rawDocumentsBefore: before.raw_documents,
      rawDocumentsAfter: after.counts.raw_documents,
      voteEventsUnchanged: before.vote_events === after.counts.vote_events,
      memberVotesUnchanged: before.member_votes === after.counts.member_votes,
      bySource: after.bySource,
    };
    // vote_events/member_votes are not written by this collector; a difference
    // means another job wrote concurrently, so it is reported, not failed.
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Raw Senate votes ${session}\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`);
    }
  } catch (error) {
    // Phase and message only; never the connection object or request details.
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ session, failedPhase: phase, error: message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]') }));
    process.exitCode = 1;
  }
}

void main();

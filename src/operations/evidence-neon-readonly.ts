/**
 * Issue #847 — bounded, Vercel-independent evidence health proof.
 *
 * Only the already-migrated ingestion_runs and source_documents tables may be
 * queried. No production data is fetched in this module or its tests unless a
 * caller deliberately supplies a live connection. There is no write path.
 */
import type { PoolClient } from 'pg';

export const SANDBOX_CONFIRMATION = 'READ_ONLY_SANDBOX_AUDIT' as const;
export const SOURCE_KINDS = [
  'campaign_site',
  'campaign_site_registry',
  'member_primary_article',
  'member_primary_registry',
  'public_news_article',
  'campaign_finance_bulk',
] as const;

export interface ReadonlyAuditConfig {
  connectionString: string; // secret: caller must never print/serialize this
  expectedRole: string;
}

export interface EvidenceReadonlyHealthReport {
  schemaVersion: 'evidence-neon-readonly-health-v1';
  scope: 'sandbox_only';
  liveProductionAudited: false;
  generatedAt: string;
  dbReadOnlyTransactionVerified: true;
  leastPrivilegeRoleVerified: true;
  latestPipelineRun:
    | { status: 'running' | 'complete' | 'failed'; startedAt: string; finishedAt: string | null; newsInserted: number | null; newsFailures: number | null }
    | null;
  sourceFreshness: { kind: string; lastFetchedAt: string | null; observation: 'observed' | 'not_observed' }[];
  limitations: string[];
}

/**
 * Reject accidental production/admin credentials before connecting. This
 * guard cannot independently prove a Neon branch is a sandbox: operators
 * must bind only a dedicated non-production Neon branch to the protected
 * GitHub environment. The database role is checked *again* inside a read-
 * only transaction.
 */
export function validateReadonlySandboxConfig(
  env: Record<string, string | undefined>,
): ReadonlyAuditConfig {
  if (env.VOTEPREDICT_EVIDENCE_RO_EXECUTION_APPROVAL !== SANDBOX_CONFIRMATION) {
    throw new Error('Missing explicit sandbox read-only execution approval');
  }
  if (env.VOTEPREDICT_EVIDENCE_RO_SCOPE !== 'sandbox') {
    throw new Error('Read-only connection scope must be sandbox');
  }
  const raw = env.VOTEPREDICT_EVIDENCE_RO_DATABASE_URL?.trim();
  const expectedRole = env.VOTEPREDICT_EVIDENCE_RO_EXPECTED_ROLE?.trim();
  if (!raw || !expectedRole) {
    throw new Error('Dedicated sandbox Neon URL and expected least-privilege role are required');
  }
  if (!/^[a-z_][a-z0-9_]{2,62}$/.test(expectedRole)) {
    throw new Error('Expected database role has invalid format');
  }
  let url: URL;
  try { url = new URL(raw); } catch {
    throw new Error('Dedicated sandbox Neon URL is invalid');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.neon.tech') ||
    url.hostname.includes('dbbridge') ||
    url.searchParams.get('sslmode') !== 'verify-full' ||
    decodeURIComponent(url.username) !== expectedRole ||
    !url.password || !url.pathname || url.pathname === '/'
  ) {
    throw new Error('Sandbox connection must be a direct Neon Postgres host, matching role and verified TLS');
  }
  return { connectionString: raw, expectedRole };
}

export const READONLY_GUARD_SQL = `
  SELECT current_user::text AS role_name,
         current_setting('transaction_read_only') = 'on' AS in_readonly_transaction,
         r.rolsuper AS superuser,
         r.rolcreatedb AS creates_databases,
         r.rolcreaterole AS creates_roles,
         r.rolreplication AS replication,
         r.rolbypassrls AS bypasses_rls,
         EXISTS (SELECT 1 FROM pg_auth_members membership WHERE membership.member = r.oid) AS has_other_role_memberships,
         has_database_privilege(current_user, current_database(), 'CREATE') AS creates_database_objects,
         has_schema_privilege(current_user, 'public', 'CREATE') AS creates_schema_objects,
         has_table_privilege(current_user, 'public.ingestion_runs', 'SELECT') AS reads_ingestion,
         has_table_privilege(current_user, 'public.source_documents', 'SELECT') AS reads_sources,
         has_table_privilege(current_user, 'public.ingestion_runs', 'INSERT, UPDATE, DELETE, TRUNCATE') AS writes_ingestion,
         has_table_privilege(current_user, 'public.source_documents', 'INSERT, UPDATE, DELETE, TRUNCATE') AS writes_sources
    FROM pg_roles r WHERE r.rolname = current_user
`;

export const LATEST_PIPELINE_SQL = `
  SELECT status::text AS status,
         started_at::text AS started_at,
         finished_at::text AS finished_at,
         CASE WHEN (metadata->'news'->>'inserted') ~ '^[0-9]{1,8}$'
              THEN (metadata->'news'->>'inserted')::int ELSE NULL END AS news_inserted,
         CASE WHEN (metadata->'news'->>'failures') ~ '^[0-9]{1,8}$'
              THEN (metadata->'news'->>'failures')::int ELSE NULL END AS news_failures
    FROM ingestion_runs
   WHERE source_system = 'public-evidence-pipeline'
   ORDER BY started_at DESC
   LIMIT 1
`;

export const SOURCE_FRESHNESS_SQL = `
  SELECT source_kind::text AS kind, max(fetched_at)::text AS last_fetched_at
    FROM source_documents
   WHERE source_kind = ANY($1::text[])
   GROUP BY source_kind
   ORDER BY source_kind
   LIMIT 6
`;

interface GuardRow extends Record<string, unknown> {
  role_name: string;
  in_readonly_transaction: boolean;
  superuser: boolean;
  creates_databases: boolean;
  creates_roles: boolean;
  replication: boolean;
  bypasses_rls: boolean;
  has_other_role_memberships: boolean;
  creates_database_objects: boolean;
  creates_schema_objects: boolean;
  reads_ingestion: boolean;
  reads_sources: boolean;
  writes_ingestion: boolean;
  writes_sources: boolean;
}
interface PipelineRow extends Record<string, unknown> {
  status: string;
  started_at: string;
  finished_at: string | null;
  news_inserted: number | null;
  news_failures: number | null;
}
interface FreshnessRow extends Record<string, unknown> { kind: string; last_fetched_at: string | null; }

/** Caller injects one pg connection; the function never owns credentials. */
export async function auditNeonEvidenceReadonlySandbox(
  connect: () => Promise<Pick<PoolClient, 'query' | 'release'>>,
  expectedRole: string,
): Promise<EvidenceReadonlyHealthReport> {
  const client = await connect();
  let transactionOpened = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionOpened = true;
    await client.query(`SET LOCAL statement_timeout = '3000ms'`);
    await client.query(`SET LOCAL lock_timeout = '750ms'`);
    await client.query(`SET LOCAL idle_in_transaction_session_timeout = '6000ms'`);
    const guardRows = (await client.query<GuardRow>(READONLY_GUARD_SQL)).rows;
    if (guardRows.length !== 1) throw new Error('Read-only role verification unavailable');
    const r = guardRows[0];
    if (
      r.role_name !== expectedRole ||
      r.in_readonly_transaction !== true ||
      r.superuser !== false ||
      r.creates_databases !== false ||
      r.creates_roles !== false ||
      r.replication !== false ||
      r.bypasses_rls !== false ||
      r.has_other_role_memberships !== false ||
      r.creates_database_objects !== false ||
      r.creates_schema_objects !== false ||
      r.reads_ingestion !== true ||
      r.reads_sources !== true ||
      r.writes_ingestion !== false ||
      r.writes_sources !== false
    ) {
      throw new Error('Database role must be least-privilege and non-writing');
    }
    const runs = (await client.query<PipelineRow>(LATEST_PIPELINE_SQL)).rows;
    if (runs.length > 1 || (runs[0] && !['running', 'complete', 'failed'].includes(runs[0].status))) {
      throw new Error('Unexpected ingestion-run state');
    }
    const sources = (await client.query<FreshnessRow>(SOURCE_FRESHNESS_SQL, [[...SOURCE_KINDS]])).rows;
    const observed = new Map<string, string>();
    for (const item of sources) {
      if (!SOURCE_KINDS.includes(item.kind as typeof SOURCE_KINDS[number]) ||
          !item.last_fetched_at || observed.has(item.kind)) {
        throw new Error('Unexpected source-freshness state');
      }
      observed.set(item.kind, item.last_fetched_at);
    }
    const run = runs[0];
    const report: EvidenceReadonlyHealthReport = {
      schemaVersion: 'evidence-neon-readonly-health-v1',
      scope: 'sandbox_only',
      liveProductionAudited: false,
      generatedAt: new Date().toISOString(),
      dbReadOnlyTransactionVerified: true,
      leastPrivilegeRoleVerified: true,
      latestPipelineRun: run
        ? {
            status: run.status as 'running' | 'complete' | 'failed',
            startedAt: run.started_at,
            finishedAt: run.finished_at,
            newsInserted: run.news_inserted,
            newsFailures: run.news_failures,
          }
        : null,
      sourceFreshness: SOURCE_KINDS.map(kind => ({
        kind,
        lastFetchedAt: observed.get(kind) ?? null,
        observation: observed.has(kind) ? 'observed' : 'not_observed',
      })),
      limitations: [
        'Sandbox observation only; production data and live cron state not queried',
        'Missing ingestion/source rows are unobserved, not evidence of zero data',
        'Source freshness is fetched_at, not semantic applicability, publication date, or current schedule',
        'No data writes, source fetches, model fits, or probability/serving changes',
      ],
    };
    await client.query('ROLLBACK');
    transactionOpened = false;
    return report;
  } finally {
    if (transactionOpened) await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

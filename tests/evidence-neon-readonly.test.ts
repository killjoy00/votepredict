import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import {
  auditNeonEvidenceReadonlySandbox,
  validateReadonlySandboxConfig,
  SANDBOX_CONFIRMATION,
  READONLY_GUARD_SQL,
  LATEST_PIPELINE_SQL,
  SOURCE_FRESHNESS_SQL,
  SOURCE_KINDS,
} from '../src/operations/evidence-neon-readonly.js';

const FAKE_URL = 'postgresql://vp_evidence_ro_sandbox:fake-password@ep-sandbox.us-east-2.aws.neon.tech/neondb?sslmode=verify-full';
function config(overrides: Record<string, string | undefined> = {}) {
  return {
    VOTEPREDICT_EVIDENCE_RO_EXECUTION_APPROVAL: SANDBOX_CONFIRMATION,
    VOTEPREDICT_EVIDENCE_RO_SCOPE: 'sandbox',
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL,
    VOTEPREDICT_EVIDENCE_RO_EXPECTED_ROLE: 'vp_evidence_ro_sandbox',
    ...overrides,
  };
}
const READ_GUARD = {
  role_name: 'vp_evidence_ro_sandbox',
  in_readonly_transaction: true,
  superuser: false,
  creates_databases: false,
  creates_roles: false,
  replication: false,
  bypasses_rls: false,
  has_other_role_memberships: false,
  creates_database_objects: false,
  creates_schema_objects: false,
  reads_ingestion: true,
  reads_sources: true,
  writes_ingestion: false,
  writes_sources: false,
};

test('the direct Neon sandbox URL and expected role require an explicit verified TLS connection', () => {
  const c = validateReadonlySandboxConfig(config());
  assert.equal(c.expectedRole, 'vp_evidence_ro_sandbox');
  assert.equal(c.connectionString, FAKE_URL);
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_EXECUTION_APPROVAL: '',
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_SCOPE: 'production',
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: undefined,
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_EXPECTED_ROLE: 'postgres',
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL.replace('verify-full', 'require'),
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL.replace('.neon.tech', '.example.com'),
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL.replace('ep-sandbox.', 'dbbridge.'),
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_EXPECTED_ROLE: 'neondb_owner',
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL.replace('ep-sandbox.', 'ep-sandbox-pooler.'),
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL + '&host=bad.example.com',
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL + '&options=-c%20role%3Dpostgres',
  })));
  assert.throws(() => validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL.replace('.neon.tech/', '.neon.tech:5544/'),
  })));
  assert.equal(validateReadonlySandboxConfig(config({
    VOTEPREDICT_EVIDENCE_RO_DATABASE_URL: FAKE_URL + '&channel_binding=require',
  })).expectedRole, 'vp_evidence_ro_sandbox');
});

type Statement = { sql: string; values?: unknown[] };
function fakeClient(options: {
  guard?: Record<string, unknown> | null;
  runs?: unknown[];
  sources?: unknown[];
  failQuery?: string;
} = {}) {
  const calls: Statement[] = [];
  let released = false;
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql: sql.trim(), values });
      if (options.failQuery && sql.includes(options.failQuery)) {
        throw new Error('Simulated driver failure with sensitive details');
      }
      if (sql === READONLY_GUARD_SQL) {
        return { rows: options.guard === null ? [] : [options.guard ?? READ_GUARD] };
      }
      if (sql === LATEST_PIPELINE_SQL) return { rows: options.runs ?? [] };
      if (sql === SOURCE_FRESHNESS_SQL) return { rows: options.sources ?? [] };
      return { rows: [] };
    },
    release: () => { released = true; },
  } as unknown as Pick<PoolClient, 'query' | 'release'>;
  return { client, calls, get released() { return released; } };
}

test('read-only audit observes bounded, non-PII statuses and never writes', async () => {
  const m = fakeClient({
    runs: [{
      status: 'complete', started_at: '2026-10-01 00:00:00+00',
      finished_at: '2026-10-01 00:01:00+00', news_inserted: 2, news_failures: 1,
    }],
    sources: [
      { kind: 'public_news_article', last_fetched_at: '2026-10-01 00:00:00+00' },
    ],
  });
  const result = await auditNeonEvidenceReadonlySandbox(async () => m.client, 'vp_evidence_ro_sandbox');
  assert.equal(result.schemaVersion, 'evidence-neon-readonly-health-v1');
  assert.equal(result.liveProductionAudited, false);
  assert.equal(result.leastPrivilegeRoleVerified, true);
  assert.equal(result.dbReadOnlyTransactionVerified, true);
  assert.equal(result.latestPipelineRun?.newsInserted, 2);
  assert.equal(result.latestPipelineRun?.newsFailures, 1);
  assert.equal(result.sourceFreshness.length, 6);
  assert.equal(result.sourceFreshness.find(r => r.kind === 'public_news_article')?.observation, 'observed');
  assert.equal(result.sourceFreshness.find(r => r.kind === 'campaign_site')?.observation, 'not_observed');
  const parameterized = m.calls.filter(c => c.values !== undefined);
  assert.equal(parameterized.length, 1);
  assert.deepEqual(parameterized[0].values, [[...SOURCE_KINDS]]);
  assert.ok(m.calls.every(c => /^(BEGIN TRANSACTION|SET LOCAL|SELECT|ROLLBACK)/i.test(c.sql.trim())));
  assert.equal(m.calls.at(-1)?.sql, 'ROLLBACK');
  assert.equal(m.released, true);
  assert.equal(JSON.stringify(result).includes('fake-password'), false);
});

test('missing runs and source dates remain unknown, never zero or healthy', async () => {
  const m = fakeClient();
  const result = await auditNeonEvidenceReadonlySandbox(async () => m.client, 'vp_evidence_ro_sandbox');
  assert.equal(result.latestPipelineRun, null);
  assert.ok(result.sourceFreshness.every(x => x.lastFetchedAt === null && x.observation === 'not_observed'));
  assert.equal(m.released, true);
});

test('refuses wrong identity, elevated roles, direct write grants and missing SELECT', async () => {
  for (const changed of [
    { role_name: 'neondb_owner' },
    { in_readonly_transaction: false },
    { superuser: true },
    { creates_databases: true },
    { has_other_role_memberships: true },
    { creates_schema_objects: true },
    { writes_ingestion: true },
    { writes_sources: true },
    { reads_sources: false },
  ]) {
    const m = fakeClient({ guard: { ...READ_GUARD, ...changed } });
    await assert.rejects(
      () => auditNeonEvidenceReadonlySandbox(async () => m.client, 'vp_evidence_ro_sandbox'),
      /least-privilege/,
    );
    assert.equal(m.calls.at(-1)?.sql, 'ROLLBACK');
    assert.ok(m.calls.every(c => c.sql !== LATEST_PIPELINE_SQL));
    assert.equal(m.released, true);
  }
});

test('unexpected source kind and driver failures rollback, never return a partial health report', async () => {
  for (const m of [
    fakeClient({ sources: [{ kind: 'unknown', last_fetched_at: '2026-10-01' }] }),
    fakeClient({ failQuery: 'FROM source_documents' }),
    fakeClient({ guard: null }),
  ]) {
    await assert.rejects(
      () => auditNeonEvidenceReadonlySandbox(async () => m.client, 'vp_evidence_ro_sandbox'),
    );
    assert.equal(m.calls.at(-1)?.sql, 'ROLLBACK');
    assert.equal(m.released, true);
  }
});

test('manual sandbox workflow defaults off and cannot call Vercel, collectors or production', () => {
  const source = readFileSync('.github/workflows/evidence-neon-readonly-sandbox.yml', 'utf8');
  const on = source.slice(source.indexOf('\non:\n'), source.indexOf('\npermissions:\n'));
  assert.deepEqual([...on.matchAll(/^  ([a-z_]+):/gm)].map(m => m[1]), ['workflow_dispatch']);
  assert.match(source, /run_readonly:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(source, /inputs\.approval_phrase == 'READ_ONLY_SANDBOX_AUDIT'/);
  assert.match(source, /environment: evidence-readonly-sandbox/);
  assert.match(source, /secrets\.EVIDENCE_READONLY_SANDBOX_URL/);
  assert.match(source, /node --import tsx scripts\/audit-evidence-neon-readonly\.ts --connect/);
  assert.doesNotMatch(source, /VERCEL_TOKEN|vercel@|vercel env pull|run-direct-public-evidence-refresh|deploy --prod|cron\/forecasts/);
});

// Exercise the real Postgres privileges and rollback contract only against the
// disposable CI container (never a remote or production Neon endpoint).
const localTestUrl = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const localTest = (() => {
  if (!localTestUrl) return false;
  try {
    const u = new URL(localTestUrl);
    return ['localhost', '127.0.0.1'].includes(u.hostname) &&
      u.pathname === '/votepredict';
  } catch { return false; }
})();

test('disposable PostgreSQL role proves a real read-only transaction and least privilege', {
  skip: !localTest,
}, async () => {
  const owner = new Pool({ connectionString: localTestUrl, max: 1 });
  const role = 'vp_readonly_test_' + process.pid;
  const pass = randomBytes(14).toString('hex');
  const roUrl = new URL(localTestUrl!);
  roUrl.username = role;
  roUrl.password = pass;
  const readonly = new Pool({ connectionString: roUrl.toString(), max: 1 });
  let created = false;
  try {
    await owner.query(`CREATE ROLE "` + role + `" LOGIN PASSWORD '` + pass + `'`);
    created = true;
    await owner.query(`GRANT USAGE ON SCHEMA public TO "` + role + `"`);
    await owner.query(`GRANT SELECT ON public.ingestion_runs, public.source_documents TO "` + role + `"`);
    const report = await auditNeonEvidenceReadonlySandbox(() => readonly.connect(), role);
    assert.equal(report.dbReadOnlyTransactionVerified, true);
    assert.equal(report.leastPrivilegeRoleVerified, true);
    assert.equal(report.liveProductionAudited, false);
    await assert.rejects(
      () => auditNeonEvidenceReadonlySandbox(() => owner.connect(), 'postgres'),
      /least-privilege/,
    );
  } finally {
    await readonly.end();
    if (created) {
      await owner.query(`REVOKE ALL ON public.ingestion_runs, public.source_documents FROM "` + role + `"`);
      await owner.query(`REVOKE USAGE ON SCHEMA public FROM "` + role + `"`);
      await owner.query(`DROP ROLE "` + role + `"`);
    }
    await owner.end();
  }
});

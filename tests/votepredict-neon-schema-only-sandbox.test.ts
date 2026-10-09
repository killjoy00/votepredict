import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  SCHEMA_ONLY_APPROVAL,
  SCHEMA_ONLY_PREFIX,
  MAX_SANDBOX_HOURS,
  createVotePredictSchemaOnlySandbox,
  type SchemaOnlyCreateInput,
} from '../src/operations/votepredict-neon-schema-only-sandbox.js';

const now = Date.UTC(2026, 9, 9, 2, 0, 0);
const expiry = new Date(now + MAX_SANDBOX_HOURS * 3600 * 1000)
  .toISOString().replace('.000Z', 'Z');
const projectId = 'votepredict-example-12345678';
const runId = '37874080449';
const branchName = SCHEMA_ONLY_PREFIX + runId;
const branchId = 'br-schema-test-847';
const input: SchemaOnlyCreateInput = {
  apiKey: 'confidential-example-neon-key',
  projectId,
  repository: 'killjoy00/votepredict',
  ref: 'refs/heads/main',
  eventName: 'workflow_dispatch',
  approved: SCHEMA_ONLY_APPROVAL,
  runId,
};
type Call = { url: string; method: string; init: RequestInit };
type MockOpts = {
  project?: unknown; branches?: unknown; created?: unknown;
  detail?: unknown; endpoints?: unknown;
  postError?: boolean; deleteError?: boolean;
};
function jsonResponse(payload: unknown, status = 200) {
  return {
    status, ok: status >= 200 && status < 300,
    json: async () => payload,
  };
}
function mockApi(o: MockOpts = {}) {
  const calls: Call[] = [];
  const host = 'https://console.neon.tech/api/v2/projects/' + projectId;
  const branch = {
    id: branchId, name: branchName, default: false, protected: false,
    init_source: 'parent-schema', expires_at: expiry,
  };
  const request = async (url: string, init: RequestInit) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, init });
    if (method === 'GET' && url === host) {
      return jsonResponse(o.project ?? {
        project: { id: projectId, name: 'VotePredict' },
      });
    }
    if (method === 'GET' && url === host + '/branches?limit=10000') {
      return jsonResponse(o.branches ?? {
        branches: [{ id: 'br-default-abc123', name: 'main', default: true }],
      });
    }
    if (method === 'POST' && url === host + '/branches') {
      if (o.postError) throw new Error('Simulated POST response loss');
      return jsonResponse(o.created ?? {
        branch: { id: branchId, name: branchName },
      }, 201);
    }
    if (method === 'GET' && url === host + '/branches/' + branchId) {
      return jsonResponse(o.detail ?? { branch });
    }
    if (method === 'GET' && url === host + '/branches/' + branchId + '/endpoints') {
      return jsonResponse(o.endpoints ?? { endpoints: [] });
    }
    if (method === 'DELETE' && url === host + '/branches/' + branchId) {
      return jsonResponse({}, o.deleteError ? 403 : 200);
    }
    throw new Error('Unexpected mock call ' + method + ' ' + url);
  };
  return { calls, request };
}

test('one manual approved action creates only a no-compute, expiring, schema-only branch', async () => {
  const mock = mockApi();
  const r = await createVotePredictSchemaOnlySandbox(input, mock.request, now);
  assert.equal(r.schemaVersion, 'votepredict-neon-schema-only-sandbox-v1');
  assert.equal(r.branchId, branchId);
  assert.equal(r.branchName, branchName);
  assert.equal(r.expiresAt, expiry);
  assert.equal(r.initSource, 'parent-schema');
  assert.equal(r.expiryVerified, true);
  assert.equal(r.noComputeEndpointVerified, true);
  assert.equal(r.noDataCopyBySchemaOnlyMode, true);
  assert.equal(r.noDatabaseQuery, true);
  assert.equal(r.noEvidenceWrite, true);
  assert.equal(r.keyProjectScopeVerified, false);
  assert.deepEqual(mock.calls.map(c => c.method), ['GET', 'GET', 'POST', 'GET', 'GET']);
  const post = mock.calls[2];
  const body = JSON.parse(post.init.body as string);
  assert.deepEqual(body, {
    branch: {
      name: branchName, parent_id: 'br-default-abc123',
      init_source: 'schema-only', expires_at: expiry, protected: false,
    },
    endpoints: [],
  });
  assert.equal((post.init.headers as Record<string, string>).Authorization,
    'Bearer confidential-example-neon-key');
  assert.ok(!JSON.stringify(r).includes('confidential-example-neon-key'));
  assert.ok(!JSON.stringify(r).includes(projectId));
  assert.equal(mock.calls.filter(c => c.method === 'DELETE').length, 0);
});

test('requires exact approval, VotePredict main, credentials and real GitHub run ID before any API call', async () => {
  const badInputs: Partial<SchemaOnlyCreateInput>[] = [
    { approved: '' }, { approved: 'CREATE_VOTEPREDICT_NEON_PROJECT' },
    { ref: 'refs/heads/sandbox' }, { eventName: 'push' },
    { repository: 'killjoy00/mtg-ev-analyzer' }, { apiKey: '' },
    { projectId: '' }, { projectId: 'Pack 1' }, { projectId: 'bad/redirect' },
    { runId: '' }, { runId: 'not-a-real-run' },
  ];
  for (const bad of badInputs) {
    const mock = mockApi();
    await assert.rejects(
      () => createVotePredictSchemaOnlySandbox({ ...input, ...bad }, mock.request, now),
    );
    assert.equal(mock.calls.length, 0);
  }
});

test('wrong or unverified project and incomplete branch inventory fail before POST', async () => {
  for (const override of [
    { project: { project: { id: 'wrong-project', name: 'VotePredict' } } },
    { project: { project: { id: projectId, name: 'Pack 1' } } },
    { branches: { branches: [], pagination: { next: 'more' } } },
    { branches: { branches: [{ id: 'br-one-abc', default: false }] } },
    { branches: { branches: [
      { id: 'br-one-abc', default: true }, { id: 'br-two-def', default: true },
    ] } },
    { branches: { branches: [
      { id: 'br-default-abc123', default: true },
      { id: 'br-existing-abc', name: SCHEMA_ONLY_PREFIX + '12345', default: false },
    ] } },
  ]) {
    const mock = mockApi(override);
    await assert.rejects(
      () => createVotePredictSchemaOnlySandbox(input, mock.request, now),
    );
    assert.equal(mock.calls.some(c => c.method === 'POST'), false);
  }
});

test('a normal data-bearing branch, missing expiry, protected or unexpected endpoint is rejected and cleaned up', async () => {
  const valid = {
    id: branchId, name: branchName, default: false, protected: false,
    init_source: 'parent-schema', expires_at: expiry,
  };
  for (const override of [
    { detail: { branch: { ...valid, init_source: 'parent-data' } } },
    { detail: { branch: { ...valid, expires_at: undefined } } },
    { detail: { branch: { ...valid, expires_at: '2099-01-01T00:00:00Z' } } },
    { detail: { branch: { ...valid, protected: true } } },
    { detail: { branch: { ...valid, default: true } } },
    { endpoints: { endpoints: [{ id: 'ep-unexpected' }] } },
  ]) {
    const mock = mockApi(override);
    await assert.rejects(
      () => createVotePredictSchemaOnlySandbox(input, mock.request, now),
      /cleanup requested/,
    );
    assert.deepEqual(mock.calls.map(c => c.method),
      ['GET', 'GET', 'POST', 'GET', ...(override.endpoints ? ['GET'] : []), 'DELETE']);
    assert.ok(mock.calls.at(-1)?.url.endsWith('/branches/' + branchId));
  }
});

test('failed cleanup never falsely reports success or silently retries', async () => {
  const mock = mockApi({
    detail: { branch: {
      id: branchId, name: branchName, default: false,
      protected: false, init_source: 'parent-data', expires_at: expiry,
    } },
    deleteError: true,
  });
  await assert.rejects(
    () => createVotePredictSchemaOnlySandbox(input, mock.request, now),
    /cleanup is unconfirmed/,
  );
  assert.equal(mock.calls.filter(c => c.method === 'DELETE').length, 1);
  assert.equal(mock.calls.filter(c => c.method === 'POST').length, 1);
});

test('ambiguous POST transport failure must not be retried or deleted blindly', async () => {
  const mock = mockApi({ postError: true });
  await assert.rejects(
    () => createVotePredictSchemaOnlySandbox(input, mock.request, now),
    /result unknown/,
  );
  assert.deepEqual(mock.calls.map(c => c.method), ['GET', 'GET', 'POST']);
});

test('offline CLI never contacts Neon and rejects unapproved modes', () => {
  for (const mode of [[], ['--offline']]) {
    const r = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/create-votepredict-neon-schema-only-sandbox.ts', ...mode,
    ], {
      encoding: 'utf8', timeout: 8_000,
      env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
    });
    assert.equal(r.status, 0, r.stderr);
    const d = JSON.parse(r.stdout);
    assert.equal(d.mode, 'offline');
    assert.equal(d.branchCreated, false);
  }
  const bad = spawnSync(process.execPath, [
    '--import', 'tsx', 'scripts/create-votepredict-neon-schema-only-sandbox.ts',
    '--create',
  ], {
    encoding: 'utf8', timeout: 8_000,
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
  });
  assert.notEqual(bad.status, 0);
  assert.doesNotMatch(bad.stderr, /confidential-example-neon-key/);
});

test('GitHub schema-only creation is manual, protected, default-off with no auto data/production path', () => {
  const src = readFileSync('.github/workflows/votepredict-neon-schema-only-sandbox.yml', 'utf8');
  const trigger = src.slice(src.indexOf('\non:\n'), src.indexOf('\npermissions:\n'));
  assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):/gm)].map(m => m[1]),
    ['workflow_dispatch']);
  assert.match(trigger, /create_sandbox:[\s\S]*?type: boolean[\s\S]*?default: false/);
  const guard = src.match(/^\s+if: >-\s*\n((?: {6}[^\n]+\n?)+)/m)?.[1] ?? '';
  assert.equal(guard.replace(/\s+/g, ' ').trim(),
    "github.repository == 'killjoy00/votepredict' && github.ref == 'refs/heads/main' && inputs.create_sandbox == true && inputs.approval_phrase == 'CREATE_VOTEPREDICT_SCHEMA_ONLY_SANDBOX'");
  assert.match(src, /^    environment: evidence-readonly-sandbox\s*$/m);
  assert.match(src, /NEON_API_KEY: \$\{\{ secrets\.NEON_API_KEY \}\}/);
  assert.match(src, /VOTEPREDICT_NEON_PROJECT_ID: \$\{\{ vars\.VOTEPREDICT_NEON_PROJECT_ID \}\}/);
  assert.match(src, /scripts\/create-votepredict-neon-schema-only-sandbox\.ts --create/);
  assert.doesNotMatch(src, /^\s*(?:schedule|push|pull_request|workflow_run|issue_comment):/m);
  assert.doesNotMatch(src, /vercel|DATABASE_URL|psql|runPublicEvidenceRefresh|deploy --prod|curl |wget |branch_type: default|parent-data/i);
});

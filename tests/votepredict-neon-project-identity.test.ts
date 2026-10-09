import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  PROJECT_CHECK_APPROVAL,
  verifyVotePredictNeonProject,
  type NeonProjectCheckInput,
} from '../src/operations/votepredict-neon-project-identity.js';

const base: NeonProjectCheckInput = {
  apiKey: 'fake-key-that-must-never-be-logged',
  projectId: 'votepredict-example-12345678',
  repository: 'killjoy00/votepredict',
  ref: 'refs/heads/main',
  eventName: 'workflow_dispatch',
  approved: PROJECT_CHECK_APPROVAL,
};

const response = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value,
});

test('only one GET is sent to the specific configured Neon project', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const report = await verifyVotePredictNeonProject(base, async (url, init) => {
    calls.push({ url, init });
    return response({ project: { id: base.projectId, name: 'VotePredict' } });
  });
  assert.equal(report.verified, true);
  assert.equal(report.projectIdMatched, true);
  assert.equal(report.projectNameMatched, true);
  assert.equal(report.apiKeyScopeVerified, false);
  assert.equal(report.sandboxBranchCreated, false);
  assert.equal(report.productionDatabaseAccessed, false);
  assert.equal(report.evidenceWritten, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://console.neon.tech/api/v2/projects/votepredict-example-12345678');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization,
    'Bearer fake-key-that-must-never-be-logged');
  assert.ok(!JSON.stringify(report).includes('fake-key-that-must-never-be-logged'));
});

test('all missing or incorrect manual authorization inputs fail before any network call', async () => {
  for (const changed of [
    { approved: '' },
    { repository: 'killjoy00/mtg-ev-analyzer' },
    { ref: 'refs/heads/feature' },
    { eventName: 'push' },
    { apiKey: undefined },
    { projectId: undefined },
    { projectId: 'bad/route' },
    { projectId: 'Pack 1' },
  ] satisfies Partial<NeonProjectCheckInput>[]) {
    let called = false;
    await assert.rejects(
      () => verifyVotePredictNeonProject({ ...base, ...changed }, async () => {
        called = true;
        return response({});
      }),
    );
    assert.equal(called, false);
  }
});

test('mismatched ID or different project name (including Pack 1) fails closed', async () => {
  for (const p of [
    { id: 'wrong-project-12345678', name: 'VotePredict' },
    { id: base.projectId, name: 'Pack 1' },
    { id: base.projectId, name: 'OtherProduct' },
    { id: base.projectId, name: null },
    null,
  ]) {
    await assert.rejects(
      () => verifyVotePredictNeonProject(base, async () => response({ project: p })),
      /match|identify/,
    );
  }
});

test('Neon API permission failures, redirects, and invalid responses do not certify identity', async () => {
  for (const status of [301, 401, 403, 404, 429, 500]) {
    await assert.rejects(
      () => verifyVotePredictNeonProject(base, async () => response({}, status)),
      /not authorized or available/,
    );
  }
  await assert.rejects(
    () => verifyVotePredictNeonProject(base, async () => {
      throw new Error('Private Neon credentials should not appear in logs');
    }),
    /request failed/,
  );
  await assert.rejects(
    () => verifyVotePredictNeonProject(base, async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new Error('private content'); },
    })),
    /not parseable/,
  );
});

test('offline CLI does not contact any Neon service without explicit --verify', () => {
  const run = spawnSync(process.execPath, [
    '--import', 'tsx', 'scripts/verify-votepredict-neon-project.ts', '--offline',
  ], {
    encoding: 'utf8',
    timeout: 8_000,
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
  });
  assert.equal(run.status, 0, run.stderr);
  const value = JSON.parse(run.stdout);
  assert.equal(value.mode, 'offline');
  assert.equal(value.neonContacted, false);
  assert.equal(value.productionAccessed, false);
  assert.equal(value.evidenceWritten, false);
});

test('GitHub Actions identity check is manual only, default-off and environment-scoped', () => {
  const source = readFileSync('.github/workflows/verify-votepredict-neon-project.yml', 'utf8');
  const trigger = source.slice(source.indexOf('\non:\n'), source.indexOf('\npermissions:\n'));
  assert.deepEqual([...trigger.matchAll(/^  ([a-z_]+):/gm)].map(m => m[1]),
    ['workflow_dispatch']);
  assert.match(trigger, /verify_project:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(source, /github\.repository == 'killjoy00\/votepredict'/);
  assert.match(source, /github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /inputs\.verify_project == true/);
  assert.match(source, /inputs\.approval_phrase == 'VERIFY_VOTEPREDICT_NEON_PROJECT'/);
  assert.match(source, /environment: evidence-readonly-sandbox/);
  assert.match(source, /NEON_API_KEY: \$\{\{ secrets\.NEON_API_KEY \}\}/);
  assert.match(source, /VOTEPREDICT_NEON_PROJECT_ID: \$\{\{ vars\.VOTEPREDICT_NEON_PROJECT_ID \}\}/);
  assert.match(source, /node --import tsx scripts\/verify-votepredict-neon-project\.ts --verify/);
  assert.doesNotMatch(source, /schedule:|^\s+push:|pull_request:|workflow_run:|issue_comment:/m);
  assert.doesNotMatch(source, /vercel env pull|VERCEL_TOKEN|DATABASE_URL|psql|runPublicEvidenceRefresh|deploy --prod|create.*branch|POST \/projects|--connect/);
});

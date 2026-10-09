import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  auditEvidenceOperatingPosture,
  PAUSED_VERCEL_WORKFLOWS,
} from '../src/operations/evidence-operating-posture.js';

function readRepo(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
function auditWithOverride(path: string, content: string) {
  return auditEvidenceOperatingPosture(candidate =>
    candidate === path ? content : readRepo(candidate));
}

test('paused Vercel workflows and documentation match the source-controlled operating contract', () => {
  const result = auditEvidenceOperatingPosture(readRepo);
  assert.equal(result.passed, true, JSON.stringify(result.findings));
  assert.deepEqual(result.findings, []);
  assert.equal(result.protectedWorkflowCount, 17);
  assert.equal(result.protectedWorkflows.length, PAUSED_VERCEL_WORKFLOWS.length);
  assert.ok(result.protectedWorkflows.every(w =>
    w.triggers.length === 1 &&
    w.triggers[0] === 'workflow_dispatch' &&
    w.jobCount > 0 && w.jobCount === w.gatedJobCount));
  assert.equal(result.configuredVercelCronEntries, 0);
  assert.equal(result.configuredVercelGitDeploymentsDisabled, true);
  assert.equal(result.liveVercelCronStatus, 'unverified_not_queried');
  assert.equal(result.evidenceRefresh.workflowDispatchOnly, true);
  assert.equal(result.evidenceRefresh.dependsOnVercelEnvironmentPull, true);
  assert.equal(result.evidenceRefresh.directDatabaseWorkerPresent, true);
  assert.equal(result.evidenceRefresh.productionRefreshExecuted, false);
  assert.equal(result.sandboxReadonlyWorkflow.manualOnly, true);
  assert.equal(result.sandboxReadonlyWorkflow.approvalGuardPresent, true);
  assert.equal(result.sandboxReadonlyWorkflow.vercelDependencyPresent, false);
  assert.equal(result.sandboxReadonlyWorkflow.sandboxCredentialPathPresent, true);
});

test('adding an automatic push trigger fails the paused workflow audit', () => {
  const path = '.github/workflows/public-evidence-refresh.yml';
  const changed = readRepo(path).replace(
    'on:\n  workflow_dispatch:', 'on:\n  push:\n  workflow_dispatch:',
  );
  assert.equal(auditWithOverride(path, changed).passed, false);
});

test('changing approval input default to true fails closed', () => {
  const path = '.github/workflows/public-evidence-refresh.yml';
  const changed = readRepo(path).replace('default: false', 'default: true');
  assert.equal(auditWithOverride(path, changed).passed, false);
});

test('removing the approval/main branch job guard fails closed', () => {
  const path = '.github/workflows/public-evidence-refresh.yml';
  const changed = readRepo(path).replace(
    "if: inputs.run_vercel == true && github.ref == 'refs/heads/main'",
    "if: github.ref == 'refs/heads/main'",
  );
  assert.equal(auditWithOverride(path, changed).passed, false);
});

test('adding a repository cron or reactivating Git deployments fails closed', () => {
  const path = 'vercel.json';
  const current = JSON.parse(readRepo(path)) as {
    git: { deploymentEnabled: boolean }; crons?: { path: string; schedule: string }[];
  };
  current.crons = [{ path: '/api/cron/forecasts', schedule: '0 8 * * *' }];
  assert.equal(auditWithOverride(path, JSON.stringify(current)).passed, false);
  delete current.crons;
  current.git.deploymentEnabled = true;
  assert.equal(auditWithOverride(path, JSON.stringify(current)).passed, false);
});

test('obsolete evidence refresh cadence or automated deployment instructions fail closed', () => {
  const epath = 'docs/EVIDENCE-INGESTION.md';
  const ev = readRepo(epath).replace('**Current cadence: suspended.**',
    'invokes the protected production runtime every six hours');
  assert.equal(auditWithOverride(epath, ev).passed, false);

  const dpath = 'docs/DEPLOYMENT.md';
  const deployment = readRepo(dpath).replace(
    '**Current deployment posture: paused and manual-only.**',
    'It is triggered by completion of the CI workflow.',
  );
  assert.equal(auditWithOverride(dpath, deployment).passed, false);
});

test('unknown trigger syntax and missing required input never pass open', () => {
  const path = '.github/workflows/public-evidence-refresh.yml';
  const original = readRepo(path);
  assert.equal(auditWithOverride(path, original.replace(
    'on:\n  workflow_dispatch:', 'on: [workflow_dispatch]',
  )).passed, false);
  assert.equal(auditWithOverride(path, original.replace(
    '      run_vercel:', '      enable_something_else:',
  )).passed, false);
});


test('sandbox-only audit workflow rejects a pushed trigger', () => {
  const path = '.github/workflows/evidence-neon-readonly-sandbox.yml';
  const changed = readRepo(path).replace(
    'on:\n  workflow_dispatch:', 'on:\n  push:\n  workflow_dispatch:',
  );
  assert.equal(auditWithOverride(path, changed).passed, false);
});

test('sandbox-only audit workflow rejects removed approval, changed role path and Vercel reintroduction', () => {
  const path = '.github/workflows/evidence-neon-readonly-sandbox.yml';
  const original = readRepo(path);
  for (const changed of [
    original.replace("inputs.approval_phrase == 'READ_ONLY_SANDBOX_AUDIT'", "inputs.run_readonly == true"),
    original.replace("inputs.approval_phrase == 'READ_ONLY_SANDBOX_AUDIT'", "inputs.approval_phrase == 'READ_ONLY_SANDBOX_AUDIT' || true"),
    original.replace('default: false', 'default: true'),
    original.replace('environment: evidence-readonly-sandbox', 'environment: production'),
    original.replace('secrets.EVIDENCE_READONLY_SANDBOX_URL', 'secrets.DATABASE_URL'),
    original.replace('node --import tsx scripts/audit-evidence-neon-readonly.ts --connect',
      'npx vercel env pull'),
  ]) {
    assert.equal(auditWithOverride(path, changed).passed, false);
  }
});

test('prospective read and P8 model workflows cannot be reactivated by an issue comment or absent opt-in', () => {
  for (const name of ['evidence-2027-readiness-audit.yml', 'lifecycle-p8-prospective-model.yml']) {
    const path = '.github/workflows/' + name;
    const original = readRepo(path);
    assert.ok(original.includes('on:\n  workflow_dispatch:'));
    assert.ok(original.includes("if: inputs.run_vercel == true && github.ref == 'refs/heads/main'"));
    for (const changed of [
      original.replace('on:\n  workflow_dispatch:', 'on:\n  issue_comment:\n    types: [created, edited]\n  workflow_dispatch:'),
      original.replace('default: false', 'default: true'),
      original.replace("if: inputs.run_vercel == true && github.ref == 'refs/heads/main'", "if: github.ref == 'refs/heads/main'"),
      original.replace("if: inputs.run_vercel == true && github.ref == 'refs/heads/main'", "if: inputs.run_vercel == true"),
    ]) {
      assert.equal(auditWithOverride(path, changed).passed, false, name);
    }
  }
});

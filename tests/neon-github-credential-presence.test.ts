import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const script = 'scripts/check-github-neon-credential-presence.mjs';
const workflow = '.github/workflows/evidence-neon-github-credential-preflight.yml';
const defaults = {
  VOTEPREDICT_HAS_NEON_API_KEY: 'false',
  VOTEPREDICT_HAS_NEON_PROJECT_ID: 'false',
  VOTEPREDICT_HAS_REPO_SANDBOX_URL: 'false',
  VOTEPREDICT_HAS_LEGACY_DB_URL: 'false',
};

function run(overrides: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      NODE_ENV: 'test',
      ...defaults,
      ...overrides,
    },
    timeout: 5_000,
  });
  return result;
}

test('missing GitHub credentials are reported as blocked, not guessed', () => {
  const out = run();
  assert.equal(out.status, 0, out.stderr);
  const report = JSON.parse(out.stdout);
  assert.equal(report.schemaVersion, 'votepredict-github-neon-credential-presence-v1');
  assert.equal(report.scope, 'repository_secret_names_only');
  assert.equal(report.status, 'no_verified_direct_neon_credentials');
  assert.ok(Object.values(report.credentialNamesPresent).every(v => v === false));
  assert.ok(Object.values(report.checks).every(v => v === false));
  assert.equal(report.caveats.some((v: string) => v.includes('environment-level')), true);
});

test('a Neon key and project variable only yield an unverified candidate', () => {
  const out = run({
    VOTEPREDICT_HAS_NEON_API_KEY: 'true',
    VOTEPREDICT_HAS_NEON_PROJECT_ID: 'true',
  });
  assert.equal(out.status, 0, out.stderr);
  const report = JSON.parse(out.stdout);
  assert.equal(report.status, 'neon_api_identity_candidates_present');
  assert.equal(report.checks.projectIdentityVerified, false);
  assert.equal(report.checks.databaseConnected, false);
  assert.equal(report.checks.productionAccessed, false);
});

test('a repo-level sandbox URL flag alone is not proof of a nonproduction branch', () => {
  const out = run({ VOTEPREDICT_HAS_REPO_SANDBOX_URL: 'true' });
  assert.equal(out.status, 0, out.stderr);
  const report = JSON.parse(out.stdout);
  assert.equal(report.status, 'sandbox_url_name_present_scope_unverified');
  assert.equal(report.checks.branchIsolationVerified, false);
  assert.equal(report.checks.sqlRoleVerified, false);
  assert.equal(report.checks.evidenceWritten, false);
});

test('unknown values and missing booleans fail closed without echoing secret input', () => {
  const secretLike = 'postgres://secret-user:secret-password@private-host';
  const out = run({ VOTEPREDICT_HAS_NEON_API_KEY: secretLike });
  assert.notEqual(out.status, 0);
  assert.doesNotMatch(out.stdout + out.stderr, /secret-user|secret-password|private-host/);
  assert.match(out.stderr, /no connection attempted/);
  const missing = run({ VOTEPREDICT_HAS_NEON_PROJECT_ID: '' });
  assert.notEqual(missing.status, 0);
});

test('GitHub preflight is a one-file merge trigger and does no network or production work', () => {
  const source = readFileSync(workflow, 'utf8');
  const triggers = source.slice(source.indexOf('\non:\n'), source.indexOf('\npermissions:\n'));
  assert.match(triggers, /^  push:\n    branches: \[main\]\n    paths:\n      - \.github\/workflows\/evidence-neon-github-credential-preflight\.yml$/m);
  assert.match(triggers, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(triggers, /schedule:|issue_comment:|pull_request:|workflow_run:/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /secrets\.NEON_API_KEY != ''/);
  assert.match(source, /vars\.VOTEPREDICT_NEON_PROJECT_ID != ''/);
  assert.match(source, /secrets\.EVIDENCE_READONLY_SANDBOX_URL != ''/);
  assert.doesNotMatch(source, /vercel env pull|VERCEL_TOKEN|curl |wget |psql|--connect|runPublicEvidenceRefresh|deploy --prod|permissions:\s*[\s\S]*?id-token: write/i);
  assert.doesNotMatch(source, /^\s+(?:NEON_API_KEY|DATABASE_URL_UNPOOLED):\s+\$\{\{\s*secrets\./m);
  assert.match(source, /run: node scripts\/check-github-neon-credential-presence\.mjs/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { databaseTargetFingerprint, executionPosture, migrationLedgerDigest, readReleaseBinding } from '../src/operations/release-readiness';
import { assertGreenMainRelease } from '../src/operations/release-ci';
import schema from '../src/operations/release-schema.json';

const entries = readdirSync('migrations').filter(f => f.endsWith('.sql')).sort().map(filename => ({
  filename, checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
}));

test('manual release CLI entry loads under the exact workflow command and fails closed without credentials', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-release-ci.ts'], {
    encoding: 'utf8', timeout: 15_000, env: { ...process.env, GITHUB_TOKEN: '', RELEASE_SHA: 'a'.repeat(40) },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GitHub Actions credential required/);
  assert.doesNotMatch(result.stderr, /Transform failed|Top-level await/);
});

test('bundled release schema binds every migration, including changed SQL bytes', () => {
  assert.equal(schema.count, entries.length);
  assert.equal(schema.sha256, migrationLedgerDigest(entries));
  assert.notEqual(schema.sha256, migrationLedgerDigest(entries.slice(1)));
  assert.notEqual(schema.sha256, migrationLedgerDigest([...entries, entries[0]]));
});

test('database binding ignores credentials and pooling but distinguishes endpoint, role and database', () => {
  const original = 'postgresql://owner:secret@ep-example.region.neon.tech/votepredict?sslmode=require';
  const hash = databaseTargetFingerprint(original);
  assert.match(hash!, /^[a-f0-9]{64}$/);
  assert.equal(hash, databaseTargetFingerprint(original.replace(':secret@', ':rotated@').replace('ep-example.', 'ep-example-pooler.')));
  for (const replacement of [original.replace('votepredict', 'other'), original.replace('owner', 'other'), original.replace('ep-example', 'ep-other')])
    assert.notEqual(hash, databaseTargetFingerprint(replacement));
  assert.equal(databaseTargetFingerprint(undefined), null);
  assert.equal(databaseTargetFingerprint('https://example.test/db'), null);
  for (const key of ['host', 'hostaddr', 'port', 'user', 'options', 'service'])
    assert.equal(databaseTargetFingerprint(original + '&' + key + '=other'), null);
});

test('Vercel remains paused even for missing, unknown or requested active modes', () => {
  for (const mode of [undefined, 'readiness', 'paused', 'manual-baseline', 'active']) {
    const posture = executionPosture({ VERCEL: '1', VOTEPREDICT_EXECUTION_MODE: mode });
    assert.equal(posture.forecastsEnabled, false);
    assert.equal(posture.schedulerEnabled, false);
    assert.equal(posture.prospective2027Enabled, false);
    assert.equal(posture.automaticRunsPerDay, 0);
  }
  assert.equal(executionPosture({ VOTEPREDICT_EXECUTION_MODE: 'readiness' }).forecastsEnabled, false);
  assert.equal(executionPosture({}).mode, 'development');
});

function database(ledger = entries, fail = '') {
  const calls: string[] = [];
  let released: boolean | undefined;
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (fail && sql.includes(fail)) throw new Error('simulated failure');
    return { rows: sql.startsWith('SELECT filename') ? ledger : [{ read_only: 'on', isolation: 'repeatable read' }] };
  }, release: (destroy: boolean) => { released = destroy; } };
  return { db: { connect: async () => client } as never, calls, released: () => released };
}

test('binding verifies one bounded read-only snapshot and rollback; mismatches never pass', async () => {
  const hash = 'a'.repeat(64);
  const mock = database();
  assert.equal((await readReleaseBinding(mock.db, hash, hash)).verified, true);
  assert.equal(mock.calls[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(mock.calls.at(-1), 'ROLLBACK');
  assert.equal(mock.released(), false);
  assert.equal((await readReleaseBinding(database().db, hash, 'b'.repeat(64))).verified, false);
  assert.equal((await readReleaseBinding(database().db, hash, undefined)).verified, false);
  assert.equal((await readReleaseBinding(database(entries.slice(1)).db, hash, hash)).verified, false);
  for (const failure of ['SELECT filename', 'ROLLBACK']) {
    const broken = database(entries, failure);
    await assert.rejects(readReleaseBinding(broken.db, hash, hash));
    assert.equal(broken.calls.at(-1), 'ROLLBACK');
    assert.equal(broken.released(), failure === 'ROLLBACK');
  }
});

test('release CI gate requires latest successful exact-main trusted workflow run', () => {
  const sha = 'a'.repeat(40);
  const green = { head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml',
    run_number: 10, run_attempt: 1, status: 'completed', conclusion: 'success' };
  assert.doesNotThrow(() => assertGreenMainRelease(sha, [green]));
  for (const changes of [{ head_sha: 'b'.repeat(40) }, { head_branch: 'topic' }, { event: 'pull_request' },
    { path: '.github/workflows/other.yml' }, { conclusion: 'failure' }, { status: 'in_progress' }])
    assert.throws(() => assertGreenMainRelease(sha, [{ ...green, ...changes }]));
  assert.throws(() => assertGreenMainRelease(sha, [green, { ...green, run_attempt: 2, conclusion: 'failure' }]));
  assert.throws(() => assertGreenMainRelease(sha, []));
});

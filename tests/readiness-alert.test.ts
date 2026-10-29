import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReadinessDrillRun, deliverReadinessDrillAlert } from '../src/operations/readiness-alert';

test('readiness alerts require delivery and exact readback, with no arbitrary destination', async () => {
  const calls: string[] = [];
  let body = '';
  const request = async (url: string, init: RequestInit) => {
    calls.push(url);
    if (init.method === 'POST') { body = JSON.parse(String(init.body)).body; return Response.json({ id: 123 }); }
    return Response.json({ body });
  };
  assert.deepEqual(await deliverReadinessDrillAlert({ incomplete: 0, failed: 1, unsealed: 0 }, '123', 'fixture', request as typeof fetch),
    { commentId: 123, state: 'failure', readbackVerified: true });
  assert.equal(calls[0], 'https://api.github.com/repos/killjoy00/votepredict/issues/1586/comments');
  assert.equal(calls[1], 'https://api.github.com/repos/killjoy00/votepredict/issues/comments/123');
  assert.equal((await deliverReadinessDrillAlert({ incomplete: 0, failed: 0, unsealed: 0 }, '123', 'fixture', request as typeof fetch)).state, 'recovered');
  await assert.rejects(deliverReadinessDrillAlert({ incomplete: 0, failed: 1, unsealed: 0 }, '123', 'fixture',
    (async () => Response.json({ body: 'wrong', id: 123 })) as typeof fetch), /readback failed/);
  await assert.rejects(deliverReadinessDrillAlert({ incomplete: -1, failed: 0, unsealed: 0 }, '123', 'fixture', request as typeof fetch));
});

test('delivery drill refuses PRs, forks, retries, forced pushes and unreviewed main events', () => {
  const env = { GITHUB_REPOSITORY: 'killjoy00/votepredict', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: 'a'.repeat(40), GITHUB_WORKFLOW_REF: 'killjoy00/votepredict/.github/workflows/baseline-readiness.yml@refs/heads/main' };
  const event = { after: env.GITHUB_SHA, head_commit: { id: env.GITHUB_SHA, message: 'BASELINE_READINESS_CANARY_20261026' } };
  assert.doesNotThrow(() => assertReadinessDrillRun(env, event));
  for (const patch of [{ GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REPOSITORY: 'other/repo' }, { GITHUB_RUN_ATTEMPT: '2' },
    { GITHUB_WORKFLOW_REF: 'other' }, { GITHUB_SHA: 'b'.repeat(40) }, { GITHUB_REF: 'refs/heads/topic' }])
    assert.throws(() => assertReadinessDrillRun({ ...env, ...patch }, event));
  assert.throws(() => assertReadinessDrillRun(env, { ...event, forced: true }));
  assert.throws(() => assertReadinessDrillRun(env, { ...event, head_commit: { ...event.head_commit, message: 'ordinary' } }));
});

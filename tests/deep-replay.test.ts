import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isStrictlyPreVoteTimestamp,
  replayCaseValidationErrors,
  strictPreVoteCutoff,
  summarizeReplayCohort,
  type HistoricalReplayCase,
} from '../src/evaluation/deep-replay.js';

function replayCase(overrides: Partial<HistoricalReplayCase> = {}): HistoricalReplayCase {
  return {
    voteEventId: 'vote-1',
    billId: 'bill-1',
    billVersionId: 'version-1',
    identifier: 'HF 100',
    title: 'Example bill',
    session: '2025-2026',
    chamber: 'house',
    occurredOn: '2026-03-10',
    cutoff: '2026-03-09T23:59:59.999Z',
    billVersionPublishedAt: '2026-03-08T12:00:00.000Z',
    billTextLength: 500,
    passed: true,
    yeaCount: 70,
    nayCount: 60,
    decisiveMemberVotes: 130,
    storedEvidenceCount: 2,
    billScopedEvidenceCount: 1,
    memberScopedEvidenceCount: 1,
    evidenceKinds: ['fact'],
    sourceKinds: ['official'],
    extractionMethods: ['curated-source-manifest'],
    ...overrides,
  };
}

test('strict replay cutoff is the end of the prior calendar day', () => {
  assert.equal(strictPreVoteCutoff('2026-03-10'), '2026-03-09T23:59:59.999Z');
  assert.equal(strictPreVoteCutoff('2026-01-01'), '2025-12-31T23:59:59.999Z');
});

test('same-day target text and evidence are rejected to fail closed on unknown vote time', () => {
  assert.equal(isStrictlyPreVoteTimestamp('2026-03-09T23:59:59.999Z', '2026-03-10'), true);
  assert.equal(isStrictlyPreVoteTimestamp('2026-03-10T00:00:00.000Z', '2026-03-10'), false);
  assert.equal(isStrictlyPreVoteTimestamp('2026-03-11T00:00:00.000Z', '2026-03-10'), false);
});

test('missing and invalid timestamps fail closed', () => {
  assert.equal(isStrictlyPreVoteTimestamp(undefined, '2026-03-10'), false);
  assert.equal(isStrictlyPreVoteTimestamp(null, '2026-03-10'), false);
  assert.equal(isStrictlyPreVoteTimestamp('not-a-date', '2026-03-10'), false);
  assert.equal(isStrictlyPreVoteTimestamp('2026-03-09T12:00:00.000Z', 'not-a-date'), false);
});

test('valid replay case passes the cohort contract', () => {
  assert.deepEqual(replayCaseValidationErrors(replayCase()), []);
});

test('replay case rejects same-day text, bad cutoff, short text, and tiny vote records', () => {
  const errors = replayCaseValidationErrors(replayCase({
    billVersionPublishedAt: '2026-03-10T01:00:00.000Z',
    cutoff: '2026-03-10T23:59:59.999Z',
    billTextLength: 50,
    decisiveMemberVotes: 10,
  }));
  assert.ok(errors.includes('target bill version is not strictly pre-vote'));
  assert.ok(errors.includes('research cutoff is not the end of the prior calendar day'));
  assert.ok(errors.some((error) => error.includes('bill text is shorter')));
  assert.ok(errors.some((error) => error.includes('decisive member votes')));
});

test('invalid vote date reports a validation error instead of throwing', () => {
  const errors = replayCaseValidationErrors(replayCase({ occurredOn: 'not-a-date', cutoff: 'bad' }));
  assert.ok(errors.includes('vote date is invalid'));
});

test('cohort summary keeps failures and evidence coverage visible by session and chamber', () => {
  const summary = summarizeReplayCohort([
    replayCase({ voteEventId: 'a', passed: true, storedEvidenceCount: 2 }),
    replayCase({ voteEventId: 'b', passed: false, storedEvidenceCount: 0 }),
    replayCase({ voteEventId: 'c', session: '2023-2024', chamber: 'senate', passed: true, storedEvidenceCount: 0 }),
  ]);

  assert.equal(summary.cases, 3);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.withStoredEvidence, 1);
  assert.equal(summary.withoutStoredEvidence, 2);
  assert.equal(summary.bySessionChamber['2025-2026:house'].cases, 2);
  assert.equal(summary.bySessionChamber['2025-2026:house'].failed, 1);
  assert.equal(summary.bySessionChamber['2023-2024:senate'].cases, 1);
});

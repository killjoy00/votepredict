import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLifecycleP6ConditionalPredictions,
  combineLifecycleAndConditional,
  type LifecycleP6SessionChamberRef,
} from '../src/evaluation/lifecycle-p6-end-to-end.js';
import type { LifecycleP3Snapshot } from '../src/evaluation/lifecycle-p3-snapshot-dataset.js';
import type {
  QuickReplayEvent,
  QuickReplayMembership,
  QuickReplayVote,
} from '../src/evaluation/historical-quick-replay.js';

function snapshot(cutoff: string): LifecycleP3Snapshot {
  return {
    schemaVersion: 'lifecycle-p3-snapshot-v1',
    datasetVersion: 'mn-2021-2026-event-time-v1',
    snapshotId: `snap-${cutoff}`,
    bill: {
      billId: 'bill-target',
      session: '2023-2024',
      chamber: 'house',
      identifier: 'HF42',
    },
    cutoff: {
      asOfDateExclusive: cutoff,
      granularity: 'date',
      sameDayExcluded: true,
      reason: 'introduction',
    },
    features: {
      lifecycleState: 'introduced',
      daysSinceIntroduction: 0,
      daysSincePreviousTransition: 0,
      daysRemainingInBiennium: 400,
      priorProcessEventCount: 0,
      priorProcessStageCounts: {},
      priorCompanionIdentifiers: [],
      latestEligibleBillVersion: null,
      authorship: {
        reconstructable: false,
        membershipIds: null,
        parserVersion: null,
      },
      evidenceFamilyCounts: {},
    },
    targets: {
      transitionOnCutoffDate: {
        stageKinds: [],
        toState: null,
        terminalOutcome: null,
      },
      eventualSourceChamberPassage: false,
      eventualReachesSourceChamberPassageVote: false,
      terminalOutcome: 'session_expired_without_source_chamber_passage',
      memberVoteLabel: null,
    },
    lineage: {
      introductionParserVersion: 'revisor-introduction-v1',
      processParserVersion: 'revisor-process-v2',
      processAuditVersion: 'revisor-process-audit-v1',
      processStatus: 'parsed',
      passageLabelVersion: 'revisor-source-chamber-passage-v1',
      priorProcessSourceDocumentSha256: [],
      priorProcessSourceUrls: [],
    },
  };
}

test('P6 end-to-end composition is the lifecycle reach probability times conditional chamber passage', () => {
  assert.equal(combineLifecycleAndConditional(0.2, 0.75), 0.15);
});

test('P6 conditional fallback excludes same-day passage outcomes', () => {
  const priorEvent: QuickReplayEvent = {
    voteEventId: 'prior',
    billId: 'prior-bill',
    identifier: 'HF1',
    title: 'Prior',
    sessionId: 'session-2021',
    session: '2021-2022',
    chamberId: 'house-id',
    chamber: 'house',
    occurredOn: '2022-05-01',
    yeaCount: 80,
    nayCount: 50,
    passed: true,
  };
  const sameDayFailure: QuickReplayEvent = {
    ...priorEvent,
    voteEventId: 'same-day',
    billId: 'same-day-bill',
    occurredOn: '2023-01-10',
    passed: false,
  };
  const ref: LifecycleP6SessionChamberRef = {
    sessionSlug: '2023-2024',
    chamber: 'house',
    sessionId: 'session-2023',
    chamberId: 'house-id',
  };
  const result = buildLifecycleP6ConditionalPredictions({
    snapshots: [snapshot('2023-01-10')],
    versionsByBill: new Map(),
    passageEvents: [priorEvent, sameDayFailure],
    memberships: [] as QuickReplayMembership[],
    historicalVotes: [] as QuickReplayVote[],
    sessionChamberRefs: new Map([['2023-2024|house', ref]]),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'prior-floor-pass-rate-fallback');
  assert.equal(result[0].reason, 'no-target-text');
  assert.equal(result[0].fallbackProbability, 0.75);
});

test('P6 conditional fallback changes only after an earlier passage result becomes available', () => {
  const events: QuickReplayEvent[] = [
    {
      voteEventId: 'pass',
      billId: 'bill-pass',
      identifier: 'HF1',
      title: 'Pass',
      sessionId: 'session-2021',
      session: '2021-2022',
      chamberId: 'house-id',
      chamber: 'house',
      occurredOn: '2022-05-01',
      yeaCount: 80,
      nayCount: 50,
      passed: true,
    },
    {
      voteEventId: 'fail',
      billId: 'bill-fail',
      identifier: 'HF2',
      title: 'Fail',
      sessionId: 'session-2023',
      session: '2023-2024',
      chamberId: 'house-id',
      chamber: 'house',
      occurredOn: '2023-02-01',
      yeaCount: 60,
      nayCount: 70,
      passed: false,
    },
  ];
  const ref: LifecycleP6SessionChamberRef = {
    sessionSlug: '2023-2024',
    chamber: 'house',
    sessionId: 'session-2023',
    chamberId: 'house-id',
  };
  const result = buildLifecycleP6ConditionalPredictions({
    snapshots: [snapshot('2023-01-10'), snapshot('2023-03-01')],
    versionsByBill: new Map(),
    passageEvents: events,
    memberships: [],
    historicalVotes: [],
    sessionChamberRefs: new Map([['2023-2024|house', ref]]),
  });
  assert.equal(result[0].fallbackProbability, 0.75);
  assert.equal(result[1].fallbackProbability, 0.5);
});

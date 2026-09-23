import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStaticIntroductionBenchmark,
  buildForwardChainedHazardPredictions,
  buildForwardChainedStagePassagePredictions,
  buildLifecycleHazardRiskRows,
} from '../src/evaluation/lifecycle-p4-baselines.js';
import type { LifecycleP3Snapshot } from '../src/evaluation/lifecycle-p3-snapshot-dataset.js';
import type { BillStagePrediction } from '../src/evaluation/stages.js';

function snapshot(input: {
  billId: string;
  session: string;
  chamber?: 'house' | 'senate';
  cutoff: string;
  state: LifecycleP3Snapshot['features']['lifecycleState'];
  toState?: LifecycleP3Snapshot['features']['lifecycleState'] | null;
  terminal?: LifecycleP3Snapshot['targets']['terminalOutcome'] | null;
  passage?: boolean;
  daysRemaining?: number;
}): LifecycleP3Snapshot {
  return {
    schemaVersion: 'lifecycle-p3-snapshot-v1',
    datasetVersion: 'mn-2021-2026-event-time-v1',
    snapshotId: `${input.billId}-${input.cutoff}`,
    bill: {
      billId: input.billId,
      session: input.session,
      chamber: input.chamber ?? 'house',
      identifier: input.billId,
    },
    cutoff: {
      asOfDateExclusive: input.cutoff,
      granularity: 'date',
      sameDayExcluded: true,
      reason: input.terminal ? 'before_terminal' : input.toState ? 'before_transition' : 'introduction',
    },
    features: {
      lifecycleState: input.state,
      daysSinceIntroduction: 0,
      daysSincePreviousTransition: 0,
      daysRemainingInBiennium: input.daysRemaining ?? 500,
      priorProcessEventCount: 0,
      priorProcessStageCounts: {},
      priorCompanionIdentifiers: [],
      latestEligibleBillVersion: null,
      authorship: { reconstructable: false, membershipIds: null, parserVersion: null },
      evidenceFamilyCounts: {},
    },
    targets: {
      transitionOnCutoffDate: {
        stageKinds: input.toState ? ['committee_referral'] : input.terminal ? ['session_expiration'] : [],
        toState: input.toState ?? null,
        terminalOutcome: input.terminal ?? null,
      },
      eventualSourceChamberPassage: input.passage ?? false,
      eventualReachesSourceChamberPassageVote: input.passage ?? false,
      terminalOutcome: input.passage ? 'source_chamber_passed' : 'session_expired_without_source_chamber_passage',
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

test('stage passage baseline trains only on earlier sessions', () => {
  const rows = [
    snapshot({ billId: 'train-pass', session: '2021-2022', cutoff: '2021-01-01', state: 'introduced', passage: true }),
    snapshot({ billId: 'train-fail', session: '2021-2022', cutoff: '2021-01-01', state: 'introduced', passage: false }),
    snapshot({ billId: 'holdout-a', session: '2023-2024', cutoff: '2023-01-01', state: 'introduced', passage: true }),
    snapshot({ billId: 'holdout-b', session: '2023-2024', cutoff: '2023-01-01', state: 'introduced', passage: true }),
  ];
  const predictions = buildForwardChainedStagePassagePredictions(rows);
  const first = predictions.find((row) => row.billId === 'holdout-a');
  assert.equal(first?.probability, 0.5);
});

test('accepted introduction benchmark is carried forward unchanged across lifecycle snapshots', () => {
  const rows = [
    snapshot({ billId: 'bill', session: '2023-2024', cutoff: '2023-01-01', state: 'introduced' }),
    snapshot({ billId: 'bill', session: '2023-2024', cutoff: '2023-02-01', state: 'committee_process_engagement' }),
  ];
  const intro: BillStagePrediction[] = [{
    billId: 'bill',
    asOf: '2023-01-01T00:00:00Z',
    targetKind: 'source_chamber_passage',
    outcome: 0,
    probability: 0.123,
    model: 'intro-title-text-eb-v4',
  }];
  assert.deepEqual(
    applyStaticIntroductionBenchmark(rows, intro).map((row) => row.probability),
    [0.123, 0.123],
  );
});

test('hazard risk set begins the day after a known transition and uses 30-day landmarks', () => {
  const rows = [
    snapshot({
      billId: 'bill',
      session: '2021-2022',
      cutoff: '2021-01-01',
      state: 'introduced',
      toState: 'committee_process_engagement',
      daysRemaining: 365,
    }),
    snapshot({
      billId: 'bill',
      session: '2021-2022',
      cutoff: '2021-03-12',
      state: 'committee_process_engagement',
      toState: 'floor_eligibility_or_scheduling',
      daysRemaining: 295,
    }),
    snapshot({
      billId: 'bill',
      session: '2021-2022',
      cutoff: '2021-05-01',
      state: 'floor_eligibility_or_scheduling',
      terminal: 'session_expired_without_source_chamber_passage',
      daysRemaining: 245,
    }),
  ];
  const risk = buildLifecycleHazardRiskRows(rows);
  const firstInterval = risk.filter((row) => row.nextEventDate === '2021-03-12');
  assert.deepEqual(firstInterval.map((row) => row.cutoffDateExclusive), ['2021-01-02', '2021-02-01', '2021-03-03']);
  assert.deepEqual(firstInterval.map((row) => row.processProgressionWithin30Days), [0, 0, 1]);
  assert.equal(firstInterval[0].lifecycleState, 'committee_process_engagement');
  const expirationInterval = risk.filter((row) => row.nextEventClass === 'session_expiration');
  assert.ok(expirationInterval.length > 0);
  assert.equal(expirationInterval.some((row) => row.processProgressionWithin30Days === 1), false);
  assert.equal(expirationInterval.some((row) => row.sessionExpirationWithin30Days === 1), true);
});

test('elapsed-time hazard predictions remain forward chained', () => {
  const trainingSnapshots = [
    snapshot({ billId: 'train', session: '2021-2022', cutoff: '2021-01-01', state: 'introduced', toState: 'committee_process_engagement', daysRemaining: 365 }),
    snapshot({ billId: 'train', session: '2021-2022', cutoff: '2021-02-01', state: 'committee_process_engagement', terminal: 'session_expired_without_source_chamber_passage', daysRemaining: 334 }),
  ];
  const holdoutSnapshots = [
    snapshot({ billId: 'holdout', session: '2023-2024', cutoff: '2023-01-01', state: 'introduced', toState: 'committee_process_engagement', daysRemaining: 365 }),
    snapshot({ billId: 'holdout', session: '2023-2024', cutoff: '2023-02-01', state: 'committee_process_engagement', terminal: 'session_expired_without_source_chamber_passage', daysRemaining: 334 }),
  ];
  const risk = buildLifecycleHazardRiskRows([...trainingSnapshots, ...holdoutSnapshots]);
  const predictions = buildForwardChainedHazardPredictions(risk);
  assert.ok(predictions.length > 0);
  assert.equal(new Set(predictions.map((row) => row.session)).has('2021-2022'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildForwardChainedLifecycleP5Predictions,
  buildLifecycleP5Rows,
  evidenceFamilyTokens,
  type LifecycleP5Row,
} from '../src/evaluation/lifecycle-p5-evidence-allocation.js';
import type { LifecycleP3Snapshot } from '../src/evaluation/lifecycle-p3-snapshot-dataset.js';

function snapshot(input: {
  billId: string;
  session: string;
  cutoff: string;
  state: LifecycleP3Snapshot['features']['lifecycleState'];
  toState?: LifecycleP3Snapshot['features']['lifecycleState'] | null;
  passage?: boolean;
  reachesVote?: boolean;
  processParsed?: boolean;
  companionCount?: number;
  versionLength?: number | null;
  authors?: number | null;
}): LifecycleP3Snapshot {
  const companions = Array.from({ length: input.companionCount ?? 0 }, (_, index) => `HF${index + 1}`);
  const authors = input.authors === null || input.authors === undefined
    ? null
    : Array.from({ length: input.authors }, (_, index) => `member-${index + 1}`);
  return {
    schemaVersion: 'lifecycle-p3-snapshot-v1',
    datasetVersion: 'mn-2021-2026-event-time-v1',
    snapshotId: `${input.billId}-${input.cutoff}`,
    bill: {
      billId: input.billId,
      session: input.session,
      chamber: 'house',
      identifier: input.billId,
    },
    cutoff: {
      asOfDateExclusive: input.cutoff,
      granularity: 'date',
      sameDayExcluded: true,
      reason: input.toState ? 'before_transition' : 'introduction',
    },
    features: {
      lifecycleState: input.state,
      daysSinceIntroduction: 0,
      daysSincePreviousTransition: 0,
      daysRemainingInBiennium: 400,
      priorProcessEventCount: input.state === 'introduced' ? 0 : 3,
      priorProcessStageCounts: input.state === 'introduced'
        ? {}
        : { committee_referral: 1, committee_report: 2 },
      priorCompanionIdentifiers: companions,
      latestEligibleBillVersion: input.versionLength === null || input.versionLength === undefined
        ? null
        : {
            billVersionId: `version-${input.billId}`,
            versionKey: '0',
            publishedOn: '2023-01-01',
            textHash: 'hash',
            textLengthChars: input.versionLength,
          },
      authorship: {
        reconstructable: authors !== null,
        membershipIds: authors,
        parserVersion: authors !== null ? 'revisor-authorship-v1' : null,
      },
      evidenceFamilyCounts: {},
    },
    targets: {
      transitionOnCutoffDate: {
        stageKinds: input.toState ? ['committee_report'] : [],
        toState: input.toState ?? null,
        terminalOutcome: null,
      },
      eventualSourceChamberPassage: input.passage ?? false,
      eventualReachesSourceChamberPassageVote: input.reachesVote ?? false,
      terminalOutcome: input.passage
        ? 'source_chamber_passed'
        : 'session_expired_without_source_chamber_passage',
      memberVoteLabel: null,
    },
    lineage: {
      introductionParserVersion: 'revisor-introduction-v1',
      processParserVersion: input.processParsed === false ? null : 'revisor-process-v2',
      processAuditVersion: input.processParsed === false ? null : 'revisor-process-audit-v1',
      processStatus: input.processParsed === false ? 'deferred' : 'parsed',
      passageLabelVersion: 'revisor-source-chamber-passage-v1',
      priorProcessSourceDocumentSha256: [],
      priorProcessSourceUrls: [],
    },
  };
}

test('P5 stage targets stop once the target stage has already been reached', () => {
  const rows = buildLifecycleP5Rows([
    snapshot({
      billId: 'bill',
      session: '2021-2022',
      cutoff: '2021-01-01',
      state: 'introduced',
      toState: 'committee_process_engagement',
      reachesVote: true,
    }),
    snapshot({
      billId: 'bill',
      session: '2021-2022',
      cutoff: '2021-02-01',
      state: 'committee_process_engagement',
      toState: 'floor_eligibility_or_scheduling',
      reachesVote: true,
    }),
    snapshot({
      billId: 'bill',
      session: '2021-2022',
      cutoff: '2021-03-01',
      state: 'floor_eligibility_or_scheduling',
      toState: 'source_chamber_passage_vote_reached',
      reachesVote: true,
    }),
  ]);
  assert.equal(rows.filter((row) => row.target === 'reach_floor_eligibility').length, 2);
  assert.equal(rows.filter((row) => row.target === 'reach_source_chamber_passage_vote').length, 3);
  assert.equal(rows.filter((row) => row.target === 'source_chamber_passage').length, 3);
});

test('P5 tokens use low-dimensional summaries rather than identities', () => {
  const row = snapshot({
    billId: 'bill',
    session: '2023-2024',
    cutoff: '2023-03-01',
    state: 'committee_process_engagement',
    companionCount: 2,
    versionLength: 6400,
    authors: 3,
  });
  const tokens = evidenceFamilyTokens(row);
  assert.ok(tokens.companion.includes('companion:present'));
  assert.ok(tokens.bill_version.includes('bill-version:text-length:5k-10k'));
  assert.ok(tokens.authorship.includes('authorship:count:2-3'));
  const serialized = JSON.stringify(tokens);
  assert.equal(serialized.includes('member-1'), false);
  assert.equal(serialized.includes('HF1'), false);
  assert.equal(serialized.includes('hash'), false);
});

function p5Row(input: {
  billId: string;
  session: string;
  outcome: 0 | 1;
  token: string;
}): LifecycleP5Row {
  return {
    billId: input.billId,
    session: input.session,
    chamber: 'house',
    cutoffDateExclusive: `${input.session.slice(0, 4)}-01-01`,
    lifecycleState: 'introduced',
    daysSinceIntroduction: 0,
    daysRemainingInBiennium: 400,
    target: 'source_chamber_passage',
    outcome: input.outcome,
    eligibleFamilies: {
      process_detail: true,
      companion: true,
      bill_version: true,
      authorship: false,
    },
    tokens: {
      process_detail: [input.token],
      companion: ['companion:absent'],
      bill_version: ['bill-version:not-yet-available'],
      authorship: [],
    },
  };
}

test('P5 forward chaining never learns from same-session holdout outcomes', () => {
  const training = Array.from({ length: 80 }, (_, index) =>
    p5Row({
      billId: `train-${index}`,
      session: '2021-2022',
      outcome: index < 8 ? 1 : 0,
      token: index < 40 ? 'process:event-count:0' : 'process:event-count:1',
    }));
  const holdoutA = [
    p5Row({ billId: 'holdout-a', session: '2023-2024', outcome: 1, token: 'process:event-count:0' }),
    p5Row({ billId: 'holdout-b', session: '2023-2024', outcome: 0, token: 'process:event-count:1' }),
  ];
  const holdoutB = holdoutA.map((row) => ({ ...row, outcome: row.outcome === 1 ? 0 as const : 1 as const }));

  const definition = { model: 'process_detail' as const, families: ['process_detail' as const] };
  const first = buildForwardChainedLifecycleP5Predictions([...training, ...holdoutA], definition)
    .filter((row) => row.session === '2023-2024');
  const second = buildForwardChainedLifecycleP5Predictions([...training, ...holdoutB], definition)
    .filter((row) => row.session === '2023-2024');
  assert.deepEqual(
    first.map((row) => row.candidateProbability),
    second.map((row) => row.candidateProbability),
  );
});

test('authorship candidate is restricted to reconstructable snapshots', () => {
  const snapshots = [
    snapshot({
      billId: 'train',
      session: '2021-2022',
      cutoff: '2021-01-01',
      state: 'introduced',
      authors: 2,
    }),
    snapshot({
      billId: 'holdout-eligible',
      session: '2023-2024',
      cutoff: '2023-01-01',
      state: 'introduced',
      authors: 3,
    }),
    snapshot({
      billId: 'holdout-missing',
      session: '2023-2024',
      cutoff: '2023-01-02',
      state: 'introduced',
      authors: null,
    }),
  ];
  const rows = buildLifecycleP5Rows(snapshots);
  const predictions = buildForwardChainedLifecycleP5Predictions(rows, {
    model: 'authorship',
    families: ['authorship'],
  });
  assert.equal(predictions.some((row) => row.billId === 'holdout-eligible'), true);
  assert.equal(predictions.some((row) => row.billId === 'holdout-missing'), false);
});

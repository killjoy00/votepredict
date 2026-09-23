import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fitLifecycleP4ProspectiveStageModel,
  predictLifecycleP4ProspectiveStageModel,
} from '../src/evaluation/lifecycle-p4-baselines.js';
import {
  fitLifecycleP5RetainedProspectiveModel,
  predictLifecycleP5RetainedProspectiveModel,
  type LifecycleP5Row,
} from '../src/evaluation/lifecycle-p5-evidence-allocation.js';
import type { LifecycleP3Snapshot } from '../src/evaluation/lifecycle-p3-snapshot-dataset.js';

function snapshot(
  billId: string,
  chamber: 'house' | 'senate',
  state: LifecycleP3Snapshot['features']['lifecycleState'],
  outcome: boolean,
): LifecycleP3Snapshot {
  return {
    schemaVersion: 'lifecycle-p3-snapshot-v1',
    datasetVersion: 'mn-2021-2026-event-time-v1',
    snapshotId: billId,
    bill: { billId, session: '2025-2026', chamber, identifier: chamber === 'house' ? 'HF1' : 'SF1' },
    cutoff: { asOfDateExclusive: '2025-02-01', granularity: 'date', sameDayExcluded: true, reason: 'before_transition' },
    features: {
      lifecycleState: state,
      daysSinceIntroduction: 10,
      daysSincePreviousTransition: 10,
      daysRemainingInBiennium: 400,
      priorProcessEventCount: 1,
      priorProcessStageCounts: { committee_referral: 1 },
      priorCompanionIdentifiers: [],
      latestEligibleBillVersion: { billVersionId: 'v-'+billId, versionKey: '0', publishedOn: '2025-01-20', textHash: 'x', textLengthChars: 5000 },
      authorship: { reconstructable: false, membershipIds: null, parserVersion: null },
      evidenceFamilyCounts: {},
    },
    targets: {
      transitionOnCutoffDate: { stageKinds: [], toState: null, terminalOutcome: null },
      eventualSourceChamberPassage: outcome,
      eventualReachesSourceChamberPassageVote: outcome,
      terminalOutcome: outcome ? 'source_chamber_passed' : 'session_expired_without_source_chamber_passage',
      memberVoteLabel: null,
    },
    lineage: {
      introductionParserVersion: 'revisor-introduction-v1',
      processParserVersion: 'revisor-process-v2',
      processAuditVersion: 'revisor-process-audit-v1',
      processStatus: 'parsed',
      passageLabelVersion: 'test',
      priorProcessSourceDocumentSha256: [],
      priorProcessSourceUrls: [],
    },
  };
}

test('P8 final P4 stage fit uses chamber+state and deterministic fallbacks', () => {
  const rows = [
    snapshot('a','house','introduced',true),
    snapshot('b','house','introduced',false),
    snapshot('c','senate','committee_process_engagement',false),
  ];
  const model = fitLifecycleP4ProspectiveStageModel(rows);
  assert.equal(model.trainingRows, 3);
  const house = predictLifecycleP4ProspectiveStageModel(model, rows[0]);
  const senate = predictLifecycleP4ProspectiveStageModel(model, rows[2]);
  assert.ok(house > senate);
});

function p5Row(index: number, companionToken: string): LifecycleP5Row {
  return {
    billId: String(index),
    session: '2025-2026',
    chamber: 'house',
    cutoffDateExclusive: '2025-03-01',
    lifecycleState: 'committee_process_engagement',
    daysSinceIntroduction: 40,
    daysRemainingInBiennium: 400,
    target: 'source_chamber_passage',
    outcome: index < 40 ? 1 : 0,
    eligibleFamilies: {
      process_detail: true,
      companion: true,
      bill_version: true,
      authorship: false,
    },
    tokens: {
      process_detail: ['process:event-count:1'],
      companion: [companionToken],
      bill_version: ['bill-version:available','bill-version:text-length:5k-10k'],
      authorship: [],
    },
  };
}

test('P8 retained P5 prospective model excludes companion tokens from prediction', () => {
  const sourceRows = Array.from({length: 80}, (_, index) =>
    p5Row(index, index % 2 ? 'companion:present' : 'companion:absent'));
  const allTargets = sourceRows.flatMap((row) => [
    row,
    { ...row, target: 'reach_source_chamber_passage_vote' as const },
    { ...row, target: 'reach_floor_eligibility' as const },
  ]);
  const model = fitLifecycleP5RetainedProspectiveModel(allTargets);
  const left = { ...p5Row(100, 'companion:present') };
  const right = { ...p5Row(101, 'companion:absent') };
  const leftPrediction = predictLifecycleP5RetainedProspectiveModel(model, left);
  const rightPrediction = predictLifecycleP5RetainedProspectiveModel(model, right);
  assert.ok(leftPrediction && rightPrediction);
  assert.equal(leftPrediction.candidateProbability, rightPrediction.candidateProbability);
  assert.deepEqual(model.families, ['process_detail','bill_version']);
});

test('P8 prospective plan remains sealed, non-serving, and date-exclusive', () => {
  const plan = JSON.parse(readFileSync(
    new URL('../data/evaluation/lifecycle-p8-prospective-plan-v1.json', import.meta.url),
    'utf8',
  )) as any;
  assert.equal(plan.schemaVersion, 'lifecycle-p8-prospective-plan-v1');
  assert.equal(plan.scope.session, '2027-2028');
  assert.equal(plan.capture.sameDayEventsExcluded, true);
  assert.equal(plan.capture.rawOutcomeReadAtCapture, false);
  assert.equal(plan.eventTimeEvaluationSelection.sameDayCaptureForTransitionForbidden, true);
  assert.equal(plan.revealGate.notBeforeUtc, '2028-07-01T00:00:00.000Z');
  assert.equal(plan.guardrails.servingProbabilityChange, 'none');
  assert.equal(plan.guardrails.automaticPromotion, false);
  assert.equal(plan.targets.conditionalMember.syntheticMemberVotesForNonVoteBills, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateMemberHistoryCap20ProspectiveScore,
  MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT,
  selectMemberHistoryCap20ProspectiveRevision,
  type ProspectiveVoteEvent,
} from '../src/evaluation/member-history-cap20-prospective-score.js';

function event(input: {
  index: number;
  chamber: 'house' | 'senate';
  members: number;
  baselineProbability?: number;
  cap20Probability?: number;
  actual?: 0 | 1;
  occurredOn?: string;
}): ProspectiveVoteEvent {
  const baselineProbability = input.baselineProbability ?? 0.6;
  const cap20Probability = input.cap20Probability ?? 0.7;
  const actual = input.actual ?? 1;
  const month = input.chamber === 'house' ? 2 : 4;
  const day = (input.index % 20) + 2;
  const occurredOn = input.occurredOn ?? `2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const memberships = Array.from({ length: input.members }, (_, memberIndex) => `${input.chamber}-${input.index}-m${memberIndex}`);
  return {
    voteEventId: `${input.chamber}-event-${input.index}`,
    identifier: `${input.chamber === 'house' ? 'HF' : 'SF'}${100 + input.index}`,
    session: '2027-2028',
    chamber: input.chamber,
    occurredOn,
    actualChamberYes: actual === 1 ? input.members : 0,
    revisions: [{
      revisionId: `${input.chamber}-revision-${input.index}`,
      generatedAt: `${occurredOn.slice(0, -2)}${String(Math.max(1, Number(occurredOn.slice(-2)) - 1)).padStart(2, '0')}T18:00:00.000Z`,
      researchMode: 'quick',
      modelVersion: 'member-eb-v1.1',
      members: memberships.map((membershipId) => ({ membershipId, baselineProbability, cap20Probability })),
    }],
    outcomes: memberships.map((membershipId) => ({ membershipId, outcome: actual })),
  };
}

function passingCohort(): ProspectiveVoteEvent[] {
  return [
    ...Array.from({ length: 20 }, (_, index) => event({ index, chamber: 'house', members: 125 })),
    ...Array.from({ length: 12 }, (_, index) => event({ index, chamber: 'senate', members: 60 })),
  ];
}

test('seals all prospective outcome scoring until the predeclared reveal instant', () => {
  assert.throws(
    () => evaluateMemberHistoryCap20ProspectiveScore([], { now: new Date('2028-06-30T23:59:59.999Z') }),
    /sealed until 2028-07-01T00:00:00Z/,
  );
  assert.doesNotThrow(() => evaluateMemberHistoryCap20ProspectiveScore([], { now: new Date(MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT) }));
});

test('selects the latest strictly previous-calendar-day Quick revision without looking at shadow availability', () => {
  const base = event({ index: 1, chamber: 'house', members: 2, occurredOn: '2027-03-10' });
  base.revisions = [
    {
      revisionId: 'older-complete',
      generatedAt: '2027-03-08T23:00:00.000Z',
      researchMode: 'quick',
      modelVersion: 'member-eb-v1.1',
      members: [{ membershipId: 'a', baselineProbability: 0.5, cap20Probability: 0.6 }],
    },
    {
      revisionId: 'latest-missing-shadow',
      generatedAt: '2027-03-09T01:00:00.000Z',
      researchMode: 'quick',
      modelVersion: 'member-eb-v1.1',
      members: [{ membershipId: 'a', baselineProbability: 0.5, cap20Probability: null }],
    },
    {
      revisionId: 'same-day-complete',
      generatedAt: '2027-03-10T00:01:00.000Z',
      researchMode: 'quick',
      modelVersion: 'member-eb-v1.1',
      members: [{ membershipId: 'a', baselineProbability: 0.5, cap20Probability: 0.7 }],
    },
  ];
  assert.equal(selectMemberHistoryCap20ProspectiveRevision(base)?.revisionId, 'latest-missing-shadow');

  const result = evaluateMemberHistoryCap20ProspectiveScore([base], { now: new Date('2028-07-01T00:00:00.000Z') });
  assert.equal(result.house.scoredEvents, 0);
  assert.equal(result.house.exclusions[0]?.reason, 'shadow_probability_missing');
  assert.equal(result.house.exclusions[0]?.revisionId, 'latest-missing-shadow');
});

test('passes only after the frozen House primary and Senate safety minimums and criteria both pass', () => {
  const result = evaluateMemberHistoryCap20ProspectiveScore(passingCohort(), { now: new Date('2028-07-01T00:00:00.000Z') });
  assert.equal(result.house.scoredEvents, 20);
  assert.equal(result.house.decisiveMemberOutcomes, 2500);
  assert.equal(result.house.decision.minimumMet, true);
  assert.equal(result.house.decision.status, 'pass');
  assert.ok(Object.values(result.house.decision.criteria).every(Boolean));
  assert.equal(result.senate.scoredEvents, 12);
  assert.equal(result.senate.decisiveMemberOutcomes, 720);
  assert.equal(result.senate.decision.minimumMet, true);
  assert.equal(result.senate.decision.status, 'pass');
  assert.ok(Object.values(result.senate.decision.criteria).every(Boolean));
  assert.equal(result.conclusion.status, 'eligible_for_separate_promotion_review');
  assert.equal(result.conclusion.productionAction, 'none');
  assert.equal(result.metadata.promotionRequiresSeparateReviewedChange, true);
});

test('keeps a below-minimum result inconclusive instead of loosening the frozen sample thresholds', () => {
  const almostEnough = passingCohort().filter((item) => item.voteEventId !== 'house-event-19');
  const result = evaluateMemberHistoryCap20ProspectiveScore(almostEnough, { now: new Date('2028-07-01T00:00:00.000Z') });
  assert.equal(result.house.scoredEvents, 19);
  assert.equal(result.house.decision.minimumMet, false);
  assert.equal(result.house.decision.status, 'inconclusive');
  assert.equal(result.conclusion.status, 'inconclusive');
});

test('fails promotion when the frozen House criteria fail even with enough observations', () => {
  const failing = passingCohort().map((item) => item.chamber === 'house'
    ? event({
        index: Number(item.voteEventId.split('-').at(-1)),
        chamber: 'house',
        members: 125,
        baselineProbability: 0.8,
        cap20Probability: 0.6,
      })
    : item);
  const result = evaluateMemberHistoryCap20ProspectiveScore(failing, { now: new Date('2028-07-01T00:00:00.000Z') });
  assert.equal(result.house.decision.minimumMet, true);
  assert.equal(result.house.decision.status, 'fail');
  assert.equal(result.conclusion.status, 'do_not_promote');
  assert.equal(result.conclusion.productionAction, 'none');
});

test('does not fall back from a future serving-model revision to an older frozen-model revision', () => {
  const base = event({ index: 2, chamber: 'house', members: 2, occurredOn: '2027-03-10' });
  base.revisions = [
    {
      revisionId: 'older-v1',
      generatedAt: '2027-03-08T12:00:00.000Z',
      researchMode: 'quick',
      modelVersion: 'member-eb-v1.1',
      members: base.revisions[0].members,
    },
    {
      revisionId: 'latest-v2',
      generatedAt: '2027-03-09T12:00:00.000Z',
      researchMode: 'quick',
      modelVersion: 'member-eb-v2',
      members: base.revisions[0].members,
    },
  ];
  const result = evaluateMemberHistoryCap20ProspectiveScore([base], { now: new Date('2028-07-01T00:00:00.000Z') });
  assert.equal(result.house.scoredEvents, 0);
  assert.equal(result.house.exclusions[0]?.reason, 'baseline_model_mismatch');
  assert.equal(result.house.exclusions[0]?.revisionId, 'latest-v2');
});

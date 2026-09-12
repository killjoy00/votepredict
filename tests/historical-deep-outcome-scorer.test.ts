import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyHistoricalDeepMotion,
  proceduralSignal,
  scoreHistoricalDeepDiscoveryCandidates,
} from '../src/evaluation/historical-deep-outcome-scorer.js';

const baseCandidate = {
  case: { voteEventId: 'v1', session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', asOf: '2023-01-18T23:59:59.999Z' },
  membershipId: 'frozen-membership', legislatorId: 'l1', memberName: 'Member One', party: 'DFL', quickYesProbability: 0.95,
  quickEvidenceQuality: 'medium', selectedForCurrentDeep: false, kind: 'committee_bill_procedural_vote', voteSide: 'nay',
  motionText: 'Chair renewed the motion that HF1 be re-referred to the Committee on Judiciary Finance and Civil Law.',
  excerpt: 'example', source: { sourceId: 's1', sourceClass: 'house_committee_record', title: 'minutes', url: 'https://www.house.mn.gov/committees/minutes/93000/1', publishedAt: '2023-01-10T00:00:00.000Z', contentSha256: 'abc' },
  extractionMethod: 'deterministic-house-committee-roll-call-v1',
} as const;

type OutcomeFixtureMember = {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  actualOutcome: 0 | 1;
};

function candidateBundle() {
  return {
    schemaVersion: 'historical-deep-discovery-candidates-v1', generatedAt: '2026-09-12T00:00:00.000Z', purpose: 'test',
    input: { discoveryCases: 1, discoveryMemberCasePairs: 1, sourceCount: 1, sourceCaseCount: 1 },
    summary: { candidateCount: 1, memberCasePairsWithCandidates: 1, casesWithCandidates: 1, sourcesWithCandidates: 1, ayeCandidates: 0, nayCandidates: 1, currentDeepTargetCandidates: 0, outsideCurrentDeepCandidates: 1 },
    candidates: [baseCandidate], diagnostics: [],
  };
}

function outcomeSnapshot(
  members: OutcomeFixtureMember[] = [
    { membershipId: 'current-membership', legislatorId: 'l1', memberName: 'Member One', actualOutcome: 0 },
  ],
) {
  return {
    schemaVersion: 'historical-deep-outcome-snapshot-v1', generatedAt: '2026-09-12T00:00:00.000Z', codeSha: 'sha', purpose: 'test',
    cases: [{ session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', voteEventId: 'current-v1', members }],
  };
}

test('classifies procedural direction conservatively', () => {
  assert.equal(classifyHistoricalDeepMotion('HF1 be re-referred to Judiciary'), 'advances');
  assert.equal(classifyHistoricalDeepMotion('motion to table HF1'), 'impedes');
  assert.equal(classifyHistoricalDeepMotion('HF1 be laid over'), 'ambiguous');
  assert.equal(proceduralSignal('motion to table HF1', 'nay'), 'supports_advancement');
});

test('scores frozen candidates by stable legislator identity when membership UUIDs differ', () => {
  const result = scoreHistoricalDeepDiscoveryCandidates(candidateBundle() as never, outcomeSnapshot() as never);
  assert.equal(result.summary.decisiveOutcomePairs, 1);
  assert.equal(result.summary.noDecisiveOutcomePairs, 0);
  assert.equal(result.summary.directionalPairs, 1);
  assert.equal(result.summary.scorableDirectionalPairs, 1);
  assert.equal(result.summary.quickErrorsOnDirectionalPairs, 1);
  assert.equal(result.summary.rescuedQuickErrors, 1);
  assert.equal(result.summary.rescuedHighConfidenceQuickErrors, 1);
  assert.equal(result.pairs[0].membershipId, 'frozen-membership');
  assert.equal(result.pairs[0].legislatorId, 'l1');
  assert.equal(result.pairs[0].outcomeStatus, 'decisive');
  assert.equal(result.pairs[0].signal, 'opposes_advancement');
});

test('keeps candidates without a decisive floor vote visible but unscored', () => {
  const otherMember: OutcomeFixtureMember[] = [
    { membershipId: 'other-membership', legislatorId: 'l2', memberName: 'Other Member', actualOutcome: 1 },
  ];
  const result = scoreHistoricalDeepDiscoveryCandidates(candidateBundle() as never, outcomeSnapshot(otherMember) as never);
  assert.equal(result.summary.memberCasePairs, 1);
  assert.equal(result.summary.decisiveOutcomePairs, 0);
  assert.equal(result.summary.noDecisiveOutcomePairs, 1);
  assert.equal(result.summary.directionalPairs, 1);
  assert.equal(result.summary.scorableDirectionalPairs, 0);
  assert.equal(result.summary.floorAgreementPairs, 0);
  assert.equal(result.summary.quickErrorsOnDirectionalPairs, 0);
  assert.equal(result.pairs[0].outcomeStatus, 'no_decisive_floor_outcome');
  assert.equal(result.pairs[0].actualOutcome, undefined);
  assert.equal(result.pairs[0].quickError, undefined);
  assert.equal(result.pairs[0].signalMatchesFloorOutcome, undefined);
});

test('fails closed when the frozen outcome snapshot omits a candidate case entirely', () => {
  const snapshot = { ...outcomeSnapshot(), cases: [] };
  assert.throws(
    () => scoreHistoricalDeepDiscoveryCandidates(candidateBundle() as never, snapshot as never),
    /Missing frozen outcome case/,
  );
});

test('fails closed when an outcome snapshot has duplicate stable legislator identities', () => {
  const duplicateMembers: OutcomeFixtureMember[] = [
    { membershipId: 'current-membership-a', legislatorId: 'l1', memberName: 'Member One', actualOutcome: 0 },
    { membershipId: 'current-membership-b', legislatorId: 'l1', memberName: 'Member One', actualOutcome: 0 },
  ];
  assert.throws(
    () => scoreHistoricalDeepDiscoveryCandidates(candidateBundle() as never, outcomeSnapshot(duplicateMembers) as never),
    /Ambiguous frozen outcomes/,
  );
});

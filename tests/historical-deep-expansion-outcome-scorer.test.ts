import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreHistoricalDeepExpansionCandidates } from '../src/evaluation/historical-deep-expansion-outcome-scorer.js';

const source = {
  sourceId: 'house-minutes-93021-100847',
  sourceClass: 'house_committee_record' as const,
  title: 'minutes',
  url: 'https://www.house.mn.gov/committees/minutes/93021/100847',
  publishedAt: '2024-04-20T00:00:00.000Z',
  contentSha256: 'a'.repeat(64),
};

function observation(input: {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  quickYesProbability: number;
  current: boolean;
  candidate: boolean;
  voteSide: 'aye' | 'nay';
  motionText: string;
}) {
  return {
    case: {
      stableKey: '2023-2024|house|300:HF2609:2024-05-02:15597:3',
      caseKey: '2023-2024|house|HF2609|2024-05-02',
      externalKey: '300:HF2609:2024-05-02:15597:3',
      tranche: 'deterministic-uniform' as const,
      voteEventId: 'vote-2609',
      session: '2023-2024',
      chamber: 'house',
      identifier: 'HF2609',
      occurredOn: '2024-05-02',
      asOf: '2024-05-01T23:59:59.999Z',
    },
    membershipId: input.membershipId,
    legislatorId: input.legislatorId,
    memberName: input.memberName,
    party: input.quickYesProbability > 0.8 ? 'DFL' : 'R',
    quickYesProbability: input.quickYesProbability,
    quickEvidenceQuality: 'medium' as const,
    selectedForCurrentDeep: input.current,
    selectedForCandidateDeep: input.candidate,
    kind: 'committee_bill_procedural_vote' as const,
    voteSide: input.voteSide,
    motionText: input.motionText,
    excerpt: 'fixture',
    source,
    extractionMethod: 'deterministic-house-committee-roll-call-v1' as const,
  };
}

function candidateBundle() {
  const candidates = [
    observation({
      membershipId: 'm-current', legislatorId: 'l-current', memberName: 'Current Member', quickYesProbability: 0.95,
      current: true, candidate: false, voteSide: 'aye', motionText: 'HF2609 be referred to the General Register.',
    }),
    observation({
      membershipId: 'm-current', legislatorId: 'l-current', memberName: 'Current Member', quickYesProbability: 0.95,
      current: true, candidate: false, voteSide: 'nay', motionText: 'HF2609 be re-referred to the Committee on Ways and Means.',
    }),
    observation({
      membershipId: 'm-candidate', legislatorId: 'l-candidate', memberName: 'Candidate Member', quickYesProbability: 0.9,
      current: false, candidate: true, voteSide: 'nay', motionText: 'HF2609 be re-referred to the Committee on Ways and Means.',
    }),
  ];
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    purpose: 'test',
    metadata: { parser: 'deterministic-house-committee-roll-call-v1', parserReuse: 'test', outcomeUse: 'none' },
    input: { discoveryCases: 24, discoveryMemberCasePairs: 3216, sourcePages: 49, sourceCaseMatches: 51, casesWithSources: 19, casesWithoutSources: 5 },
    summary: {
      candidateCount: 3, memberCasePairsWithCandidates: 2, casesWithCandidates: 1, sourcesWithCandidates: 1,
      ayeCandidates: 1, nayCandidates: 2, currentDeepTargetCandidates: 2, candidateDeepTargetCandidates: 1,
      bothTargetCandidates: 0, outsideBothTargetCandidates: 0,
    },
    candidates,
    diagnostics: [],
  };
}

function outcomeSnapshot() {
  return {
    schemaVersion: 'historical-deep-expansion-outcome-snapshot-v1',
    generatedAt: '2026-09-13T01:00:00.000Z',
    codeSha: 'a'.repeat(40),
    purpose: 'test',
    candidateArtifact: {
      workflowRunId: '1', artifactId: 2, artifactSha256: 'b'.repeat(64), headSha: 'c'.repeat(40),
    },
    cases: [{
      stableKey: '2023-2024|house|300:HF2609:2024-05-02:15597:3',
      caseKey: '2023-2024|house|HF2609|2024-05-02',
      externalKey: '300:HF2609:2024-05-02:15597:3',
      tranche: 'deterministic-uniform' as const,
      session: '2023-2024', chamber: 'house', identifier: 'HF2609', occurredOn: '2024-05-02', voteEventId: 'vote-2609',
      members: [
        { membershipId: 'current-floor', legislatorId: 'l-current', memberName: 'Current Member', actualOutcome: 1 as const },
        { membershipId: 'candidate-floor', legislatorId: 'l-candidate', memberName: 'Candidate Member', actualOutcome: 0 as const },
      ],
    }],
  };
}

test('reuses the existing scorer while preserving current-vs-candidate target membership', () => {
  const result = scoreHistoricalDeepExpansionCandidates(candidateBundle() as never, outcomeSnapshot() as never);
  assert.equal(result.summary.memberCasePairs, 2);
  assert.equal(result.summary.conflictingPairs, 1);
  assert.equal(result.summary.directionalPairs, 1);
  assert.equal(result.summary.currentDeepPairs, 1);
  assert.equal(result.summary.candidateDeepPairs, 1);
  assert.equal(result.summary.currentOnlyPairs, 1);
  assert.equal(result.summary.candidateOnlyPairs, 1);
  assert.equal(result.summary.conflictingCurrentDeepPairs, 1);
  assert.equal(result.summary.directionalCurrentDeepPairs, 0);
  assert.equal(result.summary.directionalCandidateDeepPairs, 1);
  assert.equal(result.summary.scorableDirectionalCandidateDeepPairs, 1);
  assert.equal(result.summary.quickErrorsOnDirectionalPairs, 1);
  assert.equal(result.summary.rescuedQuickErrors, 1);

  const current = result.pairs.find((pair) => pair.legislatorId === 'l-current');
  assert.equal(current?.signal, 'conflicting');
  assert.equal(current?.selectedForCurrentDeep, true);
  assert.equal(current?.selectedForCandidateDeep, false);
  assert.equal(current?.stableKey, '2023-2024|house|300:HF2609:2024-05-02:15597:3');
});

test('fails closed when post-discovery outcomes do not match frozen event lineage', () => {
  const outcomes = outcomeSnapshot();
  outcomes.cases[0].externalKey = 'different-event';
  assert.throws(
    () => scoreHistoricalDeepExpansionCandidates(candidateBundle() as never, outcomes as never),
    /lineage mismatch/,
  );
});

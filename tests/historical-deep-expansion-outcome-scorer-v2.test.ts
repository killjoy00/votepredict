import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreHistoricalDeepExpansionCandidatesV2 } from '../src/evaluation/historical-deep-expansion-outcome-scorer-v2.js';

const source = {
  sourceId: 'house-minutes-93010-1',
  sourceClass: 'house_committee_record' as const,
  title: 'minutes',
  url: 'https://www.house.mn.gov/committees/minutes/93010/1',
  publishedAt: '2024-04-01T00:00:00.000Z',
  contentSha256: 'a'.repeat(64),
};

function candidateBundle() {
  const base = {
    case: {
      stableKey: '2023-2024|house|external-1',
      caseKey: '2023-2024|house|HF100|2024-05-01',
      externalKey: 'external-1',
      tranche: 'selector-disagreement' as const,
      voteEventId: 'vote-1',
      session: '2023-2024',
      chamber: 'house',
      identifier: 'HF100',
      occurredOn: '2024-05-01',
      asOf: '2024-04-30T23:59:59.999Z',
    },
    quickEvidenceQuality: 'moderate' as const,
    kind: 'committee_bill_procedural_vote' as const,
    excerpt: 'fixture',
    source,
    extractionMethod: 'deterministic-house-committee-roll-call-v2' as const,
  };
  const candidates = [
    {
      ...base,
      membershipId: 'm-alice', legislatorId: 'l-alice', memberName: 'Alice Alpha', party: 'DFL',
      quickYesProbability: 0.4, selectedForCurrentDeep: false, selectedForCandidateDeep: true,
      voteSide: 'aye' as const,
      motionText: 'Representative Alpha moved that HF100 be recommended to be placed on the General Register.',
      extractionRule: 'general-register-roll-call' as const,
    },
    {
      ...base,
      membershipId: 'm-bob', legislatorId: 'l-bob', memberName: 'Bob Beta', party: 'R',
      quickYesProbability: 0.8, selectedForCurrentDeep: true, selectedForCandidateDeep: false,
      voteSide: 'nay' as const,
      motionText: 'Representative Beta moved that HF100 be re-referred to the Committee on Ways and Means.',
      extractionRule: 'direct-named-roll-list' as const,
    },
  ];
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v2',
    generatedAt: '2026-09-13T01:45:00.000Z',
    purpose: 'test',
    metadata: {
      parser: 'deterministic-house-committee-roll-call-v2',
      baselineParser: 'deterministic-house-committee-roll-call-v1',
      outcomeUse: 'none',
      designGuard: 'test',
    },
    input: { discoveryCases: 24, discoveryMemberCasePairs: 3216, sourcePages: 49, sourceCaseMatches: 51, casesWithSources: 19, casesWithoutSources: 5 },
    summary: {
      candidateCount: 2, v1BaselineCandidateCount: 0, supplementalCandidateCount: 2,
      memberCasePairsWithCandidates: 2, casesWithCandidates: 1, sourcesWithCandidates: 1, sourceCaseMatchesWithCandidates: 1,
      ayeCandidates: 1, nayCandidates: 1, currentDeepTargetCandidates: 1, candidateDeepTargetCandidates: 1,
      bothTargetCandidates: 0, outsideBothTargetCandidates: 0,
      generalRegisterCandidates: 1, alternateRollTriggerCandidates: 0, directNamedRollListCandidates: 1,
    },
    candidates,
    diagnostics: [],
  };
}

function outcomeSnapshot() {
  return {
    schemaVersion: 'historical-deep-expansion-outcome-snapshot-v1',
    generatedAt: '2026-09-13T00:34:35.204Z',
    codeSha: 'a'.repeat(40),
    purpose: 'preexisting frozen outcomes',
    candidateArtifact: {
      workflowRunId: 'old-run', artifactId: 10308141732, artifactSha256: 'b'.repeat(64), headSha: 'c'.repeat(40),
    },
    cases: [{
      stableKey: '2023-2024|house|external-1',
      caseKey: '2023-2024|house|HF100|2024-05-01',
      externalKey: 'external-1',
      tranche: 'selector-disagreement' as const,
      session: '2023-2024', chamber: 'house', identifier: 'HF100', occurredOn: '2024-05-01', voteEventId: 'vote-1',
      members: [
        { membershipId: 'floor-alice', legislatorId: 'l-alice', memberName: 'Alice Alpha', actualOutcome: 1 as const },
        { membershipId: 'floor-bob', legislatorId: 'l-bob', memberName: 'Bob Beta', actualOutcome: 0 as const },
      ],
    }],
  };
}

test('scores frozen parser-v2 candidates through the unchanged v1 signal classifier', () => {
  const result = scoreHistoricalDeepExpansionCandidatesV2(candidateBundle() as never, outcomeSnapshot() as never);
  assert.equal(result.schemaVersion, 'historical-deep-expansion-discovery-score-v2');
  assert.equal(result.metadata.signalClassifier, 'historical-deep-outcome-scorer-v1-unchanged');
  assert.equal(result.summary.candidateObservations, 2);
  assert.equal(result.summary.memberCasePairs, 2);
  assert.equal(result.summary.directionalPairs, 1);
  assert.equal(result.summary.ambiguousOnlyPairs, 1);
  assert.equal(result.summary.floorAgreementPairs, 1);
  assert.equal(result.summary.quickErrorsOnDirectionalPairs, 1);
  assert.equal(result.summary.rescuedQuickErrors, 1);
  assert.equal(result.summary.baselineCandidateObservations, 0);
  assert.equal(result.summary.supplementalCandidateObservations, 2);
  assert.equal(result.summary.directionalPairsWithSupplementalEvidence, 1);
  assert.equal(result.summary.ambiguousOnlyPairsWithSupplementalEvidence, 1);
  assert.deepEqual(result.summary.candidateObservationsByExtractionRule, {
    'v1-baseline': 0,
    'general-register-roll-call': 1,
    'alternate-roll-trigger': 0,
    'direct-named-roll-list': 1,
  });

  const generalRegister = result.pairs.find((pair) => pair.legislatorId === 'l-alice');
  assert.equal(generalRegister?.signal, 'ambiguous_only');
  assert.deepEqual(generalRegister?.extractionRules, ['general-register-roll-call']);
  assert.equal(generalRegister?.hasSupplementalEvidence, true);
});

test('preserves exact frozen event lineage checks', () => {
  const outcomes = outcomeSnapshot();
  outcomes.cases[0].externalKey = 'different-event';
  assert.throws(
    () => scoreHistoricalDeepExpansionCandidatesV2(candidateBundle() as never, outcomes as never),
    /lineage mismatch/,
  );
});

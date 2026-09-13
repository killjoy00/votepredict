import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoricalDeepProceduralMechanicsArtifact } from '../src/evaluation/historical-deep-procedural-mechanics.js';

function candidate(
  legislatorId: string,
  motionText: string,
  voteSide: 'aye' | 'nay' = 'aye',
) {
  return {
    case: {
      stableKey: `2023-2024|house|${legislatorId}`,
      caseKey: `2023-2024|house|HF100|2024-05-01`,
      externalKey: 'event-1',
      tranche: 'selector-disagreement',
      voteEventId: 'vote-1',
      session: '2023-2024',
      chamber: 'house',
      identifier: 'HF100',
      occurredOn: '2024-05-01',
      asOf: '2024-04-30T23:59:59.999Z',
    },
    membershipId: `membership-${legislatorId}`,
    legislatorId,
    memberName: `Member ${legislatorId}`,
    party: 'DFL',
    district: '1A',
    quickYesProbability: 0.5,
    quickEvidenceQuality: 'moderate',
    selectedForCurrentDeep: legislatorId === 'a',
    selectedForCandidateDeep: legislatorId === 'b',
    kind: 'committee_bill_procedural_vote',
    voteSide,
    motionText,
    excerpt: motionText,
    source: {
      sourceId: 'house-minutes-93010-1',
      sourceClass: 'house_committee_record',
      title: 'Fixture minutes',
      url: 'https://www.house.mn.gov/committees/minutes/93010/1',
      publishedAt: '2024-04-01T00:00:00.000Z',
      contentSha256: 'a'.repeat(64),
    },
    extractionMethod: 'deterministic-house-committee-roll-call-v2',
    extractionRule: 'direct-named-roll-list',
  };
}

function bundle(candidates: ReturnType<typeof candidate>[]) {
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v2',
    generatedAt: '2026-09-13T00:00:00.000Z',
    purpose: 'test',
    metadata: {
      parser: 'deterministic-house-committee-roll-call-v2',
      baselineParser: 'deterministic-house-committee-roll-call-v1',
      outcomeUse: 'none',
      designGuard: 'test',
    },
    input: {
      discoveryCases: 24,
      discoveryMemberCasePairs: candidates.length,
      sourcePages: 1,
      sourceCaseMatches: 1,
      casesWithSources: 1,
      casesWithoutSources: 23,
    },
    summary: {
      candidateCount: candidates.length,
      v1BaselineCandidateCount: 0,
      supplementalCandidateCount: candidates.length,
      memberCasePairsWithCandidates: candidates.length,
      casesWithCandidates: 1,
      sourcesWithCandidates: 1,
      sourceCaseMatchesWithCandidates: 1,
      ayeCandidates: candidates.filter((item) => item.voteSide === 'aye').length,
      nayCandidates: candidates.filter((item) => item.voteSide === 'nay').length,
      currentDeepTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep).length,
      candidateDeepTargetCandidates: candidates.filter((item) => item.selectedForCandidateDeep).length,
      bothTargetCandidates: 0,
      outsideBothTargetCandidates: candidates.filter((item) => !item.selectedForCurrentDeep && !item.selectedForCandidateDeep).length,
      generalRegisterCandidates: 0,
      alternateRollTriggerCandidates: 0,
      directNamedRollListCandidates: candidates.length,
    },
    candidates,
    diagnostics: [],
  };
}

test('separates committee recommendation, floor advancement, and committee routing mechanics', () => {
  const input = bundle([
    candidate('a', 'Representative Alpha moved that HF100 be recommended to be placed on the General Register.'),
    candidate('b', 'Representative Beta moved that HF100 be recommended to pass and re-referred to the Committee on Ways and Means.'),
    candidate('c', 'Representative Gamma moved that HF100 be re-referred to the Committee on Taxes.', 'nay'),
    candidate('d', 'Representative Delta moved that HF100 be tabled.'),
    candidate('e', 'Representative Epsilon moved that HF100 be laid over for possible inclusion.'),
  ]);

  const result = buildHistoricalDeepProceduralMechanicsArtifact(input as never, '2026-09-13T02:00:00.000Z');
  assert.equal(result.metadata.outcomeUse, 'none');
  assert.equal(result.metadata.probabilityAction, 'none');
  assert.equal(result.summary.observations, 5);
  assert.equal(result.summary.memberEventPairs, 5);
  assert.equal(result.summary.observationsWithMultipleMechanics, 1);
  assert.equal(result.summary.unclassifiedObservations, 0);
  assert.deepEqual(result.summary.mechanics, {
    committee_recommends_passage: 1,
    advances_toward_floor_eligibility: 1,
    continues_committee_review: 2,
    impedes_current_bill_progress: 1,
    defers_current_bill_action: 1,
  });

  assert.deepEqual(result.observations[0].mechanics, ['advances_toward_floor_eligibility']);
  assert.deepEqual(result.observations[1].mechanics, ['committee_recommends_passage', 'continues_committee_review']);
  assert.equal(result.observations[2].voteRelationToMotion, 'opposes_motion');
  assert.ok(result.observations.every((item) => item.mechanicallyActionable === false));
  assert.ok(result.observations.every((item) => item.finalPassageInference === 'none'));
  assert.equal(JSON.stringify(result).includes('actualOutcome'), false);
});

test('preserves multi-observation member/event mechanics without converting them to direction', () => {
  const first = candidate('a', 'Representative Alpha moved that HF100 be recommended to pass and re-referred to the Committee on Ways and Means.');
  const second = { ...candidate('a', 'Representative Alpha moved that HF100 be recommended to be placed on the General Register.', 'nay'), source: { ...first.source, sourceId: 'house-minutes-93010-2' } };
  const input = bundle([first, second]);
  input.summary.memberCasePairsWithCandidates = 1;

  const result = buildHistoricalDeepProceduralMechanicsArtifact(input as never);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].observationCount, 2);
  assert.deepEqual(result.pairs[0].voteSides, ['aye', 'nay']);
  assert.deepEqual(result.pairs[0].mechanics, [
    'committee_recommends_passage',
    'advances_toward_floor_eligibility',
    'continues_committee_review',
  ]);
  assert.equal(result.pairs[0].mechanicallyActionable, false);
  assert.equal(result.pairs[0].finalPassageInference, 'none');
});

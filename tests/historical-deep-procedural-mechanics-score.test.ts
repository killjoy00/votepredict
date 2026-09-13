import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreHistoricalDeepProceduralMechanics } from '../src/evaluation/historical-deep-procedural-mechanics-score.js';

const caseDetail = {
  stableKey: '2023-2024|house|event-1',
  caseKey: '2023-2024|house|HF100|2024-05-01',
  externalKey: 'event-1',
  tranche: 'selector-disagreement' as const,
  voteEventId: 'vote-1',
  session: '2023-2024',
  chamber: 'house',
  identifier: 'HF100',
  occurredOn: '2024-05-01',
  asOf: '2024-04-30T23:59:59.999Z',
};

function candidate(
  legislatorId: string,
  voteSide: 'aye' | 'nay',
  quickYesProbability: number,
  motionText: string,
  selectedForCurrentDeep = false,
  selectedForCandidateDeep = false,
) {
  return {
    case: caseDetail,
    membershipId: `membership-${legislatorId}`,
    legislatorId,
    memberName: `Member ${legislatorId}`,
    party: 'DFL',
    district: '1A',
    quickYesProbability,
    quickEvidenceQuality: 'moderate',
    selectedForCurrentDeep,
    selectedForCandidateDeep,
    kind: 'committee_bill_procedural_vote',
    voteSide,
    motionText,
    excerpt: motionText,
    source: {
      sourceId: `source-${legislatorId}-${voteSide}`,
      sourceClass: 'house_committee_record',
      title: 'Fixture minutes',
      url: 'https://www.house.mn.gov/fixture',
      publishedAt: '2024-04-01T00:00:00.000Z',
      contentSha256: 'a'.repeat(64),
    },
    extractionMethod: 'deterministic-house-committee-roll-call-v2',
    extractionRule: 'direct-named-roll-list',
  };
}

function observation(
  legislatorId: string,
  voteSide: 'aye' | 'nay',
  mechanic: 'advances_toward_floor_eligibility' | 'continues_committee_review',
  selectedForCurrentDeep = false,
  selectedForCandidateDeep = false,
) {
  return {
    caseKey: caseDetail.caseKey,
    stableKey: caseDetail.stableKey,
    voteEventId: caseDetail.voteEventId,
    identifier: caseDetail.identifier,
    occurredOn: caseDetail.occurredOn,
    membershipId: `membership-${legislatorId}`,
    legislatorId,
    memberName: `Member ${legislatorId}`,
    party: 'DFL',
    voteSide,
    voteRelationToMotion: voteSide === 'aye' ? 'supports_motion' : 'opposes_motion',
    motionText: mechanic === 'advances_toward_floor_eligibility'
      ? 'HF100 be placed on the General Register.'
      : 'HF100 be re-referred to the Committee on Taxes.',
    extractionRule: 'direct-named-roll-list',
    mechanics: [mechanic],
    source: {
      sourceId: `source-${legislatorId}-${voteSide}`,
      sourceClass: 'house_committee_record',
      title: 'Fixture minutes',
      url: 'https://www.house.mn.gov/fixture',
      publishedAt: '2024-04-01T00:00:00.000Z',
      contentSha256: 'a'.repeat(64),
    },
    selectedForCurrentDeep,
    selectedForCandidateDeep,
    mechanicallyActionable: false,
    finalPassageInference: 'none',
  };
}

function fixtures() {
  const candidates = [
    candidate('a', 'aye', 0.4, 'HF100 be placed on the General Register.', true, false),
    candidate('b', 'aye', 0.8, 'HF100 be re-referred to the Committee on Taxes.', false, true),
    candidate('c', 'nay', 0.2, 'HF100 be re-referred to the Committee on Taxes.'),
    candidate('d', 'aye', 0.6, 'HF100 be re-referred to the Committee on Taxes.'),
    candidate('d', 'nay', 0.6, 'HF100 be re-referred to the Committee on Taxes.'),
  ];
  const observations = [
    observation('a', 'aye', 'advances_toward_floor_eligibility', true, false),
    observation('b', 'aye', 'continues_committee_review', false, true),
    observation('c', 'nay', 'continues_committee_review'),
    observation('d', 'aye', 'continues_committee_review'),
    observation('d', 'nay', 'continues_committee_review'),
  ];
  return {
    candidates: {
      schemaVersion: 'historical-deep-expansion-discovery-candidates-v2',
      generatedAt: '2026-09-13T00:00:00.000Z',
      purpose: 'test',
      metadata: { parser: 'deterministic-house-committee-roll-call-v2', baselineParser: 'deterministic-house-committee-roll-call-v1', outcomeUse: 'none', designGuard: 'test' },
      input: { discoveryCases: 24, discoveryMemberCasePairs: 4, sourcePages: 1, sourceCaseMatches: 1, casesWithSources: 1, casesWithoutSources: 23 },
      summary: {
        candidateCount: 5, v1BaselineCandidateCount: 0, supplementalCandidateCount: 5,
        memberCasePairsWithCandidates: 4, casesWithCandidates: 1, sourcesWithCandidates: 5, sourceCaseMatchesWithCandidates: 1,
        ayeCandidates: 3, nayCandidates: 2, currentDeepTargetCandidates: 1, candidateDeepTargetCandidates: 1,
        bothTargetCandidates: 0, outsideBothTargetCandidates: 3, generalRegisterCandidates: 1,
        alternateRollTriggerCandidates: 0, directNamedRollListCandidates: 4,
      },
      candidates,
      diagnostics: [],
    },
    taxonomy: {
      schemaVersion: 'historical-deep-procedural-mechanics-v1',
      generatedAt: '2026-09-13T00:00:00.000Z',
      purpose: 'test',
      metadata: {
        policy: 'mn-house-procedural-mechanics-v1', candidateParser: 'deterministic-house-committee-roll-call-v2', outcomeUse: 'none', probabilityAction: 'none', designGuard: 'test', institutionalSources: [],
      },
      input: { candidateObservations: 5, memberEventPairs: 4, eventsWithCandidates: 1 },
      summary: {
        observations: 5, memberEventPairs: 4, observationsWithMultipleMechanics: 0, unclassifiedObservations: 0,
        mechanics: { committee_recommends_passage: 0, advances_toward_floor_eligibility: 1, continues_committee_review: 4, impedes_current_bill_progress: 0, defers_current_bill_action: 0 },
        ayeObservations: 3, nayObservations: 2, currentTargetObservations: 1, candidateTargetObservations: 1,
      },
      observations,
      pairs: [],
    },
    outcomes: {
      schemaVersion: 'historical-deep-expansion-outcome-snapshot-v1',
      generatedAt: '2026-09-13T00:00:00.000Z',
      codeSha: null,
      purpose: 'test',
      candidateArtifact: { workflowRunId: 'old', artifactId: 1, artifactSha256: 'b'.repeat(64), headSha: 'c'.repeat(40) },
      cases: [{
        stableKey: caseDetail.stableKey,
        caseKey: caseDetail.caseKey,
        externalKey: caseDetail.externalKey,
        tranche: caseDetail.tranche,
        session: caseDetail.session,
        chamber: caseDetail.chamber,
        identifier: caseDetail.identifier,
        occurredOn: caseDetail.occurredOn,
        voteEventId: caseDetail.voteEventId,
        members: [
          { membershipId: 'floor-a', legislatorId: 'a', memberName: 'Member a', actualOutcome: 1 },
          { membershipId: 'floor-b', legislatorId: 'b', memberName: 'Member b', actualOutcome: 0 },
          { membershipId: 'floor-c', legislatorId: 'c', memberName: 'Member c', actualOutcome: 0 },
          { membershipId: 'floor-d', legislatorId: 'd', memberName: 'Member d', actualOutcome: 1 },
        ],
      }],
    },
  };
}

test('scores each frozen mechanic separately without making it actionable', () => {
  const { candidates, taxonomy, outcomes } = fixtures();
  const result = scoreHistoricalDeepProceduralMechanics(candidates as never, taxonomy as never, outcomes as never, '2026-09-13T03:00:00.000Z');
  const floor = result.summary.mechanics.advances_toward_floor_eligibility;
  const routing = result.summary.mechanics.continues_committee_review;

  assert.equal(result.metadata.probabilityAction, 'none');
  assert.equal(result.summary.memberEventMechanicRows, 4);
  assert.equal(result.summary.mechanicallyActionableRows, 0);
  assert.equal(floor.observations, 1);
  assert.equal(floor.scorableSingleSidedRows, 1);
  assert.equal(floor.floorAgreementRate, 1);
  assert.equal(floor.quickErrorsOnScorableRows, 1);
  assert.equal(floor.sameSideWouldCorrectQuickErrors, 1);
  assert.equal(floor.currentTargetScorableRows, 1);
  assert.equal(floor.currentTargetFloorAgreementRate, 1);

  assert.equal(routing.observations, 4);
  assert.equal(routing.memberEventMechanicRows, 3);
  assert.equal(routing.conflictingRows, 1);
  assert.equal(routing.scorableSingleSidedRows, 2);
  assert.equal(routing.floorAgreementRows, 1);
  assert.equal(routing.floorAgreementRate, 0.5);
  assert.equal(routing.quickErrorsOnScorableRows, 1);
  assert.equal(routing.sameSideWouldCorrectQuickErrors, 0);
  assert.equal(routing.candidateTargetScorableRows, 1);
  assert.equal(routing.candidateTargetFloorAgreementRate, 0);
  assert.ok(result.rows.every((row) => row.mechanicallyActionable === false));
  assert.ok(result.rows.every((row) => row.finalPassageInference === 'none'));
});

test('fails closed on taxonomy/outcome event lineage drift', () => {
  const { candidates, taxonomy, outcomes } = fixtures();
  outcomes.cases[0].voteEventId = 'different-event';
  assert.throws(
    () => scoreHistoricalDeepProceduralMechanics(candidates as never, taxonomy as never, outcomes as never),
    /lineage mismatch/,
  );
});

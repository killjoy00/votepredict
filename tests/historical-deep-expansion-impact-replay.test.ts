import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHistoricalDeepExpansionImpactReplay } from '../src/evaluation/historical-deep-expansion-impact-replay.js';

function fixture() {
  const cases = Array.from({ length: 24 }, (_, caseIndex) => {
    const identifier = `HF${100 + caseIndex}`;
    const day = String(caseIndex + 1).padStart(2, '0');
    const occurredOn = `2024-04-${day}`;
    const voteEventId = `vote-${caseIndex}`;
    const members = Array.from({ length: 13 }, (_, memberIndex) => ({
      membershipId: `m-${caseIndex}-${memberIndex}`,
      legislatorId: `l-${caseIndex}-${memberIndex}`,
      memberName: `Member ${caseIndex}-${memberIndex}`,
      party: memberIndex % 2 === 0 ? 'DFL' : 'R',
      yesProbability: memberIndex % 2 === 0 ? 0.6 : 0.4,
      evidenceQuality: 'moderate' as const,
      support: { global: 100, party: 40, member: 10, analogue: 1 },
      selectedForCurrentDeep: memberIndex < 12,
      selectedForCandidateDeep: memberIndex > 0,
    }));
    const currentDeepTargetIds = members.slice(0, 12).map((member) => member.membershipId);
    const candidateDeepTargetIds = members.slice(1, 13).map((member) => member.membershipId);
    return {
      stableKey: `2023-2024|house|external-${caseIndex}`,
      caseKey: `2023-2024|house|${identifier}|${occurredOn}`,
      externalKey: `external-${caseIndex}`,
      tranche: caseIndex % 2 === 0 ? 'deterministic-uniform' as const : 'selector-disagreement' as const,
      voteEventId,
      billId: `bill-${caseIndex}`,
      identifier,
      title: `${identifier} fixture`,
      session: '2023-2024',
      chamberId: 'house-id',
      chamber: 'house',
      occurredOn,
      asOf: `2024-04-${String(caseIndex).padStart(2, '0')}T23:59:59.999Z`,
      targetVersionId: `target-${caseIndex}`,
      quickModelVersion: 'member-eb-v1.1',
      members,
      currentDeepTargetIds,
      candidateDeepTargetIds,
      discoveryRequest: {
        forecastId: voteEventId,
        billId: `bill-${caseIndex}`,
        chamberId: 'house-id',
        asOf: `2024-04-${String(caseIndex).padStart(2, '0')}T23:59:59.999Z`,
        subject: { identifier, title: `${identifier} fixture` },
        targets: members.map((member) => ({
          membershipId: member.membershipId,
          memberName: member.memberName,
          party: member.party,
          yesProbability: member.yesProbability,
          rationale: 'fixture',
        })),
      },
    };
  });
  const discovery = {
    schemaVersion: 'historical-deep-expansion-discovery-manifest-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'a'.repeat(40), databaseSource: 'test', purpose: 'test', selectionGuard: 'test',
      cohortGeneratedAt: '2026-09-12T00:00:00.000Z', cohortCodeSha: 'b'.repeat(40), cases: 24,
      memberCasePairs: 312, currentDeepTargetLimit: 12, candidateStrategy: 'need-only',
    },
    cases,
  };

  const first = cases[0];
  const content = '<html><p>fixture official minutes</p></html>';
  const contentSha256 = createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
  const source = {
    id: 'house-minutes-93010-99999',
    sourceClass: 'house_committee_record' as const,
    session: '2023-2024', committeeId: '93010', meetingId: '99999', indexDate: '2024-03-20',
    publishedAt: '2024-03-20T00:00:00.000Z', title: 'Fixture minutes',
    url: 'https://www.house.mn.gov/committees/minutes/93010/99999',
    finalUrl: 'https://www.house.mn.gov/committees/minutes/93010/99999',
    fetchedAt: '2026-09-13T00:00:00.000Z', httpStatus: 200, contentType: 'text/html',
    bytes: Buffer.byteLength(content), contentSha256, expectedMarkers: ['2024-03-20', first.identifier],
    matchedCases: [{
      stableKey: first.stableKey, caseKey: first.caseKey, voteEventId: first.voteEventId,
      externalKey: first.externalKey, identifier: first.identifier, occurredOn: first.occurredOn, tranche: first.tranche,
    }],
    content,
  };
  const sources = {
    schemaVersion: 'historical-deep-expansion-source-bundle-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'c'.repeat(40), cohortHeadSha: 'd'.repeat(40), cohortArtifactId: 1, cohortArtifactDigest: 'e'.repeat(64),
      sourcePolicy: 'house-committee-archive-enumeration-v1', purpose: 'test', selectionGuard: 'test',
    },
    input: { selectedCases: 24, sessions: ['2023-2024'], chamber: 'house', committeeHomeIdsAttempted: 99 },
    summary: {
      committeesDiscovered: 20, minuteLinksDiscovered: 100, minutePagesEligibleByIndexDate: 90, minutePagesFetched: 90,
      matchedSourcePages: 1, sourceCaseMatches: 1, casesWithSources: 1, casesWithoutSources: 23,
    },
    cases: cases.map((item) => ({
      stableKey: item.stableKey, caseKey: item.caseKey, voteEventId: item.voteEventId, externalKey: item.externalKey,
      identifier: item.identifier, session: item.session, occurredOn: item.occurredOn, tranche: item.tranche,
      sourceIds: item.voteEventId === first.voteEventId ? [source.id] : [],
    })),
    sources: [source], diagnostics: [],
  };

  const candidateMember = first.members[0];
  const observation = (voteSide: 'aye' | 'nay') => ({
    case: {
      stableKey: first.stableKey, caseKey: first.caseKey, externalKey: first.externalKey, tranche: first.tranche,
      voteEventId: first.voteEventId, session: first.session, chamber: first.chamber, identifier: first.identifier,
      occurredOn: first.occurredOn, asOf: first.asOf,
    },
    membershipId: candidateMember.membershipId,
    legislatorId: candidateMember.legislatorId,
    memberName: candidateMember.memberName,
    party: candidateMember.party,
    quickYesProbability: candidateMember.yesProbability,
    quickEvidenceQuality: candidateMember.evidenceQuality,
    selectedForCurrentDeep: true,
    selectedForCandidateDeep: false,
    kind: 'committee_bill_procedural_vote' as const,
    voteSide,
    motionText: `${first.identifier} be recommended to pass.`,
    excerpt: `${voteSide} fixture`,
    source: {
      sourceId: source.id, sourceClass: source.sourceClass, title: source.title, url: source.url,
      publishedAt: source.publishedAt, contentSha256,
    },
    extractionMethod: 'deterministic-house-committee-roll-call-v1' as const,
  });
  const candidates = {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v1',
    generatedAt: '2026-09-13T00:10:00.000Z', purpose: 'test',
    metadata: { parser: 'deterministic-house-committee-roll-call-v1', parserReuse: 'test', outcomeUse: 'none' },
    input: { discoveryCases: 24, discoveryMemberCasePairs: 312, sourcePages: 1, sourceCaseMatches: 1, casesWithSources: 1, casesWithoutSources: 23 },
    summary: {
      candidateCount: 2, memberCasePairsWithCandidates: 1, casesWithCandidates: 1, sourcesWithCandidates: 1,
      ayeCandidates: 1, nayCandidates: 1, currentDeepTargetCandidates: 2, candidateDeepTargetCandidates: 0,
      bothTargetCandidates: 0, outsideBothTargetCandidates: 0,
    },
    candidates: [observation('aye'), observation('nay')], diagnostics: [],
  };

  const outcomes = {
    schemaVersion: 'historical-deep-expansion-outcome-snapshot-v1',
    generatedAt: '2026-09-13T01:00:00.000Z', codeSha: 'f'.repeat(40), purpose: 'test',
    candidateArtifact: { workflowRunId: '1', artifactId: 2, artifactSha256: '1'.repeat(64), headSha: '2'.repeat(40) },
    cases: cases.map((item) => ({
      stableKey: item.stableKey, caseKey: item.caseKey, externalKey: item.externalKey, tranche: item.tranche,
      session: item.session, chamber: item.chamber, identifier: item.identifier, occurredOn: item.occurredOn,
      voteEventId: item.voteEventId,
      members: item.members.map((member, index) => ({
        membershipId: member.membershipId, legislatorId: member.legislatorId, memberName: member.memberName,
        actualOutcome: (index % 2 === 0 ? 1 : 0) as 0 | 1,
      })),
    })),
  };
  const score = {
    schemaVersion: 'historical-deep-expansion-discovery-score-v1', generatedAt: '2026-09-13T01:10:00.000Z', purpose: 'test',
    summary: {
      candidateObservations: 2, memberCasePairs: 1, decisiveOutcomePairs: 1, noDecisiveOutcomePairs: 0,
      directionalPairs: 0, scorableDirectionalPairs: 0, conflictingPairs: 1, ambiguousOnlyPairs: 0,
      floorAgreementPairs: 0, floorAgreementRate: 0, currentDeepPairs: 1, outsideCurrentDeepPairs: 0,
      quickErrorsOnDirectionalPairs: 0, rescuedQuickErrors: 0, quickErrorRescueRate: 0,
      highConfidenceQuickErrorsOnDirectionalPairs: 0, rescuedHighConfidenceQuickErrors: 0,
      candidateDeepPairs: 0, outsideCandidateDeepPairs: 1, bothTargetPairs: 0, currentOnlyPairs: 1,
      candidateOnlyPairs: 0, outsideBothTargetPairs: 0, directionalCurrentDeepPairs: 0, directionalCandidateDeepPairs: 0,
      scorableDirectionalCurrentDeepPairs: 0, scorableDirectionalCandidateDeepPairs: 0,
      conflictingCurrentDeepPairs: 1, conflictingCandidateDeepPairs: 0,
    },
    pairs: [],
  };
  return { discovery, candidates, sources, outcomes, score };
}

test('opposing frozen official facts cancel under unchanged production impact while need-only receives none', async () => {
  const value = fixture();
  const result = await evaluateHistoricalDeepExpansionImpactReplay(
    value.discovery as never,
    value.candidates as never,
    value.sources as never,
    value.outcomes as never,
    value.score as never,
  );

  assert.equal(result.metadata.impactVersion, 'logit-evidence-v1');
  assert.equal(result.signalContext.conflictingPairs, 1);

  const current = result.scenarios['current-targets'];
  const candidate = result.scenarios['need-only-targets'];
  const all = result.scenarios['discovery-all'];
  assert.equal(current.requestedTargets, 24 * 12);
  assert.equal(candidate.requestedTargets, 24 * 12);
  assert.equal(current.candidateObservations, 2);
  assert.equal(candidate.candidateObservations, 0);
  assert.equal(all.candidateObservations, 2);
  assert.equal(current.affectedMembers, 1);
  assert.equal(candidate.affectedMembers, 0);
  assert.equal(all.affectedMembers, 1);
  assert.equal(current.changedMembers, 0);
  assert.equal(candidate.changedMembers, 0);
  assert.equal(all.changedMembers, 0);
  assert.equal(current.correctedClassifications, 0);
  assert.equal(current.harmedClassifications, 0);
  assert.equal(candidate.correctedClassifications, 0);
  assert.equal(all.correctedClassifications, 0);
  assert.equal(all.harmedClassifications, 0);
  assert.equal(current.allDecisive.delta.brier, 0);
  assert.equal(current.allDecisive.delta.logLoss, 0);
  assert.equal(candidate.allDecisive.delta.brier, 0);
  assert.equal(all.allDecisive.delta.brier, 0);
});

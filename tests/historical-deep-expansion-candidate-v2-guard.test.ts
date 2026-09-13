import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHistoricalDeepExpansionV2LocalBillGuard } from '../src/evaluation/historical-deep-expansion-candidate-v2-guard.js';
import type {
  HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  HistoricalDeepExpansionDiscoveryCandidateV2,
} from '../src/evaluation/historical-deep-expansion-extractor-v2.js';
import type { HistoricalDeepExpansionSourceBundle } from '../src/evaluation/historical-deep-expansion-source-bundle.js';

function candidate(
  extractionRule: HistoricalDeepExpansionDiscoveryCandidateV2['extractionRule'] = 'general-register-roll-call',
): HistoricalDeepExpansionDiscoveryCandidateV2 {
  const motionText = 'Representative Alpha renewed the motion that HF100 be placed on the General Register. A roll call was taken.';
  return {
    case: {
      stableKey: '2023-2024|house|event-1', caseKey: '2023-2024|house|HF100|2024-05-01', externalKey: 'event-1',
      tranche: 'selector-disagreement', voteEventId: 'vote-1', session: '2023-2024', chamber: 'house', identifier: 'HF100',
      occurredOn: '2024-05-01', asOf: '2024-04-30T23:59:59.999Z',
    },
    membershipId: 'membership-1', legislatorId: 'legislator-1', memberName: 'Alice Alpha', party: 'DFL',
    quickYesProbability: 0.5, quickEvidenceQuality: 'moderate', selectedForCurrentDeep: false, selectedForCandidateDeep: true,
    kind: 'committee_bill_procedural_vote', voteSide: 'aye', motionText,
    excerpt: `${motionText} AYES Alpha, Alice With a vote of 1 AYES and 0 NAYS, the motion prevailed.`,
    source: {
      sourceId: 'house-minutes-93010-1', sourceClass: 'house_committee_record', title: 'Fixture minutes',
      url: 'https://www.house.mn.gov/committees/minutes/93010/1', publishedAt: '2024-04-01T00:00:00.000Z', contentSha256: 'fixture',
    },
    extractionMethod: 'deterministic-house-committee-roll-call-v2',
    extractionRule,
  };
}

function bundle(value: HistoricalDeepExpansionDiscoveryCandidateV2): HistoricalDeepExpansionDiscoveryCandidateBundleV2 {
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v2', generatedAt: '2026-09-13T00:00:00.000Z', purpose: 'test',
    metadata: { parser: 'deterministic-house-committee-roll-call-v2', baselineParser: 'deterministic-house-committee-roll-call-v1', outcomeUse: 'none', designGuard: 'test' },
    input: { discoveryCases: 24, discoveryMemberCasePairs: 1, sourcePages: 1, sourceCaseMatches: 1, casesWithSources: 1, casesWithoutSources: 23 },
    summary: {
      candidateCount: 1, v1BaselineCandidateCount: value.extractionRule === 'v1-baseline' ? 1 : 0,
      supplementalCandidateCount: value.extractionRule === 'v1-baseline' ? 0 : 1, memberCasePairsWithCandidates: 1, casesWithCandidates: 1,
      sourcesWithCandidates: 1, sourceCaseMatchesWithCandidates: 1, ayeCandidates: 1, nayCandidates: 0,
      currentDeepTargetCandidates: 0, candidateDeepTargetCandidates: 1, bothTargetCandidates: 0, outsideBothTargetCandidates: 0,
      generalRegisterCandidates: value.extractionRule === 'general-register-roll-call' ? 1 : 0,
      alternateRollTriggerCandidates: 0, directNamedRollListCandidates: 0,
    },
    candidates: [value], diagnostics: [],
  };
}

function sourceBundle(sectionIdentifier: string): HistoricalDeepExpansionSourceBundle {
  const value = candidate();
  const content = [
    `<p>${sectionIdentifier} (Fixture); section heading.</p>`,
    `<p>${value.motionText}</p>`,
    '<p>AYES</p>',
    '<p>Alpha, Alice</p>',
    '<p>With a vote of 1 AYES and 0 NAYS, the motion prevailed.</p>',
  ].join('\n');
  return {
    sources: [{ id: value.source.sourceId, content }],
  } as unknown as HistoricalDeepExpansionSourceBundle;
}

test('rejects supplemental candidates whose nearest local bill context names another bill', () => {
  const result = applyHistoricalDeepExpansionV2LocalBillGuard(bundle(candidate()), sourceBundle('HF999'));
  assert.equal(result.summary.candidateCount, 0);
  assert.equal(result.summary.supplementalCandidateCount, 0);
  assert.equal(result.candidates.length, 0);
});

test('keeps supplemental candidates when local bill context matches and preserves v1 baseline candidates', () => {
  const supplemental = applyHistoricalDeepExpansionV2LocalBillGuard(bundle(candidate()), sourceBundle('HF100'));
  assert.equal(supplemental.summary.candidateCount, 1);
  assert.equal(supplemental.candidates[0].case.identifier, 'HF100');

  const baselineCandidate = candidate('v1-baseline');
  const baseline = applyHistoricalDeepExpansionV2LocalBillGuard(bundle(baselineCandidate), sourceBundle('HF999'));
  assert.equal(baseline.summary.candidateCount, 1);
  assert.equal(baseline.summary.v1BaselineCandidateCount, 1);
});

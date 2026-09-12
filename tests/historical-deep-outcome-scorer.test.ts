import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyHistoricalDeepMotion,
  proceduralSignal,
  scoreHistoricalDeepDiscoveryCandidates,
} from '../src/evaluation/historical-deep-outcome-scorer.js';

const baseCandidate = {
  case: { voteEventId: 'v1', session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', asOf: '2023-01-18T23:59:59.999Z' },
  membershipId: 'm1', legislatorId: 'l1', memberName: 'Member One', party: 'DFL', quickYesProbability: 0.95,
  quickEvidenceQuality: 'medium', selectedForCurrentDeep: false, kind: 'committee_bill_procedural_vote', voteSide: 'nay',
  motionText: 'Chair renewed the motion that HF1 be re-referred to the Committee on Judiciary Finance and Civil Law.',
  excerpt: 'example', source: { sourceId: 's1', sourceClass: 'house_committee_record', title: 'minutes', url: 'https://www.house.mn.gov/committees/minutes/93000/1', publishedAt: '2023-01-10T00:00:00.000Z', contentSha256: 'abc' },
  extractionMethod: 'deterministic-house-committee-roll-call-v1',
} as const;

test('classifies procedural direction conservatively', () => {
  assert.equal(classifyHistoricalDeepMotion('HF1 be re-referred to Judiciary'), 'advances');
  assert.equal(classifyHistoricalDeepMotion('motion to table HF1'), 'impedes');
  assert.equal(classifyHistoricalDeepMotion('HF1 be laid over'), 'ambiguous');
  assert.equal(proceduralSignal('motion to table HF1', 'nay'), 'supports_advancement');
});

test('scores frozen candidates only after outcomes are joined', () => {
  const candidates = {
    schemaVersion: 'historical-deep-discovery-candidates-v1', generatedAt: '2026-09-12T00:00:00.000Z', purpose: 'test',
    input: { discoveryCases: 1, discoveryMemberCasePairs: 1, sourceCount: 1, sourceCaseCount: 1 },
    summary: { candidateCount: 1, memberCasePairsWithCandidates: 1, casesWithCandidates: 1, sourcesWithCandidates: 1, ayeCandidates: 0, nayCandidates: 1, currentDeepTargetCandidates: 0, outsideCurrentDeepCandidates: 1 },
    candidates: [baseCandidate], diagnostics: [],
  };
  const outcomes = {
    schemaVersion: 'historical-deep-outcome-snapshot-v1', generatedAt: '2026-09-12T00:00:00.000Z', codeSha: 'sha', purpose: 'test',
    cases: [{ session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', voteEventId: 'current-v1', members: [{ membershipId: 'm1', legislatorId: 'l1', memberName: 'Member One', actualOutcome: 0 as const }] }],
  } as const;
  const result = scoreHistoricalDeepDiscoveryCandidates(candidates as never, outcomes as never);
  assert.equal(result.summary.directionalPairs, 1);
  assert.equal(result.summary.quickErrorsOnDirectionalPairs, 1);
  assert.equal(result.summary.rescuedQuickErrors, 1);
  assert.equal(result.summary.rescuedHighConfidenceQuickErrors, 1);
  assert.equal(result.pairs[0].signal, 'opposes_advancement');
});

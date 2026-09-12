import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateHistoricalDeepImpactReplay,
  historicalEvidenceFreshness,
} from '../src/evaluation/historical-deep-impact-replay.js';

const replayCase = {
  voteEventId: 'vote-1',
  billId: 'bill-1',
  identifier: 'HF1',
  title: 'Test bill',
  session: '2023-2024',
  chamberId: 'chamber-1',
  chamber: 'house',
  occurredOn: '2023-01-19',
  asOf: '2023-01-18T23:59:59.999Z',
  targetVersionId: 'version-1',
  quickModelVersion: 'member-model-test',
  members: [
    {
      membershipId: 'm1', legislatorId: 'l1', memberName: 'Member One', party: 'DFL', yesProbability: 0.8,
      evidenceQuality: 'medium', support: { global: 1, party: 1, member: 1, analogue: 1 }, selectedForCurrentDeep: true,
    },
    {
      membershipId: 'm2', legislatorId: 'l2', memberName: 'Member Two', party: 'R', yesProbability: 0.55,
      evidenceQuality: 'medium', support: { global: 1, party: 1, member: 1, analogue: 1 }, selectedForCurrentDeep: false,
    },
  ],
  currentDeepTargetIds: ['m1'],
  discoveryRequest: {
    forecastId: 'vote-1', billId: 'bill-1', chamberId: 'chamber-1', asOf: '2023-01-18T23:59:59.999Z',
    subject: { identifier: 'HF1', title: 'Test bill' },
    targets: [
      { membershipId: 'm1', memberName: 'Member One', party: 'DFL', yesProbability: 0.8, rationale: 'test' },
      { membershipId: 'm2', memberName: 'Member Two', party: 'R', yesProbability: 0.55, rationale: 'test' },
    ],
  },
};

const source = {
  case: { session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19' },
  id: 'source-1',
  sourceClass: 'house_committee_record',
  url: 'https://www.house.mn.gov/committees/minutes/93000/1',
  title: 'Committee minutes',
  publishedAt: '2023-01-10T00:00:00.000Z',
  expectedMarkers: ['HF1', 'roll call'],
  fetchedAt: '2026-09-12T00:00:00.000Z',
  finalUrl: 'https://www.house.mn.gov/committees/minutes/93000/1',
  httpStatus: 200,
  contentType: 'text/html',
  bytes: 10,
  contentSha256: 'a'.repeat(64),
  content: '<html></html>',
};

function candidate(membershipId: string, legislatorId: string, memberName: string, voteSide: 'aye' | 'nay', selectedForCurrentDeep: boolean) {
  return {
    case: { voteEventId: 'vote-1', session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', asOf: '2023-01-18T23:59:59.999Z' },
    membershipId,
    legislatorId,
    memberName,
    party: membershipId === 'm1' ? 'DFL' : 'R',
    quickYesProbability: membershipId === 'm1' ? 0.8 : 0.55,
    quickEvidenceQuality: 'medium',
    selectedForCurrentDeep,
    kind: 'committee_bill_procedural_vote',
    voteSide,
    motionText: 'HF1 be re-referred to the Committee on Judiciary Finance and Civil Law',
    excerpt: 'roll call excerpt',
    source: {
      sourceId: source.id,
      sourceClass: source.sourceClass,
      title: source.title,
      url: source.url,
      publishedAt: source.publishedAt,
      contentSha256: source.contentSha256,
    },
    extractionMethod: 'deterministic-house-committee-roll-call-v1',
  };
}

function fixture() {
  return {
    discovery: {
      metadata: { generatedAt: '2026-09-12T00:00:00.000Z', codeSha: 'sha', databaseSource: 'test', purpose: 'test', pilotCases: [], cases: 1, memberCasePairs: 2, currentDeepTargetLimit: 1 },
      cases: [replayCase],
    },
    candidates: {
      schemaVersion: 'historical-deep-discovery-candidates-v1', generatedAt: '2026-09-12T00:00:00.000Z', purpose: 'test',
      input: { discoveryCases: 1, discoveryMemberCasePairs: 2, sourceCount: 1, sourceCaseCount: 1 },
      summary: { candidateCount: 2, memberCasePairsWithCandidates: 2, casesWithCandidates: 1, sourcesWithCandidates: 1, ayeCandidates: 1, nayCandidates: 1, currentDeepTargetCandidates: 1, outsideCurrentDeepCandidates: 1 },
      candidates: [candidate('m1', 'l1', 'Member One', 'aye', true), candidate('m2', 'l2', 'Member Two', 'nay', false)],
      diagnostics: [],
    },
    sources: {
      schemaVersion: 'historical-deep-source-bundle-v1', catalogSchemaVersion: 'historical-deep-source-catalog-v1', jurisdictionSlug: 'us-mn', generatedAt: '2026-09-12T00:00:00.000Z', sourceCount: 1, caseCount: 1, sources: [source],
    },
    outcomes: {
      schemaVersion: 'historical-deep-outcome-snapshot-v1', generatedAt: '2026-09-12T00:00:00.000Z', codeSha: 'sha', purpose: 'test',
      cases: [{ session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', voteEventId: 'vote-current', members: [
        { membershipId: 'current-m1', legislatorId: 'l1', memberName: 'Member One', actualOutcome: 1 },
        { membershipId: 'current-m2', legislatorId: 'l2', memberName: 'Member Two', actualOutcome: 0 },
      ] }],
    },
  };
}

test('computes evidence freshness relative to the historical cutoff', () => {
  assert.equal(historicalEvidenceFreshness('2023-01-10T00:00:00.000Z', '2023-01-18T23:59:59.999Z'), 'current');
  assert.equal(historicalEvidenceFreshness('2021-01-10T00:00:00.000Z', '2023-01-18T23:59:59.999Z'), 'recent');
  assert.equal(historicalEvidenceFreshness('2019-01-10T00:00:00.000Z', '2023-01-18T23:59:59.999Z'), 'stale');
  assert.throws(
    () => historicalEvidenceFreshness('2023-01-19T00:00:00.000Z', '2023-01-18T23:59:59.999Z'),
    /after replay cutoff/,
  );
});

test('replays unchanged impact under current targeting and chamber-wide discovery separately', async () => {
  const value = fixture();
  const result = await evaluateHistoricalDeepImpactReplay(
    value.discovery as never,
    value.candidates as never,
    value.sources as never,
    value.outcomes as never,
  );

  const current = result.scenarios['current-targets'];
  const all = result.scenarios['discovery-all'];
  assert.equal(result.metadata.impactVersion, 'logit-evidence-v1');
  assert.equal(current.candidateObservations, 1);
  assert.equal(current.appliedEvidenceItems, 1);
  assert.equal(current.affectedDecisiveMemberPairs, 1);
  assert.equal(current.correctedClassifications, 0);
  assert.equal(current.harmedClassifications, 0);
  assert.equal(all.candidateObservations, 2);
  assert.equal(all.appliedEvidenceItems, 2);
  assert.equal(all.affectedDecisiveMemberPairs, 2);
  assert.equal(all.correctedClassifications, 1);
  assert.equal(all.harmedClassifications, 0);
  assert.equal(all.classificationFlips, 1);
  assert.ok((all.allDecisive.delta.brier ?? 0) < 0);
  assert.ok((all.allDecisive.delta.logLoss ?? 0) < 0);
});

test('fails closed when a candidate no longer matches its pinned frozen source', async () => {
  const value = fixture();
  value.candidates.candidates[0].source.contentSha256 = 'b'.repeat(64);
  await assert.rejects(
    evaluateHistoricalDeepImpactReplay(
      value.discovery as never,
      value.candidates as never,
      value.sources as never,
      value.outcomes as never,
    ),
    /lineage mismatch/,
  );
});

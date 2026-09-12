import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateHistoricalDeepTargetedImpactReplay,
  selectHistoricalDeepNeedOnlyTargetsForCase,
} from '../src/evaluation/historical-deep-targeted-impact-replay.js';

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
      evidenceQuality: 'moderate', support: { global: 1, party: 1, member: 1, analogue: 1 }, selectedForCurrentDeep: true,
    },
    {
      membershipId: 'm2', legislatorId: 'l2', memberName: 'Member Two', party: 'R', yesProbability: 0.55,
      evidenceQuality: 'moderate', support: { global: 1, party: 1, member: 1, analogue: 1 }, selectedForCurrentDeep: false,
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

function candidate(
  membershipId: string,
  legislatorId: string,
  memberName: string,
  voteSide: 'aye' | 'nay',
  selectedForCurrentDeep: boolean,
) {
  return {
    case: {
      voteEventId: 'vote-1', session: '2023-2024', chamber: 'house', identifier: 'HF1',
      occurredOn: '2023-01-19', asOf: '2023-01-18T23:59:59.999Z',
    },
    membershipId,
    legislatorId,
    memberName,
    party: membershipId === 'm1' ? 'DFL' : 'R',
    quickYesProbability: membershipId === 'm1' ? 0.8 : 0.55,
    quickEvidenceQuality: 'moderate',
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

function score(modelErrorRecall: number, brierMassRecall: number, highConfidenceErrorRecall = 0) {
  return { modelErrorRecall, brierMassRecall, highConfidenceErrorRecall };
}

function bakeoff() {
  return {
    metadata: {
      targetLimit: 1,
      highConfidenceThreshold: 0.9,
      developmentSessions: ['2021-2022', '2023-2024'],
      holdoutSessions: ['2025-2026'],
      purpose: 'test',
      selectionGuard: 'test',
    },
    strategies: [
      {
        strategy: 'live-current',
        development: score(0.10, 0.10, 0.10),
        holdout: score(0.12, 0.11, 0.08),
      },
      {
        strategy: 'need-only',
        development: score(0.30, 0.25, 0),
        holdout: score(0.34, 0.26, 0),
      },
      {
        strategy: 'deterministic-uniform',
        development: score(0.13, 0.12, 0.15),
        holdout: score(0.14, 0.13, 0.10),
      },
    ],
  };
}

function fixture() {
  return {
    targetStrategies: bakeoff(),
    discovery: {
      metadata: {
        generatedAt: '2026-09-12T00:00:00.000Z', codeSha: 'sha', databaseSource: 'test', purpose: 'test',
        pilotCases: [], cases: 1, memberCasePairs: 2, currentDeepTargetLimit: 1,
      },
      cases: [replayCase],
    },
    candidates: {
      schemaVersion: 'historical-deep-discovery-candidates-v1', generatedAt: '2026-09-12T00:00:00.000Z', purpose: 'test',
      input: { discoveryCases: 1, discoveryMemberCasePairs: 2, sourceCount: 1, sourceCaseCount: 1 },
      summary: {
        candidateCount: 2, memberCasePairsWithCandidates: 2, casesWithCandidates: 1, sourcesWithCandidates: 1,
        ayeCandidates: 1, nayCandidates: 1, currentDeepTargetCandidates: 1, outsideCurrentDeepCandidates: 1,
      },
      candidates: [
        candidate('m1', 'l1', 'Member One', 'aye', true),
        candidate('m2', 'l2', 'Member Two', 'nay', false),
      ],
      diagnostics: [],
    },
    sources: {
      schemaVersion: 'historical-deep-source-bundle-v1',
      catalogSchemaVersion: 'historical-deep-source-catalog-v1',
      jurisdictionSlug: 'us-mn',
      generatedAt: '2026-09-12T00:00:00.000Z',
      sourceCount: 1,
      caseCount: 1,
      sources: [source],
    },
    outcomes: {
      schemaVersion: 'historical-deep-outcome-snapshot-v1',
      generatedAt: '2026-09-12T00:00:00.000Z',
      codeSha: 'sha',
      purpose: 'test',
      cases: [{
        session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19', voteEventId: 'vote-current',
        members: [
          { membershipId: 'current-m1', legislatorId: 'l1', memberName: 'Member One', actualOutcome: 1 },
          { membershipId: 'current-m2', legislatorId: 'l2', memberName: 'Member Two', actualOutcome: 0 },
        ],
      }],
    },
  };
}

test('need-only target selection uses only frozen Quick inputs', () => {
  const selected = selectHistoricalDeepNeedOnlyTargetsForCase(replayCase as never, 1);
  assert.deepEqual(selected, ['m2']);
});

test('compares current targets, need-only targets, and chamber-wide discovery without changing impact weights', async () => {
  const value = fixture();
  const result = await evaluateHistoricalDeepTargetedImpactReplay(
    value.targetStrategies as never,
    value.discovery as never,
    value.candidates as never,
    value.sources as never,
    value.outcomes as never,
  );

  assert.equal(result.metadata.candidateStrategy, 'need-only');
  assert.equal(result.metadata.impactVersion, 'logit-evidence-v1');
  assert.equal(result.targetSelection[0].currentTargets, 1);
  assert.equal(result.targetSelection[0].candidateTargets, 1);
  assert.equal(result.targetSelection[0].overlap, 0);

  const current = result.scenarios['current-targets'];
  const candidateResult = result.scenarios['need-only-targets'];
  const ceiling = result.scenarios['discovery-all'];
  assert.equal(current.correctedClassifications, 0);
  assert.equal(candidateResult.correctedClassifications, 1);
  assert.equal(candidateResult.harmedClassifications, 0);
  assert.ok((candidateResult.allDecisive.delta.brier ?? 0) < 0);
  assert.ok((candidateResult.allDecisive.delta.logLoss ?? 0) < 0);
  assert.equal(ceiling.correctedClassifications, 1);
});

test('fails before replay when the frozen candidate does not materially beat both baselines on both splits', async () => {
  const value = fixture();
  value.targetStrategies.strategies[1].holdout.brierMassRecall = 0.14;
  await assert.rejects(
    evaluateHistoricalDeepTargetedImpactReplay(
      value.targetStrategies as never,
      value.discovery as never,
      value.candidates as never,
      value.sources as never,
      value.outcomes as never,
    ),
    /material-lift guard/,
  );
});

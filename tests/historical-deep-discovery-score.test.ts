import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyHistoricalProceduralMotion,
  inferredAdvancementOutcome,
  scoreHistoricalDeepDiscoveryCandidates,
  validateHistoricalDeepDiscoveryCandidateBundle,
  type HistoricalDeepDiscoveryScoringCase,
} from '../src/evaluation/historical-deep-discovery-score.js';
import type {
  HistoricalDeepDiscoveryCandidate,
  HistoricalDeepDiscoveryCandidateBundle,
} from '../src/evaluation/historical-deep-discovery-extractor.js';
import { HISTORICAL_DEEP_PILOT_CASES } from '../src/evaluation/historical-deep-pilot.js';
import { MEMBER_MODEL_VERSION } from '../src/forecasting/member-model.js';
import type { HistoricalQuickReplayMemberPrediction } from '../src/evaluation/historical-quick-replay.js';

const HF3276 = HISTORICAL_DEEP_PILOT_CASES.find((spec) => spec.identifier === 'HF3276');
if (!HF3276) throw new Error('HF3276 pilot spec missing');

function prediction(input: {
  membershipId: string;
  legislatorId: string;
  probability: number;
  actual: 0 | 1;
  party?: string;
}): HistoricalQuickReplayMemberPrediction {
  return {
    membershipId: input.membershipId,
    legislatorId: input.legislatorId,
    party: input.party ?? 'DFL',
    yesProbability: input.probability,
    actualOutcome: input.actual,
    analogueEffectiveWeight: 1,
    support: { global: 100, party: 50, member: 20, analogue: 1 },
  };
}

function scoringCase(predictions: HistoricalQuickReplayMemberPrediction[]): HistoricalDeepDiscoveryScoringCase {
  return {
    spec: HF3276,
    replay: {
      voteEventId: 'vote-hf3276',
      session: HF3276.session,
      chamber: HF3276.chamber,
      occurredOn: HF3276.occurredOn,
      status: 'replayable',
      modelVersion: MEMBER_MODEL_VERSION,
      targetVersionId: 'version-hf3276',
      activeMembers: predictions.length,
      directAnalogueMembers: predictions.length,
      selectedAnalogues: 3,
      memberPredictions: predictions,
      passageProbability: 0.5,
      expectedYes: predictions.reduce((sum, item) => sum + (item.yesProbability ?? 0), 0),
      yesLow: 0,
      yesHigh: predictions.length,
      actualYes: predictions.filter((item) => item.actualOutcome === 1).length,
      passed: false,
    },
  };
}

function candidate(input: {
  legislatorId?: string;
  membershipId?: string;
  memberName?: string;
  quickYesProbability?: number;
  voteSide?: 'aye' | 'nay';
  motionText?: string;
} = {}): HistoricalDeepDiscoveryCandidate {
  return {
    case: {
      voteEventId: 'frozen-vote-hf3276',
      session: HF3276.session,
      chamber: HF3276.chamber,
      identifier: HF3276.identifier,
      occurredOn: HF3276.occurredOn,
      asOf: '2024-05-18T23:59:59.999Z',
    },
    membershipId: input.membershipId ?? 'membership-hansen',
    legislatorId: input.legislatorId ?? 'legislator-hansen',
    memberName: input.memberName ?? 'Rick Hansen',
    party: 'DFL',
    district: '53B',
    quickYesProbability: input.quickYesProbability ?? 0.995,
    quickEvidenceQuality: 'strong',
    selectedForCurrentDeep: false,
    kind: 'committee_bill_procedural_vote',
    voteSide: input.voteSide ?? 'nay',
    motionText: input.motionText ?? 'Chair Klevorn renewed the motion that HF3276 be re-referred to Ways and Means.',
    excerpt: 'HF3276 procedural roll call excerpt',
    source: {
      sourceId: 'hf3276-state-local-committee-2024-04-09',
      sourceClass: 'house_committee_record',
      title: 'State and Local Government Finance and Policy',
      url: 'https://www.house.mn.gov/committees/minutes/93022/100838',
      publishedAt: '2024-04-09T00:00:00.000Z',
      contentSha256: 'a'.repeat(64),
    },
    extractionMethod: 'deterministic-house-committee-roll-call-v1',
  };
}

function bundle(candidates: HistoricalDeepDiscoveryCandidate[]): HistoricalDeepDiscoveryCandidateBundle {
  return {
    schemaVersion: 'historical-deep-discovery-candidates-v1',
    generatedAt: '2026-09-12T00:00:00.000Z',
    purpose: 'test',
    input: {
      discoveryCases: 6,
      discoveryMemberCasePairs: 804,
      sourceCount: 15,
      sourceCaseCount: 6,
    },
    summary: {
      candidateCount: candidates.length,
      memberCasePairsWithCandidates: candidates.length,
      casesWithCandidates: candidates.length ? 1 : 0,
      sourcesWithCandidates: candidates.length ? 1 : 0,
      ayeCandidates: candidates.filter((item) => item.voteSide === 'aye').length,
      nayCandidates: candidates.filter((item) => item.voteSide === 'nay').length,
      currentDeepTargetCandidates: 0,
      outsideCurrentDeepCandidates: candidates.length,
    },
    candidates,
    diagnostics: [],
  };
}

test('procedural motion direction treats advancement and tabling oppositely', () => {
  assert.equal(classifyHistoricalProceduralMotion('HF3276 be re-referred to Ways and Means'), 'advance');
  assert.equal(inferredAdvancementOutcome('HF3276 be re-referred to Ways and Means', 'aye'), 1);
  assert.equal(inferredAdvancementOutcome('HF3276 be re-referred to Ways and Means', 'nay'), 0);
  assert.equal(classifyHistoricalProceduralMotion('Motion to table HF2'), 'block');
  assert.equal(inferredAdvancementOutcome('Motion to table HF2', 'aye'), 0);
  assert.equal(inferredAdvancementOutcome('Motion to table HF2', 'nay'), 1);
  assert.equal(inferredAdvancementOutcome('HF3276 was laid over', 'aye'), undefined);
});

test('pre-vote Hansen NAY correctly challenges a high-confidence Quick miss', () => {
  const result = scoreHistoricalDeepDiscoveryCandidates(
    bundle([candidate()]),
    [scoringCase([
      prediction({ membershipId: 'membership-hansen', legislatorId: 'legislator-hansen', probability: 0.995, actual: 0 }),
      prediction({ membershipId: 'membership-nash', legislatorId: 'legislator-nash', probability: 0.005, actual: 0, party: 'R' }),
    ])],
    { generatedAt: '2026-09-12T00:00:00.000Z' },
  );

  assert.equal(result.overall.quickErrors, 1);
  assert.equal(result.overall.highConfidenceQuickErrors, 1);
  assert.equal(result.overall.candidatePairsOnQuickErrors, 1);
  assert.equal(result.overall.candidateErrorCoverage, 1);
  assert.equal(result.overall.challengePairs, 1);
  assert.equal(result.overall.correctChallenges, 1);
  assert.equal(result.overall.wrongChallenges, 0);
  assert.equal(result.overall.challengePrecision, 1);
  assert.equal(result.overall.quickErrorCorrectionRecall, 1);
  assert.equal(result.overall.highConfidenceErrorCorrectionRecall, 1);
  assert.equal(result.challengeExamples[0].memberName, 'Rick Hansen');
  assert.equal(result.challengeExamples[0].correct, true);
});

test('a procedural signal that contradicts a correct Quick forecast is counted as a wrong challenge', () => {
  const result = scoreHistoricalDeepDiscoveryCandidates(
    bundle([candidate({ voteSide: 'aye' })]),
    [scoringCase([
      prediction({ membershipId: 'membership-hansen', legislatorId: 'legislator-hansen', probability: 0.005, actual: 0 }),
    ])],
  );
  assert.equal(result.overall.quickErrors, 0);
  assert.equal(result.overall.challengePairs, 1);
  assert.equal(result.overall.correctChallenges, 0);
  assert.equal(result.overall.wrongChallenges, 1);
  assert.equal(result.overall.challengePrecision, 0);
});

test('conflicting procedural signals for the same member remain mixed and do not force a challenge', () => {
  const result = scoreHistoricalDeepDiscoveryCandidates(
    bundle([
      candidate({ voteSide: 'nay', motionText: 'HF3276 be re-referred to Ways and Means' }),
      candidate({ voteSide: 'nay', motionText: 'Motion to table HF3276' }),
    ]),
    [scoringCase([
      prediction({ membershipId: 'membership-hansen', legislatorId: 'legislator-hansen', probability: 0.995, actual: 0 }),
    ])],
  );
  assert.equal(result.overall.candidatePairs, 1);
  assert.equal(result.overall.mixedDirectionalPairs, 1);
  assert.equal(result.overall.directionalPairs, 0);
  assert.equal(result.overall.challengePairs, 0);
});

test('candidate artifact validation rejects floor outcomes before scoring', () => {
  const contaminated = bundle([candidate()]) as HistoricalDeepDiscoveryCandidateBundle & {
    actualOutcome?: number;
  };
  contaminated.actualOutcome = 0;
  assert.throws(() => validateHistoricalDeepDiscoveryCandidateBundle(contaminated), /forbidden outcome field/i);
});

test('candidate artifact validation rejects same-day evidence', () => {
  const sameDay = candidate();
  sameDay.source.publishedAt = '2024-05-19T00:00:00.000Z';
  assert.throws(() => validateHistoricalDeepDiscoveryCandidateBundle(bundle([sameDay])), /strictly pre-vote/i);
});

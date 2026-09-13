import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHistoricalDeepExpansionImpactReplayV2 } from '../src/evaluation/historical-deep-expansion-impact-replay-v2.js';

function candidateFixture(candidateCount = 0) {
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
      discoveryCases: 24, discoveryMemberCasePairs: 0, sourcePages: 0, sourceCaseMatches: 0,
      casesWithSources: 0, casesWithoutSources: 24,
    },
    summary: {
      candidateCount,
      v1BaselineCandidateCount: 0,
      supplementalCandidateCount: candidateCount,
      memberCasePairsWithCandidates: 0,
      casesWithCandidates: 0,
      sourcesWithCandidates: 0,
      sourceCaseMatchesWithCandidates: 0,
      ayeCandidates: 0,
      nayCandidates: 0,
      currentDeepTargetCandidates: 0,
      candidateDeepTargetCandidates: 0,
      bothTargetCandidates: 0,
      outsideBothTargetCandidates: 0,
      generalRegisterCandidates: 0,
      alternateRollTriggerCandidates: 0,
      directNamedRollListCandidates: 0,
    },
    candidates: [],
    diagnostics: [],
  };
}

function scoreFixture(candidateObservations = 0, signalClassifier = 'historical-deep-outcome-scorer-v1-unchanged') {
  return {
    schemaVersion: 'historical-deep-expansion-discovery-score-v2',
    generatedAt: '2026-09-13T00:00:00.000Z',
    purpose: 'test',
    metadata: {
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      signalClassifier,
      outcomeSnapshotReuse: 'preexisting-immutable-v1-expansion-outcomes',
      generalRegisterPolicy: 'test',
    },
    summary: {
      candidateObservations,
      memberCasePairs: 0,
    },
    pairs: [],
  };
}

test('fails closed when frozen v2 candidate and score observation counts diverge', async () => {
  await assert.rejects(
    () => evaluateHistoricalDeepExpansionImpactReplayV2(
      {} as never,
      candidateFixture(0) as never,
      {} as never,
      {} as never,
      scoreFixture(1) as never,
    ),
    /score\/candidate observation count mismatch/,
  );
});

test('rejects any post-freeze signal-classifier change before replay', async () => {
  await assert.rejects(
    () => evaluateHistoricalDeepExpansionImpactReplayV2(
      {} as never,
      candidateFixture(0) as never,
      {} as never,
      {} as never,
      scoreFixture(0, 'retuned-after-outcomes') as never,
    ),
    /unsupported signal classifier/,
  );
});

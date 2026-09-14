import type { Pool } from 'pg';
import {
  CHAMBER_HISTORICAL_RESIDUAL_SIGMA,
  CHAMBER_HISTORICAL_YES_MAE,
  poissonBinomialDistribution,
  requiredYesForRule,
  simulateChamber,
  type PassageRule,
} from '../forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import { binaryAccuracy, brierScore, logLoss } from './metrics';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';

export const PASSAGE_TAIL_RISK_SCREEN_SCHEMA = 'passage-tail-risk-screen-v1' as const;
export const PASSAGE_TAIL_RISK_MEMBER_HALF_LIFE_DAYS = 180 as const;

export type PassageTailCandidateId =
  | 'normal-v1'
  | 'normal-sigma-1.25x'
  | 'normal-sigma-1.5x'
  | 'laplace-mae'
  | 'logistic-mae';

export const PASSAGE_TAIL_CANDIDATES: readonly PassageTailCandidateId[] = [
  'normal-v1',
  'normal-sigma-1.25x',
  'normal-sigma-1.5x',
  'laplace-mae',
  'logistic-mae',
] as const;

interface ScreenRow {
  voteEventId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  passed: boolean;
  probabilities: Record<PassageTailCandidateId, number>;
}

interface SliceScore {
  events: number;
  passed: number;
  failed: number;
  meanPassageProbability: number;
  brier: number;
  logLoss: number;
  accuracy: number;
}

function normalCdf(value: number): number {
  if (value === Number.POSITIVE_INFINITY) return 1;
  if (value === Number.NEGATIVE_INFINITY) return 0;
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = Math.exp(-0.5 * absolute * absolute) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return value >= 0 ? 1 - tail : tail;
}

function residualCdf(candidate: PassageTailCandidateId, value: number): number {
  if (candidate === 'laplace-mae') {
    const scale = CHAMBER_HISTORICAL_YES_MAE;
    return value < 0 ? 0.5 * Math.exp(value / scale) : 1 - 0.5 * Math.exp(-value / scale);
  }
  if (candidate === 'logistic-mae') {
    const scale = CHAMBER_HISTORICAL_YES_MAE / (2 * Math.log(2));
    return 1 / (1 + Math.exp(-value / scale));
  }
  const multiplier = candidate === 'normal-sigma-1.25x' ? 1.25 : candidate === 'normal-sigma-1.5x' ? 1.5 : 1;
  return normalCdf(value / (CHAMBER_HISTORICAL_RESIDUAL_SIGMA * multiplier));
}

export function passageProbabilityForTailCandidate(
  probabilities: readonly number[],
  rule: PassageRule,
  candidate: PassageTailCandidateId,
): number {
  if (candidate === 'normal-v1') return simulateChamber(probabilities, rule).passageProbability;
  if (candidate === 'normal-sigma-1.25x' || candidate === 'normal-sigma-1.5x') {
    const multiplier = candidate === 'normal-sigma-1.25x' ? 1.25 : 1.5;
    return simulateChamber(probabilities, rule, {
      systematicSigmaVotes: CHAMBER_HISTORICAL_RESIDUAL_SIGMA * multiplier,
    }).passageProbability;
  }
  const distribution = poissonBinomialDistribution(probabilities);
  const requiredYes = requiredYesForRule(rule, probabilities.length);
  if (requiredYes <= 0) return 1;
  if (requiredYes >= distribution.length) return 0;
  const boundary = requiredYes - 0.5;
  const failureProbability = distribution.reduce(
    (sum, probability, yes) => sum + probability * residualCdf(candidate, boundary - yes),
    0,
  );
  return Math.min(1, Math.max(0, 1 - failureProbability));
}

function score(rows: readonly ScreenRow[], candidate: PassageTailCandidateId): SliceScore {
  const forecasts = rows.map((row) => ({
    probability: row.probabilities[candidate],
    outcome: row.passed ? 1 as const : 0 as const,
  }));
  return {
    events: rows.length,
    passed: rows.filter((row) => row.passed).length,
    failed: rows.filter((row) => !row.passed).length,
    meanPassageProbability: forecasts.reduce((sum, row) => sum + row.probability, 0) / forecasts.length,
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    accuracy: binaryAccuracy(forecasts),
  };
}

function candidateSlices(rows: readonly ScreenRow[], candidate: PassageTailCandidateId) {
  return {
    all: score(rows, candidate),
    passed: score(rows.filter((row) => row.passed), candidate),
    failed: score(rows.filter((row) => !row.passed), candidate),
  };
}

export async function evaluatePassageTailRiskScreen(pool: Pool, options: { codeSha?: string | null } = {}) {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const replay = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    PASSAGE_TAIL_RISK_MEMBER_HALF_LIFE_DAYS,
  );

  let baselineChecked = 0;
  let maximumBaselineDifference = 0;
  const rows: ScreenRow[] = [];
  for (const row of replay) {
    if (row.status !== 'replayable' || row.passageProbability === undefined) continue;
    const probabilities = row.memberPredictions.map((member) => member.yesProbability);
    if (probabilities.some((value) => value === undefined)) continue;
    const memberProbabilities = probabilities as number[];
    const rule = ordinaryMinnesotaPassageRule(row.chamber);
    const candidateProbabilities = Object.fromEntries(PASSAGE_TAIL_CANDIDATES.map((candidate) => [
      candidate,
      passageProbabilityForTailCandidate(memberProbabilities, rule, candidate),
    ])) as Record<PassageTailCandidateId, number>;
    const baselineDifference = Math.abs(candidateProbabilities['normal-v1'] - row.passageProbability);
    maximumBaselineDifference = Math.max(maximumBaselineDifference, baselineDifference);
    baselineChecked += 1;
    if (baselineDifference > 1e-12) throw new Error(`Passage tail-risk control drift ${baselineDifference} for ${row.voteEventId}`);
    rows.push({
      voteEventId: row.voteEventId,
      session: row.session,
      chamber: row.chamber,
      occurredOn: row.occurredOn,
      passed: row.passed,
      probabilities: candidateProbabilities,
    });
  }

  const primary = rows.filter((row) => row.session === '2025-2026' && row.chamber === 'house');
  const baseline = candidateSlices(primary, 'normal-v1');
  const candidates = Object.fromEntries(PASSAGE_TAIL_CANDIDATES.map((candidate) => {
    const slices = candidateSlices(primary, candidate);
    const deltas = {
      passageBrier: slices.all.brier - baseline.all.brier,
      passageLogLoss: slices.all.logLoss - baseline.all.logLoss,
      passageAccuracy: slices.all.accuracy - baseline.all.accuracy,
      failedPassageBrier: slices.failed.brier - baseline.failed.brier,
      failedMeanPassageProbability: slices.failed.meanPassageProbability - baseline.failed.meanPassageProbability,
      passedPassageBrier: slices.passed.brier - baseline.passed.brier,
      passedMeanPassageProbability: slices.passed.meanPassageProbability - baseline.passed.meanPassageProbability,
    };
    const checks = candidate === 'normal-v1' ? null : {
      minimumEvents: slices.all.events >= 150,
      minimumFailures: slices.failed.events >= 5,
      minimumOverallBrierImprovement: deltas.passageBrier <= -0.001,
      minimumOverallLogLossImprovement: deltas.passageLogLoss <= -0.005,
      minimumFailedBrierImprovement: deltas.failedPassageBrier <= -0.02,
      minimumFailedMeanProbabilityReduction: deltas.failedMeanPassageProbability <= -0.02,
      maximumPassedBrierDegradation: deltas.passedPassageBrier <= 0.002,
      minimumAccuracyDelta: deltas.passageAccuracy >= -0.01,
    };
    return [candidate, { slices, deltas, checks, passes: checks ? Object.values(checks).every(Boolean) : true }];
  }));

  const eligible = PASSAGE_TAIL_CANDIDATES
    .filter((candidate) => candidate !== 'normal-v1' && (candidates[candidate] as { passes: boolean }).passes)
    .sort((left, right) => {
      const l = candidates[left] as { slices: { all: SliceScore; failed: SliceScore } };
      const r = candidates[right] as { slices: { all: SliceScore; failed: SliceScore } };
      return l.slices.all.brier - r.slices.all.brier
        || l.slices.failed.brier - r.slices.failed.brier
        || left.localeCompare(right);
    });
  const selectedCandidate = eligible[0] ?? null;

  return {
    schemaVersion: PASSAGE_TAIL_RISK_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      runtimeCodeSha: options.codeSha ?? null,
      analysisStatus: 'retrospective-tail-risk-screen' as const,
      probabilityAction: 'none' as const,
      productionAction: 'none' as const,
      runtimeDefaultChange: false,
      modelVersionChange: false,
      memberHistoryHalfLifeDays: PASSAGE_TAIL_RISK_MEMBER_HALF_LIFE_DAYS,
      baselineValidation: { checkedEvents: baselineChecked, maximumAbsoluteProbabilityDifference: maximumBaselineDifference },
      interpretationGuard: 'This screen was designed after rare failure outcomes were already inspected. It may nominate a non-serving candidate for further validation, but it cannot independently justify production promotion.',
    },
    input: { targets: dataset.targets.length, replayableEvents: rows.length },
    primarySlice: {
      key: '2025-2026/house',
      baseline,
      candidates,
      failedEvents: primary.filter((row) => !row.passed),
    },
    decision: {
      selectedCandidate,
      status: selectedCandidate ? 'candidate_for_non_serving_validation' as const : 'no_candidate_passed_frozen_guardrails' as const,
      productionAction: 'none' as const,
    },
  };
}

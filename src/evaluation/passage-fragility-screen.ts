import type { Pool } from 'pg';
import {
  CHAMBER_HISTORICAL_RESIDUAL_SIGMA,
  requiredYesForRule,
} from '../forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import {
  averagePrecision,
  binaryAccuracy,
  brierScore,
  logLoss,
  rocAuc,
} from './metrics';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import { passageProbabilityForTailCandidate } from './passage-tail-risk-screen';

export const PASSAGE_FRAGILITY_SCREEN_SCHEMA = 'passage-fragility-screen-v1' as const;
export const PASSAGE_FRAGILITY_MEMBER_HALF_LIFE_DAYS = 180 as const;
export const PASSAGE_FRAGILITY_HIGH_CONFIDENCE_FLOOR = 0.8 as const;

export type FragilityFeatureKey =
  | 'marginRisk'
  | 'meanEntropy'
  | 'swingShare40to60'
  | 'softYesExpectedShare'
  | 'analogueCoverageGap'
  | 'analogueCountGap'
  | 'analogueWeightRisk'
  | 'partyExpectedYesConcentration';

export const FRAGILITY_FEATURES: readonly FragilityFeatureKey[] = [
  'marginRisk',
  'meanEntropy',
  'swingShare40to60',
  'softYesExpectedShare',
  'analogueCoverageGap',
  'analogueCountGap',
  'analogueWeightRisk',
  'partyExpectedYesConcentration',
] as const;

export type FragilityRiskScoreId = 'margin' | 'softYes' | 'evidence' | 'party' | 'composite';

export const FRAGILITY_RISK_SCORE_FEATURES: Record<FragilityRiskScoreId, readonly FragilityFeatureKey[]> = {
  margin: ['marginRisk'],
  softYes: ['meanEntropy', 'swingShare40to60', 'softYesExpectedShare'],
  evidence: ['analogueCoverageGap', 'analogueCountGap', 'analogueWeightRisk'],
  party: ['partyExpectedYesConcentration'],
  composite: ['marginRisk', 'meanEntropy', 'softYesExpectedShare', 'analogueCoverageGap', 'partyExpectedYesConcentration'],
};

export type FragilityCandidateId =
  | 'composite-top20-normal1.25'
  | 'composite-top10-normal1.5'
  | 'softyes-top20-normal1.25'
  | 'evidence-top20-normal1.25'
  | 'margin-top20-normal1.25'
  | 'party-top20-normal1.25';

interface FragilityCandidateDefinition {
  id: FragilityCandidateId;
  riskScore: FragilityRiskScoreId;
  riskPercentileFloor: number;
  sigmaMultiplier: 1.25 | 1.5;
}

export const FRAGILITY_CANDIDATES: readonly FragilityCandidateDefinition[] = [
  { id: 'composite-top20-normal1.25', riskScore: 'composite', riskPercentileFloor: 0.8, sigmaMultiplier: 1.25 },
  { id: 'composite-top10-normal1.5', riskScore: 'composite', riskPercentileFloor: 0.9, sigmaMultiplier: 1.5 },
  { id: 'softyes-top20-normal1.25', riskScore: 'softYes', riskPercentileFloor: 0.8, sigmaMultiplier: 1.25 },
  { id: 'evidence-top20-normal1.25', riskScore: 'evidence', riskPercentileFloor: 0.8, sigmaMultiplier: 1.25 },
  { id: 'margin-top20-normal1.25', riskScore: 'margin', riskPercentileFloor: 0.8, sigmaMultiplier: 1.25 },
  { id: 'party-top20-normal1.25', riskScore: 'party', riskPercentileFloor: 0.8, sigmaMultiplier: 1.25 },
] as const;

export interface PassageFragilityFeatureInput {
  members: readonly {
    probability: number;
    party: string;
    analogueEffectiveWeight: number;
  }[];
  expectedYes: number;
  requiredYes: number;
  directAnalogueMembers: number;
  activeMembers: number;
  selectedAnalogues: number;
}

export interface PassageFragilityFeatures extends Record<FragilityFeatureKey, number> {}

function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function binaryEntropy(probability: number): number {
  if (probability <= 0 || probability >= 1) return 0;
  return -(probability * Math.log(probability) + (1 - probability) * Math.log(1 - probability)) / Math.log(2);
}

export function passageFragilityFeatures(input: PassageFragilityFeatureInput): PassageFragilityFeatures {
  if (input.members.length === 0 || input.activeMembers <= 0) throw new Error('Passage fragility features require active members');
  const probabilities = input.members.map((member) => member.probability);
  if (probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('Passage fragility probabilities must be between 0 and 1');
  }
  const expectedYes = input.expectedYes;
  const partyExpectedYes = new Map<string, number>();
  for (const member of input.members) {
    partyExpectedYes.set(member.party, (partyExpectedYes.get(member.party) ?? 0) + member.probability);
  }
  const partyExpectedYesConcentration = expectedYes > 0
    ? [...partyExpectedYes.values()].reduce((sum, value) => sum + (value / expectedYes) ** 2, 0)
    : 1;
  const softYesExpected = input.members
    .filter((member) => member.probability >= 0.5 && member.probability <= 0.75)
    .reduce((sum, member) => sum + member.probability, 0);
  const averageAnalogueWeight = mean(input.members.map((member) => member.analogueEffectiveWeight));

  return {
    marginRisk: (input.requiredYes - expectedYes) / CHAMBER_HISTORICAL_RESIDUAL_SIGMA,
    meanEntropy: mean(probabilities.map(binaryEntropy)),
    swingShare40to60: probabilities.filter((probability) => probability >= 0.4 && probability <= 0.6).length / probabilities.length,
    softYesExpectedShare: expectedYes > 0 ? softYesExpected / expectedYes : 0,
    analogueCoverageGap: 1 - Math.min(1, Math.max(0, input.directAnalogueMembers / input.activeMembers)),
    analogueCountGap: 1 - Math.min(1, Math.max(0, input.selectedAnalogues / 10)),
    analogueWeightRisk: 1 / (1 + Math.max(0, averageAnalogueWeight)),
    partyExpectedYesConcentration,
  };
}

interface FragilityRow {
  voteEventId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  passed: boolean;
  baselinePassageProbability: number;
  memberProbabilities: number[];
  features: PassageFragilityFeatures;
  featurePercentiles: Record<FragilityFeatureKey, number>;
  riskScores: Record<FragilityRiskScoreId, number>;
  riskPercentiles: Record<FragilityRiskScoreId, number>;
}

interface PassageSliceScore {
  events: number;
  passed: number;
  failed: number;
  meanPassageProbability: number;
  brier: number;
  logLoss: number;
  accuracy: number;
}

function percentileMap(rows: readonly { id: string; value: number }[]): Map<string, number> {
  const sorted = [...rows].sort((left, right) => left.value - right.value || left.id.localeCompare(right.id));
  const result = new Map<string, number>();
  if (sorted.length === 1) {
    result.set(sorted[0].id, 0.5);
    return result;
  }
  let offset = 0;
  while (offset < sorted.length) {
    let end = offset + 1;
    while (end < sorted.length && sorted[end].value === sorted[offset].value) end += 1;
    const midpoint = ((offset + end - 1) / 2) / (sorted.length - 1);
    for (let index = offset; index < end; index += 1) result.set(sorted[index].id, midpoint);
    offset = end;
  }
  return result;
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

function signalStats(rows: readonly FragilityRow[], values: (row: FragilityRow) => number, risks: (row: FragilityRow) => number) {
  const passed = rows.filter((row) => row.passed);
  const failed = rows.filter((row) => !row.passed);
  const passedValues = passed.map(values);
  const failedValues = failed.map(values);
  const pooledSd = Math.sqrt((variance(passedValues) + variance(failedValues)) / 2);
  const forecasts = rows.map((row) => ({ probability: risks(row), outcome: row.passed ? 0 as const : 1 as const }));
  return {
    events: rows.length,
    passed: passed.length,
    failed: failed.length,
    passedMean: passedValues.length ? mean(passedValues) : null,
    failedMean: failedValues.length ? mean(failedValues) : null,
    standardizedMeanDifference: passedValues.length && failedValues.length && pooledSd > 0
      ? (mean(failedValues) - mean(passedValues)) / pooledSd
      : null,
    failureRocAuc: passed.length && failed.length ? rocAuc(forecasts) : null,
    failureAveragePrecision: failed.length ? averagePrecision(forecasts) : null,
  };
}

function scorePassage(rows: readonly FragilityRow[], probability: (row: FragilityRow) => number): PassageSliceScore {
  const forecasts = rows.map((row) => ({ probability: probability(row), outcome: row.passed ? 1 as const : 0 as const }));
  return {
    events: rows.length,
    passed: rows.filter((row) => row.passed).length,
    failed: rows.filter((row) => !row.passed).length,
    meanPassageProbability: mean(forecasts.map((row) => row.probability)),
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    accuracy: binaryAccuracy(forecasts),
  };
}

function passageSlices(rows: readonly FragilityRow[], probability: (row: FragilityRow) => number) {
  return {
    all: scorePassage(rows, probability),
    passed: scorePassage(rows.filter((row) => row.passed), probability),
    failed: scorePassage(rows.filter((row) => !row.passed), probability),
  };
}

function candidateProbability(row: FragilityRow, definition: FragilityCandidateDefinition): number {
  if (row.riskPercentiles[definition.riskScore] < definition.riskPercentileFloor) return row.baselinePassageProbability;
  const candidate = definition.sigmaMultiplier === 1.5 ? 'normal-sigma-1.5x' : 'normal-sigma-1.25x';
  return passageProbabilityForTailCandidate(
    row.memberProbabilities,
    ordinaryMinnesotaPassageRule(row.chamber),
    candidate,
  );
}

export async function evaluatePassageFragilityScreen(pool: Pool, options: { codeSha?: string | null } = {}) {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const replay = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    PASSAGE_FRAGILITY_MEMBER_HALF_LIFE_DAYS,
  );

  let baselineChecked = 0;
  let maximumBaselineDifference = 0;
  const allRows: FragilityRow[] = [];
  for (const row of replay) {
    if (row.status !== 'replayable' || row.passageProbability === undefined || row.expectedYes === undefined) continue;
    const probabilities = row.memberPredictions.map((member) => member.yesProbability);
    if (probabilities.some((value) => value === undefined)) continue;
    const memberProbabilities = probabilities as number[];
    const rule = ordinaryMinnesotaPassageRule(row.chamber);
    const requiredYes = requiredYesForRule(rule, memberProbabilities.length);
    const baseline = passageProbabilityForTailCandidate(memberProbabilities, rule, 'normal-v1');
    const difference = Math.abs(baseline - row.passageProbability);
    maximumBaselineDifference = Math.max(maximumBaselineDifference, difference);
    baselineChecked += 1;
    if (difference > 1e-12) throw new Error(`Passage fragility control drift ${difference} for ${row.voteEventId}`);
    allRows.push({
      voteEventId: row.voteEventId,
      session: row.session,
      chamber: row.chamber,
      occurredOn: row.occurredOn,
      passed: row.passed,
      baselinePassageProbability: row.passageProbability,
      memberProbabilities,
      features: passageFragilityFeatures({
        members: row.memberPredictions.map((member) => ({
          probability: member.yesProbability as number,
          party: member.party,
          analogueEffectiveWeight: member.analogueEffectiveWeight,
        })),
        expectedYes: row.expectedYes,
        requiredYes,
        directAnalogueMembers: row.directAnalogueMembers,
        activeMembers: row.activeMembers,
        selectedAnalogues: row.selectedAnalogues,
      }),
      featurePercentiles: {} as Record<FragilityFeatureKey, number>,
      riskScores: {} as Record<FragilityRiskScoreId, number>,
      riskPercentiles: {} as Record<FragilityRiskScoreId, number>,
    });
  }

  const primary = allRows.filter((row) => row.session === '2025-2026' && row.chamber === 'house');
  if (primary.length < 150) throw new Error('Primary 2025-2026 House fragility slice is too small');
  if (primary.filter((row) => !row.passed).length < 5) throw new Error('Primary fragility slice has too few passage failures');

  for (const feature of FRAGILITY_FEATURES) {
    const ranks = percentileMap(primary.map((row) => ({ id: row.voteEventId, value: row.features[feature] })));
    for (const row of primary) row.featurePercentiles[feature] = ranks.get(row.voteEventId) ?? 0.5;
  }
  for (const scoreId of Object.keys(FRAGILITY_RISK_SCORE_FEATURES) as FragilityRiskScoreId[]) {
    const components = FRAGILITY_RISK_SCORE_FEATURES[scoreId];
    for (const row of primary) {
      row.riskScores[scoreId] = mean(components.map((feature) => row.featurePercentiles[feature]));
    }
    const ranks = percentileMap(primary.map((row) => ({ id: row.voteEventId, value: row.riskScores[scoreId] })));
    for (const row of primary) row.riskPercentiles[scoreId] = ranks.get(row.voteEventId) ?? 0.5;
  }

  const highConfidence = primary.filter((row) => row.baselinePassageProbability >= PASSAGE_FRAGILITY_HIGH_CONFIDENCE_FLOOR);
  const featureSignals = Object.fromEntries(FRAGILITY_FEATURES.map((feature) => [feature, {
    all: signalStats(primary, (row) => row.features[feature], (row) => row.featurePercentiles[feature]),
    highConfidence: signalStats(highConfidence, (row) => row.features[feature], (row) => row.featurePercentiles[feature]),
  }]));
  const riskScoreSignals = Object.fromEntries((Object.keys(FRAGILITY_RISK_SCORE_FEATURES) as FragilityRiskScoreId[]).map((scoreId) => [scoreId, {
    all: signalStats(primary, (row) => row.riskScores[scoreId], (row) => row.riskPercentiles[scoreId]),
    highConfidence: signalStats(highConfidence, (row) => row.riskScores[scoreId], (row) => row.riskPercentiles[scoreId]),
  }]));

  const baseline = passageSlices(primary, (row) => row.baselinePassageProbability);
  const candidateScores = Object.fromEntries(FRAGILITY_CANDIDATES.map((definition) => {
    const probability = (row: FragilityRow) => candidateProbability(row, definition);
    const slices = passageSlices(primary, probability);
    const flagged = primary.filter((row) => row.riskPercentiles[definition.riskScore] >= definition.riskPercentileFloor);
    const flaggedFailures = flagged.filter((row) => !row.passed).length;
    const totalFailures = baseline.failed.events;
    const deltas = {
      passageBrier: slices.all.brier - baseline.all.brier,
      passageLogLoss: slices.all.logLoss - baseline.all.logLoss,
      passageAccuracy: slices.all.accuracy - baseline.all.accuracy,
      failedPassageBrier: slices.failed.brier - baseline.failed.brier,
      failedMeanPassageProbability: slices.failed.meanPassageProbability - baseline.failed.meanPassageProbability,
      passedPassageBrier: slices.passed.brier - baseline.passed.brier,
      passedMeanPassageProbability: slices.passed.meanPassageProbability - baseline.passed.meanPassageProbability,
    };
    const flagRate = flagged.length / primary.length;
    const failureCaptureRate = totalFailures > 0 ? flaggedFailures / totalFailures : 0;
    const checks = {
      minimumEvents: slices.all.events >= 150,
      minimumFailures: slices.failed.events >= 5,
      minimumFlagRate: flagRate >= 0.05,
      maximumFlagRate: flagRate <= 0.30,
      minimumFailureCaptureRate: failureCaptureRate >= 0.30,
      minimumOverallBrierImprovement: deltas.passageBrier <= -0.0005,
      minimumOverallLogLossImprovement: deltas.passageLogLoss <= -0.001,
      minimumFailedBrierImprovement: deltas.failedPassageBrier <= -0.02,
      minimumFailedMeanProbabilityReduction: deltas.failedMeanPassageProbability <= -0.02,
      maximumPassedBrierDegradation: deltas.passedPassageBrier <= 0.001,
      minimumAccuracyDelta: deltas.passageAccuracy >= -0.01,
    };
    return [definition.id, {
      definition,
      flaggedEvents: flagged.length,
      flaggedFailures,
      flagRate,
      failureCaptureRate,
      slices,
      deltas,
      checks,
      passes: Object.values(checks).every(Boolean),
    }];
  }));

  const eligible = FRAGILITY_CANDIDATES
    .filter((definition) => (candidateScores[definition.id] as { passes: boolean }).passes)
    .sort((left, right) => {
      const l = candidateScores[left.id] as { slices: { all: PassageSliceScore; failed: PassageSliceScore } };
      const r = candidateScores[right.id] as { slices: { all: PassageSliceScore; failed: PassageSliceScore } };
      return l.slices.all.brier - r.slices.all.brier
        || l.slices.all.logLoss - r.slices.all.logLoss
        || l.slices.failed.brier - r.slices.failed.brier
        || left.id.localeCompare(right.id);
    });
  const selectedCandidate = eligible[0]?.id ?? null;

  return {
    schemaVersion: PASSAGE_FRAGILITY_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      runtimeCodeSha: options.codeSha ?? null,
      analysisStatus: 'retrospective-pre-vote-fragility-screen' as const,
      probabilityAction: 'none' as const,
      productionAction: 'none' as const,
      runtimeDefaultChange: false,
      modelVersionChange: false,
      memberHistoryHalfLifeDays: PASSAGE_FRAGILITY_MEMBER_HALF_LIFE_DAYS,
      featureSource: 'strictly pre-vote replay state; feature extractor accepts no outcome fields' as const,
      baselineValidation: { checkedEvents: baselineChecked, maximumAbsoluteProbabilityDifference: maximumBaselineDifference },
      interpretationGuard: 'The nine rare failures were known before this feature screen was designed. Any nominated signal is retrospective discovery only and may enter only a future non-serving prospective shadow before any production review.',
    },
    input: {
      targets: dataset.targets.length,
      replayableEvents: allRows.length,
    },
    primarySlice: {
      key: '2025-2026/house',
      events: primary.length,
      failedEvents: primary.filter((row) => !row.passed).length,
      highConfidenceEvents: highConfidence.length,
      highConfidenceFailures: highConfidence.filter((row) => !row.passed).length,
      baseline,
      featureSignals,
      riskScoreSignals,
      candidates: candidateScores,
      failedEventCharacteristics: primary.filter((row) => !row.passed).map((row) => ({
        voteEventId: row.voteEventId,
        occurredOn: row.occurredOn,
        baselinePassageProbability: row.baselinePassageProbability,
        features: row.features,
        featurePercentiles: row.featurePercentiles,
        riskScores: row.riskScores,
        riskPercentiles: row.riskPercentiles,
      })),
    },
    decision: {
      selectedCandidate,
      status: selectedCandidate ? 'candidate_for_future_non_serving_shadow' as const : 'no_candidate_passed_frozen_guardrails' as const,
      productionAction: 'none' as const,
    },
  };
}

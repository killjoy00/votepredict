import type { Pool } from 'pg';
import { simulateChamber } from '@/forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '@/forecasting/minnesota-rules';
import { QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA } from '@/forecasting/quick-evidence-shadow';
import {
  QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
  type QuickEvidenceCommitteeRollcallFeatureName,
} from './quick-evidence-committee-rollcall-extractor';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import {
  scoreHistoricalQuickReplay,
  type HistoricalQuickReplayEventResult,
  type HistoricalQuickReplayScorecard,
} from './historical-quick-replay';

export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SCREEN_INPUT_SCHEMA =
  'quick-evidence-committee-rollcall-screen-input-v1' as const;
export const QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SCREEN_SCHEMA =
  'quick-evidence-committee-rollcall-screen-v1' as const;

const HALF_LIFE_DAYS = 180;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
const TRAIN_SESSION = '2021-2022' as const;
const VALIDATION_SESSION = '2023-2024' as const;
const DESCRIPTIVE_SESSION = '2025-2026' as const;
type SessionSlug = typeof TRAIN_SESSION | typeof VALIDATION_SESSION | typeof DESCRIPTIVE_SESSION;

export interface QuickEvidenceCommitteeRollcallScreenInputRow {
  voteEventId: string;
  membershipId: string;
  baseProbability?: number;
  features: number[];
}

export interface QuickEvidenceCommitteeRollcallScreenInput {
  schemaVersion: typeof QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SCREEN_INPUT_SCHEMA;
  candidateArtifact: {
    workflowRunId: number;
    headSha: string;
    artifactId: number;
    digest: string;
  };
  featureNames: QuickEvidenceCommitteeRollcallFeatureName[];
  candidateSummary: {
    observations: number;
    memberEventPairsWithFeatures: number;
    eventsWithFeatures: number;
    bySession: Record<string, {
      observations: number;
      memberEventPairsWithFeatures: number;
      eventsWithFeatures: number;
    }>;
  };
  featureRows: QuickEvidenceCommitteeRollcallScreenInputRow[];
}

type ScreenObservation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  features: number[];
};

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
}

function logit(probability: number): number {
  const p = clampProbability(probability);
  return Math.log(p / (1 - p));
}

function logistic(value: number): number {
  return clampProbability(1 / (1 + Math.exp(-value)));
}

function sameFeatureNames(value: readonly string[]): boolean {
  return value.length === QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length
    && value.every((name, index) => name === QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES[index]);
}

function validatedFeatureVector(values: readonly number[]): number[] {
  if (values.length !== QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length) {
    throw new Error(`Committee roll-call feature vector has ${values.length} values; expected ${QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length}`);
  }
  return values.map((value, index) => {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error(`Committee roll-call feature ${QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES[index]} must be a non-negative integer`);
    }
    return Math.log1p(value);
  });
}

function anyFeature(vector: readonly number[]): boolean {
  return vector.some((value) => value > 0);
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return Array.from({ length: size }, () => 0);
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let entry = column; entry <= size; entry += 1) augmented[column][entry] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry += 1) augmented[row][entry] -= factor * augmented[column][entry];
    }
  }
  return augmented.map((row) => row[size]);
}

function fitOffsetRidge(observations: readonly ScreenObservation[], lambda: number): number[] {
  const size = QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length;
  let beta = Array.from({ length: size }, () => 0);
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const gradient = Array.from({ length: size }, () => 0);
    const information = Array.from(
      { length: size },
      (_, row) => Array.from({ length: size }, (_, column) => row === column ? lambda : 0),
    );
    for (const observation of observations) {
      const eta = logit(observation.baseProbability)
        + observation.features.reduce((sum, value, index) => sum + value * beta[index], 0);
      const probability = logistic(eta);
      const weight = Math.max(1e-8, probability * (1 - probability));
      const residual = observation.outcome - probability;
      for (let row = 0; row < size; row += 1) {
        gradient[row] += observation.features[row] * residual - lambda * beta[row] / observations.length;
        for (let column = 0; column < size; column += 1) {
          information[row][column] += observation.features[row] * observation.features[column] * weight;
        }
      }
    }
    const step = solveLinearSystem(information, gradient);
    beta = beta.map((value, index) => value + step[index]);
    if (Math.max(...step.map(Math.abs)) < 1e-7) break;
  }
  return beta;
}

function applyOffset(baseProbability: number, features: readonly number[], beta: readonly number[]): number {
  const uncapped = features.reduce((sum, value, index) => sum + value * beta[index], 0);
  const delta = Math.max(
    -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
    Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, uncapped),
  );
  return logistic(logit(baseProbability) + delta);
}

function scoreBySession(events: readonly HistoricalQuickReplayEventResult[], session: SessionSlug): HistoricalQuickReplayScorecard {
  return scoreHistoricalQuickReplay(events.filter((event) => event.session === session)).overall;
}

function scoreDelta(candidate: HistoricalQuickReplayScorecard, baseline: HistoricalQuickReplayScorecard) {
  return {
    memberBrier: candidate.memberBrier - baseline.memberBrier,
    memberLogLoss: candidate.memberLogLoss - baseline.memberLogLoss,
    memberExpectedCalibrationError: candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError: candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

function adjustReplay(
  baseline: readonly HistoricalQuickReplayEventResult[],
  featuresByPair: ReadonlyMap<string, number[]>,
  beta: readonly number[],
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    const memberPredictions = event.memberPredictions.map((member) => {
      const features = featuresByPair.get(`${event.voteEventId}|${member.membershipId}`);
      if (!features || !anyFeature(features) || member.yesProbability === undefined) return member;
      return {
        ...member,
        yesProbability: applyOffset(member.yesProbability, features, beta),
      };
    });
    if (event.status !== 'replayable' || memberPredictions.some((member) => member.yesProbability === undefined)) {
      return { ...event, memberPredictions };
    }
    const chamber = simulateChamber(
      memberPredictions.map((member) => member.yesProbability as number),
      ordinaryMinnesotaPassageRule(event.chamber),
    );
    return {
      ...event,
      memberPredictions,
      passageProbability: chamber.passageProbability,
      expectedYes: chamber.expectedYes,
      yesLow: chamber.yesLow,
      yesHigh: chamber.yesHigh,
    };
  });
}

function sessionCoverage(observations: readonly ScreenObservation[], session: SessionSlug) {
  const rows = observations.filter((row) => row.session === session);
  const withFeatures = rows.filter((row) => anyFeature(row.features));
  return {
    memberOutcomes: rows.length,
    memberOutcomesWithFeature: withFeatures.length,
    eventsWithFeature: new Set(withFeatures.map((row) => row.eventId)).size,
    coverage: rows.length > 0 ? withFeatures.length / rows.length : 0,
  };
}

function coefficientObject(beta: readonly number[]) {
  return Object.fromEntries(
    QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.map((name, index) => [name, beta[index]]),
  );
}

export async function evaluateQuickEvidenceCommitteeRollcallScreen(
  pool: Pool,
  input: QuickEvidenceCommitteeRollcallScreenInput,
  options: { codeSha?: string | null } = {},
) {
  if (input.schemaVersion !== QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SCREEN_INPUT_SCHEMA) {
    throw new Error(`Unsupported committee roll-call screen input schema: ${String(input.schemaVersion)}`);
  }
  if (!sameFeatureNames(input.featureNames)) {
    throw new Error('Committee roll-call screen input feature ordering does not match the frozen plan');
  }
  if (!input.candidateArtifact.digest.startsWith('sha256:')) {
    throw new Error('Committee roll-call candidate artifact digest must be a SHA-256 digest');
  }

  const featuresByPair = new Map<string, number[]>();
  for (const row of input.featureRows) {
    const key = `${row.voteEventId}|${row.membershipId}`;
    if (featuresByPair.has(key)) throw new Error(`Duplicate committee roll-call feature row: ${key}`);
    featuresByPair.set(key, validatedFeatureVector(row.features));
  }
  if (featuresByPair.size !== input.candidateSummary.memberEventPairsWithFeatures) {
    throw new Error(
      `Committee roll-call compact input has ${featuresByPair.size} feature rows; expected ${input.candidateSummary.memberEventPairsWithFeatures}`,
    );
  }

  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const fullBaseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  );
  const baseline = fullBaseline.filter((event) =>
    event.chamber === 'house'
    && [TRAIN_SESSION, VALIDATION_SESSION, DESCRIPTIVE_SESSION].includes(event.session as SessionSlug));

  const baselinePairKeys = new Set<string>();
  const observations: ScreenObservation[] = [];
  for (const event of baseline) {
    for (const member of event.memberPredictions) {
      const key = `${event.voteEventId}|${member.membershipId}`;
      baselinePairKeys.add(key);
      if (member.yesProbability === undefined || member.actualOutcome === undefined) continue;
      observations.push({
        eventId: event.voteEventId,
        membershipId: member.membershipId,
        session: event.session as SessionSlug,
        baseProbability: member.yesProbability,
        outcome: member.actualOutcome,
        features: featuresByPair.get(key)
          ?? Array.from({ length: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length }, () => 0),
      });
    }
  }
  const unknownFeatureRows = [...featuresByPair.keys()].filter((key) => !baselinePairKeys.has(key));
  if (unknownFeatureRows.length > 0) {
    throw new Error(`Committee roll-call feature rows no longer resolve to historical Quick: ${unknownFeatureRows.slice(0, 5).join(', ')}`);
  }

  const coverage = {
    training: sessionCoverage(observations, TRAIN_SESSION),
    validation: sessionCoverage(observations, VALIDATION_SESSION),
    descriptiveTest: sessionCoverage(observations, DESCRIPTIVE_SESSION),
  };
  const coverageGate = {
    minimumTrainingMemberOutcomesWithFeature: 500,
    minimumValidationMemberOutcomesWithFeature: 500,
    minimumTrainingEventsWithFeature: 20,
    minimumValidationEventsWithFeature: 20,
    passed: coverage.training.memberOutcomesWithFeature >= 500
      && coverage.validation.memberOutcomesWithFeature >= 500
      && coverage.training.eventsWithFeature >= 20
      && coverage.validation.eventsWithFeature >= 20,
  };

  const baselineScores = {
    training: scoreBySession(baseline, TRAIN_SESSION),
    validation: scoreBySession(baseline, VALIDATION_SESSION),
    descriptiveTest: scoreBySession(baseline, DESCRIPTIVE_SESSION),
  };

  const common = {
    schemaVersion: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'frozen retrospective diagnostic for broad exact-bill named-member Minnesota House committee roll calls as a zero-weight component of quick-evidence-v1',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      quickEvidenceCandidate: 'quick-evidence-v1',
      sourcePlan: 'quick-evidence-committee-rollcall-screen-plan-v1',
      parser: 'deterministic-house-committee-roll-call-v2',
      mechanicsPolicy: 'mn-house-procedural-mechanics-v1',
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      trainSession: TRAIN_SESSION,
      validationSession: VALIDATION_SESSION,
      descriptiveSession: DESCRIPTIVE_SESSION,
      chamber: 'house',
      featureNames: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
      maximumAbsoluteLogitDelta: QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
      productionAction: 'none',
      servingQuickChanged: false,
      automaticPromotion: false,
      candidateArtifact: input.candidateArtifact,
      candidateSummary: input.candidateSummary,
    },
    coverage,
    coverageGate,
  };

  if (!coverageGate.passed) {
    return {
      ...common,
      candidates: [],
      selected: null,
      conclusion: {
        productionAction: 'none',
        servingQuickChanged: false,
        quickEvidenceWeightChanged: false,
        hypothesisSignal: false,
        reason: 'coverage_gate_failed',
        note: 'The frozen coverage gate failed, so no committee roll-call predictive fit was attempted.',
      },
    };
  }

  const training = observations.filter((row) => row.session === TRAIN_SESSION);
  const candidateFits = LAMBDAS.map((lambda) => {
    const beta = fitOffsetRidge(training, lambda);
    const replay = adjustReplay(baseline, featuresByPair, beta);
    const validationScore = scoreBySession(replay, VALIDATION_SESSION);
    return {
      lambda,
      beta,
      replay,
      validationScore,
      validationDelta: scoreDelta(validationScore, baselineScores.validation),
    };
  }).sort((left, right) => left.validationScore.memberBrier - right.validationScore.memberBrier
    || left.validationScore.memberLogLoss - right.validationScore.memberLogLoss
    || left.validationScore.chamberMeanAbsoluteYesError - right.validationScore.chamberMeanAbsoluteYesError
    || left.lambda - right.lambda);

  const selected = candidateFits[0];
  const candidateScores = {
    training: scoreBySession(selected.replay, TRAIN_SESSION),
    validation: selected.validationScore,
    descriptiveTest: scoreBySession(selected.replay, DESCRIPTIVE_SESSION),
  };
  const deltas = {
    training: scoreDelta(candidateScores.training, baselineScores.training),
    validation: scoreDelta(candidateScores.validation, baselineScores.validation),
    descriptiveTest: scoreDelta(candidateScores.descriptiveTest, baselineScores.descriptiveTest),
  };
  const hypothesisSignal = deltas.validation.memberBrier <= -0.0005
    && deltas.validation.memberLogLoss <= 0
    && deltas.validation.chamberMeanAbsoluteYesError <= 0.25
    && deltas.validation.passageBrier <= 0.002
    && deltas.descriptiveTest.memberBrier <= 0.0005;

  return {
    ...common,
    candidates: candidateFits.map((candidate) => ({
      lambda: candidate.lambda,
      beta: coefficientObject(candidate.beta),
      validation: candidate.validationScore,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: coefficientObject(selected.beta),
      baseline: baselineScores,
      candidate: candidateScores,
      deltaCandidateMinusBaseline: deltas,
    },
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      quickEvidenceWeightChanged: false,
      hypothesisSignal,
      reason: hypothesisSignal ? 'frozen_thresholds_cleared' : 'frozen_thresholds_not_cleared',
      note: hypothesisSignal
        ? 'Broad committee roll-call features cleared the frozen historical diagnostic thresholds. This authorizes continued prospective measurement only; it does not change serving Quick or evidence weights.'
        : 'Broad committee roll-call features did not clear every frozen historical diagnostic threshold. Keep them zero-weight/non-serving.',
    },
  };
}

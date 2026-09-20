import type { Pool } from 'pg';
import { simulateChamber } from '@/forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '@/forecasting/minnesota-rules';
import { QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA } from '@/forecasting/quick-evidence-shadow';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import {
  scoreHistoricalQuickReplay,
  type HistoricalQuickReplayEventResult,
  type HistoricalQuickReplayScorecard,
} from './historical-quick-replay';

export const QUICK_EVIDENCE_DISTRICT_CONTEXT_SCREEN_SCHEMA = 'quick-evidence-district-context-screen-v1' as const;
export const QUICK_EVIDENCE_DISTRICT_CONTEXT_FEATURES = [
  'topTwoMarginPct',
  'logTotalVotes',
  'logCandidateCount',
  'uncontested',
] as const;

const HALF_LIFE_DAYS = 180;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';
export type DistrictContextVector = [number, number, number, number];
type Standardization = { mean: DistrictContextVector; scale: DistrictContextVector };

type StoredDistrictContext = {
  membershipId: string;
  session: SessionSlug;
  electionDate: string;
  topTwoMarginPct: number;
  totalVotes: number;
  candidateCount: number;
  uncontested: boolean;
};

type Observation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  features: DistrictContextVector;
};

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
}

function logit(probability: number): number {
  const p = clampProbability(probability);
  return Math.log(p / (1 - p));
}

function logistic(value: number): number {
  if (value >= 0) return clampProbability(1 / (1 + Math.exp(-value)));
  const exp = Math.exp(value);
  return clampProbability(exp / (1 + exp));
}

export function districtContextFeatures(input: {
  topTwoMarginPct: number;
  totalVotes: number;
  candidateCount: number;
  uncontested: boolean;
}): DistrictContextVector {
  return [
    input.topTwoMarginPct,
    Math.log1p(Math.max(0, input.totalVotes)),
    Math.log1p(Math.max(0, input.candidateCount)),
    input.uncontested ? 1 : 0,
  ];
}

export function fitDistrictContextStandardization(vectors: readonly DistrictContextVector[]): Standardization {
  if (vectors.length === 0) throw new Error('Cannot standardize an empty district-context training set');
  const mean = QUICK_EVIDENCE_DISTRICT_CONTEXT_FEATURES.map(
    (_, index) => vectors.reduce((sum, row) => sum + row[index], 0) / vectors.length,
  ) as DistrictContextVector;
  const scale = QUICK_EVIDENCE_DISTRICT_CONTEXT_FEATURES.map((_, index) => {
    const variance = vectors.reduce(
      (sum, row) => sum + (row[index] - mean[index]) ** 2,
      0,
    ) / Math.max(1, vectors.length - 1);
    const sd = Math.sqrt(variance);
    return sd > 1e-9 ? sd : 1;
  }) as DistrictContextVector;
  return { mean, scale };
}

export function standardizeDistrictContext(
  vector: DistrictContextVector,
  standardization: Standardization,
): DistrictContextVector {
  return vector.map(
    (value, index) => (value - standardization.mean[index]) / standardization.scale[index],
  ) as DistrictContextVector;
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
      for (let entry = column; entry <= size; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

export function fitDistrictContextOffsetRidge(
  observations: readonly { baseProbability: number; outcome: 0 | 1; features: DistrictContextVector }[],
  lambda: number,
): DistrictContextVector {
  if (observations.length < 500) {
    throw new Error('District-context training coverage is too small: ' + observations.length);
  }
  let beta: DistrictContextVector = [0, 0, 0, 0];
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const gradient = Array.from({ length: 4 }, () => 0);
    const information = Array.from(
      { length: 4 },
      (_, row) => Array.from({ length: 4 }, (_, column) => row === column ? lambda : 0),
    );
    for (const observation of observations) {
      const eta = logit(observation.baseProbability)
        + observation.features.reduce((sum, value, index) => sum + value * beta[index], 0);
      const probability = logistic(eta);
      const weight = Math.max(1e-8, probability * (1 - probability));
      const residual = observation.outcome - probability;
      for (let row = 0; row < 4; row += 1) {
        gradient[row] += observation.features[row] * residual - lambda * beta[row] / observations.length;
        for (let column = 0; column < 4; column += 1) {
          information[row][column] += observation.features[row] * observation.features[column] * weight;
        }
      }
    }
    const delta = solveLinearSystem(information, gradient);
    beta = beta.map((value, index) => value + delta[index]) as DistrictContextVector;
    if (Math.max(...delta.map(Math.abs)) < 1e-7) break;
  }
  return beta;
}

export function applyDistrictContextOffset(
  baseProbability: number,
  standardizedFeatures: DistrictContextVector,
  beta: DistrictContextVector,
): number {
  const uncapped = standardizedFeatures.reduce((sum, value, index) => sum + value * beta[index], 0);
  const capped = Math.max(
    -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
    Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, uncapped),
  );
  return logistic(logit(baseProbability) + capped);
}

function scoreBySession(
  events: readonly HistoricalQuickReplayEventResult[],
  session: SessionSlug,
): HistoricalQuickReplayScorecard {
  return scoreHistoricalQuickReplay(events.filter((event) => event.session === session)).overall;
}

function delta(candidate: HistoricalQuickReplayScorecard, baseline: HistoricalQuickReplayScorecard) {
  return {
    memberBrier: candidate.memberBrier - baseline.memberBrier,
    memberLogLoss: candidate.memberLogLoss - baseline.memberLogLoss,
    memberExpectedCalibrationError:
      candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError:
      candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

function adjustReplay(
  baseline: readonly HistoricalQuickReplayEventResult[],
  featureByMemberEvent: ReadonlyMap<string, DistrictContextVector>,
  standardization: Standardization,
  beta: DistrictContextVector,
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    const memberPredictions = event.memberPredictions.map((member) => {
      const features = featureByMemberEvent.get(event.voteEventId + '|' + member.membershipId);
      if (!features || member.yesProbability === undefined) return member;
      return {
        ...member,
        yesProbability: applyDistrictContextOffset(
          member.yesProbability,
          standardizeDistrictContext(features, standardization),
          beta,
        ),
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

function numericMetadata(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export async function evaluateQuickEvidenceDistrictContextScreen(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const [dataset, contextResult] = await Promise.all([
    loadHistoricalQuickReplayDataset(pool),
    pool.query<{
      membership_id: string;
      session_slug: SessionSlug;
      metadata: Record<string, unknown>;
    }>(`
      SELECT DISTINCT ON (ei.membership_id)
             ei.membership_id::text,
             s.slug AS session_slug,
             ei.metadata
        FROM evidence_items ei
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
       WHERE ei.metadata->>'subtype'='district_election_context'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       ORDER BY ei.membership_id,ei.created_at DESC,ei.id DESC
    `),
  ]);

  const contextByMembership = new Map<string, StoredDistrictContext>();
  for (const row of contextResult.rows) {
    const margin = numericMetadata(row.metadata.topTwoMarginPct);
    const totalVotes = numericMetadata(row.metadata.totalVotes);
    const candidateCount = numericMetadata(row.metadata.candidateCount);
    const electionDate = typeof row.metadata.electionDate === 'string' ? row.metadata.electionDate : undefined;
    const uncontested = row.metadata.uncontested === true || row.metadata.uncontested === 'true';
    if (
      margin === undefined
      || totalVotes === undefined
      || candidateCount === undefined
      || !electionDate
    ) continue;
    contextByMembership.set(row.membership_id, {
      membershipId: row.membership_id,
      session: row.session_slug,
      electionDate,
      topTwoMarginPct: margin,
      totalVotes,
      candidateCount,
      uncontested,
    });
  }

  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  );

  const featureByMemberEvent = new Map<string, DistrictContextVector>();
  const observations: Observation[] = [];
  for (const event of baseline) {
    if (!['2021-2022', '2023-2024', '2025-2026'].includes(event.session)) continue;
    for (const member of event.memberPredictions) {
      const context = contextByMembership.get(member.membershipId);
      if (!context || context.session !== event.session || context.electionDate >= event.occurredOn) continue;
      const features = districtContextFeatures(context);
      featureByMemberEvent.set(event.voteEventId + '|' + member.membershipId, features);
      if (member.yesProbability === undefined || member.actualOutcome === undefined) continue;
      observations.push({
        eventId: event.voteEventId,
        membershipId: member.membershipId,
        session: event.session as SessionSlug,
        baseProbability: member.yesProbability,
        outcome: member.actualOutcome,
        features,
      });
    }
  }

  const training = observations.filter((row) => row.session === '2021-2022');
  const validation = observations.filter((row) => row.session === '2023-2024');
  const descriptiveTest = observations.filter((row) => row.session === '2025-2026');
  if (training.length < 500 || validation.length < 500) {
    throw new Error(
      'Insufficient district-context coverage: train=' + training.length + ', validation=' + validation.length,
    );
  }

  const standardization = fitDistrictContextStandardization(training.map((row) => row.features));
  const standardizedTraining = training.map((row) => ({
    baseProbability: row.baseProbability,
    outcome: row.outcome,
    features: standardizeDistrictContext(row.features, standardization),
  }));

  const baselineScores = {
    training: scoreBySession(baseline, '2021-2022'),
    validation: scoreBySession(baseline, '2023-2024'),
    descriptiveTest: scoreBySession(baseline, '2025-2026'),
  };

  const candidates = LAMBDAS.map((lambda) => {
    const beta = fitDistrictContextOffsetRidge(standardizedTraining, lambda);
    const replay = adjustReplay(baseline, featureByMemberEvent, standardization, beta);
    const validationScore = scoreBySession(replay, '2023-2024');
    return {
      lambda,
      beta,
      validationScore,
      validationDelta: delta(validationScore, baselineScores.validation),
      replay,
    };
  }).sort((left, right) =>
    left.validationScore.memberBrier - right.validationScore.memberBrier
    || left.validationScore.memberLogLoss - right.validationScore.memberLogLoss
    || left.validationScore.chamberMeanAbsoluteYesError - right.validationScore.chamberMeanAbsoluteYesError
    || left.lambda - right.lambda);

  const selected = candidates[0];
  const candidateScores = {
    training: scoreBySession(selected.replay, '2021-2022'),
    validation: selected.validationScore,
    descriptiveTest: scoreBySession(selected.replay, '2025-2026'),
  };
  const validationDelta = delta(candidateScores.validation, baselineScores.validation);
  const hypothesisSignal = validationDelta.memberBrier <= -0.0005
    && validationDelta.memberLogLoss <= 0
    && validationDelta.chamberMeanAbsoluteYesError <= 0.25
    && validationDelta.passageBrier <= 0.002;

  const coverage = (session: SessionSlug) => {
    const rows = observations.filter((row) => row.session === session);
    const totalOutcomes = baseline
      .filter((event) => event.session === session)
      .flatMap((event) => event.memberPredictions)
      .filter((member) => member.yesProbability !== undefined && member.actualOutcome !== undefined).length;
    return {
      districtContextMemberOutcomes: rows.length,
      totalQuickMemberOutcomes: totalOutcomes,
      districtContextCoverage: totalOutcomes > 0 ? rows.length / totalOutcomes : 0,
      eventsWithDistrictContext: new Set(rows.map((row) => row.eventId)).size,
      membershipsWithDistrictContext: new Set(rows.map((row) => row.membershipId)).size,
    };
  };

  return {
    schemaVersion: QUICK_EVIDENCE_DISTRICT_CONTEXT_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'frozen retrospective component diagnostic for prior-general-election district context as a non-directional offset to serving Quick member probabilities',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      quickEvidenceCandidate: 'quick-evidence-v1',
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      trainSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      featureNames: QUICK_EVIDENCE_DISTRICT_CONTEXT_FEATURES,
      candidateLambdas: LAMBDAS,
      sourceBoundary: 'official Minnesota Secretary of State prior-general-election district totals only; candidate identity, party, endorsements, donor data, and inferred ideology are excluded',
      timingBoundary: 'electionDate must be strictly before each target floor-vote date',
      selectionGuard: 'lambda selected on 2023-2024 only; 2025-2026 is descriptive and cannot select configuration or change hypothesisSignal',
      probabilityWrite: false,
      productionAction: 'none',
      servingQuickChanged: false,
    },
    sourceCoverage: {
      membershipsWithStoredContext: contextByMembership.size,
    },
    coverage: {
      training: coverage('2021-2022'),
      validation: coverage('2023-2024'),
      descriptiveTest: coverage('2025-2026'),
    },
    standardization,
    candidates: candidates.map((candidate) => ({
      lambda: candidate.lambda,
      beta: Object.fromEntries(
        QUICK_EVIDENCE_DISTRICT_CONTEXT_FEATURES.map((name, index) => [name, candidate.beta[index]]),
      ),
      validation: candidate.validationScore,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: Object.fromEntries(
        QUICK_EVIDENCE_DISTRICT_CONTEXT_FEATURES.map((name, index) => [name, selected.beta[index]]),
      ),
      baseline: baselineScores,
      candidate: candidateScores,
      deltaCandidateMinusBaseline: {
        training: delta(candidateScores.training, baselineScores.training),
        validation: validationDelta,
        descriptiveTest: delta(candidateScores.descriptiveTest, baselineScores.descriptiveTest),
      },
    },
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      quickEvidenceWeightChanged: false,
      hypothesisSignal,
      note: hypothesisSignal
        ? 'The frozen validation screen shows incremental district-context signal worth continued prospective measurement, but it does not authorize any serving or frozen-weight change.'
        : 'The district-context component does not clear the frozen validation thresholds. Keep district context at zero weight inside quick-evidence-v1.',
    },
  };
}

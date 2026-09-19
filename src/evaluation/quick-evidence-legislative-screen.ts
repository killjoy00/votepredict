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
  type QuickReplayEvent,
} from './historical-quick-replay';

export const QUICK_EVIDENCE_LEGISLATIVE_SCREEN_SCHEMA = 'quick-evidence-legislative-screen-v1' as const;
const HALF_LIFE_DAYS = 180;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
export const QUICK_EVIDENCE_LEGISLATIVE_FEATURES = [
  'sameAmendmentYes',
  'sameAmendmentNo',
  'sameMotionProceduralYes',
  'sameMotionProceduralNo',
  'sameOtherYes',
  'sameOtherNo',
] as const;

type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';
export type QuickEvidenceLegislativeVector = [number, number, number, number, number, number];

export interface HistoricalNonPassageVote {
  billId: string;
  occurredOn: string;
  voteKind: 'amendment' | 'motion' | 'procedural' | 'other';
  membershipId: string;
  choice: 'yea' | 'nay';
}

type ScreenObservation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  features: QuickEvidenceLegislativeVector;
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

function fitOffsetRidge(
  observations: readonly ScreenObservation[],
  lambda: number,
): QuickEvidenceLegislativeVector {
  if (observations.length < 500) {
    throw new Error(`Structured legislative training coverage is too small: ${observations.length}`);
  }
  let beta: QuickEvidenceLegislativeVector = [0, 0, 0, 0, 0, 0];
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const gradient = Array.from({ length: QUICK_EVIDENCE_LEGISLATIVE_FEATURES.length }, () => 0);
    const information = Array.from(
      { length: QUICK_EVIDENCE_LEGISLATIVE_FEATURES.length },
      (_, row) => Array.from(
        { length: QUICK_EVIDENCE_LEGISLATIVE_FEATURES.length },
        (_, column) => row === column ? lambda : 0,
      ),
    );
    for (const observation of observations) {
      const eta = logit(observation.baseProbability)
        + observation.features.reduce((sum, value, index) => sum + value * beta[index], 0);
      const probability = logistic(eta);
      const weight = Math.max(1e-8, probability * (1 - probability));
      const residual = observation.outcome - probability;
      for (let row = 0; row < QUICK_EVIDENCE_LEGISLATIVE_FEATURES.length; row += 1) {
        gradient[row] += observation.features[row] * residual - lambda * beta[row] / observations.length;
        for (let column = 0; column < QUICK_EVIDENCE_LEGISLATIVE_FEATURES.length; column += 1) {
          information[row][column] += observation.features[row] * observation.features[column] * weight;
        }
      }
    }
    const delta = solveLinearSystem(information, gradient);
    beta = beta.map((value, index) => value + delta[index]) as QuickEvidenceLegislativeVector;
    if (Math.max(...delta.map(Math.abs)) < 1e-7) break;
  }
  return beta;
}

export function quickEvidenceLegislativeFeatures(
  rows: readonly HistoricalNonPassageVote[],
  targetOccurredOn: string,
): QuickEvidenceLegislativeVector {
  const counts: QuickEvidenceLegislativeVector = [0, 0, 0, 0, 0, 0];
  for (const row of rows) {
    if (row.occurredOn >= targetOccurredOn) continue;
    const yes = row.choice === 'yea';
    if (row.voteKind === 'amendment') counts[yes ? 0 : 1] += 1;
    else if (row.voteKind === 'motion' || row.voteKind === 'procedural') counts[yes ? 2 : 3] += 1;
    else counts[yes ? 4 : 5] += 1;
  }
  return counts.map((value) => Math.log1p(value)) as QuickEvidenceLegislativeVector;
}

function anyFeature(vector: readonly number[]): boolean {
  return vector.some((value) => value > 0);
}

function applyLegislativeOffset(
  baseProbability: number,
  features: QuickEvidenceLegislativeVector,
  beta: QuickEvidenceLegislativeVector,
): number {
  const uncapped = features.reduce((sum, value, index) => sum + value * beta[index], 0);
  const delta = Math.max(-QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, uncapped));
  return logistic(logit(baseProbability) + delta);
}

function scoreBySession(events: readonly HistoricalQuickReplayEventResult[], session: SessionSlug): HistoricalQuickReplayScorecard {
  return scoreHistoricalQuickReplay(events.filter((event) => event.session === session)).overall;
}

function adjustReplay(
  baseline: readonly HistoricalQuickReplayEventResult[],
  featureByMemberEvent: ReadonlyMap<string, QuickEvidenceLegislativeVector>,
  beta: QuickEvidenceLegislativeVector,
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    const memberPredictions = event.memberPredictions.map((member) => {
      const features = featureByMemberEvent.get(`${event.voteEventId}|${member.membershipId}`);
      if (!features || !anyFeature(features) || member.yesProbability === undefined) return member;
      return {
        ...member,
        yesProbability: applyLegislativeOffset(member.yesProbability, features, beta),
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

function delta(candidate: HistoricalQuickReplayScorecard, baseline: HistoricalQuickReplayScorecard) {
  return {
    memberBrier: candidate.memberBrier - baseline.memberBrier,
    memberLogLoss: candidate.memberLogLoss - baseline.memberLogLoss,
    memberExpectedCalibrationError: candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError: candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

function targetByEvent(targets: readonly QuickReplayEvent[]): Map<string, QuickReplayEvent> {
  return new Map(targets.map((target) => [target.voteEventId, target]));
}

export async function evaluateQuickEvidenceLegislativeScreen(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const [dataset, voteResult] = await Promise.all([
    loadHistoricalQuickReplayDataset(pool),
    pool.query<{
      bill_id: string;
      occurred_on: string;
      vote_kind: 'amendment' | 'motion' | 'procedural' | 'other';
      membership_id: string;
      choice: 'yea' | 'nay';
    }>(`
      SELECT ve.bill_id::text,
             ve.occurred_on::text,
             ve.vote_kind,
             mv.membership_id::text,
             mv.choice
        FROM vote_events ve
        JOIN member_votes mv ON mv.vote_event_id=ve.id
       WHERE ve.bill_id IS NOT NULL
         AND ve.is_passage=false
         AND ve.vote_kind IN ('amendment','motion','procedural','other')
         AND mv.membership_id IS NOT NULL
         AND mv.choice IN ('yea','nay')
       ORDER BY ve.bill_id, mv.membership_id, ve.occurred_on, ve.id, mv.id`),
  ]);

  const priorByBillMember = new Map<string, HistoricalNonPassageVote[]>();
  for (const row of voteResult.rows) {
    const key = `${row.bill_id}|${row.membership_id}`;
    const rows = priorByBillMember.get(key) ?? [];
    rows.push({
      billId: row.bill_id,
      occurredOn: row.occurred_on,
      voteKind: row.vote_kind,
      membershipId: row.membership_id,
      choice: row.choice,
    });
    priorByBillMember.set(key, rows);
  }

  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  );
  const targetMap = targetByEvent(dataset.targets);
  const featureByMemberEvent = new Map<string, QuickEvidenceLegislativeVector>();
  const observations: ScreenObservation[] = [];

  for (const event of baseline) {
    const target = targetMap.get(event.voteEventId);
    if (!target || !['2021-2022', '2023-2024', '2025-2026'].includes(event.session)) continue;
    for (const member of event.memberPredictions) {
      const features = quickEvidenceLegislativeFeatures(
        priorByBillMember.get(`${target.billId}|${member.membershipId}`) ?? [],
        target.occurredOn,
      );
      featureByMemberEvent.set(`${event.voteEventId}|${member.membershipId}`, features);
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
  const trainingWithFeatures = training.filter((row) => anyFeature(row.features));
  const validationWithFeatures = validation.filter((row) => anyFeature(row.features));
  if (trainingWithFeatures.length < 500 || validationWithFeatures.length < 500) {
    throw new Error(`Insufficient structured legislative coverage: train=${trainingWithFeatures.length}, validation=${validationWithFeatures.length}`);
  }

  const baselineScores = {
    training: scoreBySession(baseline, '2021-2022'),
    validation: scoreBySession(baseline, '2023-2024'),
    descriptiveTest: scoreBySession(baseline, '2025-2026'),
  };

  const candidates = LAMBDAS.map((lambda) => {
    const beta = fitOffsetRidge(training, lambda);
    const replay = adjustReplay(baseline, featureByMemberEvent, beta);
    const validationScore = scoreBySession(replay, '2023-2024');
    return {
      lambda,
      beta,
      validationScore,
      validationDelta: delta(validationScore, baselineScores.validation),
      replay,
    };
  }).sort((left, right) => left.validationScore.memberBrier - right.validationScore.memberBrier
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
  const descriptiveTestDelta = delta(candidateScores.descriptiveTest, baselineScores.descriptiveTest);
  const hypothesisSignal = validationDelta.memberBrier <= -0.0005
    && validationDelta.memberLogLoss <= 0
    && validationDelta.chamberMeanAbsoluteYesError <= 0.25
    && validationDelta.passageBrier <= 0.002;

  const coverage = (session: SessionSlug) => {
    const rows = observations.filter((row) => row.session === session);
    const withFeatures = rows.filter((row) => anyFeature(row.features));
    return {
      memberOutcomes: rows.length,
      memberOutcomesWithPriorNonPassageVote: withFeatures.length,
      coverage: rows.length > 0 ? withFeatures.length / rows.length : 0,
      eventsWithPriorNonPassageVote: new Set(withFeatures.map((row) => row.eventId)).size,
    };
  };

  return {
    schemaVersion: QUICK_EVIDENCE_LEGISLATIVE_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'retrospective as-of-safe component diagnostic for prior same-bill non-passage recorded votes inside the single quick-evidence-v1 program',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      quickEvidenceCandidate: 'quick-evidence-v1',
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      trainSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      featureNames: QUICK_EVIDENCE_LEGISLATIVE_FEATURES,
      sourceBoundary: 'official bill-linked member_votes on non-passage vote_events dated strictly before the target floor-vote date; same-day rows are excluded',
      interpretationBoundary: 'amendment, motion, procedural, and other votes are ambiguous with respect to final passage; this diagnostic cannot make them directional evidence by itself',
      productionAction: 'none',
      servingQuickChanged: false,
    },
    coverage: {
      training: coverage('2021-2022'),
      validation: coverage('2023-2024'),
      descriptiveTest: coverage('2025-2026'),
    },
    candidates: candidates.map((candidate) => ({
      lambda: candidate.lambda,
      beta: Object.fromEntries(QUICK_EVIDENCE_LEGISLATIVE_FEATURES.map((name, index) => [name, candidate.beta[index]])),
      validation: candidate.validationScore,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: Object.fromEntries(QUICK_EVIDENCE_LEGISLATIVE_FEATURES.map((name, index) => [name, selected.beta[index]])),
      baseline: baselineScores,
      candidate: candidateScores,
      deltaCandidateMinusBaseline: {
        training: delta(candidateScores.training, baselineScores.training),
        validation: validationDelta,
        descriptiveTest: descriptiveTestDelta,
      },
    },
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      quickEvidenceWeightChanged: false,
      hypothesisSignal,
      note: hypothesisSignal
        ? 'The historically reconstructable structured-vote component shows enough validation lift to justify continued prospective measurement inside quick-evidence-v1, but it does not authorize a serving or frozen-weight change.'
        : 'The structured-vote component does not clear the diagnostic validation thresholds. Keep these features recorded at zero weight inside quick-evidence-v1.',
    },
  };
}

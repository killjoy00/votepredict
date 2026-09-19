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

export const QUICK_EVIDENCE_COMMITTEE_SCREEN_SCHEMA = 'quick-evidence-committee-screen-v1' as const;
const HALF_LIFE_DAYS = 180;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
export const QUICK_EVIDENCE_COMMITTEE_FEATURES = [
  'recommendAye',
  'recommendNay',
  'referralAye',
  'referralNay',
  'holdTableAye',
  'holdTableNay',
] as const;

type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';
type FeatureVector = [number, number, number, number, number, number];

type CommitteeEvidenceRow = {
  bill_id: string;
  membership_id: string;
  occurred_on: string;
  motion_type: string;
  vote_side: 'aye' | 'nay';
};

type Observation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  features: FeatureVector;
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

function fitOffsetRidge(observations: readonly Observation[], lambda: number): FeatureVector {
  let beta: FeatureVector = [0, 0, 0, 0, 0, 0];
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const gradient = Array.from({ length: QUICK_EVIDENCE_COMMITTEE_FEATURES.length }, () => 0);
    const information = Array.from(
      { length: QUICK_EVIDENCE_COMMITTEE_FEATURES.length },
      (_, row) => Array.from(
        { length: QUICK_EVIDENCE_COMMITTEE_FEATURES.length },
        (_, column) => row === column ? lambda : 0,
      ),
    );
    for (const observation of observations) {
      const eta = logit(observation.baseProbability)
        + observation.features.reduce((sum, value, index) => sum + value * beta[index], 0);
      const probability = logistic(eta);
      const weight = Math.max(1e-8, probability * (1 - probability));
      const residual = observation.outcome - probability;
      for (let row = 0; row < QUICK_EVIDENCE_COMMITTEE_FEATURES.length; row += 1) {
        gradient[row] += observation.features[row] * residual - lambda * beta[row] / observations.length;
        for (let column = 0; column < QUICK_EVIDENCE_COMMITTEE_FEATURES.length; column += 1) {
          information[row][column] += observation.features[row] * observation.features[column] * weight;
        }
      }
    }
    const delta = solveLinearSystem(information, gradient);
    beta = beta.map((value, index) => value + delta[index]) as FeatureVector;
    if (Math.max(...delta.map(Math.abs)) < 1e-7) break;
  }
  return beta;
}

function anyFeature(vector: readonly number[]): boolean {
  return vector.some((value) => value > 0);
}

function committeeFeatures(rows: readonly CommitteeEvidenceRow[], targetOccurredOn: string): FeatureVector {
  const counts: FeatureVector = [0, 0, 0, 0, 0, 0];
  for (const row of rows) {
    if (row.occurred_on >= targetOccurredOn) continue;
    const aye = row.vote_side === 'aye';
    if (['recommend_pass', 'general_register', 'general_orders'].includes(row.motion_type)) counts[aye ? 0 : 1] += 1;
    else if (['refer', 'rerefer'].includes(row.motion_type)) counts[aye ? 2 : 3] += 1;
    else if (['lay_over', 'table'].includes(row.motion_type)) counts[aye ? 4 : 5] += 1;
  }
  return counts.map((value) => Math.log1p(value)) as FeatureVector;
}

function applyOffset(baseProbability: number, features: FeatureVector, beta: FeatureVector): number {
  const uncapped = features.reduce((sum, value, index) => sum + value * beta[index], 0);
  const delta = Math.max(
    -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
    Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, uncapped),
  );
  return logistic(logit(baseProbability) + delta);
}

function houseBySession(
  events: readonly HistoricalQuickReplayEventResult[],
  session: SessionSlug,
): HistoricalQuickReplayEventResult[] {
  return events.filter((event) => event.session === session && event.chamber === 'house');
}

function scoreHouseSession(
  events: readonly HistoricalQuickReplayEventResult[],
  session: SessionSlug,
): HistoricalQuickReplayScorecard {
  return scoreHistoricalQuickReplay(houseBySession(events, session)).overall;
}

function adjustReplay(
  baseline: readonly HistoricalQuickReplayEventResult[],
  featureByMemberEvent: ReadonlyMap<string, FeatureVector>,
  beta: FeatureVector,
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    if (event.chamber !== 'house') return event;
    const memberPredictions = event.memberPredictions.map((member) => {
      const features = featureByMemberEvent.get(`${event.voteEventId}|${member.membershipId}`);
      if (!features || !anyFeature(features) || member.yesProbability === undefined) return member;
      return { ...member, yesProbability: applyOffset(member.yesProbability, features, beta) };
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
    memberExpectedCalibrationError:
      candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError:
      candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

function targetByEvent(targets: readonly QuickReplayEvent[]): Map<string, QuickReplayEvent> {
  return new Map(targets.map((target) => [target.voteEventId, target]));
}

export async function evaluateQuickEvidenceCommitteeScreen(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const [dataset, evidenceResult] = await Promise.all([
    loadHistoricalQuickReplayDataset(pool),
    pool.query<CommitteeEvidenceRow>(`
      SELECT ei.bill_id::text,
             ei.membership_id::text,
             ei.published_at::date::text AS occurred_on,
             ei.metadata->>'committeeMotionType' AS motion_type,
             ei.metadata->>'committeeVoteSide' AS vote_side
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE sd.source_kind='house_committee_minutes'
         AND ei.metadata->>'contextType'='committee_bill_vote'
         AND ei.metadata->>'historicalBackfill'='true'
         AND ei.membership_id IS NOT NULL
         AND ei.bill_id IS NOT NULL
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'committeeVoteSide' IN ('aye','nay')
         AND NOT EXISTS (
           SELECT 1 FROM evidence_relationships er
            WHERE er.to_evidence_id=ei.id
              AND er.relation_kind='supersedes'
         )
       ORDER BY ei.bill_id,ei.membership_id,ei.published_at,ei.id`),
  ]);

  const byBillMember = new Map<string, CommitteeEvidenceRow[]>();
  for (const row of evidenceResult.rows) {
    const key = `${row.bill_id}|${row.membership_id}`;
    const rows = byBillMember.get(key) ?? [];
    rows.push(row);
    byBillMember.set(key, rows);
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
  const featureByMemberEvent = new Map<string, FeatureVector>();
  const observations: Observation[] = [];

  for (const event of baseline) {
    if (event.chamber !== 'house') continue;
    const target = targetMap.get(event.voteEventId);
    if (!target || !['2021-2022','2023-2024','2025-2026'].includes(event.session)) continue;
    for (const member of event.memberPredictions) {
      const features = committeeFeatures(
        byBillMember.get(`${target.billId}|${member.membershipId}`) ?? [],
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
  const trainingWithFeatures = training.filter((row) => anyFeature(row.features));
  const validationWithFeatures = validation.filter((row) => anyFeature(row.features));
  if (trainingWithFeatures.length < 50 || validationWithFeatures.length < 50) {
    throw new Error(
      `Insufficient historical committee coverage: train=${trainingWithFeatures.length}, validation=${validationWithFeatures.length}`,
    );
  }

  const baselineScores = {
    training: scoreHouseSession(baseline, '2021-2022'),
    validation: scoreHouseSession(baseline, '2023-2024'),
    descriptiveTest: scoreHouseSession(baseline, '2025-2026'),
  };
  const candidates = LAMBDAS.map((lambda) => {
    const beta = fitOffsetRidge(training, lambda);
    const replay = adjustReplay(baseline, featureByMemberEvent, beta);
    const validationScore = scoreHouseSession(replay, '2023-2024');
    return {
      lambda,
      beta,
      replay,
      validationScore,
      validationDelta: delta(validationScore, baselineScores.validation),
    };
  }).sort((left, right) =>
    left.validationScore.memberBrier - right.validationScore.memberBrier
    || left.validationScore.memberLogLoss - right.validationScore.memberLogLoss
    || left.validationScore.chamberMeanAbsoluteYesError - right.validationScore.chamberMeanAbsoluteYesError
    || left.lambda - right.lambda);

  const selected = candidates[0];
  const candidateScores = {
    training: scoreHouseSession(selected.replay, '2021-2022'),
    validation: selected.validationScore,
    descriptiveTest: scoreHouseSession(selected.replay, '2025-2026'),
  };
  const validationDelta = delta(candidateScores.validation, baselineScores.validation);
  const descriptiveDelta = delta(candidateScores.descriptiveTest, baselineScores.descriptiveTest);
  const hypothesisSignal = validationDelta.memberBrier <= -0.0005
    && validationDelta.memberLogLoss <= 0
    && validationDelta.chamberMeanAbsoluteYesError <= 0.25
    && validationDelta.passageBrier <= 0.002
    && descriptiveDelta.memberBrier <= 0.0005;

  const coverage = (session: SessionSlug) => {
    const rows = observations.filter((row) => row.session === session);
    const withFeatures = rows.filter((row) => anyFeature(row.features));
    return {
      memberOutcomes: rows.length,
      memberOutcomesWithCommitteeVote: withFeatures.length,
      coverage: rows.length ? withFeatures.length / rows.length : 0,
      eventsWithCommitteeVote: new Set(withFeatures.map((row) => row.eventId)).size,
    };
  };

  return {
    schemaVersion: QUICK_EVIDENCE_COMMITTEE_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'historical House committee-minute component diagnostic inside the single quick-evidence-v1 program',
    metadata: {
      codeSha: options.codeSha ?? null,
      quickEvidenceCandidate: 'quick-evidence-v1',
      servingBaseline: 'member-eb-v1.2-decay180',
      chamber: 'house',
      trainSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      featureNames: QUICK_EVIDENCE_COMMITTEE_FEATURES,
      sourceBoundary: 'official House committee minute pages reconstructed after the fact; meeting date is known but exact historical public-posting time is not',
      asOfRule: 'committee meeting date must be strictly before target floor-vote date; same-day rows excluded',
      availabilityBoundary: 'retrospective official-minute reconstruction is hypothesis-only because meeting date does not prove the minute page was publicly posted by that date',
      promotionEligible: false,
      servingQuickChanged: false,
      productionAction: 'none',
    },
    sourceRows: evidenceResult.rows.length,
    coverage: {
      training: coverage('2021-2022'),
      validation: coverage('2023-2024'),
      descriptiveTest: coverage('2025-2026'),
    },
    candidates: candidates.map((candidate) => ({
      lambda: candidate.lambda,
      beta: Object.fromEntries(
        QUICK_EVIDENCE_COMMITTEE_FEATURES.map((name, index) => [name, candidate.beta[index]]),
      ),
      validation: candidate.validationScore,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: Object.fromEntries(
        QUICK_EVIDENCE_COMMITTEE_FEATURES.map((name, index) => [name, selected.beta[index]]),
      ),
      baseline: baselineScores,
      candidate: candidateScores,
      deltaCandidateMinusBaseline: {
        training: delta(candidateScores.training, baselineScores.training),
        validation: validationDelta,
        descriptiveTest: descriptiveDelta,
      },
    },
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      quickEvidenceWeightChanged: false,
      prospectivePromotionEligible: false,
      hypothesisSignal,
      note: hypothesisSignal
        ? 'Historical House committee roll calls show a component signal worth monitoring prospectively inside quick-evidence-v1, but the historical minute-posting boundary is not promotion-safe.'
        : 'Historical House committee roll calls do not clear the diagnostic thresholds; keep committee features at zero weight inside quick-evidence-v1.',
    },
  };
}

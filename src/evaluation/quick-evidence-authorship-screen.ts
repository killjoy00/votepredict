import type { Pool } from 'pg';
import { simulateChamber } from '@/forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '@/forecasting/minnesota-rules';
import { QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA } from '@/forecasting/quick-evidence-shadow';
import {
  authorshipMembershipIdsAsOf,
  type StoredRevisorAuthorship,
} from '@/forecasting/quick-evidence-authorship';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import {
  scoreHistoricalQuickReplay,
  type HistoricalQuickReplayEventResult,
  type HistoricalQuickReplayScorecard,
  type QuickReplayEvent,
} from './historical-quick-replay';

export const QUICK_EVIDENCE_AUTHORSHIP_SCREEN_SCHEMA = 'quick-evidence-authorship-screen-v1' as const;
const HALF_LIFE_DAYS = 180;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';

type Observation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  isAuthor: boolean;
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

function fitOffset(observations: readonly Observation[], lambda: number): number {
  let beta = 0;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    let gradient = -lambda * beta;
    let information = lambda;
    for (const row of observations) {
      if (!row.isAuthor) continue;
      const probability = logistic(logit(row.baseProbability) + beta);
      gradient += row.outcome - probability;
      information += Math.max(1e-8, probability * (1 - probability));
    }
    if (information <= 1e-12) return 0;
    const delta = gradient / information;
    beta += delta;
    if (Math.abs(delta) < 1e-7) break;
  }
  return beta;
}

function applyOffset(baseProbability: number, beta: number): number {
  const delta = Math.max(
    -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
    Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, beta),
  );
  return logistic(logit(baseProbability) + delta);
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
  authorsByEvent: ReadonlyMap<string, ReadonlySet<string>>,
  beta: number,
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    const authors = authorsByEvent.get(event.voteEventId);
    const memberPredictions = event.memberPredictions.map((member) => {
      if (!authors?.has(member.membershipId) || member.yesProbability === undefined) return member;
      return { ...member, yesProbability: applyOffset(member.yesProbability, beta) };
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

function targetByEvent(targets: readonly QuickReplayEvent[]): Map<string, QuickReplayEvent> {
  return new Map(targets.map((target) => [target.voteEventId, target]));
}

export async function evaluateQuickEvidenceAuthorshipScreen(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const billIds = [...new Set(dataset.targets.map((target) => target.billId))];
  const authorshipResult = await pool.query<{
    bill_id: string;
    authorship: StoredRevisorAuthorship | null;
  }>(`
    SELECT id::text AS bill_id,
           metadata -> 'revisorAuthorship' AS authorship
      FROM bills
     WHERE id = ANY($1::uuid[])
  `, [billIds]);
  const authorshipByBill = new Map(authorshipResult.rows.map((row) => [row.bill_id, row.authorship]));

  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  );
  const targets = targetByEvent(dataset.targets);
  const authorsByEvent = new Map<string, Set<string>>();
  const observations: Observation[] = [];
  let eligibleBills = 0;
  let ineligibleBills = 0;

  for (const event of baseline) {
    const target = targets.get(event.voteEventId);
    if (!target || !['2021-2022','2023-2024','2025-2026'].includes(event.session)) continue;
    const authors = authorshipMembershipIdsAsOf(
      authorshipByBill.get(target.billId),
      target.occurredOn,
    );
    if (authors) {
      authorsByEvent.set(event.voteEventId, authors);
      eligibleBills += 1;
    } else {
      ineligibleBills += 1;
    }
    for (const member of event.memberPredictions) {
      if (member.yesProbability === undefined || member.actualOutcome === undefined) continue;
      observations.push({
        eventId: event.voteEventId,
        membershipId: member.membershipId,
        session: event.session as SessionSlug,
        baseProbability: member.yesProbability,
        outcome: member.actualOutcome,
        isAuthor: authors?.has(member.membershipId) ?? false,
      });
    }
  }

  const training = observations.filter((row) => row.session === '2021-2022');
  const validation = observations.filter((row) => row.session === '2023-2024');
  const descriptiveTest = observations.filter((row) => row.session === '2025-2026');
  const trainingAuthors = training.filter((row) => row.isAuthor);
  const validationAuthors = validation.filter((row) => row.isAuthor);
  if (trainingAuthors.length < 50 || validationAuthors.length < 50) {
    throw new Error(
      `Insufficient authorship coverage: train=${trainingAuthors.length}, validation=${validationAuthors.length}`,
    );
  }

  const baselineScores = {
    training: scoreBySession(baseline, '2021-2022'),
    validation: scoreBySession(baseline, '2023-2024'),
    descriptiveTest: scoreBySession(baseline, '2025-2026'),
  };

  const candidates = LAMBDAS.map((lambda) => {
    const beta = fitOffset(training, lambda);
    const replay = adjustReplay(baseline, authorsByEvent, beta);
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
  const descriptiveDelta = delta(candidateScores.descriptiveTest, baselineScores.descriptiveTest);
  const hypothesisSignal = validationDelta.memberBrier <= -0.0005
    && validationDelta.memberLogLoss <= 0
    && validationDelta.chamberMeanAbsoluteYesError <= 0.25
    && validationDelta.passageBrier <= 0.002
    && descriptiveDelta.memberBrier <= 0.0005;

  const coverage = (session: SessionSlug) => {
    const rows = observations.filter((row) => row.session === session);
    const authors = rows.filter((row) => row.isAuthor);
    return {
      memberOutcomes: rows.length,
      authorMemberOutcomes: authors.length,
      authorCoverage: rows.length ? authors.length / rows.length : 0,
      eventsWithAuthorObservations: new Set(authors.map((row) => row.eventId)).size,
      authorYesRate: authors.length
        ? authors.reduce((sum, row) => sum + row.outcome, 0) / authors.length
        : null,
    };
  };

  return {
    schemaVersion: QUICK_EVIDENCE_AUTHORSHIP_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'retrospective as-of-safe component diagnostic for reconstructed bill authorship inside the single quick-evidence-v1 candidate',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      quickEvidenceCandidate: 'quick-evidence-v1',
      trainSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      sourceBoundary: 'official Revisor current author state plus dated author additions/strikes; reconstruction reverses changes on or after target vote date',
      sameDayPolicy: 'excluded because Revisor historical action timing is date-granular',
      interpretationBoundary: 'authorship is an official bill relationship, not a guarantee of eventual YEA; this diagnostic does not authorize a serving change',
      productionAction: 'none',
      servingQuickChanged: false,
    },
    sourceCoverage: { eligibleBills, ineligibleBills },
    coverage: {
      training: coverage('2021-2022'),
      validation: coverage('2023-2024'),
      descriptiveTest: coverage('2025-2026'),
    },
    candidates: candidates.map((candidate) => ({
      lambda: candidate.lambda,
      beta: candidate.beta,
      validation: candidate.validationScore,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: selected.beta,
      cappedBeta: Math.max(
        -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
        Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, selected.beta),
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
      hypothesisSignal,
      note: hypothesisSignal
        ? 'Reconstructed authorship shows stable enough incremental validation signal to justify continued measurement inside quick-evidence-v1, but no serving or frozen-weight change is authorized by this diagnostic.'
        : 'Reconstructed authorship does not clear the component diagnostic thresholds. Keep billAuthor at zero weight inside quick-evidence-v1.',
    },
  };
}

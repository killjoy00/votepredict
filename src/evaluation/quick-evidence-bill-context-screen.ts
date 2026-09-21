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

export const QUICK_EVIDENCE_BILL_CONTEXT_SCREEN_SCHEMA =
  'quick-evidence-bill-context-screen-v1' as const;
const HALF_LIFE_DAYS = 180;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
const MIN_TRAIN_VALIDATION_MEMBER_OUTCOMES = 1000;
const MIN_TRAIN_VALIDATION_EVENTS = 20;
const MIN_DESCRIPTIVE_STABILITY_MEMBER_OUTCOMES = 1000;
type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';

type Observation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  hasPriorSummary: boolean;
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
      if (!row.hasPriorSummary) continue;
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
  eventsWithPriorSummary: ReadonlySet<string>,
  beta: number,
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    if (!eventsWithPriorSummary.has(event.voteEventId)) return event;
    const memberPredictions = event.memberPredictions.map((member) => {
      if (member.yesProbability === undefined) return member;
      return { ...member, yesProbability: applyOffset(member.yesProbability, beta) };
    });
    if (
      event.status !== 'replayable'
      || memberPredictions.some((member) => member.yesProbability === undefined)
    ) {
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

export async function evaluateQuickEvidenceBillContextScreen(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  );
  const targets = targetByEvent(dataset.targets);

  const summaries = await pool.query<{
    bill_id: string;
    summary_on: string;
  }>(`
    SELECT ei.bill_id::text,
           min(ei.published_at::date)::text AS summary_on
      FROM evidence_items ei
      JOIN bills b ON b.id=ei.bill_id
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
     WHERE j.slug='us-mn'
       AND ei.metadata->>'subtype'='bill_summary_version'
       AND ei.metadata->>'asOfEligible'='true'
       AND ei.bill_id IS NOT NULL
       AND ei.published_at IS NOT NULL
       AND s.slug IN ('2021-2022','2023-2024','2025-2026')
     GROUP BY ei.bill_id
  `);
  const firstSummaryByBill = new Map(
    summaries.rows.map((row) => [row.bill_id, row.summary_on]),
  );

  const eventsWithPriorSummary = new Set<string>();
  const observations: Observation[] = [];
  for (const event of baseline) {
    const target = targets.get(event.voteEventId);
    if (!target || !['2021-2022','2023-2024','2025-2026'].includes(event.session)) continue;
    const summaryOn = firstSummaryByBill.get(target.billId);
    const hasPriorSummary = Boolean(summaryOn && summaryOn < event.occurredOn);
    if (hasPriorSummary) eventsWithPriorSummary.add(event.voteEventId);
    for (const member of event.memberPredictions) {
      if (member.yesProbability === undefined || member.actualOutcome === undefined) continue;
      observations.push({
        eventId: event.voteEventId,
        membershipId: member.membershipId,
        session: event.session as SessionSlug,
        baseProbability: member.yesProbability,
        outcome: member.actualOutcome,
        hasPriorSummary,
      });
    }
  }

  const training = observations.filter((row) => row.session === '2021-2022');
  const validation = observations.filter((row) => row.session === '2023-2024');
  const descriptiveTest = observations.filter((row) => row.session === '2025-2026');
  const trainingContext = training.filter((row) => row.hasPriorSummary);
  const validationContext = validation.filter((row) => row.hasPriorSummary);
  const descriptiveContext = descriptiveTest.filter((row) => row.hasPriorSummary);
  const trainingEvents = new Set(trainingContext.map((row) => row.eventId)).size;
  const validationEvents = new Set(validationContext.map((row) => row.eventId)).size;
  if (
    trainingContext.length < MIN_TRAIN_VALIDATION_MEMBER_OUTCOMES
    || validationContext.length < MIN_TRAIN_VALIDATION_MEMBER_OUTCOMES
    || trainingEvents < MIN_TRAIN_VALIDATION_EVENTS
    || validationEvents < MIN_TRAIN_VALIDATION_EVENTS
  ) {
    throw new Error(
      'Insufficient bill-context coverage: '
      + `trainOutcomes=${trainingContext.length}, trainEvents=${trainingEvents}, `
      + `validationOutcomes=${validationContext.length}, validationEvents=${validationEvents}`,
    );
  }

  const baselineScores = {
    training: scoreBySession(baseline, '2021-2022'),
    validation: scoreBySession(baseline, '2023-2024'),
    descriptiveTest: scoreBySession(baseline, '2025-2026'),
  };

  const candidates = LAMBDAS.map((lambda) => {
    const beta = fitOffset(training, lambda);
    const replay = adjustReplay(baseline, eventsWithPriorSummary, beta);
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
  const validationSignal = validationDelta.memberBrier <= -0.0005
    && validationDelta.memberLogLoss <= 0
    && validationDelta.chamberMeanAbsoluteYesError <= 0.25
    && validationDelta.passageBrier <= 0.002;
  const descriptiveStabilityAvailable =
    descriptiveContext.length >= MIN_DESCRIPTIVE_STABILITY_MEMBER_OUTCOMES;
  const descriptiveStabilityPass = descriptiveStabilityAvailable
    ? descriptiveDelta.memberBrier <= 0.0005
    : null;
  const hypothesisSignal = validationSignal;

  const coverage = (session: SessionSlug) => {
    const rows = observations.filter((row) => row.session === session);
    const context = rows.filter((row) => row.hasPriorSummary);
    return {
      memberOutcomes: rows.length,
      contextMemberOutcomes: context.length,
      contextCoverage: rows.length ? context.length / rows.length : 0,
      replayEvents: new Set(rows.map((row) => row.eventId)).size,
      eventsWithPriorSummary: new Set(context.map((row) => row.eventId)).size,
      contextYesRate: context.length
        ? context.reduce((sum, row) => sum + row.outcome, 0) / context.length
        : null,
    };
  };

  return {
    schemaVersion: QUICK_EVIDENCE_BILL_CONTEXT_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'retrospective as-of-safe component diagnostic for official pre-vote House Research summary availability inside the single quick-evidence-v1 candidate',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      quickEvidenceCandidate: 'quick-evidence-v1',
      trainSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveSession: '2025-2026',
      sourceBoundary: 'official dated Minnesota House Research bill-summary PDFs only',
      sameDayPolicy: 'excluded because summary publication timing is date-granular',
      descriptiveSelectionPolicy: '2025-2026 is descriptive only and cannot select lambda or create a positive signal; absent positive coverage cannot support a stability claim',
      interpretationBoundary: 'summary availability is an official bill-context/process signal, not a guarantee of eventual YEA; this diagnostic does not authorize a serving change',
      productionAction: 'none',
      servingQuickChanged: false,
    },
    sourceCoverage: {
      datedSummaryBills: summaries.rows.length,
    },
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
    descriptiveStability: {
      minimumPositiveOutcomes: MIN_DESCRIPTIVE_STABILITY_MEMBER_OUTCOMES,
      available: descriptiveStabilityAvailable,
      passesWhenAvailable: descriptiveStabilityPass,
      interpretation: descriptiveStabilityAvailable
        ? 'Descriptive stability can be assessed but cannot select configuration.'
        : 'No descriptive stability claim is available because the 2025-2026 slice has insufficient prior-summary member outcomes.',
    },
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      quickEvidenceWeightChanged: false,
      validationSignal,
      hypothesisSignal,
      prospectiveMeasurementJustified: hypothesisSignal,
      descriptiveStabilityClaimAvailable: descriptiveStabilityAvailable,
      note: hypothesisSignal
        ? 'Prior House Research summary availability clears the frozen validation diagnostic thresholds and may justify continued prospective measurement inside quick-evidence-v1. No serving or frozen-weight change is authorized, and no 2025-2026 stability claim is available without descriptive coverage.'
        : 'Prior House Research summary availability does not clear the frozen validation diagnostic thresholds. Keep priorHouseResearchSummary at zero weight inside quick-evidence-v1.',
    },
  };
}

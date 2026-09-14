import type { Pool } from 'pg';
import { estimateMemberProbability, type RateEvidence } from '../forecasting/member-model';
import {
  evaluateChronologicalMemberModel,
  scoreMemberModel,
  type MemberModelObservation,
  type MemberModelPrediction,
  type MemberModelScorecard,
} from './member-model';

export const MEMBER_HISTORY_DECAY_SCHEMA = 'member-history-decay-evaluation-v1' as const;

export interface MemberHistoryDecayCandidate {
  id: string;
  memberHalfLifeDays: number | null;
  partyHalfLifeDays: number | null;
  globalHalfLifeDays: number | null;
}

export const MEMBER_HISTORY_DECAY_BASELINE: MemberHistoryDecayCandidate = Object.freeze({
  id: 'uncapped-unweighted',
  memberHalfLifeDays: null,
  partyHalfLifeDays: null,
  globalHalfLifeDays: null,
});

export const MEMBER_HISTORY_DECAY_GRID: readonly MemberHistoryDecayCandidate[] = Object.freeze([
  { id: 'member-180', memberHalfLifeDays: 180, partyHalfLifeDays: null, globalHalfLifeDays: null },
  { id: 'member-365', memberHalfLifeDays: 365, partyHalfLifeDays: null, globalHalfLifeDays: null },
  { id: 'member-730', memberHalfLifeDays: 730, partyHalfLifeDays: null, globalHalfLifeDays: null },
  { id: 'member-365-party-730', memberHalfLifeDays: 365, partyHalfLifeDays: 730, globalHalfLifeDays: null },
  { id: 'member-730-party-1460', memberHalfLifeDays: 730, partyHalfLifeDays: 1460, globalHalfLifeDays: null },
  { id: 'hierarchical-365-730-1460', memberHalfLifeDays: 365, partyHalfLifeDays: 730, globalHalfLifeDays: 1460 },
]);

const MATURE_SLICES = [
  '2023-2024/house',
  '2023-2024/senate',
  '2025-2026/house',
  '2025-2026/senate',
] as const;

interface ObservationRow {
  observation_id: string;
  vote_event_id: string;
  member_id: string;
  party: string | null;
  occurred_at: string;
  outcome: 0 | 1;
  session_slug: string;
  chamber_slug: string;
}

interface DecayedState {
  yes: number;
  total: number;
  lastAtMs: number | null;
}

interface MetricDelta {
  brier: number;
  logLoss: number;
  expectedCalibrationError: number;
  accuracy: number;
}

interface CandidateEvaluation {
  config: MemberHistoryDecayCandidate;
  overall: MemberModelScorecard;
  bySessionAndChamber: Record<string, MemberModelScorecard>;
  deltaVsBaseline: MetricDelta;
  matureSliceBrierDeltas: Record<string, number>;
  matureSliceBrierWins: number;
  worstMatureSliceBrierDelta: number;
  qualifies: boolean;
}

function assertHalfLife(value: number | null, label: string): void {
  if (value !== null && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`${label} must be null or a positive finite number`);
  }
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid observation timestamp: ${value}`);
  return parsed;
}

export function decayFactor(elapsedDays: number, halfLifeDays: number | null): number {
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) throw new Error('elapsedDays must be a non-negative finite number');
  if (halfLifeDays === null) return 1;
  assertHalfLife(halfLifeDays, 'halfLifeDays');
  return 2 ** (-elapsedDays / halfLifeDays);
}

function advanceState(state: DecayedState, atMs: number, halfLifeDays: number | null): void {
  if (state.lastAtMs === null) {
    state.lastAtMs = atMs;
    return;
  }
  if (atMs < state.lastAtMs) throw new Error('Decay state cannot move backward in time');
  const elapsedDays = (atMs - state.lastAtMs) / 86_400_000;
  const factor = decayFactor(elapsedDays, halfLifeDays);
  state.yes *= factor;
  state.total *= factor;
  state.lastAtMs = atMs;
}

function evidenceAt(
  map: Map<string, DecayedState>,
  key: string,
  atMs: number,
  halfLifeDays: number | null,
): RateEvidence | undefined {
  const state = map.get(key);
  if (!state) return undefined;
  advanceState(state, atMs, halfLifeDays);
  return state.total > 0 ? { yes: state.yes, total: state.total } : undefined;
}

function addOutcome(
  map: Map<string, DecayedState>,
  key: string,
  atMs: number,
  halfLifeDays: number | null,
  outcome: 0 | 1,
): void {
  const state = map.get(key) ?? { yes: 0, total: 0, lastAtMs: null };
  advanceState(state, atMs, halfLifeDays);
  state.yes += outcome;
  state.total += 1;
  map.set(key, state);
}

function evaluateOneChamber(
  observations: readonly MemberModelObservation[],
  candidate: MemberHistoryDecayCandidate,
): MemberModelPrediction[] {
  assertHalfLife(candidate.memberHalfLifeDays, 'memberHalfLifeDays');
  assertHalfLife(candidate.partyHalfLifeDays, 'partyHalfLifeDays');
  assertHalfLife(candidate.globalHalfLifeDays, 'globalHalfLifeDays');

  const sorted = [...observations].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt)
      || a.voteEventId.localeCompare(b.voteEventId)
      || a.observationId.localeCompare(b.observationId));
  const partyCounts = new Map<string, DecayedState>();
  const memberCounts = new Map<string, DecayedState>();
  const global: DecayedState = { yes: 0, total: 0, lastAtMs: null };
  const predictions: MemberModelPrediction[] = [];

  for (let offset = 0; offset < sorted.length;) {
    const occurredAt = sorted[offset].occurredAt;
    let end = offset + 1;
    while (end < sorted.length && sorted[end].occurredAt === occurredAt) end += 1;
    const group = sorted.slice(offset, end);
    const atMs = parseTimestamp(occurredAt);
    advanceState(global, atMs, candidate.globalHalfLifeDays);

    for (const row of group) {
      const estimate = estimateMemberProbability({
        memberId: row.memberId,
        party: row.party,
        global: { yes: global.yes, total: global.total },
        partyHistory: evidenceAt(partyCounts, row.party, atMs, candidate.partyHalfLifeDays),
        memberHistory: evidenceAt(memberCounts, row.memberId, atMs, candidate.memberHalfLifeDays),
        analogueYesRate: row.analogueYesRate,
        analogueEffectiveWeight: row.analogueEffectiveWeight,
      });
      predictions.push({
        ...row,
        rawProbability: estimate.rawProbability,
        probability: estimate.probability,
        calibrated: false,
        cannotPredictReason: estimate.cannotPredictReason,
      });
    }

    for (const row of group) {
      const historyOutcome = row.historyOutcome === undefined ? row.outcome : row.historyOutcome;
      if (historyOutcome === null) continue;
      global.yes += historyOutcome;
      global.total += 1;
      addOutcome(partyCounts, row.party, atMs, candidate.partyHalfLifeDays, historyOutcome);
      addOutcome(memberCounts, row.memberId, atMs, candidate.memberHalfLifeDays, historyOutcome);
    }
    offset = end;
  }

  return predictions;
}

export function evaluateChronologicalMemberHistoryDecay(
  observations: readonly MemberModelObservation[],
  candidate: MemberHistoryDecayCandidate,
): MemberModelPrediction[] {
  const chambers = [...new Set(observations.map((row) => row.chamber))];
  return chambers.flatMap((chamber) => evaluateOneChamber(
    observations.filter((row) => row.chamber === chamber),
    candidate,
  )).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)
    || a.voteEventId.localeCompare(b.voteEventId)
    || a.observationId.localeCompare(b.observationId));
}

function scoreSlices(predictions: readonly MemberModelPrediction[]): Record<string, MemberModelScorecard> {
  const slices = new Map<string, MemberModelPrediction[]>();
  for (const row of predictions) {
    const key = `${row.session}/${row.chamber}`;
    const existing = slices.get(key) ?? [];
    existing.push(row);
    slices.set(key, existing);
  }
  return Object.fromEntries(
    [...slices.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => [key, scoreMemberModel(rows)]),
  );
}

function metricDelta(candidate: MemberModelScorecard, baseline: MemberModelScorecard): MetricDelta {
  return {
    brier: candidate.brier - baseline.brier,
    logLoss: candidate.logLoss - baseline.logLoss,
    expectedCalibrationError: candidate.expectedCalibrationError - baseline.expectedCalibrationError,
    accuracy: candidate.accuracy - baseline.accuracy,
  };
}

function assertBaselineEquivalent(
  observations: readonly MemberModelObservation[],
  decayedBaseline: readonly MemberModelPrediction[],
): { checked: number; maximumAbsoluteProbabilityDifference: number } {
  const current = evaluateChronologicalMemberModel(observations);
  const currentById = new Map(current.map((row) => [row.observationId, row]));
  let checked = 0;
  let maximumAbsoluteProbabilityDifference = 0;
  for (const row of decayedBaseline) {
    const expected = currentById.get(row.observationId);
    if (!expected) throw new Error(`Baseline observation missing from current evaluator: ${row.observationId}`);
    if (row.probability === undefined || expected.probability === undefined) {
      if (row.probability !== expected.probability) throw new Error(`Baseline coverage mismatch for ${row.observationId}`);
      continue;
    }
    const difference = Math.abs(row.probability - expected.probability);
    maximumAbsoluteProbabilityDifference = Math.max(maximumAbsoluteProbabilityDifference, difference);
    checked += 1;
    if (difference > 1e-12) {
      throw new Error(`Unweighted decay baseline diverged from current evaluator for ${row.observationId}: ${difference}`);
    }
  }
  if (current.length !== decayedBaseline.length) throw new Error('Baseline evaluator observation counts differ');
  return { checked, maximumAbsoluteProbabilityDifference };
}

function evaluateCandidate(
  observations: readonly MemberModelObservation[],
  config: MemberHistoryDecayCandidate,
  baselineOverall: MemberModelScorecard,
  baselineSlices: Record<string, MemberModelScorecard>,
): CandidateEvaluation {
  const predictions = evaluateChronologicalMemberHistoryDecay(observations, config);
  const overall = scoreMemberModel(predictions);
  const bySessionAndChamber = scoreSlices(predictions);
  const deltaVsBaseline = metricDelta(overall, baselineOverall);
  const matureSliceBrierDeltas = Object.fromEntries(MATURE_SLICES.map((key) => {
    const candidateSlice = bySessionAndChamber[key];
    const baselineSlice = baselineSlices[key];
    if (!candidateSlice || !baselineSlice) throw new Error(`Required mature slice is unavailable: ${key}`);
    return [key, candidateSlice.brier - baselineSlice.brier];
  }));
  const matureDeltas = Object.values(matureSliceBrierDeltas);
  const matureSliceBrierWins = matureDeltas.filter((value) => value < 0).length;
  const worstMatureSliceBrierDelta = Math.max(...matureDeltas);
  const qualifies = deltaVsBaseline.brier <= -0.0001
    && deltaVsBaseline.logLoss <= 0
    && deltaVsBaseline.expectedCalibrationError <= 0
    && deltaVsBaseline.accuracy >= -0.002
    && matureSliceBrierWins >= 3
    && worstMatureSliceBrierDelta <= 0.001;

  return {
    config,
    overall,
    bySessionAndChamber,
    deltaVsBaseline,
    matureSliceBrierDeltas,
    matureSliceBrierWins,
    worstMatureSliceBrierDelta,
    qualifies,
  };
}

export async function evaluateMemberHistoryDecayGrid(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const result = await pool.query<ObservationRow>(`
    SELECT mv.id AS observation_id,
           ve.id AS vote_event_id,
           m.legislator_id AS member_id,
           NULLIF(btrim(m.party), '') AS party,
           ve.occurred_on::text || 'T00:00:00Z' AS occurred_at,
           CASE mv.choice WHEN 'yea' THEN 1 ELSE 0 END AS outcome,
           s.slug AS session_slug,
           c.slug AS chamber_slug
      FROM member_votes mv
      JOIN vote_events ve ON ve.id = mv.vote_event_id
      JOIN memberships m ON m.id = mv.membership_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
     WHERE ve.is_passage = true
       AND mv.choice IN ('yea', 'nay')
     ORDER BY ve.occurred_on, ve.id, mv.id`);

  const observations: MemberModelObservation[] = result.rows.map((row) => ({
    observationId: row.observation_id,
    voteEventId: row.vote_event_id,
    memberId: row.member_id,
    party: row.party ?? 'UNKNOWN',
    occurredAt: row.occurred_at,
    outcome: Number(row.outcome) as 0 | 1,
    session: row.session_slug,
    chamber: row.chamber_slug,
  }));
  if (observations.length === 0) throw new Error('No resolved historical passage member votes found');

  const baselinePredictions = evaluateChronologicalMemberHistoryDecay(observations, MEMBER_HISTORY_DECAY_BASELINE);
  const baselineValidation = assertBaselineEquivalent(observations, baselinePredictions);
  const baselineOverall = scoreMemberModel(baselinePredictions);
  const baselineSlices = scoreSlices(baselinePredictions);
  const candidates = MEMBER_HISTORY_DECAY_GRID.map((config) => evaluateCandidate(
    observations,
    config,
    baselineOverall,
    baselineSlices,
  ));
  const qualified = candidates.filter((candidate) => candidate.qualifies)
    .sort((left, right) => left.overall.brier - right.overall.brier
      || left.overall.logLoss - right.overall.logLoss
      || left.overall.expectedCalibrationError - right.overall.expectedCalibrationError);
  const selected = qualified[0] ?? null;

  return {
    schemaVersion: MEMBER_HISTORY_DECAY_SCHEMA,
    metadata: {
      generatedAt: new Date().toISOString(),
      codeSha: options.codeSha ?? null,
      analysisStatus: 'retrospective-shadow-only' as const,
      probabilityAction: 'none' as const,
      runtimeDefaultChange: false,
      modelVersionChange: false,
      evaluation: 'Chronological Minnesota passage-vote member prediction with chamber-isolated histories. Decay is applied before each vote date and outcomes are added only after all predictions on that date.',
      warning: 'This is retrospective/shadow evaluation on already inspected sessions. It can nominate only a later exact Quick replay candidate, not a production model.',
      scope: 'Member vote component only. It does not solve selection bias from conditioning on bills that reached a final-passage vote.',
      baselineValidation,
    },
    observations: observations.length,
    baseline: {
      config: MEMBER_HISTORY_DECAY_BASELINE,
      overall: baselineOverall,
      bySessionAndChamber: baselineSlices,
    },
    candidates,
    decision: selected ? {
      status: 'shadow_candidate_nominated' as const,
      selectedCandidate: selected.config.id,
      productionAction: 'none' as const,
      nextStep: 'Replay the selected decay configuration through the exact historical Quick pipeline, including analogue selection and chamber aggregation, before considering any runtime model change.',
    } : {
      status: 'no_candidate' as const,
      selectedCandidate: null,
      productionAction: 'none' as const,
      nextStep: 'Do not change runtime history weighting from this experiment.',
    },
  };
}

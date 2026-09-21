import type { Pool } from 'pg';
import { simulateChamber } from '@/forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '@/forecasting/minnesota-rules';
import { QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA } from '@/forecasting/quick-evidence-shadow';
import {
  authorshipMembershipIdsAsOf,
  type StoredRevisorAuthorship,
} from '@/forecasting/quick-evidence-authorship';
import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';
import {
  QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
  type QuickEvidenceCommitteeRollcallFeatureName,
} from './quick-evidence-committee-rollcall-extractor';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import {
  HISTORICAL_QUICK_REPLAY_VERSION,
  scoreHistoricalQuickReplay,
  type HistoricalQuickReplayEventResult,
  type HistoricalQuickReplayScorecard,
  type QuickReplayEvent,
} from './historical-quick-replay';

export const QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA =
  'quick-evidence-combined-historical-screen-input-v1' as const;
export const QUICK_EVIDENCE_COMBINED_SCREEN_SCHEMA =
  'quick-evidence-combined-historical-robustness-v2' as const;

const HALF_LIFE_DAYS = 180;
const TRAIN_SESSION = '2021-2022' as const;
const VALIDATION_SESSION = '2023-2024' as const;
const DESCRIPTIVE_SESSION = '2025-2026' as const;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;
type SessionSlug = typeof TRAIN_SESSION | typeof VALIDATION_SESSION | typeof DESCRIPTIVE_SESSION;

export const QUICK_EVIDENCE_COMBINED_FEATURES = [
  'priorSameBillYes',
  'priorSameBillNo',
  'priorCompanionYes',
  'priorCompanionNo',
  'billAuthor',
  'authorshipAvailable',
  'priorSameBillAmendmentYes',
  'priorSameBillAmendmentNo',
  'priorSameBillMotionProceduralYes',
  'priorSameBillMotionProceduralNo',
  'priorSameBillOtherYes',
  'priorSameBillOtherNo',
  'floorAmendmentOffers',
  'floorAmendmentWins',
  'conferenceConferee',
  'legislativeSpeechItems',
  'districtElectionContextAvailable',
  'districtElectionTopTwoMarginPct',
  'districtElectionUncontested',
  'billSummaryAvailable',
  ...QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
] as const;

export type QuickEvidenceCombinedFeatureName = typeof QUICK_EVIDENCE_COMBINED_FEATURES[number];

const COUNT_FEATURES = new Set<QuickEvidenceCombinedFeatureName>([
  'priorSameBillYes',
  'priorSameBillNo',
  'priorCompanionYes',
  'priorCompanionNo',
  'priorSameBillAmendmentYes',
  'priorSameBillAmendmentNo',
  'priorSameBillMotionProceduralYes',
  'priorSameBillMotionProceduralNo',
  'priorSameBillOtherYes',
  'priorSameBillOtherNo',
  'floorAmendmentOffers',
  'floorAmendmentWins',
  'legislativeSpeechItems',
  ...QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
]);

const BINARY_FEATURES = new Set<QuickEvidenceCombinedFeatureName>([
  'billAuthor',
  'authorshipAvailable',
  'conferenceConferee',
  'districtElectionContextAvailable',
  'districtElectionUncontested',
  'billSummaryAvailable',
]);

const FEATURE_INDEX = new Map<QuickEvidenceCombinedFeatureName, number>(
  QUICK_EVIDENCE_COMBINED_FEATURES.map((name, index) => [name, index]),
);

const FAMILIES = {
  priorPassage: ['priorSameBillYes', 'priorSameBillNo', 'priorCompanionYes', 'priorCompanionNo'],
  authorship: ['billAuthor', 'authorshipAvailable'],
  nonPassageVotes: [
    'priorSameBillAmendmentYes',
    'priorSameBillAmendmentNo',
    'priorSameBillMotionProceduralYes',
    'priorSameBillMotionProceduralNo',
    'priorSameBillOtherYes',
    'priorSameBillOtherNo',
  ],
  floorAmendment: ['floorAmendmentOffers', 'floorAmendmentWins'],
  conferee: ['conferenceConferee'],
  speech: ['legislativeSpeechItems'],
  districtContext: [
    'districtElectionContextAvailable',
    'districtElectionTopTwoMarginPct',
    'districtElectionUncontested',
  ],
  billContext: ['billSummaryAvailable'],
  committeeRollcall: [...QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES],
} satisfies Record<string, QuickEvidenceCombinedFeatureName[]>;

export interface QuickEvidenceCombinedScreenInputRow {
  voteEventId: string;
  membershipId: string;
  features: number[];
}

export interface QuickEvidenceCombinedScreenInput {
  schemaVersion: typeof QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA;
  committeeArtifact: {
    workflowRunId: number;
    headSha: string;
    artifactId: number;
    digest: string;
  };
  committeeFeatureNames: QuickEvidenceCommitteeRollcallFeatureName[];
  committeeRows: QuickEvidenceCombinedScreenInputRow[];
}

type PassageVoteRow = {
  bill_id: string;
  session_slug: SessionSlug;
  identifier: string;
  occurred_on: string;
  legislator_id: string;
  choice: 'yea' | 'nay';
};

type NonPassageVoteRow = {
  bill_id: string;
  occurred_on: string;
  legislator_id: string;
  vote_kind: 'amendment' | 'motion' | 'procedural' | 'other';
  choice: 'yea' | 'nay';
};

type StructuredMemberBillRow = {
  bill_id: string;
  membership_id: string;
  published_on: string;
  subtype: 'floor_amendment_offer' | 'conference_conferee' | 'legislative_speech';
  metadata: Record<string, unknown>;
};

type DistrictRow = {
  membership_id: string;
  metadata: Record<string, unknown>;
};

type SummaryRow = {
  bill_id: string;
  summary_on: string;
};

type RawObservation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  chamber: string;
  baseProbability: number;
  outcome: 0 | 1;
  raw: Record<QuickEvidenceCombinedFeatureName, number>;
};

type Observation = Omit<RawObservation, 'raw'> & {
  features: number[];
};

type DistrictStandardization = { mean: number; scale: number };

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

function targetByEvent(targets: readonly QuickReplayEvent[]): Map<string, QuickReplayEvent> {
  return new Map(targets.map((target) => [target.voteEventId, target]));
}

function emptyRaw(): Record<QuickEvidenceCombinedFeatureName, number> {
  return Object.fromEntries(
    QUICK_EVIDENCE_COMBINED_FEATURES.map((name) => [name, 0]),
  ) as Record<QuickEvidenceCombinedFeatureName, number>;
}

function numericMetadata(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function booleanMetadata(value: unknown): boolean {
  return value === true || value === 'true';
}

function strictBefore(value: string | undefined, targetDate: string): boolean {
  return Boolean(value && value.slice(0, 10) < targetDate);
}

function sameCommitteeNames(value: readonly string[]): boolean {
  return value.length === QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length
    && value.every((name, index) => name === QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES[index]);
}

function committeeMap(input: QuickEvidenceCombinedScreenInput): Map<string, number[]> {
  if (!sameCommitteeNames(input.committeeFeatureNames)) {
    throw new Error('Combined screen committee feature ordering does not match the frozen parser feature order');
  }
  if (!input.committeeArtifact.digest.startsWith('sha256:')) {
    throw new Error('Combined screen committee artifact digest must be SHA-256');
  }
  const result = new Map<string, number[]>();
  for (const row of input.committeeRows) {
    if (row.features.length !== QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.length) {
      throw new Error('Combined screen committee row has an invalid feature width');
    }
    const values = row.features.map((value) => {
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        throw new Error('Combined screen committee counts must be non-negative integers');
      }
      return value;
    });
    const key = `${row.voteEventId}|${row.membershipId}`;
    if (result.has(key)) throw new Error(`Duplicate combined committee feature row: ${key}`);
    result.set(key, values);
  }
  return result;
}

function countPassageVotes(
  rows: readonly PassageVoteRow[] | undefined,
  targetDate: string,
): { yes: number; no: number } {
  let yes = 0;
  let no = 0;
  for (const row of rows ?? []) {
    if (row.occurred_on >= targetDate) continue;
    if (row.choice === 'yea') yes += 1;
    else no += 1;
  }
  return { yes, no };
}

function countNonPassageVotes(
  rows: readonly NonPassageVoteRow[] | undefined,
  targetDate: string,
): {
  amendmentYes: number;
  amendmentNo: number;
  motionProceduralYes: number;
  motionProceduralNo: number;
  otherYes: number;
  otherNo: number;
} {
  const counts = {
    amendmentYes: 0,
    amendmentNo: 0,
    motionProceduralYes: 0,
    motionProceduralNo: 0,
    otherYes: 0,
    otherNo: 0,
  };
  for (const row of rows ?? []) {
    if (row.occurred_on >= targetDate) continue;
    const yes = row.choice === 'yea';
    if (row.vote_kind === 'amendment') counts[yes ? 'amendmentYes' : 'amendmentNo'] += 1;
    else if (row.vote_kind === 'motion' || row.vote_kind === 'procedural') {
      counts[yes ? 'motionProceduralYes' : 'motionProceduralNo'] += 1;
    } else counts[yes ? 'otherYes' : 'otherNo'] += 1;
  }
  return counts;
}

function districtAsOf(rows: readonly DistrictRow[] | undefined, targetDate: string) {
  const eligible = (rows ?? [])
    .map((row) => {
      const electionDate = typeof row.metadata.electionDate === 'string' ? row.metadata.electionDate : undefined;
      return { row, electionDate };
    })
    .filter((item) => strictBefore(item.electionDate, targetDate))
    .sort((left, right) => (right.electionDate ?? '').localeCompare(left.electionDate ?? ''));
  const selected = eligible[0]?.row;
  if (!selected) return undefined;
  const margin = numericMetadata(selected.metadata.topTwoMarginPct);
  if (margin === undefined) return undefined;
  return {
    topTwoMarginPct: margin,
    uncontested: booleanMetadata(selected.metadata.uncontested),
  };
}

function memberBillCounts(
  rows: readonly StructuredMemberBillRow[] | undefined,
  targetDate: string,
) {
  let floorAmendmentOffers = 0;
  let floorAmendmentWins = 0;
  let conferenceConferee = false;
  let legislativeSpeechItems = 0;
  for (const row of rows ?? []) {
    if (!strictBefore(row.published_on, targetDate)) continue;
    if (row.subtype === 'floor_amendment_offer') {
      floorAmendmentOffers += 1;
      if (booleanMetadata(row.metadata.rollCallWon)) floorAmendmentWins += 1;
    } else if (row.subtype === 'conference_conferee') {
      conferenceConferee = true;
    } else if (row.subtype === 'legislative_speech') {
      legislativeSpeechItems += 1;
    }
  }
  return { floorAmendmentOffers, floorAmendmentWins, conferenceConferee, legislativeSpeechItems };
}

function fitDistrictStandardization(rows: readonly RawObservation[]): DistrictStandardization {
  const available = rows
    .filter((row) => row.raw.districtElectionContextAvailable > 0)
    .map((row) => row.raw.districtElectionTopTwoMarginPct);
  if (available.length === 0) return { mean: 0, scale: 1 };
  const mean = available.reduce((sum, value) => sum + value, 0) / available.length;
  const variance = available.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    / Math.max(1, available.length - 1);
  const scale = Math.sqrt(variance);
  return { mean, scale: scale > 1e-9 ? scale : 1 };
}

function transformRaw(
  raw: Record<QuickEvidenceCombinedFeatureName, number>,
  district: DistrictStandardization,
): number[] {
  return QUICK_EVIDENCE_COMBINED_FEATURES.map((name) => {
    const value = raw[name] ?? 0;
    if (COUNT_FEATURES.has(name)) return Math.log1p(Math.max(0, value));
    if (BINARY_FEATURES.has(name)) return value > 0 ? 1 : 0;
    if (name === 'districtElectionTopTwoMarginPct') {
      return raw.districtElectionContextAvailable > 0 ? (value - district.mean) / district.scale : 0;
    }
    return value;
  });
}

function anyFeature(features: readonly number[]): boolean {
  return features.some((value) => Math.abs(value) > 1e-12);
}

function fitOffsetCoordinateRidge(observations: readonly Observation[], lambda: number): number[] {
  const width = QUICK_EVIDENCE_COMBINED_FEATURES.length;
  const beta = Array.from({ length: width }, () => 0);
  const eta = observations.map((row) => logit(row.baseProbability));

  for (let pass = 0; pass < 30; pass += 1) {
    let maxStep = 0;
    for (let column = 0; column < width; column += 1) {
      let gradient = -lambda * beta[column];
      let information = lambda;
      for (let rowIndex = 0; rowIndex < observations.length; rowIndex += 1) {
        const x = observations[rowIndex].features[column];
        if (Math.abs(x) < 1e-15) continue;
        const probability = logistic(eta[rowIndex]);
        gradient += x * (observations[rowIndex].outcome - probability);
        information += x * x * Math.max(1e-8, probability * (1 - probability));
      }
      if (information <= 1e-12) continue;
      const step = gradient / information;
      beta[column] += step;
      if (Math.abs(step) > maxStep) maxStep = Math.abs(step);
      if (Math.abs(step) > 0) {
        for (let rowIndex = 0; rowIndex < observations.length; rowIndex += 1) {
          const x = observations[rowIndex].features[column];
          if (Math.abs(x) > 1e-15) eta[rowIndex] += x * step;
        }
      }
    }
    if (maxStep < 1e-7) break;
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

function adjustReplay(
  baseline: readonly HistoricalQuickReplayEventResult[],
  featureByPair: ReadonlyMap<string, number[]>,
  beta: readonly number[],
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    const memberPredictions = event.memberPredictions.map((member) => {
      const features = featureByPair.get(`${event.voteEventId}|${member.membershipId}`);
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

function scoreBySession(
  events: readonly HistoricalQuickReplayEventResult[],
  session: SessionSlug,
): HistoricalQuickReplayScorecard {
  return scoreHistoricalQuickReplay(events.filter((event) => event.session === session)).overall;
}

function scoreBySessionChamber(
  events: readonly HistoricalQuickReplayEventResult[],
  session: SessionSlug,
  chamber: string,
): HistoricalQuickReplayScorecard {
  return scoreHistoricalQuickReplay(
    events.filter((event) => event.session === session && event.chamber === chamber),
  ).overall;
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

function memberSlice(
  observations: readonly Observation[],
  beta: readonly number[],
  predicate: (row: Observation, candidateProbability: number) => boolean,
) {
  const selected = observations.flatMap((row) => {
    const candidateProbability = applyOffset(row.baseProbability, row.features, beta);
    return predicate(row, candidateProbability)
      ? [{ row, candidateProbability }]
      : [];
  });
  if (selected.length === 0) return { observations: 0, available: false };
  const base = selected.map(({ row }) => ({ probability: row.baseProbability, outcome: row.outcome }));
  const candidate = selected.map(({ row, candidateProbability }) => ({
    probability: candidateProbability,
    outcome: row.outcome,
  }));
  return {
    observations: selected.length,
    available: true,
    baseline: {
      accuracy: binaryAccuracy(base),
      brier: brierScore(base),
      logLoss: logLoss(base),
      expectedCalibrationError: expectedCalibrationError(base),
    },
    candidate: {
      accuracy: binaryAccuracy(candidate),
      brier: brierScore(candidate),
      logLoss: logLoss(candidate),
      expectedCalibrationError: expectedCalibrationError(candidate),
    },
    deltaCandidateMinusBaseline: {
      brier: brierScore(candidate) - brierScore(base),
      logLoss: logLoss(candidate) - logLoss(base),
      expectedCalibrationError: expectedCalibrationError(candidate) - expectedCalibrationError(base),
      accuracy: binaryAccuracy(candidate) - binaryAccuracy(base),
    },
  };
}

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function robustnessMemberMetrics(
  observations: readonly Observation[],
  beta: readonly number[],
) {
  const eventGroups = new Map<string, Observation[]>();
  const chamberGroups = new Map<string, Observation[]>();
  for (const row of observations) {
    const byEvent = eventGroups.get(row.eventId) ?? [];
    byEvent.push(row);
    eventGroups.set(row.eventId, byEvent);
    const byChamber = chamberGroups.get(row.chamber) ?? [];
    byChamber.push(row);
    chamberGroups.set(row.chamber, byChamber);
  }

  const scoreGroup = (rows: readonly Observation[]) => {
    const baseline = rows.map((row) => ({ probability: row.baseProbability, outcome: row.outcome }));
    const candidate = rows.map((row) => ({
      probability: applyOffset(row.baseProbability, row.features, beta),
      outcome: row.outcome,
    }));
    return {
      observations: rows.length,
      baselineBrier: brierScore(baseline),
      candidateBrier: brierScore(candidate),
      brierDelta: brierScore(candidate) - brierScore(baseline),
      baselineLogLoss: logLoss(baseline),
      candidateLogLoss: logLoss(candidate),
      logLossDelta: logLoss(candidate) - logLoss(baseline),
    };
  };

  const eventScores = [...eventGroups.entries()].map(([eventId, rows]) => ({
    eventId,
    ...scoreGroup(rows),
  }));
  const chamberScores = [...chamberGroups.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([chamber, rows]) => ({ chamber, ...scoreGroup(rows) }));

  return {
    eventBalanced: {
      events: eventScores.length,
      baselineBrier: average(eventScores.map((row) => row.baselineBrier)),
      candidateBrier: average(eventScores.map((row) => row.candidateBrier)),
      brierDelta: average(eventScores.map((row) => row.brierDelta)),
      baselineLogLoss: average(eventScores.map((row) => row.baselineLogLoss)),
      candidateLogLoss: average(eventScores.map((row) => row.candidateLogLoss)),
      logLossDelta: average(eventScores.map((row) => row.logLossDelta)),
    },
    chamberBalanced: {
      chambers: chamberScores.length,
      baselineBrier: average(chamberScores.map((row) => row.baselineBrier)),
      candidateBrier: average(chamberScores.map((row) => row.candidateBrier)),
      brierDelta: average(chamberScores.map((row) => row.brierDelta)),
      baselineLogLoss: average(chamberScores.map((row) => row.baselineLogLoss)),
      candidateLogLoss: average(chamberScores.map((row) => row.candidateLogLoss)),
      logLossDelta: average(chamberScores.map((row) => row.logLossDelta)),
      byChamber: chamberScores,
    },
  };
}

function leaveOneFailedPassageEventOut(
  baseline: readonly HistoricalQuickReplayEventResult[],
  candidate: readonly HistoricalQuickReplayEventResult[],
  targets: ReadonlyMap<string, QuickReplayEvent>,
) {
  const failures = baseline.filter((event) =>
    event.session === VALIDATION_SESSION && event.status === 'replayable' && event.passed === false);
  return failures.map((failure) => {
    const baselineWithout = baseline.filter((event) =>
      event.session === VALIDATION_SESSION && event.voteEventId !== failure.voteEventId);
    const candidateWithout = candidate.filter((event) =>
      event.session === VALIDATION_SESSION && event.voteEventId !== failure.voteEventId);
    const baselineScore = scoreHistoricalQuickReplay(baselineWithout).overall;
    const candidateScore = scoreHistoricalQuickReplay(candidateWithout).overall;
    const target = targets.get(failure.voteEventId);
    return {
      omittedVoteEventId: failure.voteEventId,
      identifier: target?.identifier ?? null,
      chamber: failure.chamber,
      occurredOn: failure.occurredOn,
      baseline: baselineScore,
      candidate: candidateScore,
      deltaCandidateMinusBaseline: scoreDelta(candidateScore, baselineScore),
    };
  });
}

function coefficientObject(beta: readonly number[]) {
  return Object.fromEntries(QUICK_EVIDENCE_COMBINED_FEATURES.map((name, index) => [name, beta[index]]));
}

function zeroFamily(beta: readonly number[], names: readonly QuickEvidenceCombinedFeatureName[]): number[] {
  const result = [...beta];
  for (const name of names) {
    const index = FEATURE_INDEX.get(name);
    if (index !== undefined) result[index] = 0;
  }
  return result;
}

function sessionCoverage(observations: readonly Observation[], session: SessionSlug) {
  const rows = observations.filter((row) => row.session === session);
  const withEvidence = rows.filter((row) => anyFeature(row.features));
  return {
    memberOutcomes: rows.length,
    memberOutcomesWithAnyEvidence: withEvidence.length,
    eventsWithAnyEvidence: new Set(withEvidence.map((row) => row.eventId)).size,
    coverage: rows.length > 0 ? withEvidence.length / rows.length : 0,
  };
}

export async function evaluateQuickEvidenceCombinedHistoricalScreen(
  pool: Pool,
  input: QuickEvidenceCombinedScreenInput,
  options: { codeSha?: string | null } = {},
) {
  if (input.schemaVersion !== QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA) {
    throw new Error(`Unsupported combined screen input schema: ${String(input.schemaVersion)}`);
  }
  const committeeByPair = committeeMap(input);

  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  ).filter((event) => [TRAIN_SESSION, VALIDATION_SESSION, DESCRIPTIVE_SESSION].includes(event.session as SessionSlug));
  const targets = targetByEvent(dataset.targets);
  const targetBillIds = [...new Set(
    baseline.map((event) => targets.get(event.voteEventId)?.billId).filter((value): value is string => Boolean(value)),
  )];

  const [
    passageResult,
    nonPassageResult,
    authorshipResult,
    memberBillResult,
    districtResult,
    summaryResult,
  ] = await Promise.all([
    pool.query<PassageVoteRow>(`
      SELECT ve.bill_id::text,
             s.slug AS session_slug,
             upper(b.identifier) AS identifier,
             ve.occurred_on::text,
             m.legislator_id::text,
             mv.choice
        FROM vote_events ve
        JOIN bills b ON b.id=ve.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN member_votes mv ON mv.vote_event_id=ve.id
        JOIN memberships m ON m.id=mv.membership_id
       WHERE ve.is_passage=true
         AND ve.bill_id IS NOT NULL
         AND mv.choice IN ('yea','nay')
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       ORDER BY ve.occurred_on,ve.id,mv.id
    `),
    pool.query<NonPassageVoteRow>(`
      SELECT ve.bill_id::text,
             ve.occurred_on::text,
             m.legislator_id::text,
             ve.vote_kind,
             mv.choice
        FROM vote_events ve
        JOIN bills b ON b.id=ve.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN member_votes mv ON mv.vote_event_id=ve.id
        JOIN memberships m ON m.id=mv.membership_id
       WHERE ve.is_passage=false
         AND ve.bill_id IS NOT NULL
         AND ve.vote_kind IN ('amendment','motion','procedural','other')
         AND mv.choice IN ('yea','nay')
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       ORDER BY ve.occurred_on,ve.id,mv.id
    `),
    pool.query<{ bill_id: string; authorship: StoredRevisorAuthorship | null }>(`
      SELECT id::text AS bill_id,
             metadata -> 'revisorAuthorship' AS authorship
        FROM bills
       WHERE id=ANY($1::uuid[])
    `, [targetBillIds]),
    pool.query<StructuredMemberBillRow>(`
      SELECT ei.bill_id::text,
             ei.membership_id::text,
             ei.published_at::date::text AS published_on,
             ei.metadata->>'subtype' AS subtype,
             ei.metadata
        FROM evidence_items ei
        JOIN bills b ON b.id=ei.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
       WHERE ei.bill_id=ANY($1::uuid[])
         AND ei.membership_id IS NOT NULL
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'subtype' IN ('floor_amendment_offer','conference_conferee','legislative_speech')
         AND ei.metadata->>'asOfEligible' IS DISTINCT FROM 'false'
         AND ei.published_at::date >= s.starts_on
         AND (b.introduced_at IS NULL OR ei.published_at::date >= b.introduced_at::date)
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       ORDER BY ei.bill_id,ei.membership_id,ei.published_at,ei.id
    `, [targetBillIds]),
    pool.query<DistrictRow>(`
      SELECT ei.membership_id::text,
             ei.metadata
        FROM evidence_items ei
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
       WHERE ei.membership_id IS NOT NULL
         AND ei.metadata->>'subtype'='district_election_context'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       ORDER BY ei.membership_id,ei.id
    `),
    pool.query<SummaryRow>(`
      SELECT ei.bill_id::text,
             min(ei.published_at::date)::text AS summary_on
        FROM evidence_items ei
        JOIN bills b ON b.id=ei.bill_id
        JOIN legislative_sessions s ON s.id=b.session_id
       WHERE ei.bill_id=ANY($1::uuid[])
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'subtype'='bill_summary_version'
         AND ei.metadata->>'asOfEligible'='true'
         AND ei.published_at::date >= s.starts_on
         AND (b.introduced_at IS NULL OR ei.published_at::date >= b.introduced_at::date)
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       GROUP BY ei.bill_id
    `, [targetBillIds]),
  ]);

  const passageByBillLegislator = new Map<string, PassageVoteRow[]>();
  const passageByIdentifierLegislator = new Map<string, PassageVoteRow[]>();
  for (const row of passageResult.rows) {
    const billKey = `${row.bill_id}|${row.legislator_id}`;
    const byBill = passageByBillLegislator.get(billKey) ?? [];
    byBill.push(row);
    passageByBillLegislator.set(billKey, byBill);
    const identifierKey = `${row.session_slug}|${row.identifier}|${row.legislator_id}`;
    const byIdentifier = passageByIdentifierLegislator.get(identifierKey) ?? [];
    byIdentifier.push(row);
    passageByIdentifierLegislator.set(identifierKey, byIdentifier);
  }

  const nonPassageByBillLegislator = new Map<string, NonPassageVoteRow[]>();
  for (const row of nonPassageResult.rows) {
    const key = `${row.bill_id}|${row.legislator_id}`;
    const rows = nonPassageByBillLegislator.get(key) ?? [];
    rows.push(row);
    nonPassageByBillLegislator.set(key, rows);
  }

  const authorshipByBill = new Map(authorshipResult.rows.map((row) => [row.bill_id, row.authorship]));
  const memberBillByKey = new Map<string, StructuredMemberBillRow[]>();
  for (const row of memberBillResult.rows) {
    const key = `${row.bill_id}|${row.membership_id}`;
    const rows = memberBillByKey.get(key) ?? [];
    rows.push(row);
    memberBillByKey.set(key, rows);
  }
  const districtByMembership = new Map<string, DistrictRow[]>();
  for (const row of districtResult.rows) {
    const rows = districtByMembership.get(row.membership_id) ?? [];
    rows.push(row);
    districtByMembership.set(row.membership_id, rows);
  }
  const firstSummaryByBill = new Map(summaryResult.rows.map((row) => [row.bill_id, row.summary_on]));

  const rawObservations: RawObservation[] = [];
  const rawByPair = new Map<string, Record<QuickEvidenceCombinedFeatureName, number>>();
  for (const event of baseline) {
    const target = targets.get(event.voteEventId);
    if (!target || ![TRAIN_SESSION, VALIDATION_SESSION, DESCRIPTIVE_SESSION].includes(target.session as SessionSlug)) continue;
    const authors = authorshipMembershipIdsAsOf(authorshipByBill.get(target.billId), target.occurredOn);
    const authorshipAvailable = authors !== undefined;
    const billSummaryAvailable = strictBefore(firstSummaryByBill.get(target.billId), target.occurredOn);

    for (const member of event.memberPredictions) {
      const raw = emptyRaw();
      const same = countPassageVotes(
        passageByBillLegislator.get(`${target.billId}|${member.legislatorId}`),
        target.occurredOn,
      );
      raw.priorSameBillYes = same.yes;
      raw.priorSameBillNo = same.no;
      if (target.companionIdentifier) {
        const companion = countPassageVotes(
          passageByIdentifierLegislator.get(
            `${target.session}|${target.companionIdentifier.toUpperCase()}|${member.legislatorId}`,
          ),
          target.occurredOn,
        );
        raw.priorCompanionYes = companion.yes;
        raw.priorCompanionNo = companion.no;
      }

      raw.authorshipAvailable = authorshipAvailable ? 1 : 0;
      raw.billAuthor = authors?.has(member.membershipId) ? 1 : 0;

      const nonPassage = countNonPassageVotes(
        nonPassageByBillLegislator.get(`${target.billId}|${member.legislatorId}`),
        target.occurredOn,
      );
      raw.priorSameBillAmendmentYes = nonPassage.amendmentYes;
      raw.priorSameBillAmendmentNo = nonPassage.amendmentNo;
      raw.priorSameBillMotionProceduralYes = nonPassage.motionProceduralYes;
      raw.priorSameBillMotionProceduralNo = nonPassage.motionProceduralNo;
      raw.priorSameBillOtherYes = nonPassage.otherYes;
      raw.priorSameBillOtherNo = nonPassage.otherNo;

      const structured = memberBillCounts(
        memberBillByKey.get(`${target.billId}|${member.membershipId}`),
        target.occurredOn,
      );
      raw.floorAmendmentOffers = structured.floorAmendmentOffers;
      raw.floorAmendmentWins = structured.floorAmendmentWins;
      raw.conferenceConferee = structured.conferenceConferee ? 1 : 0;
      raw.legislativeSpeechItems = structured.legislativeSpeechItems;

      const district = districtAsOf(districtByMembership.get(member.membershipId), target.occurredOn);
      raw.districtElectionContextAvailable = district ? 1 : 0;
      raw.districtElectionTopTwoMarginPct = district?.topTwoMarginPct ?? 0;
      raw.districtElectionUncontested = district?.uncontested ? 1 : 0;
      raw.billSummaryAvailable = billSummaryAvailable ? 1 : 0;

      const committee = committeeByPair.get(`${event.voteEventId}|${member.membershipId}`);
      if (committee) {
        QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.forEach((name, index) => {
          raw[name] = committee[index];
        });
      }

      rawByPair.set(`${event.voteEventId}|${member.membershipId}`, raw);
      if (member.yesProbability === undefined || member.actualOutcome === undefined) continue;
      rawObservations.push({
        eventId: event.voteEventId,
        membershipId: member.membershipId,
        session: event.session as SessionSlug,
        chamber: event.chamber,
        baseProbability: member.yesProbability,
        outcome: member.actualOutcome,
        raw,
      });
    }
  }

  const baselinePairKeys = new Set(rawByPair.keys());
  const unresolvedCommitteeRows = [...committeeByPair.keys()].filter((key) => !baselinePairKeys.has(key));
  if (unresolvedCommitteeRows.length > 0) {
    throw new Error(
      `Combined committee rows no longer resolve to historical Quick: ${unresolvedCommitteeRows.slice(0, 5).join(', ')}`,
    );
  }

  const districtStandardization = fitDistrictStandardization(
    rawObservations.filter((row) => row.session === TRAIN_SESSION),
  );
  const observations: Observation[] = rawObservations.map((row) => ({
    eventId: row.eventId,
    membershipId: row.membershipId,
    session: row.session,
    chamber: row.chamber,
    baseProbability: row.baseProbability,
    outcome: row.outcome,
    features: transformRaw(row.raw, districtStandardization),
  }));
  const featureByPair = new Map<string, number[]>();
  for (const [key, raw] of rawByPair) featureByPair.set(key, transformRaw(raw, districtStandardization));

  const coverage = {
    training: sessionCoverage(observations, TRAIN_SESSION),
    validation: sessionCoverage(observations, VALIDATION_SESSION),
    descriptiveTest: sessionCoverage(observations, DESCRIPTIVE_SESSION),
  };
  const coverageGate = {
    minimumTrainingMemberOutcomesWithAnyEvidence: 1000,
    minimumValidationMemberOutcomesWithAnyEvidence: 1000,
    minimumTrainingEventsWithAnyEvidence: 20,
    minimumValidationEventsWithAnyEvidence: 20,
    passed: coverage.training.memberOutcomesWithAnyEvidence >= 1000
      && coverage.validation.memberOutcomesWithAnyEvidence >= 1000
      && coverage.training.eventsWithAnyEvidence >= 20
      && coverage.validation.eventsWithAnyEvidence >= 20,
  };

  const baselineScores = {
    training: scoreBySession(baseline, TRAIN_SESSION),
    validation: scoreBySession(baseline, VALIDATION_SESSION),
    descriptiveTest: scoreBySession(baseline, DESCRIPTIVE_SESSION),
  };

  const common = {
    schemaVersion: QUICK_EVIDENCE_COMBINED_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'historical Quick replay v2 robustness audit of the previously frozen combined Quick Evidence hypothesis; not a new independent validation set',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      quickEvidenceCandidate: 'quick-evidence-v1',
      sourcePlan: 'quick-evidence-combined-historical-robustness-plan-v2',
      historicalReplayVersion: HISTORICAL_QUICK_REPLAY_VERSION,
      independentValidationSet: false,
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      trainSession: TRAIN_SESSION,
      validationSession: VALIDATION_SESSION,
      descriptiveSession: DESCRIPTIVE_SESSION,
      featureNames: QUICK_EVIDENCE_COMBINED_FEATURES,
      candidateLambdas: LAMBDAS,
      maximumAbsoluteLogitDelta: QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
      districtStandardization,
      committeeArtifact: input.committeeArtifact,
      excludedFamilies: [
        'campaignFinance',
        'campaignSiteMemberPrimaryNewsAvailabilityCounts',
        'genericDirectionalCrawlerEvidence',
        'fiscalNoteContext',
      ],
      sameDayPolicy: 'strictly excluded where historical ordering is date-granular',
      historicalAvailabilityCorrections: {
        mutableCurrentBillTitleUsed: false,
        persistedHistoricalFeatureSetsUsed: false,
        currentCompanionMetadataUsed: false,
        companionSource: 'dated legislative_stage_events companion_reference strictly before target vote',
        asOfEligibleFalseEvidenceExcluded: true,
        billEvidenceMustNotPredateSessionOrIntroduction: true,
      },
      productionAction: 'none',
      servingQuickChanged: false,
      automaticPromotion: false,
    },
    coverage,
    coverageGate,
  };

  if (!coverageGate.passed) {
    return {
      ...common,
      candidates: [],
      selected: null,
      slices: null,
      ablations: [],
      conclusion: {
        productionAction: 'none',
        servingQuickChanged: false,
        quickEvidenceWeightChanged: false,
        hypothesisSignal: false,
        reason: 'coverage_gate_failed',
      },
    };
  }

  const training = observations.filter((row) => row.session === TRAIN_SESSION);
  const candidateFits = LAMBDAS.map((lambda) => {
    const beta = fitOffsetCoordinateRidge(training, lambda);
    const replay = adjustReplay(baseline, featureByPair, beta);
    const validation = scoreBySession(replay, VALIDATION_SESSION);
    return {
      lambda,
      beta,
      replay,
      validation,
      validationDelta: scoreDelta(validation, baselineScores.validation),
    };
  }).sort((left, right) => left.validation.memberBrier - right.validation.memberBrier
    || left.validation.memberLogLoss - right.validation.memberLogLoss
    || left.validation.chamberMeanAbsoluteYesError - right.validation.chamberMeanAbsoluteYesError
    || left.lambda - right.lambda);

  const selected = candidateFits[0];
  const candidateScores = {
    training: scoreBySession(selected.replay, TRAIN_SESSION),
    validation: selected.validation,
    descriptiveTest: scoreBySession(selected.replay, DESCRIPTIVE_SESSION),
  };
  const deltas = {
    training: scoreDelta(candidateScores.training, baselineScores.training),
    validation: scoreDelta(candidateScores.validation, baselineScores.validation),
    descriptiveTest: scoreDelta(candidateScores.descriptiveTest, baselineScores.descriptiveTest),
  };
  const validationObservations = observations.filter((row) => row.session === VALIDATION_SESSION);
  const robustnessMember = robustnessMemberMetrics(validationObservations, selected.beta);
  const leaveOneFailedPassageOut = leaveOneFailedPassageEventOut(
    baseline,
    selected.replay,
    targets,
  );
  const hypothesisSignal = deltas.validation.memberBrier <= -0.0005
    && deltas.validation.memberLogLoss <= 0
    && deltas.validation.chamberMeanAbsoluteYesError <= 0.25
    && deltas.validation.passageBrier <= 0.002
    && deltas.descriptiveTest.memberBrier <= 0.0005;

  const ablations = Object.entries(FAMILIES).map(([family, featureNames]) => {
    const beta = zeroFamily(selected.beta, featureNames);
    const replay = adjustReplay(baseline, featureByPair, beta);
    const validation = scoreBySession(replay, VALIDATION_SESSION);
    return {
      family,
      featureNames,
      validation,
      deltaCandidateMinusBaseline: scoreDelta(validation, baselineScores.validation),
      deltaAblatedMinusPrimaryCombined: scoreDelta(validation, candidateScores.validation),
      refit: false,
      selectedLambdaChanged: false,
    };
  });

  return {
    ...common,
    sourceCoverage: {
      passageVoteRows: passageResult.rows.length,
      nonPassageVoteRows: nonPassageResult.rows.length,
      authorshipBills: authorshipResult.rows.length,
      structuredMemberBillRows: memberBillResult.rows.length,
      districtRows: districtResult.rows.length,
      summaryBills: summaryResult.rows.length,
      committeeMemberEventRows: committeeByPair.size,
    },
    candidates: candidateFits.map((candidate) => ({
      lambda: candidate.lambda,
      beta: coefficientObject(candidate.beta),
      validation: candidate.validation,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: coefficientObject(selected.beta),
      baseline: baselineScores,
      candidate: candidateScores,
      deltaCandidateMinusBaseline: deltas,
    },
    slices: {
      validationWithAnyEvidence: memberSlice(
        validationObservations,
        selected.beta,
        (row) => anyFeature(row.features),
      ),
      validationMovedMembers: memberSlice(
        validationObservations,
        selected.beta,
        (row, candidateProbability) => Math.abs(candidateProbability - row.baseProbability) > 1e-12,
      ),
      validationHouse: {
        baseline: scoreBySessionChamber(baseline, VALIDATION_SESSION, 'house'),
        candidate: scoreBySessionChamber(selected.replay, VALIDATION_SESSION, 'house'),
      },
      validationSenate: {
        baseline: scoreBySessionChamber(baseline, VALIDATION_SESSION, 'senate'),
        candidate: scoreBySessionChamber(selected.replay, VALIDATION_SESSION, 'senate'),
      },
    },
    robustness: {
      memberMetrics: robustnessMember,
      passageByChamber: {
        house: {
          baseline: scoreBySessionChamber(baseline, VALIDATION_SESSION, 'house'),
          candidate: scoreBySessionChamber(selected.replay, VALIDATION_SESSION, 'house'),
          deltaCandidateMinusBaseline: scoreDelta(
            scoreBySessionChamber(selected.replay, VALIDATION_SESSION, 'house'),
            scoreBySessionChamber(baseline, VALIDATION_SESSION, 'house'),
          ),
        },
        senate: {
          baseline: scoreBySessionChamber(baseline, VALIDATION_SESSION, 'senate'),
          candidate: scoreBySessionChamber(selected.replay, VALIDATION_SESSION, 'senate'),
          deltaCandidateMinusBaseline: scoreDelta(
            scoreBySessionChamber(selected.replay, VALIDATION_SESSION, 'senate'),
            scoreBySessionChamber(baseline, VALIDATION_SESSION, 'senate'),
          ),
        },
      },
      leaveOneFailedPassageEventOut: leaveOneFailedPassageOut,
      selectionRetunedForRobustness: false,
    },
    ablations,
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      quickEvidenceWeightChanged: false,
      hypothesisSignal,
      reason: hypothesisSignal ? 'frozen_thresholds_cleared' : 'frozen_thresholds_not_cleared',
      note: hypothesisSignal
        ? 'The corrected historical-v2 robustness audit clears the old frozen thresholds, but the validation outcomes were already observed; this is not independent promotion evidence and cannot change serving Quick.'
        : 'The corrected historical-v2 robustness audit does not clear every old frozen threshold. Serving Quick remains unchanged.',
    },
  };
}

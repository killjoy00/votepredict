import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';

export const MEMBER_HISTORY_CAP20_PROSPECTIVE_SCORE_SCHEMA = 'member-history-cap20-prospective-score-v1' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT = 'member-history-cap20-prospective-v1' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION = '2027-2028' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_BASELINE_MODEL = 'member-eb-v1.1' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT = '2028-07-01T00:00:00Z' as const;
export const MEMBER_HISTORY_CAP20_PROSPECTIVE_SCOPE_CUTOFF = '2028-06-30' as const;

const HOUSE_MINIMUM_EVENTS = 20;
const HOUSE_MINIMUM_DECISIVE_MEMBERS = 2_500;
const SENATE_MINIMUM_EVENTS = 12;
const SENATE_MINIMUM_DECISIVE_MEMBERS = 700;

export interface ProspectiveShadowRevisionMember {
  membershipId: string;
  baselineProbability?: number | null;
  cap20Probability?: number | null;
}

export interface ProspectiveShadowRevision {
  revisionId: string;
  generatedAt: string;
  researchMode: 'quick' | 'deep';
  modelVersion: string | null;
  members: ProspectiveShadowRevisionMember[];
}

export interface ProspectiveMemberOutcome {
  membershipId: string;
  outcome: 0 | 1;
}

export interface ProspectiveVoteEvent {
  voteEventId: string;
  identifier: string;
  session: string;
  chamber: 'house' | 'senate';
  occurredOn: string;
  actualChamberYes: number;
  revisions: ProspectiveShadowRevision[];
  outcomes: ProspectiveMemberOutcome[];
}

interface MemberPair {
  probability: number;
  outcome: 0 | 1;
}

export interface ProspectiveCalibrationBin {
  lower: number;
  upper: number;
  observations: number;
  predictedMean: number | null;
  observedRate: number | null;
  signedResidual: number | null;
}

export interface ProspectiveMemberScore {
  observations: number;
  actualYesRate: number;
  meanYesProbability: number;
  signedResidual: number;
  brier: number;
  logLoss: number;
  accuracy: number;
  expectedCalibrationError: number;
}

export type ProspectiveCaptureExclusionReason =
  | 'no_strictly_prevote_quick_revision'
  | 'baseline_model_mismatch'
  | 'duplicate_membership_prediction'
  | 'baseline_probability_missing'
  | 'shadow_probability_missing'
  | 'probability_out_of_range'
  | 'no_matched_decisive_outcomes';

export interface ProspectiveCaseComparison {
  voteEventId: string;
  identifier: string;
  chamber: 'house' | 'senate';
  occurredOn: string;
  revisionId: string;
  generatedAt: string;
  forecastMembers: number;
  decisiveMemberOutcomes: number;
  unmatchedDecisiveMemberOutcomes: number;
  actualChamberYes: number;
  baseline: {
    memberBrier: number;
    memberSignedResidual: number;
    expectedYes: number;
    absoluteExpectedYesError: number;
  };
  cap20: {
    memberBrier: number;
    memberSignedResidual: number;
    expectedYes: number;
    absoluteExpectedYesError: number;
  };
  deltaCapMinusBaseline: {
    memberBrier: number;
    absoluteMemberSignedResidual: number;
    absoluteExpectedYesError: number;
  };
}

export interface ProspectiveSliceScore {
  chamber: 'house' | 'senate';
  inputEvents: number;
  eventsWithEligibleRevision: number;
  scoredEvents: number;
  decisiveMemberOutcomes: number;
  unmatchedDecisiveMemberOutcomes: number;
  exclusions: Array<{
    voteEventId: string;
    identifier: string;
    reason: ProspectiveCaptureExclusionReason;
    revisionId?: string;
  }>;
  baseline: ProspectiveMemberScore & {
    equalCaseBrier: number;
    equalCaseSignedResidual: number;
    chamberMeanAbsoluteExpectedYesError: number;
  };
  cap20: ProspectiveMemberScore & {
    equalCaseBrier: number;
    equalCaseSignedResidual: number;
    chamberMeanAbsoluteExpectedYesError: number;
  };
  deltaCapMinusBaseline: {
    brier: number;
    equalCaseBrier: number;
    logLoss: number;
    accuracy: number;
    expectedCalibrationError: number;
    signedResidual: number;
    absoluteMemberWeightedSignedResidual: number;
    equalCaseSignedResidual: number;
    absoluteEqualCaseSignedResidual: number;
    chamberMeanAbsoluteExpectedYesError: number;
  };
  calibration: {
    baseline: ProspectiveCalibrationBin[];
    cap20: ProspectiveCalibrationBin[];
  };
  cases: ProspectiveCaseComparison[];
}

export interface MemberHistoryCap20ProspectiveScoreArtifact {
  schemaVersion: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_SCORE_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    experiment: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT;
    session: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION;
    baselineModelVersion: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_BASELINE_MODEL;
    cap20MaximumMemberHistoryWeight: 20;
    revealAt: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT;
    scopeCutoffDate: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_SCOPE_CUTOFF;
    analysisStatus: 'prospective-final-reveal-only';
    probabilityAction: 'none';
    runtimeDefaultChange: false;
    promotionRequiresSeparateReviewedChange: true;
  };
  house: ProspectiveSliceScore & {
    decision: {
      status: 'pass' | 'fail' | 'inconclusive';
      minimumMet: boolean;
      criteria: Record<string, boolean>;
    };
  };
  senate: ProspectiveSliceScore & {
    decision: {
      status: 'pass' | 'fail' | 'inconclusive';
      minimumMet: boolean;
      criteria: Record<string, boolean>;
    };
  };
  conclusion: {
    status: 'eligible_for_separate_promotion_review' | 'do_not_promote' | 'inconclusive';
    productionAction: 'none';
    note: string;
  };
}

function finiteProbability(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('Cannot average an empty prospective score slice');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calendarDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid forecast timestamp ${value}`);
  return parsed.toISOString().slice(0, 10);
}

function assertRevealAllowed(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new Error('Prospective score reveal clock is invalid');
  if (now.getTime() < Date.parse(MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT)) {
    throw new Error(`Prospective cap-20 outcome scoring is sealed until ${MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT}`);
  }
}

function assertEventScope(event: ProspectiveVoteEvent): void {
  if (event.session !== MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION) {
    throw new Error(`Out-of-scope prospective session ${event.session}`);
  }
  if (event.occurredOn > MEMBER_HISTORY_CAP20_PROSPECTIVE_SCOPE_CUTOFF) {
    throw new Error(`Out-of-scope prospective vote date ${event.occurredOn}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.occurredOn)) throw new Error(`Invalid vote date ${event.occurredOn}`);
  if (!Number.isInteger(event.actualChamberYes) || event.actualChamberYes < 0) {
    throw new Error(`Invalid actual Chamber YEA count for ${event.voteEventId}`);
  }
  const outcomeIds = new Set<string>();
  for (const outcome of event.outcomes) {
    if (outcomeIds.has(outcome.membershipId)) throw new Error(`Duplicate decisive outcome membership ${outcome.membershipId}`);
    outcomeIds.add(outcome.membershipId);
    if (outcome.outcome !== 0 && outcome.outcome !== 1) throw new Error(`Invalid decisive outcome for ${outcome.membershipId}`);
  }
}

export function selectMemberHistoryCap20ProspectiveRevision(
  event: ProspectiveVoteEvent,
): ProspectiveShadowRevision | undefined {
  // Selection deliberately ignores shadow availability and outcomes. A missing
  // shadow on the latest otherwise-eligible revision is an exclusion, never a
  // reason to fall back to an older, more favorable revision.
  const eligible = event.revisions
    .filter((revision) => revision.researchMode === 'quick')
    .filter((revision) => calendarDate(revision.generatedAt) < event.occurredOn)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)
      || right.revisionId.localeCompare(left.revisionId));
  return eligible[0];
}

function memberScore(pairs: readonly MemberPair[]): ProspectiveMemberScore {
  if (pairs.length === 0) throw new Error('Cannot score an empty prospective member slice');
  const actualYesRate = mean(pairs.map((item) => item.outcome));
  const meanYesProbability = mean(pairs.map((item) => item.probability));
  return {
    observations: pairs.length,
    actualYesRate,
    meanYesProbability,
    signedResidual: actualYesRate - meanYesProbability,
    brier: brierScore(pairs),
    logLoss: logLoss(pairs),
    accuracy: binaryAccuracy(pairs),
    expectedCalibrationError: expectedCalibrationError(pairs),
  };
}

function calibrationBins(pairs: readonly MemberPair[], binCount = 10): ProspectiveCalibrationBin[] {
  return Array.from({ length: binCount }, (_, index) => {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    const rows = pairs.filter((item) => item.probability >= lower
      && (index === binCount - 1 ? item.probability <= upper : item.probability < upper));
    if (rows.length === 0) {
      return { lower, upper, observations: 0, predictedMean: null, observedRate: null, signedResidual: null };
    }
    const predictedMean = mean(rows.map((item) => item.probability));
    const observedRate = mean(rows.map((item) => item.outcome));
    return {
      lower,
      upper,
      observations: rows.length,
      predictedMean,
      observedRate,
      signedResidual: observedRate - predictedMean,
    };
  });
}

function emptyMemberScore(): ProspectiveMemberScore {
  return {
    observations: 0,
    actualYesRate: 0,
    meanYesProbability: 0,
    signedResidual: 0,
    brier: 0,
    logLoss: 0,
    accuracy: 0,
    expectedCalibrationError: 0,
  };
}

function scoreSlice(events: readonly ProspectiveVoteEvent[], chamber: 'house' | 'senate'): ProspectiveSliceScore {
  const sliceEvents = events.filter((event) => event.chamber === chamber);
  const exclusions: ProspectiveSliceScore['exclusions'] = [];
  const cases: ProspectiveCaseComparison[] = [];
  const baselinePairs: MemberPair[] = [];
  const capPairs: MemberPair[] = [];
  let eventsWithEligibleRevision = 0;
  let unmatchedDecisiveMemberOutcomes = 0;

  for (const event of sliceEvents) {
    const revision = selectMemberHistoryCap20ProspectiveRevision(event);
    if (!revision) {
      exclusions.push({ voteEventId: event.voteEventId, identifier: event.identifier, reason: 'no_strictly_prevote_quick_revision' });
      continue;
    }
    eventsWithEligibleRevision += 1;
    if (revision.modelVersion !== MEMBER_HISTORY_CAP20_PROSPECTIVE_BASELINE_MODEL) {
      exclusions.push({ voteEventId: event.voteEventId, identifier: event.identifier, reason: 'baseline_model_mismatch', revisionId: revision.revisionId });
      continue;
    }

    const memberIds = new Set<string>();
    let invalidReason: ProspectiveCaptureExclusionReason | undefined;
    for (const member of revision.members) {
      if (memberIds.has(member.membershipId)) {
        invalidReason = 'duplicate_membership_prediction';
        break;
      }
      memberIds.add(member.membershipId);
      if (member.baselineProbability === undefined || member.baselineProbability === null) {
        invalidReason = 'baseline_probability_missing';
        break;
      }
      if (member.cap20Probability === undefined || member.cap20Probability === null) {
        invalidReason = 'shadow_probability_missing';
        break;
      }
      if (!finiteProbability(member.baselineProbability) || !finiteProbability(member.cap20Probability)) {
        invalidReason = 'probability_out_of_range';
        break;
      }
    }
    if (invalidReason) {
      exclusions.push({ voteEventId: event.voteEventId, identifier: event.identifier, reason: invalidReason, revisionId: revision.revisionId });
      continue;
    }

    const predictionByMember = new Map(revision.members.map((member) => [member.membershipId, member]));
    const decisive = event.outcomes.flatMap((outcome) => {
      const prediction = predictionByMember.get(outcome.membershipId);
      if (!prediction || !finiteProbability(prediction.baselineProbability) || !finiteProbability(prediction.cap20Probability)) return [];
      return [{ outcome, prediction }];
    });
    const unmatched = event.outcomes.length - decisive.length;
    unmatchedDecisiveMemberOutcomes += unmatched;
    if (decisive.length === 0) {
      exclusions.push({ voteEventId: event.voteEventId, identifier: event.identifier, reason: 'no_matched_decisive_outcomes', revisionId: revision.revisionId });
      continue;
    }

    const caseBaselinePairs = decisive.map(({ outcome, prediction }) => ({ probability: prediction.baselineProbability as number, outcome: outcome.outcome }));
    const caseCapPairs = decisive.map(({ outcome, prediction }) => ({ probability: prediction.cap20Probability as number, outcome: outcome.outcome }));
    baselinePairs.push(...caseBaselinePairs);
    capPairs.push(...caseCapPairs);

    const caseBaselineScore = memberScore(caseBaselinePairs);
    const caseCapScore = memberScore(caseCapPairs);
    const baselineExpectedYes = revision.members.reduce((sum, member) => sum + (member.baselineProbability as number), 0);
    const capExpectedYes = revision.members.reduce((sum, member) => sum + (member.cap20Probability as number), 0);
    const baselineAbsoluteExpectedYesError = Math.abs(baselineExpectedYes - event.actualChamberYes);
    const capAbsoluteExpectedYesError = Math.abs(capExpectedYes - event.actualChamberYes);
    cases.push({
      voteEventId: event.voteEventId,
      identifier: event.identifier,
      chamber,
      occurredOn: event.occurredOn,
      revisionId: revision.revisionId,
      generatedAt: revision.generatedAt,
      forecastMembers: revision.members.length,
      decisiveMemberOutcomes: decisive.length,
      unmatchedDecisiveMemberOutcomes: unmatched,
      actualChamberYes: event.actualChamberYes,
      baseline: {
        memberBrier: caseBaselineScore.brier,
        memberSignedResidual: caseBaselineScore.signedResidual,
        expectedYes: baselineExpectedYes,
        absoluteExpectedYesError: baselineAbsoluteExpectedYesError,
      },
      cap20: {
        memberBrier: caseCapScore.brier,
        memberSignedResidual: caseCapScore.signedResidual,
        expectedYes: capExpectedYes,
        absoluteExpectedYesError: capAbsoluteExpectedYesError,
      },
      deltaCapMinusBaseline: {
        memberBrier: caseCapScore.brier - caseBaselineScore.brier,
        absoluteMemberSignedResidual: Math.abs(caseCapScore.signedResidual) - Math.abs(caseBaselineScore.signedResidual),
        absoluteExpectedYesError: capAbsoluteExpectedYesError - baselineAbsoluteExpectedYesError,
      },
    });
  }

  const baseline = baselinePairs.length > 0 ? memberScore(baselinePairs) : emptyMemberScore();
  const cap20 = capPairs.length > 0 ? memberScore(capPairs) : emptyMemberScore();
  const equalCaseBaselineBrier = cases.length > 0 ? mean(cases.map((item) => item.baseline.memberBrier)) : 0;
  const equalCaseCapBrier = cases.length > 0 ? mean(cases.map((item) => item.cap20.memberBrier)) : 0;
  const equalCaseBaselineSignedResidual = cases.length > 0 ? mean(cases.map((item) => item.baseline.memberSignedResidual)) : 0;
  const equalCaseCapSignedResidual = cases.length > 0 ? mean(cases.map((item) => item.cap20.memberSignedResidual)) : 0;
  const baselineChamberMae = cases.length > 0 ? mean(cases.map((item) => item.baseline.absoluteExpectedYesError)) : 0;
  const capChamberMae = cases.length > 0 ? mean(cases.map((item) => item.cap20.absoluteExpectedYesError)) : 0;

  return {
    chamber,
    inputEvents: sliceEvents.length,
    eventsWithEligibleRevision,
    scoredEvents: cases.length,
    decisiveMemberOutcomes: baselinePairs.length,
    unmatchedDecisiveMemberOutcomes,
    exclusions,
    baseline: {
      ...baseline,
      equalCaseBrier: equalCaseBaselineBrier,
      equalCaseSignedResidual: equalCaseBaselineSignedResidual,
      chamberMeanAbsoluteExpectedYesError: baselineChamberMae,
    },
    cap20: {
      ...cap20,
      equalCaseBrier: equalCaseCapBrier,
      equalCaseSignedResidual: equalCaseCapSignedResidual,
      chamberMeanAbsoluteExpectedYesError: capChamberMae,
    },
    deltaCapMinusBaseline: {
      brier: cap20.brier - baseline.brier,
      equalCaseBrier: equalCaseCapBrier - equalCaseBaselineBrier,
      logLoss: cap20.logLoss - baseline.logLoss,
      accuracy: cap20.accuracy - baseline.accuracy,
      expectedCalibrationError: cap20.expectedCalibrationError - baseline.expectedCalibrationError,
      signedResidual: cap20.signedResidual - baseline.signedResidual,
      absoluteMemberWeightedSignedResidual: Math.abs(cap20.signedResidual) - Math.abs(baseline.signedResidual),
      equalCaseSignedResidual: equalCaseCapSignedResidual - equalCaseBaselineSignedResidual,
      absoluteEqualCaseSignedResidual: Math.abs(equalCaseCapSignedResidual) - Math.abs(equalCaseBaselineSignedResidual),
      chamberMeanAbsoluteExpectedYesError: capChamberMae - baselineChamberMae,
    },
    calibration: {
      baseline: baselinePairs.length > 0 ? calibrationBins(baselinePairs) : [],
      cap20: capPairs.length > 0 ? calibrationBins(capPairs) : [],
    },
    cases: cases.sort((left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.voteEventId.localeCompare(right.voteEventId)),
  };
}

function houseDecision(score: ProspectiveSliceScore): MemberHistoryCap20ProspectiveScoreArtifact['house']['decision'] {
  const minimumMet = score.scoredEvents >= HOUSE_MINIMUM_EVENTS && score.decisiveMemberOutcomes >= HOUSE_MINIMUM_DECISIVE_MEMBERS;
  const criteria = {
    memberWeightedBrier: score.deltaCapMinusBaseline.brier <= -0.0001,
    equalCaseBrier: score.deltaCapMinusBaseline.equalCaseBrier <= -0.0001,
    expectedCalibrationError: score.deltaCapMinusBaseline.expectedCalibrationError <= 0,
    logLoss: score.deltaCapMinusBaseline.logLoss <= 0.002,
    accuracy: score.deltaCapMinusBaseline.accuracy >= -0.002,
    absoluteMemberWeightedSignedResidual: score.deltaCapMinusBaseline.absoluteMemberWeightedSignedResidual <= 0,
    absoluteEqualCaseSignedResidual: score.deltaCapMinusBaseline.absoluteEqualCaseSignedResidual <= 0,
    chamberMeanAbsoluteExpectedYesError: score.deltaCapMinusBaseline.chamberMeanAbsoluteExpectedYesError <= 0,
  };
  return {
    status: !minimumMet ? 'inconclusive' : Object.values(criteria).every(Boolean) ? 'pass' : 'fail',
    minimumMet,
    criteria,
  };
}

function senateDecision(score: ProspectiveSliceScore): MemberHistoryCap20ProspectiveScoreArtifact['senate']['decision'] {
  const minimumMet = score.scoredEvents >= SENATE_MINIMUM_EVENTS && score.decisiveMemberOutcomes >= SENATE_MINIMUM_DECISIVE_MEMBERS;
  const criteria = {
    memberWeightedBrier: score.deltaCapMinusBaseline.brier <= 0.001,
    logLoss: score.deltaCapMinusBaseline.logLoss <= 0.003,
    accuracy: score.deltaCapMinusBaseline.accuracy >= -0.002,
    chamberMeanAbsoluteExpectedYesError: score.deltaCapMinusBaseline.chamberMeanAbsoluteExpectedYesError <= 0.5,
  };
  return {
    status: !minimumMet ? 'inconclusive' : Object.values(criteria).every(Boolean) ? 'pass' : 'fail',
    minimumMet,
    criteria,
  };
}

export function evaluateMemberHistoryCap20ProspectiveScore(
  events: readonly ProspectiveVoteEvent[],
  options: { now?: Date } = {},
): MemberHistoryCap20ProspectiveScoreArtifact {
  const now = options.now ?? new Date();
  assertRevealAllowed(now);
  const eventIds = new Set<string>();
  for (const event of events) {
    assertEventScope(event);
    if (eventIds.has(event.voteEventId)) throw new Error(`Duplicate prospective vote event ${event.voteEventId}`);
    eventIds.add(event.voteEventId);
  }

  const houseScore = scoreSlice(events, 'house');
  const senateScore = scoreSlice(events, 'senate');
  const house = { ...houseScore, decision: houseDecision(houseScore) };
  const senate = { ...senateScore, decision: senateDecision(senateScore) };
  const status = house.decision.status === 'pass' && senate.decision.status === 'pass'
    ? 'eligible_for_separate_promotion_review'
    : house.decision.status === 'fail' || senate.decision.status === 'fail'
      ? 'do_not_promote'
      : 'inconclusive';

  return {
    schemaVersion: MEMBER_HISTORY_CAP20_PROSPECTIVE_SCORE_SCHEMA,
    generatedAt: now.toISOString(),
    purpose: 'single final prospective comparison of the frozen cap-20 member-history shadow candidate against the uncapped member-eb-v1.1 baseline; scoring is outcome-sealed until the predeclared reveal date and authorizes no automatic production action',
    metadata: {
      experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
      session: MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION,
      baselineModelVersion: MEMBER_HISTORY_CAP20_PROSPECTIVE_BASELINE_MODEL,
      cap20MaximumMemberHistoryWeight: 20,
      revealAt: MEMBER_HISTORY_CAP20_PROSPECTIVE_REVEAL_AT,
      scopeCutoffDate: MEMBER_HISTORY_CAP20_PROSPECTIVE_SCOPE_CUTOFF,
      analysisStatus: 'prospective-final-reveal-only',
      probabilityAction: 'none',
      runtimeDefaultChange: false,
      promotionRequiresSeparateReviewedChange: true,
    },
    house,
    senate,
    conclusion: {
      status,
      productionAction: 'none',
      note: status === 'eligible_for_separate_promotion_review'
        ? 'Both the frozen House primary rule and Senate safety rule passed. This result still requires a separate reviewed production-promotion change.'
        : status === 'do_not_promote'
          ? 'At least one frozen prospective rule failed. Cap 20 must not be promoted from this experiment.'
          : 'At least one frozen minimum sample was not met. The result is inconclusive and cannot promote cap 20.',
    },
  };
}

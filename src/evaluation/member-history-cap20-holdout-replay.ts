import type { Pool } from 'pg';
import {
  BILL_FEATURE_SCHEMA_VERSION,
  DETERMINISTIC_EXTRACTOR_VERSION,
  type DeterministicBillFeatures,
} from '../features/bills';
import { MEMBER_MODEL_VERSION } from '../forecasting/member-model';
import type { HistoricalDeepHouseJournalHoldoutCohort } from './historical-deep-house-journal-holdout-cohort';
import type {
  HistoricalDeepHouseJournalHoldoutScoreArtifact,
  HistoricalDeepHouseJournalHoldoutScoreCase,
} from './historical-deep-house-journal-holdout-score';
import {
  buildHistoricalQuickAnalogueSupport,
  type HistoricalQuickReplayEventResult,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from './historical-quick-replay';
import { runHistoricalQuickShadowReplay } from './historical-quick-shadow-replay';
import { binaryAccuracy, brierScore, expectedCalibrationError, logLoss } from './metrics';

export const MEMBER_HISTORY_CAP20_HOLDOUT_REPLAY_SCHEMA = 'member-history-cap20-holdout-replay-v1' as const;
export const MEMBER_HISTORY_CAP20 = 20 as const;

interface MemberPair {
  probability: number;
  outcome: 0 | 1;
}

interface MemberScore {
  observations: number;
  actualYesRate: number;
  meanYesProbability: number;
  signedResidual: number;
  brier: number;
  logLoss: number;
  accuracy: number;
  expectedCalibrationError: number;
}

interface CalibrationBin {
  lower: number;
  upper: number;
  observations: number;
  predictedMean: number | null;
  observedRate: number | null;
  signedResidual: number | null;
}

interface CaseComparison {
  stableKey: string;
  voteEventId: string;
  identifier: string;
  occurredOn: string;
  decisiveMemberOutcomes: number;
  actualYesVotes: number;
  actualYesRate: number;
  actualChamberYes: number;
  baseline: {
    memberMeanYesProbability: number;
    memberSignedResidual: number;
    expectedYes: number;
    expectedYesError: number;
    absoluteExpectedYesError: number;
  };
  cap20: {
    memberMeanYesProbability: number;
    memberSignedResidual: number;
    expectedYes: number;
    expectedYesError: number;
    absoluteExpectedYesError: number;
  };
  deltaCapMinusBaseline: {
    memberMeanYesProbability: number;
    absoluteMemberResidual: number;
    absoluteExpectedYesError: number;
  };
}

export interface MemberHistoryCap20HoldoutReplayArtifact {
  schemaVersion: typeof MEMBER_HISTORY_CAP20_HOLDOUT_REPLAY_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    runtimeCodeSha: string | null;
    modelVersion: typeof MEMBER_MODEL_VERSION;
    maximumMemberHistoryWeight: typeof MEMBER_HISTORY_CAP20;
    analysisStatus: 'post-reveal-descriptive-shadow-only';
    probabilityAction: 'none';
    runtimeDefaultChange: false;
    modelVersionChange: false;
    baselineValidation: {
      decisiveMemberProbabilitiesChecked: number;
      maximumAbsoluteProbabilityDifference: number;
      targetVersionMismatches: 0;
      activeMemberMismatches: 0;
    };
    interpretationGuard: string;
  };
  input: {
    frozenCases: 24;
    decisiveMemberOutcomes: number;
  };
  summary: {
    baseline: MemberScore & {
      chamberMeanAbsoluteExpectedYesError: number;
      equalCaseSignedResidual: number;
    };
    cap20: MemberScore & {
      chamberMeanAbsoluteExpectedYesError: number;
      equalCaseSignedResidual: number;
    };
    deltaCapMinusBaseline: {
      brier: number;
      logLoss: number;
      accuracy: number;
      expectedCalibrationError: number;
      signedResidual: number;
      absoluteSignedResidual: number;
      equalCaseSignedResidual: number;
      absoluteEqualCaseSignedResidual: number;
      chamberMeanAbsoluteExpectedYesError: number;
    };
    calibration: {
      baseline: CalibrationBin[];
      cap20: CalibrationBin[];
    };
  };
  cases: CaseComparison[];
  conclusion: {
    productionAction: 'none';
    prospectiveValidationRequired: true;
    note: string;
  };
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function memberScore(pairs: readonly MemberPair[]): MemberScore {
  if (pairs.length === 0) throw new Error('Cannot score an empty member slice');
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

function calibrationBins(pairs: readonly MemberPair[], binCount = 10): CalibrationBin[] {
  return Array.from({ length: binCount }, (_, index) => {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    const rows = pairs.filter((item) => item.probability >= lower
      && (index === binCount - 1 ? item.probability <= upper : item.probability < upper));
    if (rows.length === 0) return { lower, upper, observations: 0, predictedMean: null, observedRate: null, signedResidual: null };
    const predictedMean = mean(rows.map((item) => item.probability));
    const observedRate = mean(rows.map((item) => item.outcome));
    return { lower, upper, observations: rows.length, predictedMean, observedRate, signedResidual: observedRate - predictedMean };
  });
}

function assertFrozenInputs(
  cohort: HistoricalDeepHouseJournalHoldoutCohort,
  frozen: HistoricalDeepHouseJournalHoldoutScoreArtifact,
): void {
  if (cohort.schemaVersion !== 'historical-deep-house-journal-holdout-cohort-v1' || cohort.cases.length !== 24) {
    throw new Error('Exact frozen 24-case House Journal holdout cohort is required');
  }
  if (frozen.schemaVersion !== 'historical-deep-house-journal-holdout-score-v1' || frozen.cases.length !== 24) {
    throw new Error('Exact frozen 24-case uncapped holdout score is required');
  }
  if (cohort.cases.some((item) => item.session !== '2025-2026' || item.chamber !== 'house')) {
    throw new Error('Cap-20 holdout replay supports only the frozen 2025-2026 House cohort');
  }
  const cohortKeys = new Set(cohort.cases.map((item) => item.stableKey));
  const scoreKeys = new Set(frozen.cases.map((item) => item.stableKey));
  if (cohortKeys.size !== 24 || scoreKeys.size !== 24 || [...cohortKeys].some((key) => !scoreKeys.has(key))) {
    throw new Error('Frozen cohort and uncapped score stable-key lineage differ');
  }
  if (frozen.metadata.probabilityAction !== 'none' || frozen.metadata.actionabilityDecision !== 'none') {
    throw new Error('Frozen holdout score crossed its no-action boundary');
  }
  if (frozen.cases.some((item) => item.quickModelVersion !== MEMBER_MODEL_VERSION)) {
    throw new Error('Frozen holdout Quick model version differs from current member model version');
  }
}

function frozenCaseByVote(frozen: HistoricalDeepHouseJournalHoldoutScoreArtifact): Map<string, HistoricalDeepHouseJournalHoldoutScoreCase> {
  return new Map(frozen.cases.map((item) => [item.voteEventId, item]));
}

function replayByVote(results: readonly HistoricalQuickReplayEventResult[]): Map<string, HistoricalQuickReplayEventResult> {
  return new Map(results.map((item) => [item.voteEventId, item]));
}

export async function evaluateMemberHistoryCap20HoldoutReplay(
  pool: Pool,
  input: {
    cohort: HistoricalDeepHouseJournalHoldoutCohort;
    frozenScore: HistoricalDeepHouseJournalHoldoutScoreArtifact;
    codeSha?: string | null;
  },
): Promise<MemberHistoryCap20HoldoutReplayArtifact> {
  assertFrozenInputs(input.cohort, input.frozenScore);

  const versionResult = await pool.query<{
    id: string;
    bill_id: string;
    published_at: string;
    created_at: string;
    raw_text: string;
    features: DeterministicBillFeatures | null;
  }>(`
    SELECT bv.id,
           bv.bill_id,
           to_char(bv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
           to_char(bv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           bv.raw_text,
           bfs.features
      FROM bill_versions bv
      LEFT JOIN bill_feature_sets bfs
        ON bfs.bill_version_id = bv.id
       AND bfs.feature_schema_version = $1
       AND bfs.extractor_version = $2
     WHERE bv.published_at IS NOT NULL
       AND bv.raw_text IS NOT NULL
       AND length(bv.raw_text) >= 100`, [BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION]);
  const versionsByBill = new Map<string, QuickReplayVersion[]>();
  for (const row of versionResult.rows) {
    const values = versionsByBill.get(row.bill_id) ?? [];
    values.push({
      id: row.id,
      billId: row.bill_id,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      rawText: row.raw_text,
      features: row.features ?? undefined,
    });
    versionsByBill.set(row.bill_id, values);
  }

  const eventResult = await pool.query<{
    vote_event_id: string;
    bill_id: string;
    identifier: string;
    title: string;
    session_id: string;
    session_slug: string;
    chamber_id: string;
    chamber_slug: string;
    occurred_on: string;
    yea_count: number | null;
    nay_count: number | null;
    passed: boolean | null;
    companion_identifier: string | null;
  }>(`
    SELECT ve.id AS vote_event_id,
           b.id AS bill_id,
           b.identifier,
           b.title,
           s.id AS session_id,
           s.slug AS session_slug,
           c.id AS chamber_id,
           c.slug AS chamber_slug,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed,
           b.metadata #>> '{revisor,companionIdentifier}' AS companion_identifier
      FROM vote_events ve
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
     WHERE ve.is_passage = true
       AND ve.bill_id IS NOT NULL
       AND ve.occurred_on < CURRENT_DATE
     ORDER BY ve.occurred_on, ve.id`);
  const events: QuickReplayEvent[] = eventResult.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    billId: row.bill_id,
    identifier: row.identifier,
    title: row.title,
    sessionId: row.session_id,
    session: row.session_slug,
    chamberId: row.chamber_id,
    chamber: row.chamber_slug,
    occurredOn: row.occurred_on,
    yeaCount: toNumber(row.yea_count),
    nayCount: toNumber(row.nay_count),
    passed: row.passed,
    companionIdentifier: row.companion_identifier ?? undefined,
  }));

  const voteResult = await pool.query<{
    vote_event_id: string;
    occurred_on: string;
    chamber_id: string;
    membership_id: string;
    legislator_id: string;
    party: string;
    choice: 'yea' | 'nay';
  }>(`
    SELECT mv.vote_event_id,
           ve.occurred_on::text,
           ve.chamber_id,
           mv.membership_id,
           m.legislator_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           mv.choice
      FROM member_votes mv
      JOIN vote_events ve ON ve.id = mv.vote_event_id AND ve.is_passage = true
      JOIN memberships m ON m.id = mv.membership_id
     WHERE mv.choice IN ('yea', 'nay')
     ORDER BY ve.occurred_on, ve.id, mv.id`);
  const historicalVotes: QuickReplayVote[] = voteResult.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    occurredOn: row.occurred_on,
    chamberId: row.chamber_id,
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    party: row.party,
    choice: row.choice,
  }));
  const votesByEvent = new Map<string, Map<string, 'yea' | 'nay'>>();
  const decisiveVotesByEvent = new Map<string, number>();
  for (const vote of historicalVotes) {
    const eventVotes = votesByEvent.get(vote.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
    eventVotes.set(vote.legislatorId, vote.choice);
    votesByEvent.set(vote.voteEventId, eventVotes);
    decisiveVotesByEvent.set(vote.voteEventId, (decisiveVotesByEvent.get(vote.voteEventId) ?? 0) + 1);
  }

  const analogueBuild = buildHistoricalQuickAnalogueSupport(events, versionsByBill, votesByEvent);
  const targets = events.filter((event) =>
    event.passed !== null
    && analogueBuild.targetVersionByEvent.has(event.voteEventId)
    && (decisiveVotesByEvent.get(event.voteEventId) ?? 0) >= 20);

  const membershipResult = await pool.query<{
    membership_id: string;
    legislator_id: string;
    session_id: string;
    chamber_id: string;
    party: string;
    starts_on: string | null;
    ends_on: string | null;
  }>(`
    SELECT m.id AS membership_id,
           m.legislator_id,
           m.session_id,
           m.chamber_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           m.starts_on::text,
           m.ends_on::text
      FROM memberships m
      JOIN legislative_sessions s ON s.id = m.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'`);
  const memberships: QuickReplayMembership[] = membershipResult.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    sessionId: row.session_id,
    chamberId: row.chamber_id,
    party: row.party,
    startsOn: row.starts_on ?? undefined,
    endsOn: row.ends_on ?? undefined,
  }));

  const uncappedReplay = runHistoricalQuickShadowReplay(
    targets,
    analogueBuild.targetVersionByEvent,
    analogueBuild.supportByEvent,
    memberships,
    historicalVotes,
  );
  const cap20Replay = runHistoricalQuickShadowReplay(
    targets,
    analogueBuild.targetVersionByEvent,
    analogueBuild.supportByEvent,
    memberships,
    historicalVotes,
    { maximumMemberHistoryWeight: MEMBER_HISTORY_CAP20 },
  );
  const uncappedByVote = replayByVote(uncappedReplay);
  const cap20ByVote = replayByVote(cap20Replay);
  const frozenByVote = frozenCaseByVote(input.frozenScore);

  const baselinePairs: MemberPair[] = [];
  const capPairs: MemberPair[] = [];
  const cases: CaseComparison[] = [];
  let maxProbabilityDifference = 0;
  let checkedProbabilities = 0;

  for (const cohortCase of input.cohort.cases) {
    const frozenCase = frozenByVote.get(cohortCase.voteEventId);
    const uncapped = uncappedByVote.get(cohortCase.voteEventId);
    const capped = cap20ByVote.get(cohortCase.voteEventId);
    if (!frozenCase || !uncapped || !capped) throw new Error(`Missing cap replay lineage for ${cohortCase.stableKey}`);
    if (uncapped.status !== 'replayable' || capped.status !== 'replayable') {
      throw new Error(`Frozen holdout case is not replayable under both variants: ${cohortCase.stableKey}`);
    }
    if (uncapped.targetVersionId !== cohortCase.targetVersionId || capped.targetVersionId !== cohortCase.targetVersionId) {
      throw new Error(`Target-version drift for ${cohortCase.stableKey}`);
    }
    if (uncapped.activeMembers !== cohortCase.activeMembers || capped.activeMembers !== cohortCase.activeMembers) {
      throw new Error(`Active-member drift for ${cohortCase.stableKey}`);
    }
    if (uncapped.selectedAnalogues !== capped.selectedAnalogues || uncapped.directAnalogueMembers !== capped.directAnalogueMembers) {
      throw new Error(`Cap changed analogue lineage for ${cohortCase.stableKey}`);
    }
    const uncappedMembers = new Map(uncapped.memberPredictions.map((item) => [item.legislatorId, item]));
    const cappedMembers = new Map(capped.memberPredictions.map((item) => [item.legislatorId, item]));
    const caseBaselinePairs: MemberPair[] = [];
    const caseCapPairs: MemberPair[] = [];
    for (const frozenMember of frozenCase.members) {
      const uncappedMember = uncappedMembers.get(frozenMember.legislatorId);
      const cappedMember = cappedMembers.get(frozenMember.legislatorId);
      if (!uncappedMember || !cappedMember
        || uncappedMember.membershipId !== frozenMember.membershipId
        || cappedMember.membershipId !== frozenMember.membershipId) {
        throw new Error(`Member lineage drift for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      if (uncappedMember.yesProbability === undefined || cappedMember.yesProbability === undefined) {
        throw new Error(`Missing Quick probability for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      if (uncappedMember.actualOutcome !== frozenMember.actualOutcome || cappedMember.actualOutcome !== frozenMember.actualOutcome) {
        throw new Error(`Outcome lineage drift for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      const difference = Math.abs(uncappedMember.yesProbability - frozenMember.yesProbability);
      maxProbabilityDifference = Math.max(maxProbabilityDifference, difference);
      checkedProbabilities += 1;
      if (difference > 1e-12) {
        throw new Error(`Uncapped Quick probability drift ${difference} for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      const baselinePair = { probability: frozenMember.yesProbability, outcome: frozenMember.actualOutcome };
      const capPair = { probability: cappedMember.yesProbability, outcome: frozenMember.actualOutcome };
      baselinePairs.push(baselinePair);
      capPairs.push(capPair);
      caseBaselinePairs.push(baselinePair);
      caseCapPairs.push(capPair);
    }
    const baselineCaseScore = memberScore(caseBaselinePairs);
    const capCaseScore = memberScore(caseCapPairs);
    if (uncapped.expectedYes === undefined || capped.expectedYes === undefined) {
      throw new Error(`Missing chamber expected-Yes replay for ${cohortCase.stableKey}`);
    }
    const baselineYesError = uncapped.expectedYes - uncapped.actualYes;
    const capYesError = capped.expectedYes - capped.actualYes;
    cases.push({
      stableKey: cohortCase.stableKey,
      voteEventId: cohortCase.voteEventId,
      identifier: cohortCase.identifier,
      occurredOn: cohortCase.occurredOn,
      decisiveMemberOutcomes: caseBaselinePairs.length,
      actualYesVotes: caseBaselinePairs.filter((item) => item.outcome === 1).length,
      actualYesRate: baselineCaseScore.actualYesRate,
      actualChamberYes: uncapped.actualYes,
      baseline: {
        memberMeanYesProbability: baselineCaseScore.meanYesProbability,
        memberSignedResidual: baselineCaseScore.signedResidual,
        expectedYes: uncapped.expectedYes,
        expectedYesError: baselineYesError,
        absoluteExpectedYesError: Math.abs(baselineYesError),
      },
      cap20: {
        memberMeanYesProbability: capCaseScore.meanYesProbability,
        memberSignedResidual: capCaseScore.signedResidual,
        expectedYes: capped.expectedYes,
        expectedYesError: capYesError,
        absoluteExpectedYesError: Math.abs(capYesError),
      },
      deltaCapMinusBaseline: {
        memberMeanYesProbability: capCaseScore.meanYesProbability - baselineCaseScore.meanYesProbability,
        absoluteMemberResidual: Math.abs(capCaseScore.signedResidual) - Math.abs(baselineCaseScore.signedResidual),
        absoluteExpectedYesError: Math.abs(capYesError) - Math.abs(baselineYesError),
      },
    });
  }

  if (checkedProbabilities !== input.frozenScore.input.decisiveMemberOutcomes) {
    throw new Error(`Validated ${checkedProbabilities} baseline probabilities, expected ${input.frozenScore.input.decisiveMemberOutcomes}`);
  }
  const baseline = memberScore(baselinePairs);
  const cap20 = memberScore(capPairs);
  const tolerance = 1e-12;
  if (Math.abs(baseline.brier - input.frozenScore.summary.overall.quickBrier) > tolerance
    || Math.abs(baseline.logLoss - input.frozenScore.summary.overall.quickLogLoss) > tolerance
    || Math.abs(baseline.accuracy - input.frozenScore.summary.overall.quickAccuracy) > tolerance
    || Math.abs(baseline.signedResidual - input.frozenScore.summary.overall.memberWeightedSignedResidual) > tolerance) {
    throw new Error('Recomputed immutable uncapped holdout metrics drifted from #176');
  }
  const baselineCaseResidual = mean(cases.map((item) => item.baseline.memberSignedResidual));
  const capCaseResidual = mean(cases.map((item) => item.cap20.memberSignedResidual));
  const baselineChamberMae = mean(cases.map((item) => item.baseline.absoluteExpectedYesError));
  const capChamberMae = mean(cases.map((item) => item.cap20.absoluteExpectedYesError));

  return {
    schemaVersion: MEMBER_HISTORY_CAP20_HOLDOUT_REPLAY_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'post-reveal descriptive replay of the mechanically selected cap-20 member-history shadow candidate on the exact immutable 24-case 2025-2026 House holdout; full historical Quick analogue and roster logic is unchanged; no serving or probability write occurs',
    metadata: {
      runtimeCodeSha: input.codeSha ?? null,
      modelVersion: MEMBER_MODEL_VERSION,
      maximumMemberHistoryWeight: MEMBER_HISTORY_CAP20,
      analysisStatus: 'post-reveal-descriptive-shadow-only',
      probabilityAction: 'none',
      runtimeDefaultChange: false,
      modelVersionChange: false,
      baselineValidation: {
        decisiveMemberProbabilitiesChecked: checkedProbabilities,
        maximumAbsoluteProbabilityDifference: maxProbabilityDifference,
        targetVersionMismatches: 0,
        activeMemberMismatches: 0,
      },
      interpretationGuard: 'The cap was nominated after 2025-2026 outcomes were already available, so this replay is descriptive only. Exact uncapped decisive-member probabilities are re-derived and required to match the immutable #176 artifact to 1e-12 before the cap comparison is accepted.',
    },
    input: {
      frozenCases: 24,
      decisiveMemberOutcomes: checkedProbabilities,
    },
    summary: {
      baseline: {
        ...baseline,
        chamberMeanAbsoluteExpectedYesError: baselineChamberMae,
        equalCaseSignedResidual: baselineCaseResidual,
      },
      cap20: {
        ...cap20,
        chamberMeanAbsoluteExpectedYesError: capChamberMae,
        equalCaseSignedResidual: capCaseResidual,
      },
      deltaCapMinusBaseline: {
        brier: cap20.brier - baseline.brier,
        logLoss: cap20.logLoss - baseline.logLoss,
        accuracy: cap20.accuracy - baseline.accuracy,
        expectedCalibrationError: cap20.expectedCalibrationError - baseline.expectedCalibrationError,
        signedResidual: cap20.signedResidual - baseline.signedResidual,
        absoluteSignedResidual: Math.abs(cap20.signedResidual) - Math.abs(baseline.signedResidual),
        equalCaseSignedResidual: capCaseResidual - baselineCaseResidual,
        absoluteEqualCaseSignedResidual: Math.abs(capCaseResidual) - Math.abs(baselineCaseResidual),
        chamberMeanAbsoluteExpectedYesError: capChamberMae - baselineChamberMae,
      },
      calibration: {
        baseline: calibrationBins(baselinePairs),
        cap20: calibrationBins(capPairs),
      },
    },
    cases: cases.sort((left, right) => left.occurredOn.localeCompare(right.occurredOn)
      || left.identifier.localeCompare(right.identifier)),
    conclusion: {
      productionAction: 'none',
      prospectiveValidationRequired: true,
      note: 'This artifact can characterize whether cap 20 improves the already-revealed exact holdout. It cannot change the production history cap. Any promotion requires a separately frozen prospective/shadow validation on future outcomes.',
    },
  };
}

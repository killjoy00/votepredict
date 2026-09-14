import type { Pool } from 'pg';
import { MEMBER_MODEL_VERSION } from '../forecasting/member-model';
import type { HistoricalDeepHouseJournalHoldoutCohort } from './historical-deep-house-journal-holdout-cohort';
import type {
  HistoricalDeepHouseJournalHoldoutScoreArtifact,
  HistoricalDeepHouseJournalHoldoutScoreCase,
} from './historical-deep-house-journal-holdout-score';
import type { HistoricalQuickReplayEventResult } from './historical-quick-replay';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import { calibrationBins, mean, memberScore, type MemberPair } from './member-history-shadow-score';

export const MEMBER_HISTORY_DECAY180_HOLDOUT_REPLAY_SCHEMA = 'member-history-decay180-holdout-replay-v1' as const;
export const MEMBER_HISTORY_DECAY180_HALF_LIFE_DAYS = 180 as const;

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
    throw new Error('Decay-180 replay supports only the frozen 2025-2026 House cohort');
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

function frozenByVote(frozen: HistoricalDeepHouseJournalHoldoutScoreArtifact) {
  return new Map<string, HistoricalDeepHouseJournalHoldoutScoreCase>(
    frozen.cases.map((item) => [item.voteEventId, item]),
  );
}

function replayByVote(results: readonly HistoricalQuickReplayEventResult[]) {
  return new Map(results.map((item) => [item.voteEventId, item]));
}

export async function evaluateMemberHistoryDecay180HoldoutReplay(
  pool: Pool,
  input: {
    cohort: HistoricalDeepHouseJournalHoldoutCohort;
    frozenScore: HistoricalDeepHouseJournalHoldoutScoreArtifact;
    codeSha?: string | null;
  },
) {
  assertFrozenInputs(input.cohort, input.frozenScore);
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const baselineReplay = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    null,
  );
  const decayReplay = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    MEMBER_HISTORY_DECAY180_HALF_LIFE_DAYS,
  );
  const baselineByVote = replayByVote(baselineReplay);
  const decayByVote = replayByVote(decayReplay);
  const frozen = frozenByVote(input.frozenScore);
  const baselinePairs: MemberPair[] = [];
  const decayPairs: MemberPair[] = [];
  const cases: Array<Record<string, unknown>> = [];
  let checked = 0;
  let maxDifference = 0;

  for (const cohortCase of input.cohort.cases) {
    const frozenCase = frozen.get(cohortCase.voteEventId);
    const baselineEvent = baselineByVote.get(cohortCase.voteEventId);
    const decayEvent = decayByVote.get(cohortCase.voteEventId);
    if (!frozenCase || !baselineEvent || !decayEvent) {
      throw new Error(`Missing decay replay lineage for ${cohortCase.stableKey}`);
    }
    if (baselineEvent.status !== 'replayable' || decayEvent.status !== 'replayable') {
      throw new Error(`Frozen holdout case is not replayable under both variants: ${cohortCase.stableKey}`);
    }
    if (baselineEvent.targetVersionId !== cohortCase.targetVersionId
      || decayEvent.targetVersionId !== cohortCase.targetVersionId) {
      throw new Error(`Target-version drift for ${cohortCase.stableKey}`);
    }
    if (baselineEvent.activeMembers !== cohortCase.activeMembers
      || decayEvent.activeMembers !== cohortCase.activeMembers) {
      throw new Error(`Active-member drift for ${cohortCase.stableKey}`);
    }
    if (baselineEvent.selectedAnalogues !== decayEvent.selectedAnalogues
      || baselineEvent.directAnalogueMembers !== decayEvent.directAnalogueMembers) {
      throw new Error(`Decay changed analogue lineage for ${cohortCase.stableKey}`);
    }

    const baselineMembers = new Map(baselineEvent.memberPredictions.map((item) => [item.legislatorId, item]));
    const decayMembers = new Map(decayEvent.memberPredictions.map((item) => [item.legislatorId, item]));
    const caseBaseline: MemberPair[] = [];
    const caseDecay: MemberPair[] = [];

    for (const frozenMember of frozenCase.members) {
      const baselineMember = baselineMembers.get(frozenMember.legislatorId);
      const decayMember = decayMembers.get(frozenMember.legislatorId);
      if (!baselineMember || !decayMember
        || baselineMember.membershipId !== frozenMember.membershipId
        || decayMember.membershipId !== frozenMember.membershipId) {
        throw new Error(`Member lineage drift for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      if (baselineMember.yesProbability === undefined || decayMember.yesProbability === undefined) {
        throw new Error(`Missing Quick probability for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      if (baselineMember.actualOutcome !== frozenMember.actualOutcome
        || decayMember.actualOutcome !== frozenMember.actualOutcome) {
        throw new Error(`Outcome lineage drift for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      const difference = Math.abs(baselineMember.yesProbability - frozenMember.yesProbability);
      maxDifference = Math.max(maxDifference, difference);
      checked += 1;
      if (difference > 1e-12) {
        throw new Error(`Unweighted Quick probability drift ${difference} for ${cohortCase.stableKey}|${frozenMember.legislatorId}`);
      }
      const baselinePair = { probability: frozenMember.yesProbability, outcome: frozenMember.actualOutcome };
      const decayPair = { probability: decayMember.yesProbability, outcome: frozenMember.actualOutcome };
      baselinePairs.push(baselinePair);
      decayPairs.push(decayPair);
      caseBaseline.push(baselinePair);
      caseDecay.push(decayPair);
    }

    const baselineScore = memberScore(caseBaseline);
    const decayScore = memberScore(caseDecay);
    if (baselineEvent.expectedYes === undefined || decayEvent.expectedYes === undefined) {
      throw new Error(`Missing chamber expected-Yes replay for ${cohortCase.stableKey}`);
    }
    const baselineYesError = baselineEvent.expectedYes - baselineEvent.actualYes;
    const decayYesError = decayEvent.expectedYes - decayEvent.actualYes;
    cases.push({
      stableKey: cohortCase.stableKey,
      voteEventId: cohortCase.voteEventId,
      identifier: cohortCase.identifier,
      occurredOn: cohortCase.occurredOn,
      decisiveMemberOutcomes: caseBaseline.length,
      actualYesVotes: caseBaseline.filter((item) => item.outcome === 1).length,
      actualYesRate: baselineScore.actualYesRate,
      actualChamberYes: baselineEvent.actualYes,
      baseline: {
        memberMeanYesProbability: baselineScore.meanYesProbability,
        memberSignedResidual: baselineScore.signedResidual,
        expectedYes: baselineEvent.expectedYes,
        expectedYesError: baselineYesError,
        absoluteExpectedYesError: Math.abs(baselineYesError),
      },
      decay180: {
        memberMeanYesProbability: decayScore.meanYesProbability,
        memberSignedResidual: decayScore.signedResidual,
        expectedYes: decayEvent.expectedYes,
        expectedYesError: decayYesError,
        absoluteExpectedYesError: Math.abs(decayYesError),
      },
      deltaDecayMinusBaseline: {
        memberMeanYesProbability: decayScore.meanYesProbability - baselineScore.meanYesProbability,
        absoluteMemberResidual: Math.abs(decayScore.signedResidual) - Math.abs(baselineScore.signedResidual),
        absoluteExpectedYesError: Math.abs(decayYesError) - Math.abs(baselineYesError),
      },
    });
  }

  if (checked !== input.frozenScore.input.decisiveMemberOutcomes) {
    throw new Error(`Validated ${checked} baseline probabilities, expected ${input.frozenScore.input.decisiveMemberOutcomes}`);
  }
  const baseline = memberScore(baselinePairs);
  const decay180 = memberScore(decayPairs);
  const tolerance = 1e-12;
  if (Math.abs(baseline.brier - input.frozenScore.summary.overall.quickBrier) > tolerance
    || Math.abs(baseline.logLoss - input.frozenScore.summary.overall.quickLogLoss) > tolerance
    || Math.abs(baseline.accuracy - input.frozenScore.summary.overall.quickAccuracy) > tolerance
    || Math.abs(baseline.signedResidual - input.frozenScore.summary.overall.memberWeightedSignedResidual) > tolerance) {
    throw new Error('Recomputed immutable uncapped holdout metrics drifted from #176');
  }

  const baselineCaseResidual = mean(cases.map((item) => Number((item.baseline as { memberSignedResidual: number }).memberSignedResidual)));
  const decayCaseResidual = mean(cases.map((item) => Number((item.decay180 as { memberSignedResidual: number }).memberSignedResidual)));
  const baselineChamberMae = mean(cases.map((item) => Number((item.baseline as { absoluteExpectedYesError: number }).absoluteExpectedYesError)));
  const decayChamberMae = mean(cases.map((item) => Number((item.decay180 as { absoluteExpectedYesError: number }).absoluteExpectedYesError)));

  return {
    schemaVersion: MEMBER_HISTORY_DECAY180_HOLDOUT_REPLAY_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'post-selection descriptive replay of the selected 180-day member-history decay candidate on the exact immutable 24-case 2025-2026 House holdout through unchanged Quick analogue, roster, and chamber logic; no serving or probability write occurs',
    metadata: {
      runtimeCodeSha: input.codeSha ?? null,
      modelVersion: MEMBER_MODEL_VERSION,
      memberHistoryHalfLifeDays: MEMBER_HISTORY_DECAY180_HALF_LIFE_DAYS,
      partyHistoryHalfLifeDays: null,
      globalHistoryHalfLifeDays: null,
      analysisStatus: 'post-selection-descriptive-shadow-only',
      probabilityAction: 'none',
      runtimeDefaultChange: false,
      modelVersionChange: false,
      baselineValidation: {
        decisiveMemberProbabilitiesChecked: checked,
        maximumAbsoluteProbabilityDifference: maxDifference,
        targetVersionMismatches: 0,
        activeMemberMismatches: 0,
      },
      interpretationGuard: 'The 180-day candidate was selected after 2025-2026 outcomes were already part of retrospective screening. Exact unweighted decisive-member probabilities must match immutable #176 to 1e-12 before comparison.',
    },
    input: { frozenCases: 24, decisiveMemberOutcomes: checked },
    summary: {
      baseline: {
        ...baseline,
        chamberMeanAbsoluteExpectedYesError: baselineChamberMae,
        equalCaseSignedResidual: baselineCaseResidual,
      },
      decay180: {
        ...decay180,
        chamberMeanAbsoluteExpectedYesError: decayChamberMae,
        equalCaseSignedResidual: decayCaseResidual,
      },
      deltaDecayMinusBaseline: {
        brier: decay180.brier - baseline.brier,
        logLoss: decay180.logLoss - baseline.logLoss,
        accuracy: decay180.accuracy - baseline.accuracy,
        expectedCalibrationError: decay180.expectedCalibrationError - baseline.expectedCalibrationError,
        signedResidual: decay180.signedResidual - baseline.signedResidual,
        absoluteSignedResidual: Math.abs(decay180.signedResidual) - Math.abs(baseline.signedResidual),
        equalCaseSignedResidual: decayCaseResidual - baselineCaseResidual,
        absoluteEqualCaseSignedResidual: Math.abs(decayCaseResidual) - Math.abs(baselineCaseResidual),
        chamberMeanAbsoluteExpectedYesError: decayChamberMae - baselineChamberMae,
      },
      calibration: {
        baseline: calibrationBins(baselinePairs),
        decay180: calibrationBins(decayPairs),
      },
    },
    cases: cases.sort((left, right) => String(left.occurredOn).localeCompare(String(right.occurredOn))
      || String(left.identifier).localeCompare(String(right.identifier))),
    conclusion: {
      productionAction: 'none',
      prospectiveValidationRequired: true,
      note: 'This post-selection replay can only determine whether the 180-day decay survives the exact already-revealed Quick pipeline. Any production promotion requires a separately frozen future prospective/shadow validation distinct from the existing cap-20 lineage.',
    },
  };
}

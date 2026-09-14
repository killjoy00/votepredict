import type { Pool } from 'pg';
import { brierScore, binaryAccuracy } from './metrics';
import {
  scoreHistoricalQuickReplay,
  type HistoricalQuickReplayEventResult,
  type HistoricalQuickReplayScorecard,
} from './historical-quick-replay';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import { runHistoricalQuickShadowReplay } from './historical-quick-shadow-replay';

export const MEMBER_HISTORY_DECAY180_PASSAGE_SAFETY_SCHEMA = 'member-history-decay180-passage-safety-v1' as const;
export const MEMBER_HISTORY_DECAY180_PASSAGE_HALF_LIFE_DAYS = 180 as const;

interface PassageSubsetScore {
  events: number;
  passed: number;
  failed: number;
  meanPassageProbability: number;
  brier: number;
  accuracy: number;
}

function passageSubset(results: readonly HistoricalQuickReplayEventResult[]): PassageSubsetScore {
  const rows = results.filter((row): row is HistoricalQuickReplayEventResult & { passageProbability: number } =>
    row.status === 'replayable' && row.passageProbability !== undefined);
  if (rows.length === 0) {
    return {
      events: 0,
      passed: 0,
      failed: 0,
      meanPassageProbability: Number.NaN,
      brier: Number.NaN,
      accuracy: Number.NaN,
    };
  }
  const forecasts = rows.map((row) => ({ probability: row.passageProbability, outcome: row.passed ? 1 as const : 0 as const }));
  return {
    events: rows.length,
    passed: rows.filter((row) => row.passed).length,
    failed: rows.filter((row) => !row.passed).length,
    meanPassageProbability: rows.reduce((sum, row) => sum + row.passageProbability, 0) / rows.length,
    brier: brierScore(forecasts),
    accuracy: binaryAccuracy(forecasts),
  };
}

function slice(results: readonly HistoricalQuickReplayEventResult[], session: string, chamber: string) {
  return results.filter((row) => row.session === session && row.chamber === chamber);
}

function combinedScore(results: readonly HistoricalQuickReplayEventResult[]): Record<string, HistoricalQuickReplayScorecard> {
  const keys = [...new Set(results.map((row) => `${row.session}/${row.chamber}`))].sort();
  return Object.fromEntries(keys.map((key) => {
    const [session, chamber] = key.split('/');
    return [key, scoreHistoricalQuickReplay(slice(results, session, chamber)).overall];
  }));
}

function assertControlEquivalent(
  expected: readonly HistoricalQuickReplayEventResult[],
  actual: readonly HistoricalQuickReplayEventResult[],
): { checkedProbabilities: number; maximumAbsoluteProbabilityDifference: number } {
  if (expected.length !== actual.length) throw new Error('Null-decay control event count differs from existing Quick shadow replay');
  const expectedByVote = new Map(expected.map((row) => [row.voteEventId, row]));
  let checkedProbabilities = 0;
  let maximumAbsoluteProbabilityDifference = 0;
  for (const row of actual) {
    const control = expectedByVote.get(row.voteEventId);
    if (!control) throw new Error(`Null-decay control is missing ${row.voteEventId}`);
    if (row.status !== control.status
      || row.targetVersionId !== control.targetVersionId
      || row.activeMembers !== control.activeMembers
      || row.directAnalogueMembers !== control.directAnalogueMembers
      || row.selectedAnalogues !== control.selectedAnalogues) {
      throw new Error(`Null-decay Quick lineage differs for ${row.voteEventId}`);
    }
    const controlMembers = new Map(control.memberPredictions.map((member) => [member.legislatorId, member]));
    for (const member of row.memberPredictions) {
      const expectedMember = controlMembers.get(member.legislatorId);
      if (!expectedMember || expectedMember.membershipId !== member.membershipId) {
        throw new Error(`Null-decay member lineage differs for ${row.voteEventId}|${member.legislatorId}`);
      }
      if (member.yesProbability === undefined || expectedMember.yesProbability === undefined) {
        if (member.yesProbability !== expectedMember.yesProbability) {
          throw new Error(`Null-decay probability coverage differs for ${row.voteEventId}|${member.legislatorId}`);
        }
        continue;
      }
      const difference = Math.abs(member.yesProbability - expectedMember.yesProbability);
      maximumAbsoluteProbabilityDifference = Math.max(maximumAbsoluteProbabilityDifference, difference);
      checkedProbabilities += 1;
      if (difference > 1e-12) {
        throw new Error(`Null-decay probability drift ${difference} for ${row.voteEventId}|${member.legislatorId}`);
      }
    }
  }
  return { checkedProbabilities, maximumAbsoluteProbabilityDifference };
}

function assertVariantLineage(
  baseline: readonly HistoricalQuickReplayEventResult[],
  decay: readonly HistoricalQuickReplayEventResult[],
): void {
  if (baseline.length !== decay.length) throw new Error('Decay variant event count differs from baseline');
  const baselineByVote = new Map(baseline.map((row) => [row.voteEventId, row]));
  for (const row of decay) {
    const base = baselineByVote.get(row.voteEventId);
    if (!base) throw new Error(`Decay variant is missing baseline event ${row.voteEventId}`);
    if (row.status !== base.status
      || row.targetVersionId !== base.targetVersionId
      || row.activeMembers !== base.activeMembers
      || row.directAnalogueMembers !== base.directAnalogueMembers
      || row.selectedAnalogues !== base.selectedAnalogues
      || row.actualYes !== base.actualYes
      || row.passed !== base.passed) {
      throw new Error(`Decay changed non-probability Quick lineage for ${row.voteEventId}`);
    }
  }
}

function pairedEventDeltas(
  baseline: readonly HistoricalQuickReplayEventResult[],
  decay: readonly HistoricalQuickReplayEventResult[],
) {
  const decayByVote = new Map(decay.map((row) => [row.voteEventId, row]));
  return baseline.flatMap((base) => {
    const candidate = decayByVote.get(base.voteEventId);
    if (!candidate || base.status !== 'replayable' || candidate.status !== 'replayable'
      || base.passageProbability === undefined || candidate.passageProbability === undefined
      || base.expectedYes === undefined || candidate.expectedYes === undefined) return [];
    return [{
      voteEventId: base.voteEventId,
      session: base.session,
      chamber: base.chamber,
      occurredOn: base.occurredOn,
      passed: base.passed,
      actualYes: base.actualYes,
      baselinePassageProbability: base.passageProbability,
      decay180PassageProbability: candidate.passageProbability,
      passageProbabilityDelta: candidate.passageProbability - base.passageProbability,
      baselineExpectedYes: base.expectedYes,
      decay180ExpectedYes: candidate.expectedYes,
      absoluteExpectedYesErrorDelta: Math.abs(candidate.expectedYes - base.actualYes) - Math.abs(base.expectedYes - base.actualYes),
    }];
  });
}

export async function evaluateMemberHistoryDecay180PassageSafety(
  pool: Pool,
  options: { codeSha?: string | null } = {},
) {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  const existingControl = runHistoricalQuickShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
  );
  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    null,
  );
  const decay180 = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    MEMBER_HISTORY_DECAY180_PASSAGE_HALF_LIFE_DAYS,
  );
  const baselineValidation = assertControlEquivalent(existingControl, baseline);
  assertVariantLineage(baseline, decay180);

  const baselineScores = scoreHistoricalQuickReplay(baseline);
  const decayScores = scoreHistoricalQuickReplay(decay180);
  const baselineCombined = combinedScore(baseline);
  const decayCombined = combinedScore(decay180);
  const primaryBaselineRows = slice(baseline, '2025-2026', 'house');
  const primaryDecayRows = slice(decay180, '2025-2026', 'house');
  const primaryBaseline = baselineCombined['2025-2026/house'];
  const primaryDecay = decayCombined['2025-2026/house'];
  if (!primaryBaseline || !primaryDecay) throw new Error('Primary 2025-2026 House passage safety slice is unavailable');

  const baselineAllPassage = passageSubset(primaryBaselineRows);
  const decayAllPassage = passageSubset(primaryDecayRows);
  const baselineFailed = passageSubset(primaryBaselineRows.filter((row) => !row.passed));
  const decayFailed = passageSubset(primaryDecayRows.filter((row) => !row.passed));
  const baselinePassed = passageSubset(primaryBaselineRows.filter((row) => row.passed));
  const decayPassed = passageSubset(primaryDecayRows.filter((row) => row.passed));

  const deltas = {
    primaryMemberBrier: primaryDecay.memberBrier - primaryBaseline.memberBrier,
    primaryMemberLogLoss: primaryDecay.memberLogLoss - primaryBaseline.memberLogLoss,
    primaryMemberAccuracy: primaryDecay.memberAccuracy - primaryBaseline.memberAccuracy,
    primaryMemberEce: primaryDecay.memberExpectedCalibrationError - primaryBaseline.memberExpectedCalibrationError,
    primaryChamberMae: primaryDecay.chamberMeanAbsoluteYesError - primaryBaseline.chamberMeanAbsoluteYesError,
    primaryPassageBrier: decayAllPassage.brier - baselineAllPassage.brier,
    primaryPassageAccuracy: decayAllPassage.accuracy - baselineAllPassage.accuracy,
    failedPassageBrier: decayFailed.brier - baselineFailed.brier,
    failedMeanPassageProbability: decayFailed.meanPassageProbability - baselineFailed.meanPassageProbability,
    passedPassageBrier: decayPassed.brier - baselinePassed.brier,
    passedMeanPassageProbability: decayPassed.meanPassageProbability - baselinePassed.meanPassageProbability,
  };

  const checks = {
    minimumPrimarySliceReplayableEvents: primaryDecay.replayableEvents >= 150,
    minimumPrimarySliceFailedEvents: decayFailed.events >= 5,
    maximumPrimarySlicePassageBrierDelta: deltas.primaryPassageBrier <= 0.002,
    minimumPrimarySliceMemberBrierImprovement: deltas.primaryMemberBrier <= -0.01,
    minimumPrimarySliceChamberMaeImprovementVotes: deltas.primaryChamberMae <= -2,
    maximumFailedEventPassageBrierDelta: deltas.failedPassageBrier <= 0.05,
    maximumFailedEventMeanPassageProbabilityIncrease: deltas.failedMeanPassageProbability <= 0.03,
    minimumPrimarySlicePassageAccuracyDelta: deltas.primaryPassageAccuracy >= -0.01,
  };
  const passageSafe = Object.values(checks).every(Boolean);

  return {
    schemaVersion: MEMBER_HISTORY_DECAY180_PASSAGE_SAFETY_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      runtimeCodeSha: options.codeSha ?? null,
      memberHistoryHalfLifeDays: MEMBER_HISTORY_DECAY180_PASSAGE_HALF_LIFE_DAYS,
      analysisStatus: 'post-selection-passage-safety-audit' as const,
      probabilityAction: 'none' as const,
      productionAction: 'none' as const,
      runtimeDefaultChange: false,
      modelVersionChange: false,
      baselineValidation,
      interpretationGuard: 'This audit protects rare passage failures from an otherwise strong member-level decay candidate. The candidate was selected after historical outcomes were inspected; passing this audit is necessary but not independently confirmatory.',
    },
    input: {
      targets: dataset.targets.length,
      baselineReplayableEvents: baselineScores.overall.replayableEvents,
      decayReplayableEvents: decayScores.overall.replayableEvents,
    },
    overall: { baseline: baselineScores.overall, decay180: decayScores.overall },
    bySessionAndChamber: Object.fromEntries(Object.keys(baselineCombined).map((key) => [key, {
      baseline: baselineCombined[key],
      decay180: decayCombined[key],
    }])),
    primarySafetySlice: {
      key: '2025-2026/house',
      baseline: primaryBaseline,
      decay180: primaryDecay,
      passage: {
        all: { baseline: baselineAllPassage, decay180: decayAllPassage },
        passed: { baseline: baselinePassed, decay180: decayPassed },
        failed: { baseline: baselineFailed, decay180: decayFailed },
      },
      deltas,
      frozenChecks: checks,
    },
    eventDeltas: pairedEventDeltas(baseline, decay180),
    decision: {
      status: passageSafe ? 'passage_safe_for_production_review' as const : 'blocks_production_promotion' as const,
      productionAction: 'none' as const,
      passageSafe,
      note: passageSafe
        ? 'Decay-180 passed the frozen rare-failure safety boundary. A separate reviewed production-promotion decision is still required.'
        : 'Decay-180 failed at least one frozen passage-safety check and must not be promoted from this research line.',
    },
  };
}

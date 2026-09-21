import type { Pool } from 'pg';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import {
  HISTORICAL_QUICK_REPLAY_VERSION,
  runHistoricalQuickReplay,
  scoreHistoricalQuickReplay,
} from './historical-quick-replay';

export interface HistoricalQuickEvaluationOptions {
  includeMembers?: boolean;
  codeSha?: string | null;
  databaseSource?: string | null;
}

export async function evaluateHistoricalQuickReplay(
  pool: Pool,
  options: HistoricalQuickEvaluationOptions = {},
): Promise<Record<string, unknown>> {
  const includeMembers = options.includeMembers ?? false;
  const dataset = await loadHistoricalQuickReplayDataset(pool);

  const replay = runHistoricalQuickReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
  );
  const score = scoreHistoricalQuickReplay(replay);
  const statusCounts = replay.reduce<Record<string, number>>((counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  }, {});

  const eventOutput = replay.map((result) => {
    if (includeMembers) return result;
    const actualMemberObservations = result.memberPredictions
      .filter((row) => row.actualOutcome !== undefined).length;
    const predictedMembers = result.memberPredictions
      .filter((row) => row.yesProbability !== undefined).length;
    const { memberPredictions: _members, ...rest } = result;
    return {
      ...rest,
      actualMemberObservations,
      predictedMembers,
    };
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'evaluation-only historical Quick replay; no writes, no research calls, no forecast revisions, no serving changes',
      historicalReplayVersion: HISTORICAL_QUICK_REPLAY_VERSION,
      modelVersion: replay[0]?.modelVersion ?? null,
      snapshotInstant: 'start of official vote date, equivalent to the end of the prior UTC calendar day',
      leakageGuard: 'historical-v2 uses only dated official bill text for bill identity/features, dated pre-vote process events for companions, earlier-calendar-day vote history, and the prior-day active roster',
      includeMembers,
    },
    readiness: {
      passageEventsLoaded: dataset.events.length,
      strictReplayTargets: dataset.targets.length,
      replayResults: replay.length,
      statuses: statusCounts,
      persistedHistoricalFeatureSetsUsed: false,
      mutableCurrentBillTitlesUsed: false,
      currentCompanionMetadataUsed: false,
      featurePolicy: 'deterministic features are recomputed from each dated raw bill text and its text-derived historical identity title',
      companionPolicy: 'only dated legislative_stage_events companion_reference rows strictly before the target vote are eligible',
    },
    score,
    events: eventOutput,
  };
}

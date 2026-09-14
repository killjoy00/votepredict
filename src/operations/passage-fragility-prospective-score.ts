import type { Pool } from 'pg';
import { binaryAccuracy, brierScore, logLoss } from '../evaluation/metrics';
import {
  PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
  PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
  PASSAGE_FRAGILITY_SHADOW_VERSION,
} from '../forecasting/passage-fragility-shadow';

interface ScoreRow {
  vote_event_id: string;
  occurred_on: string;
  passed: boolean;
  revision_id: string;
  generated_at: string;
  serving_probability: number;
  shadow_probability: number;
  flagged: boolean;
}

interface SliceScore {
  events: number;
  passed: number;
  failed: number;
  meanProbability: number | null;
  brier: number | null;
  logLoss: number | null;
  accuracy: number | null;
}

function score(rows: readonly ScoreRow[], probability: (row: ScoreRow) => number): SliceScore {
  if (rows.length === 0) return { events: 0, passed: 0, failed: 0, meanProbability: null, brier: null, logLoss: null, accuracy: null };
  const forecasts = rows.map((row) => ({ probability: probability(row), outcome: row.passed ? 1 as const : 0 as const }));
  return {
    events: rows.length,
    passed: rows.filter((row) => row.passed).length,
    failed: rows.filter((row) => !row.passed).length,
    meanProbability: forecasts.reduce((sum, row) => sum + row.probability, 0) / forecasts.length,
    brier: brierScore(forecasts),
    logLoss: logLoss(forecasts),
    accuracy: binaryAccuracy(forecasts),
  };
}

function slices(rows: readonly ScoreRow[], probability: (row: ScoreRow) => number) {
  return {
    all: score(rows, probability),
    passed: score(rows.filter((row) => row.passed), probability),
    failed: score(rows.filter((row) => !row.passed), probability),
    flagged: score(rows.filter((row) => row.flagged), probability),
  };
}

function delta(candidate: number | null, baseline: number | null): number | null {
  return candidate === null || baseline === null ? null : candidate - baseline;
}

export async function scoreProspectivePassageFragilityShadow(pool: Pool) {
  const result = await pool.query<ScoreRow>(`
    WITH eligible AS (
      SELECT ve.id AS vote_event_id,
             ve.occurred_on::text,
             ve.passed,
             r.id AS revision_id,
             r.generated_at::text,
             r.passage_probability AS serving_probability,
             (r.metadata #>> '{passageFragilityShadow,shadowPassageProbability}')::double precision AS shadow_probability,
             COALESCE((r.metadata #>> '{passageFragilityShadow,flagged}')::boolean, false) AS flagged,
             row_number() OVER (PARTITION BY ve.id ORDER BY r.generated_at DESC, r.id DESC) AS ordinal
        FROM forecast_resolutions fr
        JOIN forecasts f ON f.id = fr.forecast_id
        JOIN legislative_sessions s ON s.id = f.session_id
        JOIN chambers c ON c.id = f.target_chamber_id
        JOIN vote_events ve ON ve.id = fr.vote_event_id
        JOIN forecast_revisions r ON r.forecast_id = f.id
       WHERE s.slug = $1
         AND c.slug = $2
         AND ve.is_passage = true
         AND ve.passed IS NOT NULL
         AND ve.occurred_on > DATE '2026-09-14'
         AND r.research_mode = 'quick'
         AND r.generated_at < ve.occurred_on::timestamp
         AND r.passage_probability IS NOT NULL
         AND r.metadata #>> '{passageFragilityShadow,version}' = $3
         AND r.metadata #>> '{passageFragilityShadow,outcomeUseAtCapture}' = 'none'
         AND r.metadata #>> '{passageFragilityShadow,shadowPassageProbability}' IS NOT NULL
    )
    SELECT vote_event_id, occurred_on, passed, revision_id, generated_at,
           serving_probability, shadow_probability, flagged
      FROM eligible
     WHERE ordinal = 1
     ORDER BY occurred_on, vote_event_id`, [
    PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
    PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
    PASSAGE_FRAGILITY_SHADOW_VERSION,
  ]);

  const rows = result.rows;
  const serving = slices(rows, (row) => row.serving_probability);
  const shadow = slices(rows, (row) => row.shadow_probability);
  const deltas = {
    overallBrier: delta(shadow.all.brier, serving.all.brier),
    overallLogLoss: delta(shadow.all.logLoss, serving.all.logLoss),
    overallAccuracy: delta(shadow.all.accuracy, serving.all.accuracy),
    failedBrier: delta(shadow.failed.brier, serving.failed.brier),
    failedMeanProbability: delta(shadow.failed.meanProbability, serving.failed.meanProbability),
    passedBrier: delta(shadow.passed.brier, serving.passed.brier),
  };
  const enoughData = rows.length >= 100 && serving.failed.events >= 5;
  const checks = enoughData ? {
    minimumResolvedVotes: rows.length >= 100,
    minimumFailedVotes: serving.failed.events >= 5,
    minimumOverallBrierImprovement: deltas.overallBrier !== null && deltas.overallBrier <= -0.0005,
    minimumOverallLogLossImprovement: deltas.overallLogLoss !== null && deltas.overallLogLoss <= -0.001,
    minimumFailedBrierImprovement: deltas.failedBrier !== null && deltas.failedBrier <= -0.02,
    maximumPassedBrierDegradation: deltas.passedBrier !== null && deltas.passedBrier <= 0.001,
    minimumAccuracyDelta: deltas.overallAccuracy !== null && deltas.overallAccuracy >= -0.01,
  } : null;
  const clearsBoundary = checks ? Object.values(checks).every(Boolean) : false;

  return {
    schemaVersion: 'passage-fragility-prospective-score-v1' as const,
    generatedAt: new Date().toISOString(),
    scope: {
      session: PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
      chamber: PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
      strictCutoff: 'revision-generated-before-official-vote-date' as const,
      dedupe: 'latest-eligible-revision-per-official-passage-vote' as const,
    },
    input: {
      resolvedVotes: rows.length,
      failedVotes: serving.failed.events,
      flaggedVotes: rows.filter((row) => row.flagged).length,
    },
    serving,
    shadow,
    deltas,
    frozenChecks: checks,
    decision: {
      status: !enoughData
        ? 'insufficient_future_outcomes' as const
        : clearsBoundary
          ? 'eligible_for_separate_production_review' as const
          : 'does_not_clear_frozen_review_boundary' as const,
      productionAction: 'none' as const,
      automaticPromotion: false,
    },
  };
}

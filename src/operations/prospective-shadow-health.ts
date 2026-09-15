import { pool } from '@/lib/db';
import {
  PASSAGE_FRAGILITY_CAPTURE_AFTER,
  PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
  PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
  PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL,
} from '@/forecasting/passage-fragility-shadow';
import {
  MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
  MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION,
} from '@/forecasting/member-history-cap20-prospective-shadow';

const CAP20_FROZEN_BASELINE_MODEL_VERSION = 'member-eb-v1.1';
const FAILURE_GRACE_HOURS = 2;

export interface ProspectiveShadowCaptureStatus {
  scopeRevisions: number;
  eligibleRevisions: number;
  capturedRevisions: number;
  excludedRevisions: number;
  failedRevisions: number;
  latestEligibleAt?: string;
  latestCapturedAt?: string;
}

export interface ProspectiveShadowCaptureHealth {
  generatedAt: string;
  failureGraceHours: number;
  cap20: ProspectiveShadowCaptureStatus & {
    experiment: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT;
    session: typeof MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION;
    chambers: readonly ['house', 'senate'];
    frozenBaselineModelVersion: typeof CAP20_FROZEN_BASELINE_MODEL_VERSION;
  };
  passageFragility: ProspectiveShadowCaptureStatus & {
    experiment: 'passage-fragility-shadow-v1';
    session: typeof PASSAGE_FRAGILITY_PROSPECTIVE_SESSION;
    chambers: readonly [typeof PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER];
    servingMemberModelVersion: typeof PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL;
  };
}

type StatusRow = {
  cap20_scope: string | number;
  cap20_eligible: string | number;
  cap20_captured: string | number;
  cap20_excluded: string | number;
  cap20_failed: string | number;
  cap20_latest_eligible_at: string | null;
  cap20_latest_captured_at: string | null;
  fragility_scope: string | number;
  fragility_eligible: string | number;
  fragility_captured: string | number;
  fragility_excluded: string | number;
  fragility_failed: string | number;
  fragility_latest_eligible_at: string | null;
  fragility_latest_captured_at: string | null;
};

function count(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function status(input: {
  scope: string | number;
  eligible: string | number;
  captured: string | number;
  excluded: string | number;
  failed: string | number;
  latestEligibleAt: string | null;
  latestCapturedAt: string | null;
}): ProspectiveShadowCaptureStatus {
  return {
    scopeRevisions: count(input.scope),
    eligibleRevisions: count(input.eligible),
    capturedRevisions: count(input.captured),
    excludedRevisions: count(input.excluded),
    failedRevisions: count(input.failed),
    ...(input.latestEligibleAt ? { latestEligibleAt: input.latestEligibleAt } : {}),
    ...(input.latestCapturedAt ? { latestCapturedAt: input.latestCapturedAt } : {}),
  };
}

export async function getProspectiveShadowCaptureHealth(): Promise<ProspectiveShadowCaptureHealth> {
  const cap20Context = JSON.stringify([{ experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT }]);
  const result = await pool.query<StatusRow>(`
    WITH scoped AS (
      SELECT r.id,
             r.model_version,
             r.generated_at,
             r.passage_probability,
             r.metadata,
             c.slug AS chamber_slug
        FROM forecast_revisions r
        JOIN forecasts f ON f.id = r.forecast_id
        JOIN legislative_sessions s ON s.id = f.session_id
        JOIN chambers c ON c.id = f.target_chamber_id
       WHERE s.slug = $1
         AND f.target_type = 'bill'
         AND r.research_mode = 'quick'
    ),
    cap20 AS (
      SELECT scoped.*,
             (model_version = $2 AND generated_at IS NOT NULL) AS eligible,
             (
               EXISTS (
                 SELECT 1
                   FROM forecast_member_predictions fmp
                  WHERE fmp.revision_id = scoped.id
               )
               AND NOT EXISTS (
                 SELECT 1
                   FROM forecast_member_predictions fmp
                  WHERE fmp.revision_id = scoped.id
                    AND NOT (COALESCE(fmp.context, '[]'::jsonb) @> $3::jsonb)
               )
             ) AS captured
        FROM scoped
       WHERE chamber_slug IN ('house', 'senate')
    ),
    fragility AS (
      SELECT scoped.*,
             (
               model_version = $4
               AND generated_at >= $5::timestamptz
               AND passage_probability IS NOT NULL
             ) AS eligible,
             (metadata ? 'passageFragilityShadow') AS captured
        FROM scoped
       WHERE chamber_slug = $6
    )
    SELECT
      (SELECT count(*) FROM cap20) AS cap20_scope,
      (SELECT count(*) FROM cap20 WHERE eligible) AS cap20_eligible,
      (SELECT count(*) FROM cap20 WHERE eligible AND captured) AS cap20_captured,
      (SELECT count(*) FROM cap20 WHERE NOT eligible) AS cap20_excluded,
      (SELECT count(*) FROM cap20 WHERE eligible AND NOT captured AND generated_at < now() - ($7::text || ' hours')::interval) AS cap20_failed,
      (SELECT max(generated_at)::text FROM cap20 WHERE eligible) AS cap20_latest_eligible_at,
      (SELECT max(generated_at)::text FROM cap20 WHERE eligible AND captured) AS cap20_latest_captured_at,
      (SELECT count(*) FROM fragility) AS fragility_scope,
      (SELECT count(*) FROM fragility WHERE eligible) AS fragility_eligible,
      (SELECT count(*) FROM fragility WHERE eligible AND captured) AS fragility_captured,
      (SELECT count(*) FROM fragility WHERE NOT eligible) AS fragility_excluded,
      (SELECT count(*) FROM fragility WHERE eligible AND NOT captured AND generated_at < now() - ($7::text || ' hours')::interval) AS fragility_failed,
      (SELECT max(generated_at)::text FROM fragility WHERE eligible) AS fragility_latest_eligible_at,
      (SELECT max(generated_at)::text FROM fragility WHERE eligible AND captured) AS fragility_latest_captured_at
  `, [
    MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION,
    CAP20_FROZEN_BASELINE_MODEL_VERSION,
    cap20Context,
    PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL,
    PASSAGE_FRAGILITY_CAPTURE_AFTER,
    PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
    FAILURE_GRACE_HOURS,
  ]);

  const row = result.rows[0];
  if (!row) throw new Error('Prospective shadow capture health query returned no row');

  return {
    generatedAt: new Date().toISOString(),
    failureGraceHours: FAILURE_GRACE_HOURS,
    cap20: {
      experiment: MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
      session: MEMBER_HISTORY_CAP20_PROSPECTIVE_SESSION,
      chambers: ['house', 'senate'],
      frozenBaselineModelVersion: CAP20_FROZEN_BASELINE_MODEL_VERSION,
      ...status({
        scope: row.cap20_scope,
        eligible: row.cap20_eligible,
        captured: row.cap20_captured,
        excluded: row.cap20_excluded,
        failed: row.cap20_failed,
        latestEligibleAt: row.cap20_latest_eligible_at,
        latestCapturedAt: row.cap20_latest_captured_at,
      }),
    },
    passageFragility: {
      experiment: 'passage-fragility-shadow-v1',
      session: PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
      chambers: [PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER],
      servingMemberModelVersion: PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL,
      ...status({
        scope: row.fragility_scope,
        eligible: row.fragility_eligible,
        captured: row.fragility_captured,
        excluded: row.fragility_excluded,
        failed: row.fragility_failed,
        latestEligibleAt: row.fragility_latest_eligible_at,
        latestCapturedAt: row.fragility_latest_captured_at,
      }),
    },
  };
}

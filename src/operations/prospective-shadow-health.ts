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
import {
  QUICK_EVIDENCE_BASE_MODEL_VERSION,
  QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
  QUICK_EVIDENCE_PROSPECTIVE_SESSION,
} from '@/forecasting/quick-evidence-shadow';
import {
  PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
  PROSPECTIVE_EVIDENCE_SESSION,
} from './prospective-evidence-plan';

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

export interface ProspectiveProductionEvidenceStatus {
  session: typeof PROSPECTIVE_EVIDENCE_SESSION;
  ownerUserId: typeof PROSPECTIVE_EVIDENCE_OWNER_USER_ID;
  forecasts: number;
  enabledSchedules: number;
  dueSchedules: number;
  revisions: number;
  resolvedForecasts: number;
  latestRevisionAt?: string;
}

export interface ProspectiveShadowCaptureHealth {
  generatedAt: string;
  failureGraceHours: number;
  productionEvidence: ProspectiveProductionEvidenceStatus;
  quickEvidence: ProspectiveShadowCaptureStatus & {
    experiment: typeof QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT;
    session: typeof QUICK_EVIDENCE_PROSPECTIVE_SESSION;
    chambers: readonly ['house', 'senate'];
    servingMemberModelVersion: typeof QUICK_EVIDENCE_BASE_MODEL_VERSION;
  };
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
  evidence_forecasts: string | number;
  evidence_enabled_schedules: string | number;
  evidence_due_schedules: string | number;
  evidence_revisions: string | number;
  evidence_resolved_forecasts: string | number;
  evidence_latest_revision_at: string | null;
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
  const quickEvidenceContext = JSON.stringify([{ experiment: QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT }]);
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
             (COALESCE(model_version = $2, false) AND generated_at IS NOT NULL) AS eligible,
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
               COALESCE(model_version = $4, false)
               AND generated_at IS NOT NULL
               AND generated_at >= $5::timestamptz
               AND passage_probability IS NOT NULL
             ) AS eligible,
             (metadata ? 'passageFragilityShadow') AS captured
        FROM scoped
       WHERE chamber_slug = $6
    ),
    production_evidence AS (
      SELECT f.id AS forecast_id,
             fs.enabled AS schedule_enabled,
             fs.next_run_at,
             r.id AS revision_id,
             r.generated_at,
             fr.id AS resolution_id
        FROM forecasts f
        JOIN legislative_sessions s ON s.id = f.session_id
        LEFT JOIN forecast_schedules fs ON fs.forecast_id = f.id
        LEFT JOIN forecast_revisions r ON r.forecast_id = f.id
        LEFT JOIN forecast_resolutions fr ON fr.forecast_id = f.id
       WHERE f.owner_user_id = $8
         AND f.target_type = 'bill'
         AND s.slug = $9
    )
    SELECT
      (SELECT count(DISTINCT forecast_id) FROM production_evidence) AS evidence_forecasts,
      (SELECT count(DISTINCT forecast_id) FROM production_evidence WHERE schedule_enabled = true) AS evidence_enabled_schedules,
      (SELECT count(DISTINCT forecast_id) FROM production_evidence WHERE schedule_enabled = true AND next_run_at <= now()) AS evidence_due_schedules,
      (SELECT count(DISTINCT revision_id) FROM production_evidence WHERE revision_id IS NOT NULL) AS evidence_revisions,
      (SELECT count(DISTINCT forecast_id) FROM production_evidence WHERE resolution_id IS NOT NULL) AS evidence_resolved_forecasts,
      (SELECT max(generated_at)::text FROM production_evidence) AS evidence_latest_revision_at,
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
    PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
    PROSPECTIVE_EVIDENCE_SESSION,
  ]);

  const row = result.rows[0];
  if (!row) throw new Error('Prospective shadow capture health query returned no row');

  const quickEvidenceResult = await pool.query<{
    scope: string | number;
    eligible: string | number;
    captured: string | number;
    excluded: string | number;
    failed: string | number;
    latest_eligible_at: string | null;
    latest_captured_at: string | null;
  }>(`
    WITH scoped AS (
      SELECT r.id,
             r.model_version,
             r.generated_at,
             c.slug AS chamber_slug
        FROM forecast_revisions r
        JOIN forecasts f ON f.id=r.forecast_id
        JOIN legislative_sessions s ON s.id=f.session_id
        JOIN chambers c ON c.id=f.target_chamber_id
       WHERE s.slug=$1
         AND f.target_type='bill'
         AND r.research_mode='quick'
         AND c.slug IN ('house','senate')
    ), evaluated AS (
      SELECT scoped.*,
             (COALESCE(model_version=$2, false) AND generated_at IS NOT NULL) AS eligible,
             (
               EXISTS (
                 SELECT 1 FROM forecast_member_predictions fmp
                  WHERE fmp.revision_id=scoped.id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM forecast_member_predictions fmp
                  WHERE fmp.revision_id=scoped.id
                    AND NOT (COALESCE(fmp.context, '[]'::jsonb) @> $3::jsonb)
               )
             ) AS captured
        FROM scoped
    )
    SELECT count(*) AS scope,
           count(*) FILTER (WHERE eligible) AS eligible,
           count(*) FILTER (WHERE eligible AND captured) AS captured,
           count(*) FILTER (WHERE NOT eligible) AS excluded,
           count(*) FILTER (
             WHERE eligible AND NOT captured
               AND generated_at < now() - ($4::text || ' hours')::interval
           ) AS failed,
           (max(generated_at) FILTER (WHERE eligible))::text AS latest_eligible_at,
           (max(generated_at) FILTER (WHERE eligible AND captured))::text AS latest_captured_at
      FROM evaluated
  `, [
    QUICK_EVIDENCE_PROSPECTIVE_SESSION,
    QUICK_EVIDENCE_BASE_MODEL_VERSION,
    quickEvidenceContext,
    FAILURE_GRACE_HOURS,
  ]);
  const quickEvidence = quickEvidenceResult.rows[0];
  if (!quickEvidence) throw new Error('Quick Evidence prospective capture health query returned no row');

  return {
    generatedAt: new Date().toISOString(),
    failureGraceHours: FAILURE_GRACE_HOURS,
    productionEvidence: {
      session: PROSPECTIVE_EVIDENCE_SESSION,
      ownerUserId: PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
      forecasts: count(row.evidence_forecasts),
      enabledSchedules: count(row.evidence_enabled_schedules),
      dueSchedules: count(row.evidence_due_schedules),
      revisions: count(row.evidence_revisions),
      resolvedForecasts: count(row.evidence_resolved_forecasts),
      ...(row.evidence_latest_revision_at ? { latestRevisionAt: row.evidence_latest_revision_at } : {}),
    },
    quickEvidence: {
      experiment: QUICK_EVIDENCE_PROSPECTIVE_EXPERIMENT,
      session: QUICK_EVIDENCE_PROSPECTIVE_SESSION,
      chambers: ['house', 'senate'],
      servingMemberModelVersion: QUICK_EVIDENCE_BASE_MODEL_VERSION,
      ...status({
        scope: quickEvidence.scope,
        eligible: quickEvidence.eligible,
        captured: quickEvidence.captured,
        excluded: quickEvidence.excluded,
        failed: quickEvidence.failed,
        latestEligibleAt: quickEvidence.latest_eligible_at,
        latestCapturedAt: quickEvidence.latest_captured_at,
      }),
    },
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

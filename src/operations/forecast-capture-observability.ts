import type { Pool } from 'pg';

/** Register both obligations inside the Quick revision/input-manifest transaction. */
export async function recordRequiredCaptureAttempts(db: Pick<Pool,'query'>, revisionId: string): Promise<void> {
  await db.query(`INSERT INTO forecast_capture_attempts(revision_id,capture_kind,status)
    VALUES($1,'member_cap20','started'),($1,'quick_evidence','started')`,[revisionId]);
}

export async function recordCaptureAttempt(db: Pick<Pool,'query'>, revisionId: string,
  kind: 'quick_evidence' | 'member_cap20', status: 'started' | 'completed' | 'failed' | 'not_applicable'): Promise<void> {
  await db.query(`INSERT INTO forecast_capture_attempts(revision_id,capture_kind,status,error_code)
    VALUES($1,$2,$3,$4)`,[revisionId,kind,status,status==='failed'?'CAPTURE_FAILED':null]);
}

/** Readiness only: no outcomes, accuracy metrics, Vercel call or scheduler activation. */
export async function captureHealth(db: Pick<Pool,'query'>): Promise<{incomplete:number; failed:number; unsealed:number}> {
  const row=(await db.query<{incomplete:number;failed:number;unsealed:number}>(`
    WITH latest AS (
      SELECT DISTINCT ON(revision_id,capture_kind) revision_id,capture_kind,status
      FROM forecast_capture_attempts ORDER BY revision_id,capture_kind,sequence DESC
    ) SELECT
      (SELECT count(*)::int FROM latest WHERE status='started') AS incomplete,
      (SELECT count(*)::int FROM latest WHERE status='failed') AS failed,
      (SELECT count(*)::int FROM latest l WHERE NOT EXISTS
        (SELECT 1 FROM forecast_input_manifests m WHERE m.revision_id=l.revision_id)) AS unsealed`)).rows[0];
  return row;
}

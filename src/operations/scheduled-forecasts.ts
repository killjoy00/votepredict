import { pool } from '../lib/db';
import { updateForecast } from '../forecasting/workflows';
import { listSafeOutcomeCandidates, resolveSafeForecastOutcome } from './safe-resolution';

interface DueSchedule { forecast_id: string; owner_user_id: string; research_mode: 'quick' | 'deep'; scheduled_for: string; run_id: string; }

export const CLAIM_DUE_SCHEDULES_SQL = `
    WITH due AS (
      SELECT fs.forecast_id, fs.next_run_at AS scheduled_for
        FROM forecast_schedules fs JOIN forecasts f ON f.id = fs.forecast_id
       WHERE ($2::text IS NULL OR fs.forecast_id::text = $2) AND fs.enabled = true AND fs.next_run_at <= now() AND f.archived_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM forecast_resolutions r WHERE r.forecast_id=f.id)
         AND NOT EXISTS (SELECT 1 FROM forecast_snapshot_runs r WHERE r.forecast_id=f.id AND r.status='running')
       ORDER BY fs.next_run_at FOR UPDATE OF fs SKIP LOCKED LIMIT $1
    ), runs AS (
      INSERT INTO forecast_snapshot_runs (forecast_id, scheduled_for, status)
      SELECT forecast_id, scheduled_for, 'running' FROM due
      ON CONFLICT (forecast_id, scheduled_for) DO NOTHING
      RETURNING id, forecast_id, scheduled_for
    ), advanced AS (
      UPDATE forecast_schedules fs
         SET next_run_at = greatest(runs.scheduled_for, now()) + make_interval(hours => fs.cadence_hours), updated_at = now()
        FROM runs WHERE fs.forecast_id = runs.forecast_id
      RETURNING fs.forecast_id, fs.research_mode, runs.scheduled_for, runs.id AS run_id
    )
    SELECT a.forecast_id, f.owner_user_id, a.research_mode, a.scheduled_for::text, a.run_id
      FROM advanced a JOIN forecasts f ON f.id = a.forecast_id`;

export async function claimDueSchedules(limit: number, forecastId?: string): Promise<DueSchedule[]> {
  const result = await pool.query<DueSchedule>(CLAIM_DUE_SCHEDULES_SQL, [limit, forecastId ?? null]);
  return result.rows;
}

export async function runScheduledForecasts(limit = 10, dependencies = { updateForecast, listSafeOutcomeCandidates, resolveSafeForecastOutcome }, forecastId?: string): Promise<{ claimed: number; completed: number; failed: number; resolved: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Forecast batch size must be an integer between 1 and 100');
  const schedules = await claimDueSchedules(limit, forecastId);
  let completed = 0;
  let failed = 0;
  let resolved = 0;
  for (const schedule of schedules) {
    const runId = schedule.run_id;
    try {
      const candidates = await dependencies.listSafeOutcomeCandidates(schedule.forecast_id, schedule.owner_user_id);
      let resolutionId: string | undefined;
      if (candidates.length === 1) {
        await dependencies.resolveSafeForecastOutcome({ forecastId: schedule.forecast_id, ownerUserId: schedule.owner_user_id, voteEventId: candidates[0].id });
        const resolution = await pool.query<{ id: string }>('SELECT id FROM forecast_resolutions WHERE forecast_id = $1', [schedule.forecast_id]);
        resolutionId = resolution.rows[0]?.id;
        resolved += 1;
      }
      const update = candidates.length === 0 ? await dependencies.updateForecast(schedule.forecast_id, schedule.owner_user_id, schedule.research_mode) : undefined;
      await pool.query(`UPDATE forecast_snapshot_runs SET status='completed', finished_at=now(), revision_id=$2, resolution_id=$3, metadata=$4::jsonb WHERE id=$1`,
        [runId, update?.result.revisionId ?? null, resolutionId ?? null, JSON.stringify({ deepError: update?.deepError ?? null, outcomeCandidates: candidates.length })]);
      await pool.query(`UPDATE forecast_schedules SET last_run_at=now(), consecutive_failures=0, enabled=CASE WHEN $2::boolean THEN false ELSE enabled END WHERE forecast_id=$1`, [schedule.forecast_id, Boolean(resolutionId)]);
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await pool.query(`UPDATE forecast_snapshot_runs SET status='failed', finished_at=now(), error_summary=$2 WHERE id=$1`, [runId, message.slice(0, 2_000)]);
      await pool.query(`UPDATE forecast_schedules SET last_run_at=now(), consecutive_failures=consecutive_failures+1, enabled=(consecutive_failures + 1) < 5 WHERE forecast_id=$1`, [schedule.forecast_id]);
      failed += 1;
    }
  }
  return { claimed: schedules.length, completed, failed, resolved };
}

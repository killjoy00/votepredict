import { pool } from '../lib/db';
import { updateForecast } from '../forecasting/workflows';
import { listSafeOutcomeCandidates, resolveSafeForecastOutcome } from './safe-resolution';

interface DueSchedule { forecast_id: string; owner_user_id: string; research_mode: 'quick' | 'deep'; scheduled_for: string; }

async function claimDueSchedules(limit: number): Promise<DueSchedule[]> {
  const result = await pool.query<DueSchedule>(`
    WITH due AS (
      SELECT fs.forecast_id, fs.next_run_at AS scheduled_for
        FROM forecast_schedules fs JOIN forecasts f ON f.id = fs.forecast_id
       WHERE fs.enabled = true AND fs.next_run_at <= now() AND f.archived_at IS NULL
       ORDER BY fs.next_run_at FOR UPDATE OF fs SKIP LOCKED LIMIT $1
    ), advanced AS (
      UPDATE forecast_schedules fs
         SET next_run_at = due.scheduled_for + make_interval(hours => fs.cadence_hours), updated_at = now()
        FROM due WHERE fs.forecast_id = due.forecast_id
      RETURNING fs.forecast_id, fs.research_mode, due.scheduled_for
    )
    SELECT a.forecast_id, f.owner_user_id, a.research_mode, a.scheduled_for::text
      FROM advanced a JOIN forecasts f ON f.id = a.forecast_id`, [limit]);
  return result.rows;
}

export async function runScheduledForecasts(limit = 20): Promise<{ claimed: number; completed: number; failed: number; resolved: number }> {
  const schedules = await claimDueSchedules(limit);
  let completed = 0;
  let failed = 0;
  let resolved = 0;
  for (const schedule of schedules) {
    const run = await pool.query<{ id: string }>(`
      INSERT INTO forecast_snapshot_runs (forecast_id, scheduled_for, status)
      VALUES ($1,$2,'running') ON CONFLICT (forecast_id, scheduled_for) DO NOTHING RETURNING id`,
    [schedule.forecast_id, schedule.scheduled_for]);
    const runId = run.rows[0]?.id;
    if (!runId) continue;
    try {
      const update = await updateForecast(schedule.forecast_id, schedule.owner_user_id, schedule.research_mode);
      const candidates = await listSafeOutcomeCandidates(schedule.forecast_id, schedule.owner_user_id);
      let resolutionId: string | undefined;
      if (candidates.length === 1) {
        await resolveSafeForecastOutcome({ forecastId: schedule.forecast_id, ownerUserId: schedule.owner_user_id, voteEventId: candidates[0].id });
        const resolution = await pool.query<{ id: string }>('SELECT id FROM forecast_resolutions WHERE forecast_id = $1', [schedule.forecast_id]);
        resolutionId = resolution.rows[0]?.id;
        resolved += 1;
      }
      await pool.query(`UPDATE forecast_snapshot_runs SET status='completed', finished_at=now(), revision_id=$2, resolution_id=$3, metadata=$4::jsonb WHERE id=$1`,
        [runId, update.result.revisionId, resolutionId ?? null, JSON.stringify({ deepError: update.deepError ?? null, outcomeCandidates: candidates.length })]);
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

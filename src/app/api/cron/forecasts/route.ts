import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { runScheduledForecasts } from '@/operations/scheduled-forecasts';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (new URL(request.url).searchParams.get('systemSmoke') === '1') {
    const matches = await pool.query(`SELECT f.id, fs.enabled, fs.research_mode,
      fs.next_run_at <= now() AS due FROM forecasts f
      JOIN forecast_schedules fs ON fs.forecast_id = f.id
      WHERE f.owner_user_id = 'system:production-smoke' AND f.archived_at IS NULL`);
    if (matches.rows.length !== 1 || matches.rows[0].research_mode !== 'quick' ||
        !matches.rows[0].enabled || !matches.rows[0].due) {
      return NextResponse.json({ error: 'Expected one enabled, due system Quick schedule' }, { status: 409 });
    }
    const forecastId = matches.rows[0].id as string;
    const result = await runScheduledForecasts(1, undefined, forecastId);
    const runs = await pool.query(`SELECT status, revision_id IS NOT NULL AS has_revision,
      resolution_id IS NOT NULL AS has_resolution, finished_at IS NOT NULL AS finished
      FROM forecast_snapshot_runs WHERE forecast_id = $1 ORDER BY started_at DESC LIMIT 1`, [forecastId]);
    return NextResponse.json({ generatedAt: new Date().toISOString(), ...result, latestRun: runs.rows[0] });
  }
  const result = await runScheduledForecasts(Number(process.env.FORECAST_BATCH_SIZE ?? 10));
  return NextResponse.json({ generatedAt: new Date().toISOString(), ...result });
}

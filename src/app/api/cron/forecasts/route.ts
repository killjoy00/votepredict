import { updateForecast } from '@/forecasting/workflows';
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
        !matches.rows[0].enabled) {
      return NextResponse.json({ error: 'Expected one enabled, due system Quick schedule' }, { status: 409 });
    }
    const forecastId = matches.rows[0].id as string;
    const result = matches.rows[0].due ? await runScheduledForecasts(1, undefined, forecastId) : { claimed: 0, completed: 0, failed: 0, resolved: 0 };
    const alreadyCompleted = !matches.rows[0].due;
    const runs = await pool.query(`SELECT status, revision_id IS NOT NULL AS has_revision,
      resolution_id IS NOT NULL AS has_resolution, finished_at IS NOT NULL AS finished
      FROM forecast_snapshot_runs WHERE forecast_id = $1 ORDER BY started_at DESC LIMIT 1`, [forecastId]);
    return NextResponse.json({ generatedAt: new Date().toISOString(), ...result, alreadyCompleted, latestRun: runs.rows[0] });
  }
  const result = await runScheduledForecasts(Number(process.env.FORECAST_BATCH_SIZE ?? 10));
  return NextResponse.json({ generatedAt: new Date().toISOString(), ...result });
}

// Explicit authenticated operation; never part of the automatic daily GET batch.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (new URL(request.url).searchParams.get('systemDeep') !== '1') {
    return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 });
  }
  const forecasts = await pool.query("SELECT id FROM forecasts WHERE owner_user_id='system:production-smoke' AND archived_at IS NULL");
  if (forecasts.rows.length !== 1) return NextResponse.json({ error: 'Expected one system forecast' }, { status: 409 });
  const update = await updateForecast(forecasts.rows[0].id, 'system:production-smoke', 'deep');
  const research = 'research' in update.result ? update.result.research : undefined;
  const failure = update.deepError ? (/credit card|payment|billing|credits|402/i.test(update.deepError) ? 'billing_required' :
    /unauthorized|authentication|401|403/i.test(update.deepError) ? 'authentication_failed' :
    /timeout|timed out/i.test(update.deepError) ? 'timeout' : 'research_failed') : null;
  return NextResponse.json({ mode: update.result.researchMode, failure,
    evidenceCount: research?.evidenceCount ?? 0, includedEvidenceCount: research?.includedEvidenceCount ?? 0,
    sourceCount: research?.sources.length ?? 0 });
}

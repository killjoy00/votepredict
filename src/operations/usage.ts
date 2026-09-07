import { pool } from '@/lib/db';

export class ExternalUsageBudgetError extends Error {
  constructor(readonly provider: string, readonly operation: string, readonly limit: number) {
    super(`${provider} ${operation} daily limit (${limit}) has been reached. The existing forecast remains available; retry after the budget window resets or raise the configured limit intentionally.`);
  }
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function deepResearchDailyLimit(): number {
  return positiveIntegerEnv('VOTEPREDICT_DEEP_DAILY_LIMIT', 20);
}

export async function assertExternalUsageBudget(provider: string, operation: string, limit: number): Promise<void> {
  const result = await pool.query<{ attempts: number }>(`
    SELECT count(*)::int AS attempts
      FROM external_usage_events
     WHERE provider = $1
       AND operation = $2
       AND occurred_at >= now() - interval '24 hours'`, [provider, operation]);
  const attempts = Number(result.rows[0]?.attempts ?? 0);
  if (attempts >= limit) throw new ExternalUsageBudgetError(provider, operation, limit);
}

export async function recordExternalUsage(input: {
  provider: string;
  operation: string;
  forecastId?: string;
  researchRunId?: string;
  success: boolean;
  units?: Record<string, unknown>;
  error?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const errorSummary = input.error instanceof Error ? input.error.message : input.error ? String(input.error) : null;
  await pool.query(`
    INSERT INTO external_usage_events (
      provider, operation, forecast_id, research_run_id, success, units, error_summary, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)`, [
    input.provider,
    input.operation,
    input.forecastId ?? null,
    input.researchRunId ?? null,
    input.success,
    JSON.stringify(input.units ?? {}),
    errorSummary?.slice(0, 1600) ?? null,
    JSON.stringify(input.metadata ?? {}),
  ]);
}

export async function getExternalUsageSummary(hours = 24) {
  const safeHours = Math.max(1, Math.min(24 * 30, Math.trunc(hours)));
  const result = await pool.query<{
    provider: string;
    operation: string;
    attempts: number;
    successes: number;
    failures: number;
    latest_at: string;
  }>(`
    SELECT provider,
           operation,
           count(*)::int AS attempts,
           count(*) FILTER (WHERE success)::int AS successes,
           count(*) FILTER (WHERE NOT success)::int AS failures,
           max(occurred_at)::text AS latest_at
      FROM external_usage_events
     WHERE occurred_at >= now() - ($1::int * interval '1 hour')
     GROUP BY provider, operation
     ORDER BY max(occurred_at) DESC`, [safeHours]);
  return result.rows.map((row) => ({
    provider: row.provider,
    operation: row.operation,
    attempts: Number(row.attempts),
    successes: Number(row.successes),
    failures: Number(row.failures),
    latestAt: row.latest_at,
  }));
}

import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import schema from './release-schema.json';
import type { MigrationLedgerEntry } from './migration-ledger';

export function migrationLedgerDigest(entries: readonly MigrationLedgerEntry[]): string {
  const ordered = [...entries].sort((a, b) => a.filename.localeCompare(b.filename));
  return createHash('sha256').update(JSON.stringify(ordered.map(({ filename, checksum }) => ({ filename, checksum })))).digest('hex');
}

/** Passwords, URL options and pooled routing never enter the public receipt. */
export function databaseTargetFingerprint(connection: string | undefined): string | null {
  if (!connection?.trim()) return null;
  try {
    const url = new URL(connection);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
    // pg gives several query parameters precedence over the URL authority.
    // Require an endpoint-qualified URL, rather than certifying a hidden override.
    if (['host', 'hostaddr', 'port', 'user', 'options', 'service'].some(key => url.searchParams.has(key))) return null;
    const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
    const identity = [host, url.port || '5432', decodeURIComponent(url.pathname.slice(1)), decodeURIComponent(url.username)];
    if (identity.some((value) => !value)) return null;
    return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  } catch { return null; }
}

export function executionPosture(env: Record<string, string | undefined> = process.env) {
  // #732 remains manual-only. An absent/unknown Vercel mode fails closed.
  const mode = env.VOTEPREDICT_EXECUTION_MODE;
  const paused = mode === 'readiness' || mode === 'paused' || Boolean(env.VERCEL);
  return { mode: paused ? 'readiness' : 'development', forecastsEnabled: !paused, schedulerEnabled: !paused,
    prospective2027Enabled: false, automaticRunsPerDay: 0 } as const;
}

export function assertForecastExecutionAllowed() {
  if (!executionPosture().forecastsEnabled) throw new Error('FORECAST_EXECUTION_PAUSED: readiness deployment permits read-only verification only.');
}

/** One snapshot, bounded SQL, explicit rollback; no forecasting or source acquisition. */
export async function readReleaseBinding(db: Pick<Pool, 'connect'>, actualFingerprint: string | null,
  expectedFingerprint: string | undefined) {
  const client = await db.connect();
  let destroyed = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '2000ms'");
    await client.query("SET LOCAL lock_timeout = '500ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
    const settings = (await client.query<{ read_only: string; isolation: string }>(
      "SELECT current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation")).rows[0];
    if (settings?.read_only !== 'on' || settings.isolation !== 'repeatable read') throw new Error('Read-only snapshot not established');
    const ledger = (await client.query<MigrationLedgerEntry>(
      'SELECT filename, checksum FROM public.votepredict_schema_migrations ORDER BY filename LIMIT 1000')).rows;
    const digest = migrationLedgerDigest(ledger);
    const targetMatches = Boolean(actualFingerprint && /^[a-f0-9]{64}$/.test(expectedFingerprint ?? '') && actualFingerprint === expectedFingerprint);
    const schemaMatches = ledger.length === schema.count && digest === schema.sha256;
    return { verified: targetMatches && schemaMatches, targetMatches, schemaMatches,
      targetFingerprint: actualFingerprint, schemaDigest: digest, migrationCount: ledger.length,
      transaction: 'repeatable_read_read_only_rollback' as const };
  } finally {
    try { await client.query('ROLLBACK'); } catch { destroyed = true; }
    client.release(destroyed);
    if (destroyed) throw new Error('Readiness rollback could not be verified');
  }
}

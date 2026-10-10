/**
 * Issue #864 / Track D: one-time PRIVATE local export for a separately
 * authorized, strictly SELECT-only VotePredict Postgres role.
 *
 * Set VOTEPREDICT_MEDIA_READONLY_DATABASE_URL outside this repository.
 * node --import tsx scripts/export-senate-media-readonly.ts \
 *   --output-dir "$HOME/votepredict-private-media-2021-25"
 *
 * No Vercel, Neon API, GitHub Actions, credentials in command arguments,
 * production mutation, network discovery, or private artifacts in Git.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SENATE_MEDIA_EXPORT_VERSION,
  SENATE_MEDIA_READONLY_PREFLIGHT_SQL,
  assertSenateMediaReadOnlyPreflight,
  buildSenateMediaReadOnlySnapshotSql,
  splitSenateMediaReadOnlyExport,
} from '../src/evidence/senate-media-readonly-export.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PSQL_BYTES = 32_000_000;

function secureLocalDestination(): string {
  const argv = process.argv.slice(2);
  if (argv.length !== 2 || argv[0] !== '--output-dir' || !argv[1]?.trim())
    throw Error('Require --output-dir PRIVATE_NEW_DIRECTORY outside the repository checkout');
  if (!isAbsolute(argv[1]))
    throw Error('The private export output directory must be an absolute path');
  const output = resolve(argv[1]);
  if (output === REPO || output.startsWith(REPO + sep))
    throw Error('Refusing to write private exports inside the Git checkout');
  if (existsSync(output))
    throw Error('Refusing to reuse or overwrite a pre-existing private export directory');
  return output;
}

function postgresEnv(): NodeJS.ProcessEnv {
  const value = process.env.VOTEPREDICT_MEDIA_READONLY_DATABASE_URL?.trim();
  if (!value) throw Error('Missing VOTEPREDICT_MEDIA_READONLY_DATABASE_URL (do not paste credentials into chat or GitHub)');
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw Error('Invalid private Postgres connection URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !parsed.hostname || !parsed.username || !parsed.password
    || !parsed.pathname || parsed.pathname === '/') {
    throw Error('Require a complete TLS Postgres URL for the separately approved restricted SELECT-only role');
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Avoid passing the original secret URL (or stale local PG* environment) to child processes.
  for (const key of Object.keys(env)) {
    if (key.startsWith('PG') || key === 'VOTEPREDICT_MEDIA_READONLY_DATABASE_URL')
      delete env[key];
  }
  env.PGHOST = parsed.hostname;
  env.PGPORT = parsed.port || '5432';
  env.PGUSER = decodeURIComponent(parsed.username);
  env.PGPASSWORD = decodeURIComponent(parsed.password);
  env.PGDATABASE = decodeURIComponent(parsed.pathname.slice(1));
  env.PGSSLMODE = 'require';
  env.PGCHANNELBINDING = parsed.searchParams.get('channel_binding') === 'require' ? 'require' : 'prefer';
  env.PGCONNECT_TIMEOUT = '12';
  env.PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=10000';
  return env;
}

function psql(sql: string, env: NodeJS.ProcessEnv, stage: 'preflight' | 'export'): string {
  const result = spawnSync('psql', ['-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1'], {
    input: sql + '\n',
    encoding: 'utf8',
    env,
    cwd: REPO,
    timeout: stage === 'preflight' ? 30_000 : 180_000,
    maxBuffer: MAX_PSQL_BYTES,
  });
  if (result.error || result.status !== 0 || result.signal) {
    // Do not print stderr, connection information, SQL result data or source URLs.
    throw Error('Private psql ' + stage + ' failed; inspect connection, role and network locally (no data exported)');
  }
  return result.stdout;
}
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function privateFile(path: string, content: string): void {
  writeFileSync(path, content, { flag: 'wx', mode: 0o600 });
}

function main(): void {
  const output = secureLocalDestination();
  const env = postgresEnv();
  let preflight: unknown;
  try { preflight = JSON.parse(psql(SENATE_MEDIA_READONLY_PREFLIGHT_SQL, env, 'preflight').trim()); }
  catch { throw Error('Could not parse private SELECT-only role preflight'); }
  const approved = assertSenateMediaReadOnlyPreflight(preflight);
  const contextSql = readFileSync(
    resolve(REPO, 'scripts/export-senate-media-context-readonly.sql'), 'utf8');
  const rosterSql = readFileSync(
    resolve(REPO, 'scripts/export-senate-media-roster-readonly.sql'), 'utf8');
  const snapshot = buildSenateMediaReadOnlySnapshotSql(contextSql, rosterSql);
  const exported = splitSenateMediaReadOnlyExport(psql(snapshot, env, 'export'));
  const contextBody = exported.contexts.join('\n') + '\n';
  const rosterBody = exported.roster.join('\n') + '\n';
  // All validations complete before any private files are created.
  mkdirSync(output, { mode: 0o700 });
  const contextPath = resolve(output, 'media-context.jsonl');
  const rosterPath = resolve(output, 'senate-roster.jsonl');
  privateFile(contextPath, contextBody);
  privateFile(rosterPath, rosterBody);
  const reportPath = resolve(output, 'media-discovery-audit.json');
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', 'scripts/audit-senate-media-remarks-offline.ts',
    '--context', contextPath, '--roster', rosterPath, '--output', reportPath,
  ], {
    cwd: REPO, env: { ...process.env, VOTEPREDICT_MEDIA_READONLY_DATABASE_URL: '' },
    encoding: 'utf8', timeout: 60_000, maxBuffer: 250_000,
  });
  if (result.error || result.status !== 0)
    throw Error('Private source export succeeded but the local discovery-only audit failed; keep files private');
  const manifest = {
    version: SENATE_MEDIA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceDatabase: approved.database,
    selectOnlyRoleChecked: true,
    oneRepeatableReadSnapshot: true,
    rawSourceArticleBodiesExported: false,
    originalSnapshotBytesAcquired: false,
    reviewVerdictsSupplied: false,
    noHistoricalCompletenessCertificate: true,
    noProductionDatabaseWrite: true,
    files: {
      'media-context.jsonl': { rows: exported.contexts.length, sha256: sha256(contextBody) },
      'senate-roster.jsonl': { rows: exported.roster.length, sha256: sha256(rosterBody) },
      'media-discovery-audit.json': { sha256: sha256(readFileSync(reportPath, 'utf8')) },
    },
    distinctArchivedSourceDocuments: exported.distinctSourceDocuments,
    captureYearContextItems: exported.captureYearCounts,
    contextItemsIn2021To2025: exported.studyYearContexts,
    outOfScopeOrUnknownYearContextItems: exported.excludedYearContexts,
    importantCaveat: 'No submitted human quote reviews or exact archived raw bytes: zero verified quotes in this discovery audit is not evidence of zero published remarks.',
  };
  privateFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({
    outputDirectory: output,
    sourceContextItems: exported.contexts.length,
    studyYearContextItems: exported.studyYearContexts,
    excludedYearContextItems: exported.excludedYearContexts,
    senatorMembershipYearRows: exported.roster.length,
    distinctArchiveSourceDocuments: exported.distinctSourceDocuments,
    roleStrictlyReadOnly: true,
    privateExportCompleted: true,
    sourceBytesAndHumanQuotesStillUnverified: true,
  }, null, 2));
}

try { main(); }
catch (error) {
  // No private URLs, Postgres errors, SQL rows or passwords leave this process.
  console.error(error instanceof Error ? error.message : 'Private media export failed');
  process.exitCode = 1;
}

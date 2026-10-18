/**
 * One-shot, protected production deployment for Minnesota Senate caucus raw statements.
 * Additive migration 0016 and URL-deduplicated INSERT only; no forecasting writes.
 * Uses existing VotePredict Neon default-branch primary and Actions credentials.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { SenatePressRawStore } from '../src/operations/senate-press-raw-store.js';
import { HISTORICAL_DFL_SITEMAPS, fetchArchivedDFLSitemap, orderedHistoricalDFLCandidates }
  from '../src/sources/minnesota/senate-dfl-sitemap-archive.js';
import {
  collectSource, collectDirectArticle, discoverRepublicanMemberPages,
  type SenatePressSource, type SourceCounts,
} from '../src/sources/minnesota/senate-press-raw.js';

const MIGRATION = '0016_senate_raw_statements.sql';
const MARKER = 'SENATE_PRESS_RAW_PRODUCTION_20261015';
const DFL_REPAIR_MARKER = 'SENATE_PRESS_DFL_REPAIR_20261015';
const DFL_MURPHY_MARKER = 'SENATE_DFL_ERIN_MURPHY_2025_20261018';
const DFL_ONLY = process.env.VOTEPREDICT_SENATE_PRESS_DFL_ONLY === 'true';
const COVERAGE_MARKER = 'SENATE_PRESS_COVERAGE_20261015';
const GOP_MARKER = 'SENATE_GOP_RAW_REPAIR_20261015';
const DAILY_CRON = '27 15 * * *';
const MODE = process.env.VOTEPREDICT_SENATE_PRESS_MODE ?? (DFL_ONLY ? 'dfl' : 'initial');
const GOP_ONLY = MODE === 'gop-repair' || MODE === 'gop-daily';
const DAILY = MODE === 'gop-daily', COVERAGE = MODE === 'coverage';
const END = new Date().toISOString().slice(0, 10);
const START = DAILY
  ? new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10) : '2023-01-01';
const MAX_PAGES = DAILY ? 35 : 1000;
const GOP_MISSED_URL =
  'https://www.mnsenaterepublicans.com/kreun-responds-to-attorney-generals-second-opinion-addressing-sro-issues/';
const SOURCES: Record<string, string> = {
  senate_dfl: 'https://senatedfl.mn/press-releases/',
  senate_republicans: 'https://www.mnsenaterepublicans.com/news/',
};
type Ledger = { filename: string; checksum: string };
type Count = { source_id: string; year: string; items: number };

function assertReviewedMain(): boolean {
  const env = process.env;
  if(!['initial','dfl','coverage','gop-repair','gop-daily'].includes(MODE)
    || (DFL_ONLY && MODE!=='dfl')
    || (!DFL_ONLY && MODE==='dfl'))
    throw Error('Unexpected production collection mode');
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT !== '1' || env.VOTEPREDICT_SENATE_PRESS_CI !== 'true'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || !env.GITHUB_EVENT_PATH)
    throw Error('Expected independently verified main commit');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) as {
    ref?: string; after?: string; deleted?: boolean; forced?: boolean; schedule?:string;
    repository?: { full_name?: string }; head_commit?: { id?: string; message?: string };
  };
  if (event.repository?.full_name !== env.GITHUB_REPOSITORY)
    throw Error('GitHub event repository identity mismatch');
  if (DAILY) {
    if(env.GITHUB_EVENT_NAME!=='schedule' || event.schedule!==DAILY_CRON)
      throw Error('Unexpected daily cron event');
    return false;
  }
  if (env.GITHUB_EVENT_NAME!=='push'
    || event.ref !== 'refs/heads/main' || event.after !== env.GITHUB_SHA
    || event.deleted === true || event.forced === true
    || event.head_commit?.id !== env.GITHUB_SHA
    || !event.head_commit?.message?.includes(COVERAGE ? COVERAGE_MARKER : GOP_ONLY ? GOP_MARKER : DFL_ONLY ? DFL_REPAIR_MARKER : MARKER))
    throw Error('One-shot protected production merge marker missing or mismatched');
  return DFL_ONLY && event.head_commit?.message?.includes(DFL_MURPHY_MARKER)===true;
}
function expectedMigrations(): Ledger[] {
  const files = readdirSync('migrations').filter(x => /^\d{4}_[a-z0-9_-]+\.sql$/.test(x)).sort();
  // 0017 and later additive migrations may be merged while the long-running
  // 0016 archive backfill is still active. Replays must validate the entire
  // ledger prefix rather than falsely require 0016 to be the last migration.
  if (files.indexOf(MIGRATION) !== 15 || files.length < 16)
    throw Error('Raw statement migration 0016 missing or out of order');
  return files.map(filename => ({
    filename, checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}
function validateLedger(actual: Ledger[], expected: Ledger[]): boolean {
  if (actual.length < 15 || actual.length > expected.length)
    throw Error('Production migration ledger incomplete or beyond reviewed inventory');
  for (let i = 0; i < actual.length; i++)
    if (actual[i].filename !== expected[i]?.filename
      || actual[i].checksum !== expected[i]?.checksum)
      throw Error('Production migration checksum/order drift');
  return actual.length >= 16;
}
function configuredSources(): SenatePressSource[] {
  const value: unknown = JSON.parse(readFileSync('data/senate-press-sources.json', 'utf8'));
  if (!Array.isArray(value) || value.length !== 2) throw Error('Unexpected Senate source count');
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw Error('Invalid source record');
    const source = entry as SenatePressSource;
    if (SOURCES[source.id] !== source.archive_url || seen.has(source.id)
      || typeof source.source_type !== 'string'
      || !source.source_type.startsWith('senate_')
      || !source.pagination || !['query', 'path'].includes(source.pagination.kind))
      throw Error('Source configuration outside reviewed first-party caucus allowlist');
    seen.add(source.id);
    return source;
  });
}
async function readonly<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try { return await run(client); }
    finally { await client.query('ROLLBACK'); }
  } finally { client.release(); }
}
async function readback(pool: Pool): Promise<Count[]> {
  return readonly(pool, async client => {
    const q = await client.query<{ source_id: string; year: string; items: string }>(
      "SELECT source_id, COALESCE(to_char(published_on,'YYYY'),'undated') AS year, " +
      "COUNT(*)::text AS items FROM senate_raw_statements " +
      'WHERE source_id = ANY($1::text[]) GROUP BY source_id, year ORDER BY source_id, year',
      [Object.keys(SOURCES)],
    );
    return q.rows.map(row => {
      const items = Number(row.items);
      if (!Number.isSafeInteger(items) || items < 0) throw Error('Invalid row count');
      return { source_id: row.source_id, year: row.year, items };
    });
  });
}
function totals(rows: Count[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) result[row.source_id] = (result[row.source_id] ?? 0) + row.items;
  return result;
}
async function main(): Promise<void> {
  let phase = 'reviewed_main_gate';
  let pool: Pool | undefined;
  try {
    if (process.argv.length !== 2) throw Error('Unexpected production arguments');
    const recoverHistoricalMurphy=assertReviewedMain();
    const expected = expectedMigrations();
    const sources = configuredSources().filter(s =>
      GOP_ONLY ? s.id==='senate_republicans' : !DFL_ONLY || s.id==='senate_dfl');
    if (sources.length !== ((DFL_ONLY||GOP_ONLY) ? 1 : 2))
      throw Error('Expected reviewed first-party source subset not found');
    const murphySourceUrl=
      'https://senatedfl.mn/senate-majority-leader-erin-murphy-responds-to-house-power-sharing-agreement/';
    if(recoverHistoricalMurphy){
      phase='pinned_first_party_2025_erinn_murphy_original';
      const pages=[];
      for(const pinned of HISTORICAL_DFL_SITEMAPS){
        pages.push(await fetchArchivedDFLSitemap(pinned));
        await sleep(1400);
      }
      const originals=orderedHistoricalDFLCandidates(pages);
      if(originals.length!==1150 ||
        originals.filter(c=>c.url===murphySourceUrl&&c.lastModifiedOn?.slice(0,4)==='2025').length!==1)
        throw Error('Requested Murphy historical original not exactly pinned in the publisher sitemap');
    }
    phase = 'existing_default_branch_primary';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY?.trim() ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
      requirePrimary: true,
    });
    pool = new Pool({
      host: target.host, port: target.port, user: target.role,
      password: target.password, database: target.database, ssl: { rejectUnauthorized: true },
      max: 2, connectionTimeoutMillis: 10000, statement_timeout: 115000,
      query_timeout: 120000, application_name: 'votepredict-senate-first-party-raw',
      options: '-c statement_timeout=115000 -c lock_timeout=3000',
    });
    phase = 'readonly_identity_and_schema_ledger_preflight';
    const targetApplied = await readonly(pool, async c => {
      const identity = await c.query(
        "SELECT current_database() AS db, current_user AS role, current_setting('transaction_read_only') AS ro",
      );
      if (identity.rows.length !== 1 || identity.rows[0].db !== target.database
        || identity.rows[0].role !== target.role || identity.rows[0].ro !== 'on')
        throw Error('Neon identity mismatch');
      const prior = await c.query<{ ledger: string | null }>(
        "SELECT to_regclass('public.votepredict_schema_migrations')::text AS ledger",
      );
      if (!prior.rows[0]?.ledger) throw Error('Migration ledger missing');
      const ledger = await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
      );
      const applied = validateLedger(ledger.rows, expected);
      const table = await c.query<{ present: boolean }>(
        "SELECT to_regclass('public.senate_raw_statements') IS NOT NULL AS present",
      );
      if (table.rows[0]?.present !== applied) throw Error('Raw table/ledger inconsistency');
      return applied;
    });
    phase = 'serializable_additive_0016_migration';
    let migrationApplied = false;
    const m = await pool.connect();
    let inTransaction = false;
    try {
      await m.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
      inTransaction = true;
      const ledger = await m.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE',
      );
      if (validateLedger(ledger.rows, expected) !== targetApplied)
        throw Error('Migration ledger changed during review');
      if (!targetApplied) {
        const sql = readFileSync('migrations/' + MIGRATION, 'utf8');
        if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER|REVOKE|GRANT|COPY|EXECUTE)\b/i.test(
          sql.replace(/--[^\n]*/g, ''),
        )) throw Error('Nonadditive statements in migration');
        await m.query(sql);
        await m.query(
          'INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
          [MIGRATION, expected[15].checksum],
        );
        migrationApplied = true;
      }
      await m.query('COMMIT');
      inTransaction = false;
    } finally {
      if (inTransaction) try { await m.query('ROLLBACK'); } catch { /* masked */ }
      m.release();
    }
    phase = 'readonly_postmigration_verification';
    await readonly(pool, async c => {
      const ledger = await c.query<Ledger>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
      );
      if (!validateLedger(ledger.rows, expected)) throw Error('Missing migration after apply');
      const check = await c.query<{ can_insert: boolean; table_name: string | null }>(
        "SELECT has_table_privilege(current_user, 'public.senate_raw_statements', 'INSERT') AS can_insert, " +
        "to_regclass('public.senate_raw_statements')::text AS table_name",
      );
      if (!check.rows[0]?.can_insert || !check.rows[0]?.table_name)
        throw Error('Raw statement table unavailable for inserts');
    });
    phase = 'readonly_before_counts';
    const before = await readback(pool), beforeTotals = totals(before);
    phase = 'polite_raw_caucus_backfill_and_member_archives';
    const store = new SenatePressRawStore(pool);
    const results: SourceCounts[] = [];
    const record = (result: SourceCounts): void => {
      results.push(result);
      console.log('SENATE_RAW_STATEMENTS_SOURCE=' + JSON.stringify({
        source: result.source, from: result.from, to: result.to,
        pages: result.pages, discovered: result.discovered, added: result.inserted,
        alreadyPresent: result.already_present, byYearAdded: result.by_year,
        undated: result.undated, outsideRange: result.outside_range,
        archiveGaps: result.archive_gaps, memberArchiveCount: result.member_archives.length,
        failureCount: result.failures.length,
        failedUrls: result.failures.slice(0, 12).map(f => f.url),
      }));
    };
    for (const source of sources) {
      if(recoverHistoricalMurphy){
        // A first-party 2025 page whose Wayback replay is unavailable.
        // Recover its current publisher-original text without inventing a
        // historical archive capture or a pre-vote observation timestamp.
        const guardedOriginal={
          existing:(urls:string[])=>store.existing(urls),
          insert:async(item:import('../src/sources/minnesota/senate-press-raw.js').RawSenateStatement)=>{
            if(item.source_id!=='senate_dfl'||item.source_url!==murphySourceUrl||
              item.published_on!=='2025-02-06'||item.raw_text.length<100||
              !/Erin Murphy/i.test(item.title))
              throw Error('Murphy original, publication date or full text did not match review');
            return store.insert(item);
          },
        };
        const recovered=await collectDirectArticle(source,murphySourceUrl,
          {from:'2025-02-06',to:'2025-02-06',delayMs:1500},guardedOriginal);
        record({
          source:source.id,source_type:source.source_type,
          from:'2025-02-06',to:'2025-02-06',pages:1,discovered:1,
          matched:recovered.inserted,inserted:recovered.inserted,previewed:0,
          already_present:recovered.already_present,outside_range:0,
          undated:0,by_year:recovered.inserted?{'2025':recovered.inserted}:{},
          member_archives:[],archive_gaps:[],failures:recovered.failures,
        });
        // A successful GitHub job must prove that the exact official article
        // exists as complete RAW text, even if a parallel collector inserted it
        // before this deduplicated one-shot.
        if(recovered.failures.length || recovered.inserted+recovered.already_present!==1)
          throw Error('The exact Murphy original could not be recovered');
        continue;
      }
      const window = { from: START, to: END, maxPages: MAX_PAGES, delayMs: 1500 };
      const result = await collectSource(source, window, store);
      record(result);
      // The publisher currently exposes 2024 at archive page ~100 and 2023
      // farther back. If the normal top-down route hits its intermittent
      // blank 2026-page window, explicit bounded deep ranges recover history.
      const dflPasses: SourceCounts[] = [result];
      if(COVERAGE && source.id==='senate_dfl'){
        for(const [startPage,maxPages] of [[25,110],[100,135]]) {
          const older = await collectSource(source,{...window,startPage,maxPages},store);
          record(older);
          dflPasses.push(older);
        }
      }
      // Extra first-party publication pages, not arbitrary searches or inferred slugs.
      if(COVERAGE||DAILY||GOP_ONLY) {
        if(source.id==='senate_dfl') {
          const linkedAuthors = [...new Set(dflPasses.flatMap(r=>r.member_archives))];
          if(!linkedAuthors.length)
            throw Error('DFL official archives returned no named author archives');
          for(const url of linkedAuthors) {
            const member = { ...source, archive_url:url,
              pagination:{kind:'path' as const,segment:'page'} };
            record(await collectSource(member, {...window,maxPages:DAILY?1:200}, store));
          }
        }
        if(source.id==='senate_republicans') {
          const memberPages = await discoverRepublicanMemberPages(source);
          if(memberPages.length<20||memberPages.length>90)
            throw Error('Unexpected first-party senator directory size');
          for(const member of memberPages)
            record(await collectSource(member, {...window,maxPages:1}, store));
          // Explicitly retry the only known 2023 GOP post missed by the first full run.
          const targeted = await collectDirectArticle(source,GOP_MISSED_URL,
            {from:'2023-01-01',to:END,delayMs:1500},store);
          record({
            source:source.id,source_type:source.source_type,from:'2023-01-01',to:END,
            pages:1,discovered:1,matched:targeted.inserted,inserted:targeted.inserted,
            previewed:0,already_present:targeted.already_present,outside_range:0,
            undated:0,by_year:{},member_archives:[],archive_gaps:[],failures:targeted.failures,
          });
        }
      }
    }
    phase = 'readonly_production_postinsert_counts';
    const after = await readback(pool), afterTotals = totals(after);
    // Multiple official archive paths share the same source_id and URL-only dedupe.
    for (const source of sources) {
      const n = afterTotals[source.id] ?? 0, prior = beforeTotals[source.id] ?? 0;
      const inserted = results.filter(r=>r.source===source.id)
        .reduce((count,r)=>count+r.inserted,0);
      if (n < prior || n - prior !== inserted || n > 200000 || n === 0)
        throw Error('Production raw statement source count inconsistent with inserts');
    }
    let murphyVerified:null|{sourceUrl:string;publishedOn:string;rawTextLength:number;archivedCaptureCount:number}=null;
    if(recoverHistoricalMurphy){
      phase='verify_exact_first_party_murphy_2025_raw_and_provenance';
      murphyVerified=await readonly(pool,async c=>{
        const raw=await c.query<{source_url:string;published_on:string;title:string;raw_text_length:number}>(
          "SELECT source_url,to_char(published_on,'YYYY-MM-DD') AS published_on,title,"+
          "length(raw_text)::integer AS raw_text_length FROM senate_raw_statements "+
          "WHERE source_id='senate_dfl' AND source_url=$1",[murphySourceUrl]);
        const row=raw.rows[0];
        if(raw.rows.length!==1||row.source_url!==murphySourceUrl||
          row.published_on!=='2025-02-06'||row.raw_text_length<100||
          !/Erin Murphy/i.test(row.title))
          throw Error('Exact Murphy 2025 raw statement failed protected readback');
        const captures=await c.query<{total:string}>(
          "SELECT count(*)::text AS total FROM senate_raw_statement_archive_captures WHERE source_url=$1",
          [murphySourceUrl]);
        return {sourceUrl:row.source_url,publishedOn:row.published_on,
          rawTextLength:row.raw_text_length,archivedCaptureCount:Number(captures.rows[0].total)};
      });
      console.log('SENATE_DFL_ERIN_MURPHY_HISTORICAL_RAW_VERIFIED='+JSON.stringify({
        ...murphyVerified,
        originalFirstPartyArticleRecovered:true,
        provenanceOfThisRecovery:'live_first_party_page_fetch',
        doesNotEstablishContemporaneousArchivedObservation:true,
      }));
    }
    const report = {
      status: 'migration_committed_raw_backfill_readback',
      targetedHistoricalMurphy2025:recoverHistoricalMurphy,
      murphyRawVerified:murphyVerified!==null,
      migration: MIGRATION, migrationApplied,
      dateFrom: START, dateTo: END, mode: MODE, dflOnlyRepair: DFL_ONLY,
      before: beforeTotals, after: afterTotals,
      byYearAfter: after,
      sources: sources.map(source=>({
        id:source.id,
        archivePaths:results.filter(r=>r.source===source.id).length,
        pages:results.filter(r=>r.source===source.id).reduce((n,r)=>n+r.pages,0),
        discovered:results.filter(r=>r.source===source.id).reduce((n,r)=>n+r.discovered,0),
        added:results.filter(r=>r.source===source.id).reduce((n,r)=>n+r.inserted,0),
        previouslyStored:results.filter(r=>r.source===source.id).reduce((n,r)=>n+r.already_present,0),
        failures:results.filter(r=>r.source===source.id).reduce((n,r)=>n+r.failures.length,0),
      })),
      forecastsAndModelsUntouched: true,
    };
    console.log('SENATE_RAW_STATEMENTS_PRODUCTION=' + JSON.stringify(report));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      '## Minnesota Senate first-party raw statements\n\n' +
      'Migration ' + MIGRATION + ' applied: ' + String(migrationApplied) + '\n\n' +
      after.map(row => '- ' + row.source_id + ' ' + row.year + ': ' + row.items).join('\n') +
      '\n\nAll counts are raw items. No forecasting tables were touched.\n',
    );
    if(COVERAGE && ['2023','2024','2025'].some(year=>
      !after.some(row=>row.source_id==='senate_dfl' && row.year===year && row.items>0))) {
      phase='dfl_historical_2023_2025_missing_after_insert_only_readback';
      throw Error('DFL historical raw statements still incomplete');
    }
    if (results.some(r => r.failures.length > 0 || r.pages === 0 ||
      (!DAILY && r.pages >= MAX_PAGES))) {
      phase='publisher_archive_gaps_after_safe_partial_insert';
      throw Error('Public source crawl incomplete; safe counts and failures reported');
    }
  } catch {
    console.error('SENATE_RAW_STATEMENTS_PRODUCTION_HELD_AT=' + phase);
    process.exitCode = 1;
  } finally {
    if (pool) try { await pool.end(); } catch { process.exitCode = 1; }
  }
}
void main();

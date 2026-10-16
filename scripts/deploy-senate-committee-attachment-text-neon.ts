/**
 * Guarded raw-only recovery of text from previously indexed Senate attachments.
 * One snapshot per original URL and response fingerprint, shared across hearing/bill
 * associations. NOT an additional hearing-discovery crawl or an evidence validator.
 *
 * Triggered only by the independently checked exact-main push marker, and uses the
 * existing protected Neon API credential/default-primary discovery. Resumes by
 * skipping any URL with a capture, successful OR terminal failure, on normal reruns.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import { senateSqlSafeText } from '../src/sources/minnesota/senate-committee-testimony.js';
import { captureSenateAttachment, type SenateAttachmentCapture } from '../src/sources/minnesota/senate-committee-attachment-text.js';

const REPO = 'killjoy00/votepredict';
const MARKER = 'SENATE_ATTACHMENT_TEXT_BACKFILL_20261015';
const MIGRATION = '0019_senate_committee_attachment_raw_text.sql';
const MAX_BATCHES = 1200;
const BATCH_SIZE = 36;
const WORKERS = 4;
type Ledger = { filename: string; checksum: string };
type Candidate = { source_url: string; session_priority: number; document_priority: number };

function guard(): void {
  const e = process.env;
  if (process.argv.length !== 2 || e.GITHUB_REPOSITORY !== REPO
    || e.GITHUB_EVENT_NAME !== 'push' || e.GITHUB_REF !== 'refs/heads/main'
    || e.GITHUB_RUN_ATTEMPT !== '1' || e.VOTEPREDICT_SENATE_ATTACHMENT_VERIFIED !== 'true'
    || !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA ?? '') || !e.GITHUB_EVENT_PATH)
    throw Error('missing_checked_main_gate');
  const event = JSON.parse(readFileSync(e.GITHUB_EVENT_PATH, 'utf8')) as {
    ref?: string; after?: string; forced?: boolean; deleted?: boolean;
    repository?: { full_name?: string }; head_commit?: { id?: string; message?: string };
  };
  if (event.ref !== 'refs/heads/main' || event.forced === true || event.deleted === true
    || event.repository?.full_name !== REPO || event.after !== e.GITHUB_SHA
    || event.head_commit?.id !== e.GITHUB_SHA || !event.head_commit?.message?.includes(MARKER))
    throw Error('expected_reviewed_merge_marker_absent');
}

function expectedMigrations(): Ledger[] {
  const names = readdirSync('migrations').filter(name => /^\d{4}_[\w-]+\.sql$/.test(name)).sort();
  if (names.length !== 19 || names.at(-1) !== MIGRATION || !names[17]?.startsWith('0018_'))
    throw Error('migration_inventory_changed_during_concurrent_work');
  return names.map(filename => ({
    filename, checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}

function ledgerApplied(rows: Ledger[], expected: Ledger[]): boolean {
  if (![18, 19].includes(rows.length))
    throw Error('requires_0018_election_migration_to_be_applied_first');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].filename !== expected[i]?.filename || rows[i].checksum !== expected[i]?.checksum)
      throw Error('production_migration_ledger_mismatch');
  }
  return rows.length === 19;
}

async function readonly<T>(db: PoolClient, fn: () => Promise<T>): Promise<T> {
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try { return await fn(); }
  finally { await db.query('ROLLBACK'); }
}

async function preflight(db: PoolClient, identity: { database: string; role: string }, expected: Ledger[]): Promise<void> {
  await readonly(db, async () => {
    const response = await db.query<{ database: string; role: string; readonly: string; ledger: string | null; source: string | null }>(
      "SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS readonly,"
      + "to_regclass('public.votepredict_schema_migrations')::text AS ledger,"
      + "to_regclass('public.senate_committee_testimony_raw')::text AS source");
    const row = response.rows[0];
    if (!row || row.database !== identity.database || row.role !== identity.role || row.readonly !== 'on'
      || !row.ledger || !row.source) throw Error('wrong_production_primary_or_raw_source');
    const rows = await db.query<Ledger>('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename');
    ledgerApplied(rows.rows, expected);
    const sessions = await db.query<{ slug: string }>(
      "SELECT s.slug FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id"
      + " WHERE j.slug='us-mn' AND s.slug IN ('2025-2026','2023-2024')");
    if (sessions.rows.length !== 2) throw Error('senate_sessions_missing');
  });
}

async function migrate(db: PoolClient, expected: Ledger[]): Promise<boolean> {
  let active = false;
  try {
    await db.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
    active = true;
    await db.query("SET LOCAL lock_timeout='4s'");
    await db.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-schema-migrations'))");
    const rows = await db.query<Ledger>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE');
    const already = ledgerApplied(rows.rows, expected);
    if (!already) {
      await db.query(readFileSync('migrations/' + MIGRATION, 'utf8'));
      await db.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',
        [MIGRATION, expected[18].checksum]);
    }
    await db.query('COMMIT');
    active = false;
    return !already;
  } finally {
    if (active) await db.query('ROLLBACK').catch(() => undefined);
  }
}

const PENDING = [
  'WITH indexed AS (',
  ' SELECT d.source_url,',
  " MIN(CASE WHEN s.slug='2025-2026' THEN 0 ELSE 1 END)::int AS session_priority,",
  ' MIN(CASE',
  "   WHEN d.bill_id IS NOT NULL AND d.document_kind='written_testimony' THEN 0",
  "   WHEN d.bill_id IS NOT NULL AND d.document_kind IN ('witness_list','agenda') THEN 1",
  "   WHEN d.bill_id IS NOT NULL THEN 2",
  "   WHEN d.document_kind='written_testimony' THEN 3",
  "   WHEN d.document_kind IN ('witness_list','agenda') THEN 4 ELSE 5 END)::int AS document_priority",
  ' FROM senate_committee_testimony_raw d',
  ' JOIN legislative_sessions s ON s.id=d.session_id',
  " JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
  " WHERE d.source_type='document' AND s.slug IN ('2025-2026','2023-2024')",
  ' GROUP BY d.source_url',
  ') SELECT indexed.source_url,indexed.session_priority,indexed.document_priority',
  ' FROM indexed',
  ' WHERE NOT EXISTS (SELECT 1 FROM senate_committee_attachment_text_captures c',
  '                    WHERE c.source_url=indexed.source_url)',
  ' AND NOT EXISTS (SELECT 1 FROM senate_committee_testimony_raw existing',
  "                 WHERE existing.source_type='document' AND existing.source_url=indexed.source_url",
  "                   AND existing.raw_content IS NOT NULL AND length(btrim(existing.raw_content)) > 0)",
].join('\n');

async function nextBatch(db: PoolClient): Promise<Candidate[]> {
  return readonly(db, async () => {
    const response = await db.query<Candidate>(
      PENDING + ' ORDER BY session_priority,document_priority,source_url LIMIT $1', [BATCH_SIZE]);
    return response.rows;
  });
}

async function remaining(db: PoolClient): Promise<number> {
  return readonly(db, async () => {
    const r = await db.query<{ pending: number }>('SELECT count(*)::int AS pending FROM (' + PENDING + ') pending_urls');
    return r.rows[0]?.pending ?? 0;
  });
}

type Report = { session: string; kind: string; document_rows: number; distinct_files: number;
  preexisting_text_rows: number; readable_rows: number; readable_files: number;
  missing_bill_links: number; pending_text_rows: number; failed_files: number; scanned_files: number;
  empty_files: number; unsupported_files: number; unavailable_files: number; extracted_files: number };

async function report(db: PoolClient): Promise<Report[]> {
  return readonly(db, async () => {
    const res = await db.query<Report>([
      'SELECT s.slug AS session,COALESCE(d.document_kind,\'other\') AS kind,',
      'count(*)::int AS document_rows,count(DISTINCT d.source_url)::int AS distinct_files,',
      "count(*) FILTER(WHERE d.raw_content IS NOT NULL AND length(btrim(d.raw_content))>0)::int AS preexisting_text_rows,",
      "count(*) FILTER(WHERE COALESCE(NULLIF(btrim(d.raw_content),''),c.raw_text,original.raw_content) IS NOT NULL)::int AS readable_rows,",
      "count(DISTINCT d.source_url) FILTER(WHERE COALESCE(NULLIF(btrim(d.raw_content),''),c.raw_text,original.raw_content) IS NOT NULL)::int AS readable_files,",
      'count(*) FILTER(WHERE d.bill_id IS NULL)::int AS missing_bill_links,',
      "count(*) FILTER(WHERE COALESCE(NULLIF(btrim(d.raw_content),''),c.raw_text,original.raw_content) IS NULL)::int AS pending_text_rows,",
      "count(DISTINCT d.source_url) FILTER(WHERE c.extraction_status='failed')::int AS failed_files,",
      "count(DISTINCT d.source_url) FILTER(WHERE c.extraction_status='scanned')::int AS scanned_files,",
      "count(DISTINCT d.source_url) FILTER(WHERE c.extraction_status='empty')::int AS empty_files,",
      "count(DISTINCT d.source_url) FILTER(WHERE c.extraction_status='unsupported')::int AS unsupported_files,",
      "count(DISTINCT d.source_url) FILTER(WHERE c.extraction_status='unavailable')::int AS unavailable_files,",
      "count(DISTINCT d.source_url) FILTER(WHERE c.extraction_status='extracted')::int AS extracted_files",
      'FROM senate_committee_testimony_raw d',
      'JOIN legislative_sessions s ON s.id=d.session_id',
      "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
      'LEFT JOIN LATERAL (',
      ' SELECT extraction_status,raw_text FROM senate_committee_attachment_text_captures',
      ' WHERE source_url=d.source_url ORDER BY (extraction_status=\'extracted\') DESC,fetched_at DESC,id DESC LIMIT 1',
      ") c ON TRUE",
      'LEFT JOIN LATERAL (',
      ' SELECT raw_content FROM senate_committee_testimony_raw pre',
      " WHERE pre.source_type='document' AND pre.source_url=d.source_url",
      "   AND pre.raw_content IS NOT NULL AND length(btrim(pre.raw_content))>0",
      ' LIMIT 1',
      ") original ON c.raw_text IS NULL",
      "WHERE d.source_type='document' AND s.slug IN ('2025-2026','2023-2024')",
      'GROUP BY s.slug,d.document_kind ORDER BY s.slug DESC,d.document_kind',
    ].join('\n'));
    return res.rows;
  });
}

const UPSERT = [
  'INSERT INTO senate_committee_attachment_text_captures',
  '(source_url,final_url,snapshot_key,fetched_at,last_checked_at,response_status,source_content_type,',
  'byte_size,content_sha256,extraction_status,extraction_method,raw_text,publication_date,original_file_ref,failure_kind)',
  'VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
  'ON CONFLICT (source_url,snapshot_key) DO UPDATE SET',
  'last_checked_at=EXCLUDED.last_checked_at,',
  'attempt_count=senate_committee_attachment_text_captures.attempt_count+1,',
  'raw_text=COALESCE(senate_committee_attachment_text_captures.raw_text,EXCLUDED.raw_text),',
  "extraction_status=CASE WHEN senate_committee_attachment_text_captures.extraction_status='extracted'",
  'THEN senate_committee_attachment_text_captures.extraction_status ELSE EXCLUDED.extraction_status END,',
  "extraction_method=CASE WHEN senate_committee_attachment_text_captures.extraction_status='extracted'",
  'THEN senate_committee_attachment_text_captures.extraction_method ELSE EXCLUDED.extraction_method END',
].join(' ');

async function persistBatch(db: PoolClient, captures: SenateAttachmentCapture[]): Promise<void> {
  let active = false;
  try {
    await db.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE');
    active = true;
    await db.query("SET LOCAL lock_timeout='4s'");
    for (const c of captures) {
      await db.query(UPSERT, [
        c.sourceUrl, c.finalUrl, c.snapshotKey, c.fetchedAt, c.responseStatus,
        c.sourceContentType, c.byteSize, c.contentSha256, c.extractionStatus,
        c.extractionMethod, senateSqlSafeText(c.rawText), c.publicationDate,
        c.originalFileRef, c.failureKind,
      ]);
    }
    await db.query('COMMIT');
    active = false;
  } finally {
    if (active) await db.query('ROLLBACK').catch(() => undefined);
  }
}

async function fetchBatch(candidates: Candidate[]): Promise<SenateAttachmentCapture[]> {
  const result: SenateAttachmentCapture[] = [];
  for (let offset = 0; offset < candidates.length; offset += WORKERS) {
    const segment = await Promise.all(candidates.slice(offset, offset + WORKERS)
      .map(candidate => captureSenateAttachment(candidate.source_url)));
    result.push(...segment);
    await sleep(250);
  }
  return result;
}

async function main(): Promise<void> {
  let phase = 'checked_main';
  let pool: Pool | null = null;
  try {
    guard();
    const expected = expectedMigrations();
    phase = 'protected_existing_primary';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY?.trim() ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
      requirePrimary: true,
    });
    pool = new Pool({
      host: target.host,port: target.port,user: target.role,password: target.password,
      database: target.database,ssl:{ rejectUnauthorized:true },max:1,
      connectionTimeoutMillis:15000,statement_timeout:110000,query_timeout:115000,
      application_name:'votepredict-senate-attachment-raw-text',
      options:'-c statement_timeout=110000 -c lock_timeout=4000',
    });
    const client = await pool.connect();
    try {
      phase = 'readonly_existing_ledger_and_schema';
      await preflight(client,target,expected);
      phase = 'additive_migration_0019';
      const migrationApplied = await migrate(client,expected);
      phase = 'initial_production_inventory';
      const before = await report(client);
      const originalPending = await remaining(client);
      console.log('SENATE_ATTACHMENT_INITIAL=' + JSON.stringify({
        pendingDistinctUrls:originalPending,bySessionAndDocumentKind:before,
      }));
      phase = 'bounded_resume_existing_attachment_urls';
      let processed = 0;
      let extracted = 0;
      let failures = 0;
      let sampleShown = false;
      for (let batchNumber = 0; batchNumber < MAX_BATCHES; batchNumber++) {
        const batch = await nextBatch(client);
        if (!batch.length) break;
        const captures = await fetchBatch(batch);
        if (!sampleShown) {
          const sample = captures.slice(0,8);
          console.log('SENATE_ATTACHMENT_REAL_SOURCE_SAMPLE=' + JSON.stringify({
            count:sample.length,statuses:sample.map(x=>x.extractionStatus),
            methods:sample.map(x=>x.extractionMethod),
            types:sample.map(x=>(x.sourceContentType ?? 'missing').split(';')[0]),
          }));
          sampleShown = true;
        }
        phase = 'idempotent_capture_batch_' + String(batchNumber);
        await persistBatch(client,captures);
        processed += captures.length;
        extracted += captures.filter(c=>c.extractionStatus==='extracted').length;
        failures += captures.filter(c=>c.extractionStatus==='failed' || c.extractionStatus==='unavailable').length;
        if ((batchNumber+1)%20===0)
          console.log('SENATE_ATTACHMENT_BATCH_PROGRESS='+JSON.stringify({processed,extracted,failedOrUnavailable:failures}));
        phase = 'bounded_resume_existing_attachment_urls';
      }
      phase = 'readonly_final_capture_counts';
      const pending = await remaining(client);
      const after = await report(client);
      const totalSnapshots = await readonly(client, async () => {
        const r = await client.query<{ captures: number; distinct_urls: number; extracted_files: number }>(
          "SELECT count(*)::int AS captures,count(DISTINCT source_url)::int AS distinct_urls,"
          + "count(DISTINCT source_url) FILTER(WHERE extraction_status='extracted')::int AS extracted_files"
          + ' FROM senate_committee_attachment_text_captures');
        return r.rows[0];
      });
      const output = {
        status:pending===0?'all_indexed_urls_attempted_and_readback_verified':'bounded_partial_resume_required',
        migrationApplied,originalPendingDistinctUrls:originalPending,
        attemptedThisRun:processed,extractedThisRun:extracted,failedOrUnavailableThisRun:failures,
        remainingUnattemptedDistinctUrls:pending,snapshots:totalSnapshots,
        bySessionAndDocumentKind:after,noForecastOrModelWrites:true,
      };
      console.log('SENATE_ATTACHMENT_TEXT_PRODUCTION=' + JSON.stringify(output));
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          'Raw Senate attachment text backfill (document rows are not distinct files)\n'
          + JSON.stringify(output,null,2) + '\n');
      if (pending !== 0) process.exitCode = 1;
    } finally { client.release(true); }
  } catch (error) {
    const code = typeof (error as { code?: unknown })?.code === 'string'
      && /^[A-Z0-9]{5}$/.test((error as { code: string }).code)
      ? (error as { code: string }).code : 'none';
    console.error('SENATE_ATTACHMENT_BACKFILL_HELD=' + JSON.stringify({phase,sqlState:code}));
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end().catch(() => { process.exitCode = 1; });
  }
}
void main();

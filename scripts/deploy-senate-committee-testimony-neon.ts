/**
 * Guarded one-shot default-branch Neon raw Senate committee testimony deploy.
 * The exact reviewed main commit and keyless CI are mandatory. Only the
 * additive migration/ledger and new raw-only table may be written.
 * Never log credentials, database identifiers or raw source content.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';
import {
  collectSenateCommitteeTestimony, normalizedBill, postgresSafeText,
  type RawSenateTestimonyRecord, type RawSenateTestimonySummary,
} from '../src/sources/minnesota/senate-committee-testimony.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

const MIGRATION = '0017_senate_committee_testimony_raw.sql';
const MARKER = 'SENATE_COMMITTEE_TESTIMONY_DEPLOY_20261015';
const SESSIONS = ['2025-2026', '2023-2024'] as const;
type LedgerRow = { filename: string; checksum: string };
type Kind = RawSenateTestimonyRecord['sourceType'];
type Collection = {
  session: string; from: string; to: string;
  summary: RawSenateTestimonySummary; records: RawSenateTestimonyRecord[];
};

function assertReviewedMain(): void {
  const e = process.env;
  if (process.argv.length !== 2 || e.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || e.GITHUB_EVENT_NAME !== 'push' || e.GITHUB_REF !== 'refs/heads/main'
    || e.GITHUB_RUN_ATTEMPT !== '1' || e.VOTEPREDICT_SENATE_TESTIMONY_VERIFIED !== 'true'
    || !/^[a-f0-9]{40}$/.test(e.GITHUB_SHA ?? '') || !e.GITHUB_EVENT_PATH)
    throw Error('Reviewed main commit authorization missing');
  const event = JSON.parse(readFileSync(e.GITHUB_EVENT_PATH, 'utf8')) as {
    ref?: string; after?: string; forced?: boolean; deleted?: boolean;
    repository?: { full_name?: string }; head_commit?: { id?: string; message?: string };
  };
  if (event.ref !== 'refs/heads/main' || event.forced === true || event.deleted === true
    || event.repository?.full_name !== e.GITHUB_REPOSITORY
    || event.after !== e.GITHUB_SHA || event.head_commit?.id !== e.GITHUB_SHA
    || !event.head_commit?.message?.includes(MARKER))
    throw Error('Expected reviewed main merge marker absent');
}

function migrations(): LedgerRow[] {
  const names = readdirSync('migrations').filter(s => /^\d{4}_[\w-]+\.sql$/.test(s)).sort();
  if (names.length !== 17 || names.at(-1) !== MIGRATION)
    throw Error('Unexpected reviewed migration inventory');
  return names.map(filename => ({
    filename, checksum: createHash('sha256').update(readFileSync('migrations/' + filename)).digest('hex'),
  }));
}

function assertLedger(actual: LedgerRow[], expected: LedgerRow[]): boolean {
  if (![16, 17].includes(actual.length))
    throw Error('Existing schema ledger is incomplete or unexpected');
  for (const [index, row] of actual.entries())
    if (row.filename !== expected[index]?.filename || row.checksum !== expected[index].checksum)
      throw Error('Existing schema ledger checksum mismatch');
  return actual.length === 17;
}

function byKind(rows: readonly RawSenateTestimonyRecord[]): Record<Kind, number> {
  const totals = { hearing: 0, witness: 0, document: 0 };
  for (const row of rows) totals[row.sourceType]++;
  return totals;
}

function validateRow(row: RawSenateTestimonyRecord, session: string, from: string, to: string): void {
  if (row.session !== session || row.hearingDate < from || row.hearingDate > to
    || !/^[a-f0-9]{64}$/.test(row.recordKey)
    || !Number.isInteger(row.hearingId) || row.hearingId < 1
    || !['hearing', 'document', 'witness'].includes(row.sourceType)
    || !/^https:\/\/(?:www\.senate\.mn|assets\.senate\.mn)\//.test(row.sourceUrl)
    || (row.rawContent === null && row.rawContentUrl === null)
    || (row.rawContent !== null && row.rawContent.length > 12_500_000)
    || (row.rawContentUrl !== null && !/^https:\/\/(?:www\.senate\.mn|assets\.senate\.mn)\//.test(row.rawContentUrl))
    || (row.billIdentifier !== null && normalizedBill(row.billIdentifier) !== row.billIdentifier)
    || (row.statedPosition !== null && !['for', 'against', 'neutral'].includes(row.statedPosition)))
    throw Error('Out-of-scope or malformed raw Senate source');
}

async function collectSources(): Promise<Collection[]> {
  const result: Collection[] = [];
  for (const slug of SESSIONS) {
    const session = getMinnesotaHouseSession(slug);
    const from = session.startsOn;
    const today = new Date().toISOString().slice(0, 10);
    const to = today < session.endsOn ? today : session.endsOn;
    const unique = new Map<string, RawSenateTestimonyRecord>();
    const summary = await collectSenateCommitteeTestimony({
      session, from, to, delayMs: 250, parsePdfLists: true,
      onRecord: async row => {
        validateRow(row, slug, from, to);
        unique.set(row.recordKey, row);
        if (unique.size > 55_000) throw Error('Raw Senate source row cap exceeded');
      },
    });
    const minHearings = slug === '2025-2026' ? 900 : 1200;
    const minDocuments = slug === '2025-2026' ? 11_000 : 12_000;
    const counts = byKind([...unique.values()]);
    if (summary.hearings < minHearings || summary.documents < minDocuments
      || counts.hearing < minHearings || counts.document < minDocuments
      || summary.hearings > 3000 || summary.documents > 25_000)
      throw Error('Unexpectedly small or large official Senate schedule inventory');
    console.log('SENATE_TESTIMONY_PUBLIC_CAPTURE=' + JSON.stringify({
      session: slug, hearings: summary.hearings, witnesses: summary.witnesses,
      documents: summary.documents, PDFsRead: summary.witnessListsParsed,
      failedPDFOrScheduleURLs: summary.failedUrls.length, uniqueRows: unique.size,
    }));
    result.push({ session: slug, from, to, summary, records: [...unique.values()] });
  }
  return result;
}

async function readOnly<T>(client: PoolClient, task: () => Promise<T>): Promise<T> {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try { return await task(); }
  finally { await client.query('ROLLBACK'); }
}

async function preflight(client: PoolClient, target: { database: string; role: string }, expected: LedgerRow[]): Promise<void> {
  await readOnly(client, async () => {
    const result = await client.query<{
      db: string; role: string; ro: string; ledger: string | null; sessions: string | null;
      bills: string | null; can_create: boolean; can_write_ledger: boolean;
    }>(
      "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,"
      + "to_regclass('public.votepredict_schema_migrations')::text AS ledger,"
      + "to_regclass('public.legislative_sessions')::text AS sessions,"
      + "to_regclass('public.bills')::text AS bills,"
      + "has_schema_privilege(current_user,'public','CREATE') AS can_create,"
      + "has_table_privilege(current_user,'public.votepredict_schema_migrations','INSERT') AS can_write_ledger",
    );
    const i = result.rows[0];
    if (!i || i.db !== target.database || i.role !== target.role || i.ro !== 'on'
      || !i.ledger || !i.sessions || !i.bills || !i.can_create || !i.can_write_ledger)
      throw Error('Existing protected Neon primary or schema preflight failed');
    const actual = await client.query<LedgerRow>(
      'SELECT filename, checksum FROM votepredict_schema_migrations ORDER BY filename',
    );
    assertLedger(actual.rows, expected);
    const sessions = await client.query<{ slug: string }>(
      "SELECT s.slug FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id"
      + " WHERE j.slug='us-mn' AND s.slug=ANY($1::text[])", [SESSIONS],
    );
    if (sessions.rows.length !== 2) throw Error('Existing Minnesota sessions missing');
  });
}

async function applyMigration(client: PoolClient, expected: LedgerRow[]): Promise<boolean> {
  let active = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
    active = true;
    await client.query("SET LOCAL lock_timeout='4s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('votepredict-senate-testimony-0016'))");
    const actual = await client.query<LedgerRow>(
      'SELECT filename, checksum FROM votepredict_schema_migrations ORDER BY filename FOR UPDATE',
    );
    const already = assertLedger(actual.rows, expected);
    if (!already) {
      await client.query(readFileSync('migrations/' + MIGRATION, 'utf8'));
      await client.query('INSERT INTO votepredict_schema_migrations (filename,checksum) VALUES ($1,$2)',
        [MIGRATION, expected[16].checksum]);
    }
    await client.query('COMMIT');
    active = false;
    return !already;
  } finally {
    if (active) try { await client.query('ROLLBACK'); } catch { /* fail closed */ }
  }
}

async function confirmMigration(client: PoolClient, expected: LedgerRow[]): Promise<void> {
  await readOnly(client, async () => {
    const table = await client.query<{ name: string | null; allowed: boolean }>(
      "SELECT to_regclass('public.senate_committee_testimony_raw')::text AS name,"
      + "has_table_privilege(current_user,'public.senate_committee_testimony_raw','SELECT,INSERT,UPDATE') AS allowed",
    );
    if (!table.rows[0]?.name || !table.rows[0].allowed) throw Error('Raw testimony table unavailable');
    const ledger = await client.query<LedgerRow>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
    );
    if (!assertLedger(ledger.rows, expected)) throw Error('Migration ledger not updated');
  });
}

const UPSERT_SQL = [
  'INSERT INTO senate_committee_testimony_raw',
  '(session_id,hearing_id,record_key,source_type,source_url,fetched_at,hearing_date,source_content_type,',
  'raw_content,raw_content_url,committee,bill_identifier,bill_id,witness_name,organization,',
  'stated_position,document_name,document_kind)',
  'SELECT $1::uuid,r.hearing_id,r.record_key,r.source_type,r.source_url,r.fetched_at,r.hearing_date,',
  'r.source_content_type,r.raw_content,r.raw_content_url,r.committee,r.bill_identifier,r.bill_id,',
  'r.witness_name,r.organization,r.stated_position,r.document_name,r.document_kind',
  'FROM jsonb_to_recordset($2::jsonb) AS r(hearing_id integer,record_key text,source_type text,',
  'source_url text,fetched_at timestamptz,hearing_date date,source_content_type text,',
  'raw_content text,raw_content_url text,committee text,bill_identifier text,bill_id uuid,',
  'witness_name text,organization text,stated_position text,document_name text,document_kind text)',
  'WHERE true',
  'ON CONFLICT (session_id,record_key) DO UPDATE SET fetched_at=EXCLUDED.fetched_at,',
  'raw_content=COALESCE(EXCLUDED.raw_content,senate_committee_testimony_raw.raw_content),',
  'raw_content_url=COALESCE(EXCLUDED.raw_content_url,senate_committee_testimony_raw.raw_content_url),',
  'bill_id=COALESCE(EXCLUDED.bill_id,senate_committee_testimony_raw.bill_id)',
].join(' ');

type Readback = { source_type: Kind; stored: number; with_bill_id: number; with_position: number };
async function upsertSession(client: PoolClient, batch: Collection): Promise<{
  distinctByType: Record<Kind, number>; readback: Readback[];
}> {
  const session = await readOnly(client, async () => client.query<{ id: string }>(
    "SELECT s.id FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id"
    + " WHERE j.slug='us-mn' AND s.slug=$1", [batch.session],
  ));
  if (session.rows.length !== 1) throw Error('Session disappeared after protected preflight');
  const sessionId = session.rows[0].id;
  const existingBills = await readOnly(client, async () => client.query<{ id: string; identifier: string }>(
    'SELECT id,identifier FROM bills WHERE session_id=$1', [sessionId],
  ));
  const billIds = new Map<string, string>();
  for (const bill of existingBills.rows) {
    const identifier = normalizedBill(bill.identifier);
    if (identifier) billIds.set(identifier, bill.id);
  }
  for (let offset = 0; offset < batch.records.length; offset += 180) {
    const records = batch.records.slice(offset, offset + 180);
    const rows = records.map(row => ({
      hearing_id: row.hearingId, record_key: row.recordKey, source_type: row.sourceType,
      source_url: postgresSafeText(row.sourceUrl), fetched_at: row.fetchedAt, hearing_date: row.hearingDate,
      source_content_type: row.sourceContentType, raw_content: postgresSafeText(row.rawContent),
      raw_content_url: postgresSafeText(row.rawContentUrl), committee: postgresSafeText(row.committee),
      bill_identifier: row.billIdentifier,
      bill_id: row.billIdentifier ? billIds.get(row.billIdentifier) ?? null : null,
      witness_name: postgresSafeText(row.witnessName), organization: postgresSafeText(row.organization),
      stated_position: row.statedPosition, document_name: postgresSafeText(row.documentName),
      document_kind: row.documentKind,
    }));
    let active = false;
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ WRITE');
      active = true;
      await client.query("SET LOCAL lock_timeout='4s'");
      await client.query(UPSERT_SQL, [sessionId, JSON.stringify(rows)]);
      await client.query('COMMIT');
      active = false;
    } finally {
      if (active) try { await client.query('ROLLBACK'); } catch { /* fail closed */ }
    }
    const processed = offset + records.length;
    if (processed % 3600 < 180) console.log('SENATE_TESTIMONY_COMMITTED=' + JSON.stringify({
      session: batch.session, processed, planned: batch.records.length,
    }));
  }
  const distinctByType = byKind(batch.records);
  const actual = await readOnly(client, async () => client.query<Readback>(
    'SELECT source_type,count(*)::int AS stored,count(bill_id)::int AS with_bill_id,'
    + 'count(stated_position)::int AS with_position FROM senate_committee_testimony_raw'
    + ' WHERE session_id=$1 AND hearing_date BETWEEN $2::date AND $3::date'
    + ' GROUP BY source_type ORDER BY source_type',
    [sessionId, batch.from, batch.to],
  ));
  const totals = new Map(actual.rows.map(row => [row.source_type, row.stored]));
  for (const type of ['hearing', 'witness', 'document'] as Kind[]) {
    if ((totals.get(type) ?? 0) < distinctByType[type])
      throw Error('Production readback is missing raw testimony rows');
  }
  return { distinctByType, readback: actual.rows };
}

async function main(): Promise<void> {
  let phase = 'reviewed_main_gate';
  let pool: Pool | undefined;
  try {
    assertReviewedMain();
    const expected = migrations();
    phase = 'collect_official_public_senate_sources';
    const collections = await collectSources();
    phase = 'discover_existing_neon_default_branch_primary';
    const target = await discoverExistingVotePredictNeonConnection({
      apiKey: process.env.NEON_API_KEY?.trim() ?? '',
      projectId: process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim() ?? '',
      preferredDatabase: process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
      requirePrimary: true,
    });
    pool = new Pool({
      host: target.host, port: target.port, user: target.role, password: target.password,
      database: target.database, ssl: { rejectUnauthorized: true }, max: 1,
      connectionTimeoutMillis: 15000, statement_timeout: 110000, query_timeout: 115000,
      application_name: 'votepredict-senate-testimony-raw-production',
      options: '-c statement_timeout=110000 -c lock_timeout=4000',
    });
    const client = await pool.connect();
    try {
      phase = 'readonly_production_ledger_and_identity';
      await preflight(client, target, expected);
      phase = 'additive_migration_0016';
      const migrationApplied = await applyMigration(client, expected);
      phase = 'verify_raw_only_table_and_ledger';
      await confirmMigration(client, expected);
      const sessions = [];
      for (const batch of collections) {
        phase = 'idempotent_raw_backfill_' + batch.session.replace('-', '_');
        const loaded = await upsertSession(client, batch);
        sessions.push({
          session: batch.session, sourceHearings: batch.summary.hearings,
          sourceWitnesses: batch.summary.witnesses, sourceDocuments: batch.summary.documents,
          pdfListsExtracted: batch.summary.witnessListsParsed, sourceGaps: batch.summary.failedUrls.length,
          uniqueRowsWritten: batch.records.length, distinctByType: loaded.distinctByType,
          databaseReadback: loaded.readback,
        });
      }
      phase = 'production_readback_complete';
      const output = { status: 'committed_and_readback_verified', migrationApplied,
        existingVotePredictDefaultBranch: true, sessions, noForecastOrModelWrites: true };
      console.log('SENATE_RAW_TESTIMONY_PRODUCTION=' + JSON.stringify(output));
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, 'Raw Senate testimony deployment summary\n'
          + JSON.stringify(output, null, 2) + '\n');
    } finally { client.release(true); }
  } catch {
    console.error('SENATE_RAW_TESTIMONY_PRODUCTION_HELD_AT=' + phase);
    process.exitCode = 1;
  } finally {
    if (pool) try { await pool.end(); } catch { process.exitCode = 1; }
  }
}
void main();

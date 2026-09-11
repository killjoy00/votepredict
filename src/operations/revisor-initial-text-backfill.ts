import { pool } from '@/lib/db';
import { fetchRevisorBillVersion, type RevisorBillVersionMetadata } from '@/sources/minnesota/revisor';

export const INITIAL_TEXT_BACKFILL_MAX_BATCH = 100;
const FETCH_CONCURRENCY = 4;
const FETCH_ATTEMPTS = 3;

export type InitialTextBackfillRow = {
  version_id: string;
  identifier: string;
  version_key: string;
  published_on: string;
  text_url: string;
};

type FetchedRow = InitialTextBackfillRow & {
  text: string;
  textHash: string;
  finalUrl: string;
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(row: InitialTextBackfillRow): Promise<FetchedRow> {
  let lastError: unknown;
  const version: RevisorBillVersionMetadata = {
    versionKey: row.version_key,
    ordinal: 0,
    postedOn: row.published_on,
    textUrl: row.text_url,
  };
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    try {
      const fetched = await fetchRevisorBillVersion(version);
      return { ...row, text: fetched.text, textHash: fetched.textSha256, finalUrl: fetched.textUrl };
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS - 1) await sleep(Math.min(5_000, 750 * (2 ** attempt)));
    }
  }
  throw lastError instanceof Error ? new Error(`${row.identifier}: ${lastError.message}`) : new Error(`${row.identifier}: initial text fetch failed`);
}

async function selectBatch(limit: number): Promise<InitialTextBackfillRow[]> {
  const result = await pool.query<InitialTextBackfillRow>(`
    SELECT bv.id::text AS version_id,
           b.identifier,
           bv.version_key,
           bv.published_at::date::text AS published_on,
           bv.text_url
      FROM bills b
      JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.metadata ? 'revisorUniverse'
       AND b.metadata #>> '{revisorIntroduction,parserVersion}' = 'revisor-introduction-v1'
       AND bv.text_url IS NOT NULL
       AND (bv.raw_text IS NULL OR length(trim(bv.raw_text)) = 0 OR bv.text_hash IS NULL)
     ORDER BY b.session_id, b.originating_chamber_id, substring(b.identifier from '[0-9]+$')::integer, b.identifier
     LIMIT $1`, [limit]);
  return result.rows;
}

async function fetchBatch(rows: readonly InitialTextBackfillRow[]): Promise<FetchedRow[]> {
  const fetched: FetchedRow[] = [];
  for (let offset = 0; offset < rows.length; offset += FETCH_CONCURRENCY) {
    fetched.push(...await Promise.all(rows.slice(offset, offset + FETCH_CONCURRENCY).map(fetchWithRetry)));
  }
  return fetched;
}

async function persistBatch(rows: readonly FetchedRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const payload = rows.map((row) => ({ version_id: row.version_id, text_hash: row.textHash, raw_text: row.text, text_url: row.finalUrl }));
  const result = await pool.query(`
    WITH payload AS (
      SELECT version_id, text_hash, raw_text, text_url
        FROM jsonb_to_recordset($1::jsonb) AS x(version_id uuid, text_hash text, raw_text text, text_url text)
    )
    UPDATE bill_versions bv
       SET text_hash = p.text_hash,
           raw_text = p.raw_text,
           text_url = p.text_url,
           source_url = p.text_url
      FROM payload p
     WHERE bv.id = p.version_id
       AND (bv.raw_text IS NULL OR length(trim(bv.raw_text)) = 0 OR bv.text_hash IS NULL)
    RETURNING bv.id`, [JSON.stringify(payload)]);
  return result.rowCount ?? 0;
}

export async function backfillRevisorInitialTextBatch(limit = INITIAL_TEXT_BACKFILL_MAX_BATCH) {
  if (!Number.isInteger(limit) || limit < 1 || limit > INITIAL_TEXT_BACKFILL_MAX_BATCH) {
    throw new Error(`Initial text backfill limit must be between 1 and ${INITIAL_TEXT_BACKFILL_MAX_BATCH}`);
  }
  const selected = await selectBatch(limit);
  if (selected.length === 0) return { processed: 0, done: true };
  const fetched = await fetchBatch(selected);
  const processed = await persistBatch(fetched);
  if (processed !== selected.length) throw new Error(`Initial text persistence mismatch: selected ${selected.length}, updated ${processed}`);
  return { processed, done: false };
}

export async function verifyRevisorInitialTextBackfill() {
  const result = await pool.query<{
    universe_total: string;
    initial_versions: string;
    initial_versions_with_text: string;
    initial_versions_with_hash: string;
    model_eligible_with_text: string;
  }>(`
    SELECT count(*)::text AS universe_total,
           count(bv.id)::text AS initial_versions,
           count(*) FILTER (WHERE bv.raw_text IS NOT NULL AND length(trim(bv.raw_text)) > 0)::text AS initial_versions_with_text,
           count(*) FILTER (WHERE bv.text_hash IS NOT NULL)::text AS initial_versions_with_hash,
           count(*) FILTER (
             WHERE b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' = 'true'
               AND bv.raw_text IS NOT NULL
               AND length(trim(bv.raw_text)) > 0
               AND bv.text_hash IS NOT NULL
           )::text AS model_eligible_with_text
      FROM bills b
      LEFT JOIN bill_versions bv
        ON bv.bill_id = b.id
       AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
     WHERE b.metadata ? 'revisorUniverse'`);
  const row = result.rows[0];
  const verification = {
    universeTotal: Number(row.universe_total),
    initialVersions: Number(row.initial_versions),
    initialVersionsWithText: Number(row.initial_versions_with_text),
    initialVersionsWithHash: Number(row.initial_versions_with_hash),
    modelEligibleWithText: Number(row.model_eligible_with_text),
  };
  return {
    ...verification,
    complete: verification.universeTotal === 31_010
      && verification.initialVersions === 31_010
      && verification.initialVersionsWithText === 31_010
      && verification.initialVersionsWithHash === 31_010
      && verification.modelEligibleWithText === 31_009,
  };
}

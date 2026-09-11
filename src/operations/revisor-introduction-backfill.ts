import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import { fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';
import {
  buildRevisorRegularSessionStatusHtmlUrls,
  fetchRevisorIntroductionStatusHtml,
  parseRevisorIntroductionStatusHtml,
} from '@/sources/minnesota/revisor-introduction-html';
import {
  buildRevisorRegularSessionStatusXmlUrls,
  parseRevisorIntroductionMetadata,
  type RevisorIntroductionMetadata,
} from '@/sources/minnesota/revisor-introduction';

export type IntroductionBackfillChamber = 'house' | 'senate';

export const INTRODUCTION_BACKFILL_PARSER_VERSION = 'revisor-introduction-v1';
export const INTRODUCTION_BACKFILL_MAX_BATCH = 100;
const FETCH_CONCURRENCY = 2;

const EXPECTED_REGULAR_BILLS: Record<string, Record<IntroductionBackfillChamber, number>> = {
  '2021-2022': { house: 4_905, senate: 4_610 },
  '2023-2024': { house: 5_488, senate: 5_535 },
  '2025-2026': { house: 5_162, senate: 5_310 },
};

export const INTRODUCTION_BACKFILL_SCOPES = Object.entries(EXPECTED_REGULAR_BILLS).flatMap(([session, chambers]) =>
  (['house', 'senate'] as const).map((chamber) => ({ session, chamber, expectedBills: chambers[chamber] })),
);

export type IntroductionBackfillBillRow = {
  bill_id: string;
  session_id: string;
  chamber_id: string;
  identifier: string;
  bill_number: number;
  existing_introduced_at: string | null;
};

type BillRow = IntroductionBackfillBillRow;

type IntroductionSourceFormat = 'xml' | 'html';

type FetchedIntroduction = BillRow & {
  sourceUrl: string;
  sourceSha256: string;
  sourceFormat: IntroductionSourceFormat;
  sourceName: string;
  fetchedAt: string;
  sourceYear: number;
  fallbackReason: string | null;
  metadata: RevisorIntroductionMetadata;
};

export interface IntroductionBackfillBatchResult {
  session: string;
  chamber: IntroductionBackfillChamber;
  requestedAfterBillNumber: number;
  processed: number;
  nextAfterBillNumber: number;
  done: boolean;
  introductionDates: number;
  initialDocuments: number;
  existingDatesPreserved: number;
  sourceDocumentsRecorded: number;
  initialVersionsRecorded: number;
}

export interface IntroductionBackfillVerificationScope {
  session: string;
  chamber: IntroductionBackfillChamber;
  expectedBills: number;
  universeBills: number;
  parserMetadata: number;
  introductionDates: number;
  eligibleInitialDocuments: number;
  initialVersions: number;
  complete: boolean;
}

function apiYear(url: string): number {
  const match = url.match(/\/bills\/v1\/\d+\/(20\d{2})\//);
  if (!match) throw new Error('Could not determine Revisor API year from canonical status URL');
  return Number(match[1]);
}

function statusHtmlYear(url: string): number {
  const match = url.match(/\/bills\/\d+\/(20\d{2})\//);
  if (!match) throw new Error('Could not determine Revisor HTML year from canonical status URL');
  return Number(match[1]);
}

function existingDate(value: string | null): string | null {
  return value?.match(/^(20\d{2}-\d{2}-\d{2})/)?.[1] ?? null;
}

function requireCompleteIntroduction(metadata: RevisorIntroductionMetadata, identifier: string, resolvedSourceYear: number): void {
  if (!metadata.introducedOn) throw new Error(`${identifier}: source-chamber introduction date missing`);
  if (!metadata.introducedOn.startsWith(`${resolvedSourceYear}-`)) {
    throw new Error(`${identifier}: introduction year ${metadata.introducedOn.slice(0, 4)} does not match resolved source year ${resolvedSourceYear}`);
  }
  if (!metadata.initialDocument || !metadata.initialDocument.documentName || !metadata.initialDocument.insertedOn || !metadata.initialDocument.htmlUrl) {
    throw new Error(`${identifier}: zero-engrossment initial official document metadata incomplete`);
  }
  if (!metadata.initialDocumentKnownByIntroduction) {
    throw new Error(`${identifier}: initial official document was not demonstrably available by introduction`);
  }
}

function verifyExistingIntroductionDate(row: BillRow, metadata: RevisorIntroductionMetadata): void {
  const currentDate = existingDate(row.existing_introduced_at);
  if (currentDate && currentDate !== metadata.introducedOn) {
    throw new Error(`${row.identifier}: existing introduction date ${currentDate} conflicts with Revisor ${metadata.introducedOn}`);
  }
}

export async function fetchRevisorIntroductionForBackfill(row: BillRow, session: string): Promise<FetchedIntroduction> {
  let lastFetchError: unknown = new Error(`${row.identifier}: no Revisor API candidates`);
  for (const statusXmlUrl of buildRevisorRegularSessionStatusXmlUrls(session, row.identifier)) {
    let xml: string;
    try {
      xml = await fetchRevisorStatusXml(statusXmlUrl);
    } catch (error) {
      lastFetchError = error;
      continue;
    }

    // A Revisor API endpoint for the other calendar year in the same biennium can
    // return a syntactically valid bill record that predates this bill's introduction.
    // Identity mismatches remain hard failures, but semantically incomplete timing
    // metadata means "try the alternate official year", not "abort the bill".
    const metadata = parseRevisorIntroductionMetadata({ xml, identifier: row.identifier });
    const resolvedApiYear = apiYear(statusXmlUrl);
    try {
      requireCompleteIntroduction(metadata, row.identifier, resolvedApiYear);
    } catch (error) {
      lastFetchError = error;
      continue;
    }
    verifyExistingIntroductionDate(row, metadata);
    return {
      ...row,
      sourceUrl: statusXmlUrl,
      sourceSha256: createHash('sha256').update(xml).digest('hex'),
      sourceFormat: 'xml',
      sourceName: 'Minnesota Revisor Bill Status API v1',
      fetchedAt: new Date().toISOString(),
      sourceYear: resolvedApiYear,
      fallbackReason: null,
      metadata,
    };
  }

  // The Revisor Bill Status API has rare historical records that persistently return 5xx
  // even though the corresponding official status HTML remains available. Use that official
  // page only after both biennium-year API candidates fail, and require the HTML itself to
  // prove bill identity, introduction date, and zero-engrossment introduction-document date.
  for (const statusHtmlUrl of buildRevisorRegularSessionStatusHtmlUrls(session, row.identifier)) {
    let html: string;
    try {
      html = await fetchRevisorIntroductionStatusHtml(statusHtmlUrl);
    } catch (error) {
      lastFetchError = error;
      continue;
    }

    const resolvedStatusYear = statusHtmlYear(statusHtmlUrl);
    let metadata: RevisorIntroductionMetadata;
    try {
      metadata = parseRevisorIntroductionStatusHtml({
        html,
        identifier: row.identifier,
        session,
        sourceYear: resolvedStatusYear,
      });
      requireCompleteIntroduction(metadata, row.identifier, resolvedStatusYear);
    } catch (error) {
      lastFetchError = error;
      continue;
    }
    verifyExistingIntroductionDate(row, metadata);
    return {
      ...row,
      sourceUrl: statusHtmlUrl,
      sourceSha256: createHash('sha256').update(html).digest('hex'),
      sourceFormat: 'html',
      sourceName: 'Minnesota Revisor official Bill Status HTML fallback',
      fetchedAt: new Date().toISOString(),
      sourceYear: resolvedStatusYear,
      fallbackReason: 'Bill Status API v1 unavailable for both biennium-year candidates',
      metadata,
    };
  }

  throw lastFetchError instanceof Error
    ? new Error(`${row.identifier}: Revisor introduction fetch failed: ${lastFetchError.message}`)
    : new Error(`${row.identifier}: Revisor introduction fetch failed`);
}

async function fetchBatch(rows: readonly BillRow[], session: string): Promise<FetchedIntroduction[]> {
  const fetched: FetchedIntroduction[] = [];
  for (let offset = 0; offset < rows.length; offset += FETCH_CONCURRENCY) {
    const group = rows.slice(offset, offset + FETCH_CONCURRENCY);
    fetched.push(...await Promise.all(group.map((row) => fetchRevisorIntroductionForBackfill(row, session))));
  }
  return fetched;
}

async function selectBatch(input: {
  session: string;
  chamber: IntroductionBackfillChamber;
  afterBillNumber: number;
  limit: number;
}): Promise<BillRow[]> {
  const result = await pool.query<BillRow>(`
    SELECT b.id::text AS bill_id,
           b.session_id::text AS session_id,
           b.originating_chamber_id::text AS chamber_id,
           b.identifier,
           substring(b.identifier from '[0-9]+$')::integer AS bill_number,
           b.introduced_at::text AS existing_introduced_at
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug = $2
     WHERE s.slug = $1
       AND b.metadata ? 'revisorUniverse'
       AND substring(b.identifier from '[0-9]+$')::integer > $3
       AND (
         b.metadata #>> '{revisorIntroduction,parserVersion}' IS DISTINCT FROM $5
         OR b.introduced_at IS NULL
         OR b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' IS DISTINCT FROM 'true'
         OR b.metadata #>> '{revisorIntroduction,initialDocument,documentName}' IS NULL
         OR NOT EXISTS (
           SELECT 1
             FROM bill_versions bv
            WHERE bv.bill_id = b.id
              AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
         )
       )
     ORDER BY substring(b.identifier from '[0-9]+$')::integer, b.identifier
     LIMIT $4`, [input.session, input.chamber, input.afterBillNumber, input.limit, INTRODUCTION_BACKFILL_PARSER_VERSION]);
  return result.rows;
}

async function persistFetched(rows: readonly FetchedIntroduction[]): Promise<{
  sourceDocumentsRecorded: number;
  initialVersionsRecorded: number;
}> {
  if (rows.length === 0) return { sourceDocumentsRecorded: 0, initialVersionsRecorded: 0 };
  const sessionId = rows[0].session_id;
  const chamberId = rows[0].chamber_id;
  if (rows.some((row) => row.session_id !== sessionId || row.chamber_id !== chamberId)) {
    throw new Error('Introduction backfill persistence requires a single session/chamber scope');
  }

  const sourcePayload = rows.map((row) => ({
    source_url: row.sourceUrl,
    fetched_at: row.fetchedAt,
    content_sha256: row.sourceSha256,
    identifier: row.identifier,
    source_year: row.sourceYear,
    source_format: row.sourceFormat,
    source_name: row.sourceName,
    fallback_reason: row.fallbackReason,
  }));
  const billPayload = rows.map((row) => {
    const initial = row.metadata.initialDocument!;
    const sourceMetadata = row.sourceFormat === 'xml'
      ? {
          statusXmlUrl: row.sourceUrl,
          statusXmlSha256: row.sourceSha256,
          apiYear: row.sourceYear,
        }
      : {
          statusHtmlUrl: row.sourceUrl,
          statusHtmlSha256: row.sourceSha256,
          statusYear: row.sourceYear,
          fallbackReason: row.fallbackReason,
        };
    const introductionMetadata = {
      parserVersion: INTRODUCTION_BACKFILL_PARSER_VERSION,
      source: row.sourceName,
      sourceFormat: row.sourceFormat,
      ...sourceMetadata,
      fetchedAt: row.fetchedAt,
      introducedOn: row.metadata.introducedOn,
      introducedAtPrecision: 'date',
      initialDocument: {
        documentName: initial.documentName,
        insertedAt: initial.insertedAt,
        insertedOn: initial.insertedOn,
        ...(row.sourceFormat === 'html' ? { insertedAtPrecision: 'date' } : {}),
        htmlUrl: initial.htmlUrl,
        engrossment: initial.engrossment,
        modelEligible: true,
      },
      currentCompanion: row.metadata.currentCompanionIdentifier
        ? { identifier: row.metadata.currentCompanionIdentifier, observedAt: row.fetchedAt, modelEligible: false }
        : null,
      currentAuthorsModelEligible: false,
    };
    return {
      billId: row.bill_id,
      introducedAt: `${row.metadata.introducedOn}T12:00:00Z`,
      introductionMetadata,
      versionKey: initial.documentName,
      initialPublishedAt: `${initial.insertedOn}T12:00:00Z`,
      initialTextUrl: initial.htmlUrl,
      sourceUrl: row.sourceUrl,
    };
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sources = await client.query(`
      WITH payload AS (
        SELECT source_url, fetched_at, content_sha256, identifier, source_year, source_format, source_name, fallback_reason
          FROM jsonb_to_recordset($3::jsonb) AS x(
            source_url text,
            fetched_at timestamptz,
            content_sha256 text,
            identifier text,
            source_year integer,
            source_format text,
            source_name text,
            fallback_reason text
          )
      )
      INSERT INTO source_documents (
        jurisdiction_id, session_id, chamber_id, source_kind, source_url,
        fetched_at, content_sha256, http_status, metadata
      )
      SELECT (SELECT id FROM jurisdictions WHERE slug = 'us-mn'),
             $1::uuid,
             $2::uuid,
             'revisor_bill_status_introduction_metadata',
             p.source_url,
             p.fetched_at,
             p.content_sha256,
             200,
             jsonb_strip_nulls(jsonb_build_object(
               'identifier', p.identifier,
               'sourceYear', p.source_year,
               'sourceFormat', p.source_format,
               'source', p.source_name,
               'fallbackReason', p.fallback_reason,
               'parserVersion', $4::text,
               'semantics', 'introduction-time metadata and zero-engrossment initial official document provenance'
             ))
        FROM payload p
      ON CONFLICT (source_url, content_sha256) DO UPDATE SET
        fetched_at = GREATEST(source_documents.fetched_at, EXCLUDED.fetched_at),
        metadata = source_documents.metadata || EXCLUDED.metadata
      RETURNING id`, [sessionId, chamberId, JSON.stringify(sourcePayload), INTRODUCTION_BACKFILL_PARSER_VERSION]);

    await client.query(`
      WITH payload AS (
        SELECT bill_id, introduced_at, introduction_metadata
          FROM jsonb_to_recordset($1::jsonb) AS x(
            bill_id uuid,
            introduced_at timestamptz,
            introduction_metadata jsonb
          )
      )
      UPDATE bills b
         SET introduced_at = COALESCE(b.introduced_at, p.introduced_at),
             metadata = b.metadata || jsonb_build_object('revisorIntroduction', p.introduction_metadata),
             updated_at = now()
        FROM payload p
       WHERE b.id = p.bill_id`, [JSON.stringify(billPayload.map((row) => ({
      bill_id: row.billId,
      introduced_at: row.introducedAt,
      introduction_metadata: row.introductionMetadata,
    })))]);

    const versions = await client.query(`
      WITH payload AS (
        SELECT bill_id, version_key, published_at, text_url, source_url
          FROM jsonb_to_recordset($1::jsonb) AS x(
            bill_id uuid,
            version_key text,
            published_at timestamptz,
            text_url text,
            source_url text
          )
      )
      INSERT INTO bill_versions (bill_id, version_key, published_at, text_url, source_url)
      SELECT p.bill_id, p.version_key, p.published_at, p.text_url, p.source_url
        FROM payload p
      ON CONFLICT (bill_id, version_key) DO UPDATE SET
        published_at = COALESCE(bill_versions.published_at, EXCLUDED.published_at),
        text_url = COALESCE(bill_versions.text_url, EXCLUDED.text_url),
        source_url = COALESCE(bill_versions.source_url, EXCLUDED.source_url)
      RETURNING id`, [JSON.stringify(billPayload.map((row) => ({
      bill_id: row.billId,
      version_key: row.versionKey,
      published_at: row.initialPublishedAt,
      text_url: row.initialTextUrl,
      source_url: row.sourceUrl,
    })))]);

    await client.query('COMMIT');
    return {
      sourceDocumentsRecorded: sources.rowCount ?? 0,
      initialVersionsRecorded: versions.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function backfillRevisorIntroductionBatch(input: {
  session: string;
  chamber: IntroductionBackfillChamber;
  afterBillNumber?: number;
  limit?: number;
}): Promise<IntroductionBackfillBatchResult> {
  const expected = EXPECTED_REGULAR_BILLS[input.session]?.[input.chamber];
  if (!expected) throw new Error(`Unsupported Revisor introduction backfill scope: ${input.session}/${input.chamber}`);
  const afterBillNumber = input.afterBillNumber ?? 0;
  const limit = input.limit ?? INTRODUCTION_BACKFILL_MAX_BATCH;
  if (!Number.isInteger(afterBillNumber) || afterBillNumber < 0) throw new Error('afterBillNumber must be a non-negative integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > INTRODUCTION_BACKFILL_MAX_BATCH) {
    throw new Error(`limit must be between 1 and ${INTRODUCTION_BACKFILL_MAX_BATCH}`);
  }

  const selected = await selectBatch({ session: input.session, chamber: input.chamber, afterBillNumber, limit });
  if (selected.length === 0) {
    return {
      session: input.session,
      chamber: input.chamber,
      requestedAfterBillNumber: afterBillNumber,
      processed: 0,
      nextAfterBillNumber: afterBillNumber,
      done: true,
      introductionDates: 0,
      initialDocuments: 0,
      existingDatesPreserved: 0,
      sourceDocumentsRecorded: 0,
      initialVersionsRecorded: 0,
    };
  }

  const fetched = await fetchBatch(selected, input.session);
  const persisted = await persistFetched(fetched);
  const nextAfterBillNumber = selected[selected.length - 1].bill_number;
  return {
    session: input.session,
    chamber: input.chamber,
    requestedAfterBillNumber: afterBillNumber,
    processed: fetched.length,
    nextAfterBillNumber,
    done: selected.length < limit,
    introductionDates: fetched.filter((row) => row.metadata.introducedOn).length,
    initialDocuments: fetched.filter((row) => row.metadata.initialDocumentKnownByIntroduction).length,
    existingDatesPreserved: fetched.filter((row) => existingDate(row.existing_introduced_at) !== null).length,
    ...persisted,
  };
}

export async function verifyRevisorIntroductionBackfill(): Promise<{
  complete: boolean;
  expectedTotal: number;
  universeTotal: number;
  parserMetadataTotal: number;
  introductionDateTotal: number;
  eligibleInitialDocumentTotal: number;
  initialVersionTotal: number;
  scopes: IntroductionBackfillVerificationScope[];
}> {
  const result = await pool.query<{
    session_slug: string;
    chamber_slug: IntroductionBackfillChamber;
    universe_bills: string;
    parser_metadata: string;
    introduction_dates: string;
    eligible_initial_documents: string;
    initial_versions: string;
  }>(`
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           count(*)::text AS universe_bills,
           count(*) FILTER (
             WHERE b.metadata #>> '{revisorIntroduction,parserVersion}' = $1
           )::text AS parser_metadata,
           count(*) FILTER (
             WHERE b.introduced_at IS NOT NULL
               AND b.metadata #>> '{revisorIntroduction,parserVersion}' = $1
           )::text AS introduction_dates,
           count(*) FILTER (
             WHERE b.metadata #>> '{revisorIntroduction,initialDocument,modelEligible}' = 'true'
           )::text AS eligible_initial_documents,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1
                 FROM bill_versions bv
                WHERE bv.bill_id = b.id
                  AND bv.version_key = b.metadata #>> '{revisorIntroduction,initialDocument,documentName}'
             )
           )::text AS initial_versions
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
     WHERE b.metadata ? 'revisorUniverse'
     GROUP BY s.slug, c.slug
     ORDER BY s.slug, c.slug`, [INTRODUCTION_BACKFILL_PARSER_VERSION]);

  const scopes = INTRODUCTION_BACKFILL_SCOPES.map((expected) => {
    const row = result.rows.find((candidate) => candidate.session_slug === expected.session && candidate.chamber_slug === expected.chamber);
    const universeBills = Number(row?.universe_bills ?? 0);
    const parserMetadata = Number(row?.parser_metadata ?? 0);
    const introductionDates = Number(row?.introduction_dates ?? 0);
    const eligibleInitialDocuments = Number(row?.eligible_initial_documents ?? 0);
    const initialVersions = Number(row?.initial_versions ?? 0);
    return {
      session: expected.session,
      chamber: expected.chamber,
      expectedBills: expected.expectedBills,
      universeBills,
      parserMetadata,
      introductionDates,
      eligibleInitialDocuments,
      initialVersions,
      complete: universeBills === expected.expectedBills
        && parserMetadata === expected.expectedBills
        && introductionDates === expected.expectedBills
        && eligibleInitialDocuments === expected.expectedBills
        && initialVersions === expected.expectedBills,
    };
  });

  const expectedTotal = INTRODUCTION_BACKFILL_SCOPES.reduce((sum, row) => sum + row.expectedBills, 0);
  const sum = (key: 'universeBills' | 'parserMetadata' | 'introductionDates' | 'eligibleInitialDocuments' | 'initialVersions') =>
    scopes.reduce((total, row) => total + row[key], 0);
  return {
    complete: scopes.every((row) => row.complete) && expectedTotal === 31_010,
    expectedTotal,
    universeTotal: sum('universeBills'),
    parserMetadataTotal: sum('parserMetadata'),
    introductionDateTotal: sum('introductionDates'),
    eligibleInitialDocumentTotal: sum('eligibleInitialDocuments'),
    initialVersionTotal: sum('initialVersions'),
    scopes,
  };
}

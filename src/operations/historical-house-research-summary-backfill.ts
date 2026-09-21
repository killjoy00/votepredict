import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import { fetchPublicPage } from '@/evidence/public-http';
import { persistDurableEvidence, type DurableEvidenceDraft } from '@/evidence/durable-ingestion';
import {
  extractHouseResearchSummaryPdfLinks,
  HOUSE_RESEARCH_SUMMARY_PDF_PARSER_VERSION,
  parseHouseResearchSummaryPdfText,
} from '@/evidence/minnesota-bill-context';

export const HISTORICAL_HOUSE_RESEARCH_SUMMARY_BACKFILL_VERSION =
  'historical-house-research-summary-v2' as const;

const SESSION_LEGISLATURE = {
  '2021-2022': 92,
  '2023-2024': 93,
} as const;

type SupportedSession = keyof typeof SESSION_LEGISLATURE;
type TargetBill = {
  id: string;
  identifier: string;
  first_passage_on: string;
};

export interface HistoricalHouseResearchSummaryBatchResult {
  version: typeof HISTORICAL_HOUSE_RESEARCH_SUMMARY_BACKFILL_VERSION;
  session: SupportedSession;
  attemptedBills: number;
  processedBills: number;
  billsWithoutSummaries: number;
  summaryDocuments: number;
  prePassageSummaryDocuments: number;
  inserted: number;
  reused: number;
  unresolvedTargets: number;
  failures: number;
  failureExamples: Array<Record<string, unknown>>;
  done: boolean;
  remainingBills: number;
  servingProbabilityChange: 'none';
  allNewFeatureWeights: 0;
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 700);
}

function detailBillParam(identifier: string): string {
  const match = identifier.toUpperCase().replace(/\s+/g, '').match(/^(HF|SF)(\d+)$/);
  if (!match) throw new Error('Unsupported House Research bill identifier: ' + identifier);
  return match[1] + match[2].padStart(4, '0');
}

async function loadPendingBills(session: SupportedSession, limit: number): Promise<TargetBill[]> {
  const result = await pool.query<TargetBill>(`
    SELECT b.id::text AS id,
           b.identifier,
           min(ve.occurred_on)::text AS first_passage_on
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
      JOIN vote_events ve ON ve.bill_id=b.id AND ve.is_passage=true
     WHERE j.slug='us-mn'
       AND s.slug=$1
       AND b.identifier ~ '^(HF|SF)[0-9]+$'
       AND NOT EXISTS (
         SELECT 1
           FROM source_documents sd
          WHERE sd.session_id=s.id
            AND sd.metadata->>'historicalBackfill'='true'
            AND sd.metadata->>'sourcePolicy'='house-research-dated-summary-pdf-v1'
            AND sd.metadata->>'billIdentifier'=b.identifier
       )
     GROUP BY b.id,b.identifier
     ORDER BY min(ve.occurred_on),b.identifier
     LIMIT $2
  `, [session, limit]);
  return result.rows;
}

async function remainingBills(session: SupportedSession): Promise<number> {
  const result = await pool.query<{ remaining: number }>(`
    SELECT count(*)::int AS remaining
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id
     WHERE j.slug='us-mn'
       AND s.slug=$1
       AND b.identifier ~ '^(HF|SF)[0-9]+$'
       AND EXISTS (SELECT 1 FROM vote_events ve WHERE ve.bill_id=b.id AND ve.is_passage=true)
       AND NOT EXISTS (
         SELECT 1
           FROM source_documents sd
          WHERE sd.session_id=s.id
            AND sd.metadata->>'historicalBackfill'='true'
            AND sd.metadata->>'sourcePolicy'='house-research-dated-summary-pdf-v1'
            AND sd.metadata->>'billIdentifier'=b.identifier
       )
  `, [session]);
  return result.rows[0]?.remaining ?? 0;
}

async function fetchSummaryPdf(urlValue: string, legislature: number): Promise<{
  text: string;
  sha256: string;
  fetchedAt: string;
  httpStatus: number;
}> {
  const url = new URL(urlValue);
  if (!['house.mn.gov', 'www.house.mn.gov'].includes(url.hostname.toLowerCase())) {
    throw new Error('Unsupported House Research summary host: ' + url.hostname);
  }
  if (!new RegExp('^/hrd/bs/' + legislature + '/[^/]+\\.pdf$', 'i').test(url.pathname)) {
    throw new Error('Unsupported House Research summary path: ' + url.pathname);
  }

  const response = await fetch(url.toString(), {
    headers: { 'user-agent': 'VotePredict/2.0 historical-house-research-summary-backfill' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('House Research summary returned HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 500 || bytes.byteLength > 8_000_000) {
    throw new Error('House Research summary PDF has unexpected byte length: ' + bytes.byteLength);
  }

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const parsed = await parser.getText();
    if (!parsed.text || parsed.text.length < 80) throw new Error('House Research summary PDF text is empty');
    return {
      text: parsed.text,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
    };
  } finally {
    await parser.destroy();
  }
}

async function processBill(session: SupportedSession, legislature: number, bill: TargetBill) {
  const detailUrl = 'https://www.house.mn.gov/hrd/billsumdetail.aspx?bill='
    + detailBillParam(bill.identifier)
    + '&filter=Detail&ls='
    + legislature;
  const detail = await fetchPublicPage(detailUrl, {
    timeoutMs: 20_000,
    maxBytes: 2_500_000,
    userAgent: 'VotePredict/2.0 historical-house-research-summary-backfill',
  });
  const links = extractHouseResearchSummaryPdfLinks(detail.rawContent, detail.canonicalUrl, legislature);

  let inserted = 0;
  let reused = 0;
  let unresolvedTargets = 0;
  let prePassageSummaryDocuments = 0;

  for (const link of links) {
    const pdf = await fetchSummaryPdf(link.url, legislature);
    const parsed = parseHouseResearchSummaryPdfText(pdf.text);
    if (!parsed) throw new Error('Could not parse House Research summary PDF header: ' + link.url);
    if (parsed.billIdentifier !== bill.identifier.toUpperCase().replace(/\s+/g, '')) {
      throw new Error(
        'House Research summary bill mismatch: expected '
        + bill.identifier
        + ', observed '
        + parsed.billIdentifier,
      );
    }

    const prePassage = parsed.summaryDate < bill.first_passage_on;
    if (prePassage) prePassageSummaryDocuments += 1;
    const draft: DurableEvidenceDraft = {
      target: { billId: bill.id },
      kind: 'context',
      stance: 'neutral',
      claim: 'Nonpartisan House Research published a dated summary of '
        + bill.identifier
        + ' at version '
        + parsed.version
        + '.',
      publishedAt: parsed.summaryDate + 'T12:00:00.000Z',
      sourceQuality: 'official',
      relevance: 'high',
      freshness: 'stale',
      extractionMethod: 'deterministic-house-research-summary-pdf-header',
      extractionVersion: HOUSE_RESEARCH_SUMMARY_PDF_PARSER_VERSION,
      confidence: 1,
      metadata: {
        contextType: 'structured_public',
        subtype: 'bill_summary_version',
        historicalBackfill: true,
        version: parsed.version,
        subject: parsed.subject,
        summaryDate: parsed.summaryDate,
        firstPassageOn: bill.first_passage_on,
        preFirstPassage: prePassage,
        asOfEligible: true,
        dateGranularity: 'day',
        sameDayAsTargetExcluded: true,
        contextOnly: true,
        mechanicallyActionable: false,
        quickEvidenceStructured: true,
        modelWeight: 0,
        evidenceSeriesKey:
          'bill_summary_version:bill:'
          + bill.id
          + ':date:'
          + parsed.summaryDate
          + ':version:'
          + parsed.version,
      },
    };

    const persisted = await persistDurableEvidence({
      sourceKind: 'house_research_bill_summary',
      sourceUrl: link.url,
      contentSha256: pdf.sha256,
      sessionSlug: session,
      fetchedAt: pdf.fetchedAt,
      httpStatus: pdf.httpStatus,
      metadata: {
        historicalBackfill: true,
        billIdentifier: bill.identifier,
        version: parsed.version,
        subject: parsed.subject,
        summaryDate: parsed.summaryDate,
        parserVersion: HOUSE_RESEARCH_SUMMARY_PDF_PARSER_VERSION,
        sourcePolicy: 'house-research-dated-summary-pdf-v1',
      },
    }, [draft]);
    inserted += persisted.inserted;
    reused += persisted.reused;
    unresolvedTargets += persisted.unresolvedTargets.length;
  }

  await persistDurableEvidence({
    sourceKind: 'house_research_bill_summary_detail_index',
    sourceUrl: detail.canonicalUrl,
    contentSha256: detail.contentSha256,
    sessionSlug: session,
    fetchedAt: detail.fetchedAt,
    httpStatus: detail.httpStatus,
    metadata: {
      historicalBackfill: true,
      billIdentifier: bill.identifier,
      legislature,
      summaryLinkCount: links.length,
      parserVersion: HOUSE_RESEARCH_SUMMARY_PDF_PARSER_VERSION,
      sourcePolicy: 'house-research-dated-summary-pdf-v1',
    },
  }, []);

  return {
    summaryDocuments: links.length,
    billsWithoutSummaries: links.length === 0 ? 1 : 0,
    prePassageSummaryDocuments,
    inserted,
    reused,
    unresolvedTargets,
  };
}

export async function backfillHistoricalHouseResearchSummaryBatch(
  session: SupportedSession,
  requestedLimit = 6,
): Promise<HistoricalHouseResearchSummaryBatchResult> {
  const legislature = SESSION_LEGISLATURE[session];
  if (!legislature) throw new Error('Unsupported historical House Research session: ' + session);
  const limit = Math.min(10, Math.max(1, Math.trunc(requestedLimit)));
  const bills = await loadPendingBills(session, limit);

  const result: HistoricalHouseResearchSummaryBatchResult = {
    version: HISTORICAL_HOUSE_RESEARCH_SUMMARY_BACKFILL_VERSION,
    session,
    attemptedBills: bills.length,
    processedBills: 0,
    billsWithoutSummaries: 0,
    summaryDocuments: 0,
    prePassageSummaryDocuments: 0,
    inserted: 0,
    reused: 0,
    unresolvedTargets: 0,
    failures: 0,
    failureExamples: [],
    done: false,
    remainingBills: 0,
    servingProbabilityChange: 'none',
    allNewFeatureWeights: 0,
  };

  for (const bill of bills) {
    try {
      const processed = await processBill(session, legislature, bill);
      result.processedBills += 1;
      result.billsWithoutSummaries += processed.billsWithoutSummaries;
      result.summaryDocuments += processed.summaryDocuments;
      result.prePassageSummaryDocuments += processed.prePassageSummaryDocuments;
      result.inserted += processed.inserted;
      result.reused += processed.reused;
      result.unresolvedTargets += processed.unresolvedTargets;
    } catch (error) {
      result.failures += 1;
      result.failureExamples.push({
        billIdentifier: bill.identifier,
        error: safeMessage(error),
      });
    }
  }

  result.remainingBills = await remainingBills(session);
  result.done = result.remainingBills === 0;
  return result;
}

export async function verifyHistoricalHouseResearchSummaryBackfill() {
  const result = await pool.query<{
    session_slug: SupportedSession;
    target_bills: string;
    processed_bills: string;
    bills_with_summary: string;
    evidence_rows: string;
    pre_passage_rows: string;
  }>(`
    WITH target AS (
      SELECT s.id AS session_id,s.slug,b.id AS bill_id,b.identifier
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id
       WHERE j.slug='us-mn'
         AND s.slug IN ('2021-2022','2023-2024')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
         AND EXISTS (SELECT 1 FROM vote_events ve WHERE ve.bill_id=b.id AND ve.is_passage=true)
    )
    SELECT t.slug AS session_slug,
           count(DISTINCT t.bill_id)::text AS target_bills,
           count(DISTINCT t.bill_id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM source_documents sd
                WHERE sd.session_id=t.session_id
                  AND sd.metadata->>'historicalBackfill'='true'
                  AND sd.metadata->>'sourcePolicy'='house-research-dated-summary-pdf-v1'
                  AND sd.metadata->>'billIdentifier'=t.identifier
             )
           )::text AS processed_bills,
           count(DISTINCT t.bill_id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM evidence_items ei
                WHERE ei.bill_id=t.bill_id
                  AND ei.metadata->>'subtype'='bill_summary_version'
                  AND ei.metadata->>'historicalBackfill'='true'
             )
           )::text AS bills_with_summary,
           count(DISTINCT ei.id)::text AS evidence_rows,
           count(DISTINCT ei.id) FILTER (
             WHERE ei.metadata->>'preFirstPassage'='true'
           )::text AS pre_passage_rows
      FROM target t
      LEFT JOIN evidence_items ei
        ON ei.bill_id=t.bill_id
       AND ei.metadata->>'subtype'='bill_summary_version'
       AND ei.metadata->>'historicalBackfill'='true'
     GROUP BY t.slug
     ORDER BY t.slug
  `);

  const coverage = result.rows.map((row) => ({
    session: row.session_slug,
    targetBills: Number(row.target_bills),
    processedBills: Number(row.processed_bills),
    billsWithSummary: Number(row.bills_with_summary),
    evidenceRows: Number(row.evidence_rows),
    prePassageRows: Number(row.pre_passage_rows),
  }));

  return {
    version: HISTORICAL_HOUSE_RESEARCH_SUMMARY_BACKFILL_VERSION,
    complete: coverage.length === 2
      && coverage.every((row) => row.processedBills === row.targetBills),
    coverage,
    servingProbabilityChange: 'none' as const,
    allNewFeatureWeights: 0 as const,
  };
}

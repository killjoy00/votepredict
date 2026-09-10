import { createHash } from 'node:crypto';
import {
  parseRevisorBillSearchXml,
  revisorSearchSessionValue,
  type RevisorBillSearchBody,
  type RevisorBillSearchResult,
} from './revisor-bill-search';

const REVISOR_ACTION_RESULT_URL = 'https://www.revisor.mn.gov/bills/status_result.php';
export const REVISOR_ACTION_SEARCH_RESULT_LIMIT = 500;

export const REVISOR_SOURCE_PASSAGE_ACTIONS: Record<RevisorBillSearchBody, readonly string[]> = {
  House: ['1283', '1284'], // Bill was passed; Bill was passed as amended
  Senate: ['2268', '2269'], // Third reading Passed; Third reading Passed as amended
};

export const REVISOR_SOURCE_REPASS_ACTIONS: Record<RevisorBillSearchBody, readonly string[]> = {
  House: ['1287', '1288'], // conference / Senate-amended repassage
  Senate: ['2231', '2241', '2296'], // conference, concurrence, third-reading repassage
};

export interface RevisorActionSearchDocument {
  body: RevisorBillSearchBody;
  session: string;
  actionId: string;
  sourceUrl: string;
  fetchedAt: string;
  contentSha256: string;
  results: RevisorBillSearchResult[];
}

export interface RevisorSourcePassageSearch {
  bills: RevisorBillSearchResult[];
  documents: RevisorActionSearchDocument[];
}

function sourceFileType(body: RevisorBillSearchBody): 'HF' | 'SF' {
  return body === 'House' ? 'HF' : 'SF';
}

export function filterRevisorSourceChamberBills(
  body: RevisorBillSearchBody,
  rows: readonly RevisorBillSearchResult[],
): RevisorBillSearchResult[] {
  const expectedType = sourceFileType(body);
  return rows.filter((row) => row.fileType === expectedType);
}

export function buildRevisorActionSearchUrl(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  actionId: string;
}): string {
  if (!/^\d+$/.test(input.actionId)) throw new Error('Revisor action ID must be numeric');
  const params = new URLSearchParams({
    body: input.body,
    search: 'action',
    session: revisorSearchSessionValue(input.sessionKey),
    submit_action: 'GO',
    format: 'xml',
  });
  params.append('action[]', input.actionId);
  return `${REVISOR_ACTION_RESULT_URL}?${params.toString()}`;
}

export async function fetchRevisorActionSearchDocument(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  actionId: string;
}): Promise<RevisorActionSearchDocument> {
  const sourceUrl = buildRevisorActionSearchUrl(input);
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'VotePredict/2.0 official Minnesota action-search audit' },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Minnesota Revisor action search returned ${response.status}: ${sourceUrl}`);
  const text = await response.text();
  if (/<!doctype\s+html|<html\b/i.test(text.slice(0, 1000))) {
    throw new Error(`Minnesota Revisor action search returned HTML instead of XML: ${sourceUrl}`);
  }
  const results = parseRevisorBillSearchXml(text);
  if (results.length >= REVISOR_ACTION_SEARCH_RESULT_LIMIT) {
    throw new Error(
      `Minnesota Revisor action search may be truncated at ${REVISOR_ACTION_SEARCH_RESULT_LIMIT} rows: ${sourceUrl}`,
    );
  }
  return {
    body: input.body,
    session: revisorSearchSessionValue(input.sessionKey),
    actionId: input.actionId,
    sourceUrl: response.url || sourceUrl,
    fetchedAt: new Date().toISOString(),
    contentSha256: createHash('sha256').update(text).digest('hex'),
    results,
  };
}

export async function fetchRevisorSourceChamberActionSearch(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
  actionIds: readonly string[];
}): Promise<RevisorSourcePassageSearch> {
  const documents: RevisorActionSearchDocument[] = [];
  const rows = new Map<string, RevisorBillSearchResult>();

  for (const actionId of input.actionIds) {
    const document = await fetchRevisorActionSearchDocument({
      sessionKey: input.sessionKey,
      body: input.body,
      actionId,
    });
    documents.push(document);
    for (const row of filterRevisorSourceChamberBills(input.body, document.results)) {
      rows.set(row.identifier, row);
    }
  }

  return {
    bills: [...rows.values()].sort((left, right) => left.fileNumber - right.fileNumber || left.identifier.localeCompare(right.identifier)),
    documents,
  };
}

export async function fetchRevisorSourceChamberPassageSearch(input: {
  sessionKey: string;
  body: RevisorBillSearchBody;
}): Promise<RevisorSourcePassageSearch> {
  return fetchRevisorSourceChamberActionSearch({
    ...input,
    actionIds: REVISOR_SOURCE_PASSAGE_ACTIONS[input.body],
  });
}

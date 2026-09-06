import { createHash } from 'node:crypto';
import { getMinnesotaHouseSession } from './sessions';

const REVISOR_BASE = 'https://www.revisor.mn.gov';

export interface RevisorBillMetadata {
  identifier: string;
  legislature: number;
  sessionStartYear: number;
  title: string;
  description?: string;
  currentVersion?: string;
  sourceUrl: string;
  latestTextUrl: string;
  text?: string;
  textSha256?: string;
}

class RevisorFetchError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`Minnesota Revisor returned ${status}: ${url}`);
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeBillIdentifier(value: string): string {
  const match = value.trim().match(/^(HF|SF)\s*0*(\d+)$/i);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier: ${value}`);
  return `${match[1].toUpperCase()}${Number(match[2])}`;
}

function buildRevisorBillUrlForYear(sessionKey: string, billIdentifier: string, year: number): string {
  const session = getMinnesotaHouseSession(sessionKey);
  const bill = normalizeBillIdentifier(billIdentifier);
  const prefix = bill.slice(0, 2);
  const number = bill.slice(2);
  return `${REVISOR_BASE}/bills/${session.legislature}/${year}/0/${prefix}/${number}/`;
}

export function buildRevisorBillCandidateUrls(sessionKey: string, billIdentifier: string): string[] {
  const session = getMinnesotaHouseSession(sessionKey);
  const startYear = Number(session.startsOn.slice(0, 4));
  return [startYear, startYear + 1].map((year) => buildRevisorBillUrlForYear(sessionKey, billIdentifier, year));
}

export function buildRevisorBillUrl(sessionKey: string, billIdentifier: string): string {
  return buildRevisorBillCandidateUrls(sessionKey, billIdentifier)[0];
}

export function buildRevisorLatestTextUrl(sessionKey: string, billIdentifier: string): string {
  return `${buildRevisorBillUrl(sessionKey, billIdentifier)}versions/latest/`;
}

function stripMarkup(html: string): string {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseRevisorBillStatusHtml(input: { html: string; sessionKey: string; billIdentifier: string; sourceUrl: string }): RevisorBillMetadata {
  const session = getMinnesotaHouseSession(input.sessionKey);
  const identifier = normalizeBillIdentifier(input.billIdentifier);
  const titleMatch = input.html.match(/<h1[^>]*>\s*([HS]F)\s*0*(\d+)\s*<\/h1>/i);
  if (titleMatch) {
    const pageIdentifier = `${titleMatch[1].toUpperCase()}${Number(titleMatch[2])}`;
    if (pageIdentifier !== identifier) throw new Error(`Revisor bill mismatch: expected ${identifier}, found ${pageIdentifier}`);
  }

  const descriptionMatch = input.html.match(/<h2[^>]*>\s*Description\s*<\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const currentVersionMatch = input.html.match(/Current bill text:\s*([^<\n]+)/i);
  const text = stripMarkup(input.html);
  const heading = text.split('\n').find((line) => line.startsWith(`${identifier.slice(0, 2)} ${Number(identifier.slice(2))}`));
  return {
    identifier,
    legislature: session.legislature,
    sessionStartYear: Number(session.startsOn.slice(0, 4)),
    title: heading ?? `${identifier.slice(0, 2)} ${Number(identifier.slice(2))}`,
    description: descriptionMatch ? stripMarkup(descriptionMatch[1]) : undefined,
    currentVersion: currentVersionMatch?.[1]?.trim(),
    sourceUrl: input.sourceUrl,
    latestTextUrl: `${input.sourceUrl}versions/latest/`,
  };
}

export function parseRevisorBillTextHtml(html: string): { text: string; sha256: string } {
  const documentMatch = html.match(/<div[^>]+id=["']document["'][^>]*>([\s\S]*?)(?:<\/main>|<footer|$)/i);
  if (!documentMatch) throw new Error('The Revisor page did not contain bill text');
  const text = stripMarkup(documentMatch[1]);
  if (text.length < 100) throw new Error('The Revisor bill text was unexpectedly short');
  return { text, sha256: createHash('sha256').update(text).digest('hex') };
}

async function fetchOfficial(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VotePredict/2.0 official Minnesota bill ingester' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new RevisorFetchError(response.status, url);
  return response.text();
}

export async function fetchRevisorBill(sessionKey: string, billIdentifier: string, includeText = false): Promise<RevisorBillMetadata> {
  let sourceUrl: string | undefined;
  let html: string | undefined;
  let lastError: unknown;
  for (const candidate of buildRevisorBillCandidateUrls(sessionKey, billIdentifier)) {
    try {
      html = await fetchOfficial(candidate);
      sourceUrl = candidate;
      break;
    } catch (error) {
      lastError = error;
      if (!(error instanceof RevisorFetchError) || error.status !== 404) throw error;
    }
  }
  if (!html || !sourceUrl) throw lastError instanceof Error ? lastError : new Error(`Minnesota Revisor bill not found: ${billIdentifier}`);

  const metadata = parseRevisorBillStatusHtml({ html, sessionKey, billIdentifier, sourceUrl });
  if (!includeText) return metadata;
  const textHtml = await fetchOfficial(metadata.latestTextUrl);
  const parsedText = parseRevisorBillTextHtml(textHtml);
  return { ...metadata, text: parsedText.text, textSha256: parsedText.sha256 };
}

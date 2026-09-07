import { createHash } from 'node:crypto';
import { getMinnesotaHouseSession } from './sessions';

const REVISOR_BASE = 'https://www.revisor.mn.gov';

export interface RevisorBillVersionMetadata {
  versionKey: string;
  ordinal: number;
  postedOn: string;
  textUrl: string;
}

export interface RevisorBillMetadata {
  identifier: string;
  legislature: number;
  sessionStartYear: number;
  title: string;
  description?: string;
  currentVersion?: string;
  companionIdentifier?: string;
  sourceUrl: string;
  latestTextUrl: string;
  versions: RevisorBillVersionMetadata[];
  text?: string;
  textSha256?: string;
}

interface OfficialResponse {
  text: string;
  finalUrl: string;
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
  return `${REVISOR_BASE}/bills/${session.legislature}/${year}/0/${bill.slice(0, 2)}/${bill.slice(2)}/`;
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

function parseCurrentVersion(html: string): string | undefined {
  const match = html.match(/Current bill text:\s*([\s\S]*?)(?=<\/p>|<br\s*\/?>|\n)/i);
  if (!match) return undefined;
  return stripMarkup(match[1]) || undefined;
}

function parseCompanionIdentifier(html: string): string | undefined {
  const match = html.match(/Companion:\s*<a\b[^>]*>\s*([HS]F)\s*0*(\d+)\s*<\/a>/i);
  return match ? `${match[1].toUpperCase()}${Number(match[2])}` : undefined;
}

function parseVersionHistory(html: string, sourceUrl: string): RevisorBillVersionMetadata[] {
  const versions = new Map<number, RevisorBillVersionMetadata>();
  const pattern = /<a\b[^>]*href=["']([^"']*versions\/(\d+)\/)["'][^>]*>([\s\S]*?)<\/a>[\s\S]{0,240}?Posted on\s*(\d{2})\/(\d{2})\/(\d{4})/gi;
  for (const match of html.matchAll(pattern)) {
    const ordinal = Number(match[2]);
    const versionKey = stripMarkup(match[3]);
    if (!versionKey) continue;
    const postedOn = `${match[6]}-${match[4]}-${match[5]}`;
    versions.set(ordinal, {
      versionKey,
      ordinal,
      postedOn,
      textUrl: new URL(match[1], sourceUrl).toString(),
    });
  }
  return [...versions.values()].sort((a, b) => a.ordinal - b.ordinal);
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
  const text = stripMarkup(input.html);
  const heading = text.split('\n').find((line) => line.startsWith(`${identifier.slice(0, 2)} ${Number(identifier.slice(2))}`));
  return {
    identifier,
    legislature: session.legislature,
    sessionStartYear: Number(session.startsOn.slice(0, 4)),
    title: heading ?? `${identifier.slice(0, 2)} ${Number(identifier.slice(2))}`,
    description: descriptionMatch ? stripMarkup(descriptionMatch[1]) : undefined,
    currentVersion: parseCurrentVersion(input.html),
    companionIdentifier: parseCompanionIdentifier(input.html),
    sourceUrl: input.sourceUrl,
    latestTextUrl: `${input.sourceUrl}versions/latest/`,
    versions: parseVersionHistory(input.html, input.sourceUrl),
  };
}

export function parseRevisorBillTextHtml(html: string): { text: string; sha256: string } {
  const documentMatch = html.match(/<div[^>]+id=["']document["'][^>]*>([\s\S]*?)(?:<\/main>|<footer|$)/i);
  if (!documentMatch) throw new Error('The Revisor page did not contain bill text');
  const text = stripMarkup(documentMatch[1]);
  if (text.length < 100) throw new Error('The Revisor bill text was unexpectedly short');
  return { text, sha256: createHash('sha256').update(text).digest('hex') };
}

async function fetchOfficial(url: string): Promise<OfficialResponse> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VotePredict/2.0 official Minnesota bill ingester' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new RevisorFetchError(response.status, url);
  return { text: await response.text(), finalUrl: response.url || url };
}

export async function fetchRevisorBillVersion(version: RevisorBillVersionMetadata): Promise<RevisorBillVersionMetadata & { text: string; textSha256: string }> {
  const response = await fetchOfficial(version.textUrl);
  const parsed = parseRevisorBillTextHtml(response.text);
  return { ...version, textUrl: response.finalUrl, text: parsed.text, textSha256: parsed.sha256 };
}

export async function fetchRevisorBill(sessionKey: string, billIdentifier: string, includeText = false): Promise<RevisorBillMetadata> {
  let sourceUrl: string | undefined;
  let html: string | undefined;
  let lastError: unknown;
  for (const candidate of buildRevisorBillCandidateUrls(sessionKey, billIdentifier)) {
    try {
      const response = await fetchOfficial(candidate);
      html = response.text;
      sourceUrl = response.finalUrl;
      break;
    } catch (error) {
      lastError = error;
      if (!(error instanceof RevisorFetchError) || error.status !== 404) throw error;
    }
  }
  if (!html || !sourceUrl) throw lastError instanceof Error ? lastError : new Error(`Minnesota Revisor bill not found: ${billIdentifier}`);
  const metadata = parseRevisorBillStatusHtml({ html, sessionKey, billIdentifier, sourceUrl });
  if (!includeText) return metadata;
  const textResponse = await fetchOfficial(metadata.latestTextUrl);
  const parsedText = parseRevisorBillTextHtml(textResponse.text);
  return { ...metadata, text: parsedText.text, textSha256: parsedText.sha256 };
}

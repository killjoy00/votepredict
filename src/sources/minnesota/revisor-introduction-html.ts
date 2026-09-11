import { getMinnesotaHouseSession } from './sessions';
import type { RevisorIntroductionMetadata } from './revisor-introduction';

const FETCH_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 10_000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIdentifier(identifier: string): { identifier: string; fileType: 'HF' | 'SF'; fileNumber: number } {
  const match = identifier.trim().match(/^(HF|SF)\s*0*(\d+)$/i);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier: ${identifier}`);
  const fileType = match[1].toUpperCase() as 'HF' | 'SF';
  const fileNumber = Number(match[2]);
  return { identifier: `${fileType}${fileNumber}`, fileType, fileNumber };
}

function isoDate(value: string): string {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (!match) throw new Error(`Unsupported Revisor status HTML date: ${value}`);
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function earliestDate(matches: IterableIterator<RegExpMatchArray>, captureIndex: number): string | null {
  const dates = [...matches].map((match) => isoDate(match[captureIndex]));
  dates.sort();
  return dates[0] ?? null;
}

export function buildRevisorRegularSessionStatusHtmlUrls(sessionKeyOrSlug: string, rawIdentifier: string): string[] {
  const session = getMinnesotaHouseSession(sessionKeyOrSlug);
  const { fileType, fileNumber } = normalizeIdentifier(rawIdentifier);
  const firstYear = Number(session.startsOn.slice(0, 4));
  const body = fileType === 'HF' ? 'House' : 'Senate';
  return [firstYear, firstYear + 1].map(
    (year) => `https://www.revisor.mn.gov/bills/${session.legislature}/${year}/0/${fileType}/${fileNumber}/?body=${body}&list=open`,
  );
}

export function parseRevisorIntroductionStatusHtml(input: {
  html: string;
  identifier: string;
  session: string;
  sourceYear: number;
}): RevisorIntroductionMetadata {
  const session = getMinnesotaHouseSession(input.session);
  const { identifier, fileType, fileNumber } = normalizeIdentifier(input.identifier);
  const firstYear = Number(session.startsOn.slice(0, 4));
  if (input.sourceYear !== firstYear && input.sourceYear !== firstYear + 1) {
    throw new Error(`${identifier}: Revisor status HTML year ${input.sourceYear} is outside ${session.slug}`);
  }

  const text = decodeHtmlText(input.html);
  const identifierPattern = new RegExp(`\\b${fileType}\\s*0*${fileNumber}\\b`, 'i');
  if (!identifierPattern.test(text)) throw new Error(`${identifier}: official status HTML does not identify the requested bill`);
  if (!text.includes(`${session.legislature}`) || !text.includes(`${firstYear}`) || !text.includes(`${firstYear + 1}`)) {
    throw new Error(`${identifier}: official status HTML does not identify the expected legislature/biennium`);
  }

  const introducedOn = earliestDate(
    text.matchAll(/\b(\d{1,2}\/\d{1,2}\/20\d{2})\s+(?:\|\s*)?Introduction and first reading\b/gi),
    1,
  );
  if (!introducedOn) throw new Error(`${identifier}: source-chamber introduction date missing from official status HTML`);
  if (!introducedOn.startsWith(`${input.sourceYear}-`)) {
    throw new Error(`${identifier}: HTML introduction year ${introducedOn.slice(0, 4)} does not match status year ${input.sourceYear}`);
  }

  const initialDocumentOn = earliestDate(
    text.matchAll(/\bIntroduction\s+(?:PDF\s*)?(?:\|\s*)?Posted on\s+(\d{1,2}\/\d{1,2}\/20\d{2})\b/gi),
    1,
  );
  if (!initialDocumentOn) throw new Error(`${identifier}: zero-engrossment introduction document date missing from official status HTML`);

  const paddedNumber = String(fileNumber).padStart(4, '0');
  const documentName = `${input.sourceYear}.0-${fileType}${paddedNumber}-0`;
  const htmlUrl = `https://www.revisor.mn.gov/bills/${session.legislature}/${input.sourceYear}/0/${fileType}/${fileNumber}/versions/0/`;

  return {
    identifier,
    sourceChamber: fileType === 'HF' ? 'house' : 'senate',
    introducedOn,
    initialDocument: {
      documentName,
      insertedAt: null,
      insertedOn: initialDocumentOn,
      htmlUrl,
      engrossment: 0,
    },
    initialDocumentKnownByIntroduction: initialDocumentOn <= introducedOn,
    // The HTML status page exposes current companion state, not introduction-time state.
    // Deliberately omit it rather than accidentally treating a later relationship as contemporaneous.
    currentCompanionIdentifier: null,
    companionModelEligible: false,
  };
}

function retryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function retryDelayMilliseconds(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_RETRY_DELAY_MS, Math.round(seconds * 1_000));
  }
  return Math.min(MAX_RETRY_DELAY_MS, 750 * (2 ** attempt));
}

export async function fetchRevisorIntroductionStatusHtml(statusHtmlUrl: string): Promise<string> {
  let lastTransportError: unknown;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(statusHtmlUrl, {
        headers: {
          'User-Agent': 'VotePredict/2.0 official Minnesota introduction metadata fallback',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        },
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
        redirect: 'follow',
      });
    } catch (error) {
      lastTransportError = error;
      if (attempt < FETCH_ATTEMPTS - 1) {
        await sleep(Math.min(MAX_RETRY_DELAY_MS, 750 * (2 ** attempt)));
        continue;
      }
      throw error;
    }

    if (retryableStatus(response.status) && attempt < FETCH_ATTEMPTS - 1) {
      await sleep(retryDelayMilliseconds(response, attempt));
      continue;
    }
    if (!response.ok) throw new Error(`Minnesota Revisor bill status HTML returned ${response.status}: ${statusHtmlUrl}`);
    const html = await response.text();
    if (!/<html\b/i.test(html.slice(0, 5000))) {
      throw new Error(`Minnesota Revisor bill status HTML returned an unexpected document: ${statusHtmlUrl}`);
    }
    return html;
  }
  if (lastTransportError instanceof Error) throw lastTransportError;
  throw new Error(`Minnesota Revisor bill status HTML retry budget exhausted: ${statusHtmlUrl}`);
}

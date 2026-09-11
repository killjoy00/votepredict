import { parseRevisorOfficialActions } from './revisor-actions';
import { getMinnesotaHouseSession } from './sessions';

export interface RevisorInitialDocument {
  documentName: string | null;
  insertedAt: string | null;
  insertedOn: string | null;
  htmlUrl: string | null;
  engrossment: number;
}

export interface RevisorIntroductionMetadata {
  identifier: string;
  sourceChamber: 'house' | 'senate';
  introducedOn: string | null;
  initialDocument: RevisorInitialDocument | null;
  initialDocumentKnownByIntroduction: boolean;
  currentCompanionIdentifier: string | null;
  companionModelEligible: false;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string | null {
  const pattern = new RegExp(`<(?:[A-Z0-9_.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Z0-9_.-]+:)?${name}>`, 'i');
  const match = block.match(pattern);
  return match ? decodeXml(match[1]) || null : null;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = value.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  return us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : null;
}

function absoluteHttps(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/^https:\/\//i.test(normalized)) return normalized;
  if (/^http:\/\//i.test(normalized)) return normalized.replace(/^http:/i, 'https:');
  if (/^[a-z0-9.-]+\//i.test(normalized)) return `https://${normalized}`;
  return new URL(normalized, 'https://www.revisor.mn.gov').toString();
}

function normalizeIdentifier(identifier: string): string {
  const match = identifier.trim().match(/^(HF|SF)\s*0*(\d+)$/i);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier: ${identifier}`);
  return `${match[1].toUpperCase()}${Number(match[2])}`;
}

export function buildRevisorRegularSessionStatusXmlUrls(sessionKeyOrSlug: string, rawIdentifier: string): string[] {
  const session = getMinnesotaHouseSession(sessionKeyOrSlug);
  const identifier = normalizeIdentifier(rawIdentifier);
  const match = identifier.match(/^(HF|SF)(\d+)$/);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier: ${rawIdentifier}`);
  const firstYear = Number(session.startsOn.slice(0, 4));
  return [firstYear, firstYear + 1].map(
    (year) => `https://api.revisor.mn.gov/bills/v1/${session.legislature}/${year}/0/${match[1]}/${Number(match[2])}/`,
  );
}

export function buildRevisorRegularSessionStatusXmlUrl(sessionKeyOrSlug: string, rawIdentifier: string): string {
  return buildRevisorRegularSessionStatusXmlUrls(sessionKeyOrSlug, rawIdentifier)[0];
}

export function parseRevisorInitialDocument(xml: string): RevisorInitialDocument | null {
  const list = xml.match(/<(?:[A-Z0-9_.-]+:)?TEXT_VERSION_LIST\b[^>]*>([\s\S]*?)<\/(?:[A-Z0-9_.-]+:)?TEXT_VERSION_LIST>/i)?.[1];
  if (!list) return null;

  const documents: RevisorInitialDocument[] = [];
  for (const match of list.matchAll(/<(?:[A-Z0-9_.-]+:)?DOCUMENT\b[^>]*>([\s\S]*?)<\/(?:[A-Z0-9_.-]+:)?DOCUMENT>/gi)) {
    const block = match[1];
    const engrossmentText = tag(block, 'DOCUMENT_ENGROSSMENT');
    const engrossment = engrossmentText === null ? Number.NaN : Number(engrossmentText);
    if (!Number.isInteger(engrossment) || engrossment !== 0) continue;
    const insertedAt = tag(block, 'DATE_INSERT');
    documents.push({
      documentName: tag(block, 'DOCUMENT_NAME'),
      insertedAt,
      insertedOn: isoDate(insertedAt),
      htmlUrl: absoluteHttps(tag(block, 'HTML_URI')),
      engrossment,
    });
  }

  documents.sort((left, right) => (left.insertedAt ?? '').localeCompare(right.insertedAt ?? ''));
  return documents[0] ?? null;
}

export function parseRevisorCurrentCompanionIdentifier(xml: string): string | null {
  const type = tag(xml, 'COMPANION_TYPE')?.toUpperCase();
  const number = Number(tag(xml, 'COMPANION_NUMBER'));
  if ((type !== 'HF' && type !== 'SF') || !Number.isInteger(number) || number <= 0) return null;
  return `${type}${number}`;
}

export function parseRevisorIntroductionMetadata(input: {
  xml: string;
  identifier: string;
}): RevisorIntroductionMetadata {
  const identifier = normalizeIdentifier(input.identifier);
  const sourceChamber = identifier.startsWith('HF') ? 'house' : 'senate';
  const introductionActions = parseRevisorOfficialActions(input.xml)
    .filter((action) => action.chamber === sourceChamber)
    .filter((action) => /\bintroduction\b[\s\S]*\bfirst reading\b/i.test(action.description))
    .filter((action) => action.occurredOn !== null)
    .sort((left, right) => (left.occurredOn ?? '').localeCompare(right.occurredOn ?? ''));
  const introducedOn = introductionActions[0]?.occurredOn ?? null;
  const initialDocument = parseRevisorInitialDocument(input.xml);
  const initialDocumentKnownByIntroduction = Boolean(
    introducedOn && initialDocument?.insertedOn && initialDocument.insertedOn <= introducedOn,
  );

  return {
    identifier,
    sourceChamber,
    introducedOn,
    initialDocument,
    initialDocumentKnownByIntroduction,
    currentCompanionIdentifier: parseRevisorCurrentCompanionIdentifier(input.xml),
    // The full status record reflects current companion state. Until a dated source proves
    // the relationship existed by introduction, it is context-only and excluded from modeling.
    companionModelEligible: false,
  };
}

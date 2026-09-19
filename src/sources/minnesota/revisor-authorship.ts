import { parseRevisorOfficialActions, type RevisorActionChamber } from './revisor-actions';

export const REVISOR_AUTHORSHIP_PARSER_VERSION = 'revisor-authorship-v1' as const;

export type RevisorAuthorshipOperation = 'add' | 'strike';

export interface RevisorCurrentAuthor {
  chamber: Exclude<RevisorActionChamber, null>;
  name: string;
}

export interface RevisorAuthorAction {
  chamber: Exclude<RevisorActionChamber, null>;
  occurredOn: string;
  operation: RevisorAuthorshipOperation;
  names: string[];
  chiefAuthor: boolean;
  description: string;
}

export interface RevisorAuthorshipRecord {
  currentAuthors: RevisorCurrentAuthor[];
  actions: RevisorAuthorAction[];
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
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
  const match = block.match(new RegExp(
    `<(?:[A-Z0-9_.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Z0-9_.-]+:)?${name}>`,
    'i',
  ));
  return match ? decodeXml(match[1]) || null : null;
}

function authorBlocks(block: string): string[] {
  return [...block.matchAll(/<(?:[A-Z0-9_.-]+:)?AUTHOR\b[^>]*>([\s\S]*?)<\/(?:[A-Z0-9_.-]+:)?AUTHOR>/gi)]
    .map((match) => match[1]);
}

function authorName(block: string): string | null {
  const composite = [tag(block, 'LAST_NAME'), tag(block, 'FIRST_NAME')].filter(Boolean).join(', ');
  return tag(block, 'AUTHOR_NAME')
    ?? tag(block, 'NAME')
    ?? (composite || null);
}

function sourceChamber(identifier: string): 'house' | 'senate' {
  return identifier.trim().toUpperCase().startsWith('HF') ? 'house' : 'senate';
}

export function parseRevisorCurrentAuthors(input: {
  xml: string;
  identifier: string;
}): RevisorCurrentAuthor[] {
  const authorsRoot = input.xml.match(
    /<(?:[A-Z0-9_.-]+:)?AUTHORS\b[^>]*>([\s\S]*?)<\/(?:[A-Z0-9_.-]+:)?AUTHORS>/i,
  )?.[1];
  if (!authorsRoot) return [];

  const rows: RevisorCurrentAuthor[] = [];
  let chamberSections = 0;
  for (const [tagName, chamber] of [['HOUSE', 'house'], ['SENATE', 'senate']] as const) {
    const pattern = new RegExp(
      `<(?:[A-Z0-9_.-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Z0-9_.-]+:)?${tagName}>`,
      'gi',
    );
    for (const match of authorsRoot.matchAll(pattern)) {
      chamberSections += 1;
      for (const block of authorBlocks(match[1])) {
        const name = authorName(block);
        if (name) rows.push({ chamber, name });
      }
    }
  }

  if (chamberSections === 0) {
    const chamber = sourceChamber(input.identifier);
    for (const block of authorBlocks(authorsRoot)) {
      const name = authorName(block);
      if (name) rows.push({ chamber, name });
    }
  }

  const dedupe = new Map<string, RevisorCurrentAuthor>();
  for (const row of rows) dedupe.set(`${row.chamber}|${row.name.toLowerCase()}`, row);
  return [...dedupe.values()];
}

function cleanAuthorTail(value: string): { namesText: string; chiefAuthor: boolean } {
  const chiefAuthor = /\bas\s+chief\s+author\b/i.test(value);
  return {
    namesText: value
      .replace(/\bas\s+chief\s+author\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.;]+$/, ''),
    chiefAuthor,
  };
}

export function splitRevisorAuthorNames(value: string): string[] {
  const cleaned = value
    .replace(/^\s*(?:and|&)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const semicolonParts = cleaned.includes(';')
    ? cleaned.split(';')
    : cleaned.split(/\s+(?:and|&)\s+/i);

  return semicolonParts
    .map((part) => part.replace(/^\s*(?:and|&)\s+/i, '').replace(/[.;]+$/, '').trim())
    .filter(Boolean);
}

export function parseRevisorAuthorActions(xml: string): RevisorAuthorAction[] {
  const rows: RevisorAuthorAction[] = [];
  for (const action of parseRevisorOfficialActions(xml)) {
    if (!action.chamber || !action.occurredOn) continue;
    const match = action.description.match(/\bauthors?\s+(added|stricken)\s+(.+)$/i);
    if (!match) continue;
    const { namesText, chiefAuthor } = cleanAuthorTail(match[2]);
    const names = splitRevisorAuthorNames(namesText);
    if (names.length === 0) continue;
    rows.push({
      chamber: action.chamber,
      occurredOn: action.occurredOn,
      operation: match[1].toLowerCase() === 'added' ? 'add' : 'strike',
      names,
      chiefAuthor,
      description: action.description,
    });
  }
  return rows.sort((left, right) => left.occurredOn.localeCompare(right.occurredOn)
    || left.chamber.localeCompare(right.chamber)
    || left.description.localeCompare(right.description));
}

export function parseRevisorAuthorship(input: {
  xml: string;
  identifier: string;
}): RevisorAuthorshipRecord {
  return {
    currentAuthors: parseRevisorCurrentAuthors(input),
    actions: parseRevisorAuthorActions(input.xml),
  };
}

function canonicalAuthorName(value: string): string {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function revisorAuthorNamesAsOf(input: {
  currentAuthors: readonly string[];
  actions: readonly Pick<RevisorAuthorAction, 'occurredOn' | 'operation' | 'names'>[];
  asOfDateExclusive: string;
}): string[] {
  const authors = new Map<string, string>();
  for (const name of input.currentAuthors) authors.set(canonicalAuthorName(name), name);

  const later = input.actions
    .filter((action) => action.occurredOn >= input.asOfDateExclusive)
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));

  for (const action of later) {
    for (const name of action.names) {
      const key = canonicalAuthorName(name);
      if (action.operation === 'add') authors.delete(key);
      else authors.set(key, name);
    }
  }
  return [...authors.values()].sort((left, right) => canonicalAuthorName(left).localeCompare(canonicalAuthorName(right)));
}

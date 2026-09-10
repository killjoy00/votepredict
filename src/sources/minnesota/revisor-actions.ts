export type RevisorActionChamber = 'house' | 'senate' | null;

export interface RevisorOfficialAction {
  chamber: RevisorActionChamber;
  occurredOn: string | null;
  description: string;
  fields: Record<string, string>;
}

export interface RevisorActionAudit {
  sourceChamber: Exclude<RevisorActionChamber, null>;
  sourceChamberPassed: boolean;
  sourceChamberFailed: boolean;
  classifiedActions: number;
  unclassifiedActions: number;
  passageActions: RevisorOfficialAction[];
  actions: RevisorOfficialAction[];
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

function parseLeafFields(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of block.matchAll(/<(?:[A-Z0-9_.-]+:)?([A-Z][A-Z0-9_]*)\b[^>]*>([\s\S]*?)<\/(?:[A-Z0-9_.-]+:)?\1>/gi)) {
    if (/<(?:[A-Z0-9_.-]+:)?[A-Z][A-Z0-9_]*\b/i.test(match[2])) continue;
    const value = decodeXml(match[2]);
    if (value) fields[match[1].toUpperCase()] = value;
  }
  return fields;
}

function chamberFromFields(fields: Record<string, string>): RevisorActionChamber {
  for (const [key, value] of Object.entries(fields)) {
    if (!/(?:BODY|CHAMBER|LOCATION|HOUSE_SENATE)/i.test(key)) continue;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'house' || normalized.includes('house of representatives')) return 'house';
    if (normalized === 'senate' || normalized.includes('senate')) return 'senate';
  }
  return null;
}

function isoDate(value: string): string | null {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = value.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return null;
}

function dateFromFields(fields: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (!/DATE/i.test(key)) continue;
    const parsed = isoDate(value);
    if (parsed) return parsed;
  }
  return null;
}

function descriptionFromFields(fields: Record<string, string>): string {
  const preferred = ['ACTION_DESCRIPTION', 'DESCRIPTION', 'ACTION_TEXT', 'STATUS_TEXT', 'TEXT'];
  for (const key of preferred) {
    if (fields[key]) return fields[key];
  }
  return Object.entries(fields)
    .filter(([key]) => !/(?:KEY|DATE|PAGE|BODY|CHAMBER|LOCATION|JOURNAL|SEQUENCE|NUMBER|ID|URI|URL)/i.test(key))
    .map(([, value]) => value)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPassagePositive(description: string): boolean {
  const text = description.toLowerCase();
  if (/\b(?:not|never) passed\b/.test(text)) return false;
  return /\bbill was (?:re)?passed\b/.test(text)
    || /\bthird reading (?:was )?(?:passed|repassed)\b/.test(text)
    || /\b(?:house|senate) concurred and repassed bill\b/.test(text)
    || /\bthird reading passed as amended\b/.test(text);
}

function isPassageNegative(description: string): boolean {
  const text = description.toLowerCase();
  return /\bbill was not passed\b/.test(text)
    || /\bthird reading (?:failed|not passed)\b/.test(text)
    || /\bfailed (?:final )?passage\b/.test(text)
    || /\bfailed to pass\b/.test(text);
}

export function parseRevisorOfficialActions(xml: string): RevisorOfficialAction[] {
  const actions: RevisorOfficialAction[] = [];
  for (const match of xml.matchAll(/<(?:[A-Z0-9_.-]+:)?ACTION\b[^>]*>([\s\S]*?)<\/(?:[A-Z0-9_.-]+:)?ACTION>/gi)) {
    const fields = parseLeafFields(match[1]);
    const description = descriptionFromFields(fields);
    if (!description && Object.keys(fields).length === 0) continue;
    actions.push({
      chamber: chamberFromFields(fields),
      occurredOn: dateFromFields(fields),
      description,
      fields,
    });
  }
  return actions;
}

export function auditRevisorSourceChamberPassage(input: {
  xml: string;
  identifier: string;
}): RevisorActionAudit {
  const sourceChamber = input.identifier.trim().toUpperCase().startsWith('HF') ? 'house' : 'senate';
  const actions = parseRevisorOfficialActions(input.xml);
  const sourceActions = actions.filter((action) => action.chamber === sourceChamber);
  const passageActions = sourceActions.filter((action) => isPassagePositive(action.description) || isPassageNegative(action.description));
  return {
    sourceChamber,
    sourceChamberPassed: passageActions.some((action) => isPassagePositive(action.description)),
    sourceChamberFailed: !passageActions.some((action) => isPassagePositive(action.description))
      && passageActions.some((action) => isPassageNegative(action.description)),
    classifiedActions: actions.filter((action) => action.chamber !== null).length,
    unclassifiedActions: actions.filter((action) => action.chamber === null).length,
    passageActions,
    actions,
  };
}

export function normalizeRevisorStatusXmlUrl(value: string): string {
  const input = value.trim();
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input.replace(/^\/+/, '')}`;
  const url = new URL(withScheme);
  if (url.hostname.toLowerCase() === 'api.revisor.mn.gov') {
    url.protocol = 'https:';
    return url.toString();
  }

  const match = url.pathname.match(/^\/bills\/(\d+)\/(\d{4})\/(\d+)\/(HF|SF)\/(\d+)\/?$/i);
  if (url.hostname.toLowerCase() === 'www.revisor.mn.gov' && match) {
    const [, legislature, year, sessionType, fileType, fileNumber] = match;
    return `https://api.revisor.mn.gov/bills/v1/${legislature}/${year}/${sessionType}/${fileType.toUpperCase()}/${fileNumber}/`;
  }
  return url.toString();
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchRevisorStatusXml(statusXmlUrl: string): Promise<string> {
  const apiUrl = normalizeRevisorStatusXmlUrl(statusXmlUrl);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'VotePredict/2.0 official Minnesota action-history audit',
        Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
      },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
      redirect: 'follow',
    });
    if (response.status === 429 && attempt < 2) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`Minnesota Revisor bill status returned ${response.status}: ${apiUrl}`);
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    if (/<!doctype\s+html|<html\b/i.test(text.slice(0, 1000))) {
      throw new Error(`Minnesota Revisor XML endpoint returned HTML (${contentType || 'unknown content type'}): ${apiUrl}`);
    }
    if (!/<(?:[A-Z0-9_.-]+:)?BILL\b/i.test(text)) {
      throw new Error(`Minnesota Revisor XML endpoint returned an unexpected document (${contentType || 'unknown content type'}): ${apiUrl}`);
    }
    return text;
  }
  throw new Error(`Minnesota Revisor bill status retry budget exhausted: ${apiUrl}`);
}

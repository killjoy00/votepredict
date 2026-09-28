export const HISTORICAL_FISCAL_NOTE_PARSER_VERSION =
  'historical-fiscal-note-search-v3' as const;

export const HISTORICAL_FISCAL_NOTE_SOURCE_POLICY =
  'lbo-webforms-session-snapshot-complete-date-plus-1-day-v3' as const;

export const HISTORICAL_FISCAL_NOTE_PUBLICATION_POLICY_URL =
  'https://www.lrl.mn.gov/docs/2020/Other/201132.pdf' as const;

export interface HistoricalFiscalNoteRow {
  billIdentifier: string;
  version: string;
  title: string;
  noteType: string;
  author: string;
  completeDate: string;
  availableOn: string;
}

export interface HistoricalFiscalNoteSearchForm {
  method: 'post';
  action: string;
  hiddenFields: Record<string, string>;
  sessionFieldName: string;
  sessionValue: string;
  billNumberFieldName: string;
  titleFieldName: string;
  searchEventTarget: string;
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)));
}

function text(value: string): string {
  return decode(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function attributeValue(attributes: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
  const quoted = attributes.match(new RegExp(
    '(?:^|\\s)' + escaped + '\\s*=\\s*(["\\\'])([\\s\\S]*?)\\1',
    'i',
  ));
  if (quoted?.[2] !== undefined) return decode(quoted[2]);
  const bare = attributes.match(new RegExp('(?:^|\\s)' + escaped + '\\s*=\\s*([^\\s>]+)', 'i'));
  return bare?.[1] ? decode(bare[1]) : undefined;
}

function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => text(match[1]));
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

function normalizeBillIdentifier(value: string): string | undefined {
  const match = text(value).toUpperCase().match(/\b(HF|SF)\s*0*(\d{1,5})\b/);
  if (!match) return undefined;
  return match[1] + String(Number(match[2]));
}

function numericDateIso(value: string): string | undefined {
  const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return undefined;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (
    !Number.isInteger(month) || month < 1 || month > 12
    || !Number.isInteger(day) || day < 1 || day > 31
    || !Number.isInteger(year)
  ) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return date.toISOString().slice(0, 10);
}

export function historicalFiscalNoteAvailableOn(completeDate: string): string {
  const date = new Date(completeDate + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== completeDate) {
    throw new Error('Historical fiscal-note complete date must be ISO YYYY-MM-DD');
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function parseHistoricalFiscalNoteSearchForm(
  html: string,
  startYear: number,
): HistoricalFiscalNoteSearchForm {
  const formMatch = html.match(/<form\b([^>]*)>/i);
  if (!formMatch) throw new Error('Fiscal-note search form is missing');
  const method = attributeValue(formMatch[1], 'method')?.toLowerCase();
  if (method !== 'post') throw new Error('Fiscal-note search form must use POST');
  const action = attributeValue(formMatch[1], 'action');
  if (!action) throw new Error('Fiscal-note search form action is missing');

  const hiddenFields: Record<string, string> = {};
  let billNumberFieldName: string | undefined;
  let titleFieldName: string | undefined;
  for (const input of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attributes = input[1];
    const name = attributeValue(attributes, 'name');
    if (!name) continue;
    const type = attributeValue(attributes, 'type')?.toLowerCase() ?? 'text';
    const id = attributeValue(attributes, 'id') ?? '';
    if (type === 'hidden') hiddenFields[name] = attributeValue(attributes, 'value') ?? '';
    if (id === 'cpContent_txtBillNbr') billNumberFieldName = name;
    if (id === 'cpContent_txtTitle') titleFieldName = name;
  }
  for (const required of ['__VIEWSTATE', '__EVENTVALIDATION']) {
    if (!Object.hasOwn(hiddenFields, required) || !hiddenFields[required]) {
      throw new Error('Fiscal-note search form is missing ' + required);
    }
  }
  if (!billNumberFieldName || !titleFieldName) {
    throw new Error('Fiscal-note search form bill/title inputs are missing');
  }

  let sessionFieldName: string | undefined;
  let sessionValue: string | undefined;
  for (const select of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const id = attributeValue(select[1], 'id');
    if (id !== 'cpContent_ddlLeg') continue;
    sessionFieldName = attributeValue(select[1], 'name');
    const expected = String(startYear);
    for (const option of select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
      const value = attributeValue(option[1], 'value');
      if (value === expected) {
        sessionValue = value;
        break;
      }
    }
    break;
  }
  if (!sessionFieldName || !sessionValue) {
    throw new Error('Fiscal-note search form does not expose requested legislative session');
  }

  let searchEventTarget: string | undefined;
  for (const anchor of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/^Search$/i.test(text(anchor[2]))) continue;
    const href = attributeValue(anchor[1], 'href') ?? '';
    const options = href.match(/WebForm_PostBackOptions\("([^"]+)"/i);
    const direct = href.match(/__doPostBack\('([^']+)'/i);
    searchEventTarget = options?.[1] ?? direct?.[1];
    if (searchEventTarget) break;
  }
  if (!searchEventTarget) throw new Error('Fiscal-note search postback target is missing');

  return {
    method: 'post',
    action,
    hiddenFields,
    sessionFieldName,
    sessionValue,
    billNumberFieldName,
    titleFieldName,
    searchEventTarget,
  };
}

export function buildHistoricalFiscalNoteSearchPostBody(
  form: HistoricalFiscalNoteSearchForm,
): string {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(form.hiddenFields)) body.set(name, value);
  body.set('__EVENTTARGET', form.searchEventTarget);
  body.set('__EVENTARGUMENT', '');
  body.set(form.sessionFieldName, form.sessionValue);
  body.set(form.billNumberFieldName, '');
  body.set(form.titleFieldName, '');
  return body.toString();
}

export function parseHistoricalFiscalNoteRecordCount(html: string): number | undefined {
  const compact = text(html);
  const match = compact.match(/\bRecord\s+Count:\s*([0-9,]+)\b/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function parseHistoricalFiscalNoteSearchRows(
  html: string,
): HistoricalFiscalNoteRow[] {
  const rows: HistoricalFiscalNoteRow[] = [];
  for (const cells of tableRows(html)) {
    if (cells.length < 5) continue;
    const billIdentifier = normalizeBillIdentifier(cells[0]);
    if (!billIdentifier) continue;

    const versionMatch = cells[0].match(/-\s*([^|]+?)\s*$/);
    const version = versionMatch?.[1]?.trim();
    const completeDate = numericDateIso(cells[4] ?? '');
    if (!version || !completeDate) continue;

    rows.push({
      billIdentifier,
      version,
      title: cells[1]?.trim() ?? '',
      noteType: cells[2]?.trim() ?? '',
      author: cells[3]?.trim() ?? '',
      completeDate,
      availableOn: historicalFiscalNoteAvailableOn(completeDate),
    });
  }

  const unique = new Map<string, HistoricalFiscalNoteRow>();
  for (const row of rows) {
    unique.set(
      [row.billIdentifier, row.version, row.completeDate, row.title, row.noteType, row.author].join('|'),
      row,
    );
  }
  return [...unique.values()].sort((left, right) =>
    left.billIdentifier.localeCompare(right.billIdentifier)
    || left.completeDate.localeCompare(right.completeDate)
    || left.version.localeCompare(right.version));
}

export function parseHistoricalFiscalNoteSearch(
  html: string,
  expectedBillIdentifier: string,
): HistoricalFiscalNoteRow[] {
  const expected = normalizeBillIdentifier(expectedBillIdentifier);
  if (!expected) throw new Error('Unsupported historical fiscal-note bill identifier');
  return parseHistoricalFiscalNoteSearchRows(html)
    .filter((row) => row.billIdentifier === expected);
}

export const HISTORICAL_FISCAL_NOTE_PARSER_VERSION =
  'historical-fiscal-note-search-v1' as const;

export const HISTORICAL_FISCAL_NOTE_SOURCE_POLICY =
  'lbo-complete-date-plus-1-day-publication-v1' as const;

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

export function parseHistoricalFiscalNoteRecordCount(html: string): number | undefined {
  const compact = text(html);
  const match = compact.match(/\bRecord\s+Count:\s*([0-9,]+)\b/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function parseHistoricalFiscalNoteSearch(
  html: string,
  expectedBillIdentifier: string,
): HistoricalFiscalNoteRow[] {
  const expected = normalizeBillIdentifier(expectedBillIdentifier);
  if (!expected) throw new Error('Unsupported historical fiscal-note bill identifier');

  const rows: HistoricalFiscalNoteRow[] = [];
  for (const cells of tableRows(html)) {
    if (cells.length < 5) continue;
    const billIdentifier = normalizeBillIdentifier(cells[0]);
    if (!billIdentifier || billIdentifier !== expected) continue;

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
    left.completeDate.localeCompare(right.completeDate)
    || left.version.localeCompare(right.version));
}

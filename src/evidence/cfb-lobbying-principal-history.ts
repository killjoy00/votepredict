import { createHash } from 'node:crypto';

export const CFB_LOBBYING_PRINCIPAL_HISTORY_VERSION = 'mn-cfb-lobbying-principal-v1' as const;
export const CFB_LOBBYING_PRINCIPAL_DOWNLOAD_URL =
  'https://register.cfb.mn.gov/reports-and-data/self-help/data-downloads/lobbying/?download=-728390027';

export interface CfbLobbyingPrincipalRow {
  principal: string;
  entityId: string;
  reportYear: number;
  pucLobbyingAmount: number;
  legislativeLobbyingAmount: number;
  administrativeLobbyingAmount: number;
  mguLobbyingAmount: number;
  generalLobbyingAmount: number;
  totalSpent: number;
  rowKey: string;
}

export interface ParseCfbLobbyingPrincipalOptions {
  fromYear?: number;
  toYear?: number;
}

const EXPECTED_HEADERS = [
  'Principal',
  'Entity ID',
  'Report Year',
  'PUC lobbying amount',
  'Legislative lobbying amount',
  'Administrative lobbying amount',
  'MGU lobbying amount',
  'General lobbying amount',
  'Total spent',
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function amount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const negativeParens = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[\s$,()]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid CFB lobbying amount: ${value}`);
  return negativeParens ? -parsed : parsed;
}

function rowKey(row: Omit<CfbLobbyingPrincipalRow, 'rowKey'>): string {
  return createHash('sha256').update(JSON.stringify([
    row.entityId,
    row.reportYear,
    row.principal,
    row.pucLobbyingAmount,
    row.legislativeLobbyingAmount,
    row.administrativeLobbyingAmount,
    row.mguLobbyingAmount,
    row.generalLobbyingAmount,
    row.totalSpent,
  ])).digest('hex');
}

export function parseCfbLobbyingPrincipalCsv(
  text: string,
  options: ParseCfbLobbyingPrincipalOptions = {},
): CfbLobbyingPrincipalRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('CFB lobbying principal CSV is empty');

  const header = rows[0].map(normalizeHeader);
  const expected = EXPECTED_HEADERS.map(normalizeHeader);
  if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
    throw new Error(`Unexpected CFB lobbying principal header: ${rows[0].join(' | ')}`);
  }

  const fromYear = options.fromYear ?? Number.NEGATIVE_INFINITY;
  const toYear = options.toYear ?? Number.POSITIVE_INFINITY;
  const parsedRows: CfbLobbyingPrincipalRow[] = [];

  for (const raw of rows.slice(1)) {
    if (raw.every(value => !value.trim())) continue;
    if (raw.length !== EXPECTED_HEADERS.length) {
      throw new Error(`Unexpected CFB lobbying principal column count: ${raw.length}`);
    }
    const principal = raw[0].trim();
    const entityId = raw[1].trim();
    const reportYear = Number.parseInt(raw[2].trim(), 10);
    if (!principal || !entityId || !Number.isInteger(reportYear)) {
      throw new Error('CFB lobbying principal row requires principal, entity ID, and report year');
    }
    if (reportYear < fromYear || reportYear > toYear) continue;

    const base = {
      principal,
      entityId,
      reportYear,
      pucLobbyingAmount: amount(raw[3]),
      legislativeLobbyingAmount: amount(raw[4]),
      administrativeLobbyingAmount: amount(raw[5]),
      mguLobbyingAmount: amount(raw[6]),
      generalLobbyingAmount: amount(raw[7]),
      totalSpent: amount(raw[8]),
    };
    parsedRows.push({ ...base, rowKey: rowKey(base) });
  }

  return parsedRows.sort((left, right) =>
    left.reportYear - right.reportYear
    || left.entityId.localeCompare(right.entityId)
    || left.principal.localeCompare(right.principal)
    || left.rowKey.localeCompare(right.rowKey)
  );
}

export function cfbLobbyingPrincipalContentSha256(rows: readonly CfbLobbyingPrincipalRow[]): string {
  const stable = rows.map(row => [
    row.rowKey,
    row.entityId,
    row.reportYear,
    row.totalSpent,
  ]);
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

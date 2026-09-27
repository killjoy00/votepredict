import { createHash } from 'node:crypto';
import { candidateIdentityFromCommitteeName } from './campaign-finance-live.js';

export const CFB_CANDIDATE_FINANCE_HISTORY_VERSION =
  'mn-cfb-candidate-finance-history-v1' as const;

export type CfbCandidateFinanceKind = 'contribution' | 'expenditure';

interface CfbCandidateFinanceBaseRow {
  rowKey: string;
  kind: CfbCandidateFinanceKind;
  year: number;
  transactionDate: string | null;
  filerRegistrationNumber: string | null;
  committeeName: string;
  candidateName: string | null;
  chamber: 'house' | 'senate' | null;
  amount: number;
  reportName: string | null;
  filedOn: string | null;
  disclosedOn: string | null;
  raw: Record<string, string>;
}

export interface CfbCandidateContributionRow extends CfbCandidateFinanceBaseRow {
  kind: 'contribution';
  contributor: string;
  contributorRegistrationNumber: string | null;
  contributorType: string | null;
  receiptType: string | null;
  employer: string | null;
  inKind: boolean;
  inKindDescription: string | null;
}

export interface CfbCandidateExpenditureRow extends CfbCandidateFinanceBaseRow {
  kind: 'expenditure';
  unpaidAmount: number;
  totalAmount: number;
  vendorName: string | null;
  purpose: string | null;
  expenditureType: string | null;
  affectedCommitteeName: string | null;
  affectedCommitteeRegistrationNumber: string | null;
  inKind: boolean;
  inKindDescription: string | null;
}

export type CfbCandidateFinanceRow =
  | CfbCandidateContributionRow
  | CfbCandidateExpenditureRow;

function parseCsv(text: string, onRow: (row: string[]) => void): void {
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
      onRow(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    onRow(row);
  }
}

function headers(row: string[]): Map<string, number> {
  return new Map(row.map((name, index) => [name.trim().toLowerCase(), index]));
}

function value(row: string[], indexes: Map<string, number>, names: readonly string[]): string {
  for (const name of names) {
    const index = indexes.get(name.toLowerCase());
    if (index === undefined) continue;
    const candidate = (row[index] ?? '').trim();
    if (candidate) return candidate;
  }
  return '';
}

function money(text: string): number {
  const parsed = Number.parseFloat(text.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(text: string): string | null {
  if (!text) return null;
  const direct = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (direct) {
    const normalized = `${direct[1]}-${direct[2].padStart(2, '0')}-${direct[3].padStart(2, '0')}`;
    const parsed = new Date(normalized + 'T00:00:00Z');
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
      ? null
      : normalized;
  }
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!us) return null;
  const year = us[3].length === 2 ? Number(us[3]) + 2000 : Number(us[3]);
  const normalized = `${String(year).padStart(4, '0')}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const parsed = new Date(normalized + 'T00:00:00Z');
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function booleanValue(text: string): boolean {
  return /^(?:1|true|yes|y)$/i.test(text.trim());
}

function stableRowKey(fields: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

function rawRecord(row: string[], indexes: Map<string, number>): Record<string, string> {
  return Object.fromEntries([...indexes.entries()].map(([name, index]) => [name, row[index] ?? '']));
}

function timing(row: string[], indexes: Map<string, number>) {
  return {
    reportName: value(row, indexes, ['Report name', 'Report', 'Report type', 'Filing type']) || null,
    filedOn: normalizeDate(value(row, indexes, ['Filed date', 'Filing date', 'Date filed'])),
    disclosedOn: normalizeDate(value(row, indexes, [
      'Disclosure date',
      'Disclosed date',
      'Date disclosed',
      'Public date',
      'Published date',
      'Date published',
    ])),
  };
}

export function parseCfbCandidateContributionCsv(
  text: string,
  input: { fromYear?: number; toYear?: number } = {},
): CfbCandidateContributionRow[] {
  let indexes: Map<string, number> | undefined;
  const rows: CfbCandidateContributionRow[] = [];
  parseCsv(text, (rawRow) => {
    if (!indexes) {
      indexes = headers(rawRow);
      return;
    }
    const year = Number(value(rawRow, indexes, ['Year']));
    if (!Number.isFinite(year)) return;
    if (input.fromYear !== undefined && year < input.fromYear) return;
    if (input.toYear !== undefined && year > input.toYear) return;

    const committeeName = value(rawRow, indexes, ['Recipient']);
    if (!committeeName) return;
    const identity = candidateIdentityFromCommitteeName(committeeName);
    const filerRegistrationNumber = value(rawRow, indexes, ['Recipient reg num']) || null;
    const transactionDate = normalizeDate(value(rawRow, indexes, ['Receipt date']));
    const contributor = value(rawRow, indexes, ['Contributor']) || 'Unknown';
    const contributorRegistrationNumber = value(rawRow, indexes, ['Contrib Reg Num']) || null;
    const contributorType = value(rawRow, indexes, ['Contrib type']) || null;
    const receiptType = value(rawRow, indexes, ['Receipt type']) || null;
    const employer = value(rawRow, indexes, ['Contrib Employer name']) || null;
    const inKind = booleanValue(value(rawRow, indexes, ['In kind?', 'In-kind?']));
    const inKindDescription = value(rawRow, indexes, ['In-kind descr', 'In kind descr']) || null;
    const amount = money(value(rawRow, indexes, ['Amount']));
    const reportTiming = timing(rawRow, indexes);

    const core = {
      kind: 'contribution' as const,
      year,
      transactionDate,
      filerRegistrationNumber,
      committeeName,
      candidateName: identity?.candidateName ?? null,
      chamber: identity?.chamber ?? null,
      amount,
      contributor,
      contributorRegistrationNumber,
      contributorType,
      receiptType,
      employer,
      inKind,
      inKindDescription,
    };
    rows.push({
      ...core,
      ...reportTiming,
      rowKey: stableRowKey(core),
      raw: rawRecord(rawRow, indexes),
    });
  });
  return rows.sort((left, right) =>
    left.year - right.year
    || (left.transactionDate ?? '').localeCompare(right.transactionDate ?? '')
    || left.committeeName.localeCompare(right.committeeName)
    || left.contributor.localeCompare(right.contributor)
    || left.rowKey.localeCompare(right.rowKey));
}

export function parseCfbCandidateExpenditureCsv(
  text: string,
  input: { fromYear?: number; toYear?: number } = {},
): CfbCandidateExpenditureRow[] {
  let indexes: Map<string, number> | undefined;
  const rows: CfbCandidateExpenditureRow[] = [];
  parseCsv(text, (rawRow) => {
    if (!indexes) {
      indexes = headers(rawRow);
      return;
    }
    const year = Number(value(rawRow, indexes, ['Year']));
    if (!Number.isFinite(year)) return;
    if (input.fromYear !== undefined && year < input.fromYear) return;
    if (input.toYear !== undefined && year > input.toYear) return;

    const committeeName = value(rawRow, indexes, ['Committee name', 'Committee', 'Filer name']);
    if (!committeeName) return;
    const identity = candidateIdentityFromCommitteeName(committeeName);
    const filerRegistrationNumber = value(rawRow, indexes, [
      'Committee reg num',
      'Committee registration number',
      'Registration number',
    ]) || null;
    const transactionDate = normalizeDate(value(rawRow, indexes, ['Date', 'Expenditure date']));
    const amount = money(value(rawRow, indexes, ['Amount']));
    const unpaidAmount = money(value(rawRow, indexes, ['Unpaid amount']));
    const vendorName = value(rawRow, indexes, ['Vendor name', 'Payee', 'Recipient', 'Vendor']) || null;
    const purpose = value(rawRow, indexes, ['Purpose']) || null;
    const expenditureType = value(rawRow, indexes, ['Type']) || null;
    const affectedCommitteeName = value(rawRow, indexes, ['Affected committee name', 'Affected Comte Name']) || null;
    const affectedCommitteeRegistrationNumber = value(rawRow, indexes, [
      'Affected committee reg num',
      'Affected Cmte Reg Num',
    ]) || null;
    const inKind = booleanValue(value(rawRow, indexes, ['In-kind?', 'In kind?']));
    const inKindDescription = value(rawRow, indexes, ['In-kind descr', 'In kind descr']) || null;
    const reportTiming = timing(rawRow, indexes);

    const core = {
      kind: 'expenditure' as const,
      year,
      transactionDate,
      filerRegistrationNumber,
      committeeName,
      candidateName: identity?.candidateName ?? null,
      chamber: identity?.chamber ?? null,
      amount,
      unpaidAmount,
      totalAmount: Number((amount + unpaidAmount).toFixed(2)),
      vendorName,
      purpose,
      expenditureType,
      affectedCommitteeName,
      affectedCommitteeRegistrationNumber,
      inKind,
      inKindDescription,
    };
    rows.push({
      ...core,
      ...reportTiming,
      rowKey: stableRowKey(core),
      raw: rawRecord(rawRow, indexes),
    });
  });
  return rows.sort((left, right) =>
    left.year - right.year
    || (left.transactionDate ?? '').localeCompare(right.transactionDate ?? '')
    || left.committeeName.localeCompare(right.committeeName)
    || (left.vendorName ?? '').localeCompare(right.vendorName ?? '')
    || left.rowKey.localeCompare(right.rowKey));
}

export function sessionForCandidateFinanceYear(year: number): string | null {
  if (year === 2021 || year === 2022) return '2021-2022';
  if (year === 2023 || year === 2024) return '2023-2024';
  if (year === 2025 || year === 2026) return '2025-2026';
  return null;
}

export function candidateFinanceContentSha256(rows: readonly CfbCandidateFinanceRow[]): string {
  const digest = createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row) + '\n');
  return digest.digest('hex');
}

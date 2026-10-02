export const CFB_LOBBYING_SUMMARY_UPPER_BOUND_VERSION =
  'cfb-lobbying-summary-upper-bound-v1' as const;

export interface LobbyingPrincipalSummaryRow {
  principal: string;
  reportYear: number;
  totalSpent: number;
}

function exactSummaryYear(year: number): number {
  if (!Number.isInteger(year) || year < 2021 || year > 2026) {
    throw new Error('CFB lobbying summary year must be an integer from 2021 through 2026');
  }
  return year;
}

export function cfbLobbyingDisbursementSummaryUrl(year: number): string {
  const y = exactSummaryYear(year);
  return `https://cfb.mn.gov/pdf/publications/reports/lobbyist_disbursement_summaries/lbsm_${y}.pdf`;
}

export function normalizeLobbyingSummaryText(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9$.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lobbyingSummaryIdentityProven(text: string, reportYear: number): boolean {
  const year = String(exactSummaryYear(reportYear));
  const normalized = normalizeLobbyingSummaryText(text);
  if (!normalized.includes('lobbyist principal disbursements')) return false;
  const yearMatches = normalized.match(new RegExp(`(?:^|[^0-9])${year}(?:[^0-9]|$)`, 'g')) ?? [];
  return yearMatches.length >= 3;
}

function amountCandidates(amount: number): string[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const rounded = Math.round(amount);
  const exact = amount.toFixed(2);
  const exactComma = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const integer = rounded.toLocaleString('en-US');
  return [...new Set([
    '$' + exactComma,
    exactComma,
    '$' + integer,
    integer,
    '$' + exact,
    exact,
  ].map(value => value.toLowerCase()))];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function tokenRegex(value: string): RegExp {
  return new RegExp('(?:^| )' + escapeRegex(value) + '(?: |$)', 'g');
}

function numericTokenPresent(text: string, value: string): boolean {
  return new RegExp('(?:^|[^0-9])' + escapeRegex(value) + '(?:[^0-9]|$)').test(text);
}

export function lobbyingSummaryDemonstratesPrincipalRow(
  row: LobbyingPrincipalSummaryRow,
  text: string,
): boolean {
  if (!row.principal.trim() || row.reportYear < 2021 || row.reportYear > 2026) return false;
  if (!lobbyingSummaryIdentityProven(text, row.reportYear)) return false;
  const normalized = normalizeLobbyingSummaryText(text);
  const principal = normalizeLobbyingSummaryText(row.principal)
    .replace(/[$.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (principal.length < 4) return false;

  const searchable = normalized.replace(/[$.,]/g, '').replace(/\s+/g, ' ');
  const amounts = amountCandidates(row.totalSpent)
    .map(value => value.replace(/[$.,]/g, '').replace(/\s+/g, ''))
    .filter(Boolean);
  const principalPattern = tokenRegex(principal);
  for (const match of searchable.matchAll(principalPattern)) {
    const index = match.index ?? 0;
    const afterPrincipal = searchable.slice(
      index + match[0].length,
      Math.min(searchable.length, index + match[0].length + 220),
    );
    const firstAmountLikeToken = afterPrincipal.match(/(?:^| )([0-9]{3,})(?: |$)/)?.[1] ?? null;
    if (firstAmountLikeToken && amounts.includes(firstAmountLikeToken)) return true;
  }
  return false;
}

export const HISTORICAL_EVIDENCE_TWO_CLOCK_VERSION = 'historical-evidence-two-clock-v1' as const;

export type HistoricalEvidenceClock = 'public_availability' | 'underlying_activity';

export interface HistoricalClockRecord {
  /**
   * Date on which the underlying event occurred. For transaction-level finance
   * evidence this is the transaction date.
   */
  activityOn?: string | null;
  /**
   * Conservative date by which the exact row/value is proven public.
   */
  availableOn?: string | null;
  /**
   * Conservative completion date for evidence that summarizes a reporting
   * period rather than a point event. Example: a 2022 annual lobbying total can
   * use 2022-12-31 for retrospective activity-clock analyses of later votes.
   */
  reportingPeriodEndOn?: string | null;
}

export type HistoricalFinanceSubtype =
  | 'candidate_contribution_record'
  | 'candidate_expenditure_record';

export interface HistoricalFinanceRow extends HistoricalClockRecord {
  membershipId: string;
  rowKey: string;
  subtype: HistoricalFinanceSubtype;
  amount: number;
}

export interface HistoricalFinanceTimeline {
  dates: string[];
  contributionCounts: number[];
  contributionAmounts: number[];
  expenditureCounts: number[];
  expenditureAmounts: number[];
}

export interface HistoricalFinanceAsOf {
  available: number;
  contributionCount: number;
  contributionAmount: number;
  expenditureCount: number;
  expenditureAmount: number;
}

function validDateOnly(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function historicalClockDate(
  row: HistoricalClockRecord,
  clock: HistoricalEvidenceClock,
): string | null {
  if (clock === 'public_availability') {
    return validDateOnly(row.availableOn) ? row.availableOn : null;
  }
  if (validDateOnly(row.activityOn)) return row.activityOn;
  return validDateOnly(row.reportingPeriodEndOn) ? row.reportingPeriodEndOn : null;
}

export function isHistoricalEvidenceUsableBefore(
  row: HistoricalClockRecord,
  cutoffDateExclusive: string,
  clock: HistoricalEvidenceClock,
): boolean {
  if (!validDateOnly(cutoffDateExclusive)) {
    throw new Error('cutoffDateExclusive must be a valid YYYY-MM-DD date');
  }
  const effectiveDate = historicalClockDate(row, clock);
  return effectiveDate !== null && effectiveDate < cutoffDateExclusive;
}

export function buildHistoricalFinanceTimelines(
  rows: readonly HistoricalFinanceRow[],
  clock: HistoricalEvidenceClock,
): Map<string, HistoricalFinanceTimeline> {
  const grouped = new Map<string, Array<HistoricalFinanceRow & { effectiveOn: string }>>();
  for (const row of rows) {
    const effectiveOn = historicalClockDate(row, clock);
    if (!effectiveOn) continue;
    const values = grouped.get(row.membershipId) ?? [];
    values.push({ ...row, effectiveOn });
    grouped.set(row.membershipId, values);
  }

  const result = new Map<string, HistoricalFinanceTimeline>();
  for (const [membershipId, values] of grouped) {
    values.sort((left, right) =>
      left.effectiveOn.localeCompare(right.effectiveOn) || left.rowKey.localeCompare(right.rowKey));

    const timeline: HistoricalFinanceTimeline = {
      dates: [],
      contributionCounts: [],
      contributionAmounts: [],
      expenditureCounts: [],
      expenditureAmounts: [],
    };
    let contributionCount = 0;
    let contributionAmount = 0;
    let expenditureCount = 0;
    let expenditureAmount = 0;

    for (const row of values) {
      if (row.subtype === 'candidate_contribution_record') {
        contributionCount += 1;
        contributionAmount += Math.max(0, row.amount);
      } else {
        expenditureCount += 1;
        expenditureAmount += Math.max(0, row.amount);
      }
      timeline.dates.push(row.effectiveOn);
      timeline.contributionCounts.push(contributionCount);
      timeline.contributionAmounts.push(contributionAmount);
      timeline.expenditureCounts.push(expenditureCount);
      timeline.expenditureAmounts.push(expenditureAmount);
    }
    result.set(membershipId, timeline);
  }
  return result;
}

export function historicalFinanceAsOf(
  timeline: HistoricalFinanceTimeline | undefined,
  cutoffDateExclusive: string,
): HistoricalFinanceAsOf {
  if (!validDateOnly(cutoffDateExclusive)) {
    throw new Error('cutoffDateExclusive must be a valid YYYY-MM-DD date');
  }
  if (!timeline || timeline.dates.length === 0) {
    return {
      available: 0,
      contributionCount: 0,
      contributionAmount: 0,
      expenditureCount: 0,
      expenditureAmount: 0,
    };
  }

  let low = 0;
  let high = timeline.dates.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (timeline.dates[mid] < cutoffDateExclusive) low = mid + 1;
    else high = mid;
  }
  const index = low - 1;
  if (index < 0) {
    return {
      available: 0,
      contributionCount: 0,
      contributionAmount: 0,
      expenditureCount: 0,
      expenditureAmount: 0,
    };
  }
  return {
    available: 1,
    contributionCount: timeline.contributionCounts[index],
    contributionAmount: timeline.contributionAmounts[index],
    expenditureCount: timeline.expenditureCounts[index],
    expenditureAmount: timeline.expenditureAmounts[index],
  };
}

export function historicalFinanceFeatures(value: HistoricalFinanceAsOf): number[] {
  return [
    value.available,
    Math.log1p(value.contributionCount),
    Math.log1p(value.contributionAmount),
    Math.log1p(value.expenditureCount),
    Math.log1p(value.expenditureAmount),
  ];
}

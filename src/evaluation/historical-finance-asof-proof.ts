/**
 * #864 strict historical campaign-finance evaluation admission.
 *
 * Legacy asOfEligible/published_at values are assertions, not independent
 * transaction-row publication proof. Neither a due-date floor nor a practical
 * PDF dating estimate certifies a past public-by date. Re-admit only if a
 * separately guarded source-verification process has authenticated the exact
 * row/version and its historical public-by observation, never by copying a
 * legacy eligibility flag.
 *
 * Both historical diagnostic readers use the SQL form. This has no effect on
 * serving or immutable previously published evaluation artifacts.
 */
export const HISTORICAL_FINANCE_PROOF_TYPES = [
  'official_report_exact_version',
  'archived_official_bulk_exact_row',
] as const;

export type HistoricalFinanceAsOfProof = {
  asOfEligible?: string | boolean | null;
  transactionDateIsAvailability?: string | boolean | null;
  transactionDate?: string | null;
  publicationDay?: string | null;
  historicalFinanceIndependentVerification?: string | null;
  historicalFinanceProofType?: string | null;
  historicalFinanceProofDigest?: string | null;
  historicalFinanceVerifiedPublicByOn?: string | null;
  historicalFinanceExactReportVersionId?: string | null;
  historicalFinanceStatutoryFloorOn?: string | null;
  historicalFinanceVerifiedArchiveDigest?: string | null;
  historicalFinanceVerifiedArchiveCaptureOn?: string | null;
};

function isoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/** Returns the conservative certified available DAY or null; the day itself is excluded at cutoff. */
export function certifiedHistoricalFinanceAvailableOn(row: HistoricalFinanceAsOfProof): string | null {
  if (row.asOfEligible !== true && row.asOfEligible !== 'true') return null;
  if (row.transactionDateIsAvailability !== false
    && row.transactionDateIsAvailability !== 'false') return null;
  if (row.historicalFinanceIndependentVerification !== 'authenticated_source_bytes_exact_row') return null;
  if (!/^[a-f0-9]{64}$/.test(row.historicalFinanceProofDigest ?? '')) return null;
  if (!isoDay(row.transactionDate) || !isoDay(row.publicationDay)
    || !isoDay(row.historicalFinanceVerifiedPublicByOn)) return null;
  if (row.historicalFinanceVerifiedPublicByOn < row.transactionDate) return null;

  const kind = row.historicalFinanceProofType;
  let floor = row.historicalFinanceVerifiedPublicByOn;
  if (kind === 'official_report_exact_version') {
    if (!row.historicalFinanceExactReportVersionId || !isoDay(row.historicalFinanceStatutoryFloorOn)) return null;
    if (row.historicalFinanceVerifiedPublicByOn < row.historicalFinanceStatutoryFloorOn) return null;
    floor = row.historicalFinanceStatutoryFloorOn > floor ? row.historicalFinanceStatutoryFloorOn : floor;
  } else if (kind === 'archived_official_bulk_exact_row') {
    if (!row.historicalFinanceVerifiedArchiveDigest
      || !isoDay(row.historicalFinanceVerifiedArchiveCaptureOn)) return null;
    // The authenticated archived copy, not a claimed earlier authoring/filing date,
    // supplies the public-by upper bound for this exact bulk transaction row.
    if (row.historicalFinanceVerifiedPublicByOn < row.historicalFinanceVerifiedArchiveCaptureOn) return null;
    floor = row.historicalFinanceVerifiedArchiveCaptureOn > floor
      ? row.historicalFinanceVerifiedArchiveCaptureOn : floor;
  } else return null;
  return row.publicationDay > floor ? row.publicationDay : floor;
}

/** Fixed SQL equivalent, with only a static table alias supplied by audited readers. */
export function certifiedHistoricalFinanceAvailableOnSql(alias: 'ei' = 'ei'): string {
  const m = alias + '.metadata';
  const val = (key: string) => '(' + m + "->>'" + key + "')";
  const day = "'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'";
  const publishedDay = '(' + alias + ".published_at AT TIME ZONE 'UTC')::date::text";
  const date = (key: string) => val(key) + ' ~ ' + day;
  const verified = val('historicalFinanceVerifiedPublicByOn');
  const transaction = val('transactionDate');
  const reportFloor = val('historicalFinanceStatutoryFloorOn');
  const capture = val('historicalFinanceVerifiedArchiveCaptureOn');
  const report = [
    val('historicalFinanceProofType') + "='official_report_exact_version'",
    "NULLIF(" + val('historicalFinanceExactReportVersionId') + ",'') IS NOT NULL",
    date('historicalFinanceStatutoryFloorOn'),
    verified + '>=' + reportFloor,
  ].join(' AND ');
  const bulk = [
    val('historicalFinanceProofType') + "='archived_official_bulk_exact_row'",
    "NULLIF(" + val('historicalFinanceVerifiedArchiveDigest') + ",'') IS NOT NULL",
    date('historicalFinanceVerifiedArchiveCaptureOn'),
    verified + '>=' + capture,
  ].join(' AND ');
  return [
    '(CASE WHEN ',
    val('asOfEligible') + "='true'",
    ' AND ' + val('transactionDateIsAvailability') + "='false'",
    ' AND ' + alias + '.published_at IS NOT NULL',
    ' AND ' + val('historicalFinanceIndependentVerification') + "='authenticated_source_bytes_exact_row'",
    ' AND ' + val('historicalFinanceProofDigest') + " ~ '^[a-f0-9]{64}$'",
    ' AND ' + date('transactionDate'),
    ' AND ' + date('historicalFinanceVerifiedPublicByOn'),
    ' AND ' + verified + '>=' + transaction,
    ' AND ((' + report + ') OR (' + bulk + '))',
    ' THEN GREATEST(' + publishedDay + ', ' + verified + ')',
    ' ELSE NULL END)',
  ].join('');
}

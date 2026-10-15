import source from '../../data/cfb-senate-official-filings-2021-25-v41.json';
import userReview from '../../data/cfb-2021-25-nine-five-review-dispositions-v45.json';

/**
 * Official indexed filing versions are usable historical CONTEXT even when a
 * scan lacks text or the government lists a senator under a familiar name.
 * Recognition of a source filing never claims that its later amended contents
 * were public before an earlier vote or establishes a statutory filing duty.
 */
export type HistoricalOfficialFilingStatus =
  | 'readable_official_pdf'
  | 'downloaded_pdf_details_unreadable_or_unresolved'
  | 'downloaded_pdf_report_date_conflict'
  | 'official_filing_indexed_pdf_fetch_failed'
  | 'indexed_alias_of_same_pdf'
  | 'official_indexed_pdf_not_yet_retrieved'
  | 'official_pdf_downloaded_unparsed';

export type HistoricalOfficialFilingReviewDisposition =
  | 'annual_receipts_accepted_from_original_pdf_and_board_summary'
  | 'handwritten_receipts_remain_unknown'
  | 'correspondence_attachment_excluded_from_monetary_reconciliation'
  | 'later_of_printed_stamp_or_period_end_used_for_review';

export interface HistoricalOfficialFilingReview {
  versionId: string;
  reviewDisposition: HistoricalOfficialFilingReviewDisposition;
  acceptedTotalReceiptsCents: number | null;
  effectiveReviewOn: string | null;
  originalPrintedBoardReceivedOn?: string;
  originalReportedPeriodEndOn?: string;
}

export interface HistoricalOfficialFiling {
  review?: HistoricalOfficialFilingReview;
  id: string;
  year: number;
  kind: 'original' | 'amended';
  amendment: number;
  status: HistoricalOfficialFilingStatus;
  url: string;
}

export interface HistoricalOfficialFilingContext {
  name: string;
  registrationNumber: string;
  officialNameLink: 'documented_official_name_variant' | 'direct_official_registration';
  servedYears: number[];
  observedVersions: number;
  originalVersions: number;
  amendedVersions: number;
  downloadedVersions: number;
  needsReportTextReview: number;
  viewerUrl: string;
  reportYears: Record<string, number>;
  filings: HistoricalOfficialFiling[];
}

const inventory = source as unknown as {
  schemaVersion: string;
  senators: HistoricalOfficialFilingContext[];
  sourceVerifiedCounts: { distinctDownloadedPDFBodies: number };
};

// Exact official member spelling, punctuation and middle initials can vary by
// membership feed; these normalizations do not infer any new person identity.
function nameKey(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:senator|sen\.)\s+/g, '')
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\b[a-z]\b/g, '')
    .replace(/[^a-z]+/g, '');
}

// V45 overlays the owner's narrowly approved money/date review choices onto
// the source display. The V41 government filing ledger stays byte-for-byte
// unchanged, including official index "amended" labels and original stamps.
const reviewedRows = userReview.resolutions as unknown as HistoricalOfficialFilingReview[];
const byFilingId = new Map(inventory.senators.flatMap(s => s.filings).map(f => [f.id, f]));
const reviewByFilingId = new Map<string, HistoricalOfficialFilingReview>();
for (const resolution of reviewedRows) {
  if (reviewByFilingId.has(resolution.versionId) || !byFilingId.has(resolution.versionId)) {
    throw new Error('V45 duplicate or unknown CFB government report-version review');
  }
  reviewByFilingId.set(resolution.versionId, resolution);
}
if (reviewedRows.length !== 14 || reviewByFilingId.size !== 14) {
  throw new Error('V45 owner-reviewed government source subset incomplete');
}
const reviewedInventory: HistoricalOfficialFilingContext[] = inventory.senators.map(member => ({
  ...member,
  filings: member.filings.map(filing => ({
    ...filing,
    ...(reviewByFilingId.has(filing.id)
      ? { review: reviewByFilingId.get(filing.id) }
      : {}),
  })),
}));
const byName = new Map(reviewedInventory.map(member => [nameKey(member.name), member]));
if (byName.size !== inventory.senators.length) {
  throw new Error('Ambiguous historical CFB person aliases');
}

// Real, recorded government full-name variants, not fuzzy matching.
const documentedAliases: Record<string, string> = {
  [nameKey('William G. Ingebrigtsen')]: 'Bill G. Ingebrigtsen',
  [nameKey('Greg Clausen')]: 'Gregory D. Clausen',
  [nameKey('Jeffrey R. Howe')]: 'Jeff R. Howe',
  [nameKey('James Carlson')]: 'Jim Carlson',
  [nameKey('Matthew D. Klein')]: 'Matt D. Klein',
};

export function historicalOfficialFilingContextForSenator(
  senatorName: string,
  chamber?: string,
): HistoricalOfficialFilingContext | undefined {
  // Never present these Senate principal reports for a House membership.
  if (chamber && chamber.toLowerCase() !== 'senate') return undefined;
  const key = nameKey(senatorName);
  const direct = byName.get(key);
  if (direct) return direct;
  const alias = documentedAliases[key];
  return alias ? byName.get(nameKey(alias)) : undefined;
}

export function historicalOfficialFilingInventoryTotals(): {
  senators: number;
  versions: number;
  downloadedVersions: number;
  readableVersions: number;
  distinctDownloadedPdfBodies: number;
  unresolvedDocumentDetails: number;
  indexedVersionsAwaitingPdfDownload: number;
} {
  const all = inventory.senators.flatMap(s => s.filings);
  return {
    senators: inventory.senators.length,
    versions: all.length,
    downloadedVersions: inventory.senators.reduce((n, s) => n + s.downloadedVersions, 0),
    readableVersions: all.filter(f => f.status === 'readable_official_pdf').length,
    distinctDownloadedPdfBodies: inventory.sourceVerifiedCounts.distinctDownloadedPDFBodies, // Pinned 830-version/813-body source reconciliation V41
    unresolvedDocumentDetails: all.filter(f =>
      f.status === 'downloaded_pdf_details_unreadable_or_unresolved'
      || f.status === 'downloaded_pdf_report_date_conflict').length,
    indexedVersionsAwaitingPdfDownload: all.filter(f =>
      f.status === 'official_indexed_pdf_not_yet_retrieved').length,
  };
}

/**
 * Show an approved human review conclusion without rewriting the CFB's
 * original report type/stamp or implying the report was public at a vote.
 * Monetary figures are fixed-point integer cents. The selected review date
 * is a sorting/display convention only, not an as-of publication gate.
 */
export function officialFilingReviewLabel(filing: HistoricalOfficialFiling): string | undefined {
  const review = filing.review;
  if (!review) return undefined;
  switch (review.reviewDisposition) {
    case 'annual_receipts_accepted_from_original_pdf_and_board_summary': {
      const cents = review.acceptedTotalReceiptsCents;
      if (cents === null || !Number.isSafeInteger(cents) || cents < 0) return undefined;
      const money = (cents / 100).toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
      return `Receipts ${money} — corroborated by official CFB annual summary; review through ${review.effectiveReviewOn}`;
    }
    case 'correspondence_attachment_excluded_from_monetary_reconciliation':
      return 'Correspondence attachment — excluded from monetary totals';
    case 'handwritten_receipts_remain_unknown':
      return 'Handwritten receipt figures unresolved — amount not used';
    case 'later_of_printed_stamp_or_period_end_used_for_review':
      return `Review date: ${review.effectiveReviewOn} (later printed date; original Board stamp ${review.originalPrintedBoardReceivedOn} retained)`;
  }
}

export function officialFilingStatusLabel(status: HistoricalOfficialFilingStatus): string {
  switch (status) {
    case 'readable_official_pdf': return 'PDF available';
    case 'downloaded_pdf_details_unreadable_or_unresolved': return 'PDF available; some details unreadable';
    case 'downloaded_pdf_report_date_conflict': return 'PDF available; report dates need review';
    case 'official_filing_indexed_pdf_fetch_failed': return 'Listed by CFB; PDF download unavailable';
    case 'indexed_alias_of_same_pdf': return 'CFB version shares another PDF';
    case 'official_indexed_pdf_not_yet_retrieved': return 'Listed by CFB; PDF not yet checked';
    case 'official_pdf_downloaded_unparsed': return 'PDF downloaded; contents not yet reviewed';
  }
}

/**
 * Show the actual report period; 2022 pre-primary (C), pre-general (E)
 * and year-end (YE) are DIFFERENT original reports, not three identical
 * generic "original" entries. se=1 is the CFB special-election channel.
 * Display-only: this does not certify its first historical public date.
 */
export function officialFilingDisplayTitle(filing: HistoricalOfficialFiling): string {
  const parts = filing.id.split(':');
  const period = parts[3] === 'C'
    ? 'pre-primary' : parts[3] === 'E'
    ? 'pre-general' : parts[3] === 'YE'
    ? 'year-end' : 'campaign finance';
  const special = parts[4] === '1' ? ' (special election)' : '';
  const version = filing.kind === 'amended'
    ? 'amendment ' + filing.amendment : 'original';
  if (filing.review?.reviewDisposition === 'correspondence_attachment_excluded_from_monetary_reconciliation') {
    return filing.year + ' ' + period + special + ' — correspondence (CFB-indexed amendment ' + filing.amendment + ')';
  }
  return filing.year + ' ' + period + special + ' — ' + version;
}

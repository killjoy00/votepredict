import source from '../../data/cfb-senate-official-filings-2021-25-v33.json';

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
  | 'official_indexed_pdf_not_yet_retrieved';

export interface HistoricalOfficialFiling {
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

const byName = new Map(inventory.senators.map(member => [nameKey(member.name), member]));
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
    distinctDownloadedPdfBodies: 440, // pinned by the source and offline ledger audit
    unresolvedDocumentDetails: all.filter(f =>
      f.status === 'downloaded_pdf_details_unreadable_or_unresolved'
      || f.status === 'downloaded_pdf_report_date_conflict').length,
    indexedVersionsAwaitingPdfDownload: all.filter(f =>
      f.status === 'official_indexed_pdf_not_yet_retrieved').length,
  };
}

export function officialFilingStatusLabel(status: HistoricalOfficialFilingStatus): string {
  switch (status) {
    case 'readable_official_pdf': return 'PDF available';
    case 'downloaded_pdf_details_unreadable_or_unresolved': return 'PDF available; some details unreadable';
    case 'downloaded_pdf_report_date_conflict': return 'PDF available; report dates need review';
    case 'official_filing_indexed_pdf_fetch_failed': return 'Listed by CFB; PDF download unavailable';
    case 'indexed_alias_of_same_pdf': return 'CFB version shares another PDF';
    case 'official_indexed_pdf_not_yet_retrieved': return 'Listed by CFB; PDF not yet checked';
  }
}

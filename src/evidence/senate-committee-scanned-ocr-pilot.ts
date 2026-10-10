/**
 * Six independently verified, previously unparseable original Minnesota
 * Legislative Reference Library Senate electronic Minutes PDFs. These exact
 * links were present in the official per-year original-source failure
 * artifacts from run 38066441841; no discovery/crawl at OCR runtime.
 */
export const SENATE_SIX_SCANNED_ORIGINALS = [
  { year: 2022, committeeName: 'State Government Finance and Policy and Elections', meetingDate: '2022-02-01',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Finstgov/20220201/finstgov_20220201_minutes.pdf' },
  { year: 2022, committeeName: 'Jobs and Economic Growth Finance and Policy', meetingDate: '2022-02-02',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Jobs/20220202/Jobs_20220202_minutes.pdf' },
  { year: 2022, committeeName: 'Human Services Reform Finance and Policy', meetingDate: '2022-02-03',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Finhhsreform/20220203/finhhsreform_20220203_Minutes.pdf' },
  { year: 2023, committeeName: 'Higher Education', meetingDate: '2023-01-10',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2023/highered/20230110/highered_20230110_minutes.pdf' },
  { year: 2024, committeeName: 'Labor', meetingDate: '2024-02-20',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2024/labor/20240220/labor_20240220_minutes.pdf' },
  { year: 2025, committeeName: 'Taxes', meetingDate: '2025-01-15',
    url: 'https://www.lrl.mn.gov/archive/minutes/senate/2025/taxes/20250115/Taxes_20250115_minutes.pdf' },
] as const;

export const SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES = 8_000_000;
export const SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES = 8;

export function isPinnedScannedSenateOriginalPdfUrl(urlValue: string): boolean {
  return SENATE_SIX_SCANNED_ORIGINALS.some(original => original.url === urlValue);
}

export function validateSenateOriginalOcrPageCount(pages: number): void {
  if (!Number.isInteger(pages) || pages < 1 || pages > SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES) {
    throw new Error('Senate original PDF page count outside six-file bounded OCR pilot');
  }
}

export function verifyScannedSenateSixSourceManifest(): boolean {
  const urls = new Set<string>();
  const count = new Map<number, number>();
  for (const original of SENATE_SIX_SCANNED_ORIGINALS) {
    const url = new URL(original.url);
    const match = url.pathname.match(/^\/archive\/minutes\/senate\/(202[2-5])\/[^/]+\/(20\d{6})\/[^/]+_minutes\.pdf$/i);
    if (!match || url.protocol !== 'https:' || url.hostname !== 'www.lrl.mn.gov'
      || url.search !== '' || urls.has(original.url)
      || match[1] !== String(original.year)
      || original.meetingDate !== [
        match[2]!.slice(0, 4), match[2]!.slice(4, 6), match[2]!.slice(6, 8),
      ].join('-')) {
      return false;
    }
    urls.add(original.url);
    count.set(original.year, (count.get(original.year) ?? 0) + 1);
  }
  return SENATE_SIX_SCANNED_ORIGINALS.length === 6
    && count.get(2022) === 3
    && count.get(2023) === 1
    && count.get(2024) === 1
    && count.get(2025) === 1;
}

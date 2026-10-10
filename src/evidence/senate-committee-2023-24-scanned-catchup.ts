/**
 * #864: final electronic-original OCR source cohort for 2023 and 2024.
 * All 25 exact dates/URLs are taken from the 2026-10-10 full original-PDF
 * source audit (run 38066441841, artifacts 11674568363/11675315164).
 * The first six + second 24 pilots already recovered 5 originals per year.
 * No discovery, inferred meeting, source redirect or database dependency.
 */
export type CatchupYear = 2023 | 2024;

export const SENATE_2023_24_CATCHUP_SOURCE_RUN = 38066441841;
export const SENATE_2023_24_CATCHUP_SOURCE_ARTIFACT_IDS = {
  2023: 11674568363,
  2024: 11675315164,
} as const;
export const SENATE_2023_24_CATCHUP_YEAR_COUNTS = { 2023: 17, 2024: 8 } as const;
export const SENATE_2023_24_CATCHUP_ORIGINAL_TOTAL = 25;
export const SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES = 8_000_000;
export const SENATE_2023_24_CATCHUP_ORIGINAL_MAX_PAGES = 8;

const DATES = {
  2023: [
    '2023-01-12', '2023-01-17', '2023-01-19', '2023-01-24',
    '2023-02-02', '2023-02-07', '2023-02-09', '2023-02-14',
    '2023-02-21', '2023-02-28', '2023-03-02', '2023-03-07',
    '2023-03-14', '2023-03-16', '2023-03-21', '2023-03-23',
    '2023-03-28',
  ],
  2024: [
    '2024-02-22', '2024-02-29', '2024-03-07', '2024-03-12',
    '2024-03-14', '2024-04-04', '2024-04-11', '2024-04-16',
  ],
} as const;

export const SENATE_2023_24_CATCHUP_ORIGINALS = (
  [2023, 2024] as const
).flatMap(year => DATES[year].map(meetingDate => ({
  year,
  committeeName: 'Higher Education',
  meetingDate,
  url: 'https://www.lrl.mn.gov/archive/minutes/senate/' + year +
    '/highered/' + meetingDate.replaceAll('-', '') + '/highered_' +
    meetingDate.replaceAll('-', '') + '_minutes.pdf',
})));

export function verifySenate2023_24CatchupOriginals(): boolean {
  const docs = SENATE_2023_24_CATCHUP_ORIGINALS;
  if (docs.length !== SENATE_2023_24_CATCHUP_ORIGINAL_TOTAL
    || new Set(docs.map(d => d.url)).size !== docs.length) return false;
  for (const year of [2023, 2024] as const) {
    const group = docs.filter(d => d.year === year);
    if (group.length !== SENATE_2023_24_CATCHUP_YEAR_COUNTS[year]) return false;
    if (group.some((d, i) => i > 0 && d.meetingDate <= group[i - 1]!.meetingDate))
      return false;
    for (const d of group) {
      const u = new URL(d.url);
      if (d.committeeName !== 'Higher Education'
        || u.protocol !== 'https:' || u.hostname !== 'www.lrl.mn.gov'
        || u.search || u.hash
        || u.pathname !== '/archive/minutes/senate/' + year + '/highered/' +
          d.meetingDate.replaceAll('-', '') + '/highered_' +
          d.meetingDate.replaceAll('-', '') + '_minutes.pdf') return false;
    }
  }
  return true;
}

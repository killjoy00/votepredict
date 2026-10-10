/**
 * #864 final low-embedded-text 2022/2025 Senate original PDF cohort:
 * - exact original source run 38066441841, metadata JSON hashes pinned below
 * - excludes six prior OCR originals and 24-followup original URLs
 * - fixed 2022:110; 2025:42; no unbounded discovery at runtime
 * - original source artifact expires; durable source proof must be retained
 *   in a subsequent independently tested source ledger.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SENATE_SIX_SCANNED_ORIGINALS } from './senate-committee-scanned-ocr-pilot.js';

export type SenateFinalOcrYear = 2022 | 2025;
export type SenateFinalOcrDoc = {
  year: SenateFinalOcrYear;
  committeeName: string;
  meetingDate: string;
  url: string;
};
export const SENATE_FINAL_OCR_SOURCE_RUN = 38066441841;
export const SENATE_FINAL_OCR_EXPECTED = {
  2022: {
    sourceArtifactName: 'senate-committee-2022-original-action-source-metadata',
    sourceArtifactId: 11674729430,
    originalJsonSha256: '23be57a94c4c9dcb3641dca450b335c81fca9fbd25867d94658d77937b847372',
    fullLowText: 121, priorOcr: 11, remaining: 110, batches: 6,
    fullSourceUrlListSha256: 'b802f5773a5318b3868b82c676c968c51ad4c535bcbf3ed6a00c7a18aff43dc0',
    selectedUrlsSha256: '794bd1003290f13e5c44e1ab27b545eee9632f8a09c09b0ed6080afa275b3be9',
  },
  2025: {
    sourceArtifactName: 'senate-committee-2025-original-action-source-metadata',
    sourceArtifactId: 11675014092,
    originalJsonSha256: 'e611f2b7a7225d7c62e8bbae960db60c50793ffca7cb3928e62d578a809c5dea',
    fullLowText: 51, priorOcr: 9, remaining: 42, batches: 3,
    fullSourceUrlListSha256: '0ad3ef16eb26c84dd7220ff14e94cad055db5a969b67234e367612902770982c',
    selectedUrlsSha256: '29d0656929dc92be4b283b296f1101cbbf6ad90ef991e31c6e1b30ceb6fee515',
  },
} as const;
export const SENATE_FINAL_OCR_MAX_BYTES = 8_000_000;
export const SENATE_FINAL_OCR_MAX_PAGES = 8;

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
export function isOfficialPinnedOriginal(row: SenateFinalOcrDoc): boolean {
  if (row.year !== 2022 && row.year !== 2025
      || typeof row.committeeName !== 'string' || !row.committeeName.trim()
      || !/^202[25]-\d\d-\d\d$/.test(row.meetingDate)) return false;
  let url: URL;
  try { url = new URL(row.url); } catch { return false; }
  const match = url.pathname.match(
    /^\/archive\/minutes\/senate\/(2022|2025)\/[^/]+\/(20\d{6})\/[^/]+_minutes\.pdf$/i
  );
  if (!match || url.hostname !== 'www.lrl.mn.gov' || url.protocol !== 'https:'
      || url.search || url.hash || Number(match[1]) !== row.year) return false;
  const date = match[2]!;
  return row.meetingDate === date.slice(0,4) + '-' + date.slice(4,6) + '-' + date.slice(6,8);
}

type Failed = {
  sourceUrl: string; meetingDate: string; committeeName: string; error: string;
};

export function selectVerifiedFinalOriginals(year: SenateFinalOcrYear, raw: string): SenateFinalOcrDoc[] {
  const conf = SENATE_FINAL_OCR_EXPECTED[year];
  if (sha256(raw) !== conf.originalJsonSha256)
    throw Error('Unverified original Actions source metadata JSON SHA256');
  const source = JSON.parse(raw) as {
    auditedYear: number; schemaVersion: string;
    unresolvedOriginalDocuments: Failed[]; originalPdfsFailedOrUnparsed: number;
  };
  if (source.auditedYear !== year || source.originalPdfsFailedOrUnparsed !== conf.fullLowText
      || !Array.isArray(source.unresolvedOriginalDocuments)
      || source.unresolvedOriginalDocuments.length !== conf.fullLowText)
    throw Error('Original full Senate PDF audit denominator changed');
  const originalUrls = source.unresolvedOriginalDocuments.map(x => x.sourceUrl);
  if (sha256(originalUrls.join('\n')) !== conf.fullSourceUrlListSha256)
    throw Error('Full original low-text cohort URL list has drifted');

  const prior24Raw = readFileSync(new URL(
    '../../docs/evaluation/source-proof/senate-committee-24-scanned-originals-source-manifest.json',
    import.meta.url), 'utf8');
  if (sha256(prior24Raw) !== 'd482c8274eeea49b5c602480fa166a355855cb9ee5e5b041ada7c470ee3e1f70')
    throw Error('Prior 24-source manifest changed');
  const prior24 = JSON.parse(prior24Raw) as {
    originals: Array<{year: number; url: string}>;
  };
  const prior = new Set<string>([
    ...SENATE_SIX_SCANNED_ORIGINALS.filter(x => x.year === year).map(x => x.url),
    ...prior24.originals.filter(x => x.year === year).map(x => x.url),
  ]);
  if (prior.size !== conf.priorOcr || new Set(originalUrls).size !== conf.fullLowText)
    throw Error('Previous original scan cohorts overlap or source duplicates present');
  for (const sourceDoc of source.unresolvedOriginalDocuments) {
    if (sourceDoc.error !== 'Minnesota Senate committee minutes PDF had too little extractable text'
        || !isOfficialPinnedOriginal({
          year, url:sourceDoc.sourceUrl, meetingDate: sourceDoc.meetingDate,
          committeeName: sourceDoc.committeeName,
        })) throw Error('Original failure is not the expected official Senate scanned PDF');
  }
  if ([...prior].some(x => !originalUrls.includes(x)))
    throw Error('Previous original OCR source URL missing from independent audit');
  const chosen = source.unresolvedOriginalDocuments
    .filter(doc => !prior.has(doc.sourceUrl))
    .map(doc => ({ year, committeeName: doc.committeeName,
      meetingDate:doc.meetingDate, url: doc.sourceUrl }));
  if (chosen.length !== conf.remaining
      || sha256(chosen.map(x => x.url).join('\n')) !== conf.selectedUrlsSha256)
    throw Error('Unexpected or modified final original OCR source URL cohort');
  return chosen;
}

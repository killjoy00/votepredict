import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SENATE_SIX_SCANNED_ORIGINALS,
  SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES,
  SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES,
  isPinnedScannedSenateOriginalPdfUrl,
  validateSenateOriginalOcrPageCount,
  verifyScannedSenateSixSourceManifest,
} from '../src/evidence/senate-committee-scanned-ocr-pilot.js';

test('OCR feasibility cohort is exactly 6 original official PDFs with verified year/date URL identities', () => {
  assert.equal(verifyScannedSenateSixSourceManifest(), true);
  assert.equal(SENATE_SIX_SCANNED_ORIGINALS.length, 6);
  assert.deepEqual(SENATE_SIX_SCANNED_ORIGINALS.map(x => x.year), [
    2022, 2022, 2022, 2023, 2024, 2025,
  ]);
  assert.equal(new Set(SENATE_SIX_SCANNED_ORIGINALS.map(x => x.url)).size, 6);
  assert.ok(SENATE_SIX_SCANNED_ORIGINALS.every(x => x.url.endsWith('_minutes.pdf')
    || x.url.endsWith('_Minutes.pdf')));
  assert.ok(SENATE_SIX_SCANNED_ORIGINALS.every(x =>
    isPinnedScannedSenateOriginalPdfUrl(x.url)));
});

test('OCR pilot refuses arbitrary Senate/House/2021/redirected or query URLs', () => {
  const first = SENATE_SIX_SCANNED_ORIGINALS[0]!.url;
  for (const candidate of [
    first + '?download=true',
    first.replace('/senate/', '/house/'),
    first.replace('/2022/', '/2021/'),
    first.replace('www.lrl.mn.gov', 'www.lrl.mn.gov.evil.test'),
    first.replace('https://', 'http://'),
    'https://www.lrl.mn.gov/archive/minutes/senate/2023/highered/20230111/highered_20230111_minutes.pdf',
  ]) assert.equal(isPinnedScannedSenateOriginalPdfUrl(candidate), false, candidate);
});

test('raster OCR has hard per-PDF original byte and page caps; unknown or unbounded pages fail closed', () => {
  assert.equal(SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES, 8_000_000);
  assert.equal(SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES, 8);
  for (const valid of [1, 4, 8]) assert.doesNotThrow(() =>
    validateSenateOriginalOcrPageCount(valid));
  for (const invalid of [-1, 0, 9, 99, 1.5, NaN, Infinity]) {
    assert.throws(() => validateSenateOriginalOcrPageCount(invalid), /outside six-file bounded OCR pilot/);
  }
});

test('six-source pilot represents only year 2022–25 official electronic originals, not an all-meeting/vote universe', () => {
  assert.equal(new Set<number>(SENATE_SIX_SCANNED_ORIGINALS.map(x => x.year)).has(2021), false);
  assert.equal(SENATE_SIX_SCANNED_ORIGINALS.length < 207, true);
});

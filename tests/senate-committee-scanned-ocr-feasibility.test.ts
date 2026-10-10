import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSenateCommitteeMinuteText } from '../src/evidence/minnesota-senate-committee-source.js';
import { auditSenateCommitteeOriginalMinutePdf } from '../src/evidence/senate-committee-original-pdf-action-audit.js';

const official = {
  year: 2023,
  committeeName: 'Higher Education',
  meetingDate: '2023-01-10',
  url: 'https://www.lrl.mn.gov/archive/minutes/senate/2023/highered/20230110/highered_20230110_minutes.pdf',
};

test('scanned original PDF uses OCR only if embedded official text is too short', () => {
  const scanned = chooseSenateCommitteeMinuteText({
    embeddedText: ' ',
    ocrText: 'Official Senate Higher Education Minutes January 10 2023. '
      + 'The motion prevailed by a voice vote.',
  });
  assert.equal(scanned.extractionMethod, 'ocr_tesseract');
  assert.ok(scanned.text.length > 40);
  const embedded = chooseSenateCommitteeMinuteText({
    embeddedText: 'Original signed Senate committee minutes extracted from text PDF. ',
    ocrText: 'An OCR copy must not override already-readable embedded text.',
  });
  assert.equal(embedded.extractionMethod, 'embedded_text');
});

test('original OCR source retains hash, date and context-only candidate action without invented member votes', () => {
  const sourceText = [
    'Official Senate Higher Education Committee Minutes.',
    'S.F. 441 was before the committee.',
    'Senator Doe moved the A1 amendment. It was adopted via voice vote.',
  ].join(' ');
  const report = auditSenateCommitteeOriginalMinutePdf({
    document: official,
    pdf: {
      text: sourceText, bytes: 42_000, contentSha256: 'a'.repeat(64),
      fetchedAt: '2026-10-10T16:00:00.000Z',
      httpStatus: 200, extractionMethod: 'ocr_tesseract',
    },
  });
  assert.equal(report.document.extractionMethod, 'ocr_tesseract');
  assert.equal(report.document.meetingDate, '2023-01-10');
  assert.equal(report.document.originalRawPdfSha256, 'a'.repeat(64));
  assert.equal(report.sourceParserTotals.namedMemberChoicesInPdf, 0);
  assert.ok(report.sourceParserTotals.voiceActions >= 1);
  assert.ok(report.contextOnlyActions.every(x => x.individualVotesAvailable === false));
  assert.equal(report.originalPdfTextPersisted, false);
  assert.ok(!JSON.stringify(report).includes('Senator Doe'));
});

test('unrecoverable OCR text continues to fail closed rather than producing zero-vote proof', () => {
  assert.throws(() => chooseSenateCommitteeMinuteText({
    embeddedText: '', ocrText: 'illegible',
  }), /too little extractable text/);
});

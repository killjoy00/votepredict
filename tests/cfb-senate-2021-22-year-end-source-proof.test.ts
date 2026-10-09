import assert from 'node:assert/strict';
import test from 'node:test';
import { cfbReportViewerUrl } from '../src/evidence/cfb-current-report-acquisition.js';
import type { CfbReportViewerReference } from '../src/evidence/cfb-report-pdf-proof.js';
import {
  auditCfb2021_22SenateYearEndPdfSource,
  type Cfb2021_22YearEndPdfCapture,
} from '../src/evidence/cfb-senate-2021-22-year-end-source-proof.js';

function ref(year: '21' | '22', edits: Partial<CfbReportViewerReference> = {}): CfbReportViewerReference {
  return { filingYear: 2022, year, type: 'pcc', period: 'YE',
    se: '0', registrationNumber: '18443', amendment: 0,
    reportName: 'Year-End Report', ...edits };
}

function reportText(year: 2021 | 2022, received: string, due: string) {
  return [
    'Report of Receipts and Expenditures for Principal Campaign Committee',
    'Period Covered: 1/1/' + year + ' through 12/31/' + year,
    'Erin Murphy for Senate 18443 Murphy, Erin Senate District: 64',
    'Committee Information: St Paul',
    'Registration number: Committee name: Candidate name: Office and District:',
    'Report Due Date: ' + due,
    'Received by the Board ' + received,
    'Other report information omitted from test fixture',
  ].join(' ');
}

function pdf(
  reference: CfbReportViewerReference,
  text = reportText(reference.year === '21' ? 2021 : 2022,
    reference.year === '21' ? 'January 28, 2022' : 'January 30, 2023',
    reference.year === '21' ? 'January 31, 2022' : 'January 31, 2023'),
): Cfb2021_22YearEndPdfCapture {
  return { reference, text, sourceUrl: cfbReportViewerUrl(reference),
    bytes: 32_123, contentSha256: 'a'.repeat(64),
    fetchedAt: '2026-10-09T23:30:00.000Z' };
}

test('real-style 2021 Senate YE filed EARLY remains private until the day after statutory due', () => {
  const r = ref('21');
  const result = auditCfb2021_22SenateYearEndPdfSource([r], [pdf(r)]);
  const proof = result.yearResults.find(x => x.year === 2021)!;
  assert.equal(proof.status, 'original_pdf_filing_and_due_verified');
  assert.equal(proof.sourceReceivedOn, '2022-01-28');
  assert.equal(proof.sourceDueOn, '2022-01-31');
  assert.equal(proof.conservativeLegalAndFilingBoundOn, '2022-02-01');
  assert.equal(proof.senatorOfficeAndCommitteeVerified, true);
  assert.match(proof.originalPdfSha256!, /^[a-f0-9]{64}$/);
  assert.equal(proof.independentArchivedCalendarDueVerified, false);
  assert.equal(proof.independentlyProvenHistoricalPublicByOn, null);
  assert.equal(proof.historicallyModelEligible, false);
  assert.equal(result.completeSenateRequiredFilingDenominator, null);
  assert.equal(result.completenessCertified, false);
  assert.equal(result.productionDbReadOrWrite, false);
});

test('later year end for the same Senator stays separate, never a 2021 report or 2021 eligible', () => {
  const r21 = ref('21'); const r22 = ref('22');
  const audit = auditCfb2021_22SenateYearEndPdfSource([r21, r22], [pdf(r21), pdf(r22)]);
  assert.equal(audit.verifiedOriginalPdfFiledAndDueHeaders, 2);
  assert.equal(audit.yearResults.find(x => x.year === 2022)?.sourceDueOn, '2023-01-31');
  assert.equal(audit.yearResults.find(x => x.year === 2022)?.conservativeLegalAndFilingBoundOn, '2023-02-01');
  assert.equal(audit.yearResults[0]?.reportId, '18443:21:pcc:YE:0:0');
  assert.equal(audit.yearResults[1]?.reportId, '18443:22:pcc:YE:0:0');
  assert.ok(audit.yearResults.every(x => x.historicallyModelEligible === false));
});

test('year 2022 late-filed report bounds availability to day after receipt', () => {
  const r = ref('22');
  const late = pdf(r, reportText(2022, 'February 17, 2023', 'January 31, 2023'));
  const row = auditCfb2021_22SenateYearEndPdfSource([r], [late]).yearResults[1]!;
  assert.equal(row.status, 'original_pdf_filing_and_due_verified');
  assert.equal(row.conservativeLegalAndFilingBoundOn, '2023-02-18');
  assert.equal(row.independentlyProvenHistoricalPublicByOn, null);
});

test('a reference missing in public viewer is missing source, NOT no financial activity', () => {
  const audit = auditCfb2021_22SenateYearEndPdfSource([], []);
  assert.equal(audit.yearResults[0]?.status, 'source_reference_not_listed');
  assert.equal(audit.yearResults[0]?.sourceReportReferenceCount, 0);
  assert.equal(audit.yearResults[0]?.sourceDueOn, null);
  assert.equal(audit.yearResults[1]?.status, 'source_reference_not_listed');
  assert.equal(audit.completeSenateOfficialFilerDenominator, null);
});

test('reference identity must be exact: excludes other chamber/registration/period/year/amendment', () => {
  const targets = [
    ref('21', { registrationNumber: '99999' }),
    ref('21', { type: 'pcf' }),
    ref('21', { period: 'A' }),
    ref('21', { se: '1' }),
    ref('21', { amendment: 1 }),
    ref('22', { year: '23' }),
  ];
  const audit = auditCfb2021_22SenateYearEndPdfSource(targets, []);
  assert.equal(audit.sourceReferenceCount2021To2022, 0);
  assert.ok(audit.yearResults.every(x => x.status === 'source_reference_not_listed'));
});

test('wrong Senate office and forged registration fail closed even if correct due dates appear', () => {
  const r = ref('21');
  const a = pdf(r, reportText(2021, 'January 28, 2022', 'January 31, 2022')
    .replaceAll('Senate District: 64', 'House District: 64'));
  const b = pdf(r, reportText(2021, 'January 28, 2022', 'January 31, 2022')
    .replaceAll('18443', '99999'));
  assert.equal(auditCfb2021_22SenateYearEndPdfSource([r], [a]).yearResults[0]?.status,
    'candidate_senate_office_unverified');
  assert.equal(auditCfb2021_22SenateYearEndPdfSource([r], [b]).yearResults[0]?.status,
    'report_header_filing_or_due_unverified');
});

test('missing statutory due field or inverted period never becomes historical eligibility', () => {
  const r = ref('21');
  const noDue = pdf(r, reportText(2021, 'January 28, 2022', 'January 31, 2022')
    .replace('Report Due Date:', 'Notes:'));
  const inverted = pdf(r, reportText(2021, 'January 28, 2022', 'January 31, 2022')
    .replace('1/1/2021 through 12/31/2021', '12/31/2021 through 1/1/2021'));
  for (const candidate of [noDue, inverted]) {
    const row = auditCfb2021_22SenateYearEndPdfSource([r], [candidate]).yearResults[0]!;
    assert.equal(row.status, 'report_header_filing_or_due_unverified');
    assert.equal(row.conservativeLegalAndFilingBoundOn, null);
  }
});

test('source PDF mismatch or two captures cannot be treated as one official filing', () => {
  const r = ref('21');
  const forged = { ...pdf(r), sourceUrl: 'https://evil.test/viewer?id=18443' };
  const wrongHash = { ...pdf(r), contentSha256: 'invalid' };
  assert.equal(auditCfb2021_22SenateYearEndPdfSource([r], [forged]).yearResults[0]?.status,
    'invalid_pdf_provenance');
  assert.equal(auditCfb2021_22SenateYearEndPdfSource([r], [wrongHash]).yearResults[0]?.status,
    'invalid_pdf_provenance');
  assert.equal(auditCfb2021_22SenateYearEndPdfSource([r], [pdf(r), pdf(r)]).yearResults[0]?.status,
    'conflicting_pdf_captures');
  assert.equal(auditCfb2021_22SenateYearEndPdfSource([r, r], [pdf(r)]).yearResults[0]?.status,
    'source_reference_conflict');
});

test('unknown committee due or cutoff never inherits a different registered filer proof', () => {
  const r = ref('21');
  const capture = pdf(r);
  capture.reference = { ...r, registrationNumber: '99999' };
  const audit = auditCfb2021_22SenateYearEndPdfSource([r], [capture]);
  assert.equal(audit.yearResults[0]?.status, 'original_pdf_not_acquired');
  assert.equal(audit.yearResults[0]?.sourceReceivedOn, null);
});

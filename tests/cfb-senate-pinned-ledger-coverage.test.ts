import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  auditCfbSenatePinnedReportCoverage,
  readCfbSenatePinnedReportProofs,
} from '../src/evidence/cfb-senate-pinned-ledger-coverage.js';

function fixtures(): { sd6: any; senate64: any } {
  return {
    sd6: JSON.parse(readFileSync('docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json', 'utf8')),
    senate64: JSON.parse(readFileSync('docs/evaluation/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json', 'utf8')),
  };
}

test('real original-document proof ledgers pin seven exact report versions, six originals and one amendment', () => {
  const records = readCfbSenatePinnedReportProofs(fixtures());
  const audit = auditCfbSenatePinnedReportCoverage(records);
  assert.deepEqual(audit.pilotTotals.observedCandidateRegistrationIds, ['18443', '19205']);
  assert.equal(audit.pilotTotals.originalPdfVersions, 7);
  assert.equal(audit.pilotTotals.originalFilingVersions, 6);
  assert.equal(audit.pilotTotals.amendedVersions, 1);
  assert.equal(audit.pilotTotals.knownUnresolvedCalendarPeriodDiscrepancies, 1);
  assert.equal(audit.reports.filter(x => x.amendmentNumber > 0).length, 1);
  assert.deepEqual(audit.reports.map(x => [x.reportId, x.reportPdfSha256]), [
    ['18443:21:pcc:YE:0:0', '3bed3b738b55ce45d16f34acf45be06f6e598cca28b3ab63f6db09844cfb65a1'],
    ['18443:22:pcc:YE:0:0', 'b03462fc7ac658f80b0dbecf511b16aef4039e151c9c5f1b5237f562a3f4586e'],
    ['19205:25:pcc:C:1:0', 'db3db4cb38251b6f75a345af059e64f39cfabb87e021dbba2ab7bca4526477ff'],
    ['19205:25:pcc:E:1:0', '52027e46e25edcf3eb54f117413f62fd2f9638fdd15b50196a9353436f6b3eeb'],
    ['19205:25:pcc:YE:0:0', '5f8f4aa06134f5659f1ef6be1eec4f8931e5724b4e52d3411895fe7471256af3'],
    ['19205:25:pcc:YE:0:1', '1d6ac6b2d30d066480f522d667921200562e95940da469a5ea4d5114242f3d86'],
    ['19205:25:pcc:YE:1:0', '85e1a40c39f4a23b8173bf567868f323ee331f2fb895fb1608625a0d5b253049'],
  ]);
  assert.ok(audit.reports.every(x => x.independentlyProvenHistoricalPublicByOn === null
    && !x.exactTransactionRowContainmentVerified && !x.historicalAsOfEligibilityGranted));
});

test('reports by 2021–2025 year remain ONLY source-observed sample counts, not statewide totals', () => {
  const audit = auditCfbSenatePinnedReportCoverage(readCfbSenatePinnedReportProofs(fixtures()));
  assert.deepEqual(audit.byYear.map(x => x.verifiedOriginalReportPdfVersions), [1, 1, 0, 0, 5]);
  assert.deepEqual(audit.byYear.map(x => x.verifiedOriginalFilings), [1, 1, 0, 0, 4]);
  assert.deepEqual(audit.byYear.map(x => x.observedAmendedVersions), [0, 0, 0, 0, 1]);
  assert.ok(audit.byYear.every(x => x.officialSenateCommitteeDenominator === null
    && x.officialRequiredReportDenominator === null
    && x.officialActualFiledReportDenominator === null));
  assert.equal(audit.statewideDenominator.scopeCoverageCertified, false);
  assert.equal(audit.statewideDenominator.officialRegisteredSenateCandidateCommittees, null);
  assert.equal(audit.statewideDenominator.officialRequiredReports, null);
  assert.equal(audit.statewideDenominator.officialActualFiledReports, null);
  assert.equal(audit.safeguards.releaseFloorIsHistoricalPublicByProof, false);
  assert.equal(audit.safeguards.noDatabaseReadOrWrite, true);
});

test('statutory ordinary-report release cannot be moved before the independent due-date floor', () => {
  const inputs = fixtures();
  inputs.senate64.reportProofs[0].conservativeEarliestStatutoryAndFilingReleaseOn = '2022-01-29';
  assert.throws(() => readCfbSenatePinnedReportProofs(inputs), /floor must be later/);
  const inputs2 = fixtures();
  inputs2.sd6.reports[2].conservativeLegalAndFilingBoundOn = '2026-01-31';
  assert.throws(() => readCfbSenatePinnedReportProofs(inputs2), /floor must be later/);
  const records = readCfbSenatePinnedReportProofs(fixtures());
  assert.equal(records.find(x => x.reportId === '18443:21:pcc:YE:0:0')?.conservativeLegalAndFilingFloorOn, '2022-02-01');
  assert.equal(records.find(x => x.reportId === '19205:25:pcc:YE:0:0')?.conservativeLegalAndFilingFloorOn, '2026-02-03');
});

test('paper reports with missing printed due fields still require independently verified original calendar', () => {
  const inputs = fixtures();
  inputs.senate64.reportProofs[0].independentDueCalendar.originalCalendarDueDateVerified = false;
  assert.throws(() => readCfbSenatePinnedReportProofs(inputs), /independent due-date source/);
  const second = fixtures();
  second.sd6.officialCalendars.special.manualDateToReportTableAssociationReviewed = false;
  assert.throws(() => readCfbSenatePinnedReportProofs(second), /calendar applicability not reviewed/);
});

test('rejects official source changes in office, report PDF identity, hash, year and vendor host', () => {
  const scope = fixtures();
  scope.sd6.scope.office = 'Minnesota House District 6';
  assert.throws(() => readCfbSenatePinnedReportProofs(scope), /scope\/version/);
  const hash = fixtures();
  hash.sd6.reports[0].sourcePdfSha256 = 'not-a-hash';
  assert.throws(() => readCfbSenatePinnedReportProofs(hash), /SHA-256/);
  const host = fixtures();
  host.sd6.reports[0].sourceUrl = 'https://example.com/rptViewer/Main.php?do=viewPDF';
  assert.throws(() => readCfbSenatePinnedReportProofs(host), /official CFB host/);
  const mismatch = fixtures();
  mismatch.sd6.reports[0].sourceUrl = mismatch.sd6.reports[1].sourceUrl;
  assert.throws(() => readCfbSenatePinnedReportProofs(mismatch), /viewer URL does not match/);
  const fakeReport = fixtures();
  fakeReport.senate64.reportProofs[0].reportYear = 2024;
  assert.throws(() => readCfbSenatePinnedReportProofs(fakeReport), /report ID must identify/);
});

test('never silently grants historical public-by, row containment or forecast eligibility', () => {
  const historical = fixtures();
  historical.sd6.reports[0].historicallyPublicByOn = '2025-04-09';
  assert.throws(() => readCfbSenatePinnedReportProofs(historical), /unproven historical publication/);
  const row = fixtures();
  row.senate64.reportProofs[0].exactTransactionRowContainmentVerified = true;
  assert.throws(() => readCfbSenatePinnedReportProofs(row), /unproven historical publication/);
});

test('the conflicting SD6 special-election calendar period stays visible', () => {
  const records = readCfbSenatePinnedReportProofs(fixtures());
  assert.equal(records.find(x => x.reportId === '19205:25:pcc:YE:1:0')?.calendarPeriodDisputeOpen, true);
  const inputs = fixtures();
  inputs.sd6.periodReview.reportCalendarPeriodMismatchNeedsReview = false;
  assert.throws(() => readCfbSenatePinnedReportProofs(inputs), /calendar-period conflict/);
});

test('duplicate snapshots do not multiply the observed filings, but contradictory proofs stop the audit', () => {
  const records = readCfbSenatePinnedReportProofs(fixtures());
  const repeat = auditCfbSenatePinnedReportCoverage([...records, records[0]!]);
  assert.equal(repeat.pilotTotals.originalPdfVersions, 7);
  const tampered = { ...records[0]!, reportPdfSha256: 'e'.repeat(64) };
  assert.throws(() => auditCfbSenatePinnedReportCoverage([...records, tampered]), /Contradictory original PDF proof/);
});

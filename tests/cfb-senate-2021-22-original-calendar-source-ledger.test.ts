import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cfbElectronicReportAvailableOn } from '../src/evidence/cfb-report-availability.js';

interface ReportRow {
  reportId: string;
  reportYear: number;
  reportViewerUrl: string;
  originalReportPdfSha256: string;
  originalPdfBytes: number;
  originalPeriodStartOn: string;
  originalPeriodEndOn: string;
  actualBoardReceivedOn: string;
  originalPdfHadPrintedDueDate: false;
  independentDueCalendar: {
    url: string;
    embeddedTitle: string;
    originalPdfSha256: string;
    originalPdfBytes: number;
    specificYearEndReportDueOn: string;
    originalCalendarDueDateVerified: boolean;
  };
  conservativeEarliestStatutoryAndFilingReleaseOn: string;
  independentlyProvenHistoricalPublicByOn: null;
  exactTransactionRowContainmentVerified: false;
  historicalPredictionEligibilityGranted: false;
}
interface Ledger {
  schemaVersion: string;
  originalCapture: {
    workflowRun: number;
    artifactId: number;
    originalViewerApiSha256: string;
    officialCandidateViewerUrl: string;
  };
  scope: { registrationNumber: string; reportYears: number[]; fullHistoricalSenateScope: boolean };
  reportProofs: ReportRow[];
  safeguards: {
    originalReportPdfSourceFilesSaved: false;
    rawPdfTextsOrDonorDetailsSaved: false;
    officialAllSenateRegisteredFilerDenominator: null;
    officialRequiredReportDenominator: null;
    actualSenateFiledReportDenominator: null;
    historicalPublicAvailabilityProven: false;
    exactFinanceRowContainmentProven: false;
    noProductionDbReadsOrWrites: true;
    noServingOrModelTrainingChanges: true;
    completenessCertified: false;
  };
}
const text = readFileSync(new URL(
  '../docs/evaluation/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json',
  import.meta.url), 'utf8');
const proof: Ledger = JSON.parse(text) as Ledger;

test('real original source proof is tied to the precise one-filer 2021-22 official source run', () => {
  assert.equal(proof.schemaVersion, 'cfb-2021-22-senate-report-independent-calendar-source-ledger-v1');
  assert.equal(proof.originalCapture.workflowRun, 38059511167);
  assert.equal(proof.originalCapture.artifactId, 11671979899);
  assert.equal(proof.scope.registrationNumber, '18443');
  assert.deepEqual(proof.scope.reportYears, [2021, 2022]);
  assert.equal(proof.scope.fullHistoricalSenateScope, false);
  assert.equal(proof.reportProofs.length, 2);
  assert.match(proof.originalCapture.originalViewerApiSha256, /^[a-f0-9]{64}$/);
  assert.equal(new URL(proof.originalCapture.officialCandidateViewerUrl).hostname, 'register.cfb.mn.gov');
});

test('year-end reports have separate original PDF hashes, due calendar sources and verified date arithmetic', () => {
  const ids = new Set<string>();
  for (const row of proof.reportProofs) {
    assert.ok(!ids.has(row.reportId)); ids.add(row.reportId);
    assert.match(row.reportId, /^18443:(21|22):pcc:YE:0:0$/);
    assert.equal(new URL(row.reportViewerUrl).hostname, 'cfb.mn.gov');
    assert.equal(new URL(row.reportViewerUrl).searchParams.get('regnum'), '18443');
    assert.equal(new URL(row.reportViewerUrl).searchParams.get('year'), String(row.reportYear).slice(-2));
    assert.match(row.originalReportPdfSha256, /^[a-f0-9]{64}$/);
    assert.ok(row.originalPdfBytes > 300);
    assert.equal(row.originalPeriodStartOn, row.reportYear + '-01-01');
    assert.equal(row.originalPeriodEndOn, row.reportYear + '-12-31');
    assert.ok(row.actualBoardReceivedOn >= row.originalPeriodEndOn);
    assert.equal(row.originalPdfHadPrintedDueDate, false);
    assert.equal(new URL(row.independentDueCalendar.url).hostname, 'cfb.mn.gov');
    assert.match(row.independentDueCalendar.originalPdfSha256, /^[a-f0-9]{64}$/);
    assert.ok(row.independentDueCalendar.originalPdfBytes > 500);
    assert.equal(row.independentDueCalendar.originalCalendarDueDateVerified, true);
    assert.equal(cfbElectronicReportAvailableOn(
      row.actualBoardReceivedOn, row.independentDueCalendar.specificYearEndReportDueOn,
    ), row.conservativeEarliestStatutoryAndFilingReleaseOn);
    assert.equal(row.independentlyProvenHistoricalPublicByOn, null);
    assert.equal(row.exactTransactionRowContainmentVerified, false);
    assert.equal(row.historicalPredictionEligibilityGranted, false);
  }
});

test('2021 and 2022 originals are independent filing years with verified January 31 due dates', () => {
  const a = proof.reportProofs.find(r => r.reportYear === 2021);
  const b = proof.reportProofs.find(r => r.reportYear === 2022);
  assert.ok(a && b);
  assert.equal(a.actualBoardReceivedOn, '2022-01-28');
  assert.equal(a.independentDueCalendar.specificYearEndReportDueOn, '2022-01-31');
  assert.equal(a.conservativeEarliestStatutoryAndFilingReleaseOn, '2022-02-01');
  assert.ok(a.independentDueCalendar.embeddedTitle.includes('Senate, House'));
  assert.equal(b.actualBoardReceivedOn, '2023-01-30');
  assert.equal(b.independentDueCalendar.specificYearEndReportDueOn, '2023-01-31');
  assert.equal(b.conservativeEarliestStatutoryAndFilingReleaseOn, '2023-02-01');
  assert.notEqual(a.originalReportPdfSha256, b.originalReportPdfSha256);
  assert.notEqual(a.independentDueCalendar.originalPdfSha256, b.independentDueCalendar.originalPdfSha256);
});

test('source ledger saves no donor details and does not certify historical source availability or statewide completeness', () => {
  assert.ok(!text.includes('"donorAddress"'));
  assert.ok(!text.includes('"pdfText"'));
  assert.equal(proof.safeguards.originalReportPdfSourceFilesSaved, false);
  assert.equal(proof.safeguards.rawPdfTextsOrDonorDetailsSaved, false);
  assert.equal(proof.safeguards.officialAllSenateRegisteredFilerDenominator, null);
  assert.equal(proof.safeguards.officialRequiredReportDenominator, null);
  assert.equal(proof.safeguards.actualSenateFiledReportDenominator, null);
  assert.equal(proof.safeguards.historicalPublicAvailabilityProven, false);
  assert.equal(proof.safeguards.exactFinanceRowContainmentProven, false);
  assert.equal(proof.safeguards.noProductionDbReadsOrWrites, true);
  assert.equal(proof.safeguards.noServingOrModelTrainingChanges, true);
  assert.equal(proof.safeguards.completenessCertified, false);
});

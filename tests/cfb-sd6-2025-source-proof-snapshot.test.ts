import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cfbElectronicReportAvailableOn } from '../src/evidence/cfb-report-availability.js';

interface StoredReport {
  reportId: string;
  sourceUrl: string;
  sourcePdfSha256: string;
  sourcePdfBytes: number;
  sourceFetchedAt: string;
  reportCoverageStartOn: string;
  reportCoverageEndOn: string;
  officialReceivedOn: string;
  statutoryDueOnFromCaseSpecificCalendar: string;
  conservativeLegalAndFilingBoundOn: string;
  calendarSource: 'special' | 'general';
  amendmentIndexFromViewer: number;
  amendedVersionNotSeparateRequiredReport: boolean;
  historicallyPublicByOn: null;
  exactRowContainmentVerified: false;
  historicalAsOfEligible: false;
}
interface StoredProof {
  schemaVersion: string;
  recordedFrom: { actionRun: number; actionArtifactId: number };
  scope: {
    registrationNumber: string;
    reportYear: number;
    officialAllSenateFilerDenominator: null;
    requiredReportDenominator: null;
  };
  officialCalendars: Record<string, {
    url: string;
    pdfSha256: string;
    bytes: number;
    scopeAndDateMarkersVerified: boolean;
  }>;
  reports: StoredReport[];
  periodReview: {
    sourceSpecialCycleFinalCoveredThrough: string;
    sourceOrdinaryYearEndBeginsOn: string;
    nextDayContiguityObserved: boolean;
    specialElectionCalendarLastTransactionDate: string;
    sourceFinalPeriodEndsBeforeCalendarLastTransactionDate: boolean;
    reportCalendarPeriodMismatchNeedsReview: boolean;
  };
  interpretation: {
    historicalPublicByIndependentProof: false;
    noDonorNamesAddressesOrPdfTextStored: true;
    noProductionDbReadsOrWrites: true;
    official2021To2025CompletenessCertified: false;
    noForecastEligibilityApproved: true;
  };
}
const path = new URL('../docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json', import.meta.url);
const content = readFileSync(path, 'utf8');
const source: StoredProof = JSON.parse(content) as StoredProof;
const validSha = (value: string) => /^[0-9a-f]{64}$/.test(value);

test('persisted CFB snapshot is a bounded, real-source, read-only provenance record', () => {
  assert.equal(source.schemaVersion, 'cfb-sd6-2025-official-pdf-provenance-v1');
  assert.equal(source.recordedFrom.actionRun, 37997701770);
  assert.equal(source.recordedFrom.actionArtifactId, 11647469147);
  assert.equal(source.scope.registrationNumber, '19205');
  assert.equal(source.scope.reportYear, 2025);
  assert.equal(source.scope.officialAllSenateFilerDenominator, null);
  assert.equal(source.scope.requiredReportDenominator, null);
  assert.equal(source.reports.length, 5);
  assert.equal(Object.keys(source.officialCalendars).length, 2);
  assert.equal(source.interpretation.historicalPublicByIndependentProof, false);
  assert.equal(source.interpretation.noDonorNamesAddressesOrPdfTextStored, true);
  assert.equal(source.interpretation.noProductionDbReadsOrWrites, true);
  assert.equal(source.interpretation.official2021To2025CompletenessCertified, false);
  assert.equal(source.interpretation.noForecastEligibilityApproved, true);
});

test('all five exact source report PDF hashes, calendar hashes and conservative bounds are traceable', () => {
  const unique = new Set<string>();
  for (const report of source.reports) {
    assert.match(report.reportId, /^19205:25:pcc:(C|E|YE):[01]:[01]$/);
    assert.ok(!unique.has(report.reportId));
    unique.add(report.reportId);
    const locator = new URL(report.sourceUrl);
    assert.equal(locator.protocol, 'https:');
    assert.equal(locator.hostname, 'cfb.mn.gov');
    assert.equal(locator.searchParams.get('regnum'), '19205');
    assert.equal(locator.searchParams.get('amend'), String(report.amendmentIndexFromViewer));
    assert.ok(validSha(report.sourcePdfSha256));
    assert.ok(report.sourcePdfBytes > 300);
    assert.equal(new Date(report.sourceFetchedAt).getUTCFullYear(), 2026);
    const calendar = source.officialCalendars[report.calendarSource];
    assert.ok(calendar);
    assert.equal(calendar.scopeAndDateMarkersVerified, true);
    assert.ok(validSha(calendar.pdfSha256));
    assert.ok(calendar.bytes > 500);
    assert.equal(new URL(calendar.url).protocol, 'https:');
    assert.ok(new URL(calendar.url).hostname.endsWith('cfb.mn.gov'));
    assert.ok(report.reportCoverageStartOn <= report.reportCoverageEndOn);
    assert.equal(cfbElectronicReportAvailableOn(
      report.officialReceivedOn,
      report.statutoryDueOnFromCaseSpecificCalendar,
    ), report.conservativeLegalAndFilingBoundOn);
    assert.equal(report.historicallyPublicByOn, null);
    assert.equal(report.exactRowContainmentVerified, false);
    assert.equal(report.historicalAsOfEligible, false);
  }
});

test('original year-end report was filed early, the later amendment stays separately gated', () => {
  const yearEnd = source.reports.find(r => r.reportId === '19205:25:pcc:YE:0:0');
  const amendment = source.reports.find(r => r.reportId === '19205:25:pcc:YE:0:1');
  assert.ok(yearEnd);
  assert.ok(amendment);
  assert.equal(yearEnd.officialReceivedOn, '2026-01-30');
  assert.equal(yearEnd.statutoryDueOnFromCaseSpecificCalendar, '2026-02-02');
  assert.equal(yearEnd.conservativeLegalAndFilingBoundOn, '2026-02-03');
  assert.equal(yearEnd.amendedVersionNotSeparateRequiredReport, false);
  assert.equal(amendment.officialReceivedOn, '2026-05-24');
  assert.equal(amendment.conservativeLegalAndFilingBoundOn, '2026-05-25');
  assert.equal(amendment.amendedVersionNotSeparateRequiredReport, true);
  assert.notEqual(amendment.sourcePdfSha256, yearEnd.sourcePdfSha256);
});

test('source periods are contiguous but final special-period conflict remains an open finding', () => {
  const specialFinal = source.reports.find(r => r.reportId === '19205:25:pcc:YE:1:0');
  const yearEnd = source.reports.find(r => r.reportId === '19205:25:pcc:YE:0:0');
  assert.ok(specialFinal && yearEnd);
  assert.equal(specialFinal.reportCoverageStartOn, '2025-01-01');
  assert.equal(specialFinal.reportCoverageEndOn, '2025-05-14');
  assert.equal(yearEnd.reportCoverageStartOn, '2025-05-15');
  assert.equal(yearEnd.reportCoverageEndOn, '2025-12-31');
  const nextDate = new Date(specialFinal.reportCoverageEndOn + 'T00:00:00Z');
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  assert.equal(nextDate.toISOString().slice(0, 10), yearEnd.reportCoverageStartOn);
  assert.equal(source.periodReview.nextDayContiguityObserved, true);
  assert.equal(source.periodReview.specialElectionCalendarLastTransactionDate, '2025-05-20');
  assert.equal(source.periodReview.sourceFinalPeriodEndsBeforeCalendarLastTransactionDate, true);
  assert.equal(source.periodReview.reportCalendarPeriodMismatchNeedsReview, true);
  assert.ok(specialFinal.conservativeLegalAndFilingBoundOn < yearEnd.conservativeLegalAndFilingBoundOn);
});

test('source snapshot has no full PDF text or contributor details, and never certifies completeness', () => {
  assert.ok(!content.includes('contributorName'));
  assert.ok(!content.includes('contributorAddress'));
  assert.ok(!content.includes('rawPdfBody'));
  assert.ok(!content.includes('reportPdfText'));
  assert.ok(source.reports.every(r => r.historicallyPublicByOn === null && r.historicalAsOfEligible === false));
});

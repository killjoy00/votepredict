import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const raw = readFileSync(new URL(
  '../docs/evaluation/source-proof/cfb-2021-25-calendar-archive-house64a-source-proof.json',
  import.meta.url), 'utf8');
interface Capture {
  workflowRun: number;
  artifactId: number;
  rawIndexHtmlSha256: string;
  sourceIndexUrl: string;
  indexOriginalResponseBytes: number;
}
interface Proof {
  schemaVersion: string;
  officialCapture: Capture;
  archiveYearCounts: Array<{
    year: number;
    status: string;
    calendarLinks: number | null;
    senateSpecialCalendarLabels: number | null;
    ambiguousChamberLabels: number | null;
  }>;
  observedCalendarLinks: number;
  distinctOriginalPdfUrlsInIndex: number;
  officeMislabel: {
    archiveYear: number;
    archiveTitle: string;
    archivePdfUrl: string;
    verifiedOriginalPdfTitle: string;
    originalRawPdfSha256: string;
    originalRawPdfBytes: number;
    verifiedAgainstOriginalPdf: boolean;
    countsAsUnambiguousSenateSpecialElectionCalendar: boolean;
  };
  senate6CalendarComparison: {
    standalone: { originalRawPdfSha256: string; finalReportPeriodEndOn: string; statutoryFinalReportDueOn: string };
    candidatePacket: {
      originalRawPdfSha256: string;
      finalReportPeriodEndOn: string;
      separateSubsidyCycleEndsOn: string;
      statutoryFinalReportDueOn: string;
    };
    distinctPeriodVersionsBothOfficiallyVerified: boolean;
    controllingVersionOrErratumIndependentlyProven: boolean;
  };
  exclusion: {
    archive2021And2022UnlistedDoesNotMeanCalendarNeverExisted: boolean;
    officialAllSenateRegisteredFilerDenominator: null;
    officialRequiredReportDenominator: null;
    officialActualFilingDenominator: null;
    independentHistoricalPublicByOn: null;
    exactTransactionContainmentVerified: false;
    historicalAsOfEligibilityCertified: false;
    noReportOrDonorPdfBodyStored: true;
    productionDataReadOrModified: false;
    forecastOrModelChanged: false;
  };
}
const ledger = JSON.parse(raw) as Proof;
const sha = (value: string) => /^[a-f0-9]{64}$/.test(value);

test('2026-10-10 CFB source snapshot is publicly auditable by workflow and immutable official original hashes', () => {
  assert.equal(ledger.schemaVersion, 'cfb-2021-25-calendar-archive-house64a-source-proof-v1');
  assert.equal(ledger.officialCapture.workflowRun, 38059292835);
  assert.equal(ledger.officialCapture.artifactId, 11671309735);
  assert.equal(ledger.officialCapture.sourceIndexUrl,
    'https://register.cfb.mn.gov/filer-resources/disclosure-publications/calendars/calendars-archive/');
  assert.ok(sha(ledger.officialCapture.rawIndexHtmlSha256));
  assert.ok(ledger.officialCapture.indexOriginalResponseBytes > 5_000);
  assert.equal(ledger.observedCalendarLinks, 22);
  assert.equal(ledger.distinctOriginalPdfUrlsInIndex, 21);
});

test('year-level archive index counting never treats missing 2021 or 2022 entries as zero report obligations', () => {
  const summary = ledger.archiveYearCounts;
  assert.deepEqual(summary.map(x => x.year), [2021, 2022, 2023, 2024, 2025]);
  assert.equal(summary[0]?.status, 'year_not_listed');
  assert.equal(summary[1]?.calendarLinks, null);
  assert.deepEqual(summary.slice(2).map(x => x.calendarLinks), [3, 9, 10]);
  assert.equal(summary.slice(2).reduce((sum, x) => sum + x.calendarLinks!, 0), ledger.observedCalendarLinks);
  assert.equal(summary[4]?.senateSpecialCalendarLabels, 4);
  assert.equal(summary[4]?.ambiguousChamberLabels, 1);
  assert.equal(ledger.exclusion.archive2021And2022UnlistedDoesNotMeanCalendarNeverExisted, true);
});

test('original House 64A calendar corrects mislabeled Senate District 64A link without inflating Senate count', () => {
  const item = ledger.officeMislabel;
  assert.equal(item.archiveYear, 2025);
  assert.equal(item.archiveTitle, 'Senate District 64A special election');
  assert.equal(item.verifiedOriginalPdfTitle, 'House District 64A Special Election Public Disclosure Calendar');
  assert.equal(new URL(item.archivePdfUrl).hostname, 'register.cfb.mn.gov');
  assert.ok(sha(item.originalRawPdfSha256));
  assert.ok(item.originalRawPdfBytes > 500);
  assert.equal(item.verifiedAgainstOriginalPdf, true);
  assert.equal(item.countsAsUnambiguousSenateSpecialElectionCalendar, false);
});

test('two independently hashed official Senate District 6 documents disagree only on final period, not due', () => {
  const pair = ledger.senate6CalendarComparison;
  assert.ok(sha(pair.standalone.originalRawPdfSha256));
  assert.ok(sha(pair.candidatePacket.originalRawPdfSha256));
  assert.notEqual(pair.standalone.originalRawPdfSha256, pair.candidatePacket.originalRawPdfSha256);
  assert.equal(pair.standalone.finalReportPeriodEndOn, '2025-05-14');
  assert.equal(pair.candidatePacket.finalReportPeriodEndOn, '2025-05-20');
  assert.equal(pair.candidatePacket.separateSubsidyCycleEndsOn, '2025-05-14');
  assert.equal(pair.standalone.statutoryFinalReportDueOn, '2025-05-27');
  assert.equal(pair.candidatePacket.statutoryFinalReportDueOn, '2025-05-27');
  assert.equal(pair.distinctPeriodVersionsBothOfficiallyVerified, true);
  assert.equal(pair.controllingVersionOrErratumIndependentlyProven, false);
});

test('durable source ledger does not contain private donor rows or authorize any historical reclassification', () => {
  assert.ok(!raw.includes('"originalPdfText"'));
  assert.ok(!raw.includes('"contributors"'));
  assert.ok(!raw.includes('"donorAddress"'));
  assert.equal(ledger.exclusion.officialAllSenateRegisteredFilerDenominator, null);
  assert.equal(ledger.exclusion.officialRequiredReportDenominator, null);
  assert.equal(ledger.exclusion.officialActualFilingDenominator, null);
  assert.equal(ledger.exclusion.independentHistoricalPublicByOn, null);
  assert.equal(ledger.exclusion.exactTransactionContainmentVerified, false);
  assert.equal(ledger.exclusion.historicalAsOfEligibilityCertified, false);
  assert.equal(ledger.exclusion.noReportOrDonorPdfBodyStored, true);
  assert.equal(ledger.exclusion.productionDataReadOrModified, false);
  assert.equal(ledger.exclusion.forecastOrModelChanged, false);
});

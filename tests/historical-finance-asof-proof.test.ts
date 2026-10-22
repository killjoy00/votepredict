import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  certifiedHistoricalFinanceAvailableOn,
  certifiedHistoricalFinanceAvailableOnSql,
  type HistoricalFinanceAsOfProof,
} from '../src/evaluation/historical-finance-asof-proof.js';
import {
  isHistoricalEvidenceUsableBefore,
} from '../src/evaluation/historical-evidence-two-clock.js';

const sha = 'a'.repeat(64);
const certified: HistoricalFinanceAsOfProof = {
  asOfEligible: 'true',
  transactionDateIsAvailability: 'false',
  transactionDate: '2024-10-10',
  publicationDay: '2025-02-02',
  historicalFinanceIndependentVerification: 'authenticated_source_bytes_exact_row',
  historicalFinanceProofType: 'official_report_exact_version',
  historicalFinanceProofDigest: sha,
  historicalFinanceVerifiedPublicByOn: '2025-02-02',
  historicalFinanceExactReportVersionId: 'reg-2024-yearend-original',
  historicalFinanceStatutoryFloorOn: '2025-02-01',
};

test('legacy asOfEligible, publication timestamps and filing-only legal floors never certify historical finance', () => {
  assert.equal(certifiedHistoricalFinanceAvailableOn({ asOfEligible: 'true', publicationDay: '2022-03-01' }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, historicalFinanceIndependentVerification: null,
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, historicalFinanceProofType: 'cfb_report_filing',
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, historicalFinanceProofType: 'official_report_exact_version',
    historicalFinanceExactReportVersionId: null,
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, historicalFinanceProofDigest: 'not-a-source-hash',
  }), null);
});

test('source-verified version chronology fails closed on due floor, transaction date, and missing dates', () => {
  assert.equal(certifiedHistoricalFinanceAvailableOn(certified), '2025-02-02');
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, historicalFinanceVerifiedPublicByOn: '2025-01-31',
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, historicalFinanceVerifiedPublicByOn: '2024-10-09',
    historicalFinanceStatutoryFloorOn: '2024-10-01',
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, publicationDay: '2025-02-30',
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...certified, publicationDay: '2025-01-01',
  }), '2025-02-02', 'a claimed earlier saved timestamp cannot advance authenticated publication');
  assert.equal(isHistoricalEvidenceUsableBefore({
    availableOn: certifiedHistoricalFinanceAvailableOn(certified),
  }, '2025-02-02', 'public_availability'), false);
  assert.equal(isHistoricalEvidenceUsableBefore({
    availableOn: certifiedHistoricalFinanceAvailableOn(certified),
  }, '2025-02-03', 'public_availability'), true);
});

test('independently reauthenticated official bulk archive uses capture, not activity or original filing', () => {
  const archive: HistoricalFinanceAsOfProof = {
    ...certified,
    historicalFinanceProofType: 'archived_official_bulk_exact_row',
    historicalFinanceExactReportVersionId: null,
    historicalFinanceStatutoryFloorOn: null,
    historicalFinanceVerifiedPublicByOn: '2025-05-04',
    historicalFinanceVerifiedArchiveCaptureOn: '2025-05-04',
    historicalFinanceVerifiedArchiveDigest: 'independently-verified-cdx-digest',
  };
  assert.equal(certifiedHistoricalFinanceAvailableOn(archive), '2025-05-04');
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...archive, historicalFinanceVerifiedArchiveDigest: null,
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...archive, historicalFinanceVerifiedPublicByOn: '2025-05-03',
  }), null);
  assert.equal(certifiedHistoricalFinanceAvailableOn({
    ...archive, historicalFinanceVerifiedArchiveCaptureOn: '2025-05-03',
    publicationDay: '2025-05-06',
  }), '2025-05-06');
});

test('both historic diagnostic finance SQL consumers use shared source-proof predicate rather than stored eligibility alone', () => {
  const condition = certifiedHistoricalFinanceAvailableOnSql();
  assert.match(condition, /authenticated_source_bytes_exact_row/);
  assert.match(condition, /official_report_exact_version/);
  assert.match(condition, /archived_official_bulk_exact_row/);
  assert.match(condition, /historicalFinanceStatutoryFloorOn/);
  assert.match(condition, /historicalFinanceVerifiedArchiveCaptureOn/);
  assert.match(condition, /transactionDateIsAvailability/);
  assert.match(condition, /CASE WHEN/);
  for (const path of [
    'scripts/closeout-historical-evidence.ts',
    'scripts/evaluate-historical-finance-two-clock.ts',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /import \{ certifiedHistoricalFinanceAvailableOnSql \}/);
    assert.match(source, /\$\{certifiedHistoricalFinanceAvailableOnSql\(\)\}/);
    assert.match(source, /DISTINCT ON \(sd\.source_kind, ei\.metadata->>'filerRegistrationNumber'/);
    assert.match(source, /metadata->>'year' IN \('2021','2022','2023','2024','2025'\)/);
    assert.match(source, /source_kind='campaign_finance_candidate_contribution_bulk'/);
    assert.match(source, /source_kind='campaign_finance_candidate_expenditure_bulk'/);
  }
  const closeout = readFileSync('scripts/closeout-historical-evidence.ts', 'utf8');
  assert.match(closeout, /certifiedHistoricalFinanceAvailableOnSql\(\)\} IS NOT NULL/);
  const twoClock = readFileSync('scripts/evaluate-historical-finance-two-clock.ts', 'utf8');
  assert.match(twoClock, /AS "availableOn"/);
  assert.match(twoClock, /AS "activityOn"/, 'retrospective activity diagnostic is separately retained');
});

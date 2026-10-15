import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCHEMA, verifyAll830SenateCFBPDFSourceVersionsV41 } from '../scripts/audit-cfb-864-830-full-pdf-source-v41.mjs';
import { historicalOfficialFilingContextForSenator, historicalOfficialFilingInventoryTotals,
  officialFilingStatusLabel } from '../src/evidence/cfb-historical-official-filings.ts';

const p = verifyAll830SenateCFBPDFSourceVersionsV41();
test('V41 independent offline reconstruction preserves 830 original/amended source identities and all 240 newly obtained PDFs', () => {
  assert.equal(p.schema, SCHEMA);
  assert.equal(p.allIndexedFilingVersionReferences, 830);
  assert.equal(p.completeOfficialGovernmentPDFVersionSources, 830);
  assert.equal(p.distinctWholeGovernmentPdfBodies, 813);
  assert.equal(p.sameBinaryIndexedVersionAliases, 17);
  assert.equal(p.newOriginalPDFVersionSources, 240);
  assert.equal(p.newlyDistinctPdfBodies, 234);
  assert.equal(p.independentlyReproducedNewPDFVersions, 240);
  assert.equal(p.missingPdfBinarySources, 0);
});
test('historically serving senators' + ' official source profiles expose newly recovered 2021 files rather than claiming PDFs never existed', () => {
  const bonnie = historicalOfficialFilingContextForSenator('Bonnie Westlin', 'senate');
  assert.equal(bonnie?.filings.find(f => f.id === '18021:21:pcc:YE:0:0')?.status, 'official_pdf_downloaded_unparsed');
  const totals = historicalOfficialFilingInventoryTotals();
  assert.equal(totals.senators, 95); assert.equal(totals.versions, 830);
  assert.equal(totals.downloadedVersions, 830);
  assert.equal(totals.distinctDownloadedPdfBodies, 813);
  assert.equal(totals.indexedVersionsAwaitingPdfDownload, 0);
  assert.match(officialFilingStatusLabel('official_pdf_downloaded_unparsed'), /downloaded/);
});
test('current government PDF source capture never establishes historic publication or statutory complete filing obligation census', () => {
  assert.equal(p.historicalIndependentExactVersionPublicByDatesProven, 0);
  assert.equal(p.legallyRequiredReportObligationDenominator, null);
  assert.equal(p.originalFinancialAmountsFullyReconciled, false);
  assert.equal(p.noPrivateDBOrModelEligibilityProductionChanges, true);
});
test('dedicated source-replay workflow does not expose raw source PDFs, donor rows or protected production credentials', () => {
  const y = readFileSync('.github/workflows/senate-864-830-full-source-PDF-verification-v41.yml', 'utf8');
  assert.match(y, /pull_request:/);
  assert.match(y, /contents: read/);
  assert.match(y, /audit-cfb-864-830-full-pdf-source-v41.mjs/);
  assert.doesNotMatch(y, /NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|issues: write|gh run|deploy/i);
});

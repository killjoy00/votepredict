import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCHEMA,auditNarrowOwnerReviewV45}
 from '../scripts/audit-cfb-864-nine-five-owner-resolution-v45.mjs';
import {historicalOfficialFilingContextForSenator,
 officialFilingDisplayTitle,officialFilingReviewLabel,historicalOfficialFilingInventoryTotals}
 from '../src/evidence/cfb-historical-official-filings.ts';

test('source-pinned 830 CFB original report version identities with 4 money, 3 emails, 2 handwritten unknown and 5 later review dates',()=>{
 const x=auditNarrowOwnerReviewV45();
 assert.equal(x.schema,SCHEMA);
 assert.equal(x.sourceIndexedGovernmentReportVersionsPreserved,830);
 assert.equal(x.sourceWholePdfBodiesPreserved,813);
 assert.equal(x.newlyOwnerAcceptedBoardCrosscheckedOriginalTotals,4);
 assert.equal(x.nonFinancialCorrespondenceAttachmentsExcludedFromMonetaryReview,3);
 assert.equal(x.stillUnknownHandwrittenIsaacson2022ReportVersions,2);
 assert.equal(x.sourceDateConflictsUsingLaterPrintedDateForReview,5);
 assert.equal(x.originalBoardReceiptStampsCorrectedOrDeleted,0);
 assert.equal(x.newHistoricalFirstPublicByClaims,0);
 assert.equal(x.noHistoricalEligibilityModelOrProductionDbChange,true);
});
test('four user accepted original year-end money values display with official Board annual rollup dates, no added donations',()=>{
 const examples=[
  ['Thomas M. Bakk','17140:21:pcc:YE:0:0',7655912,'2021-12-31'],
  ['Thomas M. Bakk','17140:22:pcc:YE:0:0',102500,'2022-12-31'],
  ['Jason Isaacson','17929:21:pcc:YE:0:0',583020,'2021-12-31'],
  ['Jerry Newton','18004:21:pcc:YE:0:0',110000,'2021-12-31']
 ];
 for(const [name,id,cents,date] of examples){
  const filing=historicalOfficialFilingContextForSenator(name,'senate')?.filings.find(x=>x.id===id);
  assert.ok(filing);
  assert.equal(filing.review?.acceptedTotalReceiptsCents,cents);
  assert.equal(filing.review?.effectiveReviewOn,date);
  assert.match(officialFilingReviewLabel(filing),/Receipts.*corroborated by official CFB annual summary/);
 }
});
test('correspondence stays indexed but excluded from financial amended totals; Isaacson ambiguous handwritten values stay unknown',()=>{
 const emails=[
  ['Aric Putnam','18430:21:pcc:YE:0:1'],
  ['Omar Fateh','18488:21:pcc:YE:0:1'],
  ['Zaynab Mohamed','18730:21:pcc:YE:0:1']
 ];
 for(const [name,id] of emails){
  const filing=historicalOfficialFilingContextForSenator(name,'senate')?.filings.find(x=>x.id===id);
  assert.ok(filing);
  assert.equal(filing.kind,'amended');
  assert.equal(filing.review?.acceptedTotalReceiptsCents,null);
  assert.match(officialFilingDisplayTitle(filing),/correspondence \(CFB-indexed amendment 1\)/);
  assert.match(officialFilingReviewLabel(filing),/excluded from monetary totals/);
 }
 const isaacson=historicalOfficialFilingContextForSenator('Jason Isaacson','senate');
 for(const id of ['17929:22:pcc:YE:0:0','17929:22:pcc:YE:0:1']){
  const filing=isaacson?.filings.find(x=>x.id===id);
  assert.equal(filing?.review?.acceptedTotalReceiptsCents,null);
  assert.equal(filing?.review?.effectiveReviewOn,null);
  assert.match(officialFilingReviewLabel(filing),/amount not used/);
 }
 assert.equal(isaacson?.observedVersions,3);
});
test('five latest-of-two dates resolve for review without replacing original government stamps or establishing publication dates',()=>{
 const sample=[
  ['Bill G. Ingebrigtsen','2022-09-17','2022-12-31'],
  ['Paul E. Gazelka','2021-09-26','2021-12-31'],
  ['Melisa López Franzen','2022-11-05','2022-12-31'],
  ['Andrew R. Lang','2023-12-29','2023-12-31'],
  ['Bruce Douglas Anderson','2025-10-09','2025-12-31']
 ];
 for(const [name,stamp,later] of sample){
  const member=historicalOfficialFilingContextForSenator(name,'senate');
  const reviewed=member?.filings.filter(x=>x.review?.reviewDisposition==='later_of_printed_stamp_or_period_end_used_for_review');
  assert.equal(reviewed?.length,1);
  assert.equal(reviewed[0].review?.originalPrintedBoardReceivedOn,stamp);
  assert.equal(reviewed[0].review?.effectiveReviewOn,later);
  assert.match(officialFilingReviewLabel(reviewed[0]),new RegExp(later));
 }
 const totals=historicalOfficialFilingInventoryTotals();
 assert.equal(totals.versions,830);
 assert.equal(totals.distinctDownloadedPdfBodies,813);
 const page=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
 assert.equal(page.split('officialFilingReviewLabel(filing)').length-1,2);
 assert.match(page,/original stamp and historical public-by remain unchanged/);
});
test('source-only CI cannot write private production DB, historical model eligibility or create public artifact exports',()=>{
 const yaml=readFileSync('.github/workflows/senate-864-nine-five-owner-resolution-v45.yml','utf8');
 assert.match(yaml,/pull_request:/);
 assert.match(yaml,/contents: read/);
 assert.match(yaml,/audit-cfb-864-nine-five-owner-resolution-v45.mjs/);
 assert.doesNotMatch(yaml,/secrets\.|NEON|upload-artifact|schedule:|workflow_dispatch|deploy|issues: write|gh run/i);
});

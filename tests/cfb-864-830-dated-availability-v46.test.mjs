import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditEveryOfficialCFBDocumentHasPracticalDateV46}
 from '../scripts/audit-cfb-864-830-dated-availability-v46.mjs';
import {historicalOfficialFilingContextForSenator,
 officialFilingEstimatedAvailabilityLabel}
 from '../src/evidence/cfb-historical-official-filings.ts';

test('all 830 exact current CFB report PDF versions receive an independently replayed source-labelled date',()=>{
 const x=auditEveryOfficialCFBDocumentHasPracticalDateV46();
 assert.equal(x.datedDocuments,830);
 assert.equal(x.exactOriginalBoardDateDerived,807);
 assert.equal(x.wholePdfSameBodyInherited,13);
 assert.equal(x.releaseScheduleAssumedTimelyForUndatedOriginals,6);
 assert.equal(x.websiteFirstObservedFallbackOnly,4);
 assert.equal(x.statutoryFloorEnforcedOnAll,830);
 assert.equal(x.independentExactHistoricPublicationDatesProven,0);
 assert.equal(x.existingHistoricalModelEligibilityRecomputed,false);
});
test('early year-end CFB receipt never becomes available before the statutory due-date release floor',()=>{
 const b=historicalOfficialFilingContextForSenator('Bill G. Ingebrigtsen','senate');
 const x=b?.filings.find(z=>z.id==='16311:22:pcc:YE:0:0');
 assert.ok(x);
 assert.equal(x.availability?.boardReceivedOnOriginal,'2022-09-17');
 assert.equal(x.availability?.estimatedAvailableOn,'2023-02-01');
 assert.equal(x.review?.effectiveReviewOn,'2022-12-31');
});
test('2025 year-end calendar due Feb 2 2026 not Jan31, all special-cycle periods get own due rule',()=>{
 const a=historicalOfficialFilingContextForSenator('Bill Weber','senate')?.filings
  .find(z=>z.id==='17404:25:pcc:YE:0:1');
 assert.equal(a?.availability?.estimatedAvailableOn,'2026-02-03');
 const clark=historicalOfficialFilingContextForSenator('Doron Clark','senate')?.filings
  .find(z=>z.id==='19196:24:pcc:E:1:0');
 assert.equal(clark?.availability?.estimatedAvailableOn,'2025-01-22');
 assert.equal(clark?.availability?.method,'scheduled_release_assuming_filed_on_time');
});
test('undated email version uses confirmed website observation, not original-report release date',()=>{
 const a=historicalOfficialFilingContextForSenator('Aric Putnam','senate')?.filings
  .find(z=>z.id==='18430:21:pcc:YE:0:1');
 assert.equal(a?.review?.reviewDisposition,'correspondence_attachment_excluded_from_monetary_reconciliation');
 assert.equal(a?.availability?.estimatedAvailableOn,'2026-10-11');
 assert.equal(a?.availability?.method,'first_observed_official_site_copy');
 assert.match(officialFilingEstimatedAvailabilityLabel(a),/first confirmed website observation/);
});
test('all 95 member profiles expose an availability row for every source PDF without rewriting historical eligibility',()=>{
 const source=JSON.parse(readFileSync('data/cfb-senate-official-filings-2021-25-v41.json','utf8'));
 assert.equal(source.senators.length,95);
 let count=0;
 for(const s of source.senators){
  const context=historicalOfficialFilingContextForSenator(s.name,'senate');
  assert.equal(context?.filings.length,s.filings.length);
  for(const f of context.filings){
   assert.match(f.availability?.estimatedAvailableOn??'',/^\d{4}-\d{2}-\d{2}$/);
   assert.match(officialFilingEstimatedAvailabilityLabel(f)??'',/^Estimated available /);
   count++;
  }
 }
 assert.equal(count,830);
 const page=readFileSync('src/app/dashboard/legislators/[legislatorId]/page.tsx','utf8');
 assert.equal(page.split('officialFilingEstimatedAvailabilityLabel(filing)').length-1,2);
 assert.match(page,/never silently rewrite existing stored prediction eligibility/);
});

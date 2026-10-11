/**
 * #864: 71 original public CFB version refs are not 71 historical public-by
 * confirmations, 71 legally required forms or 71 separate finance binaries.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {originalCfbYearEndLegalReleaseThreshold}
  from '../src/evidence/cfb-2023-24-yearend-statutory-thresholds.js';
import {
  parseCfb2023to24SourceVersionStatutoryBounds,
  assessCfb2023to24HistoricalAvailability,
} from '../src/evidence/cfb-2023-24-71-version-disclosure-barriers.js';
const P='docs/evaluation/source-proof/';
const name='cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const raw=readFileSync(P+name,'utf8');
const ledger=parseCfb2023to24SourceVersionStatutoryBounds(raw);
const check=JSON.parse(readFileSync(P+
  'cfb-2023-24-served-22-71-yearend-legal-release-and-publicby-checkpoint.json','utf8'));
test('all 71 independently viewed source keys are exact 2023/24 YE identities, never model eligible',()=>{
 assert.equal(ledger.length,71);
 assert.equal(ledger.filter(r=>r.reportYear===2023).length,32);
 assert.equal(ledger.filter(r=>r.reportYear===2024).length,39);
 assert.equal(ledger.filter(r=>r.reportKind==='original').length,44);
 assert.equal(ledger.filter(r=>r.reportKind==='amended').length,27);
 assert.equal(new Set(ledger.map(r=>r.officialViewerReportVersionId)).size,71);
 assert.equal(new Set(ledger.map(r=>r.committeeRegistrationNumber)).size,22);
 assert.equal(ledger.filter(r=>r.sourcePdfStatus==='original_pdf_first_page_authenticated').length,43);
 assert.equal(ledger.filter(r=>r.sourcePdfStatus==='distinct_authenticated_amended_pdf').length,25);
 assert.equal(ledger.filter(r=>r.sourcePdfStatus.startsWith('HOLD_')).length,2);
 assert.equal(ledger.filter(r=>r.sourcePdfStatus==='duplicate_official_amendment_reference_pdf_alias').length,1);
 assert.ok(ledger.every(r=>r.actual2022ServingSenator.length>5
   &&r.districtActuallyServed2022>0&&r.legalYearEndDueOn>r.periodEndOn
   &&r.actualHistoricalPublicByOn===null&&r.thisExactReportLegallyOwed===null
   &&r.historicalForecastEligible===false));
});
test('original §10A.20 8am release floor cannot be replaced by earlier Board-printed receipt',()=>{
 const early=ledger.find(x=>x.officialViewerReportVersionId==='16891:23:pcc:YE:0:0');
 assert.ok(early);
 assert.equal(early.paperBoardReceivedOn,'2024-01-12');
 assert.equal(early.statutoryNotBeforeLocal,'2024-02-01T08:00:00[America/Chicago]');
 assert.equal(early.earliestPossibleDateFloor,'2024-02-01');
 assert.equal(assessCfb2023to24HistoricalAvailability(early,'2024-01-31').assessment,
   'statutory_release_or_recorded_receipt_proves_not_yet_public');
 assert.equal(assessCfb2023to24HistoricalAvailability(early,'2024-02-01').assessment,
   'release_day_intraday_clock_not_established');
 assert.equal(assessCfb2023to24HistoricalAvailability(early,'2024-02-02').assessment,
   'actual_historical_public_display_still_unproven');
 const early24=ledger.find(x=>x.officialViewerReportVersionId==='18430:24:pcc:YE:0:0');
 assert.ok(early24);
 assert.equal(early24.statutoryNotBeforeLocal,'2025-02-01T08:00:00[America/Chicago]');
 assert.equal(assessCfb2023to24HistoricalAvailability(early24,'2025-01-31').assessment,
   'statutory_release_or_recorded_receipt_proves_not_yet_public');
 assert.equal(assessCfb2023to24HistoricalAvailability(early24,'2025-02-01').assessment,
   'release_day_intraday_clock_not_established');
 assert.equal(assessCfb2023to24HistoricalAvailability(early24,'2025-02-03').assessment,
   'actual_historical_public_display_still_unproven');
});
test('amendment printed receipt after legal release bounds earliest possible date but not actual public-by',()=>{
 const late=ledger.find(x=>x.officialViewerReportVersionId==='18430:23:pcc:YE:0:3');
 assert.ok(late);
 assert.equal(late.paperBoardReceivedOn,'2025-04-07');
 assert.equal(late.earliestPossibleDateFloor,'2025-04-07');
 assert.equal(late.legalYearEndDueOn,'2024-01-31');
 assert.equal(assessCfb2023to24HistoricalAvailability(late,'2024-12-31').assessment,
   'statutory_release_or_recorded_receipt_proves_not_yet_public');
 assert.equal(assessCfb2023to24HistoricalAvailability(late,'2025-04-07').assessment,
   'actual_historical_public_display_still_unproven');
 assert.equal(late.actualHistoricalPublicByOn,null);
 assert.equal(late.historicalForecastEligible,false);
});
test('two exact identity holds and one official duplicate viewer-index alias cannot become separate historical forms',()=>{
 const lang=ledger.find(x=>x.officialViewerReportVersionId==='17994:23:pcc:YE:0:0');
 assert.ok(lang);
 assert.equal(lang.earliestPossibleDateFloor,null);
 assert.equal(assessCfb2023to24HistoricalAvailability(lang,'2026-09-30').assessment,
   'original_financial_document_identity_held');
 const putnam=ledger.find(x=>x.officialViewerReportVersionId==='18430:23:pcc:YE:0:1');
 assert.ok(putnam);
 assert.equal(putnam.earliestPossibleDateFloor,null);
 assert.equal(assessCfb2023to24HistoricalAvailability(putnam,'2025-09-30').assessment,
   'original_financial_document_identity_held');
 const alias=ledger.find(x=>x.officialViewerReportVersionId==='18430:24:pcc:YE:0:2');
 const canon=ledger.find(x=>x.officialViewerReportVersionId==='18430:24:pcc:YE:0:1');
 assert.ok(alias&&canon);
 assert.equal(alias.duplicateViewerIndexCanonicalId,canon.officialViewerReportVersionId);
 assert.equal(alias.sourcePdfSha256,canon.sourcePdfSha256);
 assert.equal(assessCfb2023to24HistoricalAvailability(alias,'2026-09-30').assessment,
   'duplicate_official_viewer_index_not_new_financial_form');
});
test('permanent primary SHA/byte source ledger and the four original PDF-source cohorts are strictly pinned',()=>{
 const git=createHash('sha1').update('blob '+Buffer.byteLength(raw,'utf8')+'\0').update(raw).digest('hex');
 assert.equal(git,check.ledger.gitBlobSha);
 assert.equal(check.ledger.rows,71);
 assert.equal(check.ledger.bytes,Buffer.byteLength(raw,'utf8'));
 assert.equal(check.originalIndependentSourceLedgers.length,4);
 const expected={
   verified28Originals:28,recovered16Originals:16,
   parentVerified16Amendments:16,recovered11Amendments:11,
 };
 for(const orig of check.originalIndependentSourceLedgers){
   const actual=readFileSync(orig.path,'utf8');
   const sha=createHash('sha1').update('blob '+Buffer.byteLength(actual,'utf8')+'\0')
     .update(actual).digest('hex');
   assert.equal(sha,orig.gitBlobSha);
   assert.equal(actual.trimEnd().split('\n').length,expected[orig.cohort as keyof typeof expected]);
 }
 const good=ledger.filter(r=>r.sourcePdfStatus==='original_pdf_first_page_authenticated'
   ||r.sourcePdfStatus==='distinct_authenticated_amended_pdf');
 assert.equal(good.length,68);
 assert.equal(new Set(good.map(x=>x.sourcePdfSha256)).size,68);
 assert.equal(check.independentCrossLedgerAccounting.actualPublicByProvenCount,0);
 assert.equal(check.independentCrossLedgerAccounting.legallyOwedReportDenominator,null);
 assert.equal(check.safeguards.noProductionDatabaseReadOrWrite,true);
 assert.equal(check.safeguards.keepIssue864Open,true);
});
test('source SHA tamper, forged as-of, wrong due date, invalid cutoff are always rejected',()=>{
 assert.throws(()=>parseCfb2023to24SourceVersionStatutoryBounds(raw.replace(
   'Jeremy R. Miller','Not Senator')),/changed/);
 assert.throws(()=>parseCfb2023to24SourceVersionStatutoryBounds(raw.replace(
   '2024-02-01T08:00:00[America/Chicago]','2024-01-31T08:00:00[America/Chicago]')),/changed/);
 assert.throws(()=>parseCfb2023to24SourceVersionStatutoryBounds(raw.replace(
   '|-|false|verified28Originals','|2024-02-01|true|verified28Originals')),/changed/);
 assert.throws(()=>assessCfb2023to24HistoricalAvailability(ledger[0]!,'2025-02-30'),
   /exact valid YYYY-MM-DD/);
});

test('each of 71 source-derived version clocks matches merged primary Board calendar/Revisor legal anchors',()=>{
 for(const row of ledger){
  const original=originalCfbYearEndLegalReleaseThreshold(row.reportYear);
  assert.equal(row.periodStartOn,original.originalCoveredStartOn);
  assert.equal(row.periodEndOn,original.originalCoveredEndOn);
  assert.equal(row.legalYearEndDueOn,original.ordinaryYearEndDueOn);
  assert.equal(row.statutoryNotBeforeLocal,original.statutoryNonpublicUntilLocal);
  assert.ok(original.officialOriginalBoardCalendar.startsWith('https://cfb.mn.gov/pdf/calendars/'));
  assert.equal(original.actualHistoricalPublicByOn,null);
  assert.equal(original.legallyOwedFilingForAnySpecificCommittee,null);
  if(row.earliestPossibleDateFloor!==null)
   assert.ok(row.earliestPossibleDateFloor>=original.statutoryReleaseNotBeforeDate);
  assert.equal(row.actualHistoricalPublicByOn,null);
  assert.equal(row.thisExactReportLegallyOwed,null);
  assert.equal(row.historicalForecastEligible,false);
 }
});

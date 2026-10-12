import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareDueVersusReceipt,audit2025SpecialTwelveOriginalFinanceReleaseFloors} from
 '../src/evidence/cfb-2025-senate-special-12-due-vs-received-audit.js';
import {cfbElectronicReportAvailableOn} from '../src/evidence/cfb-report-availability.js';

const path='docs/evaluation/source-proof/';
const psv=readFileSync(path+'cfb-2025-senate-12-special-original-pdf-source-ledger.psv','utf8');
const checkpoint=JSON.parse(readFileSync(
 path+'cfb-2025-senate-12-special-original-pdf-source-checkpoint.json','utf8'
));
test('12 exact original report SHA and calendar source records independently enforce due-vs-received legal floor',()=>{
 const a=audit2025SpecialTwelveOriginalFinanceReleaseFloors(psv,checkpoint);
 assert.equal(a.issue,864);
 assert.deepEqual(a.counts,{
  originalPDFs:12,earlyFiled:7,onDueFiled:5,lateFiled:0,
  naiveFilingPlusOneWouldBackdate:7,
  originalReportVersionsHistoricallyPublicByProven:0,
  originalRowContainmentProven:0
 });
 assert.deepEqual(a.districtCoverage.map(d=>[d.district,d.originalReportPDFs,d.earlyFiled]),[
  [6,5,3],[29,4,2],[47,3,2]
 ]);
 const early=a.rows.filter(r=>r.earlyFiled);
 assert.deepEqual(early.map(r=>r.reportId),[
  '19207:25:pcc:C:1:0','19211:25:pcc:C:1:0','19211:25:pcc:E:1:0',
  '19233:25:pcc:C:1:0','19233:25:pcc:E:1:0',
  '19234:25:pcc:C:1:0','19234:25:pcc:E:1:0'
 ]);
 assert.equal(a.rows.every(r=>
  r.floorNotBeforeOn===cfbElectronicReportAvailableOn(r.boardReceivedOn,r.statutoryDueOn)
  && r.naiveFilingPlusOneOn<=r.floorNotBeforeOn
  && r.originalVersionPDFSHA256.length===64
  && r.independentOriginalCalendarSHA256.length===64
  && r.independentExactPDFHistoricallyPublicByOn===null
  && r.candidateOrDonationHistoricalAsOfEligible===false),true);
 assert.equal(a.no2025StatewideStatutoryFilerOrRequiredReportDenominator,true);
 assert.equal(a.originalPDFAmendmentCheckboxesIndependentlyVerified,false);
 assert.equal(a.noRetrospectivePublicByFromLater2026Fetch,true);
 assert.equal(a.noAutomaticHistoricalEligibilityOrDatabaseUpdate,true);
 assert.equal(a.issue864MustRemainOpen,true);
});
test('earlier filing does not release ordinary report until day after DUE at 8AM Chicago',()=>{
 const x=compareDueVersusReceipt('2025-10-22','2025-10-28');
 assert.equal(x.earlyFiled,true);
 assert.equal(x.naiveFilingPlusOneOn,'2025-10-23');
 assert.equal(x.floorNotBeforeOn,'2025-10-29');
 assert.equal(x.naiveFilingPlusOneWouldBackdate,true);
 assert.equal(x.statuteReleaseClock,'08:00');
 assert.equal(x.statuteReleaseTimezone,'America/Chicago');
 assert.equal(x.independentExactPDFHistoricallyPublicByOn,null);
});
test('after-due filing retains stricter filing-plus-one bound, no historical public-by inference',()=>{
 const x=compareDueVersusReceipt('2025-11-04','2025-10-28');
 assert.equal(x.lateFiled,true);
 assert.equal(x.floorNotBeforeOn,'2025-11-05');
 assert.equal(x.naiveFilingPlusOneWouldBackdate,false);
 assert.equal(x.candidateOrDonationHistoricalAsOfEligible,false);
});
test('original source mismatches, fabricated calendar changes and malformed date fail closed',()=>{
 const modified=psv.replace('2025-04-09','2025-04-08');
 assert.throws(()=>audit2025SpecialTwelveOriginalFinanceReleaseFloors(modified,checkpoint),
  /exact original commitment differs/);
 assert.throws(()=>audit2025SpecialTwelveOriginalFinanceReleaseFloors(psv.slice(0,-1),checkpoint),
  /exact original commitment differs/);
 const other=structuredClone(checkpoint);
 other.calendarPdfs[1].prePrimaryDueOn='2025-08-20';
 assert.throws(()=>audit2025SpecialTwelveOriginalFinanceReleaseFloors(psv,other),
  /due date or original source reporting period/);
 const bad=structuredClone(checkpoint);
 bad.sourceAcquisition.pdfDownloadsWithBinarySha256=11;
 assert.throws(()=>audit2025SpecialTwelveOriginalFinanceReleaseFloors(psv,bad),
  /source checkpoint changed/);
 assert.throws(()=>compareDueVersusReceipt('2025-02-30','2025-03-03'),/invalid calendar day/);
});

test('immutable report freezes all twelve source-derived no-publication-by legal-floor rows exactly',()=>{
 const recorded=JSON.parse(readFileSync(path+
  'cfb-2025-senate-12-special-due-vs-received-historical-release-floor-audit.json','utf8'));
 const recomputed=audit2025SpecialTwelveOriginalFinanceReleaseFloors(psv,checkpoint);
 assert.deepEqual(recorded,recomputed);
 assert.equal(recorded.rows.length,12);
 assert.equal(recorded.counts.originalReportVersionsHistoricallyPublicByProven,0);
 assert.equal(recorded.counts.originalRowContainmentProven,0);
 assert.equal(recorded.rows.every((r:{independentExactPDFHistoricallyPublicByOn:null})=>
  r.independentExactPDFHistoricallyPublicByOn===null),true);
});

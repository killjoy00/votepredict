import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {
  OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
} from '../src/evidence/senate-official-ever-served-directory.js';
import {
  reconcileServedSenatorSd6ReportCase,
} from '../src/evidence/cfb-2025-served-sd6-report-obligation-case.js';
const path='docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json';
const pinned=JSON.parse(readFileSync(path,'utf8')) as Record<string,any>;
const date='2026-10-10T23:54:21.000Z';
function service():AuditedOfficialSenateDirectory{
  return {
    schema:'mn-lrl-official-senate-ever-served-directory-v1',
    source:{url:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
      observedAt:date,sourceBytesSha256:'a'.repeat(64),sourceBytesLength:50000,
      originalHistoricDateForDisplayedDirectoryEstablished:false,
      directoryIsSenatorServiceNotCandidateFiling:true},
    supplementalSwearingSource:{url:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
      observedAt:date,sourceBytesSha256:'b'.repeat(64),sourceBytesLength:50000,
      swearingDateIndependentlyDocumentedForNamedSpecialMembers:true,
      websitePublicationDateBackdated:false},
    senators:[{officialName:'Keri Heintzeman',officialNameRaw:'Keri Heintzeman',
      officialSourceUrl:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
      senateServiceTerms:[{startsYear:2025,endsYear:null,district:'6'}]}],
  };
}
function clone(){return structuredClone(pinned);}
test('preserve four original filed reports separately from legal duty null and a fifth amendment version',()=>{
  const got=reconcileServedSenatorSd6ReportCase(service(),clone());
  assert.equal(got.schema,'cfb-2025-ever-served-senator-sd6-report-obligation-case-v1');
  assert.equal(got.scope.person,'Keri Heintzeman');
  assert.equal(got.scope.committeeRegistrationNumber,'19205');
  assert.equal(got.sourceResults.originalPdfVersionReferences,4);
  assert.equal(got.sourceResults.amendmentVersionReferences,1);
  assert.equal(got.sourceResults.originalReportPdfsAlreadyAuthenticated,4);
  assert.equal(got.sourceResults.newlyAuthenticatedPdfCount,0);
  assert.equal(got.originalReports.length,4);
  assert.equal(got.amendments.length,1);
  assert.deepEqual(got.originalReports.map(r=>r.reportType),[
    'pre_special_primary','pre_special_general','special_cycle_final','annual_year_end']);
  assert.ok(got.originalReports.every(r=>r.historicalObligationState==='unknown'
    &&r.actualOriginalFilingEvidenceState==='original_filing_verified'
    &&r.historicalPublicByEvidenceState==='historical_public_by_unknown'
    &&r.independentlyProvenHistoricalPublicBy===null
    &&r.eligibleForHistoricalForecast===false));
  assert.equal(got.committeeYearDuty.legallyRequiredReportCount,null);
  assert.equal(got.committeeYearDuty.legallyNotRequiredReportsVerified,null);
  assert.equal(got.committeeYearDuty.independentlyVerifiedNonfilerCount,null);
  assert.equal(got.committeeYearDuty.historicInitialRegistrationEffectiveAt,null);
  assert.equal(got.committeeYearDuty.historicTerminationEffectiveAt,null);
});
test('independent source identifies report-specific first-page, covered dates, Board receipt, statutory floor',()=>{
  const got=reconcileServedSenatorSd6ReportCase(service(),clone());
  const finals=got.originalReports.find(r=>r.reportType==='special_cycle_final')!;
  const annual=got.originalReports.find(r=>r.reportType==='annual_year_end')!;
  assert.equal(finals.coverageEndOn,'2025-05-14');
  assert.equal(finals.independentlyVerifiedDueOn,'2025-05-27');
  assert.equal(finals.earliestStatutoryAndReceiptBoundOn,'2025-05-28');
  assert.equal(annual.coverageStartOn,'2025-05-15');
  assert.equal(annual.boardReceivedOn,'2026-01-30');
  assert.equal(annual.independentlyVerifiedDueOn,'2026-02-02');
  assert.equal(annual.earliestStatutoryAndReceiptBoundOn,'2026-02-03');
  assert.equal(got.amendments[0]?.amendmentOf,annual.reportVersionId);
  assert.equal(got.amendments[0]?.boardReceivedOn,'2026-05-24');
  assert.equal(got.amendments[0]?.earliestStatutoryAndReceiptBoundOn,'2026-05-25');
});
test('special cycle-filing coverage disagreement is held for source review',()=>{
  const got=reconcileServedSenatorSd6ReportCase(service(),clone());
  assert.deepEqual(got.heldCoverageConflict,{
    originalSpecialFinalEndOn:'2025-05-14',
    independentlyRecordedCalendarLastTransactionOn:'2025-05-20',
    documentMismatchRequiresFurtherOriginalSourceReview:true,
    backfillOrAsOfEligibilityBlocked:true,
  });
});
test('must not label someone without verified Senate service a report originator',()=>{
  const wrong=service();
  wrong.senators=[{...wrong.senators[0]!,officialName:'Kerri Smith',officialNameRaw:'Kerri Smith'}];
  assert.throws(()=>reconcileServedSenatorSd6ReportCase(wrong,clone()),
    /official Senate service/);
});
test('deny mutated official PDF SHA, due date, assertion of public-by, or false original count',()=>{
  for(const [caseName,change] of [
    ['source SHA',(p:any)=>{p.reports[0].sourcePdfSha256='b'.repeat(64);}],
    ['fake release',(p:any)=>{p.reports[1].historicallyPublicByOn='2025-04-22';}],
    ['invented due',(p:any)=>{p.reports[0].statutoryDueOnFromCaseSpecificCalendar='2025-04-07';}],
    ['original mislabeled amendment',(p:any)=>{p.reports.find((r:any)=>r.reportId==='19205:25:pcc:YE:0:0').amendedVersionNotSeparateRequiredReport=true;}],
    ['forged period',(p:any)=>{p.periodReview.reportCalendarPeriodMismatchNeedsReview=false;}],
    ['raw missing',(p:any)=>{p.reports=p.reports.slice(1);}],
  ] as Array<[string,(p:any)=>void]>) {
    const trial=clone();change(trial);
    assert.throws(()=>reconcileServedSenatorSd6ReportCase(service(),trial),
      /./,caseName+' must fail closed');
  }
});

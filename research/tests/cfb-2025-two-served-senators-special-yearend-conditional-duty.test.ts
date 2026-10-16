import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {AuditedOfficialSenateDirectory}
  from '../../src/evidence/senate-official-ever-served-directory.js';
import {OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL}
  from '../../src/evidence/senate-official-ever-served-directory.js';
import {SERVED_2025_YE_CALENDAR,SERVED_2025_YE_CALENDAR_SHA}
  from '../../src/evidence/cfb-2025-two-served-senators-special-yearend-conditional-duty.js';
import {
  audit2025SpecialConditionalYearEndDuties,
  verifyOriginalSpecialCalendarConditional,verifyOriginal2025GeneralCalendar,
} from '../../src/evidence/cfb-2025-two-served-senators-special-yearend-conditional-duty.js';
const PREFIX='docs/evaluation/source-proof/';
const checkpoint=JSON.parse(readFileSync(
  PREFIX+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json','utf8'));
const registry=readFileSync(PREFIX+'cfb-2026-public-current-senate-registration-dates.psv','utf8');
const pinned=readFileSync(PREFIX+'cfb-2025-dated-senate-85-reference-versions.psv','utf8');
const observedAt='2026-10-11T00:26:48.000Z';
const sha='a'.repeat(64);
function official():AuditedOfficialSenateDirectory{
  return{
    schema:'mn-lrl-official-senate-ever-served-directory-v1',
    source:{url:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,observedAt,
      sourceBytesSha256:sha,sourceBytesLength:1601232,
      originalHistoricDateForDisplayedDirectoryEstablished:false,
      directoryIsSenatorServiceNotCandidateFiling:true},
    supplementalSwearingSource:{
      url:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,observedAt,
      sourceBytesSha256:sha,sourceBytesLength:330790,
      swearingDateIndependentlyDocumentedForNamedSpecialMembers:true,
      websitePublicationDateBackdated:false,
    },
    senators:[
      {officialName:'Michael Holmstrom Jr',officialNameRaw:'Michael Holmstrom Jr',
        officialSourceUrl:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
        senateServiceTerms:[{startsYear:2025,endsYear:null,district:'29'}]},
      {officialName:'Amanda Hemmingsen-Jaeger',officialNameRaw:'Amanda Hemmingsen-Jaeger',
        officialSourceUrl:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
        senateServiceTerms:[{startsYear:2025,endsYear:null,district:'47'}]},
    ],
  };
}
const condition='Candidates will be required to file a 2025 year-end report in addition to the '+
  'special election cycle final report unless the special election cycle final report is a termination report.';
function special(district:29|47){
  const pdf=checkpoint.sourceCalendars.find((c:any)=>c.district===district);
  return{district,url:pdf.url,sha256:pdf.pdfSha256,bytes:pdf.bytes,
    observedAt,text:'Senate District '+district+' Special Election Public Disclosure Calendar. '+
      '2025 December 1 Special election cycle final report of receipts and expenditures due. '+
      'Period covered: July 29 through November 19, 2025. Note: '+condition};
}
function general(){
  return{url:SERVED_2025_YE_CALENDAR,sha256:SERVED_2025_YE_CALENDAR_SHA,
    bytes:100283,observedAt,
    text:'2025 Campaign Finance Disclosure Calendar. 2026 February 2 2025 year-end '+
      'report of receipts and expenditures due. Period covered: 1/1/2025 through 12/31/2025.'};
}
function input(){
  return{official:official(),finalCheckpoint:structuredClone(checkpoint),
    registrySnapshot:registry,pinned2025ViewerLedger:pinned,
    specialCalendars:[special(29),special(47)] as const,generalCalendar:general()};
}
test('each original 2025 special calendar independently proves the explicit termination EXCEPTION',()=>{
  assert.equal(verifyOriginalSpecialCalendarConditional(special(29)).verified,true);
  assert.equal(verifyOriginalSpecialCalendarConditional(special(47)).verified,true);
  const noClause=special(29);
  noClause.text=noClause.text.replace(' unless the special election cycle final report is a termination report','');
  assert.equal(verifyOriginalSpecialCalendarConditional(noClause).verified,false);
  assert.equal(verifyOriginalSpecialCalendarConditional({...special(47),sha256:sha}).verified,false);
  assert.equal(verifyOriginalSpecialCalendarConditional({...special(29),district:47}).verified,false);
  assert.equal(verifyOriginal2025GeneralCalendar(general()),true);
  assert.equal(verifyOriginal2025GeneralCalendar({...general(),sha256:sha}),false);
});
test('conditional reporting obligation is NOT a count of actual legally owed or filed originals',()=>{
  const a=audit2025SpecialConditionalYearEndDuties(input());
  assert.equal(a.schemaVersion,'cfb-2025-actual-senators-2-special-yearend-conditional-duty-original-calendar-v1');
  assert.equal(a.actualSenateMemberCases.length,2);
  assert.deepEqual(a.actualSenateMemberCases.map(x=>x.person),
    ['Michael Holmstrom Jr','Amanda Hemmingsen-Jaeger']);
  assert.deepEqual(a.actualSenateMemberCases.map(x=>x.cfbRegistrationId),['19229','19233']);
  assert.deepEqual(a.actualSenateMemberCases.map(x=>x.currentOctober2026CFBListReportedRegistrationOn),
    ['2025-07-29','2025-08-01']);
  for(const row of a.actualSenateMemberCases){
    assert.equal(row.actualSenateServiceVerified,true);
    assert.equal(row.conditionalDutyOfficiallyEstablished,true);
    assert.equal(row.whetherOriginalCycleFinalIsTerminationReportIndependentlyVerified,null);
    assert.equal(row.originalRegistry2026ObservationProvesHistoricalEffectiveRegistration,false);
    assert.equal(row.independentlyProvenHistoricRegistrationEffectiveOn,null);
    assert.equal(row.independentlyProvenHistoricTerminationEffectiveOn,null);
    assert.equal(row.originalYearEndViewerReferenceObservedIn2026,true);
    assert.equal(row.originalYearEndPdfAuthenticatedByThisAudit,false);
    assert.equal(row.yearEndLegallyOwedForThisCommittee,null);
    assert.equal(row.annualYearEndFilingComplianceEstablished,null);
    assert.equal(row.historicallyProvenPublicByOn,null);
    assert.equal(row.historicalPredictionEligible,false);
    assert.equal(row.specialFinalDueOn,'2025-12-01');
    assert.equal(row.yearEndDueOn,'2026-02-02');
  }
  assert.equal(a.sums.conditionalOriginalCalendarRulesVerified,2);
  assert.equal(a.sums.legallyOwedOriginalYearEndCount,null);
  assert.equal(a.sums.statewideLegallyRequiredSenateReportCount,null);
  assert.equal(a.sums.independentlyProvenHistoricalPublicByDates,0);
  assert.equal(a.safeguards.keepIssue864Open,true);
});
test('wrong original Board first-page hash, year-end reference, registration list date or Senate service fails closed',()=>{
  const base=input();
  const o=structuredClone(base);o.finalCheckpoint.sourceOriginalReports[1].boardReceivedOn='2025-11-21';
  assert.throws(()=>audit2025SpecialConditionalYearEndDuties(o),/did not reconcile/);
  const b=input();b.pinned2025ViewerLedger=b.pinned2025ViewerLedger.replace('YE0.0','YE0.9');
  assert.throws(()=>audit2025SpecialConditionalYearEndDuties(b),/source SHA mismatched/);
  const c=input();c.registrySnapshot=c.registrySnapshot.replace('19229|2025-07-29|','19229|2025-07-30|');
  assert.throws(()=>audit2025SpecialConditionalYearEndDuties(c),/source SHA mismatched/);
  const d=input();d.official.senators.pop();
  assert.throws(()=>audit2025SpecialConditionalYearEndDuties(d),/Actual Senate service/);
  const e=input();e.specialCalendars[1].text=e.specialCalendars[1].text.replace('termination report','normal report');
  assert.throws(()=>audit2025SpecialConditionalYearEndDuties(e),/termination.exception/i);
});

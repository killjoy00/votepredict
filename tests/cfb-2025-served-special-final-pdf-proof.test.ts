import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL}
  from '../src/evidence/senate-official-ever-served-directory.js';
import type {CfbSenateDistrictPageObservation}
  from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {cfbSenateDistrictPageUrl}
  from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256}
  from '../src/evidence/cfb-2025-senate-special-original-pdf-proof.js';
import {
  selectServed2025SpecialFinalTargets,parseServed2025SpecialFinalHeader,
  verifyServed2025SpecialFinalCalendar,cfbServed2025FinalReference,
  auditServed2025SpecialFinalReport,SERVED_2025_SPECIAL_FINAL_DUE_ON,
} from '../src/evidence/cfb-2025-served-special-final-pdf-proof.js';
import {cfbReportViewerUrl}
  from '../src/evidence/cfb-current-report-acquisition.js';
const ts='2026-10-10T23:51:10.000Z';
const sha='a'.repeat(64);
const ledger=readFileSync('docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-versions.psv','utf8');
function official():AuditedOfficialSenateDirectory{
  return {
    schema:'mn-lrl-official-senate-ever-served-directory-v1',
    source:{url:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,observedAt:ts,
      sourceBytesSha256:sha,sourceBytesLength:50000,
      originalHistoricDateForDisplayedDirectoryEstablished:false,
      directoryIsSenatorServiceNotCandidateFiling:true},
    supplementalSwearingSource:{url:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,observedAt:ts,
      sourceBytesSha256:sha,sourceBytesLength:50000,
      swearingDateIndependentlyDocumentedForNamedSpecialMembers:true,
      websitePublicationDateBackdated:false},
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
function rosters():CfbSenateDistrictPageObservation[]{
  return [
    {district:29,segmentEndYear:2026,sourceUrl:cfbSenateDistrictPageUrl(29,2026),
     retrievedAt:ts,htmlSha256:CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[29],
     responseBytes:50000,status:'candidate_labels_observed',
     candidates:[
       {registrationNumber:'19229',candidateDisplayName:'Holmstrom, Michael'},
       {registrationNumber:'19234',candidateDisplayName:'Somebody, Else'},
     ],malformedCandidateLabels:0,error:null},
    {district:47,segmentEndYear:2026,sourceUrl:cfbSenateDistrictPageUrl(47,2026),
     retrievedAt:ts,htmlSha256:CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[47],
     responseBytes:50000,status:'candidate_labels_observed',
     candidates:[
       {registrationNumber:'19233',candidateDisplayName:'Hemmingsen-Jaeger, Amanda'},
       {registrationNumber:'19235',candidateDisplayName:'Never Served, Candidate'},
     ],malformedCandidateLabels:0,error:null},
  ];
}
function targets(){return selectServed2025SpecialFinalTargets(official(),rosters(),ledger);}
function header(reg:string,district:number,end='11/19/2025',received='December 1, 2025'){
  return 'Report of Receipts and Expenditures for Principal Campaign Committee '+
    'Registration Number: '+reg+' Senate District '+district+' '+
    'Period Covered: 7/29/2025 through '+end+' '+
    'Received by the Board '+received;
}
function calendarText(district:number){
  return 'Senate District '+district+' Special Election Public Disclosure Calendar '+
    '2025 November 4 November 19 December 1 December 2 '+
    'Special election cycle final report of receipts and expenditures due. '+
    'Period covered: July 29 through November 19, 2025.';
}
test('selector admits only exact 2025 Minnesota Senate service, candidate roster, and pinned YE1.0 source',()=>{
  const two=targets();
  assert.equal(two.length,2);
  assert.deepEqual(two.map(x=>x.district),[29,47]);
  assert.deepEqual(two.map(x=>x.reportId),
    ['19229:25:pcc:YE:1:0','19233:25:pcc:YE:1:0']);
  assert.ok(two.every(t=>t.dueOn===SERVED_2025_SPECIAL_FINAL_DUE_ON
    &&t.coverageEndOn==='2025-11-19'));
  assert.ok(two.every(t=>!t.reportId.includes(':C:')&&!t.reportId.includes(':E:')
    &&!t.reportId.includes(':19205')));
  const bad=rosters();bad[1]!.candidates[0]!.candidateDisplayName='Different, Person';
  assert.throws(()=>selectServed2025SpecialFinalTargets(official(),bad,ledger),/winner candidate CFB label/);
  const noService=official();noService.senators.pop();
  assert.throws(()=>selectServed2025SpecialFinalTargets(noService,rosters(),ledger),
    /not independently proven/);
  const badSha=rosters();badSha[0]!.htmlSha256='b'.repeat(64);
  assert.throws(()=>selectServed2025SpecialFinalTargets(official(),badSha,ledger),
    /district source unverified/);
  assert.throws(()=>selectServed2025SpecialFinalTargets(official(),rosters(),
    ledger.replace('YE1.0','YE1.1')),/source SHA drift/);
});
test('original PDF first-page identity, district, period and Board receipt all mandatory',()=>{
  const [t]=targets();assert.ok(t);
  assert.deepEqual(parseServed2025SpecialFinalHeader(t,header(t.registrationNumber,29)),
    {coverageStartOn:'2025-07-29',coverageEndOn:'2025-11-19',boardReceivedOn:'2025-12-01'});
  assert.equal(parseServed2025SpecialFinalHeader(t,header('19234',29)),null);
  assert.equal(parseServed2025SpecialFinalHeader(t,header(t.registrationNumber,47)),null);
  assert.equal(parseServed2025SpecialFinalHeader(t,header(t.registrationNumber,29,'11/18/2025')),null);
  assert.equal(parseServed2025SpecialFinalHeader(t,header(t.registrationNumber,29,
    '11/19/2025','October 8, 2025')),null);
});
test('original calendar proof requires real same-district PDF hash and cycle-final due date',()=>{
  const [t]=targets();assert.ok(t);
  const source={url:t.calendarUrl,sha256:t.calendarSha256,bytes:12345,observedAt:ts,
    text:calendarText(t.district)};
  assert.equal(verifyServed2025SpecialFinalCalendar(t,source),true);
  assert.equal(verifyServed2025SpecialFinalCalendar(t,
    {...source,sha256:'b'.repeat(64)}),false);
  assert.equal(verifyServed2025SpecialFinalCalendar(t,
    {...source,text:source.text.replace('December 1','December 4')}),false);
});
test('historical public-by cannot derive from original PDF, Board date or legal floor',()=>{
  const [t]=targets();assert.ok(t);
  const pdf={sourceUrl:cfbReportViewerUrl(cfbServed2025FinalReference(t)),
    sha256:sha,bytes:33333,observedAt:ts,text:header(t.registrationNumber,t.district)};
  const good=auditServed2025SpecialFinalReport(t,pdf,true,null);
  assert.equal(good.status,'original_pdf_and_calendar_verified');
  assert.equal(good.earliestLegallyPossibleOn,'2025-12-02');
  assert.equal(good.independentlyProvenHistoricalPublicBy,null);
  assert.equal(good.historicalPredictionEligible,false);
  assert.equal(good.legallyRequiredReportCount,null);
  assert.equal(good.registrationTerminationAtThatDateVerified,false);
  assert.equal(good.independentUnamendedCheckboxVerified,false);
  assert.equal(auditServed2025SpecialFinalReport(t,pdf,false,null).status,'original_calendar_unverified');
  assert.equal(auditServed2025SpecialFinalReport(t,
    {...pdf,sourceUrl:pdf.sourceUrl.replace('regnum=','regnum=99')},true,null)
    .status,'pdf_missing_or_invalid');
  const late=auditServed2025SpecialFinalReport(t,
    {...pdf,text:header(t.registrationNumber,t.district,'11/19/2025','December 4, 2025')},
    true,null);
  assert.equal(late.earliestLegallyPossibleOn,'2025-12-05');
});

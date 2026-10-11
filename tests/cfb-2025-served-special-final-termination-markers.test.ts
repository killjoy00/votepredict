import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cfbReportViewerUrl} from '../src/evidence/cfb-current-report-acquisition.js';
import {cfbServed2025FinalReference,
  type Served2025SpecialFinalTarget}
  from '../src/evidence/cfb-2025-served-special-final-pdf-proof.js';
import {
  CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA,
  probeServedSenatorSpecialFinalTerminationMarkers,
} from '../src/evidence/cfb-2025-served-special-final-termination-markers.js';

const CHECKPOINT=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json','utf8'));
const stamp='2026-10-11T01:30:00.000Z';
function target(index:0|1):Served2025SpecialFinalTarget{
  const x=CHECKPOINT.sourceOriginalReports[index];
  return{
    district:x.district,registrationNumber:x.registrationNumber,
    officialName:x.senator,label:x.senator,
    reportId:x.reportId,viewerSha256:x.originalViewerApiSha256,
    rosterHtmlSha256:x.officialCFBDistrictRosterSha256,
    originalServiceSourceUrl:CHECKPOINT.sourceService.senateServiceUrl,
    officialServiceObservedAt:stamp,
    calendarUrl:CHECKPOINT.sourceCalendars[index].url,
    calendarSha256:CHECKPOINT.sourceCalendars[index].pdfSha256,
    dueOn:'2025-12-01',coverageEndOn:'2025-11-19',
  };
}
function pdf(index:0|1,terms:string){
  const x=CHECKPOINT.sourceOriginalReports[index];
  const t=target(index);
  const text='Report of Receipts and Expenditures for Principal Campaign Committee '+
    'Registration Number: '+t.registrationNumber+' Senator District '+t.district+
    ' Period Covered: 7/29/2025 through 11/19/2025 '+
    'Received by the Board '+(index===0?'November 26, 2025':'November 20, 2025')+
    '. [FIRST PAGE HEADER] '+terms;
  return{
    sourceUrl:cfbReportViewerUrl(cfbServed2025FinalReference(t)),
    sha256:x.originalPdfBinarySha256,bytes:x.bytes,
    fetchedAt:stamp,text,
  };
}
test('exhaustive original-PDF binary identity and original Senate member case are hard required',()=>{
  const result=probeServedSenatorSpecialFinalTerminationMarkers(target(0),pdf(0,'Annual report.'));
  assert.equal(CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA,
    'cfb-2025-two-served-senators-original-special-final-termination-marker-probe-v1');
  assert.equal(result.reportId,'19229:25:pcc:YE:1:0');
  assert.equal(result.originalPdfSha256,
    '0cecaf71ada09c3cb7d12dd439438dc432c7998159250b7c62e85bfdb0e383b2');
  assert.equal(result.originalPdfBytes,35024);
  assert.equal(result.originalCfbBoardReceivedOn,'2025-11-26');
  assert.equal(result.totalTerminationWordOccurrences,0);
  assert.equal(result.originalTerminationCheckboxSelectionIndependentlyProven,null);
  assert.equal(result.yearEnd2025WasLegallyOwed,null);
  const other=probeServedSenatorSpecialFinalTerminationMarkers(target(1),pdf(1,'Special election cycle final.'));
  assert.equal(other.reportId,'19233:25:pcc:YE:1:0');
  assert.equal(other.originalPdfBytes,38474);
  assert.equal(other.originalCfbBoardReceivedOn,'2025-11-20');
  assert.throws(()=>probeServedSenatorSpecialFinalTerminationMarkers(target(1),pdf(0,'anything')),
    /not pinned/);
  assert.throws(()=>probeServedSenatorSpecialFinalTerminationMarkers(
    {...target(0),officialName:'Never served candidate'},pdf(0,'')),/not pinned/);
  assert.throws(()=>probeServedSenatorSpecialFinalTerminationMarkers(
    target(0),{...pdf(0,''),sha256:'e'.repeat(64)}),/not pinned/);
  assert.throws(()=>probeServedSenatorSpecialFinalTerminationMarkers(
    target(0),{...pdf(0,''),bytes:99999}),/not pinned/);
});
test('a bare printed termination form label CANNOT imply a checked box',()=>{
  const misleading='Is this a termination report? Yes No. Mark the termination report box. '+
    'Long explanation: a termination report is filed after closing. '+
    'Doe Donor personally lives 123 Main Street contributed $1000.';
  const v=probeServedSenatorSpecialFinalTerminationMarkers(target(0),pdf(0,misleading));
  assert.equal(v.bareTerminationReportLabelPresentInFirst6500Characters,true);
  assert.ok(v.totalTerminationWordOccurrences>=3);
  assert.equal(v.originalTerminationCheckboxSelectionIndependentlyProven,null);
  assert.equal(v.registeredCommitteeTerminatedEffectiveOn,null);
  assert.equal(v.yearEnd2025WasLegallyOwed,null);
  assert.equal(v.independentHistoricalPublicByOn,null);
  assert.equal(v.admissibleToHistoricalForecast,false);
  assert.ok(v.terminationWordDiagnostics.length>=1);
  assert.ok(!JSON.stringify(v).includes('Doe Donor'));
  assert.ok(!JSON.stringify(v).includes('123 Main'));
  assert.ok(!JSON.stringify(v).includes('$1000'));
  assert.ok(!JSON.stringify(v).includes('lives'));
  for(const marker of v.terminationWordDiagnostics){
    assert.match(marker.lexeme,/^terminat/);
    assert.ok(marker.whitelistedSurroundingKeywords.every(k=>
      /^(termination|terminate|terminated|terminating|report|final|type|special|election|cycle|committee|check|checked|selected|mark|yes|no|not|is|a|an|this|filed|filing|ordinary|amended|amendment|original|form)$/.test(k)));
  }
});
test('even report TYPE text is a lead, not independently selected PDF checkbox',()=>{
  const t=target(1);
  const v=probeServedSenatorSpecialFinalTerminationMarkers(t,
    pdf(1,'Type of Report: Termination Report. This is printed template text.'));
  assert.equal(v.explicitlyTextLabeledTerminationTypeInFirst6500Characters,true);
  assert.equal(v.originalTerminationCheckboxSelectionIndependentlyProven,null);
  assert.equal(v.originalBoardTerminationNoticeIndependentlyProven,null);
});
test('mismatched original coverage, Board-received date, reg and report source are never accepted',()=>{
  const t=target(0);const a=pdf(0,'No');
  for(const wrong of [
    {...a,text:a.text.replace('11/19/2025','11/20/2025')},
    {...a,text:a.text.replace('November 26, 2025','November 25, 2025')},
    {...a,text:a.text.replace('19229','19234')},
    {...a,sourceUrl:a.sourceUrl.replace('regnum=19229','regnum=19234')},
  ])assert.throws(()=>probeServedSenatorSpecialFinalTerminationMarkers(t,wrong));
});

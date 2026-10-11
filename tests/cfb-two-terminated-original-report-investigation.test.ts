import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {select22AuthenticSenatorRegistrationTargets} from
 '../src/evidence/cfb-2023-24-official-committee-status-proof.js';
import {selectTwoTerminatedSenators,inspectPossibleOriginalCfbTerminationReportText} from
 '../src/evidence/cfb-two-terminated-original-report-investigation.js';

const ORIGINAL='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const people=select22AuthenticSenatorRegistrationTargets(readFileSync(ORIGINAL,'utf8'));
test('the exact two currently terminated registrations are actually-serving 2022 senators within unchanged 71 source-version cohort',()=>{
 assert.deepEqual(selectTwoTerminatedSenators(people),[
  {registrationNumber:'18763',senator:'Steve Drazkowski',district2022:20},
  {registrationNumber:'17362',senator:'Bruce Douglas Anderson',district2022:29},
 ]);
 assert.throws(()=>selectTwoTerminatedSenators(people.filter(p=>p.registrationNumber!=='18763')),/22-serving/);
 assert.throws(()=>selectTwoTerminatedSenators(people.map(p=>p.registrationNumber==='17362'
  ?{...p,senator:'Different Anderson'}:p)),/not source authenticated/);
});
const safePdf=(reg:string,surname:string,extra='')=>
 'MINNESOTA CAMPAIGN FINANCE AND PUBLIC DISCLOSURE BOARD\n'+
 'Candidate Committee '+reg+' Senator '+surname+'\n'+
 'Period Covered: 01/01/2025 through 12/31/2025\n'+
 'Received by the Board January 20, 2026\n'+extra+
 ' Original report schedule and certification. '.repeat(90);
test('a printed termination word on a form is NOT proof a final report was filed, checked, accepted or public by any historic date',()=>{
 const got=inspectPossibleOriginalCfbTerminationReportText({
  reportText:safePdf('17362','Anderson',
    'Termination Report [ ] Final Report [ ] -- DO NOT SELECT unless termination is intended.'),
  registrationNumber:'17362',expectedSurname:'Anderson',
  versionKey:'17362:25:pcc:YE:0:0',reportName:'2025 year-end',
 });
 assert.equal(got.pdfContainsExactFirstPageRegAndSurname,true);
 assert.equal(got.formMentionsTermination,true);
 assert.equal(got.formMentionsFinal,true);
 assert.equal(got.candidateTerminationFormCheckboxChecked,null);
 assert.equal(got.actualTerminationAcceptanceOrDate,null);
 assert.equal(got.actualCommitteeActiveIn2023or2024,null);
 assert.equal(got.originalPublicByDate,null);
 assert.equal(got.boardPrintedReceiptText,'January 20, 2026');
 assert.equal(got.originalPrintedCoverageEnd,'12/31/2025');
});
test('no termination keyword cannot prove committee active or still registered',()=>{
 const got=inspectPossibleOriginalCfbTerminationReportText({
  reportText:safePdf('18763','Drazkowski'),
  registrationNumber:'18763',expectedSurname:'Drazkowski',
  versionKey:'18763:26:pcc:YE:0:1',reportName:'2026 year-end amendment',
 });
 assert.equal(got.formMentionsTermination,false);
 assert.equal(got.actualTerminationAcceptanceOrDate,null);
});
test('original report from a different reg or person or 2024 report cannot authenticate 2025/26 termination inquiry',()=>{
 for(const [reportText,registrationNumber,expectedSurname,versionKey] of [
  [safePdf('18763','Anderson'),'17362','Anderson','17362:25:pcc:YE:0:0'],
  [safePdf('18763','Drazkowski'),'17362','Anderson','17362:25:pcc:YE:0:0'],
  [safePdf('17362','Anderson'),'17362','Anderson','17362:24:pcc:YE:0:0'],
  [safePdf('17362','Anderson'),'17362','Anderson','18763:25:pcc:YE:0:0'],
 ]){
  assert.throws(()=>inspectPossibleOriginalCfbTerminationReportText({
   reportText,registrationNumber,expectedSurname,versionKey,reportName:'2025 year-end',
  }),/does not authenticate/);
 }
});

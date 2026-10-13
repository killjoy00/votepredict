import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SCHEMA,FULL_VERSION_PSV,FULL_SENATOR_PSV,
 buildV16ReportSourceVersionLedger,buildV16ActualSenatorVersionCrosswalk,
 serializeV16SenatorCrosswalk,verifyV16PermanentSourceLedgers
}from '../scripts/audit-cfb-864-255-exact-report-version-ledger-v16.mjs';
import {serializeServedExactLedger}
 from '../scripts/audit-cfb-864-served-report-version-ledger-v12.mjs';
const{rows,newRows,byYear}=buildV16ReportSourceVersionLedger();
const byId=new Map(rows.map(r=>[r.reportVersionId,r]));
test('official 2021–25 original/amended version count expands 229 to 255, not duplicate 24 candidate source IDs',()=>{
 assert.equal(SCHEMA,'cfb-864-2021-25-38-served-principal-255-exact-original-pdf-versions-v16');
 assert.equal(rows.length,255);
 assert.equal(byId.size,255);
 assert.equal(newRows.length,26);
 assert.equal(new Set(rows.map(r=>r.committeeRegistration)).size,38);
 assert.equal(rows.filter(r=>r.viewerRevisionClass==='original').length,164);
 assert.equal(rows.filter(r=>r.viewerRevisionClass==='amended').length,91);
 assert.equal(rows.filter(r=>r.pdfIdentityStatus==='source_identity_hold').length,3);
 assert.equal(rows.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias').length,3);
 const certified=rows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_'));
 assert.equal(certified.length,249);
 assert.equal(new Set(certified.map(r=>r.sourcePdfSha256)).size,249);
});
test('source identities, years and verified PDFs never substitute for historical public-by',()=>{
 assert.deepEqual(byYear.map(x=>[x.year,x.sourceVersionReferences,x.original,x.amended,
  x.verifiedDistinctPdfs,x.identityHolds,x.identicalViewerAliases]),[
  [2021,30,17,13,29,1,0],
  [2022,134,91,43,133,0,1],
  [2023,32,22,10,30,2,0],
  [2024,39,22,17,38,0,1],
  [2025,20,12,8,19,0,1],
 ]);
 assert.ok(rows.every(r=>r.historicalActualPublicByOn===null));
 assert.ok(rows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_')).every(r=>
  r.conservativeNotBeforeOn>r.calendarDueOn&&
  r.conservativeNotBeforeOn>=r.boardReceivedOn));
});
test('24 first12 district 2022 C/E original PDF hashes have independently verified senator principal and actual report period',()=>{
 const new22=newRows.filter(r=>r.reportYear===2022&&r.reportPeriodCode!=='YE');
 assert.equal(new22.length,24);
 const senators=new Set(new22.map(r=>r.servingSenator));
 assert.deepEqual(senators,new Set([
  'Mark T. Johnson','Steve Green','Grant Hauschild','Robert Kupec',
  'Paul J. Utke','Justin D. Eichorn','Robert Farnsworth',
  'Jennifer A McEwen','Jordan Rasmusson','Nathan Wesenberg',
  'Jason Rarick','Torrey Westrom',
 ]));
 assert.ok(new22.every(r=>r.proofLedger.endsWith(
  '/cfb-2022-senate-24-original-ce-pdf-headers.psv')
  &&r.sourcePdfBytes>1000
  &&r.viewerRevisionClass==='original'
  &&r.pdfIdentityStatus==='authenticated_original_pdf'));
 for(const person of senators){
  const docs=new22.filter(x=>x.servingSenator===person);
  assert.equal(docs.length,2);
  assert.deepEqual(new Set(docs.map(x=>x.reportPeriodCode)),new Set(['C','E']));
  assert.equal(docs.find(x=>x.reportPeriodCode==='C').periodEnd,'2022-07-18');
  assert.equal(docs.find(x=>x.reportPeriodCode==='E').periodEnd,'2022-10-24');
 }
});
test('original independently checked Erin Murphy official 2021 and 2022 yearends are added without treating 2023 as first display',()=>{
 const earlier=byId.get('18443:21:pcc:YE:0:0');
 const next=byId.get('18443:22:pcc:YE:0:0');
 assert.equal(earlier.servingSenator,'Erin P. Murphy');
 assert.equal(next.servingSenator,'Erin P. Murphy');
 assert.equal(earlier.sourcePanelDistrict,64);
 assert.equal(earlier.boardReceivedOn,'2022-01-28');
 assert.equal(earlier.calendarDueOn,'2022-01-31');
 assert.equal(earlier.conservativeNotBeforeOn,'2022-02-01');
 assert.equal(earlier.sourcePdfSha256,'3bed3b738b55ce45d16f34acf45be06f6e598cca28b3ab63f6db09844cfb65a1');
 assert.equal(next.boardReceivedOn,'2023-01-30');
 assert.equal(next.calendarDueOn,'2023-01-31');
 assert.equal(next.conservativeNotBeforeOn,'2023-02-01');
 assert.equal(next.sourcePdfSha256,'b03462fc7ac658f80b0dbecf511b16aef4039e151c9c5f1b5237f562a3f4586e');
 assert.equal(next.historicalActualPublicByOn,null);
});
test('95 actual serving senators: 38 authenticated CFB original report PDF principals, 57 not yet in selected sources',()=>{
 const people=buildV16ActualSenatorVersionCrosswalk(rows);
 assert.equal(people.length,95);
 assert.equal(new Set(people.map(x=>x.officialSenator)).size,95);
 const represented=people.filter(p=>p.sourceProvenCFBRegistrations!=='-');
 assert.equal(represented.length,38);
 assert.equal(people.length-represented.length,57);
 assert.equal(people.reduce((n,p)=>n+p.officialReportVersionRefsInSelectedPanel,0),255);
 assert.ok(people.every(x=>x.exactHistoricalVersionPublicByProvenCount===0
  &&x.legallyOwedReportCount==='UNKNOWN_NOT_IN_SCOPE'));
 assert.ok(people.filter(p=>p.sourceProvenCFBRegistrations==='-')
  .every(p=>p.sourceProofStatus==='not_in_selected_original_PDF_version_sources_not_no_report'));
 assert.equal(people.find(p=>p.officialSenator==='Erin P. Murphy').sourceProvenCFBRegistrations,'18443');
 assert.equal(people.find(p=>p.officialSenator==='Robert Kupec').sourceProvenCFBRegistrations,'18917');
 assert.equal(people.find(p=>p.officialSenator==='Nathan Wesenberg').sourceProvenCFBRegistrations,'18778');
});
test('source file 255 rows and 95 person crosswalk are exactly and irreversibly derivable from original official source proofs',()=>{
 const permanent=readFileSync(FULL_VERSION_PSV,'utf8');
 assert.equal(permanent,serializeServedExactLedger(rows));
 assert.equal(permanent.trim().split('\n').length,255);
 const served=readFileSync(FULL_SENATOR_PSV,'utf8');
 assert.equal(served,serializeV16SenatorCrosswalk(buildV16ActualSenatorVersionCrosswalk(rows)));
 assert.equal(served.trim().split('\n').length,95);
 const proof=verifyV16PermanentSourceLedgers();
 assert.equal(proof.versionRows,255);
 assert.equal(proof.uniqueAuthenticSourcePdfs,249);
 assert.equal(proof.officialCandidateRegistrationPrincipals,38);
 assert.equal(proof.actualSenateServingPersons,95);
 assert.equal(proof.sourcePanelNotRepresentedPeople,57);
 assert.equal(proof.independentlyProvenExactHistoricalPdfPublicByDates,0);
 assert.equal(proof.legalFiledReportObligationDenominator,null);
 assert.equal(proof.noBulkFinanceOrOldEligibilityWork,true);
 assert.match(proof.originalSourceVersionLedgerSha256,/^[a-f0-9]{64}$/);
 assert.match(proof.originalSenatorCoverageLedgerSha256,/^[a-f0-9]{64}$/);
});
test('V16 source proof is research-only, no report content in GitHub or private finance / eligibility changes',()=>{
 assert.ok(rows.every(x=>x.officialPdfUrl.startsWith('https://cfb.mn.gov/rptViewer/Main.php?')));
 assert.ok(rows.every(x=>/^[a-f0-9]{64}$/.test(x.sourcePdfSha256)));
 assert.ok(rows.every(x=>x.historicalActualPublicByOn===null));
 assert.ok(newRows.every(x=>x.proofLedger.startsWith('docs/evaluation/source-proof/')));
 const output=verifyV16PermanentSourceLedgers();
 assert.equal(output.protectedDatabaseReadsOrWrites,0);
 assert.equal(output.contentSourcePdfsNotSaved,true);
 assert.equal(output.legalFiledReportObligationDenominator,null);
 const wf=readFileSync('.github/workflows/senate-864-255-exact-report-version-expansion-v16.yml','utf8');
 assert.match(wf,/pull_request:/);
 assert.match(wf,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(wf,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});

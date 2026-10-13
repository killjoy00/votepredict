import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {cfbReportViewerUrl}
 from '../src/evidence/cfb-current-report-acquisition.js';
import{
 SCHEMA,choose13NewSenator2023To24YearEndSubjects,
 verify2023to24IndependentYearendCalendars,official2023To24YearEndReference,
 selectedOriginalAndAmendedViewerReferences,auditYearEndSourcePdfHeader,
 classifyYearEndSourceVersions
}from '../scripts/acquire-cfb-864-thirteen-served-2023-24-original-amended-yearend-pdfs-v18.mjs';
const t=choose13NewSenator2023To24YearEndSubjects()[0];
const makeRef=(year,amend=0)=>official2023To24YearEndReference(t,year,amend);
function pdf(ref,date,hash='a'.repeat(64),text=null){
 const year=2000+Number(ref.year);
 const content=text??[
  'Report of Receipts and Expenditures for Principal Campaign Committee',
  'Senate District '+t.senateDistrict,
  'Registration Number: '+t.reg,
  'Period Covered: 1/1/'+year+' through 12/31/'+year,
  'Received by the Board '+date,
 ].join(' ');
 return{sourceUrl:cfbReportViewerUrl(ref),
  contentSha256:hash,bytes:356001,
  fetchedAt:'2026-10-13T16:10:00.000Z',text:content};
}
test('only 13 original 2022 source registration principals who independently served Senate in BOTH 2023 and 2024 selected',()=>{
 const targets=choose13NewSenator2023To24YearEndSubjects();
 assert.equal(targets.length,13);
 assert.equal(new Set(targets.map(x=>x.reg)).size,13);
 assert.ok(targets.every(x=>/^[0-9a-f]{64}$/.test(x.originalCfb2022DistrictPageSha)));
 assert.ok(targets.every(x=>!['16311','17441','18337','16246','17924'].includes(x.reg)));
 assert.ok(targets.every(x=>Number.isInteger(x.senateDistrict)&&x.senateDistrict>0));
});
test('2023/24 actual official year-end CFB calendar and 8AM next day nonpublicity floor certified, not true public-by',()=>{
 assert.equal(verify2023to24IndependentYearendCalendars(),true);
 assert.equal(SCHEMA,'cfb-864-2023-24-13-new-actual-senators-official-original-amended-yearend-PDF-v18');
 const c=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json','utf8'));
 assert.equal(c.exactStatutoryCalendarDates[0].actualHistoricalPublicationOn,null);
 assert.equal(c.exactStatutoryCalendarDates[1].actualHistoricalPublicationOn,null);
});
test('only source-verified candidate references from correct original official viewer and 2023/24 YE versions accepted',()=>{
 const original=makeRef(2023);
 const amend=makeRef(2023,1);
 const other=makeRef(2024);
 const s={registrationNumber:t.reg,segmentEndYear:2024,
  sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+t.reg+'/2024/',
  responseSha256:'f'.repeat(64),references:[original,amend,other,
   {...other,period:'E'}]};
 const result=selectedOriginalAndAmendedViewerReferences(t,s);
 assert.equal(result.refs.length,3);
 assert.equal(result.holds.length,0);
 assert.equal(result.allSelectedRefs,3);
 assert.throws(()=>selectedOriginalAndAmendedViewerReferences(t,{...s,responseSha256:'unproven'}));
 assert.throws(()=>selectedOriginalAndAmendedViewerReferences(t,{...s,
  references:[original,original]}));
 const missing=selectedOriginalAndAmendedViewerReferences(t,{...s,references:[amend,other]});
 assert.equal(missing.refs.length,1);
 assert.equal(missing.holds.length,1);
 assert.equal(missing.holds[0].sourceStatus,'original_yearend_viewer_reference_not_observed_hold');
});
test('original government PDF first-page registration/district/coverage/Board receipt and legal clock gating',()=>{
 const ref=makeRef(2023);
 const r=auditYearEndSourcePdfHeader(t,ref,pdf(ref,'January 29, 2024'),
  'f'.repeat(64));
 assert.equal(r.id,ref.registrationNumber+':23:pcc:YE:0:0');
 assert.equal(r.firstPageIdentityAndReportPeriodVerified,true);
 assert.equal(r.sourceFirstPageIdentityDiagnostic.committeeRegistrationMatches,true);
 assert.equal(r.sourceFirstPageIdentityDiagnostic.exactPrintedSenateDistrictMatches,true);
 assert.equal(r.sourceFirstPageIdentityDiagnostic.parsedPeriodEndOn,'2023-12-31');
 assert.equal(r.sourceStatus,'authenticated_pdf_first_page_version_unclassified');
 assert.equal(r.originalIndependentCalendarDueOn,'2024-01-31');
 assert.equal(r.legalAndBoardReceivedEarliestPossiblePublicDate,'2024-02-01');
 assert.equal(r.exactHistoricalActualPublicByOn,null);
 const late=auditYearEndSourcePdfHeader(t,ref,
  pdf(ref,'February 10, 2024'),'f'.repeat(64));
 assert.equal(late.legalAndBoardReceivedEarliestPossiblePublicDate,'2024-02-10');
});
test('wrong CFB printed registration, wrong Senate district, period drift and PDF source SHA mismatch become explicit HOLDS',()=>{
 const ref=makeRef(2024);
 const valid=pdf(ref,'January 30, 2025');
 for(const text of [
  valid.text.replace('Registration Number: '+t.reg,'Registration Number: 99999'),
  valid.text.replace('Senate District '+t.senateDistrict,'Senate District 66'),
  valid.text.replace('12/31/2024','12/30/2024'),
  valid.text.replace('January 30, 2025','January 30, 2024'),
 ]){
  const r=auditYearEndSourcePdfHeader(t,ref,{...valid,text},'f'.repeat(64));
  assert.equal(r.firstPageIdentityAndReportPeriodVerified,false);
  assert.equal(r.legalAndBoardReceivedEarliestPossiblePublicDate,null);
  assert.equal(r.exactHistoricalActualPublicByOn,null);
 }
 const corrupt=auditYearEndSourcePdfHeader(t,ref,
  {...valid,sourceUrl:'https://attacker.example/report.pdf'},'f'.repeat(64));
 assert.equal(corrupt.sourceStatus,'original_pdf_binary_not_authenticated_hold');
 const failed=auditYearEndSourcePdfHeader(t,ref,null,'f'.repeat(64),'official_cfb_http_unavailable');
 assert.equal(failed.sourceStatus,'source_retrieval_hold');
});
test('original, truly distinct amended and identical PDF alias version identities never double count',()=>{
 const original=makeRef(2023),amended=makeRef(2023,1),alias=makeRef(2023,2);
 const rows=[
  auditYearEndSourcePdfHeader(t,alias,pdf(alias,'March 3, 2024'),'f'.repeat(64)),
  auditYearEndSourcePdfHeader(t,original,pdf(original,'January 30, 2024'),'f'.repeat(64)),
  auditYearEndSourcePdfHeader(t,amended,pdf(amended,'February 17, 2024','b'.repeat(64)),
   'f'.repeat(64))
 ];
 rows[0].sourcePdfSha256='b'.repeat(64);
 const classified=classifyYearEndSourceVersions(rows);
 assert.equal(classified.find(x=>x.originalOrAmendedIndex===0).sourceStatus,
  'authenticated_original_pdf');
 assert.equal(classified.find(x=>x.originalOrAmendedIndex===1).sourceStatus,
  'authenticated_amendment_pdf');
 assert.equal(classified.find(x=>x.originalOrAmendedIndex===2).sourceStatus,
  'exact_pdf_alias');
 assert.equal(classified.find(x=>x.originalOrAmendedIndex===2).aliasCanonicalVersionId,
  classified.find(x=>x.originalOrAmendedIndex===1).id);
});
test('amendment when parent original PDF unverified stays held even with correctly parsed amendment body',()=>{
 const original=makeRef(2023),am=makeRef(2023,1);
 const rows=[
  auditYearEndSourcePdfHeader(t,original,null,'a'.repeat(64),'official_cfb_http_unavailable'),
  auditYearEndSourcePdfHeader(t,am,pdf(am,'March 5, 2024'),'a'.repeat(64))
 ];
 classifyYearEndSourceVersions(rows);
 assert.equal(rows[1].sourceStatus,'amendment_parent_original_pdf_not_authenticated_hold');
 assert.equal(rows[1].exactHistoricalActualPublicByOn,null);
});
test('original PDF research workflow never exports sensitive financial rows, uses public-only source GET/POST and no production',()=>{
 const y=readFileSync(
  '.github/workflows/senate-864-13-served-2023-24-original-amended-yearend-pdfs-v18.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-thirteen-2023-24-yearend-version-pdfs-v18.test.mjs/);
 assert.match(y,/node --import tsx scripts\/acquire-cfb-864-thirteen-served-2023-24-original-amended-yearend-pdfs-v18.mjs/);
 assert.doesNotMatch(y,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
});

test('43 permanent original CFB exact YE source version identities: 39 distinct PDF binaries, 3 strict firstpage holds and one alias',()=>{
 const p='docs/evaluation/source-proof/cfb-2023-24-thirteen-served-43-original-amended-yearend-pdfs-v18.psv';
 const data=readFileSync(p,'utf8');
 const rows=data.trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(rows.length,43);
 assert.ok(rows.every(x=>x.length===18));
 assert.equal(new Set(rows.map(x=>x[0])).size,43);
 assert.equal(new Set(rows.map(x=>x[3])).size,13);
 assert.equal(rows.filter(x=>x[6]==='authenticated_original_pdf').length,25);
 assert.equal(rows.filter(x=>x[6]==='authenticated_amendment_pdf').length,14);
 assert.equal(rows.filter(x=>x[6]==='exact_pdf_alias').length,1);
 assert.equal(rows.filter(x=>x[6]==='original_pdf_firstpage_committee_district_period_or_receipt_hold').length,3);
 assert.equal(new Set(rows.filter(x=>x[6].startsWith('authenticated_')).map(x=>x[7])).size,39);
 assert.ok(rows.every(x=>x[17]==='-'&&/^[a-f0-9]{64}$/.test(x[7])
  &&Number(x[8])>=1000&&/^[a-f0-9]{64}$/.test(x[14])
  &&/^[a-f0-9]{64}$/.test(x[16])));
 const holds=new Set(rows.filter(x=>x[6].includes('hold')).map(x=>x[0]));
 assert.deepEqual(holds,new Set([
  '18809:23:pcc:YE:0:0','18809:23:pcc:YE:0:1','18910:23:pcc:YE:0:1'
 ]));
 assert.ok(rows.filter(x=>x[6].includes('hold')).every(x=>
  x[9]==='-'&&x[10]==='-'&&x[11]==='-'&&x[13]==='-'));
});
test('original source metadata 43 reports second source replay and no prior 255 PDF or ID duplicates',()=>{
 const source=readFileSync(
  'docs/evaluation/source-proof/cfb-2023-24-thirteen-served-43-original-amended-yearend-pdfs-v18.psv','utf8');
 const cp=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2023-24-13-serving-original-amended-source-checkpoint-v18.json','utf8'));
 const blob=createHash('sha1').update('blob '+Buffer.byteLength(source,'utf8')+'\0')
  .update(source,'utf8').digest('hex');
 assert.equal(blob,cp.sourceProofMetadata.metadataPsvGitBlobSha);
 assert.equal(cp.sourceProofMetadata.metadataRowCount,43);
 assert.equal(cp.sourceProofMetadata.authenticatedDistinctSourcePdfBodies,39);
 assert.equal(cp.sourceProofMetadata.exactSourcePdfBinaryAliases,1);
 assert.equal(cp.sourceProofMetadata.firstPageRegistrationIdentityHolds,3);
 assert.equal(cp.sourceProofMetadata.actualHistoricalPublicationByExactPdfShaCount,0);
 assert.equal(cp.observedCfbOriginalAcquisition.independentOriginalApiSources.length,13);
 assert.equal(cp.observedCfbOriginalAcquisition.firstProofRun,
  'https://github.com/killjoy00/votepredict/actions/runs/38455766999');
 assert.equal(cp.observedCfbOriginalAcquisition.secondOriginalAll43PdfBodyReacquisitionRun,
  'https://github.com/killjoy00/votepredict/actions/runs/38456123723');
 assert.ok(cp.heldOriginalSourceVersionFirstPageInvestigations.every(x=>
  x.firstPageIdentityDiagnostic.committeeRegistrationMatches===false
  &&x.firstPageIdentityDiagnostic.principalCampaignReportTitle===true
  &&x.firstPageIdentityDiagnostic.exactPrintedSenateDistrictMatches===true));
 const fresh=source.trimEnd().split('\n').map(x=>x.split('|'));
 const old=readFileSync('docs/evaluation/source-proof/cfb-2021-25-38-served-principal-255-exact-report-version-ledger-v16.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 const oldIds=new Set(old.map(x=>x[0]));
 const oldPdfHashes=new Set(old.filter(x=>x[9].startsWith('authenticated_')).map(x=>x[10]));
 assert.ok(fresh.every(x=>!oldIds.has(x[0])));
 assert.ok(fresh.filter(x=>x[6].startsWith('authenticated_')).every(x=>!oldPdfHashes.has(x[7])));
});

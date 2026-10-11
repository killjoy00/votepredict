/** #864. Preserve exact 2023/24 amended PDF source identity, never infer legal duty. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  selectSixteenParentAuthenticatedYeAmendments,sourceYeAmendmentReference,
  auditAuthenticatedParentYeAmendment,auditSixteenAmendmentSourceSequence,
  classifySixteenReviewed2023to24AmendedSourceReferences,
} from '../src/evidence/cfb-2023-24-sixteen-parent-authenticated-amendments.js';
import {cfbReportViewerUrl}
  from '../src/evidence/cfb-current-report-acquisition.js';

const P='docs/evaluation/source-proof/';
const source={
  originalQueuePsv:readFileSync(P+'cfb-2021-25-served-senator-next-source-pdf-targets.psv','utf8'),
  authenticatedOriginal28Psv:readFileSync(P+'cfb-2023-24-verified-served-28-original-yearend-pdfs.psv','utf8'),
  sourceViewer396Psv:readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
  sourceOriginalCheckpointJson:readFileSync(P+'cfb-2023-24-verified-served-28-original-yearend-source-checkpoint.json','utf8'),
};
const targets=selectSixteenParentAuthenticatedYeAmendments(source);
function firstPage(t:typeof targets[number],filed='February 28, 2025'){
 return 'Report of Receipts and Expenditures for Principal Campaign Committee\n'+
   'Registration Number: '+t.registrationNumber+'\nSenate District: '+t.senateDistrict2022+
   '\nPeriod Covered: 1/1/'+t.year+' through 12/31/'+t.year+
   '\nReceived by the Board '+filed;
}
function fake(t:typeof targets[number],sha:string,body=firstPage(t)){
 return {sourceUrl:cfbReportViewerUrl(sourceYeAmendmentReference(t)),
   sha256:sha,bytes:4500,observedAt:'2026-10-11T20:17:00.000Z',text:body};
}
test('exact 16 versions, five real 2022 senators and six independently proven original parent PDFs',()=>{
 assert.equal(targets.length,16);
 assert.equal(new Set(targets.map(x=>x.id)).size,16);
 assert.equal(new Set(targets.map(x=>x.registrationNumber)).size,5);
 assert.equal(new Set(targets.map(x=>x.parentOriginalId)).size,6);
 assert.equal(targets.filter(x=>x.year===2023).length,6);
 assert.equal(targets.filter(x=>x.year===2024).length,10);
 assert.deepEqual([...new Set(targets.map(x=>x.senatorVerifiedServedIn2022))].sort(),
   ['Aric Putnam','Gene Dornink','Karin Housley','Liz Boldon','Mark W. Koran'].sort());
 for(const t of targets){
  assert.equal(t.parentOriginalId,t.id.slice(0,t.id.lastIndexOf(':'))+':0');
  assert.match(t.originalPdfSha256,/^[0-9a-f]{64}$/);
  assert.ok(t.originalPdfBytes>300);
  assert.ok(t.originalBoardReceipt>=t.originalPeriodEnd);
  assert.ok(t.amendmentIndex>=1);
  const ref=sourceYeAmendmentReference(t);
  assert.equal(ref.year,String(t.year).slice(2));
  assert.equal(ref.amendment,t.amendmentIndex);
  assert.equal(ref.registrationNumber,t.registrationNumber);
 }
});
test('original authenticated sources cannot be edited without an explicit new audit',()=>{
 assert.throws(()=>selectSixteenParentAuthenticatedYeAmendments({...source,
  originalQueuePsv:source.originalQueuePsv.replace('P3_AMEND_AFTER_PARENT','P0_UNKNOWN')}),/changed/);
 assert.throws(()=>selectSixteenParentAuthenticatedYeAmendments({...source,
  authenticatedOriginal28Psv:source.authenticatedOriginal28Psv.replace('c6b67bb11a29e56','0000000000000000')}),/changed/);
 assert.throws(()=>selectSixteenParentAuthenticatedYeAmendments({...source,
  sourceViewer396Psv:source.sourceViewer396Psv.replace('2024|18430','2024|00000')}),/changed/);
 assert.throws(()=>selectSixteenParentAuthenticatedYeAmendments({...source,
  sourceOriginalCheckpointJson:source.sourceOriginalCheckpointJson.replace(
   '"originalPdfBinarySha256": true','"originalPdfBinarySha256": false')}),/changed/);
});
test('amended first-page identity, period, receipt and parent binary checks fail closed',()=>{
 const t=targets.find(x=>x.year===2023)!;
 const good=firstPage(t);
 assert.equal(auditAuthenticatedParentYeAmendment(t,
   fake(t,'a'.repeat(64))).status,'amended_pdf_and_parent_identity_authenticated');
 assert.equal(auditAuthenticatedParentYeAmendment(t,
   fake(t,'a'.repeat(64),good.replace(t.registrationNumber,'99999'))).status,
   'source_first_page_committee_or_dates_unverified');
 assert.equal(auditAuthenticatedParentYeAmendment(t,
   fake(t,'a'.repeat(64),good.replace('Senate District: '+t.senateDistrict2022,'Senate District: 59'))).status,
   'source_first_page_committee_or_dates_unverified');
 assert.equal(auditAuthenticatedParentYeAmendment(t,
   fake(t,'a'.repeat(64),good.replace('12/31/2023','12/30/2023'))).status,
   'source_first_page_committee_or_dates_unverified');
 assert.equal(auditAuthenticatedParentYeAmendment(t,
   fake(t,'a'.repeat(64),firstPage(t,'January 01, 2023'))).status,
   'source_first_page_committee_or_dates_unverified');
 const same=auditAuthenticatedParentYeAmendment(t,fake(t,t.originalPdfSha256));
 assert.equal(same.status,'official_version_binary_identical_to_original_parent');
 const broken=auditAuthenticatedParentYeAmendment(t,{...fake(t,'a'.repeat(64)),
   sourceUrl:'https://example.invalid/version'});
 assert.equal(broken.status,'source_pdf_missing_or_provenance_failed');
});
test('all 16 source refs must be independent PDF binaries before counting 16 new forms',()=>{
 const rows=targets.map((t,i)=>auditAuthenticatedParentYeAmendment(t,
  fake(t,(i+101).toString(16).padStart(64,'0'))));
 const valid=auditSixteenAmendmentSourceSequence(rows);
 assert.equal(valid.acceptedAllSixteenDistinct,true);
 assert.equal(valid.distinctlyAuthenticatedAmendedPdfBinaries,16);
 assert.equal(valid.originalReportParentsVerified,6);
 assert.equal(valid.originalSourceRealSenatorsVerified,5);
 assert.equal(valid.statutoryRequiredReportsDenominator,null);
 const duplicate=rows.map((x,i)=>i===15?{...x,pdfSha256:rows[0]!.pdfSha256}:x);
 const result=auditSixteenAmendmentSourceSequence(duplicate);
 assert.equal(result.acceptedAllSixteenDistinct,false);
 assert.equal(result.distinctlyAuthenticatedAmendedPdfBinaries,15);
 assert.equal(result.unexpectedDuplicateVersionPdfContent.length,2);
 const missing=auditSixteenAmendmentSourceSequence(rows.slice(1));
 assert.equal(missing.acceptedAllSixteenDistinct,false);
 assert.ok(rows.every(x=>x.historicallyActuallyPublicByOn===null
  &&x.independentStatutoryDueDate===null&&x.legallyOwedReportCount===null
  &&x.eligibleForHistoricalForecast===false));
});

test('reviewed unusual official source cases never inflate PDF counts',()=>{
  const reports=targets.map((x,i)=>{
    const held=x.id==='18430:23:pcc:YE:0:1';
    const duplicate=x.id==='18430:24:pcc:YE:0:1'||x.id==='18430:24:pcc:YE:0:2';
    const sha=held?'5da25294735f3b7b62608755df926b38917a69aaf90b13c9999396de0d710c54':
      duplicate?'ff7e8200925b80a6983b00ac17c7dfe1b6a9be746c7754b0055a7dc94dbb5f03':
      (i+201).toString(16).padStart(64,'0');
    const date=held?'April 4, 2024':duplicate?'April 10, 2025':'May 28, 2025';
    const text=firstPage(x,date);
    const pdf={...fake(x,sha,held?text.replace('Registration Number: '+x.registrationNumber,'Registration Number: 00001'):text),
      bytes:held?149845:duplicate?30355:3500};
    return auditAuthenticatedParentYeAmendment(x,pdf);
  });
  const audit=classifySixteenReviewed2023to24AmendedSourceReferences(reports);
  assert.equal(audit.sourceAccountingAcceptedWithOneExactIdentityHoldAndOneBinaryAlias,true);
  assert.equal(audit.independentlyAuthenticatedAmendmentReferences,15);
  assert.equal(audit.uniqueIndependentlyAuthenticatedAmendedPdfs,14);
  assert.equal(audit.completeAmendmentChainsDemonstrated,false);
  const bad=reports.map(x=>x.id==='18430:23:pcc:YE:0:1'?{...x,pdfBytes:149846}:x);
  assert.equal(classifySixteenReviewed2023to24AmendedSourceReferences(bad)
    .sourceAccountingAcceptedWithOneExactIdentityHoldAndOneBinaryAlias,false);
});

/** #864: held original-source PDFs must remain held despite reproducible binary. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 selectTwoHeldOfficialCfbSourceDocuments,heldOfficialSourceRef,
 analyzeHeldCfbSourceBinary,compareHeldCfbGetPost,
} from '../src/evidence/cfb-2023-24-held-source-pdf-diagnostics.js';
import {cfbReportViewerUrl} from '../src/evidence/cfb-current-report-acquisition.js';
const P='docs/evaluation/source-proof/';
const originals={
 lang16Psv:readFileSync(P+'cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv','utf8'),
 putnam16Psv:readFileSync(P+'cfb-2023-24-parent-authenticated-16-amendment-pdf-source-ledger.psv','utf8'),
 langCheckpointJson:readFileSync(P+'cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json','utf8'),
 putnamCheckpointJson:readFileSync(P+'cfb-2023-24-parent-authenticated-16-amendment-source-checkpoint.json','utf8'),
};
const target=selectTwoHeldOfficialCfbSourceDocuments(originals);
function mock(t:typeof target[number],body:string){
 return{
  sourceUrl:cfbReportViewerUrl(heldOfficialSourceRef(t)),
  sha256:t.expectedPdfSha256,bytes:t.expectedPdfBytes,
  observedAt:'2026-10-11T18:36:00.000Z',text:body,
 };
}
const format='Report of Receipts and Expenditures for Principal Campaign Committee\n';
test('exact official Lang-original and Putnam-amended 2023 source holds only, with original SHA/bytes',()=>{
 assert.equal(target.length,2);
 assert.deepEqual(target.map(x=>x.id),
   ['17994:23:pcc:YE:0:0','18430:23:pcc:YE:0:1']);
 const lang=target[0]!,putnam=target[1]!;
 assert.equal(lang.reg,'17994');
 assert.equal(lang.actual2022ServingSenator,'Andrew R. Lang');
 assert.equal(lang.amendmentIndex,0);
 assert.equal(lang.expectedPdfSha256,
   '34022e5691aca08f318436ecbc30a1b3e2d5a32c2ad11a19ee0d64fb77443aba');
 assert.equal(lang.knownBoardReceipt,'2023-12-29');
 assert.equal(putnam.reg,'18430');
 assert.equal(putnam.amendmentIndex,1);
 assert.equal(putnam.actual2022ServingSenator,'Aric Putnam');
 assert.equal(putnam.expectedPdfSha256,
   '5da25294735f3b7b62608755df926b38917a69aaf90b13c9999396de0d710c54');
 assert.equal(putnam.knownBoardReceipt,'2024-04-04');
});
test('historically pinned original-source PDF identities and committee evidence cannot be replaced',()=>{
 assert.throws(()=>selectTwoHeldOfficialCfbSourceDocuments({...originals,
   lang16Psv:originals.lang16Psv.replace('381617','381618')}),/changed/);
 assert.throws(()=>selectTwoHeldOfficialCfbSourceDocuments({...originals,
   putnam16Psv:originals.putnam16Psv.replace('149845','149846')}),/changed/);
 assert.throws(()=>selectTwoHeldOfficialCfbSourceDocuments({...originals,
   langCheckpointJson:originals.langCheckpointJson.replace('"authenticDistinctOriginalPdfForms": 15',
     '"authenticDistinctOriginalPdfForms": 16')}),/changed/);
 assert.throws(()=>selectTwoHeldOfficialCfbSourceDocuments({...originals,
   putnamCheckpointJson:originals.putnamCheckpointJson.replace(
     '"distinctAuthenticatedAmendedPdfBinaries": 14',
     '"distinctAuthenticatedAmendedPdfBinaries": 16')}),/changed/);
});
test('structural metadata from PDF reports neither leaks printed third-party names nor certifies a held source',()=>{
 const l=target[0]!;
 const suspicious=format+
  'Registration Number: 999999\nSenate District: 22\n'+
  'Period Covered: 1/1/2023 through 12/31/2023\n'+
  'Received by the Board December 29, 2023';
 const sample=analyzeHeldCfbSourceBinary(l,mock(l,suspicious),'POST');
 assert.equal(sample.samePdfAsPreviouslyHeldOfficialSource,true);
 assert.equal(sample.originalSourceFirst6500CharactersOnly.expectedRegistrationFieldMatches,false);
 assert.equal(sample.originalSourceFirst6500CharactersOnly.expectedSenateDistrictFieldMatches,false);
 assert.equal(sample.originalSourceFirst6500CharactersOnly.boardReceiptMatchesPriorSource,true);
 assert.equal(sample.originalSourceFirst6500CharactersOnly.receivedBeforeCoverageEnd,true);
 assert.equal(sample.independentOriginalPdfFirstPageCertified,false);
 assert.equal(sample.previouslyHeldIdentityStillHeld,true);
 const output=JSON.stringify(sample);
 assert.equal(output.includes('999999'),false);
 const post=sample;
 const get=analyzeHeldCfbSourceBinary(l,mock(l,suspicious),'GET');
 assert.equal(compareHeldCfbGetPost(l,post,get).independentGetAndPostBinariesIdentical,true);
 const different=analyzeHeldCfbSourceBinary(l,{
  ...mock(l,suspicious),sha256:'a'.repeat(64)},'GET');
 assert.equal(compareHeldCfbGetPost(l,post,different)
   .independentGetAndPostBinariesIdentical,false);
 const failed=analyzeHeldCfbSourceBinary(l,null,'GET','official_source_http_failure');
 assert.equal(compareHeldCfbGetPost(l,post,failed).independentlyGetRetrieved,false);
});
test('previously held Putnam original PDF index cannot be promoted to certified amendment',()=>{
 const p=target[1]!;
 const anomaly=format+
   'Senate District: 14\nRegistration Number: 00001\n'+
   'Period Covered: 1/1/2023 through 12/31/2023\n'+
   'Received by the Board April 4, 2024';
 const result=analyzeHeldCfbSourceBinary(p,mock(p,anomaly),'POST');
 assert.equal(result.originalSourceFirst6500CharactersOnly.expectedSenateDistrictFieldMatches,true);
 assert.equal(result.originalSourceFirst6500CharactersOnly.expectedRegistrationFieldMatches,false);
 assert.equal(result.originalSourceFirst6500CharactersOnly.originalPeriodMatches,true);
 assert.equal(result.originalSourceFirst6500CharactersOnly.boardReceiptMatchesPriorSource,true);
 assert.equal(result.independentOriginalPdfFirstPageCertified,false);
 assert.equal(result.rawReportTextPersisted,false);
 assert.equal(result.rawPdfBytesPersisted,false);
});

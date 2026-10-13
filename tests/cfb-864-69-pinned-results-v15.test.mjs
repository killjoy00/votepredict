import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const DIR='docs/evaluation/source-proof/';
const PSV=DIR+'cfb-2023-24-69-original-pdf-source-results-v15.psv';
const CPK=DIR+'cfb-2023-24-69-original-pdf-source-result-checkpoint-v15.json';
const TARGET=DIR+'cfb-2023-24-35-senators-69-yearend-original-source-targets-v15.psv';
const V12=DIR+'cfb-2021-25-served-25-panel-229-exact-version-ledger.psv';
const data=readFileSync(PSV,'utf8');
const cp=JSON.parse(readFileSync(CPK,'utf8'));
const rows=data.trimEnd().split('\n').map(l=>l.split('|'));
const sha=v=>createHash('sha256').update(v).digest('hex');
const blob=v=>createHash('sha1').update('blob '+Buffer.byteLength(v)+'\0').update(v).digest('hex');
const ids=new Set();
for(const t of readFileSync(TARGET,'utf8').trimEnd().split('\n')){
 const [reg,,district,api,years]=t.split('|');
 assert.match(api,/^[a-f0-9]{64}$/);
 assert.ok(Number(district)>0);
 for(const year of years.split(','))ids.add(reg+':'+year.slice(2)+':pcc:YE:0:0');
}
const old=new Set(readFileSync(V12,'utf8').trimEnd().split('\n')
 .map(l=>l.split('|')[0]));
test('69 original CFB PDF source-metadata rows preserve exact independent artifact receipt',()=>{
 assert.equal(sha(data),cp.permanentOutput.sha256);
 assert.equal(blob(data),cp.permanentOutput.gitBlobSha);
 assert.equal(rows.length,69);
 assert.equal(ids.size,69);
 assert.equal(new Set(rows.map(r=>r[0])).size,69);
 assert.equal(new Set(rows.map(r=>r[2])).size,69);
 assert.equal(cp.independentGithubSourceProof.sourceAcquisitionJobStatus,'success');
 assert.equal(cp.independentGithubSourceProof.originalViewerShaRechecks,35);
 assert.equal(cp.independentGithubSourceProof.sourceArtifactId,11792916750);
 assert.match(cp.independentGithubSourceProof.sourceArtifactZipSha256,/^[a-f0-9]{64}$/);
 assert.match(cp.independentGithubSourceProof.sourceArtifactJsonSha256,/^[a-f0-9]{64}$/);
});
test('every PDF source identity belongs to a Senate person and previously unverified exact report',()=>{
 for(const r of rows){
  assert.equal(r.length,12);
  const [id,status,pdfSha,bytes,from,through,board,due,floor,regMatch,distMatch,observed]=r;
  assert.ok(ids.has(id));
  assert.ok(!old.has(id));
  assert.match(pdfSha,/^[a-f0-9]{64}$/);
  assert.ok(+bytes>1000&&+bytes<30000000);
  assert.match(observed,/^2026-10-13T\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.ok(from<=through);
  assert.equal(through,'20'+id.split(':')[1]+'-12-31');
  assert.match(board,/^\d{4}-\d\d-\d\d$/);
  const year=Number(id.split(':')[1]);
  assert.equal(due,year===23?'2024-01-31':'2025-01-31');
  if(status==='AUTH'){
   assert.equal(regMatch,'true');assert.equal(distMatch,'true');
   assert.equal(from,'20'+year+'-01-01');
   const bound=year===23?'2024-02-01':'2025-02-01';
   assert.equal(floor,board>bound?board:bound);
  }else{
   assert.equal(status,'HOLD_HEADER');
   assert.equal(floor,'-');
  }
 }
});
test('six source identity holds stay held; no historical publication time is invented',()=>{
 const held=new Set(rows.filter(r=>r[1]==='HOLD_HEADER').map(r=>r[0]));
 const expected=new Set(['12339:23:pcc:YE:0:0','17316:23:pcc:YE:0:0',
  '18011:23:pcc:YE:0:0','18453:24:pcc:YE:0:0',
  '18809:23:pcc:YE:0:0','18917:23:pcc:YE:0:0']);
 assert.deepEqual(held,expected);
 assert.deepEqual(new Set(cp.heldOriginals.map(r=>r.id)),expected);
 assert.equal(cp.heldOriginals.filter(x=>x.reason==='first_page_registration_number_not_verified').length,5);
 assert.equal(cp.result.independentlyAuthenticatedDistinctPdfBinaries,63);
 assert.equal(cp.result.firstPageIdentityHolds,6);
 assert.equal(cp.result.newCombinedDistinctAuthenticatedPdfs,286);
 assert.equal(cp.result.independentlyProvenHistoricalPublicByOnCount,0);
 assert.equal(cp.result.legallyOwedReportDenominator,null);
 assert.equal(cp.cautions.noPrivateTransactionRowsOrPdfBodySaved,true);
});

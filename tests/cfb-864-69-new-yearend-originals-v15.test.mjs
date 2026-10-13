import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 SCHEMA,TARGET,select69ServedOriginals,offlineTargets,
 classifyPublicAvailability,classifySourceFailure,
 capture69,summarize69PdfProofs
} from '../scripts/capture-cfb-864-69-new-2023-24-yearend-originals-v15.mjs';

const TARGET_PSV=readFileSync(TARGET,'utf8');
const VIEWER_PSV=readFileSync('docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8');
const VIEWER_CP=readFileSync('docs/evaluation/source-proof/cfb-2021-24-senate-396-source-viewer-count-checkpoint.json','utf8');
const V12_PSV=readFileSync('docs/evaluation/source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv','utf8');
const select=(overrides={})=>select69ServedOriginals({
 targetPsv:TARGET_PSV,viewerPsv:VIEWER_PSV,
 viewerCheckpoint:VIEWER_CP,v12Psv:V12_PSV,...overrides
});
const targets=select();
const sha=s=>createHash('sha256').update(s).digest('hex');

test('exact official sample selects 69 previously unverified originals in 35 serving identities',()=>{
 assert.match(SCHEMA,/69-original-2023-24/);
 assert.equal(targets.length,69);
 assert.equal(new Set(targets.map(x=>x.reg)).size,35);
 assert.equal(new Set(targets.map(x=>x.id)).size,69);
 assert.equal(targets.filter(t=>t.year===2023).length,34);
 assert.equal(targets.filter(t=>t.year===2024).length,35);
 assert.equal(targets.filter(t=>t.matchingClass.startsWith('reviewed')).length,10);
 assert.deepEqual(offlineTargets(),targets);
 assert.ok(targets.every(t=>!V12_PSV.includes(t.id+'|')));
 assert.ok(targets.every(t=>t.id===t.reg+':'+String(t.year).slice(2)+':pcc:YE:0:0'));
});
test('tampered official CFB viewer SHA, version identity or new unproved committee fails closed',()=>{
 assert.throws(()=>select({targetPsv:TARGET_PSV.replace(
  /9aa98db94be38abff2205eb4787f91974a0e66091fdffa2d55be289665e4110d/,
  'a'.repeat(64))}),/mismatch/);
 assert.throws(()=>select({targetPsv:TARGET_PSV.replace(
  '11880|John J. Marty|40','11881|John J. Marty|40')}));
 assert.throws(()=>select({viewerPsv:VIEWER_PSV.replace(
  '9aa98db94be38abff2205eb4787f91974a0e66091fdffa2d55be289665e4110d',
  'a'.repeat(64))}),/SHA mismatch/);
 assert.throws(()=>select({v12Psv:V12_PSV+'11880:23:pcc:YE:0:0|already verified'}));
 assert.throws(()=>select({targetPsv:TARGET_PSV.replace(
  '16246|Jim Carlson|52','16246|Jim Carlson|53')}));
 assert.throws(()=>select({targetPsv:TARGET_PSV.replace(
  'reviewed_name_variant_same_office_district','exact_first_last_same_office_district')}));
});
test('statutory due+1 not-before floor never creates actual historical public-by date',()=>{
 assert.deepEqual(classifyPublicAvailability(2023,'2024-01-07',true),
  {dueOn:'2024-01-31',notBeforeOn:'2024-02-01',publicByOn:null});
 assert.deepEqual(classifyPublicAvailability(2024,'2025-02-20',true),
  {dueOn:'2025-01-31',notBeforeOn:'2025-02-20',publicByOn:null});
 assert.deepEqual(classifyPublicAvailability(2024,null,false),
  {dueOn:'2025-01-31',notBeforeOn:null,publicByOn:null});
 assert.throws(()=>classifyPublicAvailability(2022,'2023-01-31',true));
 assert.equal(classifySourceFailure(Error('abort / timeout')),'source_timeout_hold');
 assert.equal(classifySourceFailure(Error('original SHA drift')),'official_api_sha_drift_hold');
 assert.equal(classifySourceFailure(Error('origin HTTP 503')),'source_http_hold');
});
function officialUrl(reg){
 return 'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2024/';
}
function reportPdfUrl(ref){
 const u=new URL('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF');
 for(const [k,v]of Object.entries({
  downloadpdf:'false',year:ref.year,type:ref.type,period:ref.period,se:ref.se,
  regnum:ref.registrationNumber,amend:String(ref.amendment)}))
   u.searchParams.set(k,v);
 return u.toString();
}
const byReg=new Map();
for(const t of targets)byReg.set(t.reg,[...(byReg.get(t.reg)??[]),t]);
async function fakeSnap(reg){
 const tt=byReg.get(reg);
 return{sourceUrl:officialUrl(reg),responseSha256:tt[0].sourceApiSha256,
  references:tt.map(t=>({registrationNumber:reg,year:String(t.year).slice(2),
   type:'pcc',period:'YE',se:'0',amendment:0,filingYear:t.year,reportName:'yearend'}))};
}
async function fakePdf(ref){
 const y=2000+Number(ref.year),target=byReg.get(ref.registrationNumber)
  .find(t=>t.year===y);
 const content='Report of Receipts and Expenditures for Principal Campaign Committee '+
 'Registration Number: '+ref.registrationNumber+' Senate District '+target.sourceDistrict+
 ' Period Covered: 1/1/'+y+' through 12/31/'+y+
 ' Received by the Board: January 25, '+(y+1);
 return{sourceUrl:reportPdfUrl(ref),
  contentSha256:sha(target.id),bytes:33458,text:content,
  fetchedAt:'2026-10-13T05:00:00.000Z'};
}
test('synthetic 69-source replay preserves SHA identity, PDF first-page proof, public-by unknown',async()=>{
 const r=await capture69({targets,fetchSnapshot:fakeSnap,fetchPdf:fakePdf});
 assert.equal(r.sourceChecks.length,35);
 assert.equal(r.receipt.expectedReferences,69);
 assert.equal(r.receipt.fetchedPdfBodies,69);
 assert.equal(r.receipt.strictFirstPageAuthenticated,69);
 assert.equal(r.receipt.matchedOriginalHashesDistinct,69);
 assert.equal(r.receipt.sourceIdentityOrTransportHolds,0);
 assert.equal(r.receipt.authenticated2023,34);
 assert.equal(r.receipt.authenticated2024,35);
 assert.equal(r.receipt.exactHistoricalPublicByProven,0);
 assert.ok(r.results.every(x=>x.historicalPublicByOn===null
  &&x.legallyOwedReport===null&&!x.pdfDataExported
  &&x.headerSenateDistrictMatches&&x.headerCommitteeRegistrationMatches
  &&x.reportingPeriodStartOn===x.reportYear+'-01-01'
  &&x.reportingPeriodEndOn===x.reportYear+'-12-31'));
});
test('official viewer-body SHA mismatch suppresses both a committee exact-original PDF promotions',async()=>{
 const fakeChanged=async reg=> {
  const z=await fakeSnap(reg);
  if(reg==='11880')z.responseSha256='0'.repeat(64);
  return z;
 };
 const r=await capture69({targets,fetchSnapshot:fakeChanged,fetchPdf:fakePdf});
 assert.equal(r.receipt.strictFirstPageAuthenticated,67);
 assert.equal(r.receipt.sourceIdentityOrTransportHolds,2);
 assert.deepEqual(new Set(r.results.filter(x=>x.sourcePdfSha256===null)
  .map(x=>x.committeeRegistration)),new Set(['11880']));
 assert.equal(r.sourceChecks.filter(x=>x.status==='official_api_sha_drift_hold').length,1);
 assert.equal(r.receipt.exactHistoricalPublicByProven,0);
});
test('headers from another district remain HELD even when bytes and viewer ID match',async()=>{
 const wrong=async(ref,opts)=>{
  const p=await fakePdf(ref,opts);
  if(ref.registrationNumber==='11880')
   p.text=p.text.replace('Senate District 40','Senate District 39');
  return p;
 };
 const r=await capture69({targets,fetchSnapshot:fakeSnap,fetchPdf:wrong});
 assert.equal(r.receipt.strictFirstPageAuthenticated,67);
 assert.equal(r.results.filter(x=>x.status==='pdf_header_identity_hold').length,2);
 assert.ok(r.results.filter(x=>x.status==='pdf_header_identity_hold')
  .every(x=>x.conservativeNotBeforeOn===null&&x.historicalPublicByOn===null));
 const altered=[...r.results];altered[0]={...altered[0],historicalPublicByOn:'2024-02-01'};
 assert.throws(()=>summarize69PdfProofs(altered));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowOfficialFiveVersionManifest,verifyOfficialPageTextExtract,lexicalChangeScore,audit}
 from '../scripts/audit-senate-864-hf669-five-current-original-legislative-versions.mjs';
const m=JSON.parse(readFileSync('data/evaluation/senate-864-2023-hf669-five-official-text-versions-asof-research-v1.json','utf8'));
const clone=x=>structuredClone(x);
const codes=['H0669-3','UEH0669-1','UEH0669-2','UEH0669-3','H0669-4'];
const all=['third_engrossment_march07','first_unofficial_march14','second_unofficial_march16',
  'third_unofficial_may22','fourth_engrossment_may23'];
function testText(code,words='bond proceeds fund public facilities authority university of minnesota'){
 return 'Minnesota Legislature House HF669 '+code+'\n'+
  (words+' appropriations from state fund local roads and bridges.\n').repeat(125);
}
test('allowlist exactly five official canonical session 93 Revisor bill text versions',()=>{
 assert.equal(allowOfficialFiveVersionManifest(m),true);
 assert.deepEqual(m.versionSources.map(x=>x.id),all);
 assert.equal(m.governmentRecordedSenateDecisions[0].no,32);
 assert.equal(m.governmentRecordedSenateDecisions[1].yes,56);
});
test('reject future version page header backdated to May 22 merely because Revisor list displays date',()=>{
 const d=clone(m);d.versionSources[3].versionPageCurrentPostedAtLocal='2023-05-22 12:00 p.m.';
 assert.throws(()=>allowOfficialFiveVersionManifest(d),/cannot be relabeled/);
 const e=clone(m);e.versionSources[4].listedPostedDate='2023-05-22';
 assert.throws(()=>allowOfficialFiveVersionManifest(e),/cannot be relabeled/);
});
test('reject legislative version with changed session, chamber, bill, official URL or PDF host',()=>{
 for(const mutate of [
  d=>d.versionSources[1].pdfUrl='https://www.revisor.mn.gov/bills/93/2023/0/HF/670/versions/ue/1/pdf/',
  d=>d.versionSources[2].printedTitle='FIRST UNOFFICIAL ENGROSSMENT',
  d=>d.versionSources[0].path='ue/0',
  d=>d.relatedButDistinctLegislativeDecisions[1].notLegallySameAsHF669=false,
 ]){
  const x=clone(m);mutate(x);assert.throws(()=>allowOfficialFiveVersionManifest(x));
 }
});
test('official PDF header must independently prove HF669 and expected exact version code',()=>{
 const v=m.versionSources[2];
 const right=verifyOfficialPageTextExtract({text:testText(codes[2]),pages:66},v);
 assert.match(right.normalizedTextSha256,/^[a-f0-9]{64}$/);
 assert.ok(right.normalizedTextWords>1500);
 assert.equal(right.pageCount,66);
 const wrongCode=testText(codes[0]);
 assert.throws(()=>verifyOfficialPageTextExtract({text:wrongCode,pages:66},v),/code does not match/);
 // OFFICIAL H0669-3 must not match the overlapping suffix in UEH0669-3.
 assert.throws(()=>verifyOfficialPageTextExtract({text:testText(codes[3]),pages:83},
   m.versionSources[0]),/code does not match/);
 const wrongBill=testText(codes[2]).replace(/HF669/g,'HF670');
 assert.throws(()=>verifyOfficialPageTextExtract({text:wrongBill,pages:66},v),/different bill/);
});
test('short, incomplete, wrong PDF pages and HTML must never be promoted',()=>{
 const v=m.versionSources[2];
 assert.throws(()=>verifyOfficialPageTextExtract({text:'HF669 UEH0669-2',pages:66},v));
 assert.throws(()=>verifyOfficialPageTextExtract({text:testText(codes[2]),pages:2},v));
});
test('lexical overlap compares whole versions, not merely title, and never labels exact bill policy changes',()=>{
 const a=testText(codes[0],'university state local and roads capital projects').split(/\s+/).filter(Boolean);
 const b=testText(codes[0],'university state local and roads capital projects').split(/\s+/).filter(Boolean);
 const c=testText(codes[3],'different transportation tax relief nursing home welfare programs').split(/\s+/).filter(Boolean);
 const same=lexicalChangeScore(a,b);
 const diff=lexicalChangeScore(a,c);
 assert.equal(same.eightWordContiguousShingleJaccard,1);
 assert.ok(diff.eightWordContiguousShingleJaccard<0.5);
 assert.equal(diff.lexicalDistanceIsNotLegalSectionOrFiscalLineItemDelta,true);
});
test('provider rejects or too-small pseudo-PDF returns five UNKNOWN, never inferred equal bills',async()=>{
 const results=await audit(m,async()=>new Response('blocked',{status:503}));
 assert.equal(results.versionsOriginalSHA256AndBillIdentityAuthenticated,0);
 assert.ok(results.documents.every(x=>x.status==='OFFICIAL_CURRENT_REVISOR_PDF_OR_TEXT_UNAVAILABLE_UNKNOWN'));
 assert.ok(results.comparisons.every(x=>x.eightWordContiguousShingleJaccard===null));
});
test('run whole PDF byte SHA checks on all five versions; compare different March/May page counts',async()=>{
 const pdfBytesByCode=new Map(codes.map(c=>[c,Buffer.concat([
  Buffer.from('%PDF-1.7\n'+c+'\n'),Buffer.alloc(6000,c.charCodeAt(0))])]));
 const fakeFetch=async url=>{
  const i=m.versionSources.findIndex(x=>x.pdfUrl===url);
  if(i<0)return new Response('bad',{status:404});
  return new Response(pdfBytesByCode.get(codes[i]),{status:200,headers:{'content-type':'application/pdf'}});
 };
 const fakeExtract=async bytes=>{
  const match=[...codes].sort((a,b)=>b.length-a.length).find(c=>bytes.toString('ascii',0,80).includes(c));
  if(!match)throw Error('unknown simulated version PDF code');
  return {pages:codes.indexOf(match)<3?66:83,text:testText(match,match.includes('UEH0669-3')?
     'road bridges capital projects public facilities authority':'University of Minnesota bond proceeds fund water infrastructure')};
 };
 const result=await audit(m,fakeFetch,fakeExtract);
 assert.equal(result.versionsOriginalSHA256AndBillIdentityAuthenticated,5);
 assert.deepEqual(result.documents.map(x=>x.originalPages),[66,66,66,83,83]);
 assert.equal(result.comparisons.length,5);
 assert.equal(result.comparisons[2].comparativeOriginalPageCountDifference,17);
 assert.equal(result.comparisons[2].sameNormalizedOriginalTextHash,false);
 assert.equal(result.observations.noExactMomentOfFloorDecisionStatutoryTextIndependentlyProved,true);
 assert.equal(result.noProductionWritesModelForecastTrainingServingOrDeployments,true);
 assert.ok(result.documents.every(x=>/^[a-f0-9]{64}$/.test(x.rawPdfSha256)&&x.sourcePdfOrFullBillTextNotPersisted));
});

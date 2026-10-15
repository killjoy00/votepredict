import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{SCHEMA,selectOfficial2025CfbReportIds}
 from'../scripts/acquire-cfb-864-2025-all-serving-senator-viewer-refs-v34.mjs';
const person={name:'Doron Clark',registrationNumber:'19196'};
const root={registrationNumber:'19196',segmentEndYear:2026,
 sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/19196/2026/',
 responseSha256:'e'.repeat(64),fetchedAt:'2026-10-14T21:00:00.000Z'};
const ref=(y,p,a=0,se='0',reg='19196')=>({
 registrationNumber:reg,year:y,type:'pcc',period:p,se,amendment:a,
 reportName:'Gov candidate source report',filingYear:2000+Number(y)});
test('exact source 2025 original report ID types and all amendments counted rather than yearend-only PDF parser gate',()=>{
 assert.equal(SCHEMA,'cfb-864-2025-70-actual-serving-senators-fresh-original-2026-viewer-source-v34');
 const r=selectOfficial2025CfbReportIds(person,{...root,references:[
 ref('25','YE'),ref('25','YE',1),ref('25','E',0,'1'),ref('26','YE'),ref('25','YE',1),ref('25','E',0,'1','19229')]
 },new Set(['19196:25:pcc:YE:0:0']));
 assert.deepEqual(r.exactOfficial2025References,[
 '19196:25:pcc:E:1:0','19196:25:pcc:YE:0:0','19196:25:pcc:YE:0:1']);
 assert.deepEqual(r.additionalUnindexedIds,['19196:25:pcc:E:1:0','19196:25:pcc:YE:0:1']);
 assert.deepEqual(r.alreadyIndexedIn2021to25V33,['19196:25:pcc:YE:0:0']);
 assert.deepEqual(r.repeatedVersionIdsInSource,['19196:25:pcc:YE:0:1']);
});
test('untrusted/ambiguous government candidate viewer registration, official URL or raw response SHA remains held not coalesced into another senator',()=>{
 const valid={...root,references:[ref('25','YE')]};
 assert.throws(()=>selectOfficial2025CfbReportIds(person,{...valid,responseSha256:'bad'},new Set()));
 assert.throws(()=>selectOfficial2025CfbReportIds(person,{...valid,registrationNumber:'12345'},new Set()));
 assert.throws(()=>selectOfficial2025CfbReportIds(person,{...valid,sourceUrl:'https://untrusted.com/19196/2026/'},new Set()));
 assert.throws(()=>selectOfficial2025CfbReportIds(person,{...valid,references:[ref('25','YE',101)]},new Set()));
});
test('2025 actual-serving original source cohort not 2026 future reports and no donor data or private app writes',()=>{
 const yaml=readFileSync('.github/workflows/senate-864-2025-70-serving-original-viewer-inventory-v34.yml','utf8');
 assert.match(yaml,/pull_request:/);
 assert.match(yaml,/contents: read/);
 assert.match(yaml,/node --import tsx --test tests\/cfb-864-2025-70-serving-viewer-inventory-v34.test.mjs/);
 assert.match(yaml,/node --import tsx scripts\/acquire-cfb-864-2025-all-serving-senator-viewer-refs-v34.mjs/);
 assert.doesNotMatch(yaml,/NEON|secrets\.|upload-artifact|workflow_dispatch|schedule:|deploy|issues: write|gh run/i);
});

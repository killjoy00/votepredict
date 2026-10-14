import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{originalV20Sources,targetedYearEndVersionIds,deriveBoundedTargetTasks,SCHEMA}
 from '../scripts/recover-cfb-864-nine-held-four-amendments-v22.mjs';
import{chooseActual38ServingSenatorsIn2021And2022}
 from '../scripts/acquire-cfb-864-38-served-2021-22-original-amended-yearend-pdfs-v20.mjs';

const source=originalV20Sources(),people=chooseActual38ServingSenatorsIn2021And2022();
const reg='17021',viewer=source.viewers.get(reg);
const ref=(reg,year,amend)=>({registrationNumber:reg,year:String(year).slice(2),type:'pcc',
 period:'YE',se:'0',amendment:amend,reportName:'Official CFB YE',filingYear:year});
const api=(reg,refs)=>({registrationNumber:reg,segmentEndYear:2022,
 sourceUrl:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2022/',
 responseSha256:source.viewers.get(reg)[3],references:refs});
test('V22 preserves the exact nine 2021/22 full original government PDF held IDs and four previously unselected authentic amended references only',()=>{
 assert.equal(SCHEMA,'cfb-864-nine-held-four-overflow-original-pdf-probe-v22');
 assert.equal(people.length,38);
 assert.equal(source.byId.size,132);
 assert.equal(source.viewers.size,38);
 assert.equal(source.holds.length,9);
 assert.equal(source.holds.filter(v=>v[9]==='source_fetch_hold').length,1);
 assert.ok(source.holds.every(v=>v[19]==='-'&&v[16]==='-'));
});
test('additional CFB 2022 amended-index references need exact source registration, original viewer response SHA and correct period',()=>{
 const amended=[ref(reg,2022,0),ref(reg,2022,1),ref(reg,2022,2),ref(reg,2022,3),ref(reg,2022,4)];
 const x=targetedYearEndVersionIds(reg,api(reg,amended),source);
 assert.deepEqual(x.target.map(t=>t.amendment),[3,4]);
 assert.deepEqual(x.absent,[]);
 assert.equal(x.all2021and2022YearEndVersionReferences,5);
 assert.throws(()=>targetedYearEndVersionIds(reg,{...api(reg,amended),responseSha256:'f'.repeat(64)},source));
 assert.throws(()=>targetedYearEndVersionIds(reg,{...api(reg,amended),sourceUrl:'https://untrusted.example/2022'},source));
 assert.throws(()=>targetedYearEndVersionIds(reg,api(reg,[...amended,amended[0]]),source));
});
test('held original and held first amendment are retained exact source identities not missing statutory owed reports',()=>{
 const held='17929',a=api(held,[ref(held,2021,0),ref(held,2022,0),ref(held,2022,1)]);
 const x=targetedYearEndVersionIds(held,a,source);
 assert.equal(x.target.length,3);
 assert.equal(x.absent.length,0);
 const absent=targetedYearEndVersionIds(held,api(held,[ref(held,2022,0)]),source);
 assert.equal(absent.target.length,1);
 assert.deepEqual(absent.absent.sort(),['17929:21:pcc:YE:0:0','17929:22:pcc:YE:0:1']);
});
test('missing official candidate viewer response or source SHA drift produces HOLD without promoting any old report',()=>{
 const planned=deriveBoundedTargetTasks(people,source,new Map());
 assert.equal(planned.selected.length,0);
 assert.ok(planned.missing.length>0);
 assert.ok(planned.missing.every(x=>x.sourceStatus==='original_viewer_fetch_hold'));
});
test('source workflow source-only, short-lived archived original, no Neon/secrets, no raw PDF upload',()=>{
 const y=readFileSync('.github/workflows/senate-864-nine-held-four-extra-original-pdfs-v22.yml','utf8');
 assert.match(y,/pull_request:/);
 assert.match(y,/contents: read/);
 assert.match(y,/actions: read/);
 assert.match(y,/gh run download 38081628130/);
 assert.match(y,/node --import tsx --test tests\/cfb-864-nine-held-four-extra-original-pdf-v22.test.mjs/);
 assert.doesNotMatch(y,/NEON|secrets\.|upload-artifact|issues: write|workflow_dispatch|schedule:|deploy/);
});

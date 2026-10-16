import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import target from '../../data/evaluation/senate-three-new-served-person-2022-campaign-domains-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory} from
 '../../src/evidence/senate-official-ever-served-directory.js';
import {
 verifyThreeActualServed2022Candidates,originalSenator2022DomainIndexUrl,
 parseThreeActualSenator2022DomainIndex,chooseSourcePageVersionCandidates,
 acquireThree2022ActuallyServedCampaignDomains,
} from '../../scripts/acquire-senate-three-new-served-2022-campaign-domains.js';

function lrl():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir' as const;
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:300000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Judy Seeberger',officialNameRaw:'Seeberger, Judy',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'41'}]},
   {officialName:'Bonnie Westlin',officialNameRaw:'Westlin, Bonnie',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'42'}]},
   {officialName:'Steve A. Cwodzinski',officialNameRaw:'Cwodzinski, Steve A.',
    officialSourceUrl:url,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'49'}]},
  ],
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(t:string,u:string)=>[t,u,'text/html','200','A'.repeat(32),'12345'];

test('2022 archive targets are only three independently served real senators, not their opponents',()=>{
 const x=verifyThreeActualServed2022Candidates(lrl());
 assert.deepEqual(x.map(p=>p.person),['Judy Seeberger','Bonnie Westlin','Steve Cwodzinski']);
 assert.deepEqual(x.map(p=>p.district),['41','42','49']);
 assert.equal(target.officialSenatorSource.originalRunId,38094976711);
 assert.equal(target.rules.noSourceAdmissionForecastDatabaseProductionOrModelChanges,true);
 const unknown=lrl();unknown.senators.pop();
 assert.throws(()=>verifyThreeActualServed2022Candidates(unknown),/independently actually served/);
 const changed=lrl();changed.senators[0].senateServiceTerms[0].district='48';
 assert.throws(()=>verifyThreeActualServed2022Candidates(changed),/independently actually served/);
});
test('Wayback original CDX queries are restricted to pinned 2022 candidate domains',()=>{
 const query=originalSenator2022DomainIndexUrl('judyforsenate.com');
 const u=new URL(query);
 assert.equal(u.hostname,'web.archive.org');
 assert.equal(u.searchParams.get('from'),'20220101');
 assert.equal(u.searchParams.get('to'),'20221107');
 assert.equal(u.searchParams.get('matchType'),'domain');
 assert.equal(u.searchParams.get('limit'),'300');
 assert.throws(()=>originalSenator2022DomainIndexUrl('not-a-senator.com'),/Unknown/);
});
test('original source index accepts true bounded 2022 same-domain HTML and rejects another host, non-2022 or unsafe path',()=>{
 const result=parseThreeActualSenator2022DomainIndex([header,
  row('20220904113300','https://judyforsenate.com/priorities/'),
  row('20221004113300','https://judyforsenate.com/'),
  row('20220905113300','https://judyforsenate.com.evil.test/priorities'),
  row('20241105113300','https://judyforsenate.com/priorities/'),
  row('20221005113300','https://judyforsenate.com/wp-admin/login'),
 ],'judyforsenate.com');
 assert.equal(result.found.length,2);
 assert.equal(result.sampleAtCapacity,false);
 assert.equal(result.found[0].capturedAt,'2022-09-04T11:33:00.000Z');
 assert.ok(result.found[0].original.endsWith('/priorities/'));
 assert.equal(chooseSourcePageVersionCandidates(result.found).length,2);
 assert.throws(()=>parseThreeActualSenator2022DomainIndex([header], 'nonserving.example'),
  /Unapproved/);
 assert.throws(()=>parseThreeActualSenator2022DomainIndex([['timestamp','digest']],
  'judyforsenate.com'),/column layout/);
});
test('a successful [] query is only an observed index zero, not proof of no political platform',()=>{
 const r=parseThreeActualSenator2022DomainIndex([], 'cwodforsenate.com');
 assert.equal(r.validEmpty,true);assert.equal(r.rows,0);
 assert.equal(r.found.length,0);
 assert.equal(r.sampleAtCapacity,false);
});
test('all Wayback network failures remain dated unknown; no missing policy/page inferred',async()=>{
 const d=mkdtempSync(join(tmpdir(),'senate-three-2022-source-index-'));
 const output=join(d,'originals');
 try{
  const denied=(async()=>{throw Error('offline API unavailable');}) as typeof fetch;
  const report=await acquireThree2022ActuallyServedCampaignDomains(output,lrl(),denied);
  assert.equal(report.totals.onlyOfficialActuallyServedSenatorsExamined,3);
  assert.equal(report.totals.originalDomainIndexQueriesMade,3);
  assert.equal(report.totals.originalIndexHttp200Count,0);
  assert.equal(report.totals.candidateIssueExcerptPositionRowsPromoted,0);
  assert.ok(report.senators.every(x=>
   x.actualBoundedHistoricalHtmlIndexRows===null
   &&x.indexFailureReason?.includes('offline API unavailable')
   &&x.replays.length===0
   &&x.unavailableHistoricalIndexIsNotProofOfNoPosition===true));
  assert.ok(existsSync(join(output,'acquisition-manifest.json')));
  const saved=JSON.parse(readFileSync(join(output,'acquisition-manifest.json'),'utf8'));
  assert.equal(saved.controls.noProductionChanges,true);
  await assert.rejects(
   acquireThree2022ActuallyServedCampaignDomains(output,lrl(),denied),
   /already exists/);
 }finally{rmSync(d,{recursive:true,force:true});}
});

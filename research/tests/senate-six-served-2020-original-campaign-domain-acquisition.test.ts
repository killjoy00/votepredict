import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import targets from '../../data/evaluation/senate-six-served-2020-historical-original-campaign-domain-targets-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 FIXED_SIX_2020_SENATORS,verifyActualSixSenatorsFor2020OriginalCampaignArchive,
 real2020SenatorHistoricalCdxQuery,parse2020ActualSenatorOriginalCampaignCdx,
 choose2020OriginalCandidatePlatformReplays,
 acquire2020OriginalCampaignSitesOfSixActualSenators,
} from '../../scripts/acquire-senate-six-served-2020-original-campaign-domains.js';

function simulatedLRL():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:330000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true},
  senators:FIXED_SIX_2020_SENATORS.map(p=>({
   officialName:p.name,officialNameRaw:p.name,officialSourceUrl:url,
   senateServiceTerms:[{startsYear:2021,endsYear:2022,district:p.district}],
  })),
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const entry=(date:string,url:string)=>
 [date,url,'text/html','200','A'.repeat(32),'1000'];
test('2020 original campaigns require six unique actually served persons with 2021 official Senate service',()=>{
 assert.equal(FIXED_SIX_2020_SENATORS.length,6);
 assert.equal(targets.scope.electionDay,'2020-11-03');
 assert.equal(targets.scope.fromInclusive,'2019-01-01T00:00:00.000Z');
 assert.equal(verifyActualSixSenatorsFor2020OriginalCampaignArchive(simulatedLRL()).length,6);
 assert.equal(new Set(FIXED_SIX_2020_SENATORS.map(p=>p.domain)).size,6);
 assert.equal(targets.targets.find(p=>p.personLRLName==='Mary Kunesh')?.official2020BallotNameVariant,
  'Mary Kunesh-Podein');
 const altered=simulatedLRL();altered.senators.pop();
 assert.throws(()=>verifyActualSixSenatorsFor2020OriginalCampaignArchive(altered),
  /Not an original independently verified/);
 const renumbered=simulatedLRL();
 renumbered.senators.find(p=>p.officialName==='Steve Cwodzinski')!.senateServiceTerms[0].district='49';
 assert.throws(()=>verifyActualSixSenatorsFor2020OriginalCampaignArchive(renumbered),
  /Not an original independently verified/);
});
test('historic original archive search restricted to 2019-2020 and six candidates',()=>{
 const p=new URL(real2020SenatorHistoricalCdxQuery('marykunesh.com'));
 assert.equal(p.hostname,'web.archive.org');
 assert.equal(p.searchParams.get('from'),'20190101');
 assert.equal(p.searchParams.get('to'),'20201102');
 assert.equal(p.searchParams.get('limit'),'300');
 assert.equal(p.searchParams.get('matchType'),'domain');
 assert.throws(()=>real2020SenatorHistoricalCdxQuery('non-senator.example'),
  /outside verified/);
});
test('2020 CDX original source index filters future, opposite candidate hosts, image, query links',()=>{
 const index=[header,
  entry('20201029142100','https://votemcewen.com/issues'),
  entry('20191029142100','https://www.votemcewen.com/'),
  entry('20201103142100','https://votemcewen.com/issues'),
  entry('20221029142100','https://votemcewen.com/issues'),
  entry('20201029142100','https://votemcewen.com.evil.example/issue'),
  entry('20201029142100','https://votemcewen.com/issues?x=2026'),
  entry('20201029142100','https://votemcewen.com/image.jpg'),
  entry('20201029142100','https://votemcewen.com/wp-admin/login'),
 ];
 const r=parse2020ActualSenatorOriginalCampaignCdx(index,'votemcewen.com');
 assert.equal(r.pageRows.length,2);
 assert.equal(r.rawIndexRows,8);
 assert.equal(r.indexAtCap,false);
 assert.equal(r.pageRows[0].original,'https://votemcewen.com/issues');
 assert.equal(choose2020OriginalCandidatePlatformReplays(r.pageRows).length,2);
 assert.throws(()=>parse2020ActualSenatorOriginalCampaignCdx(index,'opponent.example'),
  /Non-serving/);
 assert.throws(()=>parse2020ActualSenatorOriginalCampaignCdx([['timestamp']],
  'votemcewen.com'),/header incomplete/);
});
test('300-row source index and four original replay cap do NOT establish full-page completeness',()=>{
 const rows=Array.from({length:300},(_,i)=>entry(
  '20201010'+String(i%24).padStart(2,'0')+'3310',
  'https://marykunesh.com/issues/'+i));
 const index=parse2020ActualSenatorOriginalCampaignCdx([header,...rows],'marykunesh.com');
 assert.equal(index.indexAtCap,true);
 assert.equal(index.pageRows.length,300);
 assert.equal(choose2020OriginalCandidatePlatformReplays(index.pageRows).length,4);
 assert.deepEqual(parse2020ActualSenatorOriginalCampaignCdx([],'marykunesh.com'),{
  pageRows:[],rawIndexRows:0,indexAtCap:false,validEmpty:true,
 });
});
test('failed archival HTTP requests produce 6 UNKNOWN sources and no extrapolated missing campaign positions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-six-original-2020-'));
 try{
  const dest=join(dir,'exact-official-archive-originals');
  const network=(async()=>{throw new Error('transient Wayback outage');}) as typeof fetch;
  const result=await acquire2020OriginalCampaignSitesOfSixActualSenators(
   dest,simulatedLRL(),network);
  assert.equal(result.totals.actuallyServedSenatorPeople,6);
  assert.equal(result.totals.year2019To2020OriginalCdxIndexQueries,6);
  assert.equal(result.totals.originalIndexSuccessfullyParsed,0);
  assert.equal(result.totals.authenticOriginalHtmlAndIndependentCdxMatches,0);
  assert.equal(result.totals.forecastFeatureRowsAdmitted,0);
  assert.ok(result.actualSenateCandidateDomains.every(x=>
   x.sampled2019To2020OriginalHtmlRows===null
   &&x.indexError?.includes('transient Wayback outage')));
  assert.equal(result.limits.failedSourceMeansUnknownNotNoIssuePositions,true);
  assert.ok(existsSync(join(dest,'acquisition-manifest.json')));
  const original=JSON.parse(readFileSync(join(dest,'acquisition-manifest.json'),'utf8'));
  assert.equal(original.limits.noProductionSourceModelServingOrDataChanges,true);
  await assert.rejects(acquire2020OriginalCampaignSitesOfSixActualSenators(
   dest,simulatedLRL(),network),/Refuse to overwrite/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

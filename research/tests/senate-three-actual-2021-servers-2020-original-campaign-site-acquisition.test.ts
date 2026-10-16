import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import seeds from '../../data/evaluation/senate-three-former-serving-2020-original-campaign-domain-targets-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS,
 verifyThreeActually2021Serving2020CandidateOriginalDomains,
 three2021Senators2020OriginalCandidateCDXUrl,
 parseThree2021Senators2020OriginalCDX,
 chooseFourOriginalPagesPer2021ServingSenator2020Candidate,
 acquire2020OriginalCampaignSitesForThree2021ServingSenators,
} from '../../scripts/acquire-three-2021-served-senator-2020-original-campaign-pages.js';
const gov='https://www.lrl.mn.gov/legdb/senate_dir';
function realActuallyServed2021():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:gov,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51',
   sourceBytesLength:1601232,directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[
   ['Susan Kent','53'],['Karla Bigham','54'],['David J. Tomassoni','6'],
  ].map(([name,district])=>({
   officialName:name,officialNameRaw:name,officialSourceUrl:gov,
   senateServiceTerms:[{startsYear:2021,endsYear:2022,district}],
  })),
 };
}
const h=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(time:string,url:string)=>[time,url,'text/html','200','A'.repeat(32),'2456'];
test('2021, not only 2023, ACTUALLY SERVING MN Senators all proved before 2020 archive HTTP',()=>{
 assert.equal(seeds.scope.campaignElectionYear,2020);
 assert.equal(seeds.scope.actuallyServedStateSenateIn2021Required,true);
 assert.equal(seeds.scope.maxTotalOriginalHTMLReplays,12);
 assert.equal(seeds.scope.originalAuthorFirstPostingDateRequired,false);
 assert.equal(seeds.scope.productionDatabaseReadsWritesOrForecastChanges,0);
 const persons=verifyThreeActually2021Serving2020CandidateOriginalDomains(realActuallyServed2021());
 assert.deepEqual(persons.map(p=>p.candidateName),
  ['Susan Kent','Karla Bigham','David Tomassoni']);
 assert.deepEqual(persons.map(p=>p.domain),
  PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS.map(p=>p.domain));
 assert.equal(new Set(persons.map(p=>p.verifiedLRLSenatorName)).size,3);
 const missing=realActuallyServed2021();missing.senators.splice(1,1);
 assert.throws(()=>verifyThreeActually2021Serving2020CandidateOriginalDomains(missing),
  /Not a PERSON that actually served/);
 const wrong=realActuallyServed2021();
 wrong.senators.find(x=>x.officialName==='Susan Kent')!.senateServiceTerms[0].startsYear=2023;
 assert.throws(()=>verifyThreeActually2021Serving2020CandidateOriginalDomains(wrong),
  /Not a PERSON that actually served/);
});
test('genuine 2020 Jan through Nov 2 original Wayback domain CDX, not modern 2026 candidate site',()=>{
 const x=new URL(three2021Senators2020OriginalCandidateCDXUrl('susankentmn.com'));
 assert.equal(x.host,'web.archive.org');
 assert.equal(x.searchParams.get('from'),'20200101');
 assert.equal(x.searchParams.get('to'),'20201102');
 assert.equal(x.searchParams.get('limit'),'300');
 assert.equal(x.searchParams.get('matchType'),'domain');
 assert.throws(()=>three2021Senators2020OriginalCandidateCDXUrl('anothercandidate.org'),
  /Unknown/);
});
test('candidate original 2020 site policy pages rank first; foreign hosts, after-election years and media excluded',()=>{
 const input=[
  h,row('20200701123456','https://karlabigham.com/issues'),
  row('20200602030405','http://www.karlabigham.com/'),
  row('20210101030405','https://karlabigham.com/issues'),
  row('20200701123456','https://karlabigham.com.fake.biz/issues'),
  row('20200701123456','https://karlabigham.com/background.png'),
  row('20200701123456','https://karlabigham.com/?year=2026'),
 ];
 const r=parseThree2021Senators2020OriginalCDX(input,'karlabigham.com');
 assert.equal(r.eligible.length,2);
 assert.equal(r.eligible[0].original,'https://karlabigham.com/issues');
 assert.equal(chooseFourOriginalPagesPer2021ServingSenator2020Candidate(r.eligible).length,2);
 assert.throws(()=>parseThree2021Senators2020OriginalCDX(input,'never-served.com'),
  /Unapproved candidate domain/);
});
test('bounded public source original archive failure is UNKNOWN, not no 2020 candidate issue policy',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'actual2021-senators-original2020-'));
 try{
  const out=join(dir,'proof');
  let requests=0;
  const bad=(async()=>{requests++;throw Error('Wayback unavailable');}) as typeof fetch;
  const wrong=realActuallyServed2021();wrong.senators=[];
  await assert.rejects(()=>acquire2020OriginalCampaignSitesForThree2021ServingSenators(
   out,wrong,bad),/Not a PERSON that actually served/);
  assert.equal(requests,0);
  assert.equal(existsSync(out),false);
  const r=await acquire2020OriginalCampaignSitesForThree2021ServingSenators(
   out,realActuallyServed2021(),bad);
  assert.equal(requests,3);
  assert.equal(r.totals.verifiedActuallyServedSenatorPeople,3);
  assert.equal(r.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1,0);
  assert.equal(r.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(r.candidates.every(p=>
   p.historical200HtmlIndexRowsInBoundedSample===null
   &&p.noOriginal2022PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  const m=JSON.parse(readFileSync(join(out,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(m.bounds.totalOriginalArchivedHtmlReplayMaximum,12);
  assert.equal(m.bounds.noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange,true);
  await assert.rejects(()=>acquire2020OriginalCampaignSitesForThree2021ServingSenators(
   out,realActuallyServed2021(),bad),/already exists/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

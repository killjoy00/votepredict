import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import leads from '../data/evaluation/senate-twelve-served-2022-original-campaign-domain-targets-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {
 FIXED_TWELVE_2022_SENATE_CANDIDATES,
 verifyActualTwelve2022SenatorDomainLeads,
 twelve2022DomainArchiveIndexUrl,
 parseActualSenatorOriginal2022DomainCDX,
 chooseFourDistinct2022OriginalCampaignPageCaptures,
 acquireOriginal2022SitesForTwelveServedSenators,
} from '../scripts/acquire-senate-2022-twelve-served-original-campaign-domains.js';

function mockRealSenateDirectory():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:320000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:FIXED_TWELVE_2022_SENATE_CANDIDATES.map(x=>({
   officialName:x.name,officialNameRaw:x.name,officialSourceUrl:url,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district:x.district}],
  })),
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
function row(stamp:string,url:string,hash='A'.repeat(32)){
 return[stamp,url,'text/html','200',hash,'1234'];
}
test('twelve distinct candidates must have actual official Senate service in 2023, never inferred from domains alone',()=>{
 assert.equal(FIXED_TWELVE_2022_SENATE_CANDIDATES.length,12);
 assert.equal(new Set(FIXED_TWELVE_2022_SENATE_CANDIDATES.map(x=>x.name)).size,12);
 assert.equal(new Set(FIXED_TWELVE_2022_SENATE_CANDIDATES.map(x=>x.domain)).size,12);
 const checked=verifyActualTwelve2022SenatorDomainLeads(mockRealSenateDirectory());
 assert.equal(checked.length,12);
 assert.equal(checked[2].candidateName,'Robert Farnsworth');
 assert.equal(checked[2].campaignSiteDisplayName,'Rob Farnsworth');
 assert.equal(checked[8].candidateName,'Mary Kunesh');
 assert.equal(leads.scope.original2022SosFiledWebsiteFieldCertified,false);
 const broken=mockRealSenateDirectory();
 broken.senators.splice(5,1);
 assert.throws(()=>verifyActualTwelve2022SenatorDomainLeads(broken),
  /NOT independently verified/);
 const wrong=mockRealSenateDirectory();
 wrong.senators.find(x=>x.officialName==='Grant Hauschild')!.senateServiceTerms[0].district='99';
 assert.throws(()=>verifyActualTwelve2022SenatorDomainLeads(wrong),
  /NOT independently verified/);
});
test('historical CDX query is fixed to true 2022 originals for approved domains and bounded sampling',()=>{
 const query=new URL(twelve2022DomainArchiveIndexUrl('markjohnsonmnsenate.com'));
 assert.equal(query.hostname,'web.archive.org');
 assert.equal(query.searchParams.get('from'),'20220101');
 assert.equal(query.searchParams.get('to'),'20221107');
 assert.equal(query.searchParams.get('limit'),'300');
 assert.equal(query.searchParams.get('matchType'),'domain');
 assert.throws(()=>twelve2022DomainArchiveIndexUrl('opponent-never-served.test'),
  /Unknown/);
});
test('CDX rejects future original page versions, cross-domain hosts, unsafe site paths and nonissue binaries',()=>{
 const cdx=[header,
  row('20220510130000','https://www.votemcewen.com/issues-1'),
  row('20220505130000','https://votemcewen.com/'),
  row('20221108130000','https://votemcewen.com/issues-1'),
  row('20240105130000','https://votemcewen.com/issues-1'),
  row('20220605130000','https://votemcewen.com.evil.example/issues'),
  row('20220706130000','https://votemcewen.com/wp-admin/login'),
  row('20220707130000','https://votemcewen.com/image.jpg'),
  row('20220808130000','https://votemcewen.com/issues-1?new=2026'),
 ];
 const result=parseActualSenatorOriginal2022DomainCDX(cdx,'votemcewen.com');
 assert.equal(result.eligible.length,2);
 assert.equal(result.rawRows,cdx.length-1);
 assert.equal(result.indexAtCap,false);
 assert.equal(result.eligible[0].original,'https://www.votemcewen.com/issues-1');
 assert.equal(chooseFourDistinct2022OriginalCampaignPageCaptures(result.eligible).length,2);
 assert.throws(()=>parseActualSenatorOriginal2022DomainCDX(cdx,'evil.example'),/Unapproved/);
 assert.throws(()=>parseActualSenatorOriginal2022DomainCDX([['timestamp'],'bad'],'votemcewen.com'),
  /required field/);
});
test('historical archive sample caps always report possible incompleteness, never full domain coverage',()=>{
 const many=Array.from({length:300},(_,i)=>row(
  '20220705'+String(i%24).padStart(2,'0')+'0101',
  'https://www.lizboldon.com/issues/'+i,
  ('A'.repeat(31)+'B')));
 const found=parseActualSenatorOriginal2022DomainCDX([header,...many],'lizboldon.com');
 assert.equal(found.indexAtCap,true);
 assert.equal(found.eligible.length,300);
 assert.equal(chooseFourDistinct2022OriginalCampaignPageCaptures(found.eligible).length,4);
 assert.deepEqual(parseActualSenatorOriginal2022DomainCDX([],'lizboldon.com'),{
  eligible:[],rawRows:0,indexAtCap:false,validEmpty:true,
 });
});
test('failed real archive service gets dated UNKNOWN index rows, not no positions, with zero production statements',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-twelve-original-'));
 try{
  const output=join(dir,'original-source-folder');
  const offline=(async()=>{throw new Error('archive service unavailable');}) as typeof fetch;
  const result=await acquireOriginal2022SitesForTwelveServedSenators(
   output,mockRealSenateDirectory(),offline);
  assert.equal(result.totals.verifiedActuallyServedSenatorPeople,12);
  assert.equal(result.totals.domainOriginalArchiveIndexQueries,12);
  assert.equal(result.totals.indexHTTP200,0);
  assert.equal(result.totals.originalHTMLPageReplaysAttempted,0);
  assert.equal(result.totals.originalCandidateIssuePassagesActuallyReviewed,0);
  assert.equal(result.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(result.candidates.every(x=>
   x.historical200HtmlIndexRowsInBoundedSample===null
   &&x.originalArchiveIndexValid===false
   &&x.originalArchiveIndexError?.includes('archive service unavailable')
   &&x.noOriginal2022PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  assert.ok(existsSync(join(output,'source-acquisition-manifest.json')));
  const saved=JSON.parse(readFileSync(join(output,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(saved.bounds.noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange,true);
  await assert.rejects(()=>acquireOriginal2022SitesForTwelveServedSenators(
   output,mockRealSenateDirectory(),offline),/already exists/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

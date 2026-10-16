import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import leads from '../../data/evaluation/senate-six-additional-served-2022-campaign-archive-domain-leads-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 FIXED_SIX_MORE_2022_SENATE_CANDIDATES,
 verifyActualSixMore2022SenatorDomainLeads,sixMore2022DomainArchiveIndexUrl,
 parseSixMoreOriginal2022SenatorDomainCDX,
 chooseFourSixMore2022OriginalCampaignPageCaptures,
 acquireOriginal2022SitesForSixMoreServedSenators,
} from '../../scripts/acquire-six-more-actual-senator-2022-campaign-originals.js';

function officialSixActual():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url,observedAt:'2026-10-11T01:04:01.000Z',
   sourceBytesSha256:'f'.repeat(64),sourceBytesLength:300000,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:FIXED_SIX_MORE_2022_SENATE_CANDIDATES.map(p=>({
   officialName:p.name,officialNameRaw:p.name,
   officialSourceUrl:url,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district:p.district}],
  })),
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(timestamp:string,original:string)=>
 [timestamp,original,'text/html','200','A'.repeat(32),'2456'];
test('six unique actual 2023-serving senators verified through official Senate service BEFORE archive HTTP',()=>{
 assert.equal(leads.schema,'mn-2022-six-more-ever-served-senators-original-archive-domain-targets-v1');
 assert.equal(leads.targets.length,6);
 assert.equal(leads.scope.maximumOriginalPageReplaysTotal,24);
 assert.equal(leads.scope.originalSOS2022FiledWebsiteNotCertified,true);
 assert.equal(leads.scope.firstAuthorDateNotRequired,true);
 const a=verifyActualSixMore2022SenatorDomainLeads(officialSixActual());
 assert.deepEqual(a.map(x=>x.candidateName),
  ['John Marty','Lindsey Port','Erin Murphy','Susan Pha','Omar Fateh','John Hoffman']);
 assert.equal(new Set(a.map(x=>x.domain)).size,6);
 const missing=officialSixActual();missing.senators.splice(4,1);
 assert.throws(()=>verifyActualSixMore2022SenatorDomainLeads(missing),
  /Not a documented ACTUALLY serving/);
 const notSameDistrict=officialSixActual();
 notSameDistrict.senators.find(x=>x.officialName==='Lindsey Port')!.senateServiceTerms[0].district='56';
 assert.throws(()=>verifyActualSixMore2022SenatorDomainLeads(notSameDistrict),
  /Not a documented ACTUALLY serving/);
});
test('archive source requests fixed to genuine 2022 pre-election domains and at most 300 real indexed results',()=>{
 const x=new URL(sixMore2022DomainArchiveIndexUrl('murphyfor64.com'));
 assert.equal(x.hostname,'web.archive.org');
 assert.equal(x.searchParams.get('from'),'20220101');
 assert.equal(x.searchParams.get('to'),'20221107');
 assert.equal(x.searchParams.get('limit'),'300');
 assert.equal(x.searchParams.get('matchType'),'domain');
 assert.throws(()=>sixMore2022DomainArchiveIndexUrl('never-served-candidate.example'),/Unknown/);
});
test('safe exact original campaign host, window, HTML path and page ranking isolate real issues',()=>{
 const data=[
  header,
  row('20220708010203','https://murphyfor64.com/vision'),
  row('20220204010203','http://www.murphyfor64.com/'),
  row('20221108010203','https://murphyfor64.com/vision'),
  row('20260102010203','https://murphyfor64.com/vision'),
  row('20220708010203','https://murphyfor64.com.evil.example/vision'),
  row('20220708010203','https://murphyfor64.com/blog?recent=2026'),
  row('20220708010203','https://murphyfor64.com/background.png'),
 ];
 const found=parseSixMoreOriginal2022SenatorDomainCDX(data,'murphyfor64.com');
 assert.equal(found.eligible.length,2);
 assert.equal(found.eligible[0].original,'https://murphyfor64.com/vision');
 assert.equal(chooseFourSixMore2022OriginalCampaignPageCaptures(found.eligible).length,2);
 assert.throws(()=>parseSixMoreOriginal2022SenatorDomainCDX(data,'opponent.example'),
  /Unapproved candidate domain/);
});
test('bounded empty archive and capped index both preserve UNKNOWN campaign site/issue completeness',()=>{
 assert.deepEqual(parseSixMoreOriginal2022SenatorDomainCDX([],'johnmarty.org'),{
  eligible:[],rawRows:0,indexAtCap:false,validEmpty:true});
 const threeHundred=Array.from({length:300},(_,i)=>row(
  '20220805120000','https://www.johnmarty.org/issues/'+i));
 const found=parseSixMoreOriginal2022SenatorDomainCDX(
  [header,...threeHundred],'johnmarty.org');
 assert.equal(found.indexAtCap,true);
 assert.equal(found.eligible.length,300);
 assert.equal(chooseFourSixMore2022OriginalCampaignPageCaptures(found.eligible).length,4);
});
test('failed original public historical archive GETs are dated missing-source observations, never 0 issue positions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'six-more-actual-senators-2022-'));
 try{
  const out=join(dir,'original-webpage-sources');
  const outage=(async()=>{throw new Error('original Wayback service unavailable');}) as typeof fetch;
  const result=await acquireOriginal2022SitesForSixMoreServedSenators(
   out,officialSixActual(),outage);
  assert.equal(result.totals.verifiedActuallyServedSenatorPeople,6);
  assert.equal(result.totals.domainOriginalArchiveIndexQueries,6);
  assert.equal(result.totals.indexSuccessfullyParsed,0);
  assert.equal(result.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1,0);
  assert.equal(result.totals.originalCandidateIssuePassagesActuallyReviewed,0);
  assert.equal(result.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(result.candidates.every(x=>
   x.historical200HtmlIndexRowsInBoundedSample===null
   &&x.noOriginal2022PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  assert.ok(existsSync(join(out,'source-acquisition-manifest.json')));
  const saved=JSON.parse(readFileSync(join(out,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(saved.bounds.totalOriginalArchivedHtmlReplayMaximum,24);
  assert.equal(saved.bounds.noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange,true);
  await assert.rejects(()=>acquireOriginal2022SitesForSixMoreServedSenators(
   out,officialSixActual(),outage),/already exists/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import seeds from '../data/evaluation/senate-six-new-2022-verified-served-person-campaign-original-domain-targets-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 PINNED_SIX_NEW_SENATE_SERVING_2022_CAMPAIGN_DOMAINS,
 verifyAllSixNewActuallyServingSenatorsBeforeOriginalArchiveNetwork,
 sixSenatorsReal2022OriginalCDXIndexUrl,
 parseSixSenators2022OriginalCDXIndex,
 selectFourOriginal2022PagesForOneOfSixNewSenators,
 acquireSixPreviouslyUncoveredSenators2022OriginalCampaignSites,
} from '../scripts/acquire-six-new-2022-served-senators-original-campaign-sites.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const official=[
 ["Paul Utke","Utke, Paul","5"],
 ["Gene Dornink","Dornink, Gene","23"],
 ["Melissa Halvorson Wiklund","Wiklund, Melissa Halvorson","51"],
 ["Jim Abeler","Abeler, Jim","35"],
 ["D. Scott Dibble","Dibble, D. Scott - \"Scott\"","61"],
 ["Bobby Joe Champion","Champion, Bobby Joe","59"],
];
function realSenators():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:official.map(([name,raw,district])=>({
   officialName:name,officialNameRaw:raw,officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district}],
  })),
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(time:string,url:string)=>
 [time,url,'text/html','200','A'.repeat(32),'2400'];
test('all six NEW 2023 serving Senate people, exactly their own original campaign hosts; no losing-never-served persons',()=>{
 assert.equal(seeds.scope.independentlyVerifiedActualServingPeopleRequired,6);
 assert.equal(seeds.scope.maximumAllOriginalHTMLReplays,24);
 assert.equal(seeds.scope.originalArchiveCaptureUtcMayDateExactStatements,true);
 assert.equal(seeds.scope.originalWriterPostingDateRequired,false);
 assert.equal(seeds.scope.currentLive2026CampaignPageCanBeBackdated,false);
 assert.equal(seeds.scope.anyProductionDatabaseAccessEvidenceWritesOrForecastUpdates,0);
 const people=verifyAllSixNewActuallyServingSenatorsBeforeOriginalArchiveNetwork(realSenators());
 assert.equal(people.length,6);
 assert.deepEqual(people.map(p=>p.candidateName),[
  'Paul Utke','Gene Dornink','Melissa Wiklund',
  'Jim Abeler','Scott Dibble','Bobby Joe Champion']);
 assert.equal(new Set(people.map(x=>x.verifiedLRLSenatorName)).size,6);
 assert.equal(new Set(people.map(x=>x.domain)).size,6);
 assert.deepEqual(people.map(p=>p.domain),
  PINNED_SIX_NEW_SENATE_SERVING_2022_CAMPAIGN_DOMAINS.map(p=>p.domain));
 const lacking=realSenators();lacking.senators=lacking.senators.filter(x=>x.officialName!=='Paul Utke');
 assert.throws(()=>verifyAllSixNewActuallyServingSenatorsBeforeOriginalArchiveNetwork(lacking),
  /Not an independently documented actually serving Minnesota senator/);
 const wrongService=realSenators();wrongService.senators.find(x=>x.officialName==='Gene Dornink')!.senateServiceTerms[0].district='35';
 assert.throws(()=>verifyAllSixNewActuallyServingSenatorsBeforeOriginalArchiveNetwork(wrongService),
  /Not an independently documented actually serving Minnesota senator/);
});
test('true 2022 date-specific Wayback source queries, bounded to 300 entries and only six specified people',()=>{
 const u=new URL(sixSenatorsReal2022OriginalCDXIndexUrl('wiklundforsenate.com'));
 assert.equal(u.host,'web.archive.org');
 assert.equal(u.searchParams.get('from'),'20220101');
 assert.equal(u.searchParams.get('to'),'20221107');
 assert.equal(u.searchParams.get('limit'),'300');
 assert.equal(u.searchParams.get('matchType'),'domain');
 assert.throws(()=>sixSenatorsReal2022OriginalCDXIndexUrl('never-served-candidate.com'),/Unknown/);
});
test('archive original HTML excludes redirects, other hosts, after-election time, media and mutable query pages',()=>{
 const data=[
  header,
  row('20220805091012','https://wiklundforsenate.com/issues'),
  row('20220125120000','http://www.wiklundforsenate.com/'),
  row('20221109090101','https://wiklundforsenate.com/issues'),
  row('20260101090101','https://wiklundforsenate.com/issues'),
  row('20220805091012','https://wiklundforsenate.com.evil.example/issues'),
  row('20220805091012','https://wiklundforsenate.com/?after=2026'),
  row('20220805091012','https://wiklundforsenate.com/background.png'),
 ];
 const parsed=parseSixSenators2022OriginalCDXIndex(data,'wiklundforsenate.com');
 assert.equal(parsed.eligible.length,2);
 assert.equal(parsed.eligible[0].original,'https://wiklundforsenate.com/issues');
 assert.equal(selectFourOriginal2022PagesForOneOfSixNewSenators(parsed.eligible).length,2);
 assert.throws(()=>parseSixSenators2022OriginalCDXIndex(data,'nonmember.example'),
  /Unapproved candidate domain/);
});
test('bounded 300-row candidate archive source sample and empty index are UNKNOWN statement completeness',()=>{
 assert.deepEqual(parseSixSenators2022OriginalCDXIndex([],'thechampion4change.com'),
  {eligible:[],rawRows:0,indexAtCap:false,validEmpty:true});
 const many=Array.from({length:300},(_,i)=>row('20220806120304',
  'https://genedorninkforsenate.com/issues/'+i));
 const parsed=parseSixSenators2022OriginalCDXIndex([header,...many],'genedorninkforsenate.com');
 assert.equal(parsed.eligible.length,300);
 assert.equal(parsed.indexAtCap,true);
 assert.equal(selectFourOriginal2022PagesForOneOfSixNewSenators(parsed.eligible).length,4);
});
test('source outage cannot create six phantom absent campaign positions; original public LRL service checked before any network',async()=>{
 const d=mkdtempSync(join(tmpdir(),'six-ever-served-senators-original-'));
 try{
  const folder=join(d,'true-original-receipts');
  let requests=0;
  const fail=(async()=>{requests++;throw new Error('Wayback historic public service temporary outage');}) as typeof fetch;
  const missing=realSenators();missing.senators.splice(3,1);
  await assert.rejects(()=>acquireSixPreviouslyUncoveredSenators2022OriginalCampaignSites(
   folder,missing,fail),/Not an independently documented actually serving Minnesota senator/);
  assert.equal(requests,0);
  assert.equal(existsSync(folder),false);
  const result=await acquireSixPreviouslyUncoveredSenators2022OriginalCampaignSites(
   folder,realSenators(),fail);
  assert.equal(requests,6);
  assert.equal(result.totals.verifiedActuallyServedSenatorPeople,6);
  assert.equal(result.totals.domainOriginalArchiveIndexQueries,6);
  assert.equal(result.totals.indexSuccessfullyParsed,0);
  assert.equal(result.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1,0);
  assert.equal(result.totals.originalCandidateIssuePassagesActuallyReviewed,0);
  assert.equal(result.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(result.candidates.every(p=>
   p.historical200HtmlIndexRowsInBoundedSample===null
   &&p.noOriginal2022PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  const file=JSON.parse(readFileSync(join(folder,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(file.bounds.totalOriginalArchivedHtmlReplayMaximum,24);
  assert.equal(file.bounds.noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange,true);
  await assert.rejects(()=>acquireSixPreviouslyUncoveredSenators2022OriginalCampaignSites(
   folder,realSenators(),fail),/already exists/);
 }finally{rmSync(d,{recursive:true,force:true});}
});

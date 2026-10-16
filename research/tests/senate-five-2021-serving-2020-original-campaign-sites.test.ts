import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import seeds from '../../data/evaluation/senate-five-2021-senators-2020-historic-campaign-domain-leads-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 PINNED_FIVE_2021_SENATOR_2020_CAMPAIGN_DOMAINS,
 verifyFive2021ServingSenatorsBeforeOriginal2020ArchiveNetwork,
 fiveSenatorsReal2020OriginalCDXIndexUrl,
 parseFiveSenators2020OriginalCDXIndex,
 selectFourOriginal2020PagesForOneOfFiveSenators,
 acquireFive2020OriginalCampaignSitesFor2021Senators,
} from '../../scripts/acquire-five-2020-original-campaign-sites-for-2021-senators.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const official=[
 ["Carrie L. Ruud","Ruud, Carrie L.","10"],
 ["Justin D. Eichorn","Eichorn, Justin D.","5"],
 ["Roger C. Chamberlain","Chamberlain, Roger C.","38"],
 ["Rich Draheim","Draheim, Rich","20"],
 ["David H. Senjem","Senjem, David H. - \"Dave\"","25"],
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
   senateServiceTerms:[{startsYear:2021,endsYear:2022,district}],
  })),
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(time:string,url:string)=>
 [time,url,'text/html','200','A'.repeat(32),'2400'];
test('all five NEW 2021 serving Senate people, exactly their own original campaign hosts; no losing-never-served persons',()=>{
 assert.equal(seeds.scope.independentlyVerifiedActualServingPeopleRequired,5);
 assert.equal(seeds.scope.maximumAllOriginalHTMLReplays,20);
 assert.equal(seeds.scope.originalArchiveCaptureUtcMayDateExactStatements,true);
 assert.equal(seeds.scope.originalWriterPostingDateRequired,false);
 assert.equal(seeds.scope.currentLive2026CampaignPageCanBeBackdated,false);
 assert.equal(seeds.scope.anyProductionDatabaseAccessEvidenceWritesOrForecastUpdates,0);
 const people=verifyFive2021ServingSenatorsBeforeOriginal2020ArchiveNetwork(realSenators());
 assert.equal(people.length,5);
 assert.deepEqual(people.map(p=>p.candidateName),["Carrie Ruud","Justin Eichorn","Roger Chamberlain","Rich Draheim","David Senjem"]);
 assert.equal(new Set(people.map(x=>x.verifiedLRLSenatorName)).size,5);
 assert.equal(new Set(people.map(x=>x.domain)).size,5);
 assert.deepEqual(people.map(p=>p.domain),
  PINNED_FIVE_2021_SENATOR_2020_CAMPAIGN_DOMAINS.map(p=>p.domain));
 const lacking=realSenators();lacking.senators=lacking.senators.filter(x=>x.officialName!=='Carrie L. Ruud');
 assert.throws(()=>verifyFive2021ServingSenatorsBeforeOriginal2020ArchiveNetwork(lacking),
  /Not an independently documented actually serving Minnesota senator/);
 const wrongService=realSenators();wrongService.senators.find(x=>x.officialName==='Justin D. Eichorn')!.senateServiceTerms[0].district='35';
 assert.throws(()=>verifyFive2021ServingSenatorsBeforeOriginal2020ArchiveNetwork(wrongService),
  /Not an independently documented actually serving Minnesota senator/);
});
test('true 2020 date-specific Wayback source queries, bounded to 300 entries and only five specified people',()=>{
 const u=new URL(fiveSenatorsReal2020OriginalCDXIndexUrl('justinformnsenate.com'));
 assert.equal(u.host,'web.archive.org');
 assert.equal(u.searchParams.get('from'),'20200101');
 assert.equal(u.searchParams.get('to'),'20201102');
 assert.equal(u.searchParams.get('limit'),'300');
 assert.equal(u.searchParams.get('matchType'),'domain');
 assert.throws(()=>fiveSenatorsReal2020OriginalCDXIndexUrl('never-served-candidate.com'),/Unknown/);
});
test('archive original HTML excludes redirects, other hosts, after-election time, media and mutable query pages',()=>{
 const data=[
  header,
  row('20200805091012','https://justinformnsenate.com/issues'),
  row('20200125120000','http://www.justinformnsenate.com/'),
  row('20201109090101','https://justinformnsenate.com/issues'),
  row('20260101090101','https://justinformnsenate.com/issues'),
  row('20200805091012','https://justinformnsenate.com.evil.example/issues'),
  row('20200805091012','https://justinformnsenate.com/?after=2026'),
  row('20200805091012','https://justinformnsenate.com/background.png'),
 ];
 const parsed=parseFiveSenators2020OriginalCDXIndex(data,'justinformnsenate.com');
 assert.equal(parsed.eligible.length,2);
 assert.equal(parsed.eligible[0].original,'https://justinformnsenate.com/issues');
 assert.equal(selectFourOriginal2020PagesForOneOfFiveSenators(parsed.eligible).length,2);
 assert.throws(()=>parseFiveSenators2020OriginalCDXIndex(data,'nonmember.example'),
  /Unapproved candidate domain/);
});
test('bounded 300-row candidate archive source sample and empty index are UNKNOWN statement completeness',()=>{
 assert.deepEqual(parseFiveSenators2020OriginalCDXIndex([],'rogerchamberlain.org'),
  {eligible:[],rawRows:0,indexAtCap:false,validEmpty:true});
 const many=Array.from({length:300},(_,i)=>row('20200806120304',
  'https://senjemforsenate.com/issues/'+i));
 const parsed=parseFiveSenators2020OriginalCDXIndex([header,...many],'senjemforsenate.com');
 assert.equal(parsed.eligible.length,300);
 assert.equal(parsed.indexAtCap,true);
 assert.equal(selectFourOriginal2020PagesForOneOfFiveSenators(parsed.eligible).length,4);
});
test('source outage cannot create five phantom absent campaign positions; original public LRL service checked before any network',async()=>{
 const d=mkdtempSync(join(tmpdir(),'five-ever-served-senators-original-'));
 try{
  const folder=join(d,'true-original-receipts');
  let requests=0;
  const fail=(async()=>{requests++;throw new Error('Wayback historic public service temporary outage');}) as typeof fetch;
  const missing=realSenators();missing.senators.splice(3,1);
  await assert.rejects(()=>acquireFive2020OriginalCampaignSitesFor2021Senators(
   folder,missing,fail),/Not an independently documented actually serving Minnesota senator/);
  assert.equal(requests,0);
  assert.equal(existsSync(folder),false);
  const result=await acquireFive2020OriginalCampaignSitesFor2021Senators(
   folder,realSenators(),fail);
  assert.equal(requests,5);
  assert.equal(result.totals.verifiedActuallyServedSenatorPeople,5);
  assert.equal(result.totals.domainOriginalArchiveIndexQueries,5);
  assert.equal(result.totals.indexSuccessfullyParsed,0);
  assert.equal(result.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1,0);
  assert.equal(result.totals.originalCandidateIssuePassagesActuallyReviewed,0);
  assert.equal(result.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(result.candidates.every(p=>
   p.historical200HtmlIndexRowsInBoundedSample===null
   &&p.noOriginal2020PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  const file=JSON.parse(readFileSync(join(folder,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(file.bounds.totalOriginalArchivedHtmlReplayMaximum,20);
  assert.equal(file.bounds.noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange,true);
  await assert.rejects(()=>acquireFive2020OriginalCampaignSitesFor2021Senators(
   folder,realSenators(),fail),/already exists/);
 }finally{rmSync(d,{recursive:true,force:true});}
});

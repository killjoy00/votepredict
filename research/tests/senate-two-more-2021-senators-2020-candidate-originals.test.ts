import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import seeds from '../../data/evaluation/senate-two-more-2021-senators-2020-first-party-original-domain-leads-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 PINNED_TWO_FURTHER_2021_SENATORS_2020_DOMAINS,
 verifyTwoFurther2021ServingSenatorsBeforeOriginal2020ArchiveNetwork,
 twoFurtherSenators2020OriginalCDXIndexUrl,
 parseTwoFurtherSenators2020OriginalCDXIndex,
 selectFourOriginal2020PagesForOneOfTwoSenators,
 acquireTwoFurther2021ServingSenators2020Originals,
} from '../scripts/acquire-two-more-2021-senators-2020-candidate-html.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const official=[
 ["Kent Eken","Eken, Kent","4"],
 ["Bill G. Ingebrigtsen","Ingebrigtsen, Bill G.","8"],
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
test('both NEW 2021 serving Senate people, exactly their own original campaign hosts; no losing-never-served persons',()=>{
 assert.equal(seeds.scope.independentlyVerifiedActualServingPeopleRequired,2);
 assert.equal(seeds.scope.maximumAllOriginalHTMLReplays,8);
 assert.equal(seeds.scope.originalArchiveCaptureUtcMayDateExactStatements,true);
 assert.equal(seeds.scope.originalWriterPostingDateRequired,false);
 assert.equal(seeds.scope.currentLive2026CampaignPageCanBeBackdated,false);
 assert.equal(seeds.scope.anyProductionDatabaseAccessEvidenceWritesOrForecastUpdates,0);
 const people=verifyTwoFurther2021ServingSenatorsBeforeOriginal2020ArchiveNetwork(realSenators());
 assert.equal(people.length,2);
 assert.deepEqual(people.map(p=>p.candidateName),["Kent Eken","Bill Ingebrigtsen"]);
 assert.equal(new Set(people.map(x=>x.verifiedLRLSenatorName)).size,2);
 assert.equal(new Set(people.map(x=>x.domain)).size,2);
 assert.deepEqual(people.map(p=>p.domain),
  PINNED_TWO_FURTHER_2021_SENATORS_2020_DOMAINS.map(p=>p.domain));
 const lacking=realSenators();lacking.senators=lacking.senators.filter(x=>x.officialName!=='Kent Eken');
 assert.throws(()=>verifyTwoFurther2021ServingSenatorsBeforeOriginal2020ArchiveNetwork(lacking),
  /Not an independently documented actually serving Minnesota senator/);
 const wrongService=realSenators();wrongService.senators.find(x=>x.officialName==='Bill G. Ingebrigtsen')!.senateServiceTerms[0].district='35';
 assert.throws(()=>verifyTwoFurther2021ServingSenatorsBeforeOriginal2020ArchiveNetwork(wrongService),
  /Not an independently documented actually serving Minnesota senator/);
});
test('true 2020 date-specific Wayback source queries, bounded to 300 entries and only two specified people',()=>{
 const u=new URL(twoFurtherSenators2020OriginalCDXIndexUrl('votekenteken.com'));
 assert.equal(u.host,'web.archive.org');
 assert.equal(u.searchParams.get('from'),'20200101');
 assert.equal(u.searchParams.get('to'),'20201102');
 assert.equal(u.searchParams.get('limit'),'300');
 assert.equal(u.searchParams.get('matchType'),'domain');
 assert.throws(()=>twoFurtherSenators2020OriginalCDXIndexUrl('never-served-candidate.com'),/Unknown/);
});
test('archive original HTML excludes redirects, other hosts, after-election time, media and mutable query pages',()=>{
 const data=[
  header,
  row('20200805091012','https://votekenteken.com/issues'),
  row('20200125120000','http://www.votekenteken.com/'),
  row('20201109090101','https://votekenteken.com/issues'),
  row('20260101090101','https://votekenteken.com/issues'),
  row('20200805091012','https://votekenteken.com.evil.example/issues'),
  row('20200805091012','https://votekenteken.com/?after=2026'),
  row('20200805091012','https://votekenteken.com/background.png'),
 ];
 const parsed=parseTwoFurtherSenators2020OriginalCDXIndex(data,'votekenteken.com');
 assert.equal(parsed.eligible.length,2);
 assert.equal(parsed.eligible[0].original,'https://votekenteken.com/issues');
 assert.equal(selectFourOriginal2020PagesForOneOfTwoSenators(parsed.eligible).length,2);
 assert.throws(()=>parseTwoFurtherSenators2020OriginalCDXIndex(data,'nonmember.example'),
  /Unapproved candidate domain/);
});
test('bounded 300-row candidate archive source sample and empty index are UNKNOWN statement completeness',()=>{
 assert.deepEqual(parseTwoFurtherSenators2020OriginalCDXIndex([],'billforsenate.org'),
  {eligible:[],rawRows:0,indexAtCap:false,validEmpty:true});
 const many=Array.from({length:300},(_,i)=>row('20200806120304',
  'https://billforsenate.org/issues/'+i));
 const parsed=parseTwoFurtherSenators2020OriginalCDXIndex([header,...many],'billforsenate.org');
 assert.equal(parsed.eligible.length,300);
 assert.equal(parsed.indexAtCap,true);
 assert.equal(selectFourOriginal2020PagesForOneOfTwoSenators(parsed.eligible).length,4);
});
test('source outage cannot create two phantom absent campaign positions; original public LRL service checked before any network',async()=>{
 const d=mkdtempSync(join(tmpdir(),'two-ever-served-senators-original-'));
 try{
  const folder=join(d,'true-original-receipts');
  let requests=0;
  const fail=(async()=>{requests++;throw new Error('Wayback historic public service temporary outage');}) as typeof fetch;
  const missing=realSenators();missing.senators.splice(1,1);
  await assert.rejects(()=>acquireTwoFurther2021ServingSenators2020Originals(
   folder,missing,fail),/Not an independently documented actually serving Minnesota senator/);
  assert.equal(requests,0);
  assert.equal(existsSync(folder),false);
  const result=await acquireTwoFurther2021ServingSenators2020Originals(
   folder,realSenators(),fail);
  assert.equal(requests,2);
  assert.equal(result.totals.verifiedActuallyServedSenatorPeople,2);
  assert.equal(result.totals.domainOriginalArchiveIndexQueries,2);
  assert.equal(result.totals.indexSuccessfullyParsed,0);
  assert.equal(result.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1,0);
  assert.equal(result.totals.originalCandidateIssuePassagesActuallyReviewed,0);
  assert.equal(result.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(result.candidates.every(p=>
   p.historical200HtmlIndexRowsInBoundedSample===null
   &&p.noOriginal2020PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  const file=JSON.parse(readFileSync(join(folder,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(file.bounds.totalOriginalArchivedHtmlReplayMaximum,8);
  assert.equal(file.bounds.noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange,true);
  await assert.rejects(()=>acquireTwoFurther2021ServingSenators2020Originals(
   folder,realSenators(),fail),/already exists/);
 }finally{rmSync(d,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import targets from '../data/evaluation/senate-nick-frentz-2022-contemporaneous-podcast-domain-original-archive-target-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 FIXED_FRENTZ_2022_SENATE_CANDIDATE,
 verifyNickFrentzActualSenatorContemporary2022Domain,
 nickFrentz2022HistoricalOriginalArchiveIndexUrl,
 parseNickFrentz2022OriginalArchiveCdx,
 chooseFourNickFrentzOriginal2022CampaignPageReplays,
 acquireNickFrentzSep2022PodcastLinkedOriginalCampaignSite,
} from '../scripts/acquire-nick-frentz-2022-podcast-linked-original-campaign-domain.js';
const govt='https://www.lrl.mn.gov/legdb/senate_dir';
function actualSenator():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:govt,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51',
   sourceBytesLength:300000,originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[{
   officialName:'Nick A. Frentz',officialNameRaw:'Frentz, Nick A.',
   officialSourceUrl:govt,
   senateServiceTerms:[
    {startsYear:2017,endsYear:2022,district:'19'},
    {startsYear:2023,endsYear:null,district:'18'},
   ],
  }],
 };
}
const header=['timestamp','original','mimetype','statuscode','digest','length'];
const row=(timestamp:string,original:string)=>
 [timestamp,original,'text/html','200','A'.repeat(32),'2760'];
test('independent September 29 2022 podcast directly recorded Frentz candidate campaign domain, unlike current 2026 source',()=>{
 assert.equal(targets.schema,'mn-nick-frentz-2022-dated-podcast-linked-original-campaign-domain-v1');
 assert.equal(FIXED_FRENTZ_2022_SENATE_CANDIDATE.length,1);
 const p=targets.targets[0];
 assert.equal(p.candidateName,'Nick Frentz');
 assert.equal(p.domain,'frentzforsenate.com');
 assert.equal(p.contemporaneousPublisherReference.publishedOn,'2022-09-29');
 assert.equal(p.previousUnsuccessful2022WrongDomainSearch.domain,'frentzformnsenate.com');
 assert.equal(p.previousUnsuccessful2022WrongDomainSearch.originalCdxIndexRows,0);
 assert.equal(targets.scope.maximumOriginalPageReplaysTotal,4);
 assert.equal(targets.scope.archiveCaptureDateMayBeUsedAsResearchPublicBy,true);
 const confirmed=verifyNickFrentzActualSenatorContemporary2022Domain(actualSenator());
 assert.equal(confirmed.length,1);
 assert.equal(confirmed[0].verifiedLRLSenatorName,'Nick A. Frentz');
 const notSenator=actualSenator();notSenator.senators=[];
 assert.throws(()=>verifyNickFrentzActualSenatorContemporary2022Domain(notSenator),
  /Not a documented ACTUALLY serving/);
});
test('true original 2022 Frentz candidate domain-only bounded search; never current site',()=>{
 const p=new URL(nickFrentz2022HistoricalOriginalArchiveIndexUrl('frentzforsenate.com'));
 assert.equal(p.host,'web.archive.org');
 assert.equal(p.searchParams.get('from'),'20220101');
 assert.equal(p.searchParams.get('to'),'20221107');
 assert.equal(p.searchParams.get('limit'),'300');
 assert.equal(p.searchParams.get('matchType'),'domain');
 assert.throws(()=>nickFrentz2022HistoricalOriginalArchiveIndexUrl('frentzformnsenate.com'),
  /Unknown/);
});
test('CDX archive excludes foreign hosts, later edits, media, query URLs and preserves issue pages first',()=>{
 const source=[header,
  row('20220805080808','https://frentzforsenate.com/issues'),
  row('20220101010000','http://www.frentzforsenate.com/'),
  row('20221109080808','https://frentzforsenate.com/issues'),
  row('20260102080808','https://frentzforsenate.com/issues'),
  row('20220805080808','https://frentzforsenate.com.evil.example/issues'),
  row('20220805080808','https://frentzforsenate.com/?campaign=2026'),
  row('20220805080808','https://frentzforsenate.com/banner.jpg'),
 ];
 const parsed=parseNickFrentz2022OriginalArchiveCdx(source,'frentzforsenate.com');
 assert.equal(parsed.eligible.length,2);
 assert.equal(parsed.eligible[0].original,'https://frentzforsenate.com/issues');
 assert.equal(chooseFourNickFrentzOriginal2022CampaignPageReplays(parsed.eligible).length,2);
 assert.throws(()=>parseNickFrentz2022OriginalArchiveCdx(source,'othercandidate.com'),
  /Unapproved candidate domain/);
});
test('capped historical index does not prove all issue positions were discovered',()=>{
 const rows=Array.from({length:300},(_,i)=>row(
  '20220805080808','https://frentzforsenate.com/issues/'+i));
 const p=parseNickFrentz2022OriginalArchiveCdx([header,...rows],'frentzforsenate.com');
 assert.equal(p.eligible.length,300);
 assert.equal(p.indexAtCap,true);
 assert.equal(chooseFourNickFrentzOriginal2022CampaignPageReplays(p.eligible).length,4);
 assert.deepEqual(parseNickFrentz2022OriginalArchiveCdx([],'frentzforsenate.com'),{
  eligible:[],rawRows:0,indexAtCap:false,validEmpty:true});
});
test('archival outage is UNKNOWN actual original HTML, no invented absent issue stance',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'senator-frentz-original2022-'));
 try{
  const out=join(dir,'candidate-original-public-proof');
  const outage=(async()=>{throw new Error('historic Wayback CDX unavailable');}) as typeof fetch;
  const m=await acquireNickFrentzSep2022PodcastLinkedOriginalCampaignSite(
   out,actualSenator(),outage);
  assert.equal(m.totals.verifiedActuallyServedSenatorPeople,1);
  assert.equal(m.totals.domainOriginalArchiveIndexQueries,1);
  assert.equal(m.totals.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1,0);
  assert.equal(m.totals.productionDatabaseReadsOrWrites,0);
  assert.ok(m.candidates.every(x=>
   x.historical200HtmlIndexRowsInBoundedSample===null
   &&x.noOriginal2022PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest===true));
  assert.ok(existsSync(join(out,'source-acquisition-manifest.json')));
  const stored=JSON.parse(readFileSync(join(out,'source-acquisition-manifest.json'),'utf8'));
  assert.equal(stored.bounds.totalOriginalArchivedHtmlReplayMaximum,4);
  await assert.rejects(()=>acquireNickFrentzSep2022PodcastLinkedOriginalCampaignSite(
   out,actualSenator(),outage),/already exists/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

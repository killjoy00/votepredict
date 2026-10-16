import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-kent-eken-2020-original-13-capture-dated-platform-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 KENT_EKEN_ORIGINAL_2020_CAPTURED_13_POLICY_QUOTES_VERSION,
 independentlyAuditKentEken13True2020ArchivedCampaignPolicyStatements,
} from '../evidence/senate-kent-eken-2020-13-historical-campaign-excerpt-proof.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function mockActualSenators():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:ledger.actualSenatePeople.map(p=>({
   officialName:p.senator,officialNameRaw:p.senator,officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2013,endsYear:2022,district:p.district}],
  })),
 };
}
test('Kent Eken and Bill Ingebrigtsen are actual served 2021 senators; only Kent has 13 excerpted issue statements',()=>{
 assert.match(KENT_EKEN_ORIGINAL_2020_CAPTURED_13_POLICY_QUOTES_VERSION,/13/);
 assert.deepEqual(ledger.actualSenatePeople.map(x=>[x.senator,x.district,x.exactCandidateSitePolicyExcerpts]),[
  ['Kent Eken','4',13],['Bill Ingebrigtsen','8',0],
 ]);
 assert.equal(ledger.scope.originalFirstPartyHTMLSourcesRehashed,5);
 assert.equal(ledger.scope.independentFull2020CDXIndexSourceFilesReopened,2);
 assert.equal(ledger.scope.shortExactPolicyExcerpts,13);
 assert.equal(ledger.scope.productionEvidenceDatabaseForecastModelSchedulerChanges,0);
 assert.equal(ledger.source.candidateOriginalArchiveRun,38157868392);
 assert.equal(ledger.source.firstPartyOriginalArchiveArtifact,11709436801);
 assert.equal(new Set(ledger.fullOriginalPageReceipts.map(x=>x.originalFile)).size,5);
 assert.equal(new Set(ledger.exactCandidateOriginalPlatformShortExcerpts.map(x=>x.id)).size,13);
});
test('each exact short 2020 archive-captured candidate quote has a pinned original URL/UTC/SHA+independent CDX SHA1 and issue family',()=>{
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 const urls=new Map(ledger.fullOriginalPageReceipts.map(x=>[x.originalFile,x]));
 for(const p of urls.values()){
  assert.ok(p.capturedUtc>='2020-01-01T00:00:00.000Z');
  assert.ok(p.capturedUtc<'2020-11-03T00:00:00.000Z');
  assert.match(p.originalFile,/^two20b-0[12]-archive-\d{14}-[0-3]\.html$/);
  assert.match(p.htmlSha256,/^[a-f0-9]{64}$/);
  assert.match(p.cdxSha1,/^[A-Z2-7]{32}$/);
  assert.equal(new URL(p.originalUrl).hostname.replace(/^www\./,''),p.domain);
 }
 assert.equal(urls.get(ledger.policyPage.originalFile)?.senator,'Kent Eken');
 for(const q of ledger.exactCandidateOriginalPlatformShortExcerpts){
  assert.equal(q.pageId,'ekenPlatform2020');
  assert.ok(families.has(q.issueFamily));
  assert.ok(q.exactExcerpt.length>=8&&q.exactExcerpt.length<=130);
  assert.ok(q.conservativeMeaning.length>=8);
  assert.equal(q.attributableByHistoricalOriginalArchiveUtc,true);
  assert.equal(q.candidateSiteSelfReportedPriorVoteNotOfficiallyProven,true);
  assert.equal(q.automaticallyAdmittedToProductionOrForecast,false);
 }
});
test('2016 originally-authored campaign wording captured in 2020 cannot be called new 2020 Senate-platform writing',()=>{
 assert.equal(ledger.scope.older2016CycleContentCapturedDuring2020ExplicitlyPreserved,true);
 assert.equal(ledger.scope.originalArchive2020UTCIsPublicByNotAuthorPosted,true);
 assert.equal(ledger.policyPage.candidateOwnedIssuesWithOlder2016ElectionCopy,true);
 assert.equal(ledger.policyPage.exactSourceCaptureIsNotFirstAuthoredDate,true);
 assert.equal(ledger.scope.claimOfPriorVoteIsNotIndependentlyProvenRollCall,true);
 assert.ok(ledger.exactCandidateOriginalPlatformShortExcerpts.some(x=>x.exactExcerpt.includes('voted against')&&x.kind.includes('not_verified_roll_call')));
});
test('tampered genuine original government service prevents any campaign issue quote proof even when page pins otherwise exist',()=>{
 const government=mockActualSenators();
 assert.throws(()=>independentlyAuditKentEken13True2020ArchivedCampaignPolicyStatements(
  {...government,source:{...government.source,sourceBytesSha256:'0'.repeat(64)}},{},{},{}),
  /Original independent actual Minnesota Senate SERVICE government directory missing/);
 assert.throws(()=>independentlyAuditKentEken13True2020ArchivedCampaignPolicyStatements(
  government,{},{},{}),
  /Full authenticated original 2020 two-senator Wayback source acquisition manifest/);
});
test('offline-only original source audit denies reports when entire LRL directory or original HTML is absent',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mn-eken-2020-original-site-13-'));
 try{
  const out=join(dir,'no-phantom-proof.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-kent-eken-2020-original-platform-13-policy-excerpts-offline.ts',
   '--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

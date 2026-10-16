import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {independentlyAuditBillIngebrigtsen27OriginalHistoricalPolicyExcerpts}
 from '../../src/evidence/senate-bill-ingebrigtsen-historic-27-original-site-excerpts-proof.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
function gov():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:'https://www.lrl.mn.gov/legdb/senate_dir',
   sourceBytesSha256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51',
   observedAt:'2026-10-10T23:26:10.121Z',sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[{
   officialName:'Bill G. Ingebrigtsen',officialNameRaw:'Ingebrigtsen, Bill G.',
   officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
   senateServiceTerms:[{startsYear:2013,endsYear:2022,district:'8'}],
  }],
 };
}
test('one ACTUALLY serving 2021 Minnesota senator, 27 short originals from two clearly old campaign cycles',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.actualSenator.name,'Bill Ingebrigtsen');
 assert.equal(ledger.actualSenator.officialName,'Bill G. Ingebrigtsen');
 assert.equal(ledger.scope.verifiedActualSenateServiceIn2021,true);
 assert.equal(ledger.scope.distinctActualServingSenatorsAdded,1);
 assert.equal(ledger.scope.originalHTMLBodies,6);
 assert.equal(ledger.scope.wholeIndependentCDXIndexFiles,4);
 assert.equal(ledger.scope.selectedHistoricalPolicyPageSections,2);
 assert.equal(ledger.scope.exactCandidateOwnedPolicyExcerpts,27);
 assert.equal(ledger.scope.productionDatabaseEvidenceModelForecastSchedulerChanges,0);
 assert.deepEqual(ledger.sourceSections.map(s=>s.id),['older2010','updated2012']);
 assert.equal(ledger.exactShortCandidateIssueExcerpts.filter(x=>x.part==='older2010').length,14);
 assert.equal(ledger.exactShortCandidateIssueExcerpts.filter(x=>x.part==='updated2012').length,13);
 assert.equal(new Set(ledger.exactShortCandidateIssueExcerpts.map(x=>x.id)).size,27);
 assert.equal(new Set(ledger.originalFullHTMLReceipts.map(x=>x.file)).size,6);
});
test('each archived original historical issue source has literal original URL/real timestamp/sha256/CDX-SHA1',()=>{
 const receipt=new Map(ledger.originalFullHTMLReceipts.map(x=>[x.file,x]));
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const r of receipt.values()){
  assert.match(r.file,/^billissue-original-20\d{12}-[0-5]\.html$/);
  assert.match(r.sha256,/^[a-f0-9]{64}$/);
  assert.match(r.sha1,/^[A-Z2-7]{32}$/);
  assert.equal(new URL(r.url).hostname,'billforsenate.org');
  assert.equal(new URL(r.url).pathname,'/issues.php');
  assert.ok(r.captureUtc>='2010-01-01T00:00:00.000Z');
  assert.ok(r.captureUtc<'2020-11-03T00:00:00.000Z');
 }
 assert.equal(new Set(ledger.originalFullHTMLReceipts.map(x=>x.sha256)).size,2);
 for(const q of ledger.exactShortCandidateIssueExcerpts){
  assert.ok(['older2010','updated2012'].includes(q.part));
  assert.ok(families.has(q.issue));
  assert.ok(q.quote.length>=8&&q.quote.length<=130);
  assert.ok(q.meaning.length>=8);
  assert.ok(['candidate_owned_historical_policy','candidate_claim_of_prior_legislative_work_not_roll_call'].includes(q.kind));
  assert.equal(q.genuineOriginalArchiveUTCAttributionRequired,true);
  assert.equal(q.firstAuthorPostingDateEstablished,false);
  assert.equal(q.legislativeSelfReportIsNotRecordedSenateVote,true);
  assert.equal(q.automaticForecastOrProductionEvidenceAdmission,false);
 }
});
test('2010 originals show 2006-era SD11, 2012 revised platform has 2012 budget SD8, and no verified 2020 issue body',()=>{
 assert.equal(ledger.scope.legacy2006WordsObserved2010,true);
 assert.equal(ledger.scope.budget2012CopyStillByteIdenticalIn2016,true);
 assert.equal(ledger.scope.noOriginal2020IssuesBodyVerified,true);
 assert.equal(ledger.scope.historicArchiveUTCIsPublicByNotFirstAuthorDate,true);
 assert.equal(ledger.scope.campaignSelfReportedPastVotesNotOfficialRollcalls,true);
 assert.ok(ledger.exactShortCandidateIssueExcerpts.some(q=>q.quote.includes('votes in the Senate')&&q.kind.includes('not_roll_call')));
 assert.equal(ledger.sources.originalIssuesRecoveryRun,38160285047);
 assert.equal(ledger.sources.originalIssuesArtifact,11710110948);
 assert.equal(ledger.sources.original2020HomeArtifact,11709436801);
});
test('tampered official original LRL source, missing original 2020 homepage or actual historic CDX deny proof',()=>{
 const source=gov();
 assert.throws(()=>independentlyAuditBillIngebrigtsen27OriginalHistoricalPolicyExcerpts(
  {...source,source:{...source.source,sourceBytesSha256:'0'.repeat(64)}},{},
  new Uint8Array(1000),{},{}),
 /Whole independent official actual Senate-service government source not authenticated/);
 assert.throws(()=>independentlyAuditBillIngebrigtsen27OriginalHistoricalPolicyExcerpts(
  source,{},new Uint8Array(1200),{},{}),/Genuine August 2020 candidate homepage/);
});
test('source-only runner refuses missing entire historic issue HTML/CDX/actual government sources without fabricating report',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'mn-bill-historical-27-source-'));
 try{
  const dest=join(tmp,'not-proven.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-bill-ingebrigtsen-original-historical-27-policy-excerpts-offline.ts',
   '--output',dest,
  ],{stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(dest),false);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});

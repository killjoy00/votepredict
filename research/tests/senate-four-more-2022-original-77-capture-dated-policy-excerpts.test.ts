import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-four-more-2022-original-campaign-policy-excerpts-capture-dated-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 FOUR_MORE_SENATORS_ARCHIVE_DATED_77_POLICY_VERSION,
 auditFourMoreSenateOriginal2022CampaignCaptureDatedPolicyExcerpts,
} from '../../src/evidence/senate-four-more-2022-original-capture-dated-77-excerpts.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';

const S='https://www.lrl.mn.gov/legdb/senate_dir';
function originalOfficialService():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:S,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51',
   sourceBytesLength:327100,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
  },
  senators:[
   ['John Marty','40'],['Lindsey Port','55'],['Erin Murphy','64'],['Omar Fateh','62'],
  ].map(([name,district])=>({
   officialName:name,officialNameRaw:name,officialSourceUrl:S,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district}],
  })),
 };
}
test('new four actually served senators, 16 immutable historical originals, seven policy pages and 77 exact quotations',()=>{
 assert.match(FOUR_MORE_SENATORS_ARCHIVE_DATED_77_POLICY_VERSION,/77/);
 assert.equal(ledger.scope.issueNumber,864);
 assert.equal(ledger.scope.actuallyServedSenatePeopleWithOriginalPages,4);
 assert.equal(ledger.scope.verifiedOriginalHistoricPageCopies,16);
 assert.equal(ledger.scope.selectedHistoricalOriginalIssuePages,7);
 assert.equal(ledger.scope.exactOriginalCandidateSitePolicyExcerpts,77);
 assert.equal(ledger.scope.sourceArchiveCaptureDatesServeAsAttributableDates,true);
 assert.equal(ledger.scope.firstAuthorPostingDateNotRequired,true);
 assert.equal(ledger.scope.automaticForecastAdmissions,0);
 assert.equal(ledger.scope.productionEvidenceWritesOrRead,0);
 assert.equal(new Set(ledger.year2022OriginalPages.map(p=>p.originalFile)).size,16);
 assert.equal(new Set(ledger.year2022OriginalPages.map(p=>p.senator)).size,4);
 assert.equal(new Set(ledger.selectedCandidateIssuesPages.map(p=>p.id)).size,7);
 assert.equal(new Set(ledger.exactCandidateCampaignPolicyExcerpts.map(q=>q.id)).size,77);
});
test('every original policy excerpt gets a real verified source archive UTC, not inferred author-posted or election date',()=>{
 const pageByName=new Map(ledger.year2022OriginalPages.map(p=>[p.originalFile,p]));
 const selectedById=new Map(ledger.selectedCandidateIssuesPages.map(p=>[p.id,p]));
 const categories=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const p of ledger.year2022OriginalPages){
  assert.ok(p.captureUtc.startsWith('2022-'));
  assert.ok(p.captureUtc<'2022-11-08T00:00:00.000Z');
  assert.match(p.sha256,/^[0-9a-f]{64}$/);
  assert.match(p.independentCdxSha1Base32,/^[A-Z2-7]{32}$/);
  assert.equal(p.sourceResponseAttributedPublicByUtc,p.captureUtc);
  assert.equal(p.firstAuthorPostedDateRequired,false);
 }
 for(const s of ledger.exactCandidateCampaignPolicyExcerpts){
  const selected=selectedById.get(s.sourcePageId);
  assert.ok(selected);
  const p=pageByName.get(selected.sourceFile);
  assert.ok(p);
  assert.equal(s.senator,p.senator);
  assert.equal(s.attributablePublicByUtc,p.captureUtc);
  assert.equal(s.firstAuthorDateKnownOrRequired,false);
  assert.equal(s.officialSenatorVoteProven,false);
  assert.equal(s.automaticForecastOrEvidenceInsertion,false);
  assert.ok(categories.has(s.issueFamily));
  assert.ok(s.exactShortExcerpt.length>=8&&s.exactShortExcerpt.length<=130);
 }
});
test('identity gates require original Senator directory and correct archive schema; never fabricated quote',()=>{
 assert.throws(()=>auditFourMoreSenateOriginal2022CampaignCaptureDatedPolicyExcerpts(
  {...originalOfficialService(),senators:[]},{},{}),
 /Six actual candidate source original acquisition inconsistent/);
 assert.throws(()=>auditFourMoreSenateOriginal2022CampaignCaptureDatedPolicyExcerpts(
  {...originalOfficialService(),source:{
   ...originalOfficialService().source,sourceBytesSha256:'f'.repeat(64),
  }},{},{}),
 /actual original official LRL Senate-service source/);
});
test('historical source runner refuses absent original government HTML and Wayback original campaign archive',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-four-extra-2022-real-'));
 try{
  const out=join(dir,'never-invent-output.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-four-more-senate-2022-capture-dated-original-issue-excerpts-offline.ts',
   '--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

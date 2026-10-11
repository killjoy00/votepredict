import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import receipts from '../data/evaluation/senate-two-2021-served-2020-original-campaign-eight-html-source-receipts-v1.json' with {type:'json'};
import ledger from '../data/evaluation/senate-two-2021-serving-2020-original-capture-dated-41-policy-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../src/evidence/issue-position-extractor.js';
import type {AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 TWO_ACTUALLY_2021_SERVING_SENATORS_2020_41_ORIGINAL_ISSUES_VERSION,
 auditTwoActual2021Senators41SourceIssuesFrom2020OriginalHTML,
} from '../src/evidence/senate-two-2021-serving-2020-41-original-capture-dated-policy-proof.js';

const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function actuallyServed2021():AuditedOfficialSenateDirectory{
 const u='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:u,observedAt:'2026-10-10T23:26:10.121Z',sourceBytesSha256:SHA,
   sourceBytesLength:1601232,directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[['Susan Kent','53'],['Karla Bigham','54']].map(([name,district])=>({
   officialName:name,officialNameRaw:name,officialSourceUrl:u,
   senateServiceTerms:[{startsYear:2021,endsYear:2022,district}],
  })),
 };
}
test('2020 genuine original candidate policy pages from two actual 2021-serving senators, total 41 exact short excerpts',()=>{
 assert.match(TWO_ACTUALLY_2021_SERVING_SENATORS_2020_41_ORIGINAL_ISSUES_VERSION,/41/);
 assert.equal(receipts.scope.senatorsActuallyServedDuringCalendarYear2021,2);
 assert.equal(receipts.scope.original2020HistoricCandidateHTMLBodies,8);
 assert.equal(receipts.scope.tomassoni2020ArchiveBoundedIndexRows,0);
 assert.equal(receipts.scope.firstAuthoredDateNotNeeded,true);
 assert.equal(ledger.scope.exactOriginalCampaignSiteExcerptCount,41);
 assert.equal(ledger.scope.originalCandidatePolicyPagesSelected,2);
 assert.equal(ledger.scope.productionDatabaseReadsWrites,0);
 assert.equal(ledger.scope.originalArchiveCaptureUtcCanProvePublicBy,true);
 assert.equal(new Set(receipts.originalFirstPartyWebPages.map(p=>p.originalSourceFile)).size,8);
 assert.equal(new Set(receipts.originalFirstPartyWebPages.map(p=>p.senator)).size,2);
 assert.equal(new Set(ledger.exactCandidateOwnedHistoricPolicyExcerpts.map(q=>q.id)).size,41);
 const counts=Object.fromEntries(['Susan Kent','Karla Bigham'].map(name=>
  [name,ledger.exactCandidateOwnedHistoricPolicyExcerpts.filter(x=>x.servingSenator===name).length]));
 assert.deepEqual(counts,{'Susan Kent':35,'Karla Bigham':6});
});
test('the 41 excerpts each have original 2020 source date, exact person and subject category, no invented first-posted date',()=>{
 const sourceByFile=new Map(receipts.originalFirstPartyWebPages.map(x=>[x.originalSourceFile,x]));
 const contexts=new Map(ledger.originalCandidateIssueSourcePages.map(x=>[x.id,x]));
 const categories=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const page of receipts.originalFirstPartyWebPages){
  assert.ok(page.actual2020ArchiveCaptureUtc>='2020-01-01T00:00:00.000Z');
  assert.ok(page.actual2020ArchiveCaptureUtc<'2020-11-03T00:00:00.000Z');
  assert.match(page.originalHTMLSHA256,/^[a-f0-9]{64}$/);
  assert.match(page.independentHistoricCdxPayloadSHA1Base32,/^[A-Z2-7]{32}$/);
  assert.equal(page.originalAuthorFirstPostingDateEstablished,false);
 }
 for(const q of ledger.exactCandidateOwnedHistoricPolicyExcerpts){
  const source=contexts.get(q.originalPageSectionId);
  assert.ok(source);
  const page=sourceByFile.get(source.originalSourceFile);
  assert.ok(page);
  assert.equal(q.servingSenator,page.senator);
  assert.ok(categories.has(q.issueFamily));
  assert.equal(q.publicByActualHistoricArchiveCaptureUtcRequired,true);
  assert.equal(q.originalFirstAuthoredDateProvenOrRequired,false);
  assert.equal(q.actuallyRecordedSenateRollCallProven,false);
  assert.equal(q.productionForecastOrEvidenceAdmission,false);
  assert.ok(q.exactCandidateOwnedOriginalHTMLExcerpt.length>=8);
  assert.ok(q.exactCandidateOwnedOriginalHTMLExcerpt.length<=130);
 }
});
test('original 2020 Karla Bigham homepage was genuinely for State Senate, later county commissioner copy not substituted',()=>{
 const karla=ledger.originalCandidateIssueSourcePages.find(x=>x.senator==='Karla Bigham');
 const susan=ledger.originalCandidateIssueSourcePages.find(x=>x.senator==='Susan Kent');
 assert.equal(karla?.originalSourceFile,'three20-02-archive-20200310200753-0.html');
 assert.equal(susan?.originalSourceFile,'three20-01-archive-20201018021402-0.html');
 assert.equal(ledger.scope.currentCountyCommissionerCampaignPagesNeverBackdatedToOriginal2020,true);
 assert.equal(ledger.scope.tomassoniOriginal2020PageUnavailableInBoundedCDXNotNoPolicy,true);
});
test('no invented government served-person verification, no fake acquired original manifest',()=>{
 const gov=actuallyServed2021();
 assert.throws(()=>auditTwoActual2021Senators41SourceIssuesFrom2020OriginalHTML(
  {...gov,source:{...gov.source,sourceBytesSha256:'f'.repeat(64)}},{},{}),
 /Full original publicly independent Minnesota LRL actually serving Senate directory/);
 assert.throws(()=>auditTwoActual2021Senators41SourceIssuesFrom2020OriginalHTML(
  gov,{},{}),
 /2020 original actual 2021-serving Senators archival manifest/);
});
test('one-shot audited historic quote report cannot create output without original government and campaign site bodies',()=>{
 const dir=mkdtempSync(join(tmpdir(),'actual-2021-serving-senators-2020-'));
 try{
  const out=join(dir,'not-created.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-two-actually-served-2021-senators-41-original-2020-issue-excerpts-offline.ts',
   '--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

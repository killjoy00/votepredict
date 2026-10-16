import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-two-more-2021-served-2020-original-campaign-dated-policy-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 TWO_MORE_2021_SERVING_SENATORS_2020_47_EXACT_QUOTES_VERSION,
 auditTwoNew2021ServedSenators2020Original47CampaignPolicyExcerpts,
} from '../evidence/senate-two-more-2021-serving-2020-campaign-47-original-quote-proof.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function gov():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:ledger.actualSenators.map(x=>({
   officialName:x.senator,officialNameRaw:x.senator,officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2021,endsYear:2022,district:x.electionDistrict}],
  })),
 };
}
test('actual 2021-serving MN senators, not just winners; 10 true original 2020 source pages, two people with 47 exact statements',()=>{
 assert.match(TWO_MORE_2021_SERVING_SENATORS_2020_47_EXACT_QUOTES_VERSION,/47/);
 assert.equal(ledger.actualSenators.length,5);
 assert.equal(ledger.scope.actualStateSenatorsWithAuthenticatedOriginal2020SitePages,3);
 assert.equal(ledger.scope.independentlyRehashedOriginalHTMLPages,10);
 assert.equal(ledger.scope.independentlyRetrievedCDXIndexFiles,5);
 assert.equal(ledger.scope.senatorsWithVerifiedIssueExcerpts,2);
 assert.equal(ledger.scope.shortPolicyExcerptsSelected,47);
 assert.equal(ledger.scope.productionEvidenceNeonVercelForecastOrSchedulerChanges,0);
 assert.deepEqual(Object.fromEntries(ledger.actualSenators.map(x=>[x.senator,x.issueQuotes])),{
  'Carrie Ruud':0,'Justin Eichorn':0,'Roger Chamberlain':0,
  'Rich Draheim':15,'David Senjem':32,
 });
 assert.equal(new Set(ledger.fullOriginalArchivedPageReceipts.map(x=>x.originalFile)).size,10);
 assert.equal(new Set(ledger.shortExactCandidateOwnedExcerpts.map(x=>x.id)).size,47);
});
test('genuine original 2020 body SHA-256/CDX-SHA1, actual archive UTC, original domain and limited short issue quotes are pinned',()=>{
 const pages=new Map(ledger.fullOriginalArchivedPageReceipts.map(x=>[x.originalFile,x]));
 const sections=new Map(ledger.candidatePolicyPageSections.map(s=>[s.id,s]));
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const p of pages.values()){
  assert.match(p.originalFile,/^five20-(?:02|04|05)-archive-\d{14}-[0-3]\.html$/);
  assert.match(p.originalHTMLSHA256,/^[0-9a-f]{64}$/);
  assert.match(p.independentIndexedCDXSHA1Base32,/^[A-Z2-7]{32}$/);
  assert.ok(p.actualArchiveCaptureUtc>='2020-01-01T00:00:00.000Z');
  assert.ok(p.actualArchiveCaptureUtc<'2020-11-03T00:00:00.000Z');
  assert.equal(new URL(p.originalUrl).hostname.replace(/^www\./,''),p.domain);
 }
 for(const s of sections.values()){
  assert.equal(pages.get(s.originalFile)?.senator,s.senator);
  assert.ok(s.context.length>60);
  assert.ok(s.visibleStart.length>12&&s.visibleStop.length>8);
 }
 for(const q of ledger.shortExactCandidateOwnedExcerpts){
  assert.ok(sections.has(q.pageId));
  assert.ok(families.has(q.issueFamily));
  assert.ok(q.exactExcerpt.length>=8&&q.exactExcerpt.length<=130);
  assert.ok(q.conservativeInterpretation.length>=8);
  assert.equal(q.attributableByOriginal2020ArchiveCaptureUtc,true);
  assert.equal(q.candidateSiteTextIsNotVerifiedRecordedVote,true);
  assert.equal(q.automaticProductionEvidenceAdmission,false);
 }
});
test('Eichorn original 2020 shell cannot generate any issue claims; failed/empty index means policy UNKNOWN',()=>{
 assert.equal(ledger.actualSenators.find(p=>p.senator==='Justin Eichorn')!.authOriginals,2);
 assert.equal(ledger.actualSenators.find(p=>p.senator==='Justin Eichorn')!.issueQuotes,0);
 assert.equal(ledger.actualSenators.find(p=>p.senator==='Carrie Ruud')!.authOriginals,0);
 assert.equal(ledger.actualSenators.find(p=>p.senator==='Roger Chamberlain')!.authOriginals,0);
 assert.equal(ledger.scope.richCampaignCopyActuallyOlderThan2020,true);
 assert.equal(ledger.scope.claimOfLegislativePriorActionsIsNotOfficialVote,true);
 assert.ok(ledger.candidatePolicyPageSections.filter(x=>x.senator==='Rich Draheim')
  .every(x=>x.context.includes('2016')));
});
test('bad official Senate source or missing actual archived original source denies any excerpt authentication',()=>{
 const source=gov();
 assert.throws(()=>auditTwoNew2021ServedSenators2020Original47CampaignPolicyExcerpts(
  {...source,source:{...source.source,sourceBytesSha256:'0'.repeat(64)}},{},{},{}),
  /Independently archived whole official LRL original Senate SERVICE/);
 assert.throws(()=>auditTwoNew2021ServedSenators2020Original47CampaignPolicyExcerpts(
  source,{},{},{}),/Historical 2020 original page acquisition results/);
});
test('source-only offline runner refuses absent independent government and original HTML, never invents proof',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mn-senate-2020-47-offline-'));
 try{
  const out=join(dir,'not-proven.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-two-2021-serving-senators-2020-original-47-issue-quotes-offline.ts',
   '--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

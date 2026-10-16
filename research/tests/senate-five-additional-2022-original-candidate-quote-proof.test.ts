import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-five-additional-served-2022-capture-dated-candidate-quotes-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 FIVE_MORE_ACTUAL_SENATORS_2022_CAPTURE_DATED_CAMPAIGN_QUOTES_VERSION,
 auditFiveNew2022CampaignSiteCandidateQuotes,
} from '../../src/evidence/senate-five-additional-served-2022-original-candidate-quote-audit.js';
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function mockGov():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:ledger.people.map(p=>({
   officialName:p.senator,officialNameRaw:p.senator,officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district:p.district}],
  })),
 };
}
test('six actual Minnesota Senate members have 22 real 2022 archived pages, five with 91 exact issue excerpts',()=>{
 assert.match(FIVE_MORE_ACTUAL_SENATORS_2022_CAPTURE_DATED_CAMPAIGN_QUOTES_VERSION,/91/);
 assert.equal(ledger.scope.peopleWithArchivedOriginals,6);
 assert.equal(ledger.scope.peopleWithPolicyExcerpts,5);
 assert.equal(ledger.scope.exactPolicyExcerpts,91);
 assert.equal(ledger.scope.originalArchivedPages,22);
 assert.equal(ledger.scope.selectedPolicySections,6);
 assert.equal(ledger.scope.independentOriginalCDXIndexFiles,6);
 assert.equal(ledger.scope.productionDBModelEvidenceOrForecastChanges,0);
 const by=Object.fromEntries(ledger.people.map(p=>[p.senator,p.exactExcerptCount]));
 assert.deepEqual(by,{
  'Sandy Pappas':27,'Foung Hawj':0,'Glenn Gruenhagen':14,
  'Andrew Lang':13,'John Jasinski':22,'Bobby Joe Champion':15,
 });
 assert.equal(ledger.fullOriginalArchivedSourceReceipts.length,22);
 assert.equal(new Set(ledger.fullOriginalArchivedSourceReceipts.map(x=>x.file)).size,22);
 assert.equal(new Set(ledger.exactVisibleCandidatePolicyExcerpts.map(x=>x.id)).size,91);
});
test('full 2022 first-party campaign URLs, publicly observable capture UTC, permanent SHA256/CDX-SHA1 receipts and issue contexts remain pinned',()=>{
 const sources=new Map(ledger.fullOriginalArchivedSourceReceipts.map(s=>[s.file,s]));
 const sections=new Map(ledger.selectedOriginalCandidatePolicySections.map(x=>[x.id,x]));
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const s of sources.values()){
  assert.match(s.htmlSha256,/^[0-9a-f]{64}$/);
  assert.match(s.cdxSha1Base32,/^[A-Z2-7]{32}$/);
  assert.match(s.file,/^sixnext22-0[1-6]-archive-\d{14}-[0-3]\.html$/);
  assert.ok(s.publicByUtc>='2022-01-01T00:00:00.000Z');
  assert.ok(s.publicByUtc<'2022-11-08T00:00:00.000Z');
  assert.equal(new URL(s.url).hostname.replace(/^www\./,''),s.domain);
 }
 for(const section of sections.values()){
  assert.equal(sources.get(section.pageFile)?.person,section.senator);
  assert.ok(section.start.length>10);
  assert.ok(section.context.length>35);
 }
 for(const q of ledger.exactVisibleCandidatePolicyExcerpts){
  assert.ok(sections.has(q.section));
  assert.ok(families.has(q.issue));
  assert.ok(q.quote.length>=8&&q.quote.length<=130);
  assert.ok(q.interpretation.length>=8);
  assert.equal(q.byActualOriginalArchiveCaptureUTC,true);
  assert.equal(q.legislativePastWorkClaimNotProofOfOfficialVote,true);
  assert.equal(q.automaticallyAdmittedToProduction,false);
 }
});
test('old House candidate sources and older district text are NOT authored fresh Senate text; no phantom policy for Foung',()=>{
 const p=(name:string)=>ledger.people.find(x=>x.senator===name)!;
 assert.match(p('Glenn Gruenhagen').historicalSourceContext,/legacy_house/);
 assert.match(p('John Jasinski').historicalSourceContext,/older_senate_district/);
 assert.match(p('Bobby Joe Champion').historicalSourceContext,/older_house_period/);
 assert.equal(p('Foung Hawj').exactExcerptCount,0);
 assert.equal(ledger.scope.legacyHouseOlderDistrictAndPastCycleWordingDistinct,true);
 assert.equal(ledger.scope.campaignClaimsNotOfficialRecordedVotes,true);
});
test('tampering with the independently captured government SHA or omitting original CDX/HTML denies any original quote proof',()=>{
 const gov=mockGov();
 assert.throws(()=>auditFiveNew2022CampaignSiteCandidateQuotes(
  {...gov,source:{...gov.source,sourceBytesSha256:'0'.repeat(64)}},{},{},{}),
 /Complete original independently captured Minnesota Senate service/);
 assert.throws(()=>auditFiveNew2022CampaignSiteCandidateQuotes(
  gov,{},{},{}),
 /Actual original 2022 Senate website CDX\/HTML source acquisition/);
});
test('independent offline original audit refuses any missing source or attempt to invent proof report',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mn-five-more-senators-91-'));
 try{
  const report=join(dir,'not-a-real-source-proof.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-five-additional-served-2022-candidate-quotes-offline.ts',
   '--output',report,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(report),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

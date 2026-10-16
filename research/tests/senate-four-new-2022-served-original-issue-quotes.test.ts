import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import excerptLedger from '../../data/evaluation/senate-four-new-2022-served-original-2022-exact-policy-quotes-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {FOUR_NEW_ACTUALLY_SERVED_2022_ORIGINAL_POLICY_QUOTES_VERSION,
 auditFour2023ServingSenators47GenuineArchived2022CandidateStatements}
 from '../evidence/senate-four-new-2022-original-campaign-excerpt-proof.js';
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function realGov():AuditedOfficialSenateDirectory{
 return{schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',sourceBytesSha256:SHA,
   sourceBytesLength:1601232,directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:excerptLedger.people.map(x=>({
   officialName:x.senator,officialNameRaw:x.senator,officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district:x.district}],
  }))};
}
test('six independently actual-serving Senate people, 16 original pages and exactly four/47 excerpts',()=>{
 assert.match(FOUR_NEW_ACTUALLY_SERVED_2022_ORIGINAL_POLICY_QUOTES_VERSION,/47/);
 assert.equal(excerptLedger.scope.originalCandidateDomainsProbed,6);
 assert.equal(excerptLedger.scope.actualSenatorsWithAuthenticatedOriginalHTML,4);
 assert.equal(excerptLedger.scope.totalOriginalHTMLBodies,16);
 assert.equal(excerptLedger.scope.policyPageSectionsSelected,5);
 assert.equal(excerptLedger.scope.senatorsWithVerifiedStatements,4);
 assert.equal(excerptLedger.scope.exactStatements,47);
 assert.equal(excerptLedger.scope.productionReadsWritesModelForecastEvidenceChanges,0);
 assert.equal(excerptLedger.fullOriginalPageSHAReceipts.length,16);
 assert.equal(new Set(excerptLedger.fullOriginalPageSHAReceipts.map(p=>p.originalFile)).size,16);
 assert.equal(new Set(excerptLedger.exactOriginalShortExcerpts.map(q=>q.id)).size,47);
 const bySenator=Object.fromEntries(excerptLedger.people.map(p=>[p.senator,p.verifiedExactPolicyExcerpts]));
 assert.deepEqual(bySenator,{
  'Paul Utke':25,'Gene Dornink':0,'Melissa Wiklund':2,
  'Jim Abeler':8,'Scott Dibble':12,'Bobby Joe Champion':0,
 });
 assert.ok(excerptLedger.people.filter(p=>p.verifiedExactPolicyExcerpts>0).length===4);
 assert.equal(excerptLedger.people.find(p=>p.senator==='Melissa Wiklund')!.authenticOriginalPages,4);
 assert.equal(excerptLedger.people.find(p=>p.senator==='Jim Abeler')!.authenticOriginalPages,4);
});
test('all full original campaign pages carry genuine hashes, 2022 archive UTC; exact excerpts small, issue-coded, not recorded votes',()=>{
 const pages=new Map(excerptLedger.fullOriginalPageSHAReceipts.map(p=>[p.originalFile,p]));
 const sections=new Map(excerptLedger.policySections.map(s=>[s.id,s]));
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const p of pages.values()){
  assert.match(p.sha256,/^[0-9a-f]{64}$/);
  assert.ok(p.captureUtc>='2022-01-01T00:00:00.000Z');
  assert.ok(p.captureUtc<'2022-11-08T00:00:00.000Z');
  assert.match(p.originalFile,/^six22-0[1345]-archive-\d{14}-[0-3]\.html$/);
  assert.equal(new URL(p.originalUrl).hostname.replace(/^www\./,''),p.domain);
 }
 for(const section of sections.values()){
  const p=pages.get(section.originalFile)!;assert.ok(p);
  assert.equal(p.senator,section.senator);
  assert.equal(p.captureUtc,section.captureUtc);
  assert.equal(section.firstAuthorPostedDateKnown,false);
 }
 for(const row of excerptLedger.exactOriginalShortExcerpts){
  assert.ok(sections.has(row.pageId));
  assert.ok(row.exactExcerpt.length>=8&&row.exactExcerpt.length<=130);
  assert.ok(families.has(row.issueFamily));
  assert.ok(row.conservativeMeaning.length>8);
  assert.equal(row.candidateCampaignClaimNotAnOfficialRollCall,true);
  assert.equal(row.originalHistoricalPageCaptureIsPublicByUtc,true);
  assert.equal(row.noProductionForecastAdmission,true);
 }
});
test('broken original independent government SHA and absent historic source manifest reject all quote claims',()=>{
 const o=realGov();
 assert.throws(()=>auditFour2023ServingSenators47GenuineArchived2022CandidateStatements(
  {...o,source:{...o.source,sourceBytesSha256:'0'.repeat(64)}},{},{},{}),
  /Original independently dated official Minnesota Senate SERVICE/);
 assert.throws(()=>auditFour2023ServingSenators47GenuineArchived2022CandidateStatements(
  o,{},{},{}),/Actual original six-senator 2022 Wayback manifest/);
});
test('offline proof runner refuses missing originals; cannot generate phantom verified research',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mn-four-original-policy-47-'));
 try{
  const output=join(dir,'not-proven.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-four-new-2022-served-senators-exact-campaign-excerpts-offline.ts',
   '--output',output],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(output),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

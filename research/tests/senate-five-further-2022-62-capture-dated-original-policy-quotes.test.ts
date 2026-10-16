import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-five-further-2022-authenticated-capture-dated-original-issue-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 FIVE_FURTHER_SENATOR_2022_62_CAMPAIGN_QUOTE_AUDIT_VERSION,
 auditFiveMore2022CaptureDatedOriginalSenatorPolicyExcerpts,
} from '../../src/evidence/senate-five-further-2022-capture-dated-62-original-campaign-excerpts.js';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function officialLRL():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:300000,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[
   ['Heather Gustafson','36'],['Julia Coleman','48'],
   ['Zach Duckworth','57'],['Alice Mann','50'],['John Hoffman','34'],
  ].map(([name,district])=>({
   officialName:name,officialNameRaw:name,officialSourceUrl:url,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district}],
  })),
 };
}
test('five new actual MN state senator persons and 62 source-quoted original policy date proofs',()=>{
 assert.match(FIVE_FURTHER_SENATOR_2022_62_CAMPAIGN_QUOTE_AUDIT_VERSION,/62/);
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.electionYear,2022);
 assert.equal(ledger.scope.verifiedActualSenatePeople,5);
 assert.equal(ledger.scope.authenticatedOriginalPagesFromFirstAcquisition,13);
 assert.equal(ledger.scope.selectedActualFirstPartyIssuePages,5);
 assert.equal(ledger.scope.exactVisibleSourcePolicyExcerpts,62);
 assert.equal(ledger.scope.captureUtcIsLegitimateAttributionDate,true);
 assert.equal(ledger.scope.firstAuthoredDateIsNotNeeded,true);
 assert.equal(ledger.scope.productionDatabaseOrForecastWrites,0);
 assert.equal(new Set(ledger.originalAuthenticatedPageReceipts.map(p=>p.originalFile)).size,13);
 assert.equal(new Set(ledger.originalAuthenticatedPageReceipts.map(p=>p.senator)).size,5);
 assert.equal(new Set(ledger.policyPages.map(p=>p.id)).size,5);
 assert.equal(new Set(ledger.exactAttributablePolicyExcerpts.map(p=>p.id)).size,62);
 assert.equal(ledger.sourceProvenance.originalArchivedPageArtifactId,11691214009);
});
test('archive capture UTC, not invented original writing date, exactly attributes every source excerpt',()=>{
 const pageByFile=new Map(ledger.originalAuthenticatedPageReceipts.map(p=>[p.originalFile,p]));
 const selected=new Map(ledger.policyPages.map(p=>[p.id,p]));
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const p of ledger.originalAuthenticatedPageReceipts){
  assert.ok(p.archiveCapturedAtUtc.startsWith('2022-'));
  assert.ok(p.archiveCapturedAtUtc<'2022-11-08T00:00:00.000Z');
  assert.match(p.originalHTMLSha256,/^[0-9a-f]{64}$/);
  assert.match(p.originalCdxSha1Base32,/^[A-Z2-7]{32}$/);
  assert.equal(p.originalAuthorFirstPublicationDateProven,false);
 }
 for(const q of ledger.exactAttributablePolicyExcerpts){
  const selectedPage=selected.get(q.pageId);
  assert.ok(selectedPage);
  const original=pageByFile.get(selectedPage.sourceFile);
  assert.ok(original);
  assert.equal(q.senator,original.senator);
  assert.equal(q.attributableOriginalArchiveCaptureUtc,original.archiveCapturedAtUtc);
  assert.equal(q.historicalForecastFeatureOrDatabaseEvidenceAutomaticallyAdmitted,false);
  assert.equal(q.claimedLegislativeActionNotIndependentlyRollCallProven,true);
  assert.ok(families.has(q.issueFamily));
  assert.ok(q.exactExcerpt.length>=8&&q.exactExcerpt.length<=130);
 }
});
test('pre-2022 original website copy and old District 36 website are explicitly recorded as observed 2022 site text',()=>{
 const julia=ledger.policyPages.find(p=>p.id==='julia22');
 const zach=ledger.policyPages.find(p=>p.id==='zach22');
 const john=ledger.policyPages.find(p=>p.id==='hoffman22');
 assert.ok(julia&&zach&&john);
 assert.match(julia.campaignContext,/older_2020/);
 assert.match(zach.campaignContext,/old_2020/);
 assert.match(john.campaignContext,/pre_redistrict_sd36/);
 assert.equal(ledger.scope.olderWebsitePageContentKeptDistinctFromFresh2022Authorship,true);
 assert.equal(ledger.sourceProvenance.secondAcquisitionTransientAliceMannArchiveQueryFailureObserved,true);
 assert.equal(ledger.sourceProvenance.firstAcquisitionAliceMannOriginalFullHtmlShaAndCdxVerified,true);
});
test('a fake LRL serving roster or invented acquisition manifest cannot authenticate any quote',()=>{
 const service=officialLRL();
 assert.throws(()=>auditFiveMore2022CaptureDatedOriginalSenatorPolicyExcerpts(
  {...service,source:{...service.source,sourceBytesSha256:'f'.repeat(64)}},{},{}),
 /Real independent original Minnesota LRL serving senator directory/);
 assert.throws(()=>auditFiveMore2022CaptureDatedOriginalSenatorPolicyExcerpts(
  service,{},{}),
 /Must re-open actual first historical source acquisition/);
});
test('offline auditor refuses a caller with no full original Senate member HTML and archived campaign body sources',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate-five-more-actual-original-'));
 try{
  const f=join(dir,'fake-statement-report.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx',
   'scripts/audit-five-further-2022-senators-capture-dated-original-issue-excerpts-offline.ts',
   '--output',f,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(f),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

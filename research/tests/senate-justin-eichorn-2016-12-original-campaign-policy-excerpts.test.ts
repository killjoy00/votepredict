import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {independentlyAuditJustinEichorn12ExactOriginal2016CampaignIssueStatements}
 from '../../src/evidence/senate-justin-eichorn-2016-original-12-quote-proof.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function actuallyServed():AuditedOfficialSenateDirectory{
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[{
   officialName:'Justin D. Eichorn',officialNameRaw:'Eichorn, Justin D.',
   officialSourceUrl:GOV,
   senateServiceTerms:[{startsYear:2017,endsYear:2022,district:'5'}],
  }],
 };
}
test('actual 2021-serving Minnesota senator site has 12 exact first-party policy excerpts, not 2020 website words',()=>{
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.actual2021MNStateSenateServiceRequired,true);
 assert.equal(ledger.scope.electionYear,2020);
 assert.equal(ledger.scope.electionDistrict,'5');
 assert.equal(ledger.person.candidateName,'Justin Eichorn');
 assert.equal(ledger.person.actualLRLName,'Justin D. Eichorn');
 assert.equal(ledger.scope.wholeSourceHTMLCopies,4);
 assert.equal(ledger.scope.wholeIndependentCDXSources,8);
 assert.equal(ledger.scope.shortExactPolicyExcerpts,12);
 assert.equal(ledger.scope.productionDatabaseEvidenceModelForecastChanges,0);
 assert.equal(ledger.provenance.originalIssuesAcquisitionRun,38161476583);
 assert.equal(ledger.provenance.originalIssuesArtifact,11710856244);
 assert.equal(new Set(ledger.exactCandidateSiteShortPolicyExcerpts.map(x=>x.quote)).size,12);
});
test('archived original first-party HTML timestamps/indexed SHA1/sha256 and distinct 2016 versus 2018 full pages pinned',()=>{
 const pages=ledger.originalFullPageReceipts;
 assert.equal(pages.length,4);
 assert.equal(new Set(pages.map(p=>p.file)).size,4);
 assert.equal(new Set(pages.map(p=>p.sha256)).size,2);
 assert.equal(pages[0].sha256,pages[2].sha256);
 assert.equal(pages[0].sha256,pages[3].sha256);
 assert.notEqual(pages[0].sha256,pages[1].sha256);
 for(const p of pages){
  assert.match(p.file,/^eichornissue-original-20\d{12}-[0-3]\.html$/);
  assert.match(p.sha256,/^[a-f0-9]{64}$/);
  assert.match(p.cdxSHA1,/^[A-Z2-7]{32}$/);
  assert.ok(p.observedUTC>='2016-01-01T00:00:00.000Z');
  assert.ok(p.observedUTC<'2020-11-03T00:00:00.000Z');
  assert.equal(new URL(p.url).hostname,'justinformnsenate.com');
  assert.equal(new URL(p.url).pathname,'/issues');
 }
 assert.equal(ledger.policyPageSection.fullOriginalFile,pages[0].file);
 assert.equal(ledger.policyPageSection.noProofSameIssueHTML2020,true);
});
test('candidate-owned exact statements have valid short lengths, issue families, conservative meanings and no roll-call inference',()=>{
 const issues=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const q of ledger.exactCandidateSiteShortPolicyExcerpts){
  assert.ok(issues.has(q.issue));
  assert.ok(q.quote.length>=8&&q.quote.length<=130);
  assert.ok(q.meaning.length>=8);
  assert.ok(q.sourceSection==='original2016Issues');
  assert.ok(q.sourceCapturePublicByNotFirstAuthored);
  assert.ok(q.copyIn2018NotCountedAgain);
  assert.ok(q.notAnOfficialSenateRollCall);
  assert.equal(q.productionEvidenceAutomaticImport,false);
 }
 assert.equal(ledger.scope.original2016CampaignCopyNotNew2020Authorship,true);
 assert.equal(ledger.scope.oldCopied2018ContentNotDoubleCounted,true);
 assert.equal(ledger.scope.publisherOct2020RelayNotOriginalFirstPartyHtml,true);
});
test('missing complete genuine LRL/2020 homepage/2016 issue site original never authorizes a quote',()=>{
 const official=actuallyServed();
 assert.throws(()=>independentlyAuditJustinEichorn12ExactOriginal2016CampaignIssueStatements(
  {...official,source:{...official.source,sourceBytesSha256:'0'.repeat(64)}},
  {},new Uint8Array(3578),{},{}),
  /Independent entire original Minnesota LRL ACTUALLY SERVED senate directory/);
 assert.throws(()=>independentlyAuditJustinEichorn12ExactOriginal2016CampaignIssueStatements(
  official,{},new Uint8Array(3578),{},{}),
  /True May 2020 archived campaign homepage JS-shell SHA\/CDX/);
});
test('offline original byte source verifier refuses to invent JSON result from missing original LRL/full HTML/CDX',()=>{
 const dir=mkdtempSync(join(tmpdir(),'eichorn-2016-original-12-'));
 try{
  const out=join(dir,'unverified-candidate-policy.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-justin-eichorn-2016-original-12-issue-quotations-offline.ts',
   '--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

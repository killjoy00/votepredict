import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import ledger from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-original-26-exact-policy-excerpts-v1.json' with {type:'json'};
import sourceTargets from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-targeted-first-party-original-replays-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 RUUD_CHAMBERLAIN_26_ORIGINAL_ISSUE_QUOTE_PROOF_VERSION,
 independentlyProveRuudChamberlain26OriginalCampaignAndSenatorIssuesExcerpts,
} from '../evidence/senate-ruud-2013-chamberlain-2022-26-original-excerpts-proof.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
const GOV='https://www.lrl.mn.gov/legdb/senate_dir';
const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function government():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:GOV,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false},
  senators:[
   {officialName:'Carrie L. Ruud',officialNameRaw:'Ruud, Carrie L.',
    officialSourceUrl:GOV,senateServiceTerms:[{startsYear:2013,endsYear:2022,district:'10'}]},
   {officialName:'Roger C. Chamberlain',officialNameRaw:'Chamberlain, Roger C.',
    officialSourceUrl:GOV,senateServiceTerms:[{startsYear:2013,endsYear:2022,district:'38'}]},
  ],
 };
}
test('two actual 2021 Minnesota Senate-serving people with exactly 5 Carrie Ruud and 21 Roger Chamberlain historical site issue statements',()=>{
 assert.match(RUUD_CHAMBERLAIN_26_ORIGINAL_ISSUE_QUOTE_PROOF_VERSION,/26-original-policy/);
 assert.equal(ledger.scope.issue,864);
 assert.equal(ledger.scope.verifiedActual2021MinnesotaStateSenatePeople,2);
 assert.equal(ledger.scope.selectedAuthenticatedHistoricOriginalIssuePages,3);
 assert.equal(ledger.scope.allAcquiredFullOriginalPageBodiesRehashed,10);
 assert.equal(ledger.scope.originalIndependentFullIndexJsonRehashed,2);
 assert.equal(ledger.scope.exactResearchStatementExcerpts,26);
 assert.deepEqual(ledger.people.map(x=>[x.name,x.actual2021SenateDistrict,x.selectedUniqueExcerpts]),[
  ['Carrie Ruud','10',5],['Roger Chamberlain','38',21],
 ]);
 assert.equal(ledger.candidateOriginalLiteralResearchStatements.filter(x=>x.page==='ruud2013home').length,5);
 assert.equal(ledger.candidateOriginalLiteralResearchStatements.filter(x=>x.page==='roger2022priorities').length,13);
 assert.equal(ledger.candidateOriginalLiteralResearchStatements.filter(x=>x.page==='roger2022electionHome').length,8);
 assert.equal(new Set(ledger.candidateOriginalLiteralResearchStatements.map(x=>x.quote)).size,26);
 assert.equal(ledger.scope.productionDatabaseEvidenceModelSchedulerChanges,0);
});
test('each source phrase requires unique literal quote, short bounded length, real issue family, truthful site classification and no automatic production evidence',()=>{
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 const ids=new Set<string>();
 for(const q of ledger.candidateOriginalLiteralResearchStatements){
  assert.match(q.id,/^ruud-chamberlain-historic-\d{3}$/);
  assert.ok(!ids.has(q.id));ids.add(q.id);
  assert.ok(families.has(q.issue));
  assert.ok(q.quote.length>=8&&q.quote.length<=130);
  assert.ok(q.meaning.length>=8);
  assert.equal(q.originalCaptureTimestampIsPublicByNotAuthorFirst,true);
  assert.equal(q.sourceMustBeWithinActualOriginalSiteVisibleSection,true);
  assert.equal(q.notIndependentlyProvenSenateVote,true);
  assert.equal(q.automaticProductionIngestion,false);
  if(q.page==='roger2022priorities')
   assert.notEqual(q.kind,'candidate_owned_policy_statement');
  if(q.page==='ruud2013home')
   assert.equal(q.kind,'candidate_owned_policy_statement');
 }
 assert.equal(ids.size,26);
});
test('first-party campaign context and original UTC history must never be erased',()=>{
 const pages=ledger.candidateOwnedOriginalIssueSourceSections;
 assert.deepEqual(pages.map(x=>x.sourceIndex),[4,7,8]);
 assert.equal(pages[0].captureUtc,'2013-09-22T05:16:42.000Z');
 assert.equal(pages[0].originalContentRetainsOldPostElectionLanguage,true);
 assert.equal(pages[1].captureUtc,'2022-11-05T21:23:27.000Z');
 assert.equal(pages[2].captureUtc,'2022-11-07T17:17:51.000Z');
 assert.match(pages[2].senateElectionSiteIdentity,/District 36/);
 assert.equal(ledger.scope.ruud2013PostElectionCopyNotAvailableToForecastBefore2012Election,true);
 assert.equal(ledger.scope.roger2022LegislativePrioritiesAreSenatorOwnedNotNecessarilyOfficialCampaignStatement,true);
 assert.equal(ledger.scope.previouslyObservedRuud2012PartyChairSiteExcluded,true);
 assert.equal(ledger.scope.roger2020PersonalPodcastExcluded,true);
 assert.equal(ledger.scope.previousOutsideGroupIndependentExpenditureExcluded,true);
 assert.equal(ledger.scope.earlierLegislativeActionsAreCampaignSiteSelfClaimsNotRecordedVotes,true);
});
test('ten whole 2013/2022 original indexed HTML receipts and independent raw CDX source must all be pinned',()=>{
 assert.equal(sourceTargets.targets.length,10);
 assert.equal(ledger.provenance.targetedOriginalHTMLArtifact,11711570602);
 assert.equal(ledger.provenance.originalFullCDXArtifact,11711190862);
 assert.equal(ledger.provenance.originalCDXFiles.length,2);
 for(const section of ledger.candidateOwnedOriginalIssueSourceSections){
  assert.equal(section.originalURL,sourceTargets.targets[section.sourceIndex].originalUrl);
  assert.equal(section.originalCDXSHA1,sourceTargets.targets[section.sourceIndex].cdxSha1);
  assert.equal(section.captureUtc,sourceTargets.targets[section.sourceIndex].archiveCapturedUTC);
  assert.match(section.sourceSHA256,/^[a-f0-9]{64}$/);
  assert.match(section.originalCDXSHA1,/^[A-Z2-7]{32}$/);
 }
 assert.equal(ledger.provenance.originalCDXFiles.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)),true);
});
test('tampered whole original government source and missing acquisition manifest cannot create 26 phantom campaign quotes',()=>{
 const official=government();
 assert.throws(()=>independentlyProveRuudChamberlain26OriginalCampaignAndSenatorIssuesExcerpts(
  {...official,source:{...official.source,sourceBytesSha256:'0'.repeat(64)}},
  {},{},{},{}),
  /Complete genuine independent government actual Senate-service directory/);
 assert.throws(()=>independentlyProveRuudChamberlain26OriginalCampaignAndSenatorIssuesExcerpts(
  official,{},new Proxy({},{}),{},{}),
  /Authentic full ten-original-page historical archive provenance receipt invalid/);
});
test('standalone verifier refuses missing official original bytes, 10 historical campaign pages and CDX without publishing fake source proof',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'ruud-chamberlain-26-original-'));
 try{
  const output=join(tmp,'never-authenticated-quotes.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx',
   'scripts/audit-ruud-2013-chamberlain-2022-26-original-policy-excerpts-offline.ts',
   '--output',output,
  ],{stdio:'pipe',timeout:15000}));
  assert.equal(existsSync(output),false);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});

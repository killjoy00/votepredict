import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ledger from '../data/evaluation/senate-nick-frentz-2022-podcast-site-26-original-capture-dated-policy-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../src/evidence/issue-position-extractor.js';
import {
 NICK_FRENTZ_2022_PODCAST_DOMAIN_26_ORIGINAL_ISSUES_VERSION,
 auditFrentz26CaptureDatedOriginal2022CandidateIssueStatements,
} from '../src/evidence/senate-nick-frentz-2022-26-original-capture-dated-campaign-issue-proof.js';
import type {AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';

const LRL_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function officialSenator():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:LRL_SHA,sourceBytesLength:330000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true},
  senators:[{officialName:'Nick A. Frentz',officialNameRaw:'Frentz, Nick A.',
   officialSourceUrl:url,senateServiceTerms:[
    {startsYear:2017,endsYear:2022,district:'19'},
    {startsYear:2023,endsYear:null,district:'18'},
   ]}],
 };
}
test('26 exact archived site issue statements, sourced from 3 historic originals for ACTUAL serving senator',()=>{
 assert.match(NICK_FRENTZ_2022_PODCAST_DOMAIN_26_ORIGINAL_ISSUES_VERSION,/26/);
 assert.equal(ledger.scope.uniqueActuallyServedSenators,1);
 assert.equal(ledger.scope.authenticatedOriginalFullHTMLPageCopies,3);
 assert.equal(ledger.scope.selectedIssueContentSnapshots,2);
 assert.equal(ledger.scope.attributableExactPolicyExcerpts,26);
 assert.equal(ledger.scope.archivedOlder2020IssueSectionProofCount,13);
 assert.equal(ledger.scope.source2022CurrentSessionIssueSectionProofCount,13);
 assert.equal(ledger.scope.originalAuthorFirstWrittenDateNotRequired,true);
 assert.equal(ledger.scope.productionDatabaseReadsOrWrites,0);
 assert.equal(new Set(ledger.originalFullPageSourceReceipts.map(p=>p.file)).size,3);
 assert.equal(new Set(ledger.exactSourceCandidateIssueExcerpts.map(q=>q.id)).size,26);
 assert.equal(ledger.provenance.contemporaneousPodcastEpisodeDate,'2022-09-29');
 assert.equal(ledger.provenance.independentlyLinkedHistoricalCampaignDomain,'frentzforsenate.com');
 assert.equal(ledger.provenance.wrongCurrentDomain2022IndexSearch,'frentzformnsenate.com');
});
test('every exact original campaign snippet has actual verified 2022 public-by UTC, never invented first author writing date',()=>{
 const byId=new Map(ledger.originalFullPageSourceReceipts.map(p=>[p.id,p]));
 const issues=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const p of ledger.originalFullPageSourceReceipts){
  assert.match(p.sha,/^[0-9a-f]{64}$/);
  assert.match(p.digest,/^[A-Z2-7]{32}$/);
  assert.ok(p.capture<'2022-11-08T00:00:00.000Z');
  assert.equal(p.originalFirstAuthoredOrPublishedDateNeeded,false);
  assert.equal(p.attributableOriginalPublicByCaptureUtc,p.capture);
 }
 let older=0,newer=0;
 for(const q of ledger.exactSourceCandidateIssueExcerpts){
  const p=byId.get(q.sourcePageId);
  assert.ok(p);
  assert.equal(q.publiclyAttributableNoLaterThanUtc,p.capture);
  assert.equal(q.verifiableOriginalArchiveCaptureUtc,p.capture);
  assert.equal(q.servingSenator,'Nick Frentz');
  assert.equal(q.originalFirstAuthorPostedDateRequired,false);
  assert.equal(q.candidateOwnedWebsiteTextNotPersonalSpeechOrOfficialRollCall,true);
  assert.equal(q.noAutomaticProductionEvidenceOrHistoricForecastAdmission,true);
  assert.ok(issues.has(q.issueFamily));
  assert.ok(q.exactShortExcerpt.length>=8&&q.exactShortExcerpt.length<=130);
  if(q.sourcePageId==='frentzJan2022')older++;
  else{
   newer++;
   assert.equal(q.laterIndependentlyAuthenticatedSameOriginalWordingPageId,
    'frentzNovA2022');
   assert.equal(q.verifiableOriginalArchiveCaptureUtc,
    '2022-11-07T17:15:41.000Z');
  }
 }
 assert.equal(older,13);
 assert.equal(newer,13);
});
test('2020 Capitol Report words visible on Jan 2022 candidate site do not become new 2022 policy authorship',()=>{
 const jan=ledger.originalFullPageSourceReceipts.find(p=>p.id==='frentzJan2022');
 const later=ledger.originalFullPageSourceReceipts.find(p=>p.id==='frentzNovA2022');
 const earlier=ledger.originalFullPageSourceReceipts.find(p=>p.id==='frentzNovB2022');
 assert.ok(jan&&later&&earlier);
 assert.equal(jan.context,'2020 Capitol Report');
 assert.equal(jan.capture,'2022-01-27T05:20:03.000Z');
 assert.equal(earlier.capture,'2022-11-07T17:15:41.000Z');
 assert.ok(later.capture>earlier.capture);
 assert.equal(earlier.selected,true);
 assert.equal(later.selected,false);
 assert.ok(ledger.exactSourceCandidateIssueExcerpts.filter(q=>
  q.sourcePageId==='frentzJan2022').every(q=>
   q.statementCharacter.includes('2020_report')
   ||q.statementCharacter==='claim_about_earlier_legislative_work_not_verified_vote'));
});
test('no fake serving Senator or missing true public source manifest may authenticate issue text',()=>{
 const gov=officialSenator();
 assert.throws(()=>auditFrentz26CaptureDatedOriginal2022CandidateIssueStatements(
  {...gov,source:{...gov.source,sourceBytesSha256:'f'.repeat(64)}},{},{}),
 /Actual independent original Minnesota senator government service directory/);
 assert.throws(()=>auditFrentz26CaptureDatedOriginal2022CandidateIssueStatements(
  gov,{},{}),
 /Independent actual 2022 original Wayback source acquisition must pass/);
});
test('one-shot offline quote audit refuses no original government/body inputs without creating output',()=>{
 const root=mkdtempSync(join(tmpdir(),'frentz-candidate-site-26-'));
 try{
  const out=join(root,'never-created.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx',
   'scripts/audit-nick-frentz-2022-original-26-capture-dated-policy-snippets-offline.ts',
   '--output',out,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(out),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

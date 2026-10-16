import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import pages from '../../data/evaluation/senate-eight-probed-six-served-original-2022-23-html-receipts-v1.json' with {type:'json'};
import excerpts from '../../data/evaluation/senate-five-new-2022-original-site-capture-dated-policy-excerpts-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../../src/evidence/issue-position-extractor.js';
import {
 FIVE_NEW_ACTUALLY_SERVED_2022_ORIGINAL_97_ISSUES_VERSION,
 auditFiveNewActuallyServedSenators97ArchiveDatedPolicyExcerpts,
} from '../evidence/senate-five-new-served-2022-97-capture-dated-exact-campaign-excerpts.js';
import type {AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';

const SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function government():AuditedOfficialSenateDirectory{
 const url='https://www.lrl.mn.gov/legdb/senate_dir';
 return{
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:SHA,sourceBytesLength:1601232,
   directoryIsSenatorServiceNotCandidateFiling:true,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
  },
  senators:[
   ['Jordan Rasmusson','9'],['Ron Latz','46'],['Jim Carlson','52'],
   ['Karin Housley','33'],['Warren Limmer','37'],['Mark Koran','28'],
  ].map(([name,district])=>({
   officialName:name,officialNameRaw:name,officialSourceUrl:url,
   senateServiceTerms:[{startsYear:2023,endsYear:null,district}],
  })),
 };
}
test('six actual 2023 MN serving people have 23 authentic full archived 2022 site pages; only five with 97 issue statements',()=>{
 assert.match(FIVE_NEW_ACTUALLY_SERVED_2022_ORIGINAL_97_ISSUES_VERSION,/97/);
 assert.equal(pages.scope.individualPeopleActuallyServedAfterElection,6);
 assert.equal(pages.scope.verifiedOriginal2022FirstPartyHTMLPageCopies,23);
 assert.equal(excerpts.scope.distinctActualServingSenatorsWithPolicyExcerpts,5);
 assert.equal(excerpts.scope.distinctActuallyServingSenatorsWithArchivedOriginalPages,6);
 assert.equal(excerpts.scope.candidateOwnedPolicyPagesSelected,6);
 assert.equal(excerpts.scope.exactCampaignIssueStatements,97);
 assert.equal(excerpts.scope.jimCarlsonOriginalCampaignHomepageButNoVisibleIssuesInBoundedSample,true);
 assert.equal(excerpts.scope.productionEvidenceOrForecastInserts,0);
 assert.equal(new Set(pages.allAuthenticatedOriginal2022SourcePages.map(p=>p.originalFile)).size,23);
 assert.equal(new Set(pages.allAuthenticatedOriginal2022SourcePages.map(p=>p.person)).size,6);
 assert.equal(new Set(excerpts.exactOriginalCandidateSiteIssueExcerpts.map(q=>q.id)).size,97);
 assert.equal(new Set(excerpts.selectedOriginalCandidateIssueSections.map(x=>x.id)).size,6);
 const counts=Object.fromEntries([...new Set(excerpts.exactOriginalCandidateSiteIssueExcerpts.map(q=>q.servingSenator))].map(person=>
  [person,excerpts.exactOriginalCandidateSiteIssueExcerpts.filter(q=>q.servingSenator===person).length]));
 assert.deepEqual(counts,{
  'Jordan Rasmusson':11,'Ron Latz':24,'Karin Housley':20,
  'Warren Limmer':31,'Mark Koran':11,
 });
 assert.equal(Object.hasOwn(counts,'Jim Carlson'),false);
});
test('every original archived candidate page has 2022 pre-general-election capture UTC and independently pinned SHA-256 and CDX SHA1',()=>{
 const originals=new Map(pages.allAuthenticatedOriginal2022SourcePages.map(x=>[x.originalFile,x]));
 const selected=new Map(excerpts.selectedOriginalCandidateIssueSections.map(p=>[p.id,p]));
 const families=new Set<string>(ISSUE_POSITION_FAMILIES);
 for(const p of originals.values()){
  assert.ok(p.originalCaptureUtc>='2022-01-01T00:00:00.000Z');
  assert.ok(p.originalCaptureUtc<'2022-11-08T00:00:00.000Z');
  assert.match(p.originalHtmlSha256,/^[0-9a-f]{64}$/);
  assert.match(p.independentHistoricalCdxSha1Base32,/^[A-Z2-7]{32}$/);
  assert.equal(p.firstAuthorWrittenDateProven,false);
 }
 for(const snippet of excerpts.exactOriginalCandidateSiteIssueExcerpts){
  const section=selected.get(snippet.sourcePageId);
  assert.ok(section);
  const source=originals.get(section.originalSourceFile);
  assert.ok(source);
  assert.equal(snippet.servingSenator,source.person);
  assert.equal(snippet.byOriginalCaptureUtcVerified,true);
  assert.equal(snippet.originalFirstAuthorDateRequired,false);
  assert.equal(snippet.candidatePersonalVerbatimSpeechOrActualLegislativeVoteProven,false);
  assert.equal(snippet.autoAdmittedToProductionOrForecast,false);
  assert.ok(families.has(snippet.issueFamily));
  assert.ok(snippet.exactVisibleFirstPartyCampaignExcerpt.length>=8);
  assert.ok(snippet.exactVisibleFirstPartyCampaignExcerpt.length<=130);
 }
});
test('short Ron and Jim forenames do NOT convert first-page heuristic false into disproof of candidate original HTML',()=>{
 const ron=pages.allAuthenticatedOriginal2022SourcePages.filter(x=>x.person==='Ron Latz');
 const jim=pages.allAuthenticatedOriginal2022SourcePages.filter(x=>x.person==='Jim Carlson');
 assert.equal(ron.length,4);
 assert.equal(jim.length,4);
 assert.ok([...ron,...jim].every(p=>p.acquisitionCandidateSurnameHeuristic===false));
 assert.equal(pages.scope.sourceDatesAreActualArchiveCaptureUtc,true);
 assert.equal(excerpts.scope.legacySDOr2020PageWordingNotFresh2022Authorship,true);
});
test('real source policy audit requires exact original full official service source and complete authentic original Wayback source manifest',()=>{
 const gov=government();
 assert.throws(()=>auditFiveNewActuallyServedSenators97ArchiveDatedPolicyExcerpts(
  {...gov,source:{...gov.source,sourceBytesSha256:'0'.repeat(64)}},{},{}),
 /Original independent official Minnesota Senate SERVICE directory/);
 assert.throws(()=>auditFiveNewActuallyServedSenators97ArchiveDatedPolicyExcerpts(
  gov,{},{}),
 /Original 2022 Senate campaign Wayback acquisition manifested source totals/);
});
test('independent original offline source runner refuses no original evidence and never creates report',()=>{
 const dir=mkdtempSync(join(tmpdir(),'six-served-five-issues-97-'));
 try{
  const output=join(dir,'source-proof-not-invented.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-five-new-2022-senators-97-original-policy-excerpts-offline.ts',
   '--output',output,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(output),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

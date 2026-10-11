import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import corpus from '../data/evaluation/senate-capture-dated-original-2020-22-campaign-issue-excerpts-v1.json' with {type:'json'};
import pages from '../data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json' with {type:'json'};
import {ISSUE_POSITION_FAMILIES} from '../src/evidence/issue-position-extractor.js';
import {
 MN_SENATOR_CAPTURE_DATED_109_ORIGINAL_POLICY_EXCERPTS_VERSION,
 auditCaptureDated109ActualSenatorOriginalCampaignExcerpts,
} from '../src/evidence/senate-capture-dated-2020-22-original-campaign-109-excerpts.js';

test('109 actually-capture-dated original first-party issue excerpts, twelve proven senators, not alleged first-author dates',()=>{
 assert.match(MN_SENATOR_CAPTURE_DATED_109_ORIGINAL_POLICY_EXCERPTS_VERSION,/109/);
 assert.equal(corpus.scope.issue,864);
 assert.equal(corpus.pages.length,14);
 assert.equal(corpus.statements.length,109);
 assert.equal(corpus.scope.actualSenateServedPeople,12);
 assert.equal(corpus.scope.source2022Pages,12);
 assert.equal(corpus.scope.source2020Pages,2);
 assert.equal(corpus.scope.archivedAsOfDateUsedAsAttributableDate,true);
 assert.equal(corpus.scope.originalFirstAuthorPublicationDayNeeded,false);
 assert.equal(corpus.scope.forecastFeaturesAutoAdmitted,0);
 assert.equal(corpus.scope.productionDatabaseReadsAndWrites,0);
 assert.equal(new Set(corpus.pages.map(p=>p.pageId)).size,14);
 assert.equal(new Set(corpus.pages.map(p=>p.senator)).size,12);
 assert.equal(new Set(corpus.statements.map(p=>p.id)).size,109);
 const permitted=new Set<string>(ISSUE_POSITION_FAMILIES);
 assert.ok(corpus.statements.every(x=>
  permitted.has(x.issueFamily)
  &&x.exactShortExcerpt.length>=8&&x.exactShortExcerpt.length<=130
  &&x.exactOriginalVisibleTextMustContainExcerpt
  &&x.historicalModelEvidenceAutoEligible===false
  &&x.claimOfPriorLegislativeActivityNotVerifiedVote===true));
});
test('source per-statement public-by dates must equal real independent archive receipts; never election day or 2026 retrieval',()=>{
 const byId=new Map(corpus.pages.map(p=>[p.pageId,p]));
 let older=0;
 for(const q of corpus.statements){
  const source=byId.get(q.sourcePageId);
  assert.ok(source);
  assert.equal(q.senator,source.senator);
  assert.equal(q.sourceHtmlCapturedAtUtc,source.originalCampaignSiteCaptureAtUtc);
  assert.ok(q.attributableNoLaterThanUtc<=q.sourceHtmlCapturedAtUtc);
  assert.ok(q.attributableNoLaterThanUtc<
   (source.electionYear===2022?'2022-11-08T00:00:00.000Z':'2020-11-03T00:00:00.000Z'));
  const realPage=pages.pages.find(p=>p.sourceFile===source.originalSourceFile);
  assert.ok(realPage);
  assert.equal(source.actualOriginalHtmlSha256,realPage.originalHtmlSha256);
  assert.equal(source.independentlyIndexedCdxPayloadSha1Base32,
   realPage.independentHistoricalCdxPayloadSha1Base32);
  if(q.earlierIdenticalExcerptOriginalPageId){
   const prior=byId.get(q.earlierIdenticalExcerptOriginalPageId);
   assert.ok(prior);
   assert.equal(prior.senator,q.senator);
   assert.equal(q.attributableNoLaterThanUtc,prior.originalCampaignSiteCaptureAtUtc);
   assert.ok(q.attributableNoLaterThanUtc<source.originalCampaignSiteCaptureAtUtc);
   older++;
  }else assert.equal(q.attributableNoLaterThanUtc,source.originalCampaignSiteCaptureAtUtc);
 }
 assert.equal(older,9);
});
test('retain vital attribution qualifiers for different-district earlier material but date genuine historic HTML',()=>{
 const g22=corpus.pages.find(p=>p.pageId==='gary22');
 const g20=corpus.pages.find(p=>p.pageId==='gary20');
 const l=corpus.pages.find(p=>p.pageId==='liz22');
 const m20=corpus.pages.find(p=>p.pageId==='mary20');
 const r=corpus.pages.find(p=>p.pageId==='rob22');
 assert.ok(g22&&g20&&l&&m20&&r);
 assert.equal(g22.campaignCycleContext,
  'older_sd16_platform_copy_archived_during_2022_sd15_campaign');
 assert.equal(l.campaignCycleContext,
  '2022_senate_specific_issue_copy_under_legacy_house_25b_page_title');
 assert.equal(g20.electionYear,2020);
 assert.equal(m20.originalCampaignSiteCaptureAtUtc,'2020-07-28T22:30:02.000Z');
 assert.equal(r.sourceOriginalUrl,'https://robfarnsworth.org/campaign/');
 assert.ok(corpus.statements.filter(s=>s.sourcePageId==='gary22').every(s=>
  s.statementCharacter==='older_site_platform_copy_available_on_capture_date'
  &&s.earlierIdenticalExcerptOriginalPageId==='gary20'));
 assert.equal(corpus.scope.olderCopyIsNotAutomaticallyNewCycleAdoption,true);
 assert.equal(corpus.scope.originalHistoricalFiledSOSDomainProven,false);
});
test('without original full HTML, genuine LRL service proofs and prior 68-source audit, no quotes admitted',()=>{
 assert.throws(()=>auditCaptureDated109ActualSenatorOriginalCampaignExcerpts(
  {schema:'fabricated',independentlyHashAndCdxVerifiedSourceCopies:68},
  {html2022:{},html2020:{}},
 ),/Original all-68 HTML source/);
 assert.throws(()=>auditCaptureDated109ActualSenatorOriginalCampaignExcerpts(
  {
   schema:'mn-senate-68-reopened-2020-22-original-campaign-page-digests-v1',
   independentlyHashAndCdxVerifiedSourceCopies:68,
   year2020OriginalPageCopies:24,year2022OriginalPageCopies:44,
   distinct2022ActuallyServedSenatorPeople:12,originalSources:[],
  },
  {html2022:{},html2020:{}},
 ),/Original all-68 HTML source/);
});
test('quote auditor CLI refuses no source arguments rather than faking a historical statement/date',()=>{
 const dir=mkdtempSync(join(tmpdir(),'senate109-dated-html-'));
 try{
  const result=join(dir,'unauthorized-report.json');
  assert.throws(()=>execFileSync('node',[
   '--import','tsx','scripts/audit-senate-109-capture-dated-campaign-excerpts-offline.ts',
   '--output',result,
  ],{timeout:15000,stdio:'pipe'}));
  assert.equal(existsSync(result),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

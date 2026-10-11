/** Public source-triage fixture only: NO original Wayback or privately authenticated article quote. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

interface Research {
  version:string;issue:number;parentIssue:number;researchCheckedAt:string;
  currentPublisher:{name:string;author:string;displayedDay:string;displayedClock:string;
    displayedClockTimezone:string|null;briefUrl:string;datedUrl:string;
    currentRedirectObservedOn:string;historicalWaybackCapture:string|null;
    articleOriginalSha256:string|null;originalArchiveBriefDatedSameBytesProven:boolean;
    firstPublishedAtVerified:boolean};
  officialBill:{url:string;session:string;senateBill:string;houseCompanion:string;
    currentPageBillText:string;listedAuthors:string[];
    actions:Array<{day:string;kind:string}>;floorPassageListed:boolean;
    articlePublicationProvenByBillAction:boolean};
  members:Array<{name:string;district:string;oathDay:string;url:string;
    inOfficeOnDisplayedDay:boolean;majorityLeaderSince?:string}>;
  speechLeads:Array<{name:string;classification:string;exactShortExcerpt?:string;
    reporterNamedSpeakerAndSaidPresent?:boolean;originalArchivedQuoteAuthenticated?:boolean;
    originalArchiveHumanReviewed?:boolean;senatorStanceInferred:boolean;
    externalPost?:string;originalSocialPostAuthenticated?:boolean;
    exactVerbatimQuoteInArticle?:boolean}>;
  houseSpeaker:{name:string;chamber:string;directSpeechOnCurrentArticle:boolean;attributedToSenator:boolean};
  evidenceBoundary:Record<string,boolean|number>;
}
const d=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2024-north-star-current-speech-official-crosscheck.json','utf8'
)) as Research;

test('official 2023 bill chronology is verified independently of 2024 newsroom timestamp',()=>{
  assert.equal(d.version,'senate-media-2024-north-star-public-senator-speech-triage-v1');
  assert.deepEqual([d.issue,d.parentIssue,d.researchCheckedAt],[946,912,'2026-10-10']);
  const b=d.officialBill;
  assert.equal(b.url,'https://www.revisor.mn.gov/bills/93/2023/0/SF/2724/');
  assert.deepEqual([b.senateBill,b.houseCompanion,b.currentPageBillText],['SF2724','HF2860','As Introduced']);
  assert.deepEqual(b.listedAuthors,['Fateh','Pha']);
  assert.deepEqual(b.actions.map(x=>x.day),['2023-03-08','2023-03-14','2023-04-03']);
  assert.equal(b.floorPassageListed,false);
  assert.equal(b.articlePublicationProvenByBillAction,false);
  assert.equal(new URL(b.url).hostname,'www.revisor.mn.gov');
  assert.equal(d.currentPublisher.displayedDay,'2024-02-12');
});

test('every article-named senator is an actual 2023-2024 serving senator, not a House official',()=>{
  assert.deepEqual(d.members.map(x=>x.name).sort(),['Erin P. Murphy','Grant Hauschild','Omar Fateh']);
  assert.deepEqual(d.members.map(x=>x.district).sort(),['03','62','64']);
  for(const m of d.members){
    assert.equal(m.oathDay,'2023-01-03');
    assert.equal(m.inOfficeOnDisplayedDay,true);
    assert.equal(new URL(m.url).hostname,'www.lrl.mn.gov');
  }
  assert.equal(d.members.find(m=>m.name==='Erin P. Murphy')?.majorityLeaderSince,'2024-02-06');
  assert.equal(d.houseSpeaker.name,'Melissa Hortman');
  assert.equal(d.houseSpeaker.chamber,'House');
  assert.equal(d.houseSpeaker.directSpeechOnCurrentArticle,true);
  assert.equal(d.houseSpeaker.attributedToSenator,false);
});

test('separate current-page named direct speech from reporter paraphrase and bill authorship',()=>{
  assert.equal(d.currentPublisher.name,'Minnesota Reformer');
  assert.equal(d.currentPublisher.author,'Deena Winter');
  assert.equal(d.currentPublisher.displayedClock,'16:10');
  assert.equal(d.currentPublisher.displayedClockTimezone,null);
  assert.equal(d.currentPublisher.currentRedirectObservedOn,'2026-10-10');
  assert.ok(d.currentPublisher.briefUrl.startsWith('https://minnesotareformer.com/briefs/'));
  assert.ok(d.currentPublisher.datedUrl.startsWith('https://minnesotareformer.com/2024/02/12/'));
  const leads=d.speechLeads;
  assert.equal(leads.length,3);
  const murphy=leads.find(x=>x.name==='Erin P. Murphy');
  assert.equal(murphy?.classification,'newsroom_current_page_direct_senator_speech_candidate');
  assert.equal(murphy?.exactShortExcerpt,'I think it’s important that we rely on the committee process');
  assert.equal(murphy?.reporterNamedSpeakerAndSaidPresent,true);
  assert.equal(murphy?.originalArchivedQuoteAuthenticated,false);
  assert.equal(murphy?.originalArchiveHumanReviewed,false);
  const hauschild=leads.find(x=>x.name==='Grant Hauschild');
  assert.equal(hauschild?.classification,'reporter_paraphrase_of_external_social_media_post');
  assert.equal(hauschild?.externalPost,'https://twitter.com/grant_hauschild/status/1756375725714571676');
  assert.equal(hauschild?.originalSocialPostAuthenticated,false);
  assert.equal(hauschild?.exactVerbatimQuoteInArticle,false);
  const fateh=leads.find(x=>x.name==='Omar Fateh');
  assert.equal(fateh?.classification,'senate_bill_author_named_without_direct_speech');
  assert.equal(fateh?.exactVerbatimQuoteInArticle,false);
  assert.ok(leads.every(x=>x.senatorStanceInferred===false));
});

test('source research cannot masquerade as archived news, reviewed senator quotes, or forecast proof',()=>{
  assert.equal(d.currentPublisher.historicalWaybackCapture,null);
  assert.equal(d.currentPublisher.articleOriginalSha256,null);
  assert.equal(d.currentPublisher.originalArchiveBriefDatedSameBytesProven,false);
  assert.equal(d.currentPublisher.firstPublishedAtVerified,false);
  const p=d.evidenceBoundary;
  for(const key of [
    'historicalWaybackArticleOriginalFetched','historicalFirstPublicByVerified',
    'storedPrivateSourceDocumentShaMatched','briefDatedOriginalBytesProvenIdentical',
    'independentHauschildSocialPostRetrieved','houseSpeakerAttributedToSenator',
    'billAuthorshipTreatedAsNewsroomSpeech','reportedExternalParaphraseCountedAsSenatorQuote',
    'currentPublisherClockInterpretedAsUTC','historicalForecastEligibilityProven',
    'databaseQueriedOrWritten','productionCollectorOrModelChanged','statewideMediaDenominatorKnown',
  ]) assert.equal(p[key],false,'Unproved media source promotion: '+key);
  assert.equal(p.verifiedOriginalNamedSenatorQuotes,0);
  assert.equal(p.humanOriginalSourceReviews,0);
  assert.equal(p.officialServiceMembershipOnArticleDisplayedDayVerified,true);
  assert.equal(p.officialBillActionsVerified,true);
  assert.equal(p.sourceIsCurrentPublisherNotHistoricalArchive,true);
  assert.equal(Object.hasOwn(d,'privateSourceDocumentId'),false);
});

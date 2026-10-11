/** Official 2025 event-source checkpoint, NOT authenticated media/Wayback evidence. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

interface PublicOfficialCrosscheck {
  version:string;
  issue:number;
  parentIssue:number;
  researchCheckedAt:string;
  researchedMedia:{
    publisher:string;displayedPublicationDay:string;publicUrlCandidates:string[];
    identicalOriginalArchivedArticleBytesProven:boolean;
    publicationDateHistoricallyPublicByProven:boolean;
    newsroomQuoteReviewed:boolean;
  };
  independentlyVerifiedLegislativeProceeding:{
    eventDay:string;MinnesotaSenateJournalUrl:string;
    MinnesotaSenateAmendmentUrl:string;
    journalDayNumber:number;
    journalPrintedPageStart:number;journalPrintedPageEnd:number;
    pdfZeroIndexedPages:number[];
    bill:string;companionBill:string;amendment:string;
    introducedBy:string;recordedYeas:number;recordedNays:number;adopted:boolean;
    senateMembersNamedInRoll:Array<{name:string;journalSurname:string;side:string}>;
    officialJournalOrAmendmentOriginalByteSha256Captured:boolean;
    officialProceedingDateIsHistoricalMediaPublicByProof:boolean;
  };
  evidenceBoundary:Record<string,boolean>;
}
const data=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2025-road-signs-official-proceedings-crosscheck.json','utf8',
)) as PublicOfficialCrosscheck;

test('official May 1 Senate roll call is separately dated and source-linked, not merely a newspaper assertion',()=>{
  assert.equal(data.version,'senate-media-public-official-proceedings-crosscheck-v1');
  assert.equal(data.issue,946);
  assert.equal(data.parentIssue,912);
  assert.equal(data.researchCheckedAt,'2026-10-10');
  const s=data.independentlyVerifiedLegislativeProceeding;
  assert.equal(s.eventDay,'2025-05-01');
  assert.equal(new Date(s.eventDay+'T00:00:00Z').toISOString().slice(0,10),s.eventDay);
  assert.equal(data.researchedMedia.displayedPublicationDay,s.eventDay);
  assert.equal(s.journalDayNumber,29);
  assert.deepEqual(s.pdfZeroIndexedPages,[26,27,28]);
  assert.equal(s.journalPrintedPageStart,4354);
  assert.equal(s.journalPrintedPageEnd,4357);
  assert.equal(s.MinnesotaSenateJournalUrl,
    'https://www.senate.mn/journals/2025-2026/20250501029.pdf');
  assert.equal(s.MinnesotaSenateAmendmentUrl,
    'https://www.senate.mn/chamber/amendment/sch2438a-4.html');
  for(const url of [s.MinnesotaSenateJournalUrl,s.MinnesotaSenateAmendmentUrl]){
    const parsed=new URL(url);
    assert.equal(parsed.protocol,'https:');
    assert.equal(parsed.hostname,'www.senate.mn');
  }
  assert.equal(s.bill,'HF2438');
  assert.equal(s.companionBill,'SF2082');
  assert.equal(s.amendment,'A-4');
  assert.equal(s.introducedBy,'Steve Drazkowski');
  assert.deepEqual([s.recordedYeas,s.recordedNays,s.adopted],[31,34,false]);
  assert.deepEqual(s.senateMembersNamedInRoll,[
    {name:'Steve Drazkowski',journalSurname:'Drazkowski',side:'yea'},
    {name:'Ann Johnson Stewart',journalSurname:'Johnson Stewart',side:'nay'},
  ]);
});

test('media URLs remain alias candidates with no historical availability, reporter quote or forecast claim',()=>{
  assert.equal(data.researchedMedia.publisher,'Minnesota Reformer');
  const urls=data.researchedMedia.publicUrlCandidates;
  assert.equal(urls.length,2);
  assert.ok(urls[0]!.startsWith('https://minnesotareformer.com/briefs/'));
  assert.ok(urls[1]!.startsWith('https://minnesotareformer.com/2025/05/01/'));
  assert.equal(urls[0]!.split('/').at(-2),urls[1]!.split('/').at(-2));
  assert.equal(data.researchedMedia.identicalOriginalArchivedArticleBytesProven,false);
  assert.equal(data.researchedMedia.publicationDateHistoricallyPublicByProven,false);
  assert.equal(data.researchedMedia.newsroomQuoteReviewed,false);
  assert.equal(data.independentlyVerifiedLegislativeProceeding.officialJournalOrAmendmentOriginalByteSha256Captured,false);
  assert.equal(data.independentlyVerifiedLegislativeProceeding.officialProceedingDateIsHistoricalMediaPublicByProof,false);
  const claims=data.evidenceBoundary;
  for(const key of [
    'historicalWaybackCaptureProven','publisherFirstPublicByProven',
    'articleOriginalSha256Verified','privateVotePredictSourceDocumentMatched',
    'senatorDirectQuoteHumanVerified','newsParaphraseConvertedToSenatorStatement',
    'historicalPredictionEligible','directVoteModelOrProductionMutation',
  ]) assert.equal(claims[key],false,'Unproven advancement was claimed: '+key);
  assert.equal(claims.noStatewideArticleDenominator,true);
  assert.equal(Object.hasOwn(data,'privateSourceDocumentId'),false);
  assert.equal(Object.hasOwn(data,'directSenatorQuote'),false);
});

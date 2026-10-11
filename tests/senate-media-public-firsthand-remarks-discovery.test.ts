/** #987/#946: bounded PUBLIC media remark discovery, never a quote/forecast proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

type Row = {
  id:string;
  sourceUrl:string;
  publisher:string;
  displayedPublisherDates:string[];
  topicForResearch:string;
  publicPagePresentation:string;
  individualSenatorSpeaker:string|null;
  officialMemberHistoryUrl:string|null;
  senateServiceOnDisplayedPublicationDayCorroboratedByOfficialHistory:boolean;
  otherPeopleAreNotAttributedThisSpeakerTurn:true;
  currentPublicPageContainsNamedDirectSpeechCandidate:boolean;
  exactHistoricalOriginalCaptureAndBodyHashVerified:false;
  initialPublicationTimeOrHistoricalVersionVerified:false;
  individualHistoricalSenatorQuotationHumanApproved:false;
  recordedLegislativeVoteInferred:false;
  contextualOnlyNamedSenators?:string[];
  secondaryReportedSenatorQuotationNames?:string[];
  underlyingMillerNovember15InterviewOriginalPageUrl?:string;
  underlyingMillerNovember15InterviewOriginalHistoricalCaptureAuthenticated?:false;
  collectiveSenatorNamesListed?:string[];
  collectiveOtherLawmakersListed?:string[];
  officialTermBegins?:string;
  originalSpokenAudioIndependentlyCompared?:false;
  firstPartyInterviewPageContainsAudioPlayer?:true;
};
type Ledger = {
  version:string;
  researchObservedOn:string;
  studyYears:number[];
  publisherDisplayedDatesAreNotVerifiedFirstPublicationTimes:true;
  historicalOriginalCaptureSha256AuthenticatedForTheseNewLeads:false;
  noPrivateDatabaseOrSourceDocumentsAccessed:true;
  noAutomaticQuoteOrVoteOrForecastPromotion:true;
  statewideSenatorYearMediaCoverageDenominatorUnknown:true;
  selectedNewPublicSourcePages:Row[];
};
const data=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json',
  'utf8',
)) as Ledger;
const rows=data.selectedNewPublicSourcePages;

test('18 non-exhaustive original-publisher media remark pages cover each of 2021–25 without changing the prior 31',()=>{
  assert.equal(data.version,'senate-media-2021-25-public-firsthand-remarks-discovery-v1');
  assert.equal(data.researchObservedOn,'2026-10-11');
  assert.deepEqual(data.studyYears,[2021,2022,2023,2024,2025]);
  assert.equal(rows.length,18);
  assert.deepEqual([2021,2022,2023,2024,2025].map(year=>rows.filter(
    row=>row.displayedPublisherDates[0]?.startsWith(String(year))).length),[4,3,4,3,4]);
  assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
  assert.equal(new Set(rows.map(x=>x.sourceUrl)).size,rows.length);
  assert.equal(rows.filter(x=>x.individualSenatorSpeaker!==null).length,16);
  assert.equal(rows.filter(x=>x.individualSenatorSpeaker===null).length,2);
  assert.equal(new Set(rows.map(x=>x.individualSenatorSpeaker).filter(Boolean)).size,13);
});

test('caucus-quoted, original Q&A, and collective remarks never conflate speaker attribution',()=>{
  for(const row of rows){
    assert.match(row.id,/^(caucus|enterprise|mpr)-20(?:21|22|23|24|25)-[a-z0-9-]+$/);
    assert.ok(row.topicForResearch.length>20);
    assert.equal(row.otherPeopleAreNotAttributedThisSpeakerTurn,true);
    assert.ok(row.displayedPublisherDates.length===1||row.displayedPublisherDates.length===2);
    for(const day of row.displayedPublisherDates){
      assert.match(day,/^20(?:21|22|23|24|25)-\d\d-\d\d$/);
      assert.equal(new Date(day+'T00:00:00Z').toISOString().slice(0,10),day);
    }
    const host=new URL(row.sourceUrl).hostname;
    assert.equal(new URL(row.sourceUrl).protocol,'https:');
    assert.equal(new URL(row.sourceUrl).search,'');
    assert.equal(new URL(row.sourceUrl).hash,'');
    assert.ok(
      (host==='senatedfl.mn'&&row.publisher==='Minnesota Senate DFL') ||
      (host==='www.mnsenaterepublicans.com'&&row.publisher==='Minnesota Senate Republicans') ||
      (host==='www.enterpriseminnesota.org'&&row.publisher==='Enterprise Minnesota') ||
      (host==='www.mprnews.org'&&row.publisher==='MPR News'),
    );
    if(row.individualSenatorSpeaker!==null){
      assert.match(row.individualSenatorSpeaker,/^[\p{Lu}][\p{L} .'-]+ [\p{Lu}][\p{L} .'-]+$/u);
      assert.match(row.officialMemberHistoryUrl??'',/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/);
      assert.equal(row.senateServiceOnDisplayedPublicationDayCorroboratedByOfficialHistory,true);
      assert.equal(row.currentPublicPageContainsNamedDirectSpeechCandidate,true);
      assert.ok([
        'caucus_release_named_direct_quotation',
        'original_publisher_qa_speaker_labeled_answers',
        'original_news_publisher_interview_reporter_attributed_quotation',
      ].includes(row.publicPagePresentation));
    }else{
      assert.equal(row.officialMemberHistoryUrl,null);
      assert.equal(row.senateServiceOnDisplayedPublicationDayCorroboratedByOfficialHistory,false);
      assert.equal(row.currentPublicPageContainsNamedDirectSpeechCandidate,false);
      assert.ok(row.publicPagePresentation.startsWith('collective_'));
      assert.ok((row.collectiveSenatorNamesListed?.length??0)>=1);
    }
    assert.equal(row.exactHistoricalOriginalCaptureAndBodyHashVerified,false);
    assert.equal(row.initialPublicationTimeOrHistoricalVersionVerified,false);
    assert.equal(row.individualHistoricalSenatorQuotationHumanApproved,false);
    assert.equal(row.recordedLegislativeVoteInferred,false);
    assert.equal(Object.hasOwn(row,'quoteText'),false);
    assert.equal(Object.hasOwn(row,'waybackCaptureUtc'),false);
    assert.equal(Object.hasOwn(row,'sourceDocumentId'),false);
  }
  assert.equal(rows.filter(x=>x.publicPagePresentation==='original_publisher_qa_speaker_labeled_answers').length,1);
  assert.equal(rows.filter(x=>x.publicPagePresentation==='original_news_publisher_interview_reporter_attributed_quotation').length,1);
});

test('original published press releases keep important false-positive guardrails',()=>{
  const byId=new Map(rows.map(x=>[x.id,x]));
  const marty=byId.get('caucus-2021-marty-malcolm')!;
  assert.equal(marty.individualSenatorSpeaker,'John Marty');
  assert.deepEqual(marty.secondaryReportedSenatorQuotationNames,['Jeremy Miller']);
  assert.equal(marty.underlyingMillerNovember15InterviewOriginalPageUrl,
    'https://www.mprnews.org/episode/2021/11/15/minnesota-senate-majority-leader-talks-bipartisan-effort-to-distribute-hero-pay');
  assert.equal(marty.underlyingMillerNovember15InterviewOriginalHistoricalCaptureAuthenticated,false);
  const originalMpr=byId.get('mpr-2021-miller-hero-pay-interview')!;
  assert.equal(originalMpr.individualSenatorSpeaker,'Jeremy Miller');
  assert.equal(originalMpr.firstPartyInterviewPageContainsAudioPlayer,true);
  assert.equal(originalMpr.originalSpokenAudioIndependentlyCompared,false);
  assert.equal(originalMpr.sourceUrl,marty.underlyingMillerNovember15InterviewOriginalPageUrl);

  const miller=byId.get('enterprise-2021-miller-manufacturing-interview')!;
  assert.equal(miller.individualSenatorSpeaker,'Jeremy Miller');
  assert.equal(miller.originalSpokenAudioIndependentlyCompared,false);
  assert.notEqual(miller.sourceUrl,marty.sourceUrl);

  const group2023=byId.get('caucus-2023-poci-joint-policing')!;
  assert.equal(group2023.individualSenatorSpeaker,null);
  assert.equal(group2023.collectiveSenatorNamesListed?.length,10);
  const joint2025=byId.get('caucus-2025-rochester-multi-chamber-joint')!;
  assert.equal(joint2025.individualSenatorSpeaker,null);
  assert.equal(joint2025.collectiveOtherLawmakersListed?.length,3);

  const clark=byId.get('caucus-2025-clark-oath-statement')!;
  assert.equal(clark.officialTermBegins,'2025-02-03');
  assert.ok(clark.contextualOnlyNamedSenators?.includes('Kari Dziedzic'));
  assert.deepEqual(byId.get('caucus-2024-marty-sports-betting')?.displayedPublisherDates,
    ['2024-01-24','2024-01-26']);

  assert.equal(data.publisherDisplayedDatesAreNotVerifiedFirstPublicationTimes,true);
  assert.equal(data.historicalOriginalCaptureSha256AuthenticatedForTheseNewLeads,false);
  assert.equal(data.noPrivateDatabaseOrSourceDocumentsAccessed,true);
  assert.equal(data.noAutomaticQuoteOrVoteOrForecastPromotion,true);
  assert.equal(data.statewideSenatorYearMediaCoverageDenominatorUnknown,true);
});

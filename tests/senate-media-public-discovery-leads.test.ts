/**
 * #912 Track D: publisher-page discoveries are publicly researched leads,
 * NEVER VotePredict evidence, authenticated Wayback bytes or human-verified
 * senator quotations. Detect article URL paths unreachable by the current
 * bounded Wayback seed prefix without assuming statewide incompleteness counts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LOCAL_TRADE_NEWS_SEEDS } from '../src/evidence/local-trade-news-history.js';

type PublicLead = {
  id:string;
  publisher:string;
  seedId:string;
  livePageUrl:string;
  publicationDayDisplayedOnPublicPage:string;
  searchTopicOnly:string;
  namedSenatorLeadsForManualReview:string[];
  evidenceDisposition:string;
  sourceSeenInVotePredictExport:string;
  originalArchivedHttpBytesHashVerified:boolean;
  archiveCapturePublicByVerified:boolean;
  historicalForecastEligibilityProven:boolean;
  membershipOnPublicationDateVerified:boolean;
  directQuoteHumanVerified:boolean;
  issueStanceInferred:boolean;
  urlInsideCurrentSeedPrefix:boolean;
  sourceResearchCheckedOn?:string;
  currentPublisherRedirectTargetObserved?:string;
  currentPublisherRedirectSourceUrl?:string;
  currentPublisherRedirectCheckedOn?:string;
  currentPublisherRedirectProvesHistoricArchiveAlias?:boolean;
  currentPublisherDisplayedAuthor?:string;
  currentPublisherDisplayedClockWithoutVerifiedTimezone?:string;
  publisherClockIsHistoricalPublicByProof?:boolean;
  noHouseSpeakerQuoteAttributedToSenator?:boolean;
  officialLegislativeActionSource?:string;
  officialLegislativeActionDayAsRecorded?:string;
  eventClockTimeFromOriginalSenateJournalVerified?:boolean;
  presentPublisherPageTemporalOrderingVerified?:boolean;
  memberEverServedSenateVerified?:boolean;
  officialSenateServiceStart?:string;
  officialServiceSource?:string;
  senateMemberOnDisplayedPublicationDay?:boolean;
  officialSenateHistorySource?:string;
  officialSenateOathDay?:string;
  senatorServiceOnDisplayedPublisherDayIndependentlyCorroborated?:boolean;
  currentPublisherDisplayedClock?:string;
  publisherClockTimezoneIndependentlyVerified?:boolean;
  currentPublisherShow?:string;
  currentPageContainsAudioPlayer?:boolean;
  currentPageContainsSpeakerLabeledTranscript?:boolean;
  currentPageHostSpeakerLabel?:string;
  currentPageSenatorSpeakerLabel?:string;
  currentPageDirectSpeechShortResearchExcerpt?:string;
  archivedTranscriptByteEqualityAndAvailabilityVerified?:boolean;
  historicalAudioBytesAndAvailabilityVerified?:boolean;
  originalSpeakerAudioComparedToTranscript?:boolean;
  mediaInterviewSpeakerHumanReviewedFromOriginalArchive?:boolean;
  actualSpokenWordsOnHistoricalCutoffIndependentlyVerified?:boolean;
  productionSeedChanged?:boolean;
  verifiedServingSenatorHistorySources?:Array<{name:string;officialLrlUrl:string;serviceOnPublisherDisplayedDay:boolean}>;
  currentPublisherClockTimezoneVerified?:boolean;
  firstPartyAudioInterviewPublisherDescriptionVerified?:boolean;
  currentTextAndSpeakerProofKind?:string;
  currentPageDirectSpeechShortResearchExcerpt?:string|null;
  originalSpeakerAudioAndCurrentTranscriptMatched?:boolean;
  originalHistoricalAudioAndTranscriptAvailabilityVerified?:boolean;
  archivedPublisherVersionAndDateProofVerified?:boolean;
  historicalOriginalHumanQuoteReviewed?:boolean;
  wasCurrentPageTextPresentBeforeAnyHistoricalVoteCutoffVerified?:boolean;
  noAutomaticallyInferredSenatorStance?:boolean;
};
type Ledger = {
  version:string;
  studyYears:number[];
  selectedNonExhaustiveArticleLeads:PublicLead[];
  sourceUniverseCompletenessKnown:boolean;
  stateSenateOnly:boolean;
  publisherYearSlotsInOriginal44SeedReview:number;
  seedPrefixDiscoveryComparison:{
    publisherSeedsChecked:string[];
    calculatedAgainstCheckedInSeedUrls:boolean;
    outsideSeedPrefixLeadCount:number;
    criticalLimitation:string;
  };
};
const data=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8',
)) as Ledger;

test('curated publicly observed leads cover all five study years, two publishers and distinct URLs',()=>{
  assert.equal(data.version,'senate-media-public-discovery-leads-v1');
  assert.deepEqual(data.studyYears,[2021,2022,2023,2024,2025]);
  assert.equal(data.stateSenateOnly,true);
  assert.equal(data.sourceUniverseCompletenessKnown,false);
  assert.equal(data.publisherYearSlotsInOriginal44SeedReview,220);
  const leads=data.selectedNonExhaustiveArticleLeads;
  assert.equal(leads.length,31);
  assert.equal(new Set(leads.map(x=>x.id)).size,leads.length);
  assert.equal(new Set(leads.map(x=>x.livePageUrl)).size,leads.length);
  assert.deepEqual([...new Set(leads.map(x=>x.publisher))].sort(),[
    'MPR News','Minnesota Reformer',
  ]);
  for(const year of data.studyYears)
    assert.ok(leads.filter(x=>x.publicationDayDisplayedOnPublicPage.startsWith(String(year))).length>=2);
});

test('the live publication day and senator-name leads never imply archived evidence, stance or forecast eligibility',()=>{
  const seeds=new Map(LOCAL_TRADE_NEWS_SEEDS.map(seed=>[seed.id,seed]));
  const expectedNames=new Set(['MPR News','Minnesota Reformer']);
  for(const item of data.selectedNonExhaustiveArticleLeads){
    const day=item.publicationDayDisplayedOnPublicPage;
    assert.match(day,/^20(?:21|22|23|24|25)-\d{2}-\d{2}$/);
    assert.equal(new Date(day+'T00:00:00Z').toISOString().slice(0,10),day);
    assert.ok(item.id.length>=10);
    assert.ok(item.searchTopicOnly.length>2);
    assert.ok(item.namedSenatorLeadsForManualReview.length>0);
    assert.ok(item.namedSenatorLeadsForManualReview.every(name=>
      /^\p{Lu}[\p{L} .'-]* \p{Lu}[\p{L} .'-]*$/u.test(name)));
    assert.ok(expectedNames.has(item.publisher));
    const seed=seeds.get(item.seedId);
    assert.ok(seed && seed.publisher===item.publisher && seed.prefix===true);
    const u=new URL(item.livePageUrl);
    const seedUrl=new URL(seed.url);
    assert.equal(u.protocol,'https:');
    assert.equal(u.username,'');
    assert.equal(u.password,'');
    assert.equal(u.hash,'');
    assert.equal(u.search,'');
    assert.equal(u.hostname,seedUrl.hostname);
    assert.equal(item.urlInsideCurrentSeedPrefix,item.livePageUrl.startsWith(seed.url));
    assert.equal(item.evidenceDisposition,'public_article_discovery_only');
    assert.equal(item.sourceSeenInVotePredictExport,'unknown_not_reconciled');
    assert.equal(item.originalArchivedHttpBytesHashVerified,false);
    assert.equal(item.archiveCapturePublicByVerified,false);
    assert.equal(item.historicalForecastEligibilityProven,false);
    assert.equal(item.membershipOnPublicationDateVerified,false);
    assert.equal(item.directQuoteHumanVerified,false);
    assert.equal(item.issueStanceInferred,false);
    assert.equal(Object.hasOwn(item,'exactQuote'),false);
    assert.equal(Object.hasOwn(item,'sourceDocumentId'),false);
    assert.equal(Object.hasOwn(item,'sourceSha256'),false);
  }
});

test('Reformer /briefs/ and MPR /episode/ links expose independent current seed-prefix gaps',()=>{
  const source=data.selectedNonExhaustiveArticleLeads;
  const outside=source.filter(x=>!x.urlInsideCurrentSeedPrefix);
  assert.equal(outside.length,16);
  assert.equal(data.seedPrefixDiscoveryComparison.outsideSeedPrefixLeadCount,outside.length);
  assert.deepEqual(data.seedPrefixDiscoveryComparison.publisherSeedsChecked,[
    'minnesota-reformer-article-archive','mpr-news-story-archive',
  ]);
  assert.equal(data.seedPrefixDiscoveryComparison.calculatedAgainstCheckedInSeedUrls,true);
  const reformer=outside.filter(x=>x.publisher==='Minnesota Reformer');
  const mpr=outside.filter(x=>x.publisher==='MPR News');
  assert.equal(reformer.length,10);
  assert.equal(mpr.length,6);
  assert.ok(reformer.every(x=>new URL(x.livePageUrl).pathname.startsWith('/briefs/')));
    assert.ok(mpr.some(x=>x.id==='mpr-2024-hauschild-north-star-on-air-interview'));
  assert.ok(mpr.every(x=>x.livePageUrl.startsWith('https://www.mprnews.org/episode/20')));
  assert.deepEqual([...new Set(mpr.map(x=>x.publicationDayDisplayedOnPublicPage.slice(0,4)))].sort(),
    ['2022','2023','2024','2025']);
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed=>
    seed.id==='mpr-news-story-archive' && seed.url==='https://www.mprnews.org/story/202'));
  assert.ok(outside.every(x=>x.livePageUrl.startsWith('https://minnesotareformer.com/202')===false
    && x.livePageUrl.startsWith('https://www.mprnews.org/story/202')===false));
  assert.deepEqual([...new Set(outside.map(x=>Number(x.publicationDayDisplayedOnPublicPage.slice(0,4))))].sort(),[2021,2022,2023,2024,2025]);
  assert.ok(data.seedPrefixDiscoveryComparison.criticalLimitation.includes('unknown'));
  // This audit DOES NOT change production ingestion seeds or make an all-media census.
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed=>
    seed.id==='minnesota-reformer-article-archive'
    && seed.url==='https://minnesotareformer.com/202'));
});


test('new 2022–2025 publisher leads have dated 2026 research observations without historical availability claims',()=>{
  const added=data.selectedNonExhaustiveArticleLeads.filter(x=>x.sourceResearchCheckedOn);
  assert.equal(added.length,17);
  assert.ok(added.every(x=>x.sourceResearchCheckedOn==='2026-10-10'));
  assert.ok(added.every(x=>x.archiveCapturePublicByVerified===false
    && x.originalArchivedHttpBytesHashVerified===false
    && x.historicalForecastEligibilityProven===false
    && x.sourceSeenInVotePredictExport==='unknown_not_reconciled'));
  assert.ok(added.some(x=>x.namedSenatorLeadsForManualReview.includes('Melisa López Franzen')));
  assert.ok(added.filter(x=>x.livePageUrl.includes('/briefs/')).length===6);
});

test('2025-04-30 Heintzeman discovery is ever-served only, not an April 30 incumbent quote',()=>{
  const row=data.selectedNonExhaustiveArticleLeads.find(x=>
    x.id==='mn-reformer-2025-special-election-brief');
  assert.ok(row);
  assert.equal(row.publicationDayDisplayedOnPublicPage,'2025-04-30');
  assert.deepEqual(row.namedSenatorLeadsForManualReview,['Keri Heintzeman']);
  assert.equal(row.memberEverServedSenateVerified,true);
  assert.equal(row.officialSenateServiceStart,'2025-05-06');
  assert.ok(row.officialSenateServiceStart>row.publicationDayDisplayedOnPublicPage);
  assert.equal(row.officialServiceSource,'https://www.lrl.mn.gov/timecapsule/session?lang=en');
  assert.equal(row.senateMemberOnDisplayedPublicationDay,false);
  assert.equal(row.membershipOnPublicationDateVerified,false);
  assert.equal(row.directQuoteHumanVerified,false);
});


test('2023 driver-licensing brief and dated alias retain unresolved after-midnight publication-order risk',()=>{
  const source=data.selectedNonExhaustiveArticleLeads;
  const brief=source.find(x=>x.id==='mn-reformer-2023-driver-licenses');
  const dated=source.find(x=>x.id==='mn-reformer-2023-driver-licenses-dated');
  assert.ok(brief && dated);
  assert.equal(brief.publicationDayDisplayedOnPublicPage,'2023-02-21');
  assert.equal(dated.publicationDayDisplayedOnPublicPage,brief.publicationDayDisplayedOnPublicPage);
  assert.equal(brief.urlInsideCurrentSeedPrefix,false);
  assert.equal(dated.urlInsideCurrentSeedPrefix,true);
  assert.equal(dated.sourceResearchCheckedOn,'2026-10-10');
  assert.equal(dated.officialLegislativeActionDayAsRecorded,'2023-02-21');
  assert.equal(dated.officialLegislativeActionSource,
    'https://www.revisor.mn.gov/bills/93/2023/0/HF/4/?body=Senate');
  assert.equal(dated.eventClockTimeFromOriginalSenateJournalVerified,false);
  assert.equal(dated.presentPublisherPageTemporalOrderingVerified,false);
  assert.equal(dated.archiveCapturePublicByVerified,false);
  assert.equal(dated.historicalForecastEligibilityProven,false);
  assert.equal(dated.directQuoteHumanVerified,false);
});

test('Feb 12 2024 Reformer /briefs/ redirect is a CURRENT observation, never archive proof',()=>{
  const brief=data.selectedNonExhaustiveArticleLeads.find(x=>x.id==='mn-reformer-2024-sanctuary-brief');
  const dated=data.selectedNonExhaustiveArticleLeads.find(x=>x.id==='mn-reformer-2024-sanctuary-dated');
  assert.ok(brief && dated);
  assert.equal(brief.urlInsideCurrentSeedPrefix,false);
  assert.equal(dated.urlInsideCurrentSeedPrefix,true);
  assert.equal(brief.publicationDayDisplayedOnPublicPage,'2024-02-12');
  assert.equal(dated.publicationDayDisplayedOnPublicPage,brief.publicationDayDisplayedOnPublicPage);
  assert.equal(brief.currentPublisherRedirectTargetObserved,dated.livePageUrl);
  assert.equal(brief.currentPublisherRedirectCheckedOn,'2026-10-10');
  assert.equal(dated.currentPublisherRedirectSourceUrl,brief.livePageUrl);
  assert.equal(dated.currentPublisherRedirectTargetObserved,dated.livePageUrl);
  assert.equal(dated.currentPublisherRedirectCheckedOn,'2026-10-10');
  assert.equal(dated.currentPublisherDisplayedAuthor,'Deena Winter');
  assert.equal(dated.currentPublisherDisplayedClockWithoutVerifiedTimezone,'16:10');
  assert.equal(dated.publisherClockIsHistoricalPublicByProof,false);
  assert.equal(dated.currentPublisherRedirectProvesHistoricArchiveAlias,false);
  assert.equal(dated.noHouseSpeakerQuoteAttributedToSenator,true);
  assert.equal(dated.originalArchivedHttpBytesHashVerified,false);
  assert.equal(dated.archiveCapturePublicByVerified,false);
  assert.equal(dated.directQuoteHumanVerified,false);
  assert.equal(dated.historicalForecastEligibilityProven,false);
  assert.equal(dated.sourceSeenInVotePredictExport,'unknown_not_reconciled');
  assert.ok(dated.namedSenatorLeadsForManualReview.every(n=>
    ['Grant Hauschild','Erin Murphy','Omar Fateh'].includes(n)));
});

test('Feb 19 2024 MPR /episode/ interview is an explicit senator audio-transcript lead, not Wayback evidence',()=>{
  const r=data.selectedNonExhaustiveArticleLeads.find(x=>
    x.id==='mpr-2024-hauschild-north-star-on-air-interview');
  assert.ok(r);
  assert.equal(r.publisher,'MPR News');
  assert.equal(r.seedId,'mpr-news-story-archive');
  assert.equal(r.publicationDayDisplayedOnPublicPage,'2024-02-19');
  assert.equal(r.livePageUrl,'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south');
  assert.equal(r.urlInsideCurrentSeedPrefix,false);
  assert.deepEqual(r.namedSenatorLeadsForManualReview,['Grant Hauschild']);
  assert.equal(r.currentPublisherShow,'Minnesota Now');
  assert.equal(r.currentPublisherDisplayedClock,'10:32 AM');
  assert.equal(r.publisherClockTimezoneIndependentlyVerified,false);
  assert.equal(r.currentPageContainsAudioPlayer,true);
  assert.equal(r.currentPageContainsSpeakerLabeledTranscript,true);
  assert.equal(r.currentPageHostSpeakerLabel,'CATHY WURZER');
  assert.equal(r.currentPageSenatorSpeakerLabel,'GRANT HAUSCHILD');
  assert.equal(r.currentPageDirectSpeechShortResearchExcerpt,
    'I feel that immigration is a federal issue.');
  assert.equal(r.officialSenateHistorySource,
    'https://www.lrl.mn.gov/legdb/fulldetail?id=15577');
  assert.equal(r.officialSenateOathDay,'2023-01-03');
  assert.equal(r.senatorServiceOnDisplayedPublisherDayIndependentlyCorroborated,true);
  // Membership on the DISPLAYED day is not independently verified ARTICLE publication.
  assert.equal(r.membershipOnPublicationDateVerified,false);
  for(const key of [
    'archivedTranscriptByteEqualityAndAvailabilityVerified',
    'historicalAudioBytesAndAvailabilityVerified',
    'originalSpeakerAudioComparedToTranscript',
    'mediaInterviewSpeakerHumanReviewedFromOriginalArchive',
    'actualSpokenWordsOnHistoricalCutoffIndependentlyVerified',
    'productionSeedChanged','originalArchivedHttpBytesHashVerified',
    'archiveCapturePublicByVerified','historicalForecastEligibilityProven',
    'directQuoteHumanVerified','issueStanceInferred',
  ] as const) assert.equal(r[key],false,'Unproven archive, quote or model advancement: '+key);
  assert.equal(r.sourceSeenInVotePredictExport,'unknown_not_reconciled');
  assert.equal(Object.hasOwn(r,'exactQuote'),false);
  assert.equal(Object.hasOwn(r,'sourceDocumentId'),false);
});


test('2021-25 first-party Minnesota MPR interviews stay typed by CURRENT page proof, not historic archive',()=>{
  const ids=[
    'mpr-2021-benson-vaccine-on-air',
    'mpr-2022-benson-kunesh-parental-curriculum',
    'mpr-2023-kunesh-native-family-preservation',
    'mpr-2024-kunesh-charter-school-oversight',
    'mpr-2025-pha-hmong-lao-veterans',
    'mpr-2025-coleman-civic-violence',
  ];
  const added=ids.map(id=>data.selectedNonExhaustiveArticleLeads.find(x=>x.id===id));
  assert.ok(added.every(Boolean));
  assert.deepEqual(added.map(x=>x!.publicationDayDisplayedOnPublicPage),[
    '2021-01-11','2022-02-23','2023-02-07','2024-10-22',
    '2025-04-24','2025-09-11',
  ]);
  const titles=['Michelle Benson','Mary Kunesh','Susan Pha','Julia Coleman'];
  for(const lead of added) {
    assert.ok(lead);
    assert.equal(lead.seedId,'mpr-news-story-archive');
    assert.equal(lead.publisher,'MPR News');
    assert.equal(lead.sourceResearchCheckedOn,'2026-10-10');
    assert.equal(lead.firstPartyAudioInterviewPublisherDescriptionVerified,true);
    assert.equal(lead.currentPublisherClockTimezoneVerified,false);
    assert.match(lead.currentPublisherDisplayedClockWithoutVerifiedTimezone!,
      /^\d{2}:\d{2}$/);
    assert.ok(lead.verifiedServingSenatorHistorySources?.length);
    assert.deepEqual(lead.verifiedServingSenatorHistorySources?.map(x=>x.name),
      lead.namedSenatorLeadsForManualReview);
    for(const member of lead.verifiedServingSenatorHistorySources??[]) {
      assert.ok(titles.includes(member.name));
      assert.equal(member.serviceOnPublisherDisplayedDay,true);
      assert.equal(new URL(member.officialLrlUrl).hostname,'www.lrl.mn.gov');
    }
    assert.equal(lead.originalSpeakerAudioAndCurrentTranscriptMatched,false);
    assert.equal(lead.originalHistoricalAudioAndTranscriptAvailabilityVerified,false);
    assert.equal(lead.archivedPublisherVersionAndDateProofVerified,false);
    assert.equal(lead.historicalOriginalHumanQuoteReviewed,false);
    assert.equal(lead.wasCurrentPageTextPresentBeforeAnyHistoricalVoteCutoffVerified,false);
    assert.equal(lead.noAutomaticallyInferredSenatorStance,true);
    assert.equal(lead.directQuoteHumanVerified,false);
    assert.equal(lead.archiveCapturePublicByVerified,false);
    assert.equal(lead.originalArchivedHttpBytesHashVerified,false);
    assert.equal(lead.historicalForecastEligibilityProven,false);
    assert.equal(lead.membershipOnPublicationDateVerified,false);
    assert.equal(lead.issueStanceInferred,false);
    assert.equal(lead.sourceSeenInVotePredictExport,'unknown_not_reconciled');
    assert.equal(Object.hasOwn(lead,'exactQuote'),false);
    assert.equal(Object.hasOwn(lead,'sourceDocumentId'),false);
  }
  assert.equal(added[0]!.urlInsideCurrentSeedPrefix,true); // in-prefix, topical gate still filters
  assert.equal(added[0]!.currentTextAndSpeakerProofKind,
    'audio_interview_page_no_transcript_observed');
  assert.equal(added[0]!.currentPageDirectSpeechShortResearchExcerpt,null);
  assert.equal(added[1]!.currentTextAndSpeakerProofKind,
    'publisher_description_confirmed_interviews_transcript_not_inspected');
  assert.equal(added[1]!.currentPageDirectSpeechShortResearchExcerpt,null);
  for(const x of added.slice(2)) {
    assert.equal(x!.currentTextAndSpeakerProofKind,'speaker_labeled_current_page_transcript');
    assert.ok(x!.currentPageDirectSpeechShortResearchExcerpt!.length>12);
    assert.equal(x!.urlInsideCurrentSeedPrefix,false);
  }
  assert.deepEqual(added[1]!.namedSenatorLeadsForManualReview,
    ['Michelle Benson','Mary Kunesh']);
  assert.deepEqual(added[2]!.namedSenatorLeadsForManualReview,['Mary Kunesh']);
  assert.deepEqual(added[3]!.namedSenatorLeadsForManualReview,['Mary Kunesh']);
  assert.deepEqual(added[4]!.namedSenatorLeadsForManualReview,['Susan Pha']);
  assert.deepEqual(added[5]!.namedSenatorLeadsForManualReview,['Julia Coleman']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import result from '../docs/evaluation/senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.json' with {type:'json'};
import quote from '../docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-receipts-20261012.json' with {type:'json'};
import {VERSION,QUERIES,quoteAnchor,validateQueries}
 from '../scripts/probe-senate-media-hawj-hf5247-public-bill-action-bridge.mjs';

const PINNED = [
  {
    "id": "sf1416-2023-24",
    "url": "https://www.revisor.mn.gov/bills/93/2023/0/SF/1416/?body=Senate",
    "classification": "official_revisor_93rd_senate_bill_status",
    "status": "exact_first_party_or_labeled_secondary_public_page_observed",
    "sha256": "0bb1bdd85e4a5c3cc84240aa029a3d8a52bacd454a5857eb2bc386dcd1c1f7cd",
    "bytes": 71318,
    "markers": [
      {
        "value": "SF 1416",
        "found": true
      },
      {
        "value": "2023 - 2024",
        "found": true
      },
      {
        "value": "02/08/2023",
        "found": true
      },
      {
        "value": "04/11/2023",
        "found": true
      }
    ],
    "flags": {
      "senateMay7FloorPassTallyMentioned": false,
      "senateMay19ThirdReadingTallyMentioned": false,
      "senateMay19ConferenceTallyMentioned": false,
      "laterMay24Chapter127Marker": false,
      "sectionTextContainsTranslatedMaterials": false,
      "sectionTextContainsBidding": false,
      "sectionTextContainsStPaulLocation": false,
      "secondarySourceListsHawjUnderYesVotes": false
    }
  },
  {
    "id": "sf3257-2023-24",
    "url": "https://www.revisor.mn.gov/bills/93/2023/0/SF/3257/?body=Senate",
    "classification": "official_revisor_93rd_senate_bill_status",
    "status": "exact_first_party_or_labeled_secondary_public_page_observed",
    "sha256": "2efaab25f4b6d6db3872fb707b4bd79ca344a13cba98570dad3b1300407296f5",
    "bytes": 67234,
    "markers": [
      {
        "value": "SF 3257",
        "found": true
      },
      {
        "value": "2023 - 2024",
        "found": true
      },
      {
        "value": "04/13/2023",
        "found": true
      }
    ],
    "flags": {
      "senateMay7FloorPassTallyMentioned": false,
      "senateMay19ThirdReadingTallyMentioned": false,
      "senateMay19ConferenceTallyMentioned": false,
      "laterMay24Chapter127Marker": false,
      "sectionTextContainsTranslatedMaterials": false,
      "sectionTextContainsBidding": false,
      "sectionTextContainsStPaulLocation": false,
      "secondarySourceListsHawjUnderYesVotes": false
    }
  },
  {
    "id": "sf3250-2023-24",
    "url": "https://www.revisor.mn.gov/bills/93/2023/0/SF/3250/?body=Senate",
    "classification": "official_revisor_93rd_senate_bill_status",
    "status": "exact_first_party_or_labeled_secondary_public_page_observed",
    "sha256": "1290f62018fc69322a5a9afa3d1e307dd714384f140e26b4b1e12f7280f43568",
    "bytes": 71417,
    "markers": [
      {
        "value": "SF 3250",
        "found": true
      },
      {
        "value": "2023 - 2024",
        "found": true
      },
      {
        "value": "03/18/2024",
        "found": true
      }
    ],
    "flags": {
      "senateMay7FloorPassTallyMentioned": false,
      "senateMay19ThirdReadingTallyMentioned": false,
      "senateMay19ConferenceTallyMentioned": false,
      "laterMay24Chapter127Marker": false,
      "sectionTextContainsTranslatedMaterials": false,
      "sectionTextContainsBidding": false,
      "sectionTextContainsStPaulLocation": false,
      "secondarySourceListsHawjUnderYesVotes": false
    }
  },
  {
    "id": "sf4056-2023-24",
    "url": "https://www.revisor.mn.gov/bills/93/2024/0/SF/4056/?body=Senate",
    "classification": "official_revisor_93rd_senate_bill_status",
    "status": "exact_first_party_or_labeled_secondary_public_page_observed",
    "sha256": "6e786cfaa409bd851e07dce974660e604012fba53f665ac0d933ee6fb5629d3c",
    "bytes": 69512,
    "markers": [
      {
        "value": "SF 4056",
        "found": true
      },
      {
        "value": "2023 - 2024",
        "found": true
      },
      {
        "value": "02/22/2024",
        "found": true
      },
      {
        "value": "04/15/2024",
        "found": true
      }
    ],
    "flags": {
      "senateMay7FloorPassTallyMentioned": false,
      "senateMay19ThirdReadingTallyMentioned": false,
      "senateMay19ConferenceTallyMentioned": false,
      "laterMay24Chapter127Marker": false,
      "sectionTextContainsTranslatedMaterials": false,
      "sectionTextContainsBidding": false,
      "sectionTextContainsStPaulLocation": false,
      "secondarySourceListsHawjUnderYesVotes": false
    }
  },
  {
    "id": "hf5247-2023-24",
    "url": "https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/?body=Senate",
    "classification": "official_revisor_93rd_senate_bill_status",
    "status": "exact_first_party_or_labeled_secondary_public_page_observed",
    "sha256": "a2b405b528aeca09cb044a87df11efa658a00b2f0fbd05aac3d4ccff17bcbdf5",
    "bytes": 121690,
    "markers": [
      {
        "value": "HF 5247",
        "found": true
      },
      {
        "value": "2023 - 2024",
        "found": true
      },
      {
        "value": "05/07/2024",
        "found": true
      },
      {
        "value": "05/19/2024",
        "found": true
      },
      {
        "value": "55-10",
        "found": true
      },
      {
        "value": "34-14",
        "found": true
      },
      {
        "value": "05/24/2024",
        "found": true
      }
    ],
    "flags": {
      "senateMay7FloorPassTallyMentioned": true,
      "senateMay19ThirdReadingTallyMentioned": true,
      "senateMay19ConferenceTallyMentioned": true,
      "laterMay24Chapter127Marker": true,
      "sectionTextContainsTranslatedMaterials": false,
      "sectionTextContainsBidding": false,
      "sectionTextContainsStPaulLocation": false,
      "secondarySourceListsHawjUnderYesVotes": false
    }
  },
  {
    "id": "hf5247-fourth-engrossment",
    "url": "https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/4/",
    "classification": "official_revisor_final_text_unavailable_original_body",
    "status": "public_source_fetch_or_validation_unknown",
    "sha256": null,
    "bytes": null,
    "markers": null,
    "flags": null
  },
  {
    "id": "hawj-secondary-conservation-yes",
    "url": "https://www.conservationminnesota.org/legislation/tax-omnibus-bill-hf5247-senate",
    "classification": "secondary_conservation_minnesota_not_senate_journal",
    "status": "exact_first_party_or_labeled_secondary_public_page_observed",
    "sha256": "09649f92c21e7e4788735b9abe5bad4db8deec44c51238b53cbe23b42da34e73",
    "bytes": 98647,
    "markers": [
      {
        "value": "HF5247",
        "found": true
      },
      {
        "value": "May 19, 2024",
        "found": true
      },
      {
        "value": "Yes Votes",
        "found": true
      },
      {
        "value": "Foung Hawj",
        "found": true
      }
    ],
    "flags": {
      "senateMay7FloorPassTallyMentioned": false,
      "senateMay19ThirdReadingTallyMentioned": false,
      "senateMay19ConferenceTallyMentioned": false,
      "laterMay24Chapter127Marker": false,
      "sectionTextContainsTranslatedMaterials": false,
      "sectionTextContainsBidding": false,
      "sectionTextContainsStPaulLocation": false,
      "secondarySourceListsHawjUnderYesVotes": true
    }
  }
];

test('public live 2024 legislative status metadata first source run provenance is pinned',()=>{
 assert.equal(VERSION,'track-d-hawj-hf5247-2024-public-omnibus-action-bridge-v1');
 assert.equal(result.version,'track-d-hawj-hf5247-2024-public-bill-action-bridge-receipts-v1');
 assert.equal(result.run.prNumber,1220);
 assert.equal(result.run.firstSuccessfulPublicReadOnlyRunId,38261313322);
 assert.equal(result.run.initialSourceHead,'43457fe5f22981c2d219f401a3201e97cc68e48b');
 assert.equal(result.run.publicMetadataArtifactId,11752576217);
 assert.equal(result.run.offlineAdversarialTestsPassed,9);
 assert.equal(result.researchObservedLocalDate,'2026-10-12');
 assert.equal(validateQueries(),true);
});
test('the same Senator Hawj individual historical quotation is first archived by March24, not March15 publisher display',()=>{
 const anchor=quoteAnchor();
 assert.equal(anchor.senator,'Foung Hawj');
 assert.equal(anchor.earliestOriginalHtmlUtc,'2024-03-24T19:01:09Z');
 assert.equal(anchor.earliestOriginalHtmlSha256,'aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743');
 assert.equal(result.historicSenatorStatement.senator,anchor.senator);
 assert.equal(result.historicSenatorStatement.originalUrl,anchor.originalPublisherUrl);
 assert.equal(result.historicSenatorStatement.originalCapturedUtc,anchor.earliestOriginalHtmlUtc);
 assert.equal(result.historicSenatorStatement.originalRawSha256,anchor.earliestOriginalHtmlSha256);
 assert.equal(result.historicSenatorStatement.officialServiceRecord,anchor.officialMemberHistoryUrl);
 assert.equal(result.historicSenatorStatement.originalIndexedSha1Base32,'YI4BL3IHGZ27R4JBNOVXUTI5XFGMQNSR');
 assert.deepEqual(result.historicSenatorStatement.originallyQuotedPolicySFIds,['SF 4056','SF 3257','SF 3250']);
 assert.equal(result.historicSenatorStatement.statementFirstPublicPublisherPostingTimeUnknown,true);
 assert.equal(quote.temporalHonesty.publisherDisplayedDatesMayPrecedeOnlyAuthenticatedArchiveOriginal,true);
});
test('six successfully observed HTML sources have their exact 93rd-session URLs, raw SHA256 byte counts, dates and markers pinned',()=>{
 const actual=result.sourceResults.map(x=>({id:x.sourceId,url:x.exactPublicSourceUrl,classification:x.sourceClassification,
  status:x.liveCurrentSourceRetrievalStatus,sha256:x.downloadedPublicHtmlSha256,bytes:x.downloadedPublicHtmlBytes,
  markers:x.independentlyCheckedVisibleSourceMarkers,flags:x.officialOrSecondarySourceMarkerObservations}));
 assert.deepEqual(actual,PINNED);
 assert.equal(actual.length,7);
 assert.equal(new Set(actual.map(x=>x.url)).size,7);
 assert.deepEqual(actual.map(x=>x.url),QUERIES.map(x=>x.url));
 const observed=actual.filter(x=>x.status==='exact_first_party_or_labeled_secondary_public_page_observed');
 assert.equal(observed.length,6);
 assert.equal(observed.filter(x=>x.classification==='official_revisor_93rd_senate_bill_status').length,5);
 assert.equal(observed.filter(x=>x.classification==='secondary_conservation_minnesota_not_senate_journal').length,1);
 for(const x of observed){
  assert.match(x.sha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(x.bytes)&&x.bytes>50000);
  assert.ok(x.markers?.length>0&&x.markers.every(z=>z.found===true));
  assert.equal(result.sourceResults.find(z=>z.sourceId===x.id).sourceAs2024HistoricExactStatusCaptureVerified,false);
  assert.equal(result.sourceResults.find(z=>z.sourceId===x.id).officialSenateJournalIndividualMemberRollCallVerified,false);
 }
});
test('official HF5247 chamber aggregates 55-10 34-14 34-12 and May24 chapter marker are NOT a Hawj vote',()=>{
 const hf=result.sourceResults.find(x=>x.sourceId==='hf5247-2023-24');
 assert.equal(hf.liveCurrentSourceRetrievalStatus,'exact_first_party_or_labeled_secondary_public_page_observed');
 assert.equal(hf.exactPublicSourceUrl,'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/?body=Senate');
 assert.equal(hf.downloadedPublicHtmlSha256,'a2b405b528aeca09cb044a87df11efa658a00b2f0fbd05aac3d4ccff17bcbdf5');
 assert.equal(hf.downloadedPublicHtmlBytes,121690);
 assert.equal(hf.officialOrSecondarySourceMarkerObservations.senateMay7FloorPassTallyMentioned,true);
 assert.equal(hf.officialOrSecondarySourceMarkerObservations.senateMay19ThirdReadingTallyMentioned,true);
 assert.equal(hf.officialOrSecondarySourceMarkerObservations.senateMay19ConferenceTallyMentioned,true);
 assert.equal(hf.officialOrSecondarySourceMarkerObservations.laterMay24Chapter127Marker,true);
 assert.deepEqual(result.chronologicalReview.HF5247SenateAggregateThirdReadingFirst,'2024-05-07');
 assert.deepEqual(result.chronologicalReview.HF5247SenateAggregateThirdReadingLater,'2024-05-19');
 assert.equal(result.chronologicalReview.aggregateTallyMay7,'55-10');
 assert.equal(result.chronologicalReview.aggregateTallyMay19,'34-14');
 assert.equal(result.chronologicalReview.separateMay19ConferenceAggregateMarker,'34-12');
 assert.equal(result.chronologicalReview.chapter127ApprovalActionReported,'2024-05-24');
 assert.equal(result.chronologicalReview.hf5247AggregatedChamberVoteActionsAfterArchivedQuote,true);
 assert.equal(result.totals.officialCurrentHF5247StatusChamberAggregateMay7AndMay19Markers,1);
 assert.equal(result.totals.senateJournalOriginalHawjIndividualBallotsVerified,0);
});
test('nonofficial tracker reports Hawj under May19 YES but source cannot substitute for Senate Journal or narrow policy section',()=>{
 const tip=result.sourceResults.find(x=>x.sourceId==='hawj-secondary-conservation-yes');
 assert.equal(tip.sourceClassification,'secondary_conservation_minnesota_not_senate_journal');
 assert.equal(tip.officialOrSecondarySourceMarkerObservations.secondarySourceListsHawjUnderYesVotes,true);
 assert.equal(tip.officialSenateJournalIndividualMemberRollCallVerified,false);
 assert.equal(result.totals.secondaryReportedHawjMay19YesHints,1);
 assert.equal(result.chronologicalReview.nonofficialTrackerHawjYesMay19LeadNotSenateJournal,true);
 assert.equal(result.chronologicalReview.HawjSenatorMemberBallotUnverifiedByOfficialJournal,true);
 assert.equal(result.chronologicalReview.multiSubjectHF5247VoteNotEquivalentToEndorsementOfEachHawjCitedProposal,true);
});
test('actual attempt to authenticate official final engrossment HTML unavailable; no claim sections adopted before vote',()=>{
 const final=result.sourceResults.find(x=>x.sourceId==='hf5247-fourth-engrossment');
 assert.equal(final.exactPublicSourceUrl,'https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/4/');
 assert.equal(final.liveCurrentSourceRetrievalStatus,'public_source_fetch_or_validation_unknown');
 assert.equal(final.downloadedPublicHtmlSha256,null);
 assert.equal(final.downloadedPublicHtmlBytes,null);
 assert.equal(final.independentlyCheckedVisibleSourceMarkers,null);
 assert.equal(final.officialOrSecondarySourceMarkerObservations,null);
 assert.equal(result.totals.independentlyVerifiedFinalHF5247TextVersion,0);
 assert.equal(result.totals.policySpecificOmnibusSectionVersionByVoteVerified,0);
 assert.equal(result.chronologicalReview.officialFinalFourEngrossmentTextUnavailableInLiveProbe,true);
 assert.equal(result.chronologicalReview.provenanceDoesNotProve2024VersionAvailableBeforeEachMayVote,true);
});
test('pre-March24 Hawj testimony and SF3250 report cannot be forecast; no private VotePredict or stored member votes',()=>{
 assert.equal(result.chronologicalReview.priorHawjTestimony,'2024-03-11');
 assert.equal(result.chronologicalReview.reportedSF3250CommitteeAction,'2024-03-18');
 assert.equal(result.chronologicalReview.thatCommitteeActionPrecedesAuthenticatedMarch24Quote,true);
 assert.equal(result.chronologicalReview.noStandaloneSFBillVoteAutomaticallyInferredFromOmnibus,true);
 assert.equal(result.chronologicalReview.noProductionTrainLabelOrPreVoteModelEligibilityEstablished,true);
 assert.equal(result.chronologicalReview.current2026PageDownloadsNotIndependent2024ArchivedOriginals,true);
 assert.equal(result.chronologicalReview.noFullTextHtmlAudioPdfOrHistoricalWarcPersisted,true);
 assert.equal(result.chronologicalReview.noPrivateVotePredictSourceOrAccountDataRead,true);
 assert.equal(result.chronologicalReview.noCollectorIngestDatabaseServingModelForecastOrVoteScoringChanged,true);
 assert.equal(result.totals.productionVoteLabelsOrPredictionFeaturesCreated,0);
 assert.equal(result.totals.selectedCurrentPublicUrlProbes,7);
 assert.equal(result.totals.original93rdLegislatureRevisorPublicStatusSourcesVerified,5);
 assert.equal(result.totals.independentlyVerifiedSecondaryNonofficialVoteListPages,1);
});

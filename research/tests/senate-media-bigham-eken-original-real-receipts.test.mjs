import test from 'node:test';
import assert from 'node:assert/strict';
import historical from '../../docs/evaluation/senate-media-bigham-eken-original-written-turns-20261011.json' with {type:'json'};
import previous from '../../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};
import {VERSION,originalPins,SPEAKERS} from '../../scripts/probe-senate-media-bigham-eken-original-written-attribution.mjs';

const PINNED = [
  {
    "utc": "2022-03-11T19:51:03Z",
    "sha1": "W6T26AXVFFZJHAPPTOFAAZB6NDQWKV76",
    "sha256": "026e8becb82577a34cc27388faed93048a6f247991853ba3f60f1a5287268131",
    "bytes": 154251,
    "counts": [
      {
        "senator": "Karla Bigham",
        "paragraphs": 1,
        "dist": 88,
        "notOther": 0
      },
      {
        "senator": "Kent Eken",
        "paragraphs": 1,
        "dist": 87,
        "notOther": 0
      }
    ]
  },
  {
    "utc": "2022-06-29T12:45:13Z",
    "sha1": "54ASOGEJRZQXKNSVI3XQKOTBVNTH4ON5",
    "sha256": "7a2621bdbe093c90c594af36124f53203399504758ce48c07eaec168afb9f06b",
    "bytes": 151424,
    "counts": [
      {
        "senator": "Karla Bigham",
        "paragraphs": 1,
        "dist": 88,
        "notOther": 0
      },
      {
        "senator": "Kent Eken",
        "paragraphs": 1,
        "dist": 87,
        "notOther": 0
      }
    ]
  }
];
test('actual public 2022 Bigham/Eken original direct written quote workflow independently ran',()=>{
 assert.equal(VERSION,'senate-media-two-original-bigham-eken-own-written-quote-paragraphs-v1');
 assert.equal(historical.version,'senate-media-bigham-eken-two-original-written-speaker-quote-receipts-v1');
 assert.equal(historical.publicSource.pr,1214);
 assert.equal(historical.publicSource.firstSuccessWorkflow,38204122407);
 assert.equal(historical.publicSource.initialSourceHead,'29437bbec9b722f1d1a9b8706e1b394d8e2bcf62');
 assert.equal(historical.publicSource.artifactId,11726951085);
 assert.equal(historical.publicSource.adversarialSyntheticTestsPassed,7);
});
test('two real indexed-SHA1 SHA256 source original bodies exactly identical to separately prior authenticated #1212 original capture metadata',()=>{
 const prev=previous.sources.find(x=>x.id==='public-2022-bigham-eken-separated');
 assert.equal(prev.originals.length,2);
 assert.equal(historical.originalBodyVersions.length,2);
 for(let i=0;i<2;i++){
  const x=historical.originalBodyVersions[i],old=prev.originals[i];
  assert.equal(x.archiveUtc,old.utc);
  assert.equal(x.indexedSha1Base32,old.indexSha1);
  assert.equal(x.rawOriginalHtmlSha256,old.rawSha256);
  assert.equal(x.rawHtmlBytes,old.bytes);
  assert.equal(x.sha1Sha256AndBytesReverified,true);
  assert.equal(x.sourceStatus,'previously_pinned_indexed_sha1_raw_sha256_original_reverified');
  assert.equal(originalPins()[i].rawSha256,x.rawOriginalHtmlSha256);
 }
});
test('two separate senators have two separate named short printed quotes inside same own attributed paragraphs in each original',()=>{
 assert.deepEqual(historical.namedServingStateSenators.map(x=>x.name),['Karla Bigham','Kent Eken']);
 assert.deepEqual(SPEAKERS.map(x=>x.memberId),['15281','10764']);
 const got=historical.originalBodyVersions.map(x=>({utc:x.archiveUtc,sha1:x.indexedSha1Base32,sha256:x.rawOriginalHtmlSha256,bytes:x.rawHtmlBytes,
  counts:x.individualWrittenQuoteAttributionResults.map(y=>({senator:y.senator,paragraphs:y.individualOwnQuotedParagraphMatches,dist:y.selectedCueCharDistanceAfterOwnAttribution,notOther:y.cueOccurrencesNotInApprovedOwnAttributedQuotedParagraph}))}));
 assert.deepEqual(got,PINNED);
 for(const x of historical.originalBodyVersions){
  assert.equal(x.reviewedVisibleOriginalParagraphs,7);
  assert.deepEqual(x.individualWrittenQuoteAttributionResults.map(y=>y.senator),['Karla Bigham','Kent Eken']);
  assert.deepEqual(x.individualWrittenQuoteAttributionResults.map(y=>y.selectedCueCharDistanceAfterOwnAttribution),[88,87]);
  assert.ok(x.individualWrittenQuoteAttributionResults.every(y=>y.selectedCueInsideSameParagraphWithCorrectFullNameAndAfterAttribution));
  assert.ok(x.individualWrittenQuoteAttributionResults.every(y=>y.individualOwnQuotedParagraphMatches===1));
  assert.ok(x.individualWrittenQuoteAttributionResults.every(y=>y.cueOccurrencesNotInApprovedOwnAttributedQuotedParagraph===0));
 }
});
test('one article and two historical versions NOT four separate statements or 2022-01-31 first posting, recording or votes',()=>{
 assert.equal(historical.counts.distinctAlreadyAuthenticatedPublisherUrlReviewed,1);
 assert.equal(historical.counts.originalHtmlVersionsPreviouslyPinnedAndReverified,2);
 assert.equal(historical.counts.newPublisherUrls,0);
 assert.equal(historical.counts.newHistoricalArchiveVersions,0);
 assert.equal(historical.counts.separatelyAttributedShortHistoricalPrintedSenatorPolicyCandidates,2);
 assert.equal(historical.counts.completeHumanApprovedVerbatimQuotations,0);
 assert.equal(historical.counts.recordedAudioVerified,0);
 assert.equal(historical.counts.memberRollCallVotesAuthenticated,0);
 assert.equal(historical.limitations.firstPublisherPostingClockNotProvedByCurrent2022Jan31DisplayedDate,true);
 assert.equal(historical.limitations.earliestOriginalShowingSelectedIndividualWrittenQuoteUtc,'2022-03-11T19:51:03Z');
 assert.equal(historical.limitations.ownExactNamedAttributionAndSameParagraphQuotationRequired,true);
 assert.equal(historical.limitations.jointCaucusArticleOneOriginalSourceNotTwo,true);
 assert.equal(historical.limitations.historicalPrintedWrittenStatementsNotIndependentlyRecordedVoice,true);
 assert.equal(historical.limitations.noPrivateVotePredictSourceDocQueryOrRowInspected,true);
 assert.equal(historical.limitations.noProductionCollectorModelIngestionForecastOrDatabaseChanged,true);
 assert.equal(historical.limitations.noFullArticleHtmlMediaOrVerbatimFullQuotePersisted,true);
});

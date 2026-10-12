import test from 'node:test';
import assert from 'node:assert/strict';
import historical from '../docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-receipts-20261012.json' with {type:'json'};
import previous from '../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};
import {VERSION,TARGETS,selectExactPins} from '../scripts/probe-senate-media-hawj-mcewen-2024-original-written-quotes.mjs';

const PINNED = [
  {
    "sourceId": "public-2024-mcewen-mining",
    "senator": "Jen McEwen",
    "utc": "2024-04-22T03:56:26Z",
    "sha1": "LUERCXLMTQVWEL5LPAM3RDXGEBHTLMKN",
    "sha256": "d2a3d97c9519fa64f219dbd8d45be0c4c98904bde749a6a0e3c385e9bde7a6b9",
    "bytes": 94499,
    "bodyParas": 10,
    "intro": 1,
    "candidates": 1,
    "quoteParas": 3,
    "offset": 0,
    "bills": [
      {
        "bill": "SF 1416",
        "visibleOriginalPublisherBodyContainsReference": true
      }
    ]
  },
  {
    "sourceId": "public-2024-hawj-transport",
    "senator": "Foung Hawj",
    "utc": "2024-03-24T19:01:09Z",
    "sha1": "YI4BL3IHGZ27R4JBNOVXUTI5XFGMQNSR",
    "sha256": "aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743",
    "bytes": 93076,
    "bodyParas": 8,
    "intro": 1,
    "candidates": 1,
    "quoteParas": 1,
    "offset": 0,
    "bills": [
      {
        "bill": "SF 4056",
        "visibleOriginalPublisherBodyContainsReference": true
      },
      {
        "bill": "SF 3257",
        "visibleOriginalPublisherBodyContainsReference": true
      },
      {
        "bill": "SF 3250",
        "visibleOriginalPublisherBodyContainsReference": true
      }
    ]
  },
  {
    "sourceId": "public-2024-hawj-transport",
    "senator": "Foung Hawj",
    "utc": "2024-04-22T04:14:23Z",
    "sha1": "RPGCVOQOMF7AOA2UQ6R7E5QIALFQB7S2",
    "sha256": "a168aef89b0f2e50e588c1aa404491de41a241b13739edfe394e4ec6b70e0a01",
    "bytes": 93360,
    "bodyParas": 8,
    "intro": 1,
    "candidates": 1,
    "quoteParas": 1,
    "offset": 0,
    "bills": [
      {
        "bill": "SF 4056",
        "visibleOriginalPublisherBodyContainsReference": true
      },
      {
        "bill": "SF 3257",
        "visibleOriginalPublisherBodyContainsReference": true
      },
      {
        "bill": "SF 3250",
        "visibleOriginalPublisherBodyContainsReference": true
      }
    ]
  }
];

test('actual successful nine-test live original SHA and quote-ownership workflow is pinned',()=>{
 assert.equal(VERSION,'senate-media-hawj-mcewen-two-2024-original-own-publisher-written-quote-v1');
 assert.equal(historical.version,'senate-media-2024-hawj-mcewen-historical-individually-bounded-written-quotes-receipts-v1');
 assert.equal(historical.provenance.issue,987);
 assert.equal(historical.provenance.pr,1216);
 assert.equal(historical.provenance.originalSourceParentPr,1212);
 assert.equal(historical.provenance.firstSuccessLiveSourceRunId,38259377134);
 assert.equal(historical.provenance.firstSuccessHead,'6c708c6a8a81e65f8d16d4aeda3470390e314a13');
 assert.equal(historical.provenance.publicMetadataOnlyArtifactId,11752251196);
 assert.equal(historical.provenance.initialOfflineAdversarialTestsPassed,9);
});
test('three independently indexed real original source SHA, raw SHA256, UTC, byte sizes, individual quotes and policy references are immutable',()=>{
 const got=historical.sources.map(s=>({sourceId:s.sourceId,senator:s.senator,utc:s.sourceHistoricalArchiveUtc,
  sha1:s.independentlyIndexedOriginalSha1Base32,sha256:s.rawOriginalHttpHtmlSha256,bytes:s.rawOriginalHtmlBytes,
  bodyParas:s.originalVisibleParagraphsReviewed,intro:s.namedSenatorIssuedStatementIntroParagraphs,
  candidates:s.matchingIntroducedQuoteRuns,quoteParas:s.boundQuoteParagraphCount,
  offset:s.cueOffsetFromOpeningQuote,bills:s.namedBillReferencesInOriginalVisibleBody}));
 assert.deepEqual(got,PINNED);
 assert.equal(got.length,3);
 for(const x of got){
  assert.match(x.sha1,/^[A-Z2-7]{32}$/);
  assert.match(x.sha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(x.bytes)&&x.bytes>80000);
  assert.equal(x.intro,1);
  assert.equal(x.candidates,1);
  assert.equal(x.offset,0);
  assert.ok(x.bills.every(b=>b.visibleOriginalPublisherBodyContainsReference));
 }
});
test('original URL / state senator / captured original SHA identities match independently authenticated prior eight source report',()=>{
 const pins=selectExactPins();
 assert.equal(pins.length,3);
 for(let i=0;i<pins.length;i++){
  const x=historical.sources[i],p=pins[i],prior=previous.sources.find(s=>s.id===x.sourceId);
  assert.equal(x.exactOriginalUrl,p.originalUrl);
  assert.equal(x.exactOriginalUrl,prior.url);
  assert.equal(x.senator,p.senator);
  assert.equal(x.officialMemberHistoryUrl,prior.individuals[0].officialMemberHistoryUrl);
  assert.deepEqual(x.publisherDisplayedDates,prior.displayDates);
  assert.equal(x.sourceHistoricalArchiveUtc,p.utc);
  assert.equal(x.independentlyIndexedOriginalSha1Base32,p.sha1);
  assert.equal(x.rawOriginalHttpHtmlSha256,p.sha256);
  assert.equal(x.rawOriginalHtmlBytes,p.bytes);
  assert.ok(prior.originals.some(y=>y.utc===p.utc&&y.rawSha256===p.sha256&&y.indexSha1===p.sha1));
 }
});
test('McEwen original exhibits personally issued closed quote over three HTML paragraphs, not hearing recording or bill vote',()=>{
 const m=historical.sources.filter(s=>s.senator==='Jen McEwen');
 assert.equal(m.length,1);
 assert.equal(m[0].sourceHistoricalArchiveUtc,'2024-04-22T03:56:26Z');
 assert.equal(m[0].originalVisibleParagraphsReviewed,10);
 assert.equal(m[0].boundQuoteParagraphCount,3);
 assert.equal(m[0].hasBoundedQuoteOwnedByNamedSenator,true);
 assert.equal(m[0].ownNamedIntroImmediatelyBeforeQuote,true);
 assert.equal(m[0].shortPolicyCueExactlyOnceInsideOpenAndClosedQuote,true);
 assert.deepEqual(m[0].namedBillReferencesInOriginalVisibleBody,[{bill:'SF 1416',visibleOriginalPublisherBodyContainsReference:true}]);
 assert.equal(historical.temporalHonesty.mcewenReleasedAfterFebruary22InformationalHearing,true);
 assert.equal(historical.temporalHonesty.mcewenEarliestIndependentlyVerifiedOriginalByUtc,'2024-04-22T03:56:26Z');
});
test('Hawj original historical quote ownership stable across March and April 2024 distinct raw bodies and all three cited SF IDs',()=>{
 const h=historical.sources.filter(s=>s.senator==='Foung Hawj');
 assert.equal(h.length,2);
 assert.deepEqual(h.map(x=>x.sourceHistoricalArchiveUtc),['2024-03-24T19:01:09Z','2024-04-22T04:14:23Z']);
 assert.equal(new Set(h.map(x=>x.rawOriginalHttpHtmlSha256)).size,2);
 for(const x of h){
  assert.equal(x.originalVisibleParagraphsReviewed,8);
  assert.equal(x.boundQuoteParagraphCount,1);
  assert.equal(x.hasBoundedQuoteOwnedByNamedSenator,true);
  assert.equal(x.ownNamedIntroImmediatelyBeforeQuote,true);
  assert.equal(x.shortPolicyCueExactlyOnceInsideOpenAndClosedQuote,true);
  assert.deepEqual(x.namedBillReferencesInOriginalVisibleBody.map(z=>z.bill),['SF 4056','SF 3257','SF 3250']);
  assert.ok(x.namedBillReferencesInOriginalVisibleBody.every(z=>z.visibleOriginalPublisherBodyContainsReference));
 }
 assert.equal(historical.temporalHonesty.hawjEarliestIndependentlyVerifiedOriginalByUtc,'2024-03-24T19:01:09Z');
 assert.equal(historical.temporalHonesty.hawjReleasedAfterMarch11TransportationHearing,true);
});
test('two speaker statements in three original versions, ZERO article/capture additions, no false publication, audio or forecasting claims',()=>{
 assert.deepEqual(TARGETS.map(s=>s.senator),['Jen McEwen','Foung Hawj']);
 assert.equal(historical.counts.alreadyDiscoveredDistinctFirstPartyArticles,2);
 assert.equal(historical.counts.archivedOriginalHtmlVersionsReverified,3);
 assert.equal(historical.counts.distinctNamedSenatorsWithIndividuallyBoundedOriginalWrittenShortQuotes,2);
 assert.equal(historical.counts.archivedOriginalBodiesWithPersonallyBoundedWrittenQuote,3);
 assert.equal(historical.counts.newDistinctPublisherArticleUrls,0);
 assert.equal(historical.counts.newArchivedSourceVersions,0);
 assert.equal(historical.counts.completeHumanApprovedVerbatimSpeakerQuotations,0);
 assert.equal(historical.counts.independentlyRecordedOriginalAudioAuthenticated,0);
 assert.equal(historical.counts.independentStateSenateRollCallsOrForecastCutoffsVerified,0);
 assert.ok(historical.sources.every(s=>!s.humanApprovedFullVerbatimQuote&&!s.audioRecordingAuthenticated&&!s.firstPublisherPublicationTimestampAuthenticated&&!s.SenateRollCallOrVotePredictionTimeProved));
 assert.equal(historical.temporalHonesty.publisherDisplayedDatesMayPrecedeOnlyAuthenticatedArchiveOriginal,true);
 assert.equal(historical.temporalHonesty.citedBillIdsNotAnAuthenticatedActualSenatorVote,true);
 assert.equal(historical.temporalHonesty.laterLegislativeEventsWouldRequireIndependentVoteChronologyAndPreVoteCutoff,true);
 assert.equal(historical.temporalHonesty.originalSourceBodyQuoteBoundaryConfirmedOnlyForSelectedShortPolicyCue,true);
 assert.equal(historical.temporalHonesty.threeCaptureVersionsNotThreeDifferentSpeechEvents,true);
 assert.equal(historical.temporalHonesty.noPrivateVotePredictDbSourceRowOrPersonalInfoAccess,true);
 assert.equal(historical.temporalHonesty.noCollectorProductionDeploymentDbModelOrServingModifications,true);
 assert.equal(historical.temporalHonesty.noRawOriginalHtmlPdfWarcFullQuoteVideoOrAudioCommitted,true);
});

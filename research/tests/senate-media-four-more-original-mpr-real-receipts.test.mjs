import test from 'node:test';
import assert from 'node:assert/strict';
import source from '../../docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.json' with {type:'json'};
import receipt from '../../docs/evaluation/senate-media-four-more-original-mpr-speaker-turns-20261011.json' with {type:'json'};
import {STUDIES,VERSION,selectExactOriginalSpeakerStudyPins} from '../scripts/probe-senate-media-four-more-original-mpr-speaker-turns.mjs';

const pins=selectExactOriginalSpeakerStudyPins(source);
const actual=receipt.sourceOriginalSpeakerTurnCaptures;
test('authentic real published source receipt artifact and synthetic tests from successful exact raw body replays',()=>{
 assert.equal(receipt.version,'senate-media-four-other-senator-authenticated-original-mpr-speaker-turns-v1');
 assert.equal(receipt.action.firstSuccessfulRealSpeakerSourceRunId,38196589389);
 assert.equal(receipt.action.firstSuccessfulRealSpeakerSourceArtifactId,11723602642);
 assert.equal(receipt.action.archiveArtifactZipSha256,'b9cd1687d2020e79445011c3f214f65b89d289b19facd8439d62403595ee8814');
 assert.equal(receipt.action.rawMetadataJsonFileBytes,13389);
 assert.equal(receipt.action.rawMetadataJsonFileSha256,'82d496962ba23416096da96202598102d9c336be62f46c81cf7a993cdb06b23b');
 assert.equal(receipt.action.adversarialOfflineTestsPassed,5);
 assert.equal(receipt.action.adversarialOfflineTestsFailed,0);
 assert.equal(receipt.action.liveOriginalPageReplaysSuccessful,7);
});
test('exact four different first-party senator interview URL source identities reused from independent original source verified receipts',()=>{
 assert.equal(actual.length,7);
 assert.equal(pins.length,7);
 assert.equal(new Set(actual.map(x=>x.originalPublisherUrl)).size,4);
 assert.deepEqual([...new Set(actual.map(x=>x.senator))],['Steve Cwodzinski','John Hoffman','Zach Duckworth','Sandra Pappas']);
 assert.deepEqual(STUDIES.map(x=>x.speaker),[...new Set(actual.map(x=>x.senator))]);
 for(let i=0;i<7;i++){
  const a=actual[i],pin=pins[i];
  assert.equal(a.id,pin.id);
  assert.equal(a.senator,pin.speaker);
  assert.equal(a.originalPublisherUrl,pin.url);
  assert.equal(a.archivalCaptureUtc,pin.originalArchiveUtc);
  assert.equal(a.indexedOriginalSha1,pin.indexedSha1);
  assert.equal(a.rawOriginalHtmlSha256,pin.rawSha256);
  assert.equal(a.rawOriginalHtmlBytes,pin.bytes);
  assert.equal(a.originalHtmlStatus,'sha1_sha256_and_bytes_reverified_original_mpr_html');
  assert.equal(a.visibleAudioTranscriptHeading,true);
  assert.equal(a.selectedShortPhraseOnOriginalPage,true);
  assert.equal(a.selectedShortPhraseWithinTranscript,true);
  assert.equal(a.selectedShortPhraseInsideBoundedOwnSenatorTurn,true);
  assert.equal(a.selectedShortPhraseInOtherNamedTurn,false);
  assert.deepEqual(a.phraseOwnerSpeakerLabels,[pin.label]);
  assert.equal(a.humanVerifiedFullSenatorSpokenVerbatimQuotation,false);
  assert.equal(a.independentlyAuthenticatedOriginalAudioBinary,false);
  assert.equal(a.noActualSenateRecordedMemberVoteProven,true);
 }
});
test('earliest genuine original for four historical senator interview pages, never backdated to displayed day',()=>{
 const early=[...new Set(actual.map(x=>x.id))].map(id=>actual.find(x=>x.id===id).archivalCaptureUtc);
 assert.deepEqual(early,['2023-03-14T11:26:30Z','2023-11-30T10:11:31Z','2024-09-23T07:50:05Z','2025-04-21T03:45:59Z']);
 assert.deepEqual(actual.map(x=>x.fullNameSenatorSpeakerLabelsInTranscript),[10,11,11,7,7,15,15]);
 assert.equal(receipt.cautions.originalCaptureUtcIsLatestProvedContentPresenceNotTranscriptFirstUpload,true);
});
test('several original captures per publisher URL are versions of one interview, not seven independently spoken pieces',()=>{
 assert.equal(receipt.scope.authenticatedHistoricalOriginalHtmlVersions,7);
 assert.equal(receipt.scope.distinctFirstPartyInterviewUrls,4);
 assert.equal(receipt.scope.distinctSpeakerInterviewCandidatePassages,4);
 assert.equal(receipt.scope.duplicateSourceVersionsNotNewStatements,true);
 assert.equal(receipt.scope.printedOwnSpeakerTurnSelectedShortPolicyFragmentMatches,7);
});
test('false certainty guards: no member roll-call, historic audio, complete quote, or 2023 Duckworth vote predicative evidence',()=>{
 assert.equal(receipt.scope.verifiedOriginalAudioBinaries,0);
 assert.equal(receipt.scope.humanApprovedCompleteVerbatimSenatorQuotations,0);
 assert.equal(receipt.scope.recordedSenateIndividualVotesVerified,0);
 assert.equal(receipt.scope.historicalPredictionCutoffEligibilityEstablished,0);
 assert.equal(receipt.cautions.duckworth2024CannotRetrospectivelyForecast2023SchoolMealsLegislation,true);
 assert.equal(receipt.cautions.shortCuesWithinPrintedNamedSpeakerTurnAreNotOriginalAudioOrHumanFullVerbatimQuotes,true);
 assert.equal(receipt.cautions.noPrivateSourceDocumentOrEvidenceRowsRead,true);
 assert.equal(receipt.cautions.noProductionCollectorSeedModelTrainingOrForecastChanges,true);
 assert.equal(receipt.cautions.noRawOriginalHtmlTranscriptMP3PDFWarcRetained,true);
 assert.equal(VERSION,'mpr-four-more-senators-2023-25-original-speaker-turn-source-proof-v1');
});

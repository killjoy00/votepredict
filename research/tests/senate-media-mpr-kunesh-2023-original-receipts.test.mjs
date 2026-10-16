import test from 'node:test';
import assert from 'node:assert/strict';
import receipts from '../../docs/evaluation/senate-media-mpr-kunesh-2023-original-in-turn-20261011.json' with {type:'json'};
import old from '../../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json' with {type:'json'};
import {selectPinned2023Originals,STUDY,VERSION} from '../../scripts/probe-senate-media-mpr-kunesh-2023-speaker-cues.mjs';
test('real public original SHA-paired original 2023 source replays and bounded test/metadata workflow recorded accurately',()=>{
 assert.equal(receipts.version,'mpr-2023-original-kunesh-printed-two-policy-cues-public-provenance-v1');
 assert.equal(receipts.sourceRun.runId,38194711492);
 assert.equal(receipts.sourceRun.artifactId,11722727635);
 assert.equal(receipts.sourceRun.runConclusion,'success');
 assert.equal(receipts.sourceRun.offlineAdversarialTestCount,6);
 assert.equal(receipts.sourceRun.offlineTestFailureCount,0);
 assert.equal(receipts.sourceRun.authenticatedRealOriginalHtmlReplayCount,6);
});
test('two original SHA1+SHA256 raw HTML byte identities are from the SAME previously authenticated Feb 2023 MPR URL',()=>{
 const pins=selectPinned2023Originals(old);
 assert.equal(receipts.authenticatedDifferentOriginalHtmlVersions,2);
 assert.equal(receipts.previouslyKnownSourceDocumentCount,1);
 assert.equal(receipts.historicalCaptures.length,2);
 for(let i=0;i<2;i++){
  const a=pins[i],b=receipts.historicalCaptures[i];
  assert.equal(b.captureUtc,a.captureUtc);
  assert.equal(b.indexedOriginalSha1Base32,a.sha1);
  assert.equal(b.rawOriginalSha256,a.sha256);
  assert.equal(b.bytes,a.bytes);
  assert.equal(b.rawOriginalHtmlBodySha1AndSha256Reverified,true);
  assert.equal(b.printedAudioTranscriptHeadingSeen,true);
 }
 assert.equal(receipts.originalPublisherEpisodeUrl,pins[0].pageUrl);
 assert.equal(receipts.counts.distinctOriginalPublisherUrlsNewlyDiscovered,0);
});
test('first independently authenticated 2023 printed transcript contains both policy fragments inside explicit Mary Kunesh turns',()=>{
 const feb=receipts.historicalCaptures[0];
 assert.equal(feb.captureUtc,'2023-02-10T02:40:30Z');
 assert.equal(feb.studies.length,3);
 for(let i=0;i<2;i++){
  const q=feb.studies[i];
  assert.equal(q.shortPhraseStudyId,STUDY[i].id);
  assert.equal(q.selectedPhraseOnOriginalPage,true);
  assert.equal(q.selectedPhraseInsideOriginalAudioTranscriptSection,true);
  assert.equal(q.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn,true);
  assert.deepEqual(q.selectedPhraseOwnerLabels,['MARY KUNESH:']);
  assert.equal(q.printedTranscriptTurnNotAuthenticatedRecordedAudio,true);
  assert.equal(q.originalMemberSpeechHumanVerbatimReviewApproved,false);
 }
 assert.deepEqual(feb.studies.slice(0,2).map(x=>x.selectedPhraseDistanceFromStartOfNamedTurnCharacters),[394,397]);
});
test('same named speaker short policy fragments persist in April 2024 captured ORIGINAL version of same 2023 interview',()=>{
 const april=receipts.historicalCaptures[1];
 assert.equal(april.captureUtc,'2024-04-18T02:46:06Z');
 assert.ok(april.studies.slice(0,2).every(x=>x.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn));
 assert.equal(receipts.counts.selectedNewSenatorPrintedShortPolicyPhraseCandidates,2);
});
test('previously mistakenly conflated page-summary phrase is NOT in either original senator transcript turn',()=>{
 for(const source of receipts.historicalCaptures){
  const q=source.studies[2];
  assert.equal(q.shortPhraseStudyId,'outside-transcript-summary-control');
  assert.equal(q.selectedPhraseOnOriginalPage,true);
  assert.equal(q.selectedPhraseInsideOriginalAudioTranscriptSection,false);
  assert.equal(q.selectedPhraseInsideSameExplicitMaryKuneshTranscriptTurn,false);
  assert.deepEqual(q.selectedPhraseOwnerLabels,[]);
  assert.equal(q.selectedPhraseDistanceFromStartOfNamedTurnCharacters,null);
 }
 assert.equal(receipts.limits.onPageReporterSummaryNegativeControlMustNotCountAsTranscriptSpeech,true);
});
test('authentic bounded original 2023 text does not certify 2023 original audio or exact first-publication minute, vote or forecast',()=>{
 assert.equal(receipts.counts.newlyAuthenticatedRecordedAudioBinaries,0);
 assert.equal(receipts.counts.approvedWholeSenatorVerbatimQuotes,0);
 assert.equal(receipts.counts.verifiedOriginalHistoricalIndividualMemberVotes,0);
 assert.equal(receipts.counts.retrospectiveModelEligibilityProved,0);
 assert.equal(receipts.limits.selectedOriginalVersionPublicByBoundNoLaterThan,'2023-02-10T02:40:30Z');
 assert.equal(receipts.limits.original2023PublicationTimeNotProved,true);
 assert.equal(receipts.limits.audioOriginallyPlayedAtBroadcastNotIndependentlyShaAuthenticated,true);
 assert.equal(receipts.limits.noRawHtmlTranscriptAudioWarcPersisted,true);
 assert.equal(receipts.limits.noPrivateSourceDocumentsEvidenceItemsOrDatabaseAccess,true);
 assert.equal(receipts.limits.noSeedCollectorOrTrainingForecastChanges,true);
 assert.equal(VERSION,'mpr-2023-kunesh-speaker-printed-passages-on-original-html-v1');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import receipts from '../docs/evaluation/senate-media-mpr-kunesh-original-speaker-turns-20261011.json' with {type:'json'};
import {publicPinnedOriginals,VERSION} from '../scripts/probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
import prior from '../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json' with {type:'json'};
test('real successful independent original source run metadata ZIP and public JSON SHA preserved without raw pages',()=>{
 assert.equal(receipts.version,'mpr-kunesh-2023-2024-original-speaker-turn-receipts-v1');
 assert.equal(receipts.initialActualGitHubSourceRun.runId,38194030668);
 assert.equal(receipts.initialActualGitHubSourceRun.artifactId,11722502139);
 assert.equal(receipts.initialActualGitHubSourceRun.actionSucceeded,true);
 assert.equal(receipts.initialActualGitHubSourceRun.offlineTestsPassed,12);
 assert.equal(receipts.initialActualGitHubSourceRun.offlineTestsFailed,0);
 assert.equal(receipts.initialActualGitHubSourceRun.artifactZipSha256,'fbb228dadbbdf0c58b8b573dfff8f4d7aff85fa4b3b31864022a38153d4a9029');
 assert.equal(receipts.initialActualGitHubSourceRun.metadataJsonBytes,7141);
 assert.equal(receipts.initialActualGitHubSourceRun.metadataJsonSha256,'e013999d57e8844e8c90c5e75617bee7bbcabb496ed497f257dc292b3bf58f8b');
});
test('four exact original byte identities independently match earlier public MPR hash receipts, not new source URLs',()=>{
 const pinned=publicPinnedOriginals(prior);
 assert.equal(pinned.length,4);
 assert.equal(receipts.originals.length,4);
 assert.equal(new Set(receipts.originals.map(x=>x.originalPublisherUrl)).size,2);
 for(let i=0;i<4;i++){
  const a=pinned[i],b=receipts.originals[i];
  assert.equal(a.leadId,b.leadId);
  assert.equal(a.pageUrl,b.originalPublisherUrl);
  assert.equal(a.captureUtc,b.archivedCaptureUtc);
  assert.equal(a.sha1,b.indexedSha1Base32);
  assert.equal(a.sha256,b.rawOriginalHtmlSha256);
  assert.equal(a.bytes,b.rawOriginalHtmlBytes);
  assert.equal(b.sha1AndSha256OriginalHtmlReverified,true);
  assert.equal(b.namedSenatorSpeechHumanApproved,false);
  assert.equal(b.actualSpokenAudioAuthenticated,false);
 }
});
test('original Feb 2023 and Apr 2024 child-welfare page text phrase is NOT found within Audio transcript or senator turn',()=>{
 const a=receipts.originals.slice(0,2);
 assert.deepEqual(a.map(x=>x.archivedCaptureUtc),['2023-02-10T02:40:30Z','2024-04-18T02:46:06Z']);
 assert.ok(a.every(x=>x.visibleAudioTranscriptSection));
 assert.ok(a.every(x=>x.maryKuneshSpeakerLabelsInTranscript===8));
 assert.ok(a.every(x=>x.selectedShortCueVisibleOnPage));
 assert.ok(a.every(x=>!x.selectedShortCueInsideTranscriptSection&&!x.selectedShortCueWithinMaryKuneshLabeledTurn));
 assert.ok(a.every(x=>x.selectedCueOwnerLabeledSpeakerTurns.length===0));
 assert.equal(receipts.limitations.selected2023CueIsOutsideAudioTranscriptSectionDespiteSpeakerLabelsInside,true);
});
test('same original Oct 2024 archived HTML has neither selected phrase nor transcript heading',()=>{
 const x=receipts.originals[2];
 assert.equal(x.archivedCaptureUtc,'2024-10-22T18:31:15Z');
 assert.equal(x.rawOriginalHtmlSha256,'89e55f875d760ff3665a7a1ab381d7d4b0e26b1c27d3a5da5d378c940a1eaada');
 assert.equal(x.visibleAudioTranscriptSection,false);
 assert.equal(x.selectedShortCueVisibleOnPage,false);
 assert.equal(x.selectedShortCueWithinMaryKuneshLabeledTurn,false);
 assert.equal(x.maryKuneshSpeakerLabelsInTranscript,0);
});
test('Dec 2024 genuine archived MPR page has bounded Kunesh explicit transcript turn containing selected reform fragment',()=>{
 const x=receipts.originals[3];
 assert.equal(x.archivedCaptureUtc,'2024-12-11T00:46:18Z');
 assert.equal(x.indexedSha1Base32,'EXUETRMUIVMGRHPLYKSKWB3CXGJBDXWC');
 assert.equal(x.rawOriginalHtmlSha256,'defc2522260a83fa4b8e3c5971d9fae89b78a7fdc25965f7f20121f7a778797a');
 assert.equal(x.visibleAudioTranscriptSection,true);
 assert.equal(x.selectedShortCueInsideTranscriptSection,true);
 assert.equal(x.selectedShortCueWithinMaryKuneshLabeledTurn,true);
 assert.equal(x.selectedShortCueOffsetInLabeledTurnChars,25);
 assert.deepEqual(x.selectedCueOwnerLabeledSpeakerTurns,['MARY KUNESH:']);
 assert.equal(receipts.limitations.selectedDecember2024CueIsWithinKuneshLabeledTranscriptTurn,true);
});
test('printed speaker-turn string adjacency not historical broadcast MP3 evidence, full quote approval or eligible Senate vote',()=>{
 assert.equal(receipts.scope.originalHistoricalHtmlSha1Sha256Matched,4);
 assert.equal(receipts.scope.selectedShortCueWithinSameNamedSenatorTurn,1);
 assert.equal(receipts.scope.selectedShortCueOnPageButOutsideTranscript,2);
 assert.equal(receipts.scope.verifiedOriginalSpokenAudioBinaries,0);
 assert.equal(receipts.scope.humanReviewedFullVerbatimSpeakerQuotations,0);
 assert.equal(receipts.limitations.shortTextAdjacencyNotHumanApprovedFullSpeechOrAudio,true);
 assert.equal(receipts.limitations.noAutomaticBackdatingToMprEpisodeDisplayedDay,true);
 assert.equal(receipts.limitations.noPredictionsOrLegislativeVoteEvidencePromoted,true);
 assert.equal(receipts.limitations.noPrivateVotePredictSourceDocumentsOrDatabaseTouched,true);
 assert.equal(receipts.limitations.noRawOriginalHtmlOrAudioSaved,true);
 assert.equal(VERSION,'mpr-two-kunesh-historic-pinned-original-speaker-turn-v1');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import r from '../docs/evaluation/senate-media-miller-enterprise-original-speaker-qa-20261011.json' with {type:'json'};
import previous from '../docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json' with {type:'json'};
import {exactPins,VERSION} from '../scripts/probe-senate-media-miller-enterprise-original-qa-turns.mjs';

test('first actually successful historical original speaker-turn source workflow metadata permanently pinned',()=>{
 assert.equal(r.version,'senate-media-miller-enterprise-original-pinned-answer-speaker-attribution-receipts-v1');
 assert.equal(r.firstSuccessfulLivePublicEvidenceWorkflow.runId,38202630302);
 assert.equal(r.firstSuccessfulLivePublicEvidenceWorkflow.headSha,'edbcc9df3978c6dcecba2e25e0bbc30e17a11ff5');
 assert.equal(r.firstSuccessfulLivePublicEvidenceWorkflow.publicMetadataArtifactId,11726325317);
 assert.equal(r.firstSuccessfulLivePublicEvidenceWorkflow.syntheticTestsPassed,7);
 assert.equal(r.firstSuccessfulLivePublicEvidenceWorkflow.syntheticTestsFailed,0);
 assert.equal(VERSION,'senate-media-miller-enterprise-two-indexed-original-print-qa-turns-v1');
});
test('both immutable first-party originals precisely match the previously independently authenticated index/raw SHA/byte source receipts',()=>{
 const p=previous.sources.find(x=>x.id==='2021-miller-enterprise-manufacturing-qa');
 assert.equal(r.versions.length,2);
 assert.equal(p.archivedOriginalHtml.length,2);
 assert.equal(exactPins().length,2);
 for(let i=0;i<2;i++){
  const v=r.versions[i],old=p.archivedOriginalHtml[i];
  assert.equal(v.archiveCaptureUtc,old.captureUtc);
  assert.equal(v.indexedOriginalSha1Base32,old.indexedOriginalSha1Base32);
  assert.equal(v.downloadedOriginalHtmlSha256,old.rawOriginalHtmlSha256);
  assert.equal(v.downloadedOriginalHtmlBytes,old.rawOriginalBytes);
  assert.equal(v.archiveReplaySourceGateStatus,'indexed_sha1_and_raw_sha256_reverified');
  assert.equal(v.originalBodyReverifiedAgainstPreviousRealPublicReceipt,true);
  assert.match(v.indexedOriginalSha1Base32,/^[A-Z2-7]{32}$/);
  assert.match(v.downloadedOriginalHtmlSha256,/^[a-f0-9]{64}$/);
 }
});
test('selected free-market phrase occurs inside the same Miller-labeled ORIGINAL printed paragraph, not another speaker or generic page mention',()=>{
 assert.equal(r.source.namedServingSenator,'Jeremy Miller');
 assert.equal(r.source.historicalMemberRecord,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15335');
 assert.equal(r.source.selectedShortPolicyFragment,'my view is that the free market is working');
 for(const v of r.versions){
  const p=v.paragraphAndSpeakerBoundary;
  assert.equal(p.totalHtmlParagraphsReviewed,61);
  assert.equal(p.explicitMillerLabeledParagraphCount,13);
  assert.equal(p.selectedShortPolicyFragmentPresentInPageVisibleText,true);
  assert.equal(p.paragraphsContainingSelectedShortPolicyFragment,1);
  assert.equal(p.fragmentInsideSameExplicitMillerLabeledParagraph,true);
  assert.equal(p.independentlyMatchingExplicitMillerParagraphs,1);
  assert.equal(p.fragmentWithinExplicitOtherSpeakerParagraphs,0);
  assert.equal(p.characterDistanceFromPrintedMillerLabelToFragment,242);
  assert.equal(p.proofRequiresSameParagraphStartingWithMillerLabel,true);
 }
 assert.equal(r.interpretation.earliestVerifiedVersionContainingOwnLabeledPrintedAnswerUtc,'2022-10-05T01:59:37Z');
 assert.equal(r.totals.distinctIndividualPrintedStatementCandidatePassagesAuthenticated,1);
});
test('two 2022-23 body versions are one source/one printed passage, not 2021 availability, recorded speech, actual vote or usable forecast',()=>{
 assert.equal(r.totals.distinctPublisherUrlsUnderReview,1);
 assert.equal(r.totals.previouslyAuthenticatedDistinctSourceUrlsReused,1);
 assert.equal(r.totals.newlyOriginalAuthenticatedSourceUrls,0);
 assert.equal(r.totals.priorArchiveBodyVersionsIndependentlyReverified,2);
 assert.equal(r.totals.newlyDiscoveredHtmlArchiveVersions,0);
 assert.equal(r.totals.authenticatedHistoricPagesWithShortTextInsideSamePrintedMillerParagraph,2);
 assert.equal(r.totals.originalRecordedAudioBinariesAuthenticated,0);
 assert.equal(r.totals.humanCertifiedCompleteVerbatimSpeakerQuotations,0);
 assert.equal(r.totals.recordedStateSenateMemberVotesVerified,0);
 assert.equal(r.interpretation.noEvidenceOfNovember2021AuthenticOriginalBodyPublicBy,true);
 assert.equal(r.interpretation.twoCaptureVersionsNotTwoDifferentSenatorStatements,true);
 assert.equal(r.interpretation.cannotUseToForecastAnyVoteBeforeFirstAuthenticatedCaptureUtc,true);
 assert.equal(r.interpretation.notProofOfLiveSpokenInterviewOrIndependentAudio,true);
 assert.equal(r.interpretation.noPrivateDatabaseOrCollectorOrServingOrModelChanges,true);
 assert.equal(r.interpretation.noRawHtmlOrFullInterviewPersisted,true);
});

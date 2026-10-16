import test from 'node:test';
import assert from 'node:assert/strict';
import initial from '../../docs/evaluation/senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json' with {type:'json'};
import historical from '../../docs/evaluation/senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json' with {type:'json'};
import bridge from '../../docs/evaluation/senate-media-mpr-feed-transcript-bridge-20261011.json' with {type:'json'};
import cdn from '../../docs/evaluation/senate-media-mpr-cdn-original-audio-20261011.json' with {type:'json'};
import {SOURCE_MP3S} from '../../scripts/probe-senate-media-mpr-cdn-original-mp3.mjs';

test('real first-party MP3 source receipts pin two current CDN SHA256s, never original historic audio',()=>{
 assert.equal(bridge.publisherLinkedAudio.numberCurrentlySha256VerifiedPublisherAudioBodies,2);
 assert.equal(bridge.publisherLinkedAudio.audioLeadResults.length,2);
 for(let i=0;i<SOURCE_MP3S.length;i++){
  const actual=bridge.publisherLinkedAudio.audioLeadResults[i],pin=SOURCE_MP3S[i];
  assert.equal(actual.rawCurrentMp3Sha256,pin.currentPublisherMp3Sha256);
  assert.equal(actual.rawBytes,pin.currentPublisherMp3Bytes);
  assert.equal(actual.observed200PublisherCdnHost,'download.stream.publicradio.org');
  assert.equal(actual.currentHttpStatus,200);assert.equal(actual.currentAudioMime,'audio/mpeg');
  assert.equal(actual.originalHistoricalArticleEmbedsRelatedMp3Resource,true);
  assert.equal(actual.twoSequentialAllowedPublisherRedirects,true);
  assert.equal(actual.historicalIdenticalAudioBinaryShaAuthenticated,false);
  assert.equal(actual.completeSpokenWordsReviewed,false);
 }
 assert.equal(bridge.noOriginalMp3OrHtmlOrFeedContentsPersisted,true);
 assert.equal(bridge.noHumanApprovedCompleteSpokenAudioQuotations,true);
});
test('CDN exact queryless archive index unavailability is explicitly UNKNOWN, not two missing 2021/24 recordings',()=>{
 assert.equal(cdn.distinctExactDerivedCdnOriginalUrlHypotheses,2);
 assert.equal(cdn.historicallySha1AuthenticatedOriginalMp3Bodies,0);
 assert.equal(cdn.querylessCdnUrlIsNotProvenIdenticalToQueryBearingRedirect,true);
 for(let i=0;i<SOURCE_MP3S.length;i++){
  const lead=cdn.sourceVariants[i],pin=SOURCE_MP3S[i];
  assert.equal(lead.exactOriginalUrlHypothesis,pin.derivedExactQuerylessCdnUrl);
  assert.equal(lead.sha256CurrentlyServedPublisherAudio,pin.currentPublisherMp3Sha256);
  assert.equal(lead.currentPublisherMp3RawBytes,pin.currentPublisherMp3Bytes);
  assert.equal(lead.exactHistoricalCdxStatus,'index_unavailable_unknown');
  assert.equal(lead.historicalOriginalIndexedCandidateCount,null);
  assert.equal(lead.historicalOriginalBodyAttempts,0);
  assert.equal(lead.originalHistoricalAudioByteIdentityEstablished,false);
 }
 assert.equal(cdn.unavailableIndexNotEvidenceUnpublishedOrAudioMissing,true);
 assert.equal(cdn.originalMp3NotPersisted,true);
});
test('current publisher dateModified is not a retroactive transcript insertion clock in three verified earlier originals',()=>{
 const live=bridge.originalPageSource,previous=initial.episodes[1],later=historical.originalCapturedLaterVersions;
 assert.equal(live.original,previous.originalPublisherUrl);
 assert.equal(live.currentlyDisplayedPublisherMetadata.datePublished,'2024-02-19T10:32:03-06:00');
 assert.equal(live.currentlyDisplayedPublisherMetadata.dateModified,'2024-02-19T14:15:13.000-06:00');
 assert.equal(live.dateModifiedNotProvenTranscriptInsertionTime,true);
 assert.equal(previous.historicalOriginalCaptures.length,2);
 assert.ok(previous.historicalOriginalCaptures.every(c=>c.selectedCurrentTranscriptTextAndSpeakerLabelPresent===false));
 assert.equal(later[0].shortSelectedHauschildContentFound,false);
 assert.equal(later[1].shortSelectedHauschildContentFound,true);
 assert.equal(later[1].captureUtc,'2025-07-24T23:23:22Z');
 assert.equal(live.earliestSelectedTranscriptPositiveHistoricallyShaAuthenticatedHtml,later[1].captureUtc);
 assert.equal(live.previouslyAuthenticated2025OriginalSha256,later[1].rawOriginalSha256);
 assert.equal(live.noNewAuthenticatedEarlierTranscriptPositive,true);
});
test('first party current RSS is not a source for historical podcast absence or GUID claims',()=>{
 assert.equal(bridge.currentPodcastFeed.httpBodyByteLength,114571);
 assert.equal(bridge.currentPodcastFeed.rawSha256,'cae90ba656c559a5c24aa4b6cd1ee33f0030ad9bf9c1d6a83e01cf5ca61d965b');
 assert.equal(bridge.currentPodcastFeed.targetLegacyEpisodeMatchesFound,0);
 assert.equal(bridge.currentPodcastFeed.doesNotEstablishHistoricallyAbsentPodcastEpisode,true);
 assert.equal(bridge.historicalPodcastFeed.exactCdxStatus,'index_unavailable_unknown');
 assert.equal(bridge.historicalPodcastFeed.historicallyAuthenticRssOriginalBodies,0);
 assert.equal(bridge.historicalPodcastFeed.missingIndexIsNotEvidenceOfHistoricalAbsence,true);
});
test('all four original publisher URL alternatives remain separate unverified identity hypotheses',()=>{
 assert.equal(bridge.originalPageSource.additionalExactOriginalVariantIndexStatuses.length,4);
 assert.ok(bridge.originalPageSource.additionalExactOriginalVariantIndexStatuses.every(x=>x.index==='index_unavailable_unknown'));
 assert.equal(bridge.originalPageSource.separatelyIndexedUrlVariantsNotAssumedHistoricallyEquivalent,true);
 assert.equal(bridge.originalPageSource.archived2025OriginalMetadataFetchInThisRun,'archive_mime_mismatch_unknown');
 assert.equal(bridge.originalPageSource.earlierShaAuthenticated2025VersionNotInvalidatedByTransientMimeStatus,true);
});
test('source run provenance pins successful current MP3 positive and separate zero historical MP3 check',()=>{
 assert.equal(bridge.liveOriginalEvidence.finalPositiveMp3Run.runId,38176008389);
 assert.equal(bridge.liveOriginalEvidence.finalPositiveMp3Run.decodedJsonSha256,'2e2a22463e5e0632c5065022a9d61c74de32a95262bafbb9db799bce5d63e6c3');
 assert.equal(cdn.sourcePublicRun.runId,38176260623);
 assert.equal(cdn.sourcePublicRun.decodedJsonSha256,'165cb97880c8713552b1a4bd74f1812e079f810a26fae93a5629ef13ec6e0b82');
 assert.equal(bridge.noPublisherFirstTranscriptInsertionClockEstablished,true);
 assert.equal(bridge.noOfficialRecordedIndividualLegislativeVotesAuthenticated,true);
 assert.equal(cdn.noOriginalSpokenSenatorWordsHumanApproved,true);
 assert.equal(cdn.noPrivateEvidenceOrForecastDataUsed,true);
});

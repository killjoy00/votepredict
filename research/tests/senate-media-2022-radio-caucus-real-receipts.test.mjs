import test from 'node:test';
import assert from 'node:assert/strict';
import receipts from '../../docs/evaluation/senate-media-2022-radio-and-2021-25-caucus-20261011.json' with {type:'json'};
import {ORIGINALS,PAGES,VERSION as RADIO} from '../../scripts/probe-senate-media-mpr-2022-benson-kunesh-audio-identity.mjs';
import {LEADS,VERSION as PRESS} from '../../scripts/probe-senate-media-2021-22-25-individual-caucus-originals.mjs';
const by=new Map(receipts.individualSenateFirstPartyStatementOriginals.map(x=>[x.id,x]));
test('real public Github workflow archive artifact ZIP and both raw nested JSON file fingerprints permanently pinned',()=>{
 assert.equal(receipts.version,'senate-media-2022-radio-audio-and-seven-individual-statements-evidence-receipts-v1');
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.runId,38198818192);
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.githubArtifactId,11724792173);
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.rawZipBytes,5224);
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.rawZipSha256,'f8c42d3c7200ad54b9b38acddb74f94edb05fe7f7c82b1b4b55c28ba97d304ad');
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.radioJsonBytes,10260);
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.radioJsonRawSha256,'5e72c94ddfda0deb68615a2b4bea556d82ed82e5667b6c7d4a7fe2115d317e8a');
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.pressJsonBytes,15784);
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.pressJsonRawSha256,'d52eb758e2821c5846c4bd990a5f2a1ecdec35a242358bee57795c4b1f5f7b92');
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.initialSyntheticTestsPass,10);
 assert.equal(receipts.firstSuccessfulLivePublicSourceWorkflow.initialSyntheticTestsFail,0);
});
test('two exact distinct 2022 MPR first-party programs do not share matching mp3 URI fingerprint, archived related page has identical fingerprint as current related page',()=>{
 const r=receipts.historical2022Radio;
 assert.equal(r.namedFirstPartyMprEpisodeUrl,PAGES[0].url);
 assert.equal(r.relatedButDistinctFirstPartyMprEpisodeUrl,PAGES[1].url);
 assert.deepEqual(r.namedIntervieweesOnlyAsCurrentPublisherDescription,['Michelle Benson','Mary Kunesh']);
 assert.equal(r.namedPageCurrentHtmlSha256,'66594a1810a9caba65dd8aff6f6b0c97792f529402392b057ae976bf6fbbd054');
 assert.equal(r.relatedPageCurrentHtmlSha256,'65fdf1a631aecc0e9753298bc4b8dc88a528d9faca8e898c1a279cace961fd47');
 assert.equal(r.namedCurrentFirstPartyAudioMp3UrlSha256Fingerprints.length,2);
 assert.equal(r.relatedCurrentFirstPartyAudioMp3UrlSha256Fingerprints.length,2);
 assert.ok(r.namedCurrentFirstPartyAudioMp3UrlSha256Fingerprints.every(x=>/^[a-f0-9]{64}$/.test(x)));
 assert.ok(r.namedCurrentFirstPartyAudioMp3UrlSha256Fingerprints.every(x=>!r.relatedCurrentFirstPartyAudioMp3UrlSha256Fingerprints.includes(x)));
 assert.equal(r.identicalExplicitAudioAssetUrlFingerprintCountBetweenNamedInterviewAndRelatedSameDayPage,0);
 assert.deepEqual(r.identicalAudioAssetFingerprintCountBetweenNamedCurrentPageAndTwoAuthenticated2022RelatedOriginalHtmlVersions,[0,0]);
 assert.equal(r.sameSubjectDoesNotImplySameProgramOrMp3,true);
 assert.equal(r.actualMp3ContentsNeverRequestedOrAuthenticated,true);
 assert.equal(r.speakerTranscriptOrRealVoiceNotApproved,true);
 assert.equal(RADIO,'mpr-2022-benson-kunesh-two-episode-original-audio-identity-v1');
});
test('two SHA1+raw SHA256 independently certified 2022 Feb24/Nov08 related-program original pages do NOT certify the separately named senator radio program',()=>{
 const originals=receipts.historical2022Radio.relatedHistoricalOriginalPageVersions;
 assert.equal(originals.length,2);
 for(let i=0;i<2;i++){
  const o=originals[i],p=ORIGINALS[i];
  assert.equal(o.utc,p.utc);
  assert.equal(o.indexedSha1,p.indexedSha1);
  assert.equal(o.rawHtmlSha256,p.rawSha256);
  assert.equal(o.rawBytes,p.bytes);
  assert.equal(o.sha1AndRawSha256Reverified,true);
  assert.deepEqual(o.firstPartyAudioMp3UrlSha256Fingerprints,receipts.historical2022Radio.relatedCurrentFirstPartyAudioMp3UrlSha256Fingerprints);
 }
 assert.equal(receipts.historical2022Radio.original2022NamedBensonKuneshEpisodeHtmlNotAuthenticated,true);
});
test('seven original first-party individual caucus press source URLs, four archived originals found, 7 historical raw HTML versions',()=>{
 assert.equal(LEADS.length,7);
 assert.equal(by.size,7);
 let count=0;
 for(const l of LEADS){
  const r=by.get(l.id);
  assert.equal(r.senator,l.senator);
  assert.equal(r.publisherDisplayedDay,l.displayedDay);
  count+=r.originalHtmlSourceProofs.length;
  for(const orig of r.originalHtmlSourceProofs){
   assert.match(orig.indexedOriginalSha1Base32,/^[A-Z2-7]{32}$/);
   assert.match(orig.verifiedRawHtmlSha256,/^[a-f0-9]{64}$/);
   assert.ok(orig.rawHtmlBytes>=10000);
   assert.equal(orig.selectedShortPolicyPhrasePresentInOriginalPage,true);
   assert.equal(orig.directIndividualSenatorPressReleaseNotAudioOrHumanVerbatimQuote,true);
  }
 }
 assert.equal(count,7);
 assert.equal(receipts.counts.originalArchiveVerifiedHtmlBodies,7);
 assert.equal(receipts.counts.originalArchiveVerifiedDistinctPublisherUrls,4);
 assert.equal(receipts.counts.distinctNamedServingStateSenators,5);
 assert.equal(receipts.counts.additionalNewlySelectedPressReleaseLeads,5);
 assert.equal(PRESS,'senate-media-2021-22-25-seven-first-party-individual-originals-v1');
});
test('Gazelka original 2022 Jan 14 policy remarks are independently indexed and authenticated on that very date',()=>{
 const v=by.get('2022-gazelka-crime-reform-proposed');
 assert.deepEqual(v.originalHtmlSourceProofs.map(x=>x.archiveCaptureUtc),['2022-01-14T23:25:57Z','2022-01-15T00:38:12Z']);
 assert.equal(v.originalHtmlSourceProofs[0].indexedOriginalSha1Base32,'SJ7QINZP3WX5EBNR6TV34CRBQG2LEFV6');
 assert.equal(v.originalHtmlSourceProofs[0].verifiedRawHtmlSha256,'acd579ca2f69e6ef6a18d541b7396ca7a12158a3ceefa2b71f7870b7bd328b77');
 assert.equal(v.originalHtmlSourceProofs[0].rawHtmlBytes,88497);
});
test('Weber 2022 tax statement and two Coleman Jan 2025 school-mandates original versions are archived, not model-cutoff proof',()=>{
 const w=by.get('2022-weber-state-surplus-proposals').originalHtmlSourceProofs;
 const c=by.get('2025-coleman-education-committee-mandates').originalHtmlSourceProofs;
 assert.equal(w.length,2);
 assert.equal(w[0].archiveCaptureUtc,'2022-12-14T18:59:05Z');
 assert.equal(w[0].verifiedRawHtmlSha256,'0bdc339c57bfd9a0d33b996327ae1e054fd584911ea14001187951759365edbf');
 assert.equal(w[1].archiveCaptureUtc,'2022-12-21T18:52:26Z');
 assert.equal(w[1].indexedOriginalSha1Base32,'ILOYMFWWVYOU6UKABRX4RLSHO3BCQK73');
 assert.equal(w[1].verifiedRawHtmlSha256,'6132a85c9bf17ff37048db6dc068d72131e645ae2ccc3865c01f3780c2d468a0');
 assert.equal(w[1].rawHtmlBytes,90076);
 assert.deepEqual(c.map(x=>x.archiveCaptureUtc),['2025-01-24T22:56:25Z','2025-07-24T00:46:10Z']);
 assert.equal(c[0].verifiedRawHtmlSha256,'802c0023eac6a6d3b37051fd420169bf756a79ffd41ea6b4c9f9186d8b1188ee');
 assert.equal(receipts.limitations.january2025ColemanCommitteeRemarksFollowCommitteeActionNotPredictSameAction,true);
});
test('2025 Pha individual May HOA statement authentic original after passage, different from still-unverified March Pha individual and August Coleman',()=>{
 const p=by.get('2025-pha-hoa-passage-remarks');
 assert.equal(p.originalHtmlSourceProofs.length,1);
 assert.equal(p.originalHtmlSourceProofs[0].archiveCaptureUtc,'2025-07-24T12:15:05Z');
 assert.equal(p.originalHtmlSourceProofs[0].verifiedRawHtmlSha256,'2c9b48e5d973d559685a45cb97a6a082be6caa74d79245119b10ee07728269ce');
 for(const id of ['2021-hawj-start-session','2025-pha-post-charges-child-protection','2025-coleman-post-annunciation-school-security']){
  assert.equal(by.get(id).originalHtmlSourceProofs.length,0);
  assert.equal(by.get(id).exactWaybackCdxIndex,'unavailable_unknown');
 }
 assert.equal(receipts.limitations.may2025PhaHOAStatementFollowsSenatePassageCannotPredictThatPassage,true);
 assert.equal(receipts.limitations.august2025ColemanStatementFollowsSchoolShooting,true);
 assert.equal(receipts.limitations.march2025PhaStatementFollowsCharges,true);
});
test('never substitute date printed today for historical publication, or member quote for voice, recorded vote, private corpus missingness or production model evidence',()=>{
 assert.equal(receipts.counts.originalBensonKuneshAudioMp3BodiesAuthenticated,0);
 assert.equal(receipts.counts.archivedOriginalFullNamedSenatorVerbatimAudioHumanVerified,0);
 assert.equal(receipts.counts.recordedIndividualSenateVotesVerified,0);
 assert.equal(receipts.limitations.capturedHtmlFirstProvedPresentNoLaterThanArchiveUtc,true);
 assert.equal(receipts.limitations.differentMediaUrlDoesNotProveDifferentActualAudioContentButNoEquivalenceProven,true);
 assert.equal(receipts.limitations.noPrivateNeonVotePredictDataOrProductionEvidenceSourceReconciliation,true);
 assert.equal(receipts.limitations.noRawArticleHtmlMp3PdfWarcFullTranscriptPersisted,true);
 assert.equal(receipts.limitations.noCollectorIngestionModelTrainingForecastChanges,true);
 assert.equal(receipts.firstAdditionalAuthenticatedArchiveCaptureAfterInitialRun.observedInRunId,38199182527);
 assert.equal(receipts.firstAdditionalAuthenticatedArchiveCaptureAfterInitialRun.anotherHtmlVersionOfSameWeberSourceNotAnotherNewStory,true);
});

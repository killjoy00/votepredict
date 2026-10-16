import test from 'node:test';
import assert from 'node:assert/strict';
import receipts from '../../docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json' with {type:'json'};
import earlier from '../../docs/evaluation/senate-media-2021-25-pinned-historical-original-phrase-review-queue.json' with {type:'json'};
import {PRESS,AUDIO_PINNED_FINGERPRINTS,VERSION} from '../../scripts/probe-senate-media-benson-kunesh-audio-six-direct-originals.mjs';

const verified=[
  {
    "id": "2021-coleman-sexual-assault-prospective",
    "digests": [
      {
        "utc": "2021-04-13T20:21:28Z",
        "sha1": "E5W5QIEJ7OYPSD77AZZL5LTX7JAF2RVV",
        "sha256": "14b5aad174248d5cc693ccd2c7c1f23c7bbf096b625a11f500539fcc4ba53a77",
        "bytes": 88680,
        "cue": true,
        "near": true
      },
      {
        "utc": "2022-11-08T21:59:54Z",
        "sha1": "GNBMWSJMIEJGYBSWZIC537V4U5BC3HET",
        "sha256": "477aaed6ae57a54055780014d27cf1bbed460d0a01d377895fc4bb72e32cb962",
        "bytes": 89564,
        "cue": true,
        "near": true
      }
    ]
  },
  {
    "id": "2021-miller-enterprise-manufacturing-qa",
    "digests": [
      {
        "utc": "2022-10-05T01:59:37Z",
        "sha1": "Z55ODFJANQV2PCOGS32J3IZE3GEL2DBR",
        "sha256": "28dada90321263cbf20a75cc9949c176527a97c2d89d33c0831ed63469167f36",
        "bytes": 65348,
        "cue": true,
        "near": false
      },
      {
        "utc": "2023-01-31T06:39:41Z",
        "sha1": "KDDZ7S7QX7HETNGDLYUQLZUUTAO5275J",
        "sha256": "fb8fd1d2c4bd209e54a905d5b050310a520a46d46f82c3a910a7270c723f3251",
        "bytes": 67207,
        "cue": true,
        "near": false
      }
    ]
  },
  {
    "id": "2023-pratt-budget-tax-relief",
    "digests": []
  },
  {
    "id": "2024-marty-online-sports-betting",
    "digests": [
      {
        "utc": "2024-03-02T15:32:31Z",
        "sha1": "VRFHI7EWTZONEMQQOQ43WCYTT77HZFAM",
        "sha256": "811f59a8cdd46c7e2edabb8506a01773aa95ad1f74cb9af1e6baf39f84ca965d",
        "bytes": 92875,
        "cue": true,
        "near": true
      },
      {
        "utc": "2024-05-25T19:27:51Z",
        "sha1": "CDEF57Y24B53NPWGQVHHSVUVB46WCZCV",
        "sha256": "6665e00288aa2b0be259eb86f4792171ab4dd240b67e67d9707f3b161e2b7f24",
        "bytes": 92735,
        "cue": true,
        "near": true
      }
    ]
  },
  {
    "id": "2025-pha-post-eichorn-charges",
    "digests": []
  },
  {
    "id": "2025-coleman-post-annunciation",
    "digests": []
  }
];
test('real 2026 public archive run receipt has exact study membership, no conflated original pages and versions',()=>{
 assert.equal(receipts.version,'senate-media-2022-benson-kunesh-and-six-source-originals-public-receipts-v1');
 assert.equal(receipts.source.pr,1208);
 assert.equal(receipts.source.firstSuccessfulLiveRunId,38201877808);
 assert.equal(receipts.source.publicArtifactId,11726132245);
 assert.equal(receipts.source.offlineSyntheticTestsPassed,8);
 assert.equal(receipts.counts.selectedExactPublisherPressUrls,6);
 assert.equal(receipts.counts.distinctNamedSenatorsInPressUrls,5);
 assert.equal(receipts.counts.pressOriginalUrlsAuthenticatedWithinNewRun,3);
 assert.equal(receipts.counts.archiveHtmlCaptureVersionsIndependentlyAuthenticatedWithinNewRun,6);
 assert.equal(receipts.counts.sourceUrlsAlreadyAuthenticatedInPriorPublicReceipts,2);
 assert.equal(receipts.counts.firstTimeAuthenticatedDistinctOriginalUrlsAcrossTheEarlierSample,1);
 assert.equal(receipts.counts.newArchiveVersionsOfAlreadyAuthenticatedUrls,2);
 assert.equal(receipts.sources.length,PRESS.length);
});
test('six exact original public HTTP bodies indexed SHA1 and downloaded SHA256/length immutably pinned',()=>{
 assert.deepEqual(receipts.sources.map(s=>({
  id:s.id,digests:s.archivedOriginalHtml.map(o=>({
   utc:o.captureUtc,sha1:o.indexedOriginalSha1Base32,sha256:o.rawOriginalHtmlSha256,
   bytes:o.rawOriginalBytes,cue:o.selectedShortIssueCueFoundInAuthenticatedPage,near:o.namedSenatorWithinNearbySelectedCueContext
  }))
 })),verified);
 for(let i=0;i<PRESS.length;i++){
  const p=receipts.sources[i],s=PRESS[i];
  assert.equal(p.id,s.id);
  assert.equal(p.url,s.url);
  assert.equal(p.memberId,Number(s.lrl.split('ID=')[1]));
  assert.equal(p.senator,s.senator);
  assert.equal(p.date,s.displayedDay);
  assert.ok(p.archivedOriginalHtml.every(x=>x.exactReplayStatus==='sha1_authenticated_original_publisher_html'));
 }
});
test('previously pinned Coleman and Marty first original bodies count once; Miller Enterprise is a newly authenticated URL',()=>{
 for(const [id,older] of [['2021-coleman-sexual-assault-prospective','coleman-2021-caucus-own-statement'],['2024-marty-online-sports-betting','marty-2024-betting-own-statement']]){
  const x=receipts.sources.find(s=>s.id===id).archivedOriginalHtml[0],o=earlier.cues.find(q=>q.id===older);
  assert.equal(x.captureUtc,o.archiveCapturedUtc);
  assert.equal(x.rawOriginalHtmlSha256,o.expectedRawBodySha256);
  assert.equal(x.indexedOriginalSha1Base32,o.indexedPayloadSha1Base32);
  assert.equal(x.rawOriginalBytes,o.expectedRawBodyBytes);
 }
 const miller=receipts.sources.find(s=>s.id==='2021-miller-enterprise-manufacturing-qa');
 assert.equal(miller.prior,'newly_historically_authenticated_distinct_url');
 assert.equal(miller.archivedOriginalHtml.length,2);
 assert.equal(miller.earliestAuthenticatedCaptureUtc,'2022-10-05T01:59:37Z');
 assert.ok(miller.archivedOriginalHtml.every(o=>o.selectedShortIssueCueFoundInAuthenticatedPage&&!o.namedSenatorWithinNearbySelectedCueContext));
 assert.equal(receipts.boundaries.cuePresenceWithinAFirstPartyPageNotNecessarilySpeakerTurnForMagazineQAndA,true);
});
test('no false historic Benson/Kunesh audio, 2025 post-event statements, model inference or private source missingness',()=>{
 assert.equal(VERSION,'senate-media-2022-benson-kunesh-exact-audio-and-six-direct-originals-v1');
 assert.equal(receipts.audio.namedEpisodeUrl,'https://www.mprnews.org/episode/2022/02/23/measures-give-parents-more-control-over-instruction-await-votes');
 assert.deepEqual(receipts.audio.exactAudioAssets.map(a=>a.firstPartyOriginPathSha256),AUDIO_PINNED_FINGERPRINTS);
 assert.ok(receipts.audio.exactAudioAssets.every(a=>a.exactWaybackIndexStatus==='index_unavailable_unknown'&&!a.archiveReplayVersions.length&&!a.historicMp3BinaryAuthenticated));
 assert.equal(receipts.audio.namedEpisodeHistoricalHtmlStatus.authenticatedHistoricalHtmlVersions,0);
 assert.equal(receipts.counts.exact2022NamedInterviewAudioBinariesAuthenticated,0);
 assert.equal(receipts.counts.exact2022NamedInterviewHtmlOriginalsAuthenticated,0);
 for(const id of ['2023-pratt-budget-tax-relief','2025-pha-post-eichorn-charges','2025-coleman-post-annunciation']){
  assert.equal(receipts.sources.find(x=>x.id===id).archivedOriginalHtml.length,0);
 }
 assert.equal(receipts.counts.completeSpokenSenatorQuotationsHumanApproved,0);
 assert.equal(receipts.counts.memberRollCallVotesVerified,0);
 assert.equal(receipts.boundaries.noPrivateVotePredictDatabaseOrSourceRowsAccessed,true);
 assert.equal(receipts.boundaries.noCollectorSeedPipelineModelServingOrForecastChanged,true);
 assert.equal(receipts.boundaries.noFullHtmlAudioPdfWarcOrTranscriptSaved,true);
 assert.equal(receipts.boundaries.noGlobalMissingnessInferredFromPublicArchiveOrCollectorGates,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};
import firsthand from '../docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json' with {type:'json'};
import before from '../docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json' with {type:'json'};
import {VERSION,exactLeads} from '../scripts/probe-senate-media-eight-caucus-originals.mjs';

const PINNED = [
  {
    "id": "public-2022-bigham-eken-separated",
    "utc": "2022-03-11T19:51:03Z",
    "sha1": "W6T26AXVFFZJHAPPTOFAAZB6NDQWKV76",
    "sha256": "026e8becb82577a34cc27388faed93048a6f247991853ba3f60f1a5287268131",
    "bytes": 154251,
    "cues": [
      {
        "speaker": "Karla Bigham",
        "present": true,
        "near": true
      },
      {
        "speaker": "Kent Eken",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2022-bigham-eken-separated",
    "utc": "2022-06-29T12:45:13Z",
    "sha1": "54ASOGEJRZQXKNSVI3XQKOTBVNTH4ON5",
    "sha256": "7a2621bdbe093c90c594af36124f53203399504758ce48c07eaec168afb9f06b",
    "bytes": 151424,
    "cues": [
      {
        "speaker": "Karla Bigham",
        "present": true,
        "near": true
      },
      {
        "speaker": "Kent Eken",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2023-nelson-rochester-schools",
    "utc": "2025-03-25T12:27:51Z",
    "sha1": "OWELKNZ3OF2CKTOQP4OR3XYDAKGV7UBN",
    "sha256": "005c9ade165508d9865355e2b5af05171a39e46bc0a999df02ee587750d8f7a2",
    "bytes": 95373,
    "cues": [
      {
        "speaker": "Carla Nelson",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2023-nelson-rochester-schools",
    "utc": "2025-07-22T22:42:25Z",
    "sha1": "T42RD762NRMJW4ZWAXTQI5KZLYQJPMLW",
    "sha256": "6038de654a35fe27f51e1049a5bff5a907f5c044e42e97b6a8e7b6959c8362e2",
    "bytes": 96648,
    "cues": [
      {
        "speaker": "Carla Nelson",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2024-mcewen-mining",
    "utc": "2024-04-22T03:56:26Z",
    "sha1": "LUERCXLMTQVWEL5LPAM3RDXGEBHTLMKN",
    "sha256": "d2a3d97c9519fa64f219dbd8d45be0c4c98904bde749a6a0e3c385e9bde7a6b9",
    "bytes": 94499,
    "cues": [
      {
        "speaker": "Jen McEwen",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2024-hawj-transport",
    "utc": "2024-03-24T19:01:09Z",
    "sha1": "YI4BL3IHGZ27R4JBNOVXUTI5XFGMQNSR",
    "sha256": "aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743",
    "bytes": 93076,
    "cues": [
      {
        "speaker": "Foung Hawj",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2024-hawj-transport",
    "utc": "2024-04-22T04:14:23Z",
    "sha1": "RPGCVOQOMF7AOA2UQ6R7E5QIALFQB7S2",
    "sha256": "a168aef89b0f2e50e588c1aa404491de41a241b13739edfe394e4ec6b70e0a01",
    "bytes": 93360,
    "cues": [
      {
        "speaker": "Foung Hawj",
        "present": true,
        "near": true
      }
    ]
  },
  {
    "id": "public-2025-clark-ice-student",
    "utc": "2025-03-31T08:06:09Z",
    "sha1": "ZJWOA4ZO7KQIHYZPQAOLN4P57IZOGESX",
    "sha256": "06e86faf450ecb4250a37e959d6f3dab4b08921f7c7badaf4186624eb7a2aab1",
    "bytes": 86357,
    "cues": [
      {
        "speaker": "Doron Clark",
        "present": true,
        "near": true
      }
    ]
  }
];
test('actual public historical source workflow and real SHA receipts are pinned, not merely CDX search candidates',()=>{
 assert.equal(VERSION,'senate-media-eight-selected-caucus-original-body-source-proof-v1');
 assert.equal(receipt.version,'senate-media-eight-caucus-originals-public-receipts-v1');
 assert.equal(receipt.firstSuccessfulPublicWorkflow.runId,38203331052);
 assert.equal(receipt.firstSuccessfulPublicWorkflow.initialHead,'38f775d13359534de670087602d78b123fb59302');
 assert.equal(receipt.firstSuccessfulPublicWorkflow.artifactId,11725833641);
 assert.equal(receipt.firstSuccessfulPublicWorkflow.syntheticTestsPassed,6);
 assert.equal(receipt.counts.selectedFirstPartyUrls,8);
 assert.equal(receipt.counts.distinctNamedServingSenators,9);
 assert.equal(receipt.counts.verifiedDistinctHistoricalOriginalUrls,5);
 assert.equal(receipt.counts.verifiedArchiveHtmlVersions,8);
 assert.equal(receipt.counts.namedIndividualShortCueCandidatesInHistoricalOriginalPages,6);
});
test('eight exact historical original bodies match independently indexed original SHA1, downloaded SHA256, bytes and named cue booleans',()=>{
 const got=receipt.sources.flatMap(x=>x.originals.map(o=>({id:x.id,utc:o.utc,sha1:o.indexSha1,sha256:o.rawSha256,bytes:o.bytes,
  cues:o.shortCues.map(q=>({speaker:q.name,present:q.cuePresentInOriginalVisibleBody,near:q.namedSenatorNearSelectedIssueCue}))})));
 assert.deepEqual(got,PINNED);
 assert.equal(got.length,8);
 for(const v of got){
  assert.match(v.sha1,/^[A-Z2-7]{32}$/);
  assert.match(v.sha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(v.bytes)&&v.bytes>10000);
  assert.ok(v.cues.every(x=>x.present&&x.near));
 }
 assert.ok(receipt.sources.flatMap(x=>x.originals).every(x=>x.status==='sha1_authenticated_original_publisher_html'));
});
test('source identities do not overlap previous independently researched 18 current URL leads or six recent original press sources',()=>{
 const eight=exactLeads(),old18=new Set(firsthand.selectedNewPublicSourcePages.map(x=>x.sourceUrl)),old6=new Set(before.sources.map(x=>x.url));
 assert.equal(receipt.sources.length,8);
 assert.equal(receipt.counts.sourceUrlLeadsNewlyDiscovered,0);
 for(let i=0;i<eight.length;i++){
  assert.equal(receipt.sources[i].id,eight[i].id);
  assert.equal(receipt.sources[i].url,eight[i].url);
  assert.deepEqual(receipt.sources[i].individuals.map(x=>x.name),eight[i].quoted.map(q=>q.senator));
  assert.ok(!old18.has(eight[i].url));
  assert.ok(!old6.has(eight[i].url));
 }
});
test('Bigham and Eken each have own archival cue in two versions of ONE caucus publisher article',()=>{
 const original=receipt.sources.find(x=>x.id==='public-2022-bigham-eken-separated');
 assert.deepEqual(original.individuals.map(x=>x.name),['Karla Bigham','Kent Eken']);
 assert.equal(original.originals.length,2);
 assert.deepEqual(original.originals.map(x=>x.utc),['2022-03-11T19:51:03Z','2022-06-29T12:45:13Z']);
 for(const version of original.originals){
  assert.deepEqual(version.shortCues.map(x=>x.name),['Karla Bigham','Kent Eken']);
  assert.ok(version.shortCues.every(x=>x.cuePresentInOriginalVisibleBody&&x.namedSenatorNearSelectedIssueCue));
  assert.ok(version.shortCues.every(x=>!x.completeIndividualQuotationApproved&&!x.printedQuoteTurnBoundedAndApproved));
 }
 assert.equal(receipt.boundaries.bighamEkenTwoNamedSpeakerLeadsButOneArticle,true);
});
test('McEwen and Hawj policy original evidence timing is after their hearings, not automatic vote eligibility',()=>{
 const m=receipt.sources.find(x=>x.id==='public-2024-mcewen-mining');
 const h=receipt.sources.find(x=>x.id==='public-2024-hawj-transport');
 assert.equal(m.firstVerifiedUtc,'2024-04-22T03:56:26Z');
 assert.equal(h.firstVerifiedUtc,'2024-03-24T19:01:09Z');
 assert.equal(receipt.boundaries.HawjAndMcEwenReleasesPostHearingCannotForecastEarlierHearings,true);
 assert.equal(receipt.boundaries.originalCaptureNotExactInitialPublisherTime,true);
});
test('2025 capture of Nelson 2023-displayed page cannot be treated as 2023 availability; 2025 Clark is after detention',()=>{
 const nelson=receipt.sources.find(x=>x.id==='public-2023-nelson-rochester-schools');
 const clark=receipt.sources.find(x=>x.id==='public-2025-clark-ice-student');
 assert.equal(nelson.displayDates[0],'2023-12-01');
 assert.equal(nelson.firstVerifiedUtc,'2025-03-25T12:27:51Z');
 assert.equal(clark.firstVerifiedUtc,'2025-03-31T08:06:09Z');
 assert.equal(receipt.boundaries.Nelson2025FirstCaptureDoesNotAuthenticate2023PublicationTime,true);
 assert.equal(receipt.boundaries.Clark2025StatementCannotForecastPrecedingStudentDetention,true);
});
test('unrecovered 2021 Osmek and Koran and 2025 Farnsworth originals remain UNKNOWN, never absent from publisher or private VotePredict',()=>{
 const missing=['public-2021-osmek-oath','public-2021-koran-budget','public-2025-farnsworth-mining'];
 for(const id of missing){
  const src=receipt.sources.find(x=>x.id===id);
  assert.equal(src.firstVerifiedUtc,null);
  assert.equal(src.originals.length,0);
  assert.equal(src.originalArchiveIndex,'index_unavailable_unknown');
  assert.ok(src.commonCrawlIndex.every(x=>x.indexStatus==='index_unavailable_unknown'));
 }
 assert.equal(receipt.counts.unknownOriginalSourceUrls,3);
 assert.equal(receipt.counts.humanApprovedFullSenatorQuotations,0);
 assert.equal(receipt.counts.recordedVotesVerified,0);
 assert.equal(receipt.counts.originalVoiceAudioVerified,0);
 assert.equal(receipt.boundaries.noPrivateVotePredictSourcesUsed,true);
 assert.equal(receipt.boundaries.noCollectorIngestionModelOrProductionChanges,true);
 assert.equal(receipt.boundaries.noFullArticleAudioWarcOrTranscriptCommitted,true);
});

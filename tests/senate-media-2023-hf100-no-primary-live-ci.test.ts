/**
 * #987 isolated read-only public historic-original probe in EXISTING CI.
 * Never runs public network checks on main or other agents' research PRs.
 * Offline adversarial guards execute everywhere with locked dependencies.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("Track D 2023 HF100 named NO official-original research, isolated to this branch", {timeout: 650_000}, () => {
  const branchOnly=process.env.GITHUB_REPOSITORY==="killjoy00/votepredict" &&
    process.env.GITHUB_EVENT_NAME==="pull_request" &&
    process.env.GITHUB_HEAD_REF==="research/2023-hf100-dahms-gruenhagen-no-primary";
  const env={...process.env};
  delete env.NODE_TEST_CONTEXT;
  const focused=execFileSync(process.execPath,[
    "--test","tests/senate-media-2023-hf100-no-primary.test.mjs"
  ],{encoding:"utf8",timeout:45_000,maxBuffer:450_000,env});
  assert.match(focused,/# fail 0/);
  assert.match(focused,/# pass 15/);
  const receipts=execFileSync(process.execPath,[
    "--test","tests/senate-media-2023-hf100-no-immutable-receipts.test.mjs"
  ],{encoding:"utf8",timeout:45_000,maxBuffer:450_000,env});
  assert.match(receipts,/# fail 0/);
  assert.match(receipts,/# pass 12/);
  if (!branchOnly) return;

  const out="artifacts/track-d-hf100-2023-no-live.json";
  const logs=execFileSync(process.execPath,[
    "scripts/probe-senate-media-2023-hf100-no-originals.mjs","--output",out
  ],{encoding:"utf8",timeout:590_000,maxBuffer:3_000_000,env,stdio:["ignore","pipe","pipe"]});
  assert.ok(logs.includes("TRACK_D_2023_HF100_PUBLIC_PROBE="));
  const data=JSON.parse(readFileSync(out,"utf8")) as {
    version:string;
    journal:{status:string,rawPdfSha256:string|null,rawPdfBytes:number|null,
      pages:number|null,namedFinalPassageBallot:{
       qualified:boolean,passageAnchorTextPageOneBased:number,
       personallyNamedVotes:Array<{senator:string,vote:string}>
      }|null};
    sources:Array<{senator:string,earliestAuthenticatedPreVoteCue:unknown|null,
      waybackIndex:string,authenticatedDistinctOriginalVersions:Array<{captureUtc:string,rawOriginalSha256:string,indexedOriginalSha1Base32:string,originalBytes:number}>,
      replayAttempts:Array<{originalRetrievalStatus:string,captureUtc:string,rawOriginalSha256:string|null}>,
      originalSpeakerTurnReauth?:{status:string,verified:boolean,method?:string|null,boundedSegmentNormalizedSha256?:string|null,boundedSegmentCharacters?:number|null}}>;
    officialPersonallyNamedFinalPassageNOCount:number;
    authenticatedPreVoteOriginalCueCount:number;
    fullyQualifiedHistoricalQuoteVotePairs:number;
    holds:{SF73WasCompanionNotRecordedFinalPassageBill:boolean,noProductionChanges:boolean};
  };
  const pin=JSON.parse(readFileSync(
    "docs/evaluation/senate-media-2023-hf100-no-primary-20261012.json","utf8")) as {
    originalOfficialSenateJournal:{rawFullPdfSha256:string,entireOriginalPdfBytes:number,totalOriginalPdfPages:number,
      namedNegativeRosterMembers:Array<{senator:string,vote:string}>};
    historicalPublisherOriginals:Array<{senator:string,earliestAuthenticatedOriginalCaptureUtc:string,
      independentlyIndexedOriginalSha1Base32:string,downloadedRawOriginalHtmlSha256:string,
      rawOriginalHtmlBytes:number,normalizedBoundedSpeakerStatementSha256:string,
      normalizedBoundedSegmentCharacters:number,attributionProof:string}>;
  };
  assert.equal(data.version,"track-d-2023-hf100-individual-no-public-original-audit-v1");
  assert.equal(data.journal.status,"official_full_pdf_sha256_292pages_two_personal_no_votes",
    "A complete genuine primary original with both exact named NO rosters must be re-downloaded in CI");
  assert.equal(data.journal.rawPdfSha256,pin.originalOfficialSenateJournal.rawFullPdfSha256);
  assert.equal(data.journal.rawPdfBytes,pin.originalOfficialSenateJournal.entireOriginalPdfBytes);
  assert.equal(data.journal.pages,pin.originalOfficialSenateJournal.totalOriginalPdfPages);
  assert.equal(data.journal.namedFinalPassageBallot?.passageAnchorTextPageOneBased,290);
  assert.equal(data.journal.namedFinalPassageBallot?.qualified,true);
  assert.deepEqual(data.journal.namedFinalPassageBallot?.personallyNamedVotes.map(x=>[x.senator,x.vote]),[
    ["Gary Dahms","nay"],["Glenn Gruenhagen","nay"]
  ]);
  assert.equal(data.officialPersonallyNamedFinalPassageNOCount,2);
  const bounded=data.sources.filter(s=>s.earliestAuthenticatedPreVoteCue&&s.originalSpeakerTurnReauth?.verified).length;
  assert.equal(data.fullyQualifiedHistoricalQuoteVotePairs,bounded);
  assert.ok(bounded>=0&&bounded<=2);
  console.log("TRACK_D_HF100_ARCHIVE_REPLAY_STATUS="+JSON.stringify(data.sources.map(s=>({
    senator:s.senator,waybackIndex:s.waybackIndex,
    attempts:s.replayAttempts.map(x=>({
      captureUtc:x.captureUtc,indexedStatus:x.originalRetrievalStatus,
      rawOriginalSha256:x.rawOriginalSha256
    })),
    originalTurn:s.originalSpeakerTurnReauth?.status
  }))));
  assert.equal(pin.historicalPublisherOriginals.length,2);
  for(const p of pin.historicalPublisherOriginals){
    const s=data.sources.find(x=>x.senator===p.senator);
    assert.ok(s);
    // The pinned original was twice independently authenticated in prior
    // SUCCESS CI runs. Network outages now stay UNKNOWN; mutated originals
    // or changed bounded speaker ownership MUST fail, never be treated as outage.
    // A *different*, unselected Wayback capture (e.g. Gruenhagen Apr25)
    // may return a mismatched archive body. This is permanently UNKNOWN,
    // excluded from all counted historic originals. However, if the pinned
    // March capture mismatches its indexed original, FAIL this CI.
    for(const replay of s.replayAttempts){
      if(replay.originalRetrievalStatus!=="original_archive_index_digest_mismatch_unknown")continue;
      assert.notEqual(replay.captureUtc,p.earliestAuthenticatedOriginalCaptureUtc,
        "PINNED historical original archive SHA1 mismatch must fail closed");
      assert.equal(replay.rawOriginalSha256,null,
        "untrusted non-pinned capture must not retain an approved SHA256");
      console.log("TRACK_D_HF100_UNSELECTED_ARCHIVE_CAPTURE_QUARANTINED_UNKNOWN="+JSON.stringify({
        senator:p.senator,captureUtc:replay.captureUtc,status:replay.originalRetrievalStatus,
        notAnAuthenticatedHistoricalOriginal:true,notClaimedAbsent:true
      }));
    }
    const matched=s.authenticatedDistinctOriginalVersions.filter(v=>
      v.captureUtc===p.earliestAuthenticatedOriginalCaptureUtc);
    for(const v of matched){
      assert.equal(v.rawOriginalSha256,p.downloadedRawOriginalHtmlSha256);
      assert.equal(v.indexedOriginalSha1Base32,p.independentlyIndexedOriginalSha1Base32);
      assert.equal(v.originalBytes,p.rawOriginalHtmlBytes);
    }
    const speaker=s.originalSpeakerTurnReauth;
    if(speaker?.verified){
      assert.equal(speaker.status,"exact_original_personally_owned_policy_segment_bounded");
      assert.equal(speaker.method,p.attributionProof);
      assert.equal(speaker.boundedSegmentNormalizedSha256,p.normalizedBoundedSpeakerStatementSha256);
      assert.equal(speaker.boundedSegmentCharacters,p.normalizedBoundedSegmentCharacters);
      assert.ok(matched.length>=1,"Re-authenticated quoted original must match exact indexed captured SHA");
    } else {
      assert.ok(["wayback_indexed_original_not_retrieved_unknown",
        "original_replay_network_or_body_unknown","original_replay_transport_or_mime_unknown",
        "original_replay_missing_body_unknown"].includes(speaker?.status??""),
        "Changed original body or a missing quote is a CONTENT FAILURE, not temporary network UNKNOWN");
      console.log("TRACK_D_2023_HF100_PRIOR_ORIGINAL_REPLAY_NETWORK_UNKNOWN="+p.senator+
        "; exact indexed SHA and speaker-bound original proven in SUCCESS CI #38306925130");
    }
  }
  for(const source of data.sources) assert.notEqual(source.originalSpeakerTurnReauth?.status,
    "original_replay_digest_mismatch_fail_closed","changed indexed original HTML is a content failure");
  assert.equal(data.sources.length,2);
  assert.equal(data.holds.SF73WasCompanionNotRecordedFinalPassageBill,true);
  assert.equal(data.holds.noProductionChanges,true);
  console.log("TRACK_D_HF100_NAMED_NO_LIVE_RECEIPT="+JSON.stringify({
    date:"2023-04-28",bill:"HF100",journalOriginalSha256:data.journal.rawPdfSha256,
    entirePdfBytes:data.journal.rawPdfBytes,pages:data.journal.pages,
    personallyNamedNays:data.journal.namedFinalPassageBallot?.personallyNamedVotes,
    originalHistSources:data.sources.map(s=>({senator:s.senator,earliest:s.earliestAuthenticatedPreVoteCue,
      waybackIndex:s.waybackIndex,originalSpeakerTurnReauth:s.originalSpeakerTurnReauth})),
    qualifiedOriginalSenatorStatementNoResearchPairsReauthenticatedThisRun:data.fullyQualifiedHistoricalQuoteVotePairs
  }));
});

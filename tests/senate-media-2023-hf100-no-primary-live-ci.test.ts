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
  assert.match(focused,/# pass 13/);
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
      waybackIndex:string,originalSpeakerTurnReauth?:{status:string,verified:boolean,method?:string|null,boundedSegmentNormalizedSha256?:string|null,boundedSegmentCharacters?:number|null}}>;
    officialPersonallyNamedFinalPassageNOCount:number;
    authenticatedPreVoteOriginalCueCount:number;
    fullyQualifiedHistoricalQuoteVotePairs:number;
    holds:{SF73WasCompanionNotRecordedFinalPassageBill:boolean,noProductionChanges:boolean};
  };
  assert.equal(data.version,"track-d-2023-hf100-individual-no-public-original-audit-v1");
  assert.equal(data.journal.status,"official_full_pdf_sha256_292pages_two_personal_no_votes",
    "A complete genuine primary original with both exact named NO rosters must be re-downloaded in CI");
  assert.match(data.journal.rawPdfSha256??"",/^[0-9a-f]{64}$/);
  assert.ok((data.journal.rawPdfBytes??0)>100_000);
  assert.equal(data.journal.pages,292);
  assert.equal(data.journal.namedFinalPassageBallot?.passageAnchorTextPageOneBased,290);
  assert.equal(data.journal.namedFinalPassageBallot?.qualified,true);
  assert.deepEqual(data.journal.namedFinalPassageBallot?.personallyNamedVotes.map(x=>[x.senator,x.vote]),[
    ["Gary Dahms","nay"],["Glenn Gruenhagen","nay"]
  ]);
  assert.equal(data.officialPersonallyNamedFinalPassageNOCount,2);
  const bounded=data.sources.filter(s=>s.earliestAuthenticatedPreVoteCue&&s.originalSpeakerTurnReauth?.verified).length;
  assert.equal(data.fullyQualifiedHistoricalQuoteVotePairs,bounded);
  assert.ok(bounded>=0&&bounded<=2);
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
    stillUnqualifiedSpeakerTurnCount:data.fullyQualifiedHistoricalQuoteVotePairs
  }));
});

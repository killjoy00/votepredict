/** Research-only, live Wayback diagnostic on its OWN PR branch; harmless elsewhere. */
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

test("Track D HF100 2023 cross-party candidate original archive diagnostic (own PR only)", {timeout:560_000}, ()=>{
  const branchOnly=process.env.GITHUB_REPOSITORY==="killjoy00/votepredict" &&
    process.env.GITHUB_EVENT_NAME==="pull_request" &&
    process.env.GITHUB_HEAD_REF==="research/2023-hf100-democratic-yes-crossparty-primary";
  if(!branchOnly)return;
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const stdout=execFileSync(process.execPath,[
    "scripts/probe-senate-media-2023-hf100-crossparty-candidates.mjs",
    "--output","artifacts/track-d-hf100-crossparty-candidates.json"
  ],{encoding:"utf8",timeout:510_000,maxBuffer:1_000_000,env,stdio:["ignore","pipe","pipe"]});
  assert.match(stdout,/TRACK_D_HF100_CROSSPARTY_CANDIDATES=/);
  const data=JSON.parse(readFileSync("artifacts/track-d-hf100-crossparty-candidates.json","utf8"));
  assert.equal(data.diagnosticOnly,true);
  assert.equal(data.voteBill,"HF100");
  assert.equal(data.candidates.length,4);
  assert.equal(data.approvedHistoricalCrossPartyResearchPairs,0);
  assert.equal(data.noProductionIngestionOrDatabaseOrModelChanges,true);
  console.log(stdout.slice(-60_000));
});

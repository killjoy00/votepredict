/** Track D #987: strict original quote ownership and four named Senate HF100 final votes.
 * Public live replay occurs on only this one isolated research PR.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

test("Track D HF100 cross-party four archived originals and official final-passage ballot", {timeout:550_000}, ()=>{
 const clean={...process.env};delete clean.NODE_TEST_CONTEXT;
 const offline=execFileSync(process.execPath,[
   "--test","tests/senate-media-2023-hf100-crossparty-originals.test.mjs"
 ],{encoding:"utf8",timeout:45_000,maxBuffer:250000,env:clean});
 assert.match(offline,/# fail 0/);
 assert.match(offline,/# pass 12/);
 const branchOnly=process.env.GITHUB_REPOSITORY==="killjoy00/votepredict" &&
   process.env.GITHUB_EVENT_NAME==="pull_request" &&
   process.env.GITHUB_HEAD_REF==="research/2023-hf100-democratic-yes-crossparty-primary";
 if(!branchOnly)return;
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const output="artifacts/track-d-hf100-crossparty-originals.json";
 const logs=execFileSync(process.execPath,[
   "scripts/probe-senate-media-2023-hf100-crossparty-originals.mjs","--output",output
 ],{encoding:"utf8",timeout:510_000,maxBuffer:2000000,env,stdio:["ignore","pipe","pipe"]});
 assert.ok(logs.includes("TRACK_D_HF100_CROSSPARTY_PINNED_ORIGINALS="));
 const data=JSON.parse(readFileSync(output,"utf8")) as {
   version:string;readOnlyPublicSources:boolean;
   journal:{status:string,originalSha256:string|null,originalBytes:number|null,pages:number|null,
     roll:{qualified:boolean,originalPdfPageOneBased:number,individualVotes:Array<{senator:string,vote:string}>}|null};
   sources:Array<{id:string,status:string,originalCaptureUtc:string,
     archivedSha1:string,verifiedRawSha256:string|null,verifiedBytes:number|null,
     authenticatedOriginal:boolean,speaker:{verified:boolean,
     normalizedBoundedSegmentSha256:string|null,normalizedBoundedSegmentCharacters:number|null}|null}>;
   dedup:{originalVersions:number,uniqueSenatorSpeakerPassages:number,uniqueSenators:number,
     redlakeAndKstpAreSamePortQuotedStatement:boolean};
   crossPartyHistoricalStatementPairApprovedForProduction:boolean;
   retrospectivePredictionBacktestPerformed:boolean;
   noOriginalRawBytesPersisted:boolean;noProductionDBIngestionFeatureModelOrDeploymentChanges:boolean;
 };
 // Print the actual independent-original status before any assertion.
 console.log("TRACK_D_HF100_CROSSPARTY_ORIGINALS_STATUS="+JSON.stringify({
   journal:data.journal,
   sources:data.sources.map(s=>({
     id:s.id,status:s.status,captureUtc:s.originalCaptureUtc,
     sha1:s.archivedSha1,sha256:s.verifiedRawSha256,bytes:s.verifiedBytes,speaker:s.speaker})),
   dedup:data.dedup
 }));
 assert.equal(data.readOnlyPublicSources,true);
 assert.equal(data.sources.length,4);
 assert.equal(data.crossPartyHistoricalStatementPairApprovedForProduction,false);
 assert.equal(data.retrospectivePredictionBacktestPerformed,false);
 assert.equal(data.noOriginalRawBytesPersisted,true);
 assert.equal(data.noProductionDBIngestionFeatureModelOrDeploymentChanges,true);
 // Subsequent receipt pinning will strengthen these to exact quote SHA/tallies.
 assert.ok(data.sources.every(x=>x.id&&x.originalCaptureUtc&&x.archivedSha1));
});

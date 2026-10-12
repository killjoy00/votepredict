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
 const immutable=execFileSync(process.execPath,[
   "--test","tests/senate-media-2023-hf100-crossparty-immutable-receipts.test.mjs"
 ],{encoding:"utf8",timeout:45_000,maxBuffer:250000,env:clean});
 assert.match(immutable,/# fail 0/);
 assert.match(immutable,/# pass 12/);
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
   sources:Array<{id:string,senator:string,status:string,originalCaptureUtc:string,
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
 const pin=JSON.parse(readFileSync(
   "docs/evaluation/senate-media-2023-hf100-democratic-yes-crossparty-originals-20261012.json","utf8"
 )) as {
   originalOfficialSenateJournal:{fullPdfOriginalSha256:string,fullPdfOriginalBytes:number,totalOriginalPdfPages:number,
     originalPdfPageOneBased:number,individuallyPrintedNamedFinalBallots:Array<{senator:string,vote:string}>};
   preVotePublisherOriginals:Array<{id:string,senator:string,earliestAuthenticatedOriginalCaptureUtc:string,
     independentlyIndexedOriginalSha1Base32:string,completeOriginalPublisherHtmlSha256:string,
     completeOriginalHtmlBytes:number,normalizedBoundedSpeakerStatementSha256:string,
     normalizedBoundedSegmentCharacters:number,boundedSpeakerAttributionProof:string}>;
 };
 assert.equal(data.version,"track-d-hf100-2023-two-democratic-yes-two-republican-no-original-primary-v1");
 assert.equal(data.journal.status,"official_original_292page_four_named_votes_verified");
 assert.equal(data.journal.originalSha256,pin.originalOfficialSenateJournal.fullPdfOriginalSha256);
 assert.equal(data.journal.originalBytes,pin.originalOfficialSenateJournal.fullPdfOriginalBytes);
 assert.equal(data.journal.pages,pin.originalOfficialSenateJournal.totalOriginalPdfPages);
 assert.equal(data.journal.roll?.originalPdfPageOneBased,pin.originalOfficialSenateJournal.originalPdfPageOneBased);
 assert.equal(data.journal.roll?.qualified,true);
 assert.deepEqual(data.journal.roll?.individualVotes.map(x=>[x.senator,x.vote]),
   pin.originalOfficialSenateJournal.individuallyPrintedNamedFinalBallots.map(x=>[x.senator,x.vote]));
 for(const p of pin.preVotePublisherOriginals){
   const s=data.sources.find(x=>x.id===p.id);
   assert.ok(s,"missing original publisher source "+p.id);
   assert.equal(s.senator,p.senator);
   assert.equal(s.originalCaptureUtc,p.earliestAuthenticatedOriginalCaptureUtc);
   assert.equal(s.archivedSha1,p.independentlyIndexedOriginalSha1Base32);
   assert.equal(s.status,"individually_bounded_original_quote_authenticated",
     "Pinned original must reauthenticate in live CI; an outage is UNKNOWN, not accepted proof");
   assert.equal(s.authenticatedOriginal,true);
   assert.equal(s.verifiedRawSha256,p.completeOriginalPublisherHtmlSha256);
   assert.equal(s.verifiedBytes,p.completeOriginalHtmlBytes);
   assert.equal(s.speaker?.verified,true);
   assert.equal(s.speaker?.normalizedBoundedSegmentSha256,p.normalizedBoundedSpeakerStatementSha256);
   assert.equal(s.speaker?.normalizedBoundedSegmentCharacters,p.normalizedBoundedSegmentCharacters);
 }
 assert.equal(data.dedup.originalVersions,4);
 assert.equal(data.dedup.uniqueSenatorSpeakerPassages,3);
 assert.equal(data.dedup.uniqueSenators,2);
 assert.equal(data.dedup.redlakeAndKstpAreSamePortQuotedStatement,true);
 console.log("TRACK_D_HF100_CROSSPARTY_ALL_PINNED_LIVE_VERIFIED="+JSON.stringify({
   journalOriginalSha256:data.journal.originalSha256,
   personallyNamedFinalVotes:data.journal.roll?.individualVotes,
   exactOriginals:data.sources.map(s=>({id:s.id,captureUtc:s.originalCaptureUtc,
     htmlSha256:s.verifiedRawSha256,quoteSha256:s.speaker?.normalizedBoundedSegmentSha256})),
   distinctSpeakerStatements:3
 }));
});

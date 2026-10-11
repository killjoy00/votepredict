import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const raw=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-138-original-caption-surface-first-run-ledger.json',import.meta.url));
const j=JSON.parse(raw.toString('utf8'));
const blob=createHash('sha1').update('blob '+raw.byteLength+'\\0'.replace('\\0','\0')).update(raw).digest('hex');
const statuses=['caption_payload_no_timed_rows','original_html_fetch_failed','audio_player_only_no_caption_request'];
test('real original source run including failure and four artifact digests is permanently immutable',()=>{
 assert.equal(blob,'67eadd165c115e12edeafdd41648a288a9b1c9d6');
 assert.equal(j.schemaVersion,'senate-committee-138-2022to2025-caption-source-first-run-v1');
 assert.equal(j.issue,864);
 assert.equal(j.runId,38103766440);
 assert.equal(j.runOverallConclusion,'failure');
 assert.equal(j.originalImplementationPR,999);
 assert.equal(j.originalImplementationMergeSha,'d50cff57544ae3d0d40c28590b58bddb1ce21340');
 assert.equal(j.upstreamHrefProofRun,38079233118);
 assert.equal(j.upstreamOriginalHtmlProofRun,38081463362);
 assert.deepEqual(j.years.map((x:any)=>[x.year,x.sourceArtifactId,x.jsonBytes]),[
 [2022,11687874692,12946],[2023,11688587941,64282],
 [2024,11688174345,42908],[2025,11688528042,24278]]);
 assert.ok(j.years.every((x:any)=>/^[0-9a-f]{64}$/.test(x.zipSha256)
    &&/^[0-9a-f]{64}$/.test(x.jsonSha256)));
 assert.equal(j.independentZipAndJsonChecksVerified,true);
});
test('only 136 of 138 original dated source pages verified; year 2023 remains partial',()=>{
 assert.equal(j.years.reduce((n:number,x:any)=>n+x.expectedMediaPages,0),138);
 assert.equal(j.years.reduce((n:number,x:any)=>n+x.htmlVerified,0),136);
 assert.equal(j.years.reduce((n:number,x:any)=>n+x.htmlFailed,0),2);
 assert.equal(j.years.reduce((n:number,x:any)=>n+x.pagesWithTimedCaptions,0),129);
 assert.equal(j.years.reduce((n:number,x:any)=>n+x.totalTimestampMarkers,0),356330);
 assert.deepEqual(j.years.map((x:any)=>x.status),['success','partial_failed','success','success']);
 assert.deepEqual(j.years.map((x:any)=>x.htmlFailed),[0,2,0,0]);
 assert.deepEqual(j.years.map((x:any)=>x.pagesWithTimedCaptions),[10,56,41,22]);
 assert.equal(j.summary.nonTimedSuccessfullyFetchedPages,7);
 assert.equal(j.summary.htmlFetchFailures,2);
 assert.equal(j.summary.sourceRun2023YearIncomplete,true);
 assert.equal(j.summary.official2021to2025VoteDenominator,null);
});
test('nine exact held dates/mtgid identities prevent missing media from becoming a no-vote conclusion',()=>{
 const e=j.exceptions;
 assert.equal(e.length,9);
 assert.deepEqual(e.map((r:any)=>r.mtgid),[
 '1046040','1046896','1046920','1047266','1047437','1047599','1047707','1048027','1048030']);
 assert.equal(new Set(e.map((r:any)=>r.year+'|'+r.mtgid)).size,9);
 assert.ok(e.every((r:any)=>statuses.includes(r.hold)&&r.date.startsWith(r.year+'-')));
 const counts=Object.fromEntries(statuses.map(s=>[s,e.filter((r:any)=>r.hold===s).length]));
 assert.deepEqual(counts,{caption_payload_no_timed_rows:2,original_html_fetch_failed:2,audio_player_only_no_caption_request:5});
 assert.equal(j.summary.actualAudioOrVideoPlaybackVerified,false);
 assert.equal(j.summary.actualCommitteeMotionsOrMemberVotesVerified,false);
 assert.equal(j.restrictions.originalCaptionTextOrAudioBytesCommitted,false);
 assert.equal(j.restrictions.noInferredIndividualYeaNay,true);
 assert.equal(j.restrictions.noPrivateDbAccess,true);
 assert.equal(j.restrictions.noProductionOrModelServingSchedulerFloor2027Changes,true);
 assert.equal(j.restrictions.keepIssue864Open,true);
});

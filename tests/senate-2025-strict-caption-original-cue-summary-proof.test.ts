import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {summarizeStrictCaptionCueRows}
 from '../src/evidence/senate-committee-strict-caption-cue-summary.js';

const raw=readFileSync(new URL('../docs/evaluation/source-proof/senate-2025-22-strict-caption-original-cue-source-checkpoint.json',import.meta.url));
const checkpoint=JSON.parse(raw.toString('utf8'));
const blob=createHash('sha1').update('blob '+raw.byteLength+'\0').update(raw).digest('hex');

test('actual original v2 2025 complete source artifact is pinned rather than silently corrected',()=>{
 assert.equal(blob,'da7cf2fd7ec6205dfedad360a7544d43945c903e');
 assert.equal(checkpoint.issue,864);
 assert.equal(checkpoint.originalParserRepairPR,1019);
 assert.equal(checkpoint.actualOriginalOneTimeRunId,38109398816);
 assert.equal(checkpoint.actualOriginalOneTimeRunConclusion,'success');
 assert.equal(checkpoint.originalArtifactId,11691027647);
 assert.equal(checkpoint.independentlyDownloadedAndHashVerifiedOriginalArtifactZipSha256,
  '8d50cfc1707b15c9e78d532c62f134f24471d30e7c32e1fd23005b013da91c07');
 assert.equal(checkpoint.independentlyDownloadedOriginalArtifactZipBytes,13728);
 assert.equal(checkpoint.independentlyDownloadedAndHashVerifiedUncompressedJsonSha256,
  'f1e3af71d2ed4543d3a587791ce9f54e92547faef81242618cada7cda06aef4c');
 assert.equal(checkpoint.originalUncompressedJsonBytes,98340);
 assert.equal(checkpoint.originalOneTimeResult.originalHTMLAndCaptionByteShaReverified,22);
 assert.equal(checkpoint.originalOneTimeResult.originalSourceFailures,0);
 assert.equal(checkpoint.originalOneTimeResult.originalTimeMarkersInDecodedCaptionHtml,47306);
 assert.equal(checkpoint.originalOneTimeResult.originalPagesWithAtLeastOneStrictProceduralCueWindow,18);
 assert.equal(checkpoint.originalOneTimeResult.originalTopLevelSourceCueWindowsTotal,null);
 assert.equal(checkpoint.originalOneTimeResult.sourceArtifactOldTopLevelWasNaNSerializedAsNull,true);
 assert.equal(checkpoint.originalOneTimeResult.originalTopLevelSourceCueWindowsSavedInPacket,160);
 assert.equal(checkpoint.originalOneTimeResult.independentlyRecomputedCueWindowsFromAll22IndividualSourceRecords,160);
 assert.equal(checkpoint.originalOneTimeResult.sourceCueWindowsOmittedByDisplayCap,0);
 const counts=checkpoint.originalOneTimeResult.strictNoPreviewTimeCategoryWindowCounts;
 assert.deepEqual(counts,{
   committee_recommendation:11,formal_motion_introduction:24,
   voice_vote_language:68,explicit_roll_request:29,formal_motion_result:28,
 });
 assert.equal(Object.values(counts).reduce((a:number,b:any)=>a+Number(b),0),160);
 assert.deepEqual(checkpoint.originalOneTimeResult.originalIndexedHearingDaysWithNoStrictRegexCue,
  ['2025-01-22','2025-02-17','2025-03-03','2025-03-10']);
});
test('new v2 summary retains ALL exact source-verified time windows instead of NaN/null',()=>{
 const records=[
  {categoryThirtySecondWindowsNotDistinctMotions:2,
   sourceReviewCueTimeWindows:[{cueKind:'formal_motion_introduction'},{cueKind:'voice_vote_language'}],
   cueWindowsAboveOutputCap:0},
  {categoryThirtySecondWindowsNotDistinctMotions:4,
   sourceReviewCueTimeWindows:[{cueKind:'explicit_roll_request'},{cueKind:'voice_vote_language'}],
   cueWindowsAboveOutputCap:2},
 ];
 assert.deepEqual(summarizeStrictCaptionCueRows(records),{
  sourceCueWindowsTotal:6,sourceCueWindowsInReviewPacket:4,
  sourceCueWindowsOmittedByDisplayCap:2,cueWindowTotalNotDistinctMotionsOrMemberVotes:true,
 });
});
test('stale v1 field, NaN, invented totals or inconsistent output caps fail closed',()=>{
 for(const row of [
  {totalDistinctThirtySecondCategoryCueWindows:2,sourceReviewCueTimeWindows:[],cueWindowsAboveOutputCap:0},
  {categoryThirtySecondWindowsNotDistinctMotions:null,sourceReviewCueTimeWindows:[],cueWindowsAboveOutputCap:0},
  {categoryThirtySecondWindowsNotDistinctMotions:NaN,sourceReviewCueTimeWindows:[],cueWindowsAboveOutputCap:0},
  {categoryThirtySecondWindowsNotDistinctMotions:1,sourceReviewCueTimeWindows:[],cueWindowsAboveOutputCap:0},
  {categoryThirtySecondWindowsNotDistinctMotions:2,sourceReviewCueTimeWindows:[{}],cueWindowsAboveOutputCap:0},
  {categoryThirtySecondWindowsNotDistinctMotions:1,sourceReviewCueTimeWindows:[{}],cueWindowsAboveOutputCap:-1},
 ])assert.throws(()=>summarizeStrictCaptionCueRows([row]),/strict caption cue row missing v2 fields/i);
});
test('zero match rows mean no recognized strict regex cue, never a no-motion vote claim',()=>{
 assert.deepEqual(summarizeStrictCaptionCueRows([{
   categoryThirtySecondWindowsNotDistinctMotions:0,sourceReviewCueTimeWindows:[],cueWindowsAboveOutputCap:0,
 }]),{
   sourceCueWindowsTotal:0,sourceCueWindowsInReviewPacket:0,
   sourceCueWindowsOmittedByDisplayCap:0,cueWindowTotalNotDistinctMotionsOrMemberVotes:true,
 });
 assert.equal(checkpoint.limitations.noRegexMatchesIsNotEvidenceNoMotionsOrVotes,true);
 assert.equal(checkpoint.limitations.noNamedSenatorIndividualYeaNayCertified,true);
 assert.equal(checkpoint.limitations.officialStatewide2021to2025SenateCommitteeVoteDenominator,null);
 assert.equal(checkpoint.limitations.noPrivateDatabaseReadsOrWrites,true);
 assert.equal(checkpoint.limitations.issue864MustRemainOpen,true);
});

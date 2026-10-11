import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {ORIGINAL_2024_FOUR_RETRY_SOURCE,EXACT_2024_FOUR_FAILURES,
 readExact2024FirstFailedSourceJson}
 from '../src/evidence/senate-committee-2024-four-exact-caption-failure-retry.js';
import {originalFourRetryMain}
 from '../scripts/retry-senate-2024-four-original-caption-source-failures.js';

const body=readFileSync(new URL('../docs/evaluation/source-proof/senate-2024-41-caption-cues-incomplete-first-source-proof.json',import.meta.url));
const ledger=JSON.parse(body.toString('utf8'));
const blobSha=createHash('sha1').update('blob '+body.byteLength+'\0').update(body).digest('hex');

test('unmodified first source result is permanently preserved as FAILURE, never amended to success',()=>{
 assert.equal(blobSha,'5e709e84f27922a39fa185eddc4743294c3f50a6');
 assert.equal(ledger.schemaVersion,
  'senate-2024-41-original-caption-procedural-cue-partial-first-run-permanent-proof-v1');
 assert.equal(ledger.issue,864);
 assert.equal(ledger.actualOriginalSourceRunId,38109706957);
 assert.equal(ledger.actualOriginalSourceRunConclusion,'failure');
 assert.equal(ledger.sourceImplementationPr,1026);
 assert.equal(ledger.sourceImplementationMergeSha,'e2dfb2dd407eeacc4bdfd954281c80f6df8f39d7');
 assert.equal(ledger.actualSourceArtifactId,11691581526);
 assert.equal(ledger.originalArtifactZipSha256,
  'd65e12e91b20aadbf23e1ca8a2815820253ac4bb622e352d4514ad97e6a76a03');
 assert.equal(ledger.originalArtifactZipBytes,37942);
 assert.equal(ledger.originalUncompressedJsonSha256,
  'beaa3b011257804a2672d751d07b514caa4e2f7f2dba3f238882499db4855823');
 assert.equal(ledger.originalUncompressedJsonBytes,293209);
 assert.equal(ORIGINAL_2024_FOUR_RETRY_SOURCE.previousRunStatus,'failure');
 assert.equal(ORIGINAL_2024_FOUR_RETRY_SOURCE.previousJsonSha256,
  ledger.originalUncompressedJsonSha256);
});
test('fail-closed first source-bound 37 real original caption bodies, 4 source failures and null summary',()=>{
 const v=ledger.actualPartialSourceResults;
 assert.equal(v.expectedOfficialIndexed2024NoMinutesMediaLeads,41);
 assert.equal(v.originalHTMLAndCaptionBodySHAReverified,37);
 assert.equal(v.actualFailedOriginalFetches,4);
 assert.equal(v.realCaptionTimestampMarkersIn37VerifiedBodies,110581);
 assert.equal(v.verifiedSourcePagesWithStrictCandidateProceduralCues,34);
 assert.equal(v.realTopLevelCueWindowSummary,null);
 assert.equal(v.recomputedStrictCategoryThirtySecondCueWindows,588);
 assert.equal(v.candidateCueWindowsActuallySavedInSourceArtifact,588);
 assert.equal(v.cueWindowsOmittedDueToCap,0);
 assert.deepEqual(v.strictCueCategoryCounts,{
  voice_vote_language:240,formal_motion_result:128,formal_motion_introduction:76,
  committee_recommendation:63,explicit_roll_request:75,reported_tally_language:6
 });
 assert.equal(Object.values(v.strictCueCategoryCounts).reduce(
  (n:number,x:any)=>n+Number(x),0),588);
 assert.equal(v.topLevelCueWindowSummaryNaNDueToRemovedV1Field,true);
});
test('four concrete prior original GET failures are the only retry allowlist',()=>{
 assert.deepEqual(EXACT_2024_FOUR_FAILURES,[
  {date:'2024-02-14',mtgid:'1049197',committee:'Taxes'},
  {date:'2024-02-15',mtgid:'1049227',committee:'Taxes'},
  {date:'2024-02-19',mtgid:'1049249',committee:'Jobs and Economic Development'},
  {date:'2024-04-03',mtgid:'1049765',committee:'Taxes'}
 ]);
 assert.deepEqual(ledger.fourExactSourceFetchFailures.map((x:any)=>
  ({date:x.date,mtgid:x.mtgid,committee:x.committee})),EXACT_2024_FOUR_FAILURES);
 assert.equal(new Set(EXACT_2024_FOUR_FAILURES.map(x=>x.mtgid)).size,4);
 assert.equal(ledger.limitations.onlyOriginalFourFailuresMayBeTargetedForRetry,true);
});
test('invalid prior-original artifact, invented full success or altered raw JSON cannot bypass SHA',()=>{
 for(const fake of ['{}','',JSON.stringify({records:[],failures:[]})]){
  assert.throws(()=>readExact2024FirstFailedSourceJson(fake),/original 2024 first partial-source JSON byte SHA drift/i);
 }
});
test('CLI imported by tests remains offline and rejects extra/missing parameters before network',async()=>{
 await assert.rejects(originalFourRetryMain([]),/require exact/i);
 await assert.rejects(originalFourRetryMain(['--hrefs','x']),/require exact/i);
});
test('source-only completeness never becomes verified unique votes or public historical availability',()=>{
 assert.equal(ledger.limitations.actualStatewide2021to2025CommitteeRecordedVoteDenominator,null);
 assert.equal(ledger.limitations.noHumanSpeakerOrNamedMemberYeaNayCertified,true);
 assert.equal(ledger.limitations.noRawCaptionSourceOrNamesByVoteCommitted,true);
 assert.equal(ledger.limitations.noPrivateProductionDbReadWrite,true);
 assert.equal(ledger.limitations.noModelForecastTrainingServingSchedulerFloor2027Changes,true);
 assert.equal(ledger.limitations.issue864MustRemainOpen,true);
});

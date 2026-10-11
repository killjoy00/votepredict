import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const based='../docs/evaluation/source-proof/';
const read=(name:string)=>readFileSync(new URL(based+name,import.meta.url));
const gitBlob=(b:Uint8Array)=>createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const meta=read('senate-2025-elections-eight-original-motion-context-success-ledger.json');
const j=JSON.parse(meta.toString('utf8'));
const first=read('senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json');
const prev=JSON.parse(first.toString('utf8'));

test('all actual 2025 Elections original source proof versions are immutable and do not rewrite first failed run',()=>{
 assert.equal(gitBlob(meta),'f0417a5179442f5e6b71b12b3bd571d09967aa69');
 assert.equal(gitBlob(first),'63a605e038bea5762a70be7ac79602f6c23a0924');
 assert.equal(j.issue,864);
 assert.equal(j.schemaVersion,'senate-2025-elections-eight-original-motion-context-successful-recheck-v1');
 assert.equal(j.priorOriginalAttendanceSourceRunId,38098600457);
 assert.equal(j.firstIncompleteMotionSourceRun.runId,38108205193);
 assert.equal(j.firstIncompleteMotionSourceRun.conclusion,'failure');
 assert.equal(j.firstIncompleteMotionSourceRun.originalsCompleted,1);
 assert.equal(j.firstIncompleteMotionSourceRun.rollsCompleted,1);
 assert.equal(j.firstIncompleteMotionSourceRun.artifactId,11690925461);
 assert.equal(j.firstIncompleteMotionSourceRun.artifactZipSha256,
  '552b9ed5a290f7b889ab10cc4b4690350c82e5095dfaaa31af739cfdb78e28c4');
 assert.equal(j.correctedExactSourceRun.runId,38108467376);
 assert.equal(j.correctedExactSourceRun.conclusion,'success');
 assert.equal(j.correctedExactSourceRun.implementationRepairPR,1017);
 assert.equal(j.correctedExactSourceRun.artifactId,11691340627);
 assert.equal(j.correctedExactSourceRun.artifactZipSha256,
  'eff60b06844fc6e1f651f1c2fce967098130a8d6ba8b182e5f140542fa2cf2bf');
 assert.equal(j.correctedExactSourceRun.uncompressedJsonSha256,
  '275d85eb0653c3953db87e2d15e8fc83c6fa7f76631e59931fe3995800d5faae');
 assert.equal(j.correctedExactSourceRun.uncompressedJsonBytes,16022);
});

test('exact original three PDFs and all eight 2025 named source offsets match earlier original SHA pinned attendance proof',()=>{
 assert.deepEqual(j.sourceRecords.map((r:any)=>r.date),
  ['2025-02-11','2025-03-25','2025-04-08']);
 assert.deepEqual(j.sourceRecords.map((r:any)=>r.rolls.length),[2,1,5]);
 const matched=prev.sourceRecords.filter((r:any)=>r.indexedHearingDate!=='2025-02-06');
 assert.equal(matched.length,3);
 for(let i=0;i<3;i++){
  const a=j.sourceRecords[i],b=matched.find((x:any)=>x.indexedHearingDate===a.date);
  assert.ok(b);
  assert.equal(a.pdfSha,b.shaPinnedOriginalPDF);
  assert.equal(a.textSha,b.shaPinnedExtractedText);
  assert.equal(a.pdfBytes,b.shaPinnedOriginalPdfBytes);
  for(const r of a.rolls){
   const old=b.provisionalNamedRollSourceBlocks.find((x:any)=>x.sourceTextOffset===r.offset);
   assert.ok(old);
   assert.equal(r.nearSha,old.sourceNearbyTextSha256);
   assert.equal(r.yea,old.explicitNamedYea);
   assert.equal(r.nay,old.explicitNamedNay);
   assert.equal(r.yea+r.nay,11);
   assert.match(r.previewSha,/^[a-f0-9]{64}$/);
  }
 }
 assert.equal(j.summary.originalPdfSources,3);
 assert.equal(j.summary.shaVerifiedRollContexts,8);
 assert.equal(j.summary.explicitlyNamedSourceSides,88);
 assert.equal(j.correctedExactSourceRun.sourceErrors,0);
});
test('separate procedural actions and source bill identity do not become same final-bill policy position',()=>{
 const feb=j.sourceRecords[0].rolls;
 assert.equal(feb[0].action,'oral_amendment_to_A2');
 assert.equal(feb[0].printedNearbyBill,'SF0529');
 assert.match(feb[0].billAttribution,/HOLD/);
 assert.equal(j.limits.printedFeb11SF0529VsOfficialFeb11SF0828AttributionHeld,true);
 assert.equal(j.limits.printedFeb11A2BillMayBeSourceTypo,true);
 assert.equal(feb[1].printedNearbyBill,'SF0569');
 assert.match(feb[1].action,/recommend_pass_rerefer_rules/);
 const mar=j.sourceRecords[1].rolls[0];
 assert.equal(mar.action,'SF1812_committee_recommend_pass_as_amended_rerefer_judiciary');
 assert.match(mar.separateVoiceVoteParagraphs,/no_individual_named_sides/);
 const apr=j.sourceRecords[2].rolls;
 assert.deepEqual(apr.map((x:any)=>x.action),[
  'SF2384_A20_amendment','SF2384_A32_amendment',
  'SF2384_A21_amendment','SF2384_A19_amendment',
  'prepare_SF2384_as_amended_contents_as_amendment_to_SF3096_with_technical_corrections']);
 assert.deepEqual(apr.map((x:any)=>[x.yea,x.nay]),[[5,6],[5,6],[5,6],[5,6],[6,5]]);
 assert.equal(apr[1].priorWithdrawnA32MotionSeparateFromThisVote,true);
 assert.equal(apr[4].notCommitteeRecommendationToPassSF3096,true);
 assert.equal(j.summary.allEightAlreadyCountedAmongEarlier13NoNewIncrement,true);
});
test('extra A10 7/3/1 is provisional OUTSIDE original eight and cannot infer an absent member choice',()=>{
 const a=j.newlyDiscoveredSeparateOriginalSourceLead;
 assert.equal(a.date,'2025-04-08');
 assert.equal(a.bill,'SF2384');
 assert.equal(a.amendmentLabel,'A10');
 assert.deepEqual(a.sourcePrintedVote,{yea:7,nay:3,absent:1});
 assert.equal(a.namedChoicesPrintedInNearbySourceText,10);
 assert.equal(a.sourceReportedAbsentIndividual,'Lucero');
 assert.equal(a.sourceNearbyFirstEightRollOffset,2133);
 assert.equal(a.priorNeighborhoodSha256,j.sourceRecords[2].rolls[0].nearSha);
 assert.equal(a.sourceOriginalA10EntireMotionParagraphRecheckedIndependently,false);
 assert.equal(a.certifiedDistinctAdditionalHistoricalVote,false);
 assert.equal(a.eligibleForIndividualMemberVoteImport,false);
 assert.equal(a.sourceVoiceOrAbsentCannotImputeYeaNay,true);
});
test('historical statewide vote denominator, source-to-db parity and all serving changes remain UNKNOWN/OFF',()=>{
 assert.equal(j.summary.officialFullYearVoteDenominator,null);
 assert.equal(j.summary.exactMotionUniquenessCertified,false);
 assert.equal(j.summary.privateExistingVoteRowEqualityEstablished,false);
 assert.equal(j.limits.noSameDayPrediction,true);
 assert.equal(j.limits.noProductionPrivateDbReadsOrWrites,true);
 assert.equal(j.limits.noModelForecastTrainingServingSchedulerFloor2027Changes,true);
 assert.equal(j.limits.issue864MustRemainOpen,true);
});

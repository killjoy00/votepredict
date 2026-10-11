import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const raw=(n:string)=>readFileSync(new URL('../docs/evaluation/source-proof/'+n,import.meta.url));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const blob=(b:Uint8Array)=>createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const file=raw('senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json');
const p=JSON.parse(file.toString('utf8'));
const held=JSON.parse(raw('senate-2025-elections-feb13-mar27-original-attendance-source-proof.json').toString('utf8'));
const source=raw('senate-committee-19-tally-matched-provisional-roll-review-queue.json');
const queue=JSON.parse(source.toString('utf8'));
const hex=/^[a-f0-9]{64}$/;
const dates=['2025-02-06','2025-02-11','2025-03-25','2025-04-08'];
const offsets=[[1574,1991,2250,2522,2946],[2354,3460],[1326],[2133,2401,2673,2941,3303]];

test('real successful source-run and original/input/output artifact SHA are permanently Git blob locked',()=>{
 assert.equal(blob(file),'63a605e038bea5762a70be7ac79602f6c23a0924');
 assert.equal(p.issue,864);
 assert.equal(p.schemaVersion,'senate-2025-elections-remaining-four-original-pdfs-thirteen-roll-attendance-source-proof-v1');
 assert.equal(p.actualSuccessfulOriginalSourceRunId,38098600457);
 assert.equal(p.actualSourceRunConclusion,'success');
 assert.equal(p.actualSourceRunHeadSHA,'9b612ec46bd6888bd084d99d9ab833ddfdc0786c');
 assert.equal(p.actualOutputArtifactId,11686399026);
 assert.equal(p.actualOutputArtifactZipSha256,'140604c8c7c08f7674b52e610bfeb9a58118d277e861971bbf32dd0eab55d019');
 assert.equal(p.actualOutputJsonSha256,'cf9e481ca405e1ddcd92cccbaf3387bdaf8c256888d805a2e873fec8d49e64d3');
 assert.equal(p.priorFullOriginalPDFManifestRunId,38075573031);
 assert.equal(p.priorFullOriginalPDFManifestArtifactId,11678279098);
 assert.equal(p.priorFullOriginalPDFManifestArtifactZipSha256,
    '1d156a7b6366c3a417d18f3c3868ebbad7f30bbb333d17e7ffb3c988304bd159');
 assert.equal(p.priorFullOriginalPDFManifestJsonSha256,
    '3777ace81dda499515737486e262041aea7db324d7a2b0afb2d62f7a3f02da23');
 assert.equal(blob(source),p.priorExactNineteenCandidateQueueGitBlobSha);
 assert.equal(sha(source),p.priorExactNineteenCandidateQueueJsonSha256);
 assert.equal(p.sourceReviewPR,965);
 assert.equal(p.chairDelimiterRepairPR,970);
 assert.equal(p.chairDelimiterRepairMergeSHA,p.actualSourceRunHeadSHA);
 assert.deepEqual(p.firstIncompleteAttendanceRun,{
    runId:38098209877,conclusion:'failure',originalsWithFullRosterBeforeFail:3,
    namedSourceRollsBeforeFail:8,failedHearingDate:'2025-04-08',
    reason:'source opening-attendance parser required one hardcoded named chair'});
 for(const v of [p.actualOutputArtifactZipSha256,p.actualOutputJsonSha256,
    p.priorFullOriginalPDFManifestArtifactZipSha256,p.priorFullOriginalPDFManifestJsonSha256])
   assert.match(v,hex);
});

test('all four SHA-pinned originals and thirteen exact original source roll offsets have 11 named roster sides',()=>{
 assert.equal(queue.records.length,19);
 assert.equal(p.sourceRecords.length,4);
 assert.deepEqual(p.sourceRecords.map((r:any)=>r.indexedHearingDate),dates);
 assert.deepEqual(p.sourceRecords.map((r:any)=>r.exactOriginalCandidateCount),[5,2,1,5]);
 const all=p.sourceRecords.flatMap((r:any)=>r.provisionalNamedRollSourceBlocks.map((b:any)=>({...b,doc:r})));
 assert.equal(all.length,13);
 assert.equal(new Set(all.map((x:any)=>x.doc.officialOriginalPDFUrl+'|'+x.sourceTextOffset)).size,13);
 for(let i=0;i<dates.length;i++){
  const r=p.sourceRecords[i]!,d=dates[i]!;
  assert.equal(r.year,2025);
  assert.equal(r.committeeName,'Elections');
  assert.equal(r.printedMeetingDate,d);
  assert.equal(r.printedDateMatchesIndexedHearing,true);
  assert.deepEqual([r.openingHistoricalRosterPresent,r.openingHistoricalRosterAbsent],[11,0]);
  assert.equal(r.sourceOpeningAttendancePartitionsOfficialElevenMemberRoster,true);
  assert.equal(r.provisionalNamedRollSourceBlocks.length,offsets[i]!.length);
  assert.deepEqual(r.provisionalNamedRollSourceBlocks.map((b:any)=>b.sourceTextOffset),offsets[i]);
  const u=new URL(r.officialOriginalPDFUrl);
  assert.equal(u.hostname,'www.lrl.mn.gov');
  assert.ok(u.pathname.includes('/'+d.replaceAll('-','')+'/'));
  assert.ok(Number.isInteger(r.shaPinnedOriginalPdfBytes)&&r.shaPinnedOriginalPdfBytes>300);
  assert.match(r.shaPinnedOriginalPDF,hex);
  assert.match(r.shaPinnedExtractedText,hex);
  for(const b of r.provisionalNamedRollSourceBlocks){
    const linked=queue.records.filter((q:any)=>
      q.officialSourcePdfUrl===r.officialOriginalPDFUrl&&q.sourceTextOffset===b.sourceTextOffset);
    assert.equal(linked.length,1);
    assert.deepEqual([linked[0].hearingDate,linked[0].yeaNamed,linked[0].nayNamed],
      [d,b.explicitNamedYea,b.explicitNamedNay]);
    assert.equal(linked[0].eligibleAsMemberVote,false);
    assert.equal(b.explicitNamedYea+b.explicitNamedNay,11);
    assert.match(b.sourceNearbyTextSha256,hex);
    assert.equal(b.matchesHistoricalCommitteeRoster,true);
    assert.equal(b.namedYeaNayAtOpeningAbsentMembers,0);
    assert.equal(b.candidateNotCertifiedDistinctHistoricalVote,true);
  }
 }
 assert.deepEqual([p.sourceTotalExplicitNamedYea,p.sourceTotalExplicitNamedNay,
   p.sourceTotalExplicitYeaNay],[72,71,143]);
 assert.equal(all.reduce((n:number,x:any)=>n+x.explicitNamedYea+x.explicitNamedNay,0),143);
});

test('source success is not 2025 Elections full vote denominator, final bill stance or database certification',()=>{
 assert.equal(p.originalPdfSourcesReverified,4);
 assert.equal(p.originalPdfTextSHAReverified,4);
 assert.equal(p.exactNamedRollOffsetsReverified,13);
 assert.equal(p.originalSourceAcquisitionHashOrParserFailures,0);
 assert.equal(p.printedVsIndexedHearingDateDiscrepancies,0);
 assert.equal(p.rollBlocksWithOpeningAbsentAssignedExplicitNamedVote,0);
 assert.equal(p.allSourceRollBlocksNameElevenHistoricalRosterSenators,true);
 assert.equal(p.allFourOriginalOpeningRostersPartitionElevenCommitteeMembers,true);
 assert.equal(p.explicitSourceMotionHumanCertifiedDistinctness,false);
 assert.equal(p.eligibleForAutomaticHistoricalMemberVoteImport,false);
 assert.equal(p.sourceMeetingOpeningPresenceDoesNotProveMotionTimeAttendance,true);
 assert.equal(p.sourceNumericTallyAndNameParityDoNotCertifyBillOrFloorPolicyStance,true);
 assert.equal(p.noPrivateDatabaseReadOrWrite,true);
 assert.equal(p.noModelForecastServingTrainingSchedulerFloor2027Changes,true);
 assert.equal(p.issue864MustRemainOpen,true);
 assert.equal(p.total2025ElectionsNamedCandidateBlocks,15);
 assert.equal(p.total2025ElectionsExplicitNamedSourceChoices,163);
 assert.equal(p.total2025ElectionsNamedCandidateBlocks,p.exactNamedRollOffsetsReverified+held.sourceOriginalPdfCount);
 assert.equal(p.total2025ElectionsExplicitNamedSourceChoices,p.sourceTotalExplicitYeaNay+held.sourceExplicitNamedYeaNayTotal);
 assert.equal(held.originalSourceOpeningAbsentWithExplicitYeaNayConflicts,3);
 assert.equal(p.rollBlocksWithOpeningAbsentAssignedExplicitNamedVote,0);
 assert.equal(p.all15SourceCandidateMotionDistinctnessAndPrivateDBEqualityStillUnknown,true);
});

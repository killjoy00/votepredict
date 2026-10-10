import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const b=readFileSync(new URL(
 '../docs/evaluation/source-proof/senate-2023-elections-seven-original-attendance-ten-roll-ledger.json',
 import.meta.url));
const sha=createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const p=JSON.parse(b.toString('utf8'));

test('seven original Senate committee attendance source files and archive hashes are pinned immutably',()=>{
 assert.equal(sha,'1f2c0b85e4087dc6122ddcb450b2fe1409bc4a85');
 assert.equal(p.issue,864);
 assert.equal(p.sourceReviewCodePr,936);
 assert.equal(p.originalOfficialPDFsAndHeaderReviewRun,38086725116);
 assert.equal(p.officialSevenPdfSourceAuditArtifactId,11682637939);
 assert.match(p.officialSourceAuditArtifactZipSha256,/^[a-f0-9]{64}$/);
 assert.match(p.originalSourceReviewJsonSha256,/^[a-f0-9]{64}$/);
 assert.equal(p.auditedOriginalSenateElectionPDFCount,7);
 assert.equal(p.originalPdfsByteAndTextShaReverified,7);
 assert.equal(p.sourceFailures,0);
});

test('seven original meeting dates and ten exact roll offsets have complete fourteen-member opening attendance and zero absentee-voter conflicts',()=>{
 const rows=p.originalHearingEvidence;
 assert.equal(rows.length,7);
 assert.deepEqual(rows.map((x:{hearingDate:string})=>x.hearingDate),[
  '2023-01-17','2023-02-07','2023-02-14','2023-02-21',
  '2023-03-02','2023-03-07','2023-03-14'
 ]);
 assert.equal(rows.reduce((n:number,x:{totalTallyMatchedOriginalRollBlocks:number})=>
   n+x.totalTallyMatchedOriginalRollBlocks,0),10);
 assert.equal(new Set(rows.map((x:{officialOriginalPdfUrl:string})=>x.officialOriginalPdfUrl)).size,7);
 assert.equal(p.provisionalNamedSourceRollsReverified,10);
 assert.equal(p.openingAttendanceHeaderMissingOrAmbiguous,0);
 assert.equal(p.printedMeetingDateMismatches,0);
 assert.equal(p.explicitYeaNayGivenBySourceToMembersListedAbsentAtOpening,0);
 assert.equal(p.laterRollMarksAbsentOneMemberPresentAtOpening,1);
 for(const r of rows){
  assert.equal(r.year,2023);
  assert.equal(r.officialCommitteeName,'Elections');
  assert.equal(r.openingMeetingAttendanceMembersPresent+r.openingMeetingAttendanceMembersAbsent,14);
  assert.equal(r.uniqueFourteenSenatorAttendancePartitionVerified,true);
  assert.equal(r.printedSourceMeetingDateMatchesOfficialIndexedHearingDate,true);
  assert.match(r.independentlySourceShaPinnedPdf,/^[a-f0-9]{64}$/);
  assert.match(r.independentlySourceShaPinnedExtractedText,/^[a-f0-9]{64}$/);
  assert.equal(new URL(r.officialOriginalPdfUrl).hostname,'www.lrl.mn.gov');
  assert.ok(r.officialOriginalPdfUrl.includes('/senate/2023/elections/'));
  assert.equal(r.provisionalOriginalSourceRollOffsets.length,r.totalTallyMatchedOriginalRollBlocks);
  assert.equal(r.namedYeaNayChoicesForMembersAbsentAtMeetingOpening,0);
  assert.equal(r.sourceVotesNotApprovedForPrivatePersistedHistoricalMemberVotes,true);
 }
 const march14=rows.find((x:{hearingDate:string})=>x.hearingDate==='2023-03-14');
 assert.equal(march14.laterRecordedRollSpecificAbsenceForMemberPresentAtOpening,1);
 assert.equal(march14.laterRollAbsenceDoesNotCertifyContradictionOrPhysicalPresence,true);
});

test('committee source attendance audit is not floor passage evidence nor a production data migration',()=>{
 assert.equal(p.historicalPrivateDatabaseJoinOrWritePerformed,false);
 assert.equal(p.originalSourceIndividualMemberNameChoicePairsNotPersisted,true);
 assert.equal(p.noModelForecastServingTrainingSchedulerOr2027Changes,true);
 assert.equal(p.sourceCandidateRollNotFinalVerifiedSenateFloorPassage,true);
 const x=p.unresolved;
 assert.equal(x.laterVoteSpecificAbsenceMayRepresentLeftRoom,true);
 assert.equal(x.actualMotionDistinctnessAndFullSenatorIdentityReconciliationNeeded,true);
 assert.equal(x.sourceToPersistedPrivateHistoricalEvidenceEqualityUnverified,true);
 assert.equal(x.official2021SenatePrintOnlyAnd2022PrintElectronicUnresolved,true);
 assert.equal(x.keepIssue864Open,true);
});
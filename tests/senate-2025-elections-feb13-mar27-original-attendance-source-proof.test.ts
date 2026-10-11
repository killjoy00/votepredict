import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=(n:string)=>readFileSync(new URL('../docs/evaluation/source-proof/'+n,import.meta.url));
const buf=read('senate-2025-elections-feb13-mar27-original-attendance-source-proof.json');
const p=JSON.parse(buf.toString('utf8'));
const queueBuffer=read('senate-committee-19-tally-matched-provisional-roll-review-queue.json');
const queue=JSON.parse(queueBuffer.toString('utf8'));
const blob=(b:Buffer)=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const hex64=/^[a-f0-9]{64}$/;

test('actual successful original 2025 two-HELD source-run provenance is permanent and blob locked',()=>{
  assert.equal(blob(buf),'d9c0cbcb3d3c91499146296eb3f2fbb082662616');
  assert.equal(p.issue,864);
  assert.equal(p.schemaVersion,'senate-2025-elections-two-original-conflict-sha-attendance-source-proof-v1');
  assert.equal(p.sourceReviewPr,963);
  assert.equal(p.sourceReviewMergeSha,'b4dd314cdd4c550216f8fd4763549a1482ad845e');
  assert.equal(p.actualOriginalPdfAuditRunId,38097639939);
  assert.equal(p.actualOriginalPdfAuditRunConclusion,'success');
  assert.equal(p.actualOriginalPdfAuditHeadSha,p.sourceReviewMergeSha);
  assert.equal(p.outputArtifactId,11687141180);
  assert.equal(p.outputArtifactName,'senate-2025-elections-two-held-original-attendance-proof');
  assert.equal(p.outputArtifactZipSha256,'d7feee04386f7e093f35660c757e2b9e639bb7e6bca27eb22dcd2376a77da175');
  assert.equal(p.outputJsonSha256,'90b356f7ba14370c5d4b3b70c204d9da23cbeb1c67fde48e01447021847a4439');
  assert.equal(p.originalInputManifestRunId,38075573031);
  assert.equal(p.originalInputManifestArtifactId,11678279098);
  assert.equal(p.originalInputManifestZipSha256,
    '1d156a7b6366c3a417d18f3c3868ebbad7f30bbb333d17e7ffb3c988304bd159');
  assert.equal(p.originalInputManifestJsonSha256,
    '3777ace81dda499515737486e262041aea7db324d7a2b0afb2d62f7a3f02da23');
  assert.equal(p.originalMatchedNamedSourceRunId,38079646647);
  assert.equal(p.independentRosterAuditRunId,38086019735);
  assert.equal(blob(queueBuffer),p.originalNineteenCandidateQueueGitBlobSha);
  assert.equal(createHash('sha256').update(queueBuffer).digest('hex'),p.originalNineteenCandidateQueueJsonSha256);
  for(const h of [p.originalInputManifestZipSha256,p.originalInputManifestJsonSha256,
    p.outputArtifactZipSha256,p.outputJsonSha256,p.originalNineteenCandidateQueueJsonSha256])
    assert.match(h,hex64);
});

test('two exact original source URLs, PDF/text SHA256, source offsets and named sides reproduce pinned 19 queue',()=>{
  const expected=[
    {date:'2025-02-13',offset:1114,bill:'SF1071',yea:6,nay:5,
      pdf:'a4b331f59cccdec6c4b9af4faa75bb9c5f2da3be2fb9a6d99658ff978b289fee',
      text:'181cec4fdf46b74ffcafb2325993426e4ae5477386ec538d4550b910e63e9a5a',
      context:'36fb60efad8073bd938ce02751ef3bf57862c5cb5e610ad9f18c87fac4401741'},
    {date:'2025-03-27',offset:3102,bill:'SF905',yea:8,nay:1,
      pdf:'cf6ab1eb690c5f0a5b4bdaf9799660388e61164a2b09cd421134330c25b2c1f9',
      text:'74b2c06099f3ca133d3d7cae7973b9c929909aaa767281de4a18b186344cef48',
      context:'b8ec1953d76ad9fe34b3e8da994ae20b7a6f71e8f3528f3c8e26ab130bd58d53'},
  ];
  assert.equal(p.sourceOriginalPdfCount,2);
  assert.equal(p.shaReverifiedOriginalPdfCount,2);
  assert.equal(p.shaReverifiedOriginalTextCount,2);
  assert.equal(p.exactSourceRollOffsetsReproduced,2);
  assert.equal(p.sourceOriginalAcquisitionOrHashOrParserFailures,0);
  assert.equal(queue.records.length,19);
  assert.equal(p.records.length,2);
  assert.equal(new Set(p.records.map((r:any)=>r.actualOriginalPdfUrl)).size,2);
  for(let i=0;i<2;i++){
    const r=p.records[i],e=expected[i]!;
    assert.deepEqual([r.indexedHearingDate,r.originalSourceTextOffset,r.billIdentifier,r.sourceNamedYea,r.sourceNamedNay],
      [e.date,e.offset,e.bill,e.yea,e.nay]);
    assert.equal(r.originalPdfSha256,e.pdf);
    assert.equal(r.originalTextSha256,e.text);
    assert.equal(r.originalCandidateSourcePassageSha256,e.context);
    assert.ok(Number.isInteger(r.originalPdfBytes)&&r.originalPdfBytes>300);
    const url=new URL(r.actualOriginalPdfUrl);
    assert.equal(url.hostname,'www.lrl.mn.gov');
    assert.equal(url.protocol,'https:');
    assert.ok(url.pathname.includes('/'+e.date.replaceAll('-','')+'/'));
    assert.match(r.originalPdfSha256,hex64);
    assert.match(r.originalTextSha256,hex64);
    assert.match(r.originalCandidateSourcePassageSha256,hex64);
    const linked=queue.records.filter((q:any)=>
      q.officialSourcePdfUrl===r.actualOriginalPdfUrl&&q.sourceTextOffset===r.originalSourceTextOffset);
    assert.equal(linked.length,1);
    assert.deepEqual([linked[0].hearingDate,linked[0].year,linked[0].committeeName,
      linked[0].yeaNamed,linked[0].nayNamed,linked[0].eligibleAsMemberVote],
      [e.date,2025,'Elections',e.yea,e.nay,false]);
    assert.equal(r.eligibleForProductionMemberVoteImport,false);
    assert.equal(r.sourceVoiceOrIndependentRecordingRollSidesAuthenticated,false);
    assert.equal(r.originalOpeningAttendancePartitions11MemberHistoricalRoster,true);
    assert.equal(r.printedDateMatchesIndependentIndexedHearing,false);
  }
});

test('February thirteen 3 opening-absent choice contradictions remain distinct from March twenty-seven date-only source anomaly',()=>{
  const [feb,mar]=p.records;
  assert.equal(p.sourceExplicitNamedYeaCount,14);
  assert.equal(p.sourceExplicitNamedNayCount,6);
  assert.equal(p.sourceExplicitNamedYeaNayTotal,20);
  assert.equal(p.originalPrintedDateDiscrepancies,2);
  assert.equal(p.originalSourceOpeningAbsentWithExplicitYeaNayConflicts,3);
  assert.equal(p.sourceMotionStillOnVoteCertificationHold,2);
  assert.equal(p.candidateApprovedAsHistoricalPersistedMemberVotes,0);
  assert.deepEqual([feb.originalPrintedHeadingDate,feb.originalOpeningPresent,
    feb.originalOpeningAbsent,feb.originalOpeningAbsentWithExplicitYeaOrNay,
    feb.rosterMembersWithoutNamedSourceChoice],
    ['2025-02-27',8,3,3,0]);
  assert.equal(feb.printedWeekdayMatchesPrintedDate,true);
  assert.equal(feb.originalSourceAttendanceContradiction,
    'HOLD_OPENING_ABSENT_3_EXPLICITLY_RECORDED_YEA_NAY');
  assert.equal(feb.separateFebruary27OfficialMinutesHaveDifferentAgenda,true);
  assert.deepEqual([mar.originalPrintedHeadingDate,mar.originalOpeningPresent,
    mar.originalOpeningAbsent,mar.originalOpeningAbsentWithExplicitYeaOrNay,
    mar.sourceNamedYea,mar.sourceNamedNay],
    ['2025-05-27',9,2,0,8,1]);
  assert.equal(mar.printedWeekdayMatchesPrintedDate,false);
  assert.equal(mar.originalOpeningAbsentMembersWithoutSourceNamedChoice,2);
  assert.equal(mar.sourceMotionExplicitlyStatesTwoAbsences,true);
  assert.equal(mar.missingRosterMembersNotImputedYeaNayPassOrMotionTimeAbsent,true);
  assert.equal(mar.originalSourceAttendanceContradiction,
    'NO_WITHIN_SOURCE_NAMED_CHOICE_CONFLICT_BUT_PRINTED_DATE_ERROR');
});

test('official secondary bill/media dates do not certify recorded member roll; no database or 2027 changes',()=>{
  assert.equal(p.sourceMeetingIdentitySecondarySources.length,4);
  for(const s of p.sourceMeetingIdentitySecondarySources){
    assert.equal(new URL(s.url).protocol,'https:');
    assert.ok(!/verified individual vote/i.test(s.supports));
  }
  assert.equal(p.noOriginalFullMinutesPdfTextOrMemberNameChoiceArraysCommitted,true);
  assert.equal(p.sourcePrintedDatePreservedWithoutSilentlyCorrectingOriginal,true);
  assert.equal(p.sourceOpeningAttendanceNotConflatedWithMotionTimeVote,true);
  assert.equal(p.independentPublishedBillHandlingNotConfusedWithSpeakerAttributedRollVotes,true);
  assert.equal(p.historicalMeetingHearingDatePolicySameDayForecastExcluded,true);
  assert.equal(p.noPrivateDbReadsWritesOrHistoricalCorrections,true);
  assert.equal(p.noForecastModelServingTrainingSchedulerOr2027Changed,true);
  assert.equal(p.officialAll2021To2025CommitteeVoteDenominatorUnknown,true);
  assert.equal(p.issue864MustRemainOpen,true);
});

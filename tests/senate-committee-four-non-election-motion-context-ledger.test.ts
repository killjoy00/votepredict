import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

function readJson(path:string):any {
  return JSON.parse(readFileSync(new URL('../docs/evaluation/source-proof/'+path,import.meta.url),'utf8'));
}
const p=readJson('senate-committee-four-non-elections-motion-context-ledger.json');
const queueRaw=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json',import.meta.url));
const queue=JSON.parse(queueRaw.toString('utf8'));

test('four candidate scope is exact immutable independent 19-record original source queue subset',()=>{
  const sha=createHash('sha1').update('blob '+queueRaw.byteLength+'\0').update(queueRaw).digest('hex');
  assert.equal(sha,'30f1c8ed6d2d2edcbbefadcf61f8019c1c435538');
  assert.equal(p.candidateQueueGitBlobSha,sha);
  assert.equal(p.issue,864);
  assert.equal(p.initialTallyMatchedOriginalRun,38079646647);
  assert.equal(p.independentOriginalPdfAndTextHashManifestRun,38075573031);
  assert.equal(queue.records.length,19);
  assert.equal(queue.records.filter((r:any)=>r.committeeName==='Elections').length,15);
  assert.equal(p.records.length,4);
  assert.equal(p.auditedCandidateCount,4);
  assert.equal(p.totalExplicitNamedYeaNayTokens,33);
  assert.equal(p.records.reduce((n:number,r:any)=>n+r.sourceNamedYeaCount+r.sourceNamedNayCount,0),33);
  const expected=[
    ['2023-03-03','Judiciary and Public Safety',3840,2,6],
    ['2024-02-15','Health and Human Services',4729,3,5],
    ['2024-03-07','Labor',2517,6,4],
    ['2024-03-14','Labor',2250,4,3],
  ];
  assert.deepEqual(p.records.map((r:any)=>[r.hearingDate,r.committeeName,r.sourceTextOffset,r.sourceNamedYeaCount,r.sourceNamedNayCount]),expected);
  const keys=new Set<string>();
  for(const row of p.records){
    assert.ok(!keys.has(row.officialSourcePdfUrl+'|'+row.sourceTextOffset));
    keys.add(row.officialSourcePdfUrl+'|'+row.sourceTextOffset);
    const q=queue.records.filter((r:any)=>r.officialSourcePdfUrl===row.officialSourcePdfUrl && r.sourceTextOffset===row.sourceTextOffset);
    assert.equal(q.length,1);
    assert.deepEqual([row.year,row.hearingDate,row.committeeName,row.sourceNamedYeaCount,row.sourceNamedNayCount],
      [q[0].year,q[0].hearingDate,q[0].committeeName,q[0].yeaNamed,q[0].nayNamed]);
    const u=new URL(row.officialSourcePdfUrl);
    assert.equal(u.protocol,'https:');
    assert.equal(u.hostname,'www.lrl.mn.gov');
    assert.ok(u.pathname.includes('/'+row.hearingDate.replaceAll('-','')+'/'));
    assert.equal(row.eligibleForPersistedIndividualMemberVote,false);
    assert.equal(row.independentHistoricalCommitteeMembershipVerified,false);
    assert.equal(row.finalFloorOrBillPolicyStanceInferred,false);
    assert.equal(row.motionIdentity.separatelyVerifiedSourceMotionIdentity,false);
  }
});

test('original motion identities distinguish amendment outcomes from committee recommendations',()=>{
  const [jud,health,march7,march14]=p.records;
  assert.deepEqual([jud.motionIdentity.billIdentifier,jud.motionIdentity.actionKind,jud.motionIdentity.amendmentIdentifier,jud.motionIdentity.recordedOutcome],
    ['SF47','AMENDMENT','A-3','FAILED']);
  assert.deepEqual([health.motionIdentity.billIdentifier,health.motionIdentity.actionKind,health.motionIdentity.amendmentIdentifier,health.motionIdentity.recordedOutcome],
    ['SF610','AMENDMENT','A2','FAILED']);
  assert.deepEqual([march14.motionIdentity.billIdentifier,march14.motionIdentity.actionKind,march14.motionIdentity.amendmentIdentifier,march14.motionIdentity.recordedOutcome],
    ['SF4742','COMMITTEE_RECOMMENDATION_AS_AMENDED',null,'ADOPTED']);
  for(const r of [jud,health,march14])assert.equal(r.motionIdentity.reviewState,'OFFICIAL_MINUTES_CONTEXT_IDENTIFIED_ROSTER_PENDING');
  assert.equal(p.sourceContextIdentifiedCount,4);
  assert.equal(p.sourceContextOnHoldCount,0);
  assert.equal(march7.motionIdentity.reviewState,'OFFICIAL_SENATE_MINUTES_CONTEXT_IDENTIFIED_LRL_PDF_PARITY_PENDING');
  assert.deepEqual([march7.motionIdentity.billIdentifier,march7.motionIdentity.actionKind,march7.motionIdentity.amendmentIdentifier,march7.motionIdentity.recordedOutcome],
    ['SF4483','COMMITTEE_RECOMMENDATION_AS_AMENDED',null,'ADOPTED']);
  assert.equal(march7.officialSenatePublishedMinutesSourceUrl,
    'https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=18367&ls=93');
  assert.equal(march7.officialSenateMinutePageNotIndependentOfArchivedLrlMinutes,true);
  assert.equal(march7.originalLrlPdfVersusOfficialSenateHtmlSemanticParityStillRequiresReview,false);
  assert.equal(march7.originalLrlPdfVsSenateHtmlMotionBillTallyNamedSidesVerifiedInLaterSourceRun,38093480954);
  assert.equal(march7.originalLrlPdfVsSenateHtmlFullDocumentByteOrSemanticIdentityVerified,false);
});

test('attendance is a per-roll gate, and repeated recommendation text cannot become another named roll',()=>{
  const [jud,health,march7,labor]=p.records;
  assert.deepEqual([jud.originalOpeningPresentCount,jud.originalOpeningAbsentCount,jud.choiceGivenToOpeningAbsentMemberCount],[8,2,0]);
  assert.deepEqual([health.originalOpeningPresentCount,health.originalOpeningAbsentCount,health.rollSpecificAbsentCount],[8,1,1]);
  assert.equal(health.choiceGivenToOpeningAbsentMemberCount,0);
  assert.deepEqual([march7.originalOpeningPresentCount,march7.originalOpeningAbsentCount,march7.choiceGivenToOpeningAbsentMemberCount],[10,0,0]);
  assert.equal(march7.rollSpecificAbsentCount,null);
  assert.equal(march7.sourceRestatesRecommendationWithoutSecondNamedRoll,true);
  assert.deepEqual([labor.originalOpeningPresentCount,labor.originalOpeningAbsentCount,labor.rollSpecificAbsentCount],[9,1,3]);
  assert.equal(labor.choiceGivenToOpeningAbsentMemberCount,0);
  assert.equal(labor.presentAtOpeningButLaterRollAbsentCount,2);
  assert.equal(labor.sourceRestatesRecommendationWithoutSecondNamedRoll,true);
  assert.equal(labor.sourceNamedYeaCount+labor.sourceNamedNayCount,7);
  assert.equal(p.limitations.missingIndividualVotesNotInferredFromAttendance,true);
  assert.equal(p.limitations.sourceMotionNarrativeMayContainRepetitions,true);
});

test('semantic observations and source mirroring are not independent second-source or database proof',()=>{
  assert.equal(p.originalPdfAndTextShaReverifiedByThisSemanticLedger,false);
  assert.equal(p.sourceMirrorIsIndependentCorroboration,false);
  assert.equal(p.originalLrlPdfVersusSenatePublishedMarch7ParityVerifiedByThisReview,false);
  assert.equal(p.actualOneTimeFourOriginalSourceRunAfterInitialSemanticReview,38093480954);
  assert.equal(p.originalLrlPdfAndTextReverifiedInSubsequentIndependentRun,true);
  assert.equal(p.records[1].absentSectionNotLocatedByActualAutomatedOriginalSourceReviewRun,38093480954);
  assert.equal(p.records[1].openingAbsentMembershipFullyMachineCertified,false);
  assert.equal(p.records[1].machineFoundNoAbsenteeChoicesDoesNotCertifyZeroConflicts,true);
  assert.equal(p.limitations.needsIndependentMotionBillLogAndHistoricalRosterReview,true);
  assert.equal(p.limitations.dbReconciliationOrWritesPerformed,false);
  assert.equal(p.limitations.modelForecastServingScheduler2027Changed,false);
  assert.equal(p.limitations.issue864MustStayOpen,true);
  assert.equal(p.limitations.memberChoiceNamesAndOriginalPdfBodiesNeverStored,true);
});

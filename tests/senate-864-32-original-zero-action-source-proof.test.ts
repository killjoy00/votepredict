import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-568-zero-action-32-original-pdf-sha-audit-receipts.json','utf8'));
const pinned=[
 [2022,11947644996,'a7e6fe5b4b232e0bacd78de9fd9bb16f1e02f523add82c8d5447849752ee9fb3',2],
 [2023,11947719486,'5448527da4f19faa688f8fa7cd2fb49590842aaba420812a84ccd0e02b73a6c4',3],
 [2024,11947619791,'ede99f0d0385184f2ec833dc92e28379329a673a0abb785db6c9d12fa082638d',5],
 [2025,11947834531,'57f6c9b021c4ada542ad65acbaf09392f0075d01cba316e0d1729913fbcf3a0a',1]
] as const;
test('31+one separately original source proofs preserve 32 SHA-authenticated PDF bodies and exactly 11 flagged original motion cues',()=>{
 assert.equal(r.schemaVersion,'senate-864-32-verified-original-zero-firstpass-action-source-recall-v1');
 assert.deepEqual(r.scopeYears,[2022,2023,2024,2025]);
 assert.equal(r.exclude2021Completely,true);
 assert.equal(r.originalFrozenZeroActionMeetingDates,568);
 assert.equal(r.originalFrozenZeroActionMeetingsNeedingOcr,197);
 assert.equal(r.originalFrozenZeroActionMeetingsEmbeddedText,371);
 assert.equal(r.actualOriginalSourceCohortSampled,32);
 assert.equal(r.originalRawPdfShaReverified,32);
 assert.equal(r.heldOrMissingOriginalPdfBodies,0);
 assert.equal(r.flaggedOriginalMeetingsForActionReview,11);
 assert.equal(r.unflaggedOriginalMeetingsStillNotCertifiedNoVote,21);
 assert.equal(r.sourceToActualStoredEventOrMemberChoicesCompared,false);
 assert.equal(r.namedIndividualVotesAscertainedFromAggregateCountsOrMotionCues,0);
 assert.equal(r.noProductionDatabaseWriteReadOrModelRetraining,true);
 assert.equal(r.perYear.length,4);
 assert.equal(r.perYear.reduce((s:any,x:any)=>s+x.originalRawPdfsShaVerified,0),32);
 assert.equal(r.perYear.reduce((s:any,x:any)=>s+x.originalWithMotionOrRollCuesNeedingReview,0),11);
});
test('four immutable GitHub artifact SHAs bind 11 review leads by year, exact committee, year and hearing day, no 2021 source',()=>{
 for(const [i,expected] of pinned.entries()){
  const row=r.perYear[i];
  const [year,artifactId,zipSha,flagged]=expected;
  assert.equal(row.year,year);
  assert.equal(row.originalSourceArtifactId,artifactId);
  assert.equal(row.originalSourceArtifactZipSha256,zipSha);
  assert.equal(row.originalOcrSample,4);
  assert.equal(row.originalEmbeddedTextSample,4);
  assert.equal(row.originalWithMotionOrRollCuesNeedingReview,flagged);
  assert.equal(row.flaggedOriginalMeetings.length,flagged);
  assert.equal(row.originalActionsOfficiallyDistinctOrAllRecorded,false);
  assert.ok(row.flaggedOriginalMeetings.every((x:any)=>
   x.hearingDate.startsWith(String(year)+'-')&&x.committeeName.length>2&&
   x.humanMotionAnchorReviewOutstanding===true&&
   x.noMissingIndividualMemberVoteYetEstablished===true));
 }
 const names=r.perYear.flatMap((y:any)=>y.flaggedOriginalMeetings.map((x:any)=>
  [y.year,x.committeeName,x.hearingDate].join('|')));
 assert.equal(new Set(names).size,11);
 assert.ok(!names.some((n:string)=>n.includes('2021')));
});

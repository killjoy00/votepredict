import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2023-transportation-apr03-sf3157-seven-roll-original-success.json','utf8'
));

test('immutable independent original 2023 SF3157 HTML + success artifact ZIP/JSON hash proof',()=>{
 assert.equal(p.schemaVersion,
  'senate-2023-transportation-apr03-sf3157-original-seven-named-roll-source-success-v1');
 assert.equal(p.issue,864);
 assert.deepEqual([p.committee,p.historicalHearingDate,p.bill,p.hearingId],
  ['Transportation','2023-04-03','SF3157',17939]);
 const s=p.originalSource,r=p.successfulSeparateSourceRetry;
 assert.equal(s.originalHtmlBytes,78781);
 assert.equal(s.originalHtmlSHA256,
  'efbcf9bf503fcde638854a244748959e89ed336079099a51a44a16bb9bc1c203');
 assert.equal(s.successfullyNormalizedHtmlVisibleTextSHA256,
  'fec24f9c12f33b48d1ccd6554f707af3a3bab6c3a71a223d1829df02ac807308');
 assert.equal(s.htmlNormalizedShaChangedOnlyBecauseNamedCurlyHtmlEntitiesNowDecoded,true);
 assert.equal(s.firstPublicationAtMinuteResolutionKnown,false);
 assert.equal(s.sameDayForecastEligibleWithoutMotionTime,false);
 assert.equal(r.parserRepairPR,1083);
 assert.equal(r.parserRepairMergedCommit,'ecf59a2a48b974b0d4e94c3030a963802cf6587f');
 assert.equal(r.runId,38158753381);
 assert.equal(r.conclusion,'success');
 assert.equal(r.failedSourceChecks,0);
 assert.equal(r.originalHtmlReadAndAuthenticated,true);
 assert.equal(r.artifactId,11709532904);
 assert.equal(r.independentlyDownloadedArtifactZipBytes,2653);
 assert.equal(r.independentlyDownloadedArtifactZipSHA256,
  'cfe66655a5e18dc3d65cc88ac4177b9c92b1c68bce0ac1a4fbc5eeabe1b27ff1');
 assert.equal(r.decodedJsonEntryName,'sf3157-original-entities-retry.json');
 assert.equal(r.independentlyDecodedOriginalJsonBytes,13050);
 assert.equal(r.independentlyDecodedOriginalJsonSHA256,
  '05519e16fdc9d8ac65b5f18a06e30a4531f129a95e124211cd949456fa1d50a9');
});

test('first source with exact identical original HTML remains FAILED, not relabeled success',()=>{
 const x=p.firstOriginalSourceRun;
 assert.equal(x.runnerPR,1078);
 assert.equal(x.mergedCommit,'4f77962b0fc6d629d964f5682ea67dbdcb352a48');
 assert.equal(x.originalRunId,38158242090);
 assert.equal(x.conclusion,'failure');
 assert.equal(x.artifactId,11708857555);
 assert.equal(x.zipSHA256,
  '6a4d5998d2dd250b3fc82197325ffb22165130eef5c27bdef7fe48b31d6cbe55');
 assert.equal(x.decodedJsonSHA256,
  '3f2bdd8aa68a6fd32ecf13b0d3362eb52fef8ca38125f2110b504ce6e6b0546b');
 assert.equal(x.originalBytesWereSuccessfullyObtainedAndHashed,true);
 assert.equal(x.sevenRollsWereNotAuthenticatedOnThisRun,true);
});

test('original seven named ten-member partitions and A49/A26 conflict exactly retained',()=>{
 const rows=p.motionRecords;
 assert.equal(rows.length,7);
 assert.deepEqual(rows.map((x:{amendment:string;mover:string;yea:number;nay:number;absent:number;outcome:string;printedClosing:string;conflict:boolean})=>
  [x.amendment,x.mover,x.yea,x.nay,x.absent,x.outcome,x.printedClosing,x.conflict]),[
  ['A28','Jasinski',8,0,2,'adopted','A28',false],
  ['A17','Howe',2,6,2,'failed','A17',false],
  ['A20','Jasinski',5,4,1,'adopted','A20',false],
  ['A35','Jasinski',3,6,1,'failed','A35',false],
  ['A30','Howe',3,5,2,'failed','A30',false],
  ['A26','Jasinski',2,6,2,'failed','A26',false],
  ['A49 oral','Howe',2,6,2,'failed','A26',true]
 ]);
 assert.deepEqual(rows.map((r:{at:number})=>r.at),
  [7151,8970,9523,10157,10518,11352,12138]);
 for(const row of rows){
  assert.equal(row.yea+row.nay+row.absent,10);
  assert.match(row.sha,/^[a-f0-9]{64}$/);
 }
 const q=p.sourceRollSummary;
 assert.deepEqual([q.rollParagraphs,q.labelConsistent,q.labelConflict,
  q.totalNamedYeaChoices,q.totalNamedNayChoices,q.totalNamedAbsentChoices,
  q.totalPrintedSideTokens],[7,6,1,25,33,12,70]);
 assert.equal(q.allMotionPartitionsExactlyTen,true);
 assert.equal(rows[6].conflict,true);
 assert.equal(rows[6].printedClosing,'A26');
 assert.equal(rows[5].amendment,'A26');
});

test('original source proof is not member_vote parity or 2021-25 statewide completeness',()=>{
 for(const [key,value] of Object.entries(p.restrictions))
  assert.equal(value,true,key);
});

import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const FILE='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-source-receipts.json';
const SCOPE='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json';
function read(){return JSON.parse(readFileSync(FILE,'utf8'))}
test('permanent original government Clerk source receipt binds exactly 53 original 2024/25 LRL no-PDF identities',()=>{
 const r=read(),scope=JSON.parse(readFileSync(SCOPE,'utf8'));
 assert.equal(r.schemaVersion,'senate-864-2024-25-53-original-government-calendar-and-senate-clerk-sha-receipts-v1');
 assert.equal(r.sourceRunId,38356266030);
 assert.equal(r.originalArtifactId,11793092567);
 assert.equal(r.originalArtifactZipSha256,'9a0cd20af3d8357918ebed84398ea42e6fed51cb09681bb317f8e13b3541ed80');
 assert.equal(r.originalGovernmentLRLCensus.originalJsonSha256,
  'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0');
 assert.equal(r.everyOriginalMeeting.length,53);
 assert.equal(scope.meetings.length,53);
 const index=new Map(scope.meetings.map((m:any)=>[m.year+'|'+m.hearingDate+'|'+m.committeeName,m]));
 const seen=new Set<string>();
 for(const doc of r.everyOriginalMeeting){
  const k=doc.year+'|'+doc.hearingDate+'|'+doc.committeeName;
  assert.ok(index.has(k),'Every SHA-proven alternate must match original LRL date/committee');
  assert.equal(seen.has(k),false);
  seen.add(k);
  assert.equal(doc.calendarSha===null||/^[a-f0-9]{64}$/.test(doc.calendarSha),true);
  if(doc.senateClerkHtmlSha!==null){
   assert.match(doc.senateClerkHtmlSha,/^[a-f0-9]{64}$/);
   assert.match(doc.senateClerkTextSha,/^[a-f0-9]{64}$/);
   assert.ok(Number.isInteger(doc.originalHearingId));
   assert.equal(doc.status,'independently_authenticated_original_senate_clerk_minutes');
   assert.ok(Number.isSafeInteger(doc.actionCandidates)&&doc.actionCandidates>=0);
  }else{
   assert.match(doc.status,/HOLD$/);
   assert.equal(doc.senateClerkTextSha,null);
   assert.equal(doc.actionCandidates,null);
  }
 }
 assert.equal(seen.size,53);
 assert.equal(r.senateClerkOriginalsIndependentlyAuthenticated,38);
 assert.equal(r.remainingNoAuthenticatedClerkOriginal,15);
});
test('original named roll source counts conserved without private member_vote, migration, replay or publication-by false claims',()=>{
 const r=read();
 const sum=(name:string)=>r.everyOriginalMeeting.reduce((n:number,d:any)=>n+(d[name]??0),0);
 assert.equal(sum('actionCandidates'),117);
 assert.equal(sum('resultOnly'),96);
 assert.equal(sum('countOnly'),1);
 assert.equal(sum('voice'),5);
 assert.equal(sum('originalExplicitNamedRolls'),15);
 assert.equal(sum('originalExplicitNamedChoiceEntries'),191);
 assert.equal(r.provisionalSourceActionCandidates,117);
 assert.equal(r.originalExplicitNamedRollCandidates,15);
 assert.equal(r.originalExactNamedYeaNayChoiceEntriesButNoHistoricallyMatchedMemberId,191);
 assert.equal(r.originalResultOnlyCandidates,96);
 assert.equal(r.originalAggregateCountOnlyCandidates,1);
 assert.equal(r.originalVoiceAmendmentCandidates,5);
 assert.equal(96+1+5+15,117);
 assert.equal(r.memberVotesImportedOrHistoricallyRosterJoined,false);
 assert.equal(r.noProductionDbReadOrWrite,true);
 assert.equal(r.noOriginalClerkHtmlDateFirstPublicByKnown,true);
 assert.equal(r.allOfficialParliamentaryMotionsDenominatorUnknown,true);
 const body=JSON.stringify(r);
 assert.doesNotMatch(body,/normalizedMemberName|sourceNameChoiceSha256|memberVoteRowId|storedVoteEventId/i);
});
test('exact official group rollup: 2024 State 13/13 Clerk, Taxes 12/23, 2025 Energy 13/17',()=>{
 const r=read();
 assert.deepEqual(r.byOriginalCommitteeYear.map((x:any)=>[
  x.year,x.committeeName,x.lrlIndexedWithoutOriginalMinutesPdf,
  x.independentSenateOnlineClerkHtmlShaAuthenticated,x.sourceStillHeld,
  x.sourceNamedRollCandidates,x.sourceNamedRollChoiceEntries,
 ]),[
  [2024,'Taxes',23,12,11,0,0],
  [2024,'State and Local Government and Veterans',13,13,0,15,191],
  [2025,'Energy, Utilities, Environment, and Climate',17,13,4,0,0],
 ]);
 const solo=r.everyOriginalMeeting.filter((x:any)=>x.identityProofTier===
  'official_calendar_single_named_senate_anchor_plus_independently_authenticated_original_clerk_body');
 assert.deepEqual(solo.map((x:any)=>[x.hearingDate,x.originalHearingId]),
  [['2024-04-05',18636],['2024-04-19',18710]]);
 assert.equal(r.singleCalendarSenateAnchorWithoutCardButIndependentlyClerkConfirmed,2);
 const canceled=r.everyOriginalMeeting.filter((x:any)=>x.canceledAndClerkProven===true);
 assert.deepEqual(canceled.map((x:any)=>[x.hearingDate,x.committeeName]),[
  ['2024-03-14','State and Local Government and Veterans'],
 ]);
});

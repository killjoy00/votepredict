import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const PROOF='docs/evaluation/source-proof/senate-864-2022-24-25-other-24-original-clerk-two-run-source-receipts.json';
const SOURCE141='docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json';
const SOURCE53='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('two independently successful original source runs preserve 15/24 dated Clerk sources even if one later transport attempt fails',()=>{
 const r=read(PROOF),original=read(SOURCE141),hi=read(SOURCE53);
 assert.equal(r.schemaVersion,'senate-864-two-run-independent-original-source-union-other-24-v1');
 assert.deepEqual(r.activeYears,[2022,2023,2024,2025]);
 assert.equal(r.exclude2021Research,true);
 assert.equal(r.originalOfficialLrlMeetingIndexSha256,original.originalIndexedCensus.originalJsonSha256);
 assert.equal(hi.original141NoMinutesRoster.originalCensusJsonSha256,r.originalOfficialLrlMeetingIndexSha256);
 assert.equal(r.independentOriginalSourceRuns.length,2);
 assert.deepEqual(r.independentOriginalSourceRuns.map((x:any)=>[
  x.runId,x.artifactId,x.artifactZipSha256,x.sourceRunConclusion]),[
  [38507485246,11868237428,'0a9bc4b9eabd88eece55347056b55e3cde7bf1a11877c32a88de37537cc0ba0d','success'],
  [38507690454,11868049035,'1daffffc6d8925ebd030260ecafb731d52393eaea532c8f83288cb93635f75f6','success'],
 ]);
 assert.equal(r.perOriginalIndexedMeeting.length,24);
 assert.deepEqual(r.byYear.map((x:any)=>[
  x.year,x.originalIndexedNoLrlPdfMeetings,
  x.independentlyAuthenticatedClerkHtmlMeetings,x.originalClerkSourceHolds]),[
  [2022,12,7,5],[2024,6,3,3],[2025,6,5,1]
 ]);
 assert.equal(r.newOriginalSenateClerkMinutesAuthentications,15);
 assert.equal(r.stillUnverifiedOriginalSenateClerkMinuteMeetings,9);
 const indexed=new Set<string>(original.meetingGroups.flatMap((g:any)=>
  g.missingMinutesMeetingDates.map((d:string)=>g.year+'|'+g.committeeName+'|'+g.year+'-'+d)));
 const used=new Set<string>();
 let proved=0;
 for(const x of r.perOriginalIndexedMeeting){
  const k=x.year+'|'+x.committeeName+'|'+x.hearingDate;
  assert.equal(indexed.has(k),true);
  assert.equal(used.has(k),false);
  used.add(k);
  assert.equal([2022,2024,2025].includes(x.year),true);
  if(x.authenticatedClerkOriginalBoolean){
   proved++;
   assert.equal(x.sourceStatus,'official_original_clerk_html_SHA_authenticated');
   assert.match(x.originalClerkHtmlSha256,/^[a-f0-9]{64}$/);
   assert.match(x.originalClerkTextSha256,/^[a-f0-9]{64}$/);
   assert.ok(Number.isSafeInteger(x.governmentSenateHearingId));
   assert.ok(x.successfulOriginalSourceRunIds.length>=1);
   assert.equal(x.noMeetingOrIndividualVoteZeroInferred,true);
  }else{
   assert.match(x.sourceStatus,/_HOLD$/);
   assert.equal(x.originalClerkHtmlSha256,null);
   assert.equal(x.originalMotionResultTextCues,null);
  }
 }
 assert.equal(used.size,24);assert.equal(proved,15);
});

test('source-recovered 2025 Rules Subcommittee 4 meetings are independent printed Minutes, prior 2022 two originals not lost to later transport',()=>{
 const r=read(PROOF);
 const rules=r.perOriginalIndexedMeeting.filter((x:any)=>x.year===2025&&
  x.committeeName==='Rules and Administration - Subcommittee on Committees');
 assert.equal(rules.length,5);
 assert.deepEqual(rules.filter((x:any)=>x.authenticatedClerkOriginalBoolean)
  .map((x:any)=>x.hearingDate),[
  '2025-02-14','2025-02-21','2025-03-24','2025-04-07'
 ]);
 assert.deepEqual(rules.filter((x:any)=>!x.authenticatedClerkOriginalBoolean)
  .map((x:any)=>x.hearingDate),['2025-05-12']);
 const original2022=r.perOriginalIndexedMeeting.filter((x:any)=>
  x.year===2022&&x.authenticatedClerkOriginalBoolean&&
  x.lastAttemptSourceStatus==='original_calendar_not_authenticated_HOLD');
 assert.deepEqual(original2022.map((x:any)=>x.hearingDate),['2022-02-07','2022-02-08']);
 assert.ok(original2022.every((x:any)=>
  x.successfulOriginalSourceRunIds.length===1&&
  x.successfulOriginalSourceRunIds[0]===38507485246));
 assert.equal(r.sourceOriginalHistoricalPublicationExactDateKnown,false);
 assert.equal(r.independentlyIdentifiedHistoricalMemberVotesFromThisAudit,0);
 assert.equal(r.officialAllMotionsDenominatorCertified,false);
 assert.equal(r.sourceCuesNotUniqueCertifiedMotionEvents,true);
 assert.equal(r.other2022PrintedVsElectronicParityIndependentlyEstablished,false);
 assert.equal(r.noProductionDatabaseReadWrite,true);
 const json=JSON.stringify(r);
 assert.doesNotMatch(json,/namedPerson|memberVoteRowId|privateMemberIdentity|sourceNamedChoiceSha256/);
});

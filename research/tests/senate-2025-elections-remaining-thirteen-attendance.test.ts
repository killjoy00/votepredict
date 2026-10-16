import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {normalizeMemberName} from '../../src/sources/minnesota/house-votes.js';
import {
  REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS as expected,
  inspectOther2025ElectionOriginalRoll,
  type OtherElections2025Date,
} from '../../src/evidence/senate-2025-elections-remaining-thirteen-attendance.js';
import type {SupplementalNamedVoteCandidate} from
  '../../src/evidence/senate-committee-supplemental-named-roll-review.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const names=['Bahr','Boldon','Carlson','Cwodzinski','Koran','Limmer',
  'Lucero','Marty','Mathews','Port','Westlin'];
const titles:Record<OtherElections2025Date,string>={
  '2025-02-06':'Thursday, February 6th, 2025',
  '2025-02-11':'Tuesday, February 11th, 2025',
  '2025-03-25':'Tuesday, March 25th, 2025',
  '2025-04-08':'Tuesday, April 8th, 2025',
};
function synthetic(date:OtherElections2025Date, offset:number, absent:string[]=[]){
 const present=names.filter(n=>!absent.includes(n));
 const pre=['Senate Elections Committee',titles[date],
  'Present: '+present.map(n=>'Senator '+n).join(', '),
  'Absent: '+(absent.length?absent.map(n=>'Senator '+n).join(', '):'No Members Absent'),
  'Senator Jim Carlson called the meeting to order at 3:00 p.m.'].join('\n')+'\n';
 const label='S.F. 52 Senator Port moved that the bill be recommended. '+
   'Senator Boldon requested a roll call. With a vote of 5/6 the motion failed. Ayes:';
 const pad=offset-pre.length-label.length+'Ayes:'.length;
 if(pad<0)throw Error('Invalid synthetic test source offset');
 const text=pre+' '.repeat(pad)+label+'Carlson, Boldon, Cwodzinski, Marty, Port\n'+
   'Nays: Bahr, Koran, Limmer, Lucero, Mathews, Westlin\n';
 assert.equal(text.indexOf('Ayes:'),offset);
 const yea=['Carlson','Boldon','Cwodzinski','Marty','Port'];
 const nay=['Bahr','Koran','Limmer','Lucero','Mathews','Westlin'];
 const candidate:SupplementalNamedVoteCandidate={
  sourceOffset:offset,pattern:'opposing_named_lists',
  namedYeaCount:5,namedNayCount:6,
  sourceReportedYeaCount:5,sourceReportedNayCount:6,
  numericTallyMatchesExplicitNamedList:true,namesUniqueAndExclusive:true,
  choiceIdentitySha256:[...yea.map(n=>sha('yea:'+normalizeMemberName(n))),
    ...nay.map(n=>sha('nay:'+normalizeMemberName(n)))].sort(),
  sourcePassageSnippetSha256:sha('synthetic candidate'),
  motionContextWordsPresent:true,candidateNotVerifiedVote:true,finalFloorStanceInferred:false,
 };
 return {text,candidate};
}

test('exact four official 2025 non-conflict meetings contain precisely 13 frozen source offsets',()=>{
 const dates=Object.keys(expected);
 assert.deepEqual(dates,['2025-02-06','2025-02-11','2025-03-25','2025-04-08']);
 assert.deepEqual(Object.values(expected).map(v=>v.length),[5,2,1,5]);
 assert.equal(Object.values(expected).reduce((n,v)=>n+v.length,0),13);
 assert.equal(new Set(Object.values(expected).flat()).size,13);
});

test('source SHA-pinned candidate has 11 explicit sides; unique full roster attendance is independent',()=>{
 for(const d of Object.keys(expected) as OtherElections2025Date[]){
   const {text,candidate}=synthetic(d,expected[d][0]);
   const r=inspectOther2025ElectionOriginalRoll({text,indexedHearingDate:d,candidate});
   assert.equal(r.originalPrintedHearingDate,d);
   assert.equal(r.printedWeekdayMatchesPrintedDate,true);
   assert.equal(r.printedDateMatchesIndexed,true);
   assert.equal(r.originalOpeningAbsentGivenExplicitYeaNay,0);
   assert.equal(r.openingPresent,11);
   assert.equal(r.openingAbsent,0);
   assert.equal(r.sourceOriginalRosterMembersWithoutRecordedYeaNay,0);
   assert.equal(r.originalSourceNamedYeaCount+r.originalSourceNamedNayCount,11);
   assert.equal(r.allElevenSourceSurnamesMatchOfficialCommitteeHistory,true);
   assert.equal(r.neverAutomaticProductionMemberVoteImport,true);
   assert.equal(r.noFloorPassageStanceInferred,true);
 }
});

test('an opening absent named side is flagged but never inferred away or certified at motion-time',()=>{
 const d='2025-02-06';
 const {text,candidate}=synthetic(d,1574,['Port']);
 const r=inspectOther2025ElectionOriginalRoll({text,indexedHearingDate:d,candidate});
 assert.equal(r.openingPresent,10);
 assert.equal(r.openingAbsent,1);
 assert.equal(r.originalOpeningAbsentGivenExplicitYeaNay,1);
 assert.equal(r.originalOpeningAbsentVoteSideHashes.length,1);
 assert.equal(r.anyOriginalOpeningAbsentVoteConflict,true);
 assert.equal(r.sourceOriginalOpeningAttendanceIsNotRollTimeAttendance,true);
 assert.equal(r.originalVotesOnlyProvisionalUntilExactMotionReview,true);
});

test('wrong motion source offset, unknown historic surname or incomplete name lists fail closed',()=>{
 const d='2025-04-08',row=synthetic(d,2133);
 assert.throws(()=>inspectOther2025ElectionOriginalRoll({
    text:row.text,indexedHearingDate:d,
    candidate:{...row.candidate,sourceOffset:2134},
 }),/exact original thirteen/);
 const outsider={...row.candidate,choiceIdentitySha256:[...row.candidate.choiceIdentitySha256]};
 outsider.choiceIdentitySha256[0]=sha('yea:'+normalizeMemberName('Weber'));
 assert.throws(()=>inspectOther2025ElectionOriginalRoll({
    text:row.text,indexedHearingDate:d,candidate:outsider,
 }),/not on historical/);
 const corrupted=synthetic(d,2133);
 assert.throws(()=>inspectOther2025ElectionOriginalRoll({
    text:corrupted.text.replace('Senator Port','Senator Weber'),
    indexedHearingDate:d,candidate:corrupted.candidate,
 }),/outside historical roster|ambiguous/);
});

test('a mismatched printed source heading remains a review flag not silent date rewrite',()=>{
 const d='2025-02-11';
 const row=synthetic(d,2354);
 const modified=row.text.replace('Tuesday, February 11th','Tuesday, February 18th');
 const r=inspectOther2025ElectionOriginalRoll({
    text:modified,indexedHearingDate:d,candidate:row.candidate,
 });
 assert.equal(r.originalPrintedHearingDate,'2025-02-18');
 assert.equal(r.printedDateMatchesIndexed,false);
 assert.equal(r.neverAutomaticProductionMemberVoteImport,true);
});

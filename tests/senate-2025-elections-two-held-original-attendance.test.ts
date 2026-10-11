import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {normalizeMemberName} from '../src/sources/minnesota/house-votes.js';
import {
  HELD_ELECTIONS_TARGETS,inspect2025HeldOriginalElectionsRoll,
  parse2025ElectionsOriginalOpeningAttendance,
  type HeldElectionDate,
} from '../src/evidence/senate-2025-elections-two-held-original-attendance.js';
import type {SupplementalNamedVoteCandidate} from
  '../src/evidence/senate-committee-supplemental-named-roll-review.js';

const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const people=['Bahr','Boldon','Carlson','Cwodzinski','Koran','Limmer','Lucero',
  'Marty','Mathews','Port','Westlin'];
function block(date:HeldElectionDate){
  const feb=date==='2025-02-13';
  const namedYes=feb?['Carlson','Westlin','Boldon','Cwodzinski','Marty','Port']
    :['Carlson','Westlin','Bahr','Boldon','Cwodzinski','Lucero','Marty','Port'];
  const namedNo=feb?['Koran','Bahr','Limmer','Lucero','Mathews']:['Koran'];
  const absent=feb?['Lucero','Marty','Port']:['Limmer','Mathews'];
  const present=people.filter(n=>!absent.includes(n));
  const dateTitle=feb?'Thursday, February 27th, 2025':'Thursday, May 27th, 2025';
  const pre=['Elections Committee',dateTitle,'03:00 PM, Hybrid Hearing',
    'Present: '+present.map(n=>'Senator '+n).join(', '),
    'Absent: '+absent.map(n=>'Senator '+n).join(', '),
    'Senator Jim Carlson called the meeting to order at 3:04 p.m.'].join('\n')+'\n';
  const bill=feb?'S.F. 1071':'S.F. 905';
  const action=bill+' Senator Boldon moved the recommendation. Senator Port requested a roll call. '+
    (feb?'With a vote of 6/5 the motion prevailed. ':'With a vote of 8/1, with two absences, the motion prevailed. ')+
    'Ayes:';
  const off=HELD_ELECTIONS_TARGETS[date].offset;
  const pad=off-pre.length-action.length+'Ayes:'.length;
  if(pad<0)throw Error('Synthetic test context too long to reproduce official source offset');
  const text=pre+' '.repeat(pad)+action+namedYes.join(', ')+
    '\nNays: '+namedNo.join(', ')+'\nThe meeting was adjourned.';
  assert.equal(text.indexOf('Ayes:'),off);
  const c:SupplementalNamedVoteCandidate={
    sourceOffset:off,pattern:'opposing_named_lists',
    namedYeaCount:namedYes.length,namedNayCount:namedNo.length,
    sourceReportedYeaCount:namedYes.length,sourceReportedNayCount:namedNo.length,
    namesUniqueAndExclusive:true,numericTallyMatchesExplicitNamedList:true,
    choiceIdentitySha256:[...namedYes.map(n=>sha('yea:'+normalizeMemberName(n))),
      ...namedNo.map(n=>sha('nay:'+normalizeMemberName(n)))].sort(),
    sourcePassageSnippetSha256:sha('synthetic-not-original'),
    motionContextWordsPresent:true,candidateNotVerifiedVote:true,finalFloorStanceInferred:false,
  };
  return {text,c};
}

test('Feb13 original header is Feb27 but has 8/3 opening and 3 absent-choice contradictions',()=>{
  const b=block('2025-02-13');
  const r=inspect2025HeldOriginalElectionsRoll({
    originalText:b.text,indexedHearingDate:'2025-02-13',candidate:b.c});
  assert.equal(r.originalPrintedDate,'2025-02-27');
  assert.equal(r.printedWeekdayConsistentWithPrintedDate,true);
  assert.equal(r.billIdentity,'SF1071');
  assert.deepEqual([r.originalOpeningPresent,r.originalOpeningAbsent],[8,3]);
  assert.deepEqual([r.explicitNamedYeas,r.explicitNamedNays],[6,5]);
  assert.equal(r.sourceOpeningAbsentGivenExplicitYeaOrNay,3);
  assert.equal(r.sourceOpeningAbsentChosenSidesSha256.length,3);
  assert.equal(r.rosterMembersWithNoRecordedNamedSide,0);
  assert.equal(r.eligibleForPersistedHistoricalMemberVotes,false);
  assert.equal(r.sourceMotionTextExplicitlySaysTwoAbsences,false);
});

test('Mar27 printed May27 wrong weekday; 9/2 opening matches nine named sides and two aggregate absences',()=>{
  const b=block('2025-03-27');
  const r=inspect2025HeldOriginalElectionsRoll({
    originalText:b.text,indexedHearingDate:'2025-03-27',candidate:b.c});
  assert.equal(r.originalPrintedDate,'2025-05-27');
  assert.equal(r.printedWeekdayConsistentWithPrintedDate,false);
  assert.equal(r.billIdentity,'SF905');
  assert.deepEqual([r.originalOpeningPresent,r.originalOpeningAbsent],[9,2]);
  assert.deepEqual([r.explicitNamedYeas,r.explicitNamedNays],[8,1]);
  assert.equal(r.sourceOpeningAbsentGivenExplicitYeaOrNay,0);
  assert.equal(r.rosterMembersWithNoRecordedNamedSide,2);
  assert.equal(r.unlistedNamedChoiceMembersMatchOpeningAbsentRoster,true);
  assert.equal(r.sourceMotionTextExplicitlySaysTwoAbsences,true);
  assert.equal(r.sameSourceMeetingOpeningAttendanceIsNotMotionTimeAttendance,true);
  assert.equal(r.eligibleForPersistedHistoricalMemberVotes,false);
});

test('unattributed, duplicate, short or changed opening header fails closed',()=>{
  const {text,c}=block('2025-03-27');
  const opening=parse2025ElectionsOriginalOpeningAttendance(text);
  assert.equal(opening.uniqueElevenMemberOpeningRosterPartition,true);
  assert.throws(()=>parse2025ElectionsOriginalOpeningAttendance(text.replace(
    'Senator Limmer','Unknown Limmer')),/explicitly introduced/);
  assert.throws(()=>parse2025ElectionsOriginalOpeningAttendance(text.replace(
    'Senator Limmer','Senator Mathews')),/Duplicate/);
  assert.throws(()=>parse2025ElectionsOriginalOpeningAttendance(text.replace(
    'Senator Limmer','Senator Weber')),/ambiguous or outside/);
  assert.throws(()=>parse2025ElectionsOriginalOpeningAttendance(text.replace(
    'Absent:','Absent member names omitted:')),/Both bounded/);
  assert.throws(()=>inspect2025HeldOriginalElectionsRoll({
    originalText:text.replace('May 27th','March 27th'),
    indexedHearingDate:'2025-03-27',candidate:c,
  }),/date discrepancy/);
});

test('unknown roster side, swapped source motion bill, incorrect tally and lost explicit two absences fail closed',()=>{
  const {text,c}=block('2025-03-27');
  const wrong={...c,sourceReportedNayCount:2};
  assert.throws(()=>inspect2025HeldOriginalElectionsRoll({
    originalText:text,indexedHearingDate:'2025-03-27',candidate:wrong,
  }),/tally drift/);
  assert.throws(()=>inspect2025HeldOriginalElectionsRoll({
    originalText:text.replace('S.F. 905','S.F. 999'),
    indexedHearingDate:'2025-03-27',candidate:c,
  }),/specific recorded bill/);
  assert.throws(()=>inspect2025HeldOriginalElectionsRoll({
    originalText:text.replace('with two absences','with three absences'),
    indexedHearingDate:'2025-03-27',candidate:c,
  }),/absence statement changed/);
  const outsider={...c,choiceIdentitySha256:[...c.choiceIdentitySha256]};
  outsider.choiceIdentitySha256[0]=sha('yea:'+normalizeMemberName('Weber'));
  assert.throws(()=>inspect2025HeldOriginalElectionsRoll({
    originalText:text,indexedHearingDate:'2025-03-27',candidate:outsider,
  }),/not on historical/);
  assert.equal(c.candidateNotVerifiedVote,true);
});


test('an original may be opened by a named senator other than Carlson, but must still identify a real call to order',()=>{
  const b=block('2025-03-27');
  const source=b.text.replace('Senator Jim Carlson called the meeting to order',
    'Senator Bonnie S. Westlin called the meeting to order');
  const r=parse2025ElectionsOriginalOpeningAttendance(source);
  assert.equal(r.uniqueElevenMemberOpeningRosterPartition,true);
  assert.deepEqual([r.openingPresentCount,r.openingAbsentCount],[9,2]);
  assert.throws(()=>parse2025ElectionsOriginalOpeningAttendance(
    source.replace('called the meeting to order','made opening remarks')),
    /Both bounded original opening/);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { normalizeMemberName } from '../src/sources/minnesota/house-votes.js';
import {
  inspectOfficialSenatePdfHeader,inspectProvisionalMatchedSenateMotion,
  sourceAbsenteeChoiceConflicts,
} from '../src/evidence/senate-committee-19-original-date-attendance-review.js';
import type { SupplementalNamedVoteCandidate } from '../src/evidence/senate-committee-supplemental-named-roll-review.js';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
function candidate(sourceOffset:number,yes:string[],no:string[]):SupplementalNamedVoteCandidate{
  return {sourceOffset,pattern:'opposing_named_lists',namedYeaCount:yes.length,
    namedNayCount:no.length,sourceReportedYeaCount:yes.length,
    sourceReportedNayCount:no.length,namesUniqueAndExclusive:true,
    numericTallyMatchesExplicitNamedList:true,
    choiceIdentitySha256:[...yes.map(x=>hash('yea:'+normalizeMemberName(x))),
      ...no.map(x=>hash('nay:'+normalizeMemberName(x)))].sort(),
    sourcePassageSnippetSha256:hash('test source only'),motionContextWordsPresent:true,
    candidateNotVerifiedVote:true,finalFloorStanceInferred:false};
}
test('Feb 13 indexed election PDF says Feb 27 and three listed absentees receive ballots',()=>{
  const intro='Elections Committee\nThursday, February 27th, 2025\nMinutes\n'+
    'Present: Senator Jim Carlson, Senator Bonnie Westlin\n'+
    'Absent: Senator Eric Lucero, Senator John Marty, Senator Lindsey Port\n'+
    'Senator Jim Carlson called the meeting to order at 3:04 p.m.\n';
  const action='S.F. 1071: Senator Boldon moved that it be recommended to pass. '+
    'Senator Boldon requested a roll call. With a vote of 6/5 the motion prevailed. '+
    'Ayes: Carlson, Westlin, Boldon, Cwodzinski, Marty, Port\n'+
    'Nays: Koran, Bahr, Limmer, Lucero, Mathews';
  const offset=intro.length+action.indexOf('Ayes:');
  const r=inspectProvisionalMatchedSenateMotion({
    text:intro+action,indexedHearingDate:'2025-02-13',expectedSourceOffset:offset,
    candidate:candidate(offset,['Carlson','Westlin','Boldon','Cwodzinski','Marty','Port'],
      ['Koran','Bahr','Limmer','Lucero','Mathews']),
  });
  assert.equal(r.header.printedHeaderDate,'2025-02-27');
  assert.equal(r.header.printedHeaderDateAgreesWithIndexedDate,false);
  assert.equal(r.attendance.absentPeopleParsed,3);
  assert.equal(r.attendance.explicitChoiceFingerprintMatchesAbsentee,3);
  assert.equal(r.needsSourceIdentityReconciliation,true);
  assert.deepEqual(r.reviewFlags,[
    'printed_header_date_or_weekday_disagrees',
    'named_vote_choice_matches_person_listed_absent',
  ]);
  assert.equal(r.eligibleForIndividualMemberVotes,false);
});
test('Mar 27 indexed PDF says Thursday May 27 even though May 27 was Tuesday',()=>{
  const x=inspectOfficialSenatePdfHeader(
    'Elections Committee\nThursday, May 27th, 2025\nMinutes\n'+
      'Senator Port requested a roll call vote on SF 905.', '2025-03-27');
  assert.equal(x.printedHeaderDate,'2025-05-27');
  assert.equal(x.printedHeaderDateAgreesWithIndexedDate,false);
  assert.equal(x.printedWeekdayMatchesPrintedDate,false);
  assert.equal(x.sourceDateHeaderNeedsReview,true);
});
test('matching source header and no absent committee members do not fabricate a conflict',()=>{
  const text='Elections Committee\nThursday, February 6th, 2025\nMinutes\n'+
    'Present: Senator Jim Carlson and Senator Liz Boldon\nAbsent: No Members Absent\n'+
    'Senator Jim Carlson called the meeting to order. '+ 'S.F. 0529: Senator Lucero moved A1 Amendment, '+
    'requested a roll call vote. With a vote of 1/1 the motion failed. Ayes: Lucero\nNays: Marty.';
  const off=text.indexOf('Ayes:');
  const r=inspectProvisionalMatchedSenateMotion({
    text,indexedHearingDate:'2025-02-06',expectedSourceOffset:off,
    candidate:candidate(off,['Lucero'],['Marty']),
  });
  assert.equal(r.header.sourceDateHeaderNeedsReview,false);
  assert.equal(r.attendance.explicitChoiceFingerprintMatchesAbsentee,0);
  assert.equal(r.attendance.sourceAttendanceNoAmbiguousAbsencesCertified,true);
  assert.deepEqual(r.reviewFlags,[]);
  assert.equal(r.actualDistinctRecordedMotionHumanCertified,false);
  assert.equal(r.officialHistoricalSenatorRosterMatched,false);
});
test('no dated header means HOLD, not implicit date certification',()=>{
  const x=inspectOfficialSenatePdfHeader('Committee roll-call and vote actions were described','2024-02-15');
  assert.equal(x.printedHeaderDate,null);
  assert.equal(x.printedHeaderDateAgreesWithIndexedDate,null);
  assert.equal(x.sourceDateHeaderNeedsReview,true);
});
test('counts and source-offset drift must fail closed',()=>{
  const text='Thursday, February 6th, 2025 '+ 'A'.repeat(70);
  const orig=candidate(5,['Carlson'],['Bahr']);
  assert.throws(()=>inspectProvisionalMatchedSenateMotion({
    text,indexedHearingDate:'2025-02-06',expectedSourceOffset:9,candidate:orig,
  }),/Unpinned candidate/);
  assert.throws(()=>inspectOfficialSenatePdfHeader(text,'2026-01-01'),/Not a scoped/);
  assert.deepEqual(sourceAbsenteeChoiceConflicts(text,orig).attendanceAbsentSectionFound,false);
});
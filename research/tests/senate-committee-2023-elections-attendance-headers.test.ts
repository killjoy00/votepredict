import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {normalizeMemberName} from '../../src/sources/minnesota/house-votes.js';
import {MN_2023_ELECTIONS_HISTORICAL_PUBLIC_ROSTER_LAST_NAMES as roster} from
  '../../src/evidence/senate-committee-2023-elections-roll-roster-audit.js';
import {
  inspect2023OriginalElectionRollDateAndAttendance,
  parse2023ElectionsOriginalMeetingAttendance,
} from '../evidence/senate-committee-2023-elections-attendance-headers.js';
import type {CandidateNamedRoll} from '../../src/evidence/senate-committee-nine-no-label-counted-rolls.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const normalized=(v:string)=>normalizeMemberName(v);
function originalAttendance(present:string[],absent:string[],date:string){
 return [
  'Minnesota Senate Elections Committee',
  'Tuesday, '+date+', 2023',
  'Minutes',
  'Present: '+present.map(n=>'Senator '+n).join(', '),
  'Absent: '+(absent.length?absent.map(n=>'Senator '+n).join(', '):'No Members Absent'),
  'Senator Jim Carlson called the meeting to order at 3:05 PM.',
  'S.F. 1515: Senator Westlin moved an A1 amendment.',
  'Senator Boldon requested a roll call vote on the motion. '
   +'By a roll call vote of 8 Yeas and 5 Nays with one Absence the motion passed.',
 ].join('\n');
}
function sourceRoll(status:Record<string,'yea'|'nay'|'absent'|'pass'>):CandidateNamedRoll{
 const choices=roster.map(n=>({name:normalized(n),side:status[n]??'nay'}));
 const yeas=choices.filter(c=>c.side==='yea').length,
  nays=choices.filter(c=>c.side==='nay').length;
 return {
  sourceOffset:300,sourcePattern:'senator_direction_rows',
  sourceYeaCount:yeas,sourceNayCount:nays,
  explicitlyNamedYeas:yeas,explicitlyNamedNays:nays,
  explicitlyListedAbsent:choices.filter(c=>c.side==='absent').length,
  explicitlyListedPass:choices.filter(c=>c.side==='pass').length,
  explicitNamesAreUniqueWithinRoll:true,namedYeaNayTallyMatchesSource:true,
  absenceAndPassCategoriesAreNotNaysOrYeas:true,
  sourceChoiceFingerprintSha256:choices.map(c=>sha(c.side+':'+c.name)),
  sourceRollContextSha256:sha('original'),billOrAmendmentContextSha256:sha('motion'),
  candidateNeedsIndependentMotionAndRosterCheck:true,
  committeeEthicsActionNeverBillStance:false,
  noAutomaticIndividualVoteImport:true,
 };
}
test('all fourteen present is separately distinguishable from a later Pass',()=>{
 const p=parse2023ElectionsOriginalMeetingAttendance(
  originalAttendance([...roster],[],'February 7'));
 assert.equal(p.attendanceSectionsLocated,true);
 assert.equal(p.memberPresentCount,14);
 assert.equal(p.memberAbsentCount,0);
 assert.equal(p.uniqueRosterPartitionVerified,true);
 assert.equal(p.originalMeetingAttendanceCannotBeInferred,false);
});
test('Feb14 Anderson absent and marked absent in named motion has no absentee Yea/Nay conflict',()=>{
 const all=[...roster],present=all.filter(x=>x!=='Anderson');
 const text=originalAttendance(present,['Anderson'],'February 14');
 const status=Object.fromEntries(all.map((n,i)=>[n,n==='Anderson'?'absent':i<9?'yea':'nay'])) as Record<string,'yea'|'nay'|'absent'|'pass'>;
 const result=inspect2023OriginalElectionRollDateAndAttendance(
  text,'2023-02-14',sourceRoll(status));
 assert.equal(result.sourcePrintedDateAgreesWithIndex,true);
 assert.equal(result.originalMeetingAttendance.memberPresentCount,13);
 assert.equal(result.originalMeetingAttendance.memberAbsentCount,1);
 assert.equal(result.originalAbsentHeaderMembersGivenExplicitYeaNay,0);
 assert.equal(result.hardAbsenteeOrSourceDateIssue,false);
 assert.equal(result.originalSourceRollIsNotApprovedHistoricalVote,true);
});
test('named yea while original minutes lists Senator absent is a hard contradiction',()=>{
 const all=[...roster],text=originalAttendance(all.filter(x=>x!=='Anderson'),['Anderson'],'February 14');
 const status=Object.fromEntries(all.map((n,i)=>[n,i<8?'yea':'nay'])) as Record<string,'yea'|'nay'|'absent'|'pass'>;
 const result=inspect2023OriginalElectionRollDateAndAttendance(text,'2023-02-14',sourceRoll(status));
 assert.equal(result.originalAbsentHeaderMembersGivenExplicitYeaNay,1);
 assert.equal(result.hardAbsenteeOrSourceDateIssue,true);
 assert.match(result.absentHeaderContradictionHashes[0],/^[a-f0-9]{64}$/);
});
test('member marked roll Absent despite initially present is review cue, not proof source contradiction',()=>{
 const status=Object.fromEntries(roster.map((n,i)=>[n,i===0?'absent':i<7?'yea':'nay'])) as Record<string,'yea'|'nay'|'absent'|'pass'>;
 const result=inspect2023OriginalElectionRollDateAndAttendance(
  originalAttendance([...roster],[],'March 7'),'2023-03-07',sourceRoll(status));
 assert.equal(result.originalAbsentHeaderMembersGivenExplicitYeaNay,0);
 assert.equal(result.sourceRollMarkedAbsentDespiteBeingPresentAtStart,1);
 assert.equal(result.hardAbsenteeOrSourceDateIssue,false);
});
test('ambiguous absence header cannot be treated as all senators present',()=>{
 const t='Tuesday, March 7, 2023\nMinutes\nPresent: Senator Koran\nAbsent: unknown attendance context. The vote was recorded.';
 const r=parse2023ElectionsOriginalMeetingAttendance(t);
 assert.equal(r.uniqueRosterPartitionVerified,false);
 assert.equal(r.originalMeetingAttendanceCannotBeInferred,true);
 const nullInput='Tuesday, March 7, 2023 - Roll call was held on an amendment.';
 assert.equal(parse2023ElectionsOriginalMeetingAttendance(nullInput).attendanceSectionsLocated,false);
});
test('duplicate choice fingerprint fails closed and names never leave internal comparison',()=>{
 const status=Object.fromEntries(roster.map((n,i)=>[n,i<7?'yea':'nay'])) as Record<string,'yea'|'nay'|'absent'|'pass'>;
 const r=sourceRoll(status);
 r.sourceChoiceFingerprintSha256[0]=r.sourceChoiceFingerprintSha256[1];
 assert.throws(()=>inspect2023OriginalElectionRollDateAndAttendance(
  originalAttendance([...roster],[],'February 7'),'2023-02-07',r),/repeats same senator/);
});
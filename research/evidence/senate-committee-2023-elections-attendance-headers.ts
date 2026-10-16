/**
 * Issue #864 -- compare original published 2023 Senate Elections meeting
 * attendance *header* against explicit named roll choices in exactly seven
 * SHA-pinned official PDF originals. A meeting header is not proof of presence
 * when a later motion happened; disagreement is source QA only.
 */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '@/sources/minnesota/house-votes';
import {
  MN_2023_ELECTIONS_HISTORICAL_PUBLIC_ROSTER_LAST_NAMES,
} from '../../src/evidence/senate-committee-2023-elections-roll-roster-audit.js';
import type {CandidateNamedRoll} from '../../src/evidence/senate-committee-nine-no-label-counted-rolls.js';
import {inspectOfficialSenatePdfHeader} from './senate-committee-19-original-date-attendance-review.js';

const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const roster=MN_2023_ELECTIONS_HISTORICAL_PUBLIC_ROSTER_LAST_NAMES.map(normalizeMemberName);
const sourceIdentity=new Map<string,{member:string;status:'yea'|'nay'|'absent'|'pass'}>();
for(const member of roster){
  for(const status of ['yea','nay','absent','pass'] as const){
    const key=sha(status+':'+member);
    if(sourceIdentity.has(key))throw Error('Ambiguous official historical Elections roster fingerprint');
    sourceIdentity.set(key,{member,status});
  }
}
export function parse2023ElectionsOriginalMeetingAttendance(text:string){
  if(text.length<40||text.length>1_000_000)
    throw Error('No bounded original Senate minutes text for attendance review');
  const head=text.slice(0,2600);
  const p=/\bPresent\s*:/i.exec(head),a=/\bAbsent\s*:/i.exec(head);
  if(!p||!a||a.index<=p.index||a.index-p.index>1200)
    return {attendanceSectionsLocated:false,memberPresentCount:0,
      memberAbsentCount:0,unknownOrUnlistedRosterMembers:14,
      uniqueRosterPartitionVerified:false,
      recordedAbsentFingerprintSha256:[] as string[],
      originalMeetingAttendanceCannotBeInferred:true};
  const present=head.slice(p.index+p[0].length,a.index);
  const next=head.slice(a.index+a[0].length);
  // Stop only on an unambiguous call-to-order cue. Unknown or missing cue
  // fails closed rather than treating committee business as attendance.
  const stop=next.search(/(?:^|\n)\s*Senator\s+[A-Z][A-Za-z.'-]*(?:\s+(?!Senator\b)[A-Z][A-Za-z.'-]*){0,3}\s+called\s+the\s+meeting\s+to\s+order\b|\bCall\s+to\s+Order\b|\bA\s+quorum\s+is\s+present\b/i);
  if(stop<0||stop>1150)
    return {attendanceSectionsLocated:false,memberPresentCount:0,
      memberAbsentCount:0,unknownOrUnlistedRosterMembers:14,
      uniqueRosterPartitionVerified:false,
      recordedAbsentFingerprintSha256:[] as string[],
      originalMeetingAttendanceCannotBeInferred:true};
  const absent=next.slice(0,stop);
  const exactAbsenceNone=/^\s*No\s+Members?\s+Absent\b/i.test(absent);
  const presentNames=roster.filter(name=>new RegExp('\\b'+name+'\\b','i').test(present));
  const absentNames=exactAbsenceNone?[]:roster.filter(name=>
    new RegExp('\\b'+name+'\\b','i').test(absent));
  const seen=new Set([...presentNames,...absentNames]);
  const consistent=seen.size===14&&
    presentNames.length+absentNames.length===14&&
    (exactAbsenceNone || absentNames.length>0);
  return {
    attendanceSectionsLocated:true,
    memberPresentCount:presentNames.length,memberAbsentCount:absentNames.length,
    unknownOrUnlistedRosterMembers:14-seen.size,
    uniqueRosterPartitionVerified:consistent,
    recordedAbsentFingerprintSha256:absentNames.map(sha).sort(),
    originalMeetingAttendanceCannotBeInferred:!consistent,
  };
}
export function inspect2023OriginalElectionRollDateAndAttendance(
  text:string,indexedDate:string,roll:CandidateNamedRoll,
){
  const date=inspectOfficialSenatePdfHeader(text,indexedDate);
  const header=parse2023ElectionsOriginalMeetingAttendance(text);
  const absent=new Set(header.recordedAbsentFingerprintSha256);
  if(roll.namedYeaNayTallyMatchesSource!==true ||
    roll.explicitNamesAreUniqueWithinRoll!==true||
    !Array.isArray(roll.sourceChoiceFingerprintSha256)||
    roll.sourceChoiceFingerprintSha256.length!==14)
    throw Error('Original numbered source member roll not independently eligible for attendance review');
  const hashes=new Set<string>(),votersListedAbsent:string[]=[],membersMarkedRollAbsentButPresent:string[]=[];
  for(const choice of roll.sourceChoiceFingerprintSha256){
    const item=sourceIdentity.get(choice);
    if(!item)throw Error('Source roll contains member outside official fourteen-senator Elections roster');
    if(hashes.has(item.member))throw Error('Original roll repeats same senator status or both sides');
    hashes.add(item.member);
    if(header.uniqueRosterPartitionVerified){
      const person=sha(item.member);
      if(absent.has(person)&&(item.status==='yea'||item.status==='nay'))
        votersListedAbsent.push(person);
      if(!absent.has(person)&&item.status==='absent')
        membersMarkedRollAbsentButPresent.push(person);
    }
  }
  if(hashes.size!==14)throw Error('Source named roll did not contain all fourteen original senators');
  const hardContradiction=header.uniqueRosterPartitionVerified&&votersListedAbsent.length>0;
  return {
    sourceTextOffset:roll.sourceOffset,indexedOfficialHearingDate:indexedDate,
    sourcePrintedMeetingDate:date.printedHeaderDate,
    sourcePrintedDateAgreesWithIndex:date.printedHeaderDateAgreesWithIndexedDate,
    originalHeadingDateRequiresReview:date.sourceDateHeaderNeedsReview,
    originalMeetingAttendance:header,
    originalAbsentHeaderMembersGivenExplicitYeaNay:votersListedAbsent.length,
    absentHeaderContradictionHashes:votersListedAbsent.sort(),
    sourceRollMarkedAbsentDespiteBeingPresentAtStart:membersMarkedRollAbsentButPresent.length,
    softRollAbsenceSourceHashes:membersMarkedRollAbsentButPresent.sort(),
    hardAbsenteeOrSourceDateIssue:hardContradiction||date.sourceDateHeaderNeedsReview,
    sourceMemberNamesNotPersisted:true,
    originalSourceRollIsNotApprovedHistoricalVote:true,
    noOriginalSenateFloorPassageOrBillStanceInferred:true,
  };
}
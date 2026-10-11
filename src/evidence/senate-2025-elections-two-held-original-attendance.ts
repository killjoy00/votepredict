/**
 * #864 OFFLINE / SOURCE QA ONLY: exact original 2025 Elections minutes,
 * two mismatched printed-date hearings, named roll versus opening attendance.
 *
 * This is not a production parser. Opening absence is NOT a motion-time vote
 * status, nor is a roster member with no listed side assumed to abstain.
 */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '@/sources/minnesota/house-votes';
import {inspectOfficialSenatePdfHeader} from './senate-committee-19-original-date-attendance-review.js';
import {MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER as ROSTER,
  validate2025OriginalElectionsSourceBlock} from './senate-committee-2025-elections-15-roster-review.js';
import type {SupplementalNamedVoteCandidate} from './senate-committee-supplemental-named-roll-review.js';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export type HeldElectionDate='2025-02-13'|'2025-03-27';
export const HELD_ELECTIONS_TARGETS={
  '2025-02-13':{offset:1114,yeas:6,nays:5,bill:'SF1071',printed:'2025-02-27',present:8,absent:3},
  '2025-03-27':{offset:3102,yeas:8,nays:1,bill:'SF905',printed:'2025-05-27',present:9,absent:2},
} as const;

function parseExplicitSourceNames(section:string, allowEmpty:boolean):string[]{
  const clean=section.replace(/\s+/g,' ').trim();
  if(allowEmpty && /^No Members? Absent\b/i.test(clean))return [];
  if(!clean || clean.length>850)throw Error('Empty or unbounded official opening attendance section');
  const parts=clean.split(/,\s*(?=Senator\s+)/i);
  if(parts.length<1 || parts.length>11)throw Error('Malformed original Present/Absent name list');
  const seen=new Set<string>();
  for(const item of parts){
    if(!/^Senator\s+[A-Z]/.test(item))
      throw Error('Attendance member not explicitly introduced as Senator');
    const names=ROSTER.filter(s=>new RegExp('\\b'+s+'\\b','i').test(item));
    if(names.length!==1)throw Error('Attendance source names ambiguous or outside historical roster');
    const name=normalizeMemberName(names[0]);
    if(seen.has(name))throw Error('Duplicate original attendance member');
    seen.add(name);
  }
  return [...seen].sort();
}

export function parse2025ElectionsOriginalOpeningAttendance(text:string){
  if(text.length<100 || text.length>1_000_000)
    throw Error('Unbounded original Elections source text');
  const head=text.slice(0,1850);
  const present=head.match(/\bPresent:\s*([\s\S]*?)\s*\bAbsent:/i);
  const absent=head.match(/\bAbsent:\s*([\s\S]*?)(?=\bSenator\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ .'-]{3,80}?\s+called\s+the\s+meeting\s+to\s+order\b)/i);
  if(!present || !absent)
    throw Error('Both bounded original opening Present/Absent headers required');
  const presentNames=parseExplicitSourceNames(present[1]!,false);
  const absentNames=parseExplicitSourceNames(absent[1]!,true);
  const union=[...presentNames,...absentNames];
  if(union.length!==11 || new Set(union).size!==11 ||
    ROSTER.some(s=>!union.includes(normalizeMemberName(s))))
    throw Error('Opening attendance does not partition exactly 11 dated committee members');
  return {
    openingPresentCount:presentNames.length,
    openingAbsentCount:absentNames.length,
    uniqueElevenMemberOpeningRosterPartition:true as const,
    presentMemberNormalizedNames:presentNames,
    absentMemberNormalizedNames:absentNames,
  };
}

export function inspect2025HeldOriginalElectionsRoll(input:{
  originalText:string;indexedHearingDate:HeldElectionDate;
  candidate:SupplementalNamedVoteCandidate;
}){
  const {originalText:indexedText,indexedHearingDate:hearing,candidate}=input;
  const target=HELD_ELECTIONS_TARGETS[hearing];
  if(!target || candidate.sourceOffset!==target.offset ||
    candidate.namedYeaCount!==target.yeas || candidate.namedNayCount!==target.nays ||
    candidate.sourceReportedYeaCount!==target.yeas ||
    candidate.sourceReportedNayCount!==target.nays ||
    candidate.numericTallyMatchesExplicitNamedList!==true ||
    candidate.namesUniqueAndExclusive!==true)
    throw Error('Held original Elections source offset or numeric tally drift');
  const rosterCheck=validate2025OriginalElectionsSourceBlock(candidate);
  const header=inspectOfficialSenatePdfHeader(indexedText,hearing);
  const opening=parse2025ElectionsOriginalOpeningAttendance(indexedText);
  if(header.printedHeaderDate!==target.printed ||
    header.printedHeaderDateAgreesWithIndexedDate!==false ||
    opening.openingPresentCount!==target.present ||
    opening.openingAbsentCount!==target.absent)
    throw Error('Original known date discrepancy or attendance denominator changed');

  const near=indexedText.slice(Math.max(0,candidate.sourceOffset-650),
    Math.min(indexedText.length,candidate.sourceOffset+450));
  const billPattern=new RegExp('\\bS\\.?\\s*F\\.?\\s*0*'+target.bill.slice(2)+'\\b','i');
  if(!billPattern.test(near)|| !/\broll\s+call\b/i.test(near))
    throw Error('Source roll no longer adjacent to its specific recorded bill/motion');
  const all=new Set(candidate.choiceIdentitySha256);
  const countedNames=ROSTER.filter(name=>
    ['yea','nay'].some(side=>all.has(hash(side+':'+normalizeMemberName(name)))));
  const absentChosen=opening.absentMemberNormalizedNames.filter(name=>
    ['yea','nay'].some(side=>all.has(hash(side+':'+name))));
  const presentWithoutSide=opening.presentMemberNormalizedNames.filter(name=>
    !['yea','nay'].some(side=>all.has(hash(side+':'+name))));
  const unlisted=ROSTER.map(normalizeMemberName).filter(name=>
    !countedNames.map(normalizeMemberName).includes(name));
  if(countedNames.length!==target.yeas+target.nays ||
    unlisted.length!==11-target.yeas-target.nays ||
    absentChosen.length!== (hearing==='2025-02-13'?3:0) ||
    presentWithoutSide.length!==0)
    throw Error('Original per-name opening absence / explicitly recorded choices changed');
  const sourceExplicitlyStatesTwoAbsencesAtMotion=/\bwith\s+two\s+absences\b/i.test(near);
  if(sourceExplicitlyStatesTwoAbsencesAtMotion !== (hearing==='2025-03-27'))
    throw Error('Original roll-specific aggregate absence statement changed');
  const unlistedMatchesOpeningAbsent=unlisted.length===opening.absentMemberNormalizedNames.length &&
    unlisted.every(name=>opening.absentMemberNormalizedNames.includes(name));
  return {
    indexedHearingDate:hearing,
    originalPrintedDate:header.printedHeaderDate,
    printedWeekdayConsistentWithPrintedDate:header.printedWeekdayMatchesPrintedDate,
    originalHeaderIsNotIndexedHearingDate:true as const,
    originalSourceTextOffset:target.offset,
    billIdentity:target.bill,
    explicitNamedYeas:target.yeas,explicitNamedNays:target.nays,
    sourceNumericTallyMatchedOriginalNamedChoices:true as const,
    originalOpeningPresent:opening.openingPresentCount,
    originalOpeningAbsent:opening.openingAbsentCount,
    sourceOpeningAttendancePartitionsOfficialElevenMemberRoster:true as const,
    sourceOpeningAbsentGivenExplicitYeaOrNay:absentChosen.length,
    sourceOpeningAbsentChosenSidesSha256:absentChosen
      .flatMap(name=>['yea','nay'].filter(side=>all.has(hash(side+':'+name)))
        .map(side=>hash(side+':'+name))).sort(),
    openingPresentMembersWithoutRecordedYeaNay:presentWithoutSide.length,
    rosterMembersWithNoRecordedNamedSide:rosterCheck.rosterMembersWithNoNamedChoice,
    sourceMotionTextExplicitlySaysTwoAbsences:sourceExplicitlyStatesTwoAbsencesAtMotion,
    unlistedNamedChoiceMembersMatchOpeningAbsentRoster:unlistedMatchesOpeningAbsent,
    sameSourceMeetingOpeningAttendanceIsNotMotionTimeAttendance:true as const,
    independentOfficialRecordingOfExactMemberChoicesNotVerified:true as const,
    sourceDocumentHasPrintedDateError:true as const,
    requiresIndependentSourceMeetingIdentityAndMotionVoteReview:true as const,
    eligibleForPersistedHistoricalMemberVotes:false as const,
    noMemberChoiceAbsenceOrPassImputation:true as const,
    noFinalFloorOrBillPolicyStanceInferred:true as const,
  };
}

/**
 * #864 original-source-only, never production/serving: inspect exactly
 * 13 existing tally-matched 2025 Elections original roll source blocks from
 * four meetings not covered by the two original date/absence HOLDs.
 */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '@/sources/minnesota/house-votes';
import {inspectOfficialSenatePdfHeader} from './senate-committee-19-original-date-attendance-review.js';
import {parse2025ElectionsOriginalOpeningAttendance} from
  './senate-2025-elections-two-held-original-attendance.js';
import {MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER as ROSTER,
  validate2025OriginalElectionsSourceBlock} from
  './senate-committee-2025-elections-15-roster-review.js';
import type {SupplementalNamedVoteCandidate} from
  './senate-committee-supplemental-named-roll-review.js';

const sha=(v:string)=>createHash('sha256').update(v).digest('hex');

export const REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS={
  '2025-02-06':[1574,1991,2250,2522,2946],
  '2025-02-11':[2354,3460],
  '2025-03-25':[1326],
  '2025-04-08':[2133,2401,2673,2941,3303],
} as const;

export type OtherElections2025Date=keyof typeof REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS;

export function inspectOther2025ElectionOriginalRoll(input:{
  text:string;indexedHearingDate:OtherElections2025Date;
  candidate:SupplementalNamedVoteCandidate;
}){
  const {text,indexedHearingDate,candidate}=input;
  const expected=REMAINING_2025_ELECTIONS_ORIGINAL_ROLL_OFFSETS[indexedHearingDate];
  if(!expected || !expected.some(o=>o===candidate.sourceOffset) ||
    candidate.numericTallyMatchesExplicitNamedList!==true ||
    candidate.namesUniqueAndExclusive!==true ||
    candidate.sourceReportedYeaCount!==candidate.namedYeaCount ||
    candidate.sourceReportedNayCount!==candidate.namedNayCount ||
    candidate.namedYeaCount+candidate.namedNayCount!==11)
    throw Error('Not one of the exact original thirteen numeric-matched committee sources');
  const roster=validate2025OriginalElectionsSourceBlock(candidate);
  if(roster.matchedKnownRosterNames!==11||roster.rosterMembersWithNoNamedChoice!==0)
    throw Error('Original full eleven member Elections source fingerprint drift');
  const opening=parse2025ElectionsOriginalOpeningAttendance(text);
  const header=inspectOfficialSenatePdfHeader(text,indexedHearingDate);
  const chosen=new Set(candidate.choiceIdentitySha256);
  const openingAbsentWithSide=opening.absentMemberNormalizedNames.flatMap(name=>
    ['yea','nay'].filter(side=>chosen.has(sha(side+':'+name))).map(side=>sha(side+':'+name)));
  const sourceNear=text.slice(Math.max(0,candidate.sourceOffset-580),
    Math.min(text.length,candidate.sourceOffset+430));
  const billCandidates=[...sourceNear.matchAll(/\b(?:S\.?\s*F\.?|H\.?\s*F\.?)\s*(?:No\.?\s*)?\d{1,5}\b/gi)]
    .map(x=>x[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase());
  if(!/\broll\s+call\b/i.test(sourceNear))
    throw Error('Source original named sides not adjacent to roll-call context');
  const uniquePresentNames=new Set(opening.presentMemberNormalizedNames);
  if(ROSTER.length!==11||uniquePresentNames.size!==opening.openingPresentCount)
    throw Error('Original opening roster unbounded, duplicated or changed');
  return {
    indexedHearingDate,
    originalPrintedHearingDate:header.printedHeaderDate,
    printedWeekdayMatchesPrintedDate:header.printedWeekdayMatchesPrintedDate,
    printedDateMatchesIndexed:header.printedHeaderDateAgreesWithIndexedDate,
    originalSourceOffset:candidate.sourceOffset,
    originalPassageContextSha256:sha(sourceNear),
    nearbyBillMentionsOnlyNotIndependentlyCertifiedMotion:[...new Set(billCandidates)].slice(-8),
    originalSourceNamedYeaCount:candidate.namedYeaCount,
    originalSourceNamedNayCount:candidate.namedNayCount,
    allElevenSourceSurnamesMatchOfficialCommitteeHistory:true as const,
    openingPresent:opening.openingPresentCount,
    openingAbsent:opening.openingAbsentCount,
    allElevenOpeningMemberStatusesPartitionHistoricalRoster:true as const,
    originalOpeningAbsentGivenExplicitYeaNay:openingAbsentWithSide.length,
    originalOpeningAbsentVoteSideHashes:openingAbsentWithSide.sort(),
    sourceOriginalRosterMembersWithoutRecordedYeaNay:roster.rosterMembersWithNoNamedChoice,
    anyOriginalOpeningAbsentVoteConflict:openingAbsentWithSide.length>0,
    sourceOriginalOpeningAttendanceIsNotRollTimeAttendance:true as const,
    originalVotesOnlyProvisionalUntilExactMotionReview:true as const,
    neverAutomaticProductionMemberVoteImport:true as const,
    noFloorPassageStanceInferred:true as const,
  };
}

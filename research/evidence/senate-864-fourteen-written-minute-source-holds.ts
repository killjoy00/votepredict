/**
 * #864: independently crosswalk remaining written-Minutes gaps after all
 * authenticated 2022-25 Clerk and supplementary original LRL PDF recoveries.
 * Source identity only: 2021 printed Minutes and 2022 print/electronic parity
 * are explicitly unknown; never infer absence of meetings or motions.
 */
type Key={year:number;committeeName:string;hearingDate:string};
type Gap=Key&{sourceClass:string;originalClerkSha256:string|null;
 independentOrphanOfficialLrlPdfSource:unknown|null};
type OriginalIndex={
 schemaVersion:string;issue:number;exclude2021Completely:boolean;
 originalLrlIndexSourceSha256:string;originalLrlIndexMeetings:number;
 originalNoLinkedMinuteMeetings:number;stillWithoutAuthenticatedWrittenMinutes:number;
 combinedIndexedMeetingsWithAuthenticatedWrittenMinutes:number;
 unverifiedDoesNotImplyZeroRecordedVotes:boolean;year2022PrintElectronicParityUnknown:boolean;
 perOriginallyIndexedNoPdfMeeting:Gap[];
};
type Eight={
 schemaVersion:string;issue:number;baselineOriginalLrlIndexSha256:string;
 baselineWrittenMinuteDays:number;baselineUnverifiedWrittenMinuteDays:number;
 originalNewlyAuthenticatedMeetingDates:number;originalNewlyAuthenticatedPdfBodies:number;
 revisedWithoutOriginalWrittenMinutes:number;originalFourMeetingDates:Key[];
 exactCurrentStoredEventOrIndividualMemberParityPerformed:boolean;
};
type Eleven={
 schemaVersion:string;issue:number;originalSourceIndexSha256:string;
 baselineWrittenMinuteMeetings:number;baselineStillHeld:number;
 distinctMeetingDatesNewlyAuthenticated:number;stillHeldMeetingDates:number;
 authenticatedWrittenMinuteMeetingDates:number;
 printedMinutesDateNotIndependentHistoricalFirstPublishedAt:boolean;
 originalSources:Key[];
};
const ORIGINAL='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const expected=[
 [2022,'2022-03-15','Housing Finance and Policy'],
 [2022,'2022-08-10','Environment and Natural Resources Finance'],
 [2022,'2022-10-03','Environment and Natural Resources Finance'],
 [2023,'2023-04-13','Environment, Climate, and Legacy'],
 [2023,'2023-04-27','Taxes'],
 [2024,'2024-03-20','Energy, Utilities, Environment and Climate'],
 [2024,'2024-04-03','Taxes'],
 [2024,'2024-05-01','Taxes'],
 [2024,'2024-05-16','Environment, Climate, and Legacy'],
 [2025,'2025-04-02','Energy, Utilities, Environment, and Climate'],
 [2025,'2025-04-07','Energy, Utilities, Environment, and Climate'],
 [2025,'2025-04-09','Energy, Utilities, Environment, and Climate'],
 [2025,'2025-04-28','Energy, Utilities, Environment, and Climate'],
 [2025,'2025-05-12','Rules and Administration - Subcommittee on Committees'],
] as const;
const key=(r:Key)=>[r.year,r.hearingDate,r.committeeName].join('|');
export function auditRemainingSenate864FourteenWrittenMinuteHolds(
 base:OriginalIndex,eight:Eight,eleven:Eleven){
 if(base.schemaVersion!=='senate-864-2022-25-141-official-unlinked-meeting-to-authenticated-written-minutes-v3'||
  base.issue!==864||!base.exclude2021Completely||
  base.originalLrlIndexSourceSha256!==ORIGINAL||
  base.originalLrlIndexMeetings!==1592||
  base.originalNoLinkedMinuteMeetings!==141||
  base.stillWithoutAuthenticatedWrittenMinutes!==29||
  base.combinedIndexedMeetingsWithAuthenticatedWrittenMinutes!==1563||
  !base.unverifiedDoesNotImplyZeroRecordedVotes||
  !base.year2022PrintElectronicParityUnknown||
  !Array.isArray(base.perOriginallyIndexedNoPdfMeeting)||
  base.perOriginallyIndexedNoPdfMeeting.length!==141||
  eight.schemaVersion!=='senate-864-alternate-lrl-original-8-pdf-unindexed-four-date-source-proof-v1'||
  eight.issue!==864||eight.baselineOriginalLrlIndexSha256!==ORIGINAL||
  eight.baselineWrittenMinuteDays!==1563||
  eight.baselineUnverifiedWrittenMinuteDays!==29||
  eight.originalNewlyAuthenticatedMeetingDates!==4||
  eight.originalNewlyAuthenticatedPdfBodies!==8||
  eight.revisedWithoutOriginalWrittenMinutes!==25||
  eight.exactCurrentStoredEventOrIndividualMemberParityPerformed!==false||
  !Array.isArray(eight.originalFourMeetingDates)||
  eight.originalFourMeetingDates.length!==4||
  eleven.schemaVersion!=='senate-864-original-official-LRL-11-previously-held-printed-same-day-minutes-v1'||
  eleven.issue!==864||eleven.originalSourceIndexSha256!==ORIGINAL||
  eleven.baselineWrittenMinuteMeetings!==1567||eleven.baselineStillHeld!==25||
  eleven.distinctMeetingDatesNewlyAuthenticated!==11||
  eleven.stillHeldMeetingDates!==14||
  eleven.authenticatedWrittenMinuteMeetingDates!==1578||
  !eleven.printedMinutesDateNotIndependentHistoricalFirstPublishedAt||
  !Array.isArray(eleven.originalSources)||eleven.originalSources.length!==11)
  throw Error('Wrong immutable 141/4/11 source receipt or unverified written-minute denominator');
 const unresolved=base.perOriginallyIndexedNoPdfMeeting.filter(r=>
  r.sourceClass==='no_written_minutes_authenticated_through_independent_routes'&&
  !r.originalClerkSha256&&!r.independentOrphanOfficialLrlPdfSource);
 const priorKeys=new Set(base.perOriginallyIndexedNoPdfMeeting.map(key));
 const recovered=[...eight.originalFourMeetingDates,...eleven.originalSources];
 const recoveredKeys=new Set(recovered.map(key));
 if(unresolved.length!==29||priorKeys.size!==141||
  recovered.length!==15||recoveredKeys.size!==15||
  recovered.some(v=>!priorKeys.has(key(v))||
   v.year<2022||v.year>2025||v.hearingDate.slice(0,4)!==String(v.year)))
  throw Error('Recovered supplementary minutes not exact source-index day identities');
 const unresolvedKeys=new Set(unresolved.map(key));
 if(unresolvedKeys.size!==29||
  [...recoveredKeys].some(k=>!unresolvedKeys.has(k)))
  throw Error('Recovered minute overlaps already authenticated linked source');
 const held=unresolved.filter(v=>!recoveredKeys.has(key(v)))
  .map(v=>({year:v.year,hearingDate:v.hearingDate,committeeName:v.committeeName,
   class:'official_indexed_date_without_authenticated_written_minutes' as const,
   namedMemberVotesProvenAbsent:false as const,
   recordedMotionsProvenAbsent:false as const}))
  .sort((a,b)=>a.year-b.year||a.hearingDate.localeCompare(b.hearingDate)||
   a.committeeName.localeCompare(b.committeeName));
 const actual=held.map(v=>[v.year,v.hearingDate,v.committeeName].join('|'));
 const expectedKeys=expected.map(v=>v.join('|'));
 if(held.length!==14||actual.join('\n')!==expectedKeys.join('\n'))
  throw Error('Last 14 official indexed committee dates/source identities drifted');
 const byYear=[2022,2023,2024,2025].map(year=>({
  year,sourceMeetingDatesStillHeld:held.filter(v=>v.year===year).length
 }));
 if(byYear.map(x=>x.sourceMeetingDatesStillHeld).join(',')!=='3,2,4,5')
  throw Error('Remaining fourteen source date year partition mismatch');
 return {
  schemaVersion:'senate-864-exact14-held-written-minute-dates-v1' as const,
  source2022To2025OriginalIndexedMeetingDates:1592 as const,
  sourcePreviouslyAuthenticatedWrittenMinuteDates:1563 as const,
  newlyVerifiedSupplementaryMeetingDates:15 as const,
  authenticatedWrittenMinuteMeetingDates:1578 as const,
  originalIndexedDatesStillWithoutAuthenticatedMinutes:14 as const,
  original2021PrintedMinutesCoverage:'UNKNOWN_NOT_DIGITALLY_AUTHENTICATED' as const,
  original2022PrintedVsElectronicMinuteParity:'UNKNOWN_UNPROVEN' as const,
  hearingDayConventionNotIndependentPDFPublicationDate:true as const,
  noAbsentRecordedVoteInferredFromMissingMinute:true as const,
  dateLevelSourceGapsNotProofOfMissingDatabaseVoteEvents:true as const,
  noDatabaseOrProductionWrite:true as const,
  noContactWithGovernmentOffices:true as const,
  byYear,held
 };
}

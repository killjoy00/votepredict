/**
 * Issue #864 — validate the exact independently SHA-authenticated 141 no-PDF
 * indexed-meeting ledger without inventing an official vote denominator.
 * No source-by-person rows, source text, media players or DB access.
 */
export const MISSING_864_BY_YEAR={2022:12,2023:64,2024:42,2025:23} as const;
const REF={
 sourceRun:38065594898,
 sourceArtifact:11674762938,
 sourcePayloadSha:'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0',
 canonicalRosterSha:'19b1766e42602e5267e6f9f4db0d3fc9b7eacc120b4f023ea2f15da7565c4584',
 mediaRun:38076153790,
} as const;
type GapRow={year:number;committeeName:string;meetingDate:string};
type Group={year:number;committeeName:string;officialIndexCommitteeId:string;
 missingMinutesMeetingDates:string[]};
export type GapLedger={
 schemaVersion:string;
 originalIndexedCensus:{
  runId:number;artifactId:number;originalJsonSha256:string;
  canonicalFourFieldRosterSha256ThisLedger:string;
  indexedMeetings:number;indexedMeetingsWithLinkedMinutes:number;
  indexedMeetingsWithoutLinkedMinutes:number;originalPdfLinks:number;
 };
 datedMediaCandidateTriage:{
  runId:number;indexOnlyMediaCandidateMeetings:number;
  indexedMeetingsWithoutDatedMediaCandidate:number;
  threeNoMediaCandidates:GapRow[];
  mediaLinksDoNotProvePlayableContentOrRecordedVotes:boolean;
 };
 meetingGroups:Group[];
 limitations:{
  years2021PrintOnlyMeetingVoteDenominator:null;
  year2022PrintAndElectronicCollectionsMayDiffer:boolean;
  completeOfficial2021To2025SenateCommitteeRecordedVoteDenominator:null;
  unlinkedMinutesDoesNotProveNoMeetingOrRecordedVote:boolean;
  mediaRecordLeadIsNotVerifiedRecordingOrNamedVote:boolean;
  issue864MustRemainOpen:boolean;
 };
};
const exactCases:readonly GapRow[]=[
 {year:2022,committeeName:'Energy and Utilities Finance and Policy',meetingDate:'2022-04-21'},
 {year:2024,committeeName:'Environment, Climate, and Legacy',meetingDate:'2024-05-16'},
 {year:2025,committeeName:'Rules and Administration - Subcommittee on Committees',meetingDate:'2025-05-12'},
];
function sortedDates(input:readonly GapRow[]){
 return input.map(x=>[x.year,x.committeeName,x.meetingDate].join('|')).sort();
}
export function audit141NoLinkedMinuteMeetings(ledger:GapLedger){
 if(ledger.schemaVersion!=='senate-2022-25-original-index-141-unlinked-minutes-compact-review-roster-v1')
  throw Error('Unknown official 141-source roster');
 const source=ledger.originalIndexedCensus,media=ledger.datedMediaCandidateTriage;
 if(source.runId!==REF.sourceRun||source.artifactId!==REF.sourceArtifact||
  source.originalJsonSha256!==REF.sourcePayloadSha||
  source.canonicalFourFieldRosterSha256ThisLedger!==REF.canonicalRosterSha||
  source.indexedMeetings!==1592||
  source.indexedMeetingsWithLinkedMinutes!==1451||
  source.indexedMeetingsWithoutLinkedMinutes!==141||
  source.originalPdfLinks!==1452||
  media.runId!==REF.mediaRun||media.indexOnlyMediaCandidateMeetings!==138||
  media.indexedMeetingsWithoutDatedMediaCandidate!==3||
  media.mediaLinksDoNotProvePlayableContentOrRecordedVotes!==true||
  !Array.isArray(media.threeNoMediaCandidates)||
  JSON.stringify(sortedDates(media.threeNoMediaCandidates))!==JSON.stringify(sortedDates(exactCases)))
  throw Error('Source universe, exact official index, or three missing media leads drifted');
 if(ledger.meetingGroups.length!==20)
  throw Error('Original 20 official committee-year groups must be exhaustive');
 const seen=new Set<string>();
 const years=new Map<number,number>([[2022,0],[2023,0],[2024,0],[2025,0]]);
 for(const g of ledger.meetingGroups){
  if(!years.has(g.year)||!g.committeeName||!g.officialIndexCommitteeId||
    !Array.isArray(g.missingMinutesMeetingDates)||g.missingMinutesMeetingDates.length===0)
   throw Error('Unknown official year/committee group');
  for(const day of g.missingMinutesMeetingDates){
   if(!/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(day)||
     Number.isNaN(Date.parse(g.year+'-'+day+'T00:00:00Z')))
    throw Error('Invalid original hearing day');
   const k=[g.year,g.officialIndexCommitteeId,day].join('|');
   if(seen.has(k))throw Error('Duplicate official committee/date entry');
   seen.add(k);years.set(g.year,years.get(g.year)!+1);
  }
 }
 if([...years].some(([y,count])=>count!==MISSING_864_BY_YEAR[y as keyof typeof MISSING_864_BY_YEAR])||
   seen.size!==141)
  throw Error('Official 141 missing-Minutes meeting roster was not exhaustive');
 const limits=ledger.limitations;
 if(limits.years2021PrintOnlyMeetingVoteDenominator!==null||
  limits.year2022PrintAndElectronicCollectionsMayDiffer!==true||
  limits.completeOfficial2021To2025SenateCommitteeRecordedVoteDenominator!==null||
  limits.unlinkedMinutesDoesNotProveNoMeetingOrRecordedVote!==true||
  limits.mediaRecordLeadIsNotVerifiedRecordingOrNamedVote!==true||
  limits.issue864MustRemainOpen!==true)
  throw Error('Print-versus-electronic and official total denominators must remain held');
 return {
  schemaVersion:'senate-864-committee-no-linked-minutes-141-print-gap-gates-v1' as const,
  issue:864 as const,yearCounts:{...MISSING_864_BY_YEAR},
  official2022To2025IndexedMeetings:1592 as const,
  linkedMinutesMeetingEntries:1451 as const,
  officialLinkedOriginalPdfUrls:1452 as const,
  noLinkedMinutesMeetingEntries:141 as const,
  datedMediaPageLeadsNotActualVotes:138 as const,
  noDatedMediaPageLeads:3 as const,
  threeNoMediaCasesStillUnresolved:true as const,
  official2021PrintMinutesMeetingAndVoteDenominator:'UNKNOWN' as const,
  year2022PrintAndElectronicParity:'UNVERIFIED' as const,
  actualMediaPlaybackAndMotionTranscription:'NOT_CERTIFIED' as const,
  fullOfficialRecordedMotionDenominator:'UNKNOWN' as const,
  noNoVoteInferredFromMissingPdf:true as const,
  noPrivateDatabaseReadOrWrite:true as const,
  noOfficeContact:true as const,
  issue864Open:true as const,
 };
}

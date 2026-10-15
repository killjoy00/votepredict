/**
 * #864 append-only source proof overlay: four formerly held official LRL
 * meeting days now each have TWO independently SHA-verified original PDF
 * bodies. The prior 141-row gap ledger remains immutable first-pass history,
 * not retroactively falsified. No private DB event or senator identity joins.
 */
import type {buildSenate864AllSourceActionInventory} from './senate-864-all-source-action-inventory.js';
type Ledger=ReturnType<typeof buildSenate864AllSourceActionInventory>;
export type NewOriginalPdf={
 originalSourceUrl:string;originalRawPdfSha256:string;originalPdfBytes:number;
 parserContextActionOccurrences:number;parserNamedRollCandidates:number;
 parserCountOnlyRollCandidates:number;individualNamedChoicesInferred:number;
 originalPdfByteShaIndependentlyVerified:boolean;
 printedOfficialCommitteeAndHearingDateIndependentlyVerified:boolean;
 sourceToStoredPersonVoteParityPerformed:boolean;
};
export type SupplementaryMinutes={
 schemaVersion:string;issue:number;exclude2021CommitteeResearch:boolean;
 baselineOriginalLrlIndexSha256:string;baselineIndexedMeetingDates:number;
 baselineWrittenMinuteDays:number;baselineUnverifiedWrittenMinuteDays:number;
 originalAcquisitionRunId:number;originalActionsArtifactId:number;
 originalActionsArtifactZipSha256:string;
 originalIndexedMissingMinuteMeetingDatesExamined:number;
 originalNewlyAuthenticatedMeetingDates:number;originalNewlyAuthenticatedPdfBodies:number;
 revisedWrittenMinuteMeetingDates:number;revisedWithoutOriginalWrittenMinutes:number;
 originalFourMeetingDates:Array<{
  year:number;committeeName:string;hearingDate:string;
  officialOriginalPdfBodies:NewOriginalPdf[];
 }>;
};
const sha=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const SRC="ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0";
const cohort="senate-864-alternate-lrl-original-8-pdf-unindexed-four-date-source-proof-v1";
const pinZip="1e4fa7a20643e3b10d750cf991935a62af70956e03d63de18a4ba545362ca893";
export function integrateSenate864SupplementaryLrlOriginalMinutes(
 baseline:Ledger,receipts:SupplementaryMinutes){
 if(receipts.schemaVersion!==cohort||receipts.issue!==864||
  receipts.exclude2021CommitteeResearch!==true||
  receipts.baselineOriginalLrlIndexSha256!==SRC||
  receipts.baselineIndexedMeetingDates!==1592||
  receipts.baselineWrittenMinuteDays!==1563||
  receipts.baselineUnverifiedWrittenMinuteDays!==29||
  receipts.originalAcquisitionRunId!==38680515336||
  receipts.originalActionsArtifactId!==11948425264||
  receipts.originalActionsArtifactZipSha256!==pinZip||
  receipts.originalIndexedMissingMinuteMeetingDatesExamined!==29||
  receipts.originalNewlyAuthenticatedMeetingDates!==4||
  receipts.originalNewlyAuthenticatedPdfBodies!==8||
  receipts.revisedWrittenMinuteMeetingDates!==1567||
  receipts.revisedWithoutOriginalWrittenMinutes!==25||
  baseline.officialIndexedMeetings!==1592||
  baseline.authenticatedWrittenMinutesMeetingDates!==1563||
  baseline.indexedMeetingDatesStillWithoutWrittenMinutes!==29||
  baseline.perIndexedMeeting.length!==1592||
  receipts.originalFourMeetingDates.length!==4)
  throw Error('Original 2022-25 indexed Minutes cohort or SHA-attested 8-PDF overlay drift');
 const meetingKeys=new Set<string>(),urls=new Set<string>(),sourceShas=new Set<string>();
 const byKey=new Map<string,SupplementaryMinutes['originalFourMeetingDates'][number]>();
 let sumCandidateContexts=0;
 for(const r of receipts.originalFourMeetingDates){
  const key=[r.year,r.committeeName,r.hearingDate].join('|');
  if(meetingKeys.has(key)||![2022,2023].includes(r.year)||
   !r.hearingDate.startsWith(r.year+'-')||r.officialOriginalPdfBodies.length!==2)
   throw Error('Original additional government minutes meeting/date not unique or out of scope');
  meetingKeys.add(key);byKey.set(key,r);
  for(const p of r.officialOriginalPdfBodies){
   const u=new URL(p.originalSourceUrl);
   if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||u.search||u.hash||
    !u.pathname.startsWith('/archive/minutes/senate/'+r.year+'/')||
    !/minutes[^/]*\.pdf$/i.test(u.pathname)||urls.has(p.originalSourceUrl)||
    !sha(p.originalRawPdfSha256)||sourceShas.has(p.originalRawPdfSha256)||
    !Number.isSafeInteger(p.originalPdfBytes)||p.originalPdfBytes<300||
    p.originalPdfBytes>8_000_000||
    !Number.isSafeInteger(p.parserContextActionOccurrences)||
    p.parserContextActionOccurrences<0||
    p.parserNamedRollCandidates!==0||p.parserCountOnlyRollCandidates!==0||
    p.individualNamedChoicesInferred!==0||
    p.originalPdfByteShaIndependentlyVerified!==true||
    p.printedOfficialCommitteeAndHearingDateIndependentlyVerified!==true||
    p.sourceToStoredPersonVoteParityPerformed!==false)
    throw Error('Original alternate PDF provenance or no-individual-inference rules violated');
   urls.add(p.originalSourceUrl);sourceShas.add(p.originalRawPdfSha256);
   sumCandidateContexts+=p.parserContextActionOccurrences;
  }
 }
 if(urls.size!==8||sumCandidateContexts!==14)
  throw Error('Independent eight government original PDF actions conservation failed');
 const updated=baseline.perIndexedMeeting.map(m=>{
  const key=[m.year,m.committeeName,m.hearingDate].join('|');
  const recovered=byKey.get(key);
  if(!recovered)return m;
  if(m.writtenMinuteClass!=='unverified_written_minutes'||m.officialOriginalSha!==null||
   m.namedRollCandidates!==null||m.namedChoiceOccurrences!==null)
   throw Error('Previously unauthenticated indexed government minute was already proven');
  return {
   ...m,writtenMinuteClass:'authenticated_other_lrl_pdf' as const,
   officialOriginalSha:recovered.officialOriginalPdfBodies[0]!.originalRawPdfSha256,
   // Two originals on one indexed hearing date are separate morning/evening
   // documents, NOT two meetings and NOT necessarily six distinct votes.
   additionalOriginalPdfBodies:recovered.officialOriginalPdfBodies.map(x=>({
    originalSourceUrl:x.originalSourceUrl,
    sourceSha256:x.originalRawPdfSha256,originalPdfBytes:x.originalPdfBytes,
    parserContextActionOccurrences:x.parserContextActionOccurrences,
    namedIndividualChoicesVerified:0
   })),
   nonExhaustiveContextCandidatesInOriginalDocuments:
    recovered.officialOriginalPdfBodies.reduce((n,x)=>n+x.parserContextActionOccurrences,0),
   sourceActionsDeduplicatedAcrossDocuments:false,
   originalFirstPublicByTimeIndependentlyProven:false,
  };
 });
 if(updated.filter(x=>x.writtenMinuteClass==='unverified_written_minutes').length!==25||
  updated.filter(x=>x.writtenMinuteClass==='authenticated_other_lrl_pdf').length!==5)
  throw Error('Twenty-five remaining original minute holds not conserved');
 const byYear=baseline.byYear.map(r=>{
  const added=receipts.originalFourMeetingDates.filter(x=>x.year===r.year).length;
  return {...r,
   archiveMinutesWithoutIndexLink:r.archiveMinutesWithoutIndexLink+added,
   missingOriginalWrittenMinutes:r.missingOriginalWrittenMinutes-added,
   originalAlternateLrlMinutePDFsAdded:added*2
  };
 });
 if(byYear.map(x=>x.missingOriginalWrittenMinutes).join(',')!=='3,3,14,5'||
  byYear.reduce((n,x)=>n+x.originalAlternateLrlMinutePDFsAdded,0)!==8)
  throw Error('Updated government original four-year written-source year ledger drift');
 return {...baseline,
  priorAuthenticatedWrittenMinutesMeetingDates:baseline.authenticatedWrittenMinutesMeetingDates,
  priorIndexedMeetingDatesStillWithoutWrittenMinutes:baseline.indexedMeetingDatesStillWithoutWrittenMinutes,
  newlyOriginalShaAuthenticatedGovernmentMinutesBodies:8,
  newlyOriginalShaAuthenticatedGovernmentMeetingDates:4,
  originalArchivedPdfBodiesOutsideOriginalIndex:9, // eight new + one previously verified Housing
  authenticatedWrittenMinutesMeetingDates:1567 as const,
  indexedMeetingDatesStillWithoutWrittenMinutes:25 as const,
  sourceToActualVoteEventOrMemberVoteStoreStillNotReconciled:true as const,
  allOriginalSenateCommitteeActionsKnown:false as const,
  combinedSourceReceiptsNewlyVerifiedByRun:38680515336 as const,
  byYear,perIndexedMeeting:updated};
}

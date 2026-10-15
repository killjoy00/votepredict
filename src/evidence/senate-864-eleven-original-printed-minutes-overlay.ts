/**
 * Issue #864. Additive official 2022-25 original Senate Minutes source proof:
 * 11 independently SHA-verified original LRL PDFs, each with exact printed
 * committee and hearing-day identity. The previously authenticated 1567-day
 * source inventory is not overwritten or silently reclassified in history.
 *
 * These 11 originals offer 51 CONTEXT parser occurrences (not deduplicated
 * distinct motions), NO directly parsed named member votes, and no current
 * database event/member_vote reconciliation. Not a production importer.
 */
import type {integrateSenate864SupplementaryLrlOriginalMinutes} from
 './senate-864-2022-25-official-original-minutes-overlay.js';
type Prior=ReturnType<typeof integrateSenate864SupplementaryLrlOriginalMinutes>;
type Recovered={
 year:number;committeeName:string;hearingDate:string;
 originalSourceUrl:string;originalRawPdfSha256:string;
 originalExtractedTextSha256:string;originalPdfBytes:number;
 originalContextParserCandidates:number;
 originalTextExtractionMethod:'embedded_text'|'ocr_tesseract';
 firstPrintedDateFromOriginalHeader:string;
 sourcePrintedCommitteeAndDayMatched:true;printedMinutesDocumentType:true;
 originalNamedRollParserCandidates:0;originalCountOnlyParserCandidates:0;
 originalPrintedNamedChoiceOccurrences:0;
 sourceActionCandidateNotCertifiedDistinctEvent:true;
 storedEventMemberVoteParityNotPerformed:true;
};
export type OriginalElevenMinuteReceipt={
 schemaVersion:string;issue:864;years:number[];exclude2021Completely:true;
 originalSourceIndexSha256:string;
 baselineWrittenMinuteMeetings:1567;baselineStillHeld:25;
 originalDiagnosticRunId:38749557797;
 originalSourceArtifactProofs:Array<{
  year:number;artifactId:number;originalZipSha256:string;
  originalCandidateUrls:number;shaDownloaded:number;originalSameDayPrintedMinutes:number;
 }>;
 originalCandidateOfficialLrlPdfUrls:30;allCandidateOriginalShaDownloaded:30;
 originalPrintedHeaderSameDateAndCommittee:11;
 distinctMeetingDatesNewlyAuthenticated:11;stillHeldMeetingDates:14;
 authenticatedWrittenMinuteMeetingDates:1578;
 newlyNamedRollCandidates:0;newlyIndividualNamedChoices:0;
 contextParserOccurrencesNotIndependentlyDeduplicated:51;
 noPersonVoteRowsImported:true;noDeployedNeonParityChecked:true;
 printedMinutesDateNotIndependentHistoricalFirstPublishedAt:true;
 originalSources:Recovered[];
};
const SRC='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const ARTIFACTS={
 2023:[11979984527,'07af946e857ba7754d3bb433563d51231725863911bbd2cdac6207ae38dbeca1',2,1],
 2024:[11981235308,'ecadc66cdf44a015adee2f2cf50173d8f3065a27676d7a33ab4ed69a691d5846',24,10],
 2025:[11980916410,'69023b1b312a1f9dbec2141e83806bcefc896539232e25e9985281ec16a79339',4,0]
} as const;
const digest=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const key=(m:{year:number;committeeName:string;hearingDate:string})=>
 [m.year,m.committeeName,m.hearingDate].join('|');
export function integrateSenate864ElevenOriginalSameDayMinutes(
 baseline:Prior,receipt:OriginalElevenMinuteReceipt){
 if(receipt.schemaVersion!=='senate-864-original-official-LRL-11-previously-held-printed-same-day-minutes-v1'||
  receipt.issue!==864||JSON.stringify(receipt.years)!=='[2022,2023,2024,2025]'||
  receipt.exclude2021Completely!==true||
  receipt.originalSourceIndexSha256!==SRC||
  receipt.baselineWrittenMinuteMeetings!==1567||receipt.baselineStillHeld!==25||
  receipt.originalDiagnosticRunId!==38749557797||
  receipt.originalCandidateOfficialLrlPdfUrls!==30||
  receipt.allCandidateOriginalShaDownloaded!==30||
  receipt.originalPrintedHeaderSameDateAndCommittee!==11||
  receipt.distinctMeetingDatesNewlyAuthenticated!==11||
  receipt.stillHeldMeetingDates!==14||
  receipt.authenticatedWrittenMinuteMeetingDates!==1578||
  receipt.newlyNamedRollCandidates!==0||
  receipt.newlyIndividualNamedChoices!==0||
  receipt.contextParserOccurrencesNotIndependentlyDeduplicated!==51||
  receipt.noPersonVoteRowsImported!==true||
  receipt.noDeployedNeonParityChecked!==true||
  receipt.printedMinutesDateNotIndependentHistoricalFirstPublishedAt!==true||
  receipt.originalSources.length!==11||
  baseline.authenticatedWrittenMinutesMeetingDates!==1567||
  baseline.indexedMeetingDatesStillWithoutWrittenMinutes!==25||
  baseline.perIndexedMeeting.length!==1592||
  baseline.originalArchivedPdfBodiesOutsideOriginalIndex!==9)
  throw Error('Wrong exact 2022-25 source ledger or eleven-source original receipt version');
 const pinned=receipt.originalSourceArtifactProofs;
 if(pinned.length!==3||[2023,2024,2025].some((year,i)=>{
  const actual=pinned[i],p=ARTIFACTS[year as keyof typeof ARTIFACTS];
  return actual?.year!==year||actual.artifactId!==p[0]||
   actual.originalZipSha256!==p[1]||
   actual.originalCandidateUrls!==p[2]||actual.shaDownloaded!==p[2]||
   actual.originalSameDayPrintedMinutes!==p[3];
 }))throw Error('Independently acquired original PDF diagnostic artifact SHA or count differs');
 const byKey=new Map<string,Recovered>(),urls=new Set<string>(),hashes=new Set<string>();
 let contexts=0;
 const perYear={2022:0,2023:0,2024:0,2025:0} as Record<number,number>;
 for(const s of receipt.originalSources){
  const identity=key(s),u=new URL(s.originalSourceUrl);
  if(![2023,2024].includes(s.year)||byKey.has(identity)||
   !/^202[34]-\d\d-\d\d$/.test(s.hearingDate)||
   !s.hearingDate.startsWith(String(s.year)+'-')||
   !s.committeeName.trim()||s.committeeName.length>150||
   u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||u.search||u.hash||
   u.username||u.password||
   !u.pathname.startsWith('/archive/minutes/senate/'+s.year+'/')||
   !u.pathname.includes('/'+s.hearingDate.replaceAll('-','')+'/')||
   !/minutes[^/]*\.pdf$/i.test(u.pathname)||
   urls.has(s.originalSourceUrl)||hashes.has(s.originalRawPdfSha256)||
   !digest(s.originalRawPdfSha256)||!digest(s.originalExtractedTextSha256)||
   !Number.isSafeInteger(s.originalPdfBytes)||s.originalPdfBytes<300||
   s.originalPdfBytes>10_000_000||
   !Number.isSafeInteger(s.originalContextParserCandidates)||
   s.originalContextParserCandidates<0||s.originalContextParserCandidates>100||
   !['embedded_text','ocr_tesseract'].includes(s.originalTextExtractionMethod)||
   s.firstPrintedDateFromOriginalHeader!==s.hearingDate||
   s.sourcePrintedCommitteeAndDayMatched!==true||
   s.printedMinutesDocumentType!==true||
   s.originalNamedRollParserCandidates!==0||
   s.originalCountOnlyParserCandidates!==0||
   s.originalPrintedNamedChoiceOccurrences!==0||
   s.sourceActionCandidateNotCertifiedDistinctEvent!==true||
   s.storedEventMemberVoteParityNotPerformed!==true)
   throw Error('Original committee/date/PDF/SHA or no-vote-inference bound invalid');
  byKey.set(identity,s);urls.add(s.originalSourceUrl);
  hashes.add(s.originalRawPdfSha256);
  perYear[s.year]++;
  contexts+=s.originalContextParserCandidates;
 }
 if(urls.size!==11||perYear[2022]!==0||perYear[2023]!==1||
  perYear[2024]!==10||perYear[2025]!==0||contexts!==51)
  throw Error('The eleven exact original PDF source day/action counts are not conserved');
 const seen=new Set<string>();
 const updated=baseline.perIndexedMeeting.map(m=>{
  const id=key(m),s=byKey.get(id);
  if(!s)return m;
  if(seen.has(id)||m.writtenMinuteClass!=='unverified_written_minutes'||
   m.officialOriginalSha!==null||m.namedRollCandidates!==null||
   m.namedChoiceOccurrences!==null||m.year!==s.year)
   throw Error('Already covered or duplicated original committee day');
  seen.add(id);
  return {
   ...m,writtenMinuteClass:'authenticated_other_lrl_pdf' as const,
   officialOriginalSha:s.originalRawPdfSha256,
   additionalOriginalPdfBodies:[{
    originalSourceUrl:s.originalSourceUrl,sourceSha256:s.originalRawPdfSha256,
    sourceTextSha256:s.originalExtractedTextSha256,
    originalPdfBytes:s.originalPdfBytes,
    printedCommitteeAndDayMatched:true as const,
    parserContextActionOccurrences:s.originalContextParserCandidates,
    namedIndividualChoicesVerified:0 as const
   }],
   nonExhaustiveContextCandidatesInOriginalDocuments:s.originalContextParserCandidates,
   sourceActionsDeduplicatedAcrossDocuments:false as const,
   originalFirstPublicByTimeIndependentlyProven:false as const
  };
 });
 if(seen.size!==11||
  updated.filter(x=>x.writtenMinuteClass==='unverified_written_minutes').length!==14||
  updated.filter(x=>x.writtenMinuteClass==='authenticated_other_lrl_pdf').length!==16)
  throw Error('New 11 original government written minutes cannot map to source holds');
 const byYear=baseline.byYear.map(r=>({
  ...r,archiveMinutesWithoutIndexLink:r.archiveMinutesWithoutIndexLink+perYear[r.year],
  missingOriginalWrittenMinutes:r.missingOriginalWrittenMinutes-perYear[r.year],
  originalSupplementaryPrintedDayPdfBodiesAdded:perYear[r.year]
 }));
 if(byYear.map(x=>x.missingOriginalWrittenMinutes).join(',')!=='3,2,4,5')
  throw Error('Remaining 14 2022-25 written minute holds or year count changed');
 return {...baseline,
  priorOriginalWrittenMinuteMeetingDates:1567 as const,
  priorStillUnverifiedMinuteDates:25 as const,
  additionalPrintedSameDayOriginalMinutesMeetingDates:11 as const,
  additionalPrintedSameDayOriginalPdfBodies:11 as const,
  additionalContextParserOccurrencesNotDeduplicated:51 as const,
  recoveredFromOriginalGovernmentSourceRun:38749557797 as const,
  originalArchivedPdfBodiesOutsideOriginalIndex:20 as const,
  newlyOriginalShaAuthenticatedGovernmentMinutesBodies:19 as const,
  newlyOriginalShaAuthenticatedGovernmentMeetingDates:15 as const,
  authenticatedWrittenMinutesMeetingDates:1578 as const,
  indexedMeetingDatesStillWithoutWrittenMinutes:14 as const,
  originalMinutesCoverageNotVoteEventCompleteness:true as const,
  sourceToActualVoteEventOrMemberVoteStoreStillNotReconciled:true as const,
  allOriginalSenateCommitteeActionsKnown:false as const,
  byYear,perIndexedMeeting:updated};
}

/**
 * #864 — one immutable ORIGINAL-source union of all already acquired 2022-25
 * Minnesota Senate committee evidence, including LRL-indexed linked PDFs,
 * Clerk alternate written minutes and one indexed-unlinked original LRL PDF.
 *
 * This is an audit, NOT a stored vote/membership import or exhaustive count.
 * It never exports source person's names or assumes original URL text alone
 * proves a member vote, a distinct parliamentary motion, or historic publish.
 */
type Year=2022|2023|2024|2025;
type LinkedOriginal={
 sourceUrl:string;originalPdfSha256:string|null;
 sourceActions:Array<{actionType:string;explicitlyNamedChoiceOccurrences:number}>;
};
type IndexedMeeting={
 year:number;committee:string;hearingDate:string;status:string;
 originalMinutes:LinkedOriginal[];
 namedRollCandidates:number|null;countOnlyRollCandidates:number|null;
 namedChoiceOccurrences:number|null;hasOriginalPdf:boolean;
};
type IndexedLedger={meetingCensusOriginalSha256:string;meetings:IndexedMeeting[]};
type Gap={
 year:number;committeeName:string;hearingDate:string;sourceClass:string;
 originalClerkSha256:string|null;originalClerkTextSha256:string|null;
 originalSenateHearingId:number|null;
 independentOrphanOfficialLrlPdfSource?:{
  originalPdfSha256:string;parliamentaryMotionProposalsNotCertifiedOutcomes:number;
  namedIndividualVoteEvidence:false;originalShaVerifiedRun:number;
 };
};
type GapLedger={
 originalLrlIndexSourceSha256:string;perOriginallyIndexedNoPdfMeeting:Gap[];
 independentlyAuthenticatedOriginalClerkHtmlMeetings:number;
 independentlyAuthenticatedOtherUnlinkedOfficialLrlMinutesPdfMeetings:number;
 combinedIndexedMeetingsWithAuthenticatedWrittenMinutes:number;
 stillWithoutAuthenticatedWrittenMinutes:number;
};
type Original2023First={
 perOfficiallyIndexedMeeting:Array<{
  year:number;committeeName:string;hearingDate:string;
  onlineSenateClerkMinutesSourceStatus:string;
  parserRecognizedResultOnlyMotionCandidates:number|null;
  parserRecognizedCountOnlyRollCallCandidates:number|null;
  originalSenateHtmlSha256:string|null;
 }>;
};
type Original2023Later={
 perExactGovernmentIndexedMeeting:Array<{
  committeeName:string;hearingDate:string;
  clerkOriginalFoundInAtLeastOneOfficialSourceRun:boolean;
  originalClerkHtmlSha256:string|null;
  currentSourceActionCandidatesNonExhaustive:number|null;
  originalPrintedNamedRollCandidatesNonExhaustive:number|null;
 }>;
};
type OriginalHighGap={
 everyOriginalMeeting:Array<{
  year:number;committeeName:string;hearingDate:string;
  senateClerkHtmlSha:string|null;actionCandidates:number;
  originalExplicitNamedRolls:number;originalExplicitNamedChoiceEntries:number;
  countOnly:number;resultOnly:number;voice:number;
 }>;
};
type OriginalOther={
 perOriginalIndexedMeeting:Array<{
  year:number;committeeName:string;hearingDate:string;
  authenticatedClerkOriginalBoolean:boolean;
  originalClerkHtmlSha256:string|null;
  originalMotionResultTextCues:number|null;
 }>;
};
const SOURCE_SHA='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const isSha=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const identity=(x:{year:number;committeeName?:string;committee?:string;hearingDate:string})=>
 x.year+'|'+(x.committeeName??x.committee)+'|'+x.hearingDate;
function byId<T extends {year:number;committeeName:string;hearingDate:string}>(rows:readonly T[]){
 const m=new Map<string,T>();
 for(const r of rows){
  const k=identity(r);
  if(m.has(k))throw Error('Duplicate independent original government meeting identity');
  m.set(k,r);
 }
 return m;
}
export type SourceActionInventoryInputs={
 indexed:IndexedLedger;gaps:GapLedger;first2023:Original2023First;
 later2023:Original2023Later;highGap:OriginalHighGap;other:OriginalOther;
};
export function buildSenate864AllSourceActionInventory(source:SourceActionInventoryInputs){
 const {indexed,gaps,first2023,later2023,highGap,other}=source;
 if(indexed.meetingCensusOriginalSha256!==SOURCE_SHA||
  gaps.originalLrlIndexSourceSha256!==SOURCE_SHA||
  indexed.meetings.length!==1592||gaps.perOriginallyIndexedNoPdfMeeting.length!==141||
  gaps.independentlyAuthenticatedOriginalClerkHtmlMeetings!==111||
  gaps.independentlyAuthenticatedOtherUnlinkedOfficialLrlMinutesPdfMeetings!==1||
  gaps.combinedIndexedMeetingsWithAuthenticatedWrittenMinutes!==1563||
  gaps.stillWithoutAuthenticatedWrittenMinutes!==29||
  first2023.perOfficiallyIndexedMeeting.length!==64||
  later2023.perExactGovernmentIndexedMeeting.length!==50||
  highGap.everyOriginalMeeting.length!==53||
  other.perOriginalIndexedMeeting.length!==24)
  throw Error('Incomplete original indexed 2022-25 universe or known SHA source receipts');
 const gapIndex=byId(gaps.perOriginallyIndexedNoPdfMeeting);
 const initial2023=byId(first2023.perOfficiallyIndexedMeeting);
 const later2023Index=byId(later2023.perExactGovernmentIndexedMeeting.map(x=>({...x,year:2023})));
 const high=byId(highGap.everyOriginalMeeting);
 const otherIndex=byId(other.perOriginalIndexedMeeting);
 const seen=new Set<string>();
 let officialLinked=0,linkedPdfs=0,linkedNamed=0,linkedCount=0,linkedChoices=0;
 let alternateClerk=0,orphanPdf=0,held=0;
 let altExplicitNamed=0,altExplicitChoices=0;
 let first2023Count=0,first2023Result=0,later2023Candidate=0;
 let highCandidates=0,highCounts=0,highResult=0,highVoice=0;
 let otherResultCues=0,orphanMotionProposals=0;
 const ledger:Array<{
  year:Year;committeeName:string;hearingDate:string;
  writtenMinuteClass:'official_index_linked_pdf'|'authenticated_clerk_html'|
   'authenticated_other_lrl_pdf'|'unverified_written_minutes';
  officialOriginalSha:string|null;namedRollCandidates:number|null;
  namedChoiceOccurrences:number|null;countOnlyCandidates:number|null;
  boundedOtherActionCandidates:number|null;
  resultTextSignalsNotMotionCertified:number|null;
  sourcePublicationDayVerified:false;storedNamedVoteParityChecked:false;
  noVoteFromMissingSourceInferred:false;
 }>=[];
 for(const r of indexed.meetings){
  const y=r.year;
  if(![2022,2023,2024,2025].includes(y)||!/^\d{4}-\d\d-\d\d$/.test(r.hearingDate))
   throw Error('Outside official indexed 2022-25 dated committee source');
  const id=identity(r);
  if(seen.has(id))throw Error('Duplicate government indexed committee and hearing day');
  seen.add(id);
  if(r.hasOriginalPdf){
   if(gapIndex.has(id)||r.originalMinutes.length<1||
    r.originalMinutes.some(x=>!isSha(x.originalPdfSha256)||!Array.isArray(x.sourceActions)))
    throw Error('Original indexed PDF minute body and SHA not independently complete');
   officialLinked++;
   linkedPdfs+=r.originalMinutes.length;
   const actions=r.originalMinutes.flatMap(x=>x.sourceActions);
   const named=actions.filter(x=>x.actionType==='named_roll_call');
   const counted=actions.filter(x=>x.actionType==='count_only_roll_call');
   const choices=named.reduce((s,x)=>s+x.explicitlyNamedChoiceOccurrences,0);
   if(named.length!==r.namedRollCandidates||counted.length!==r.countOnlyRollCandidates||
    choices!==r.namedChoiceOccurrences)throw Error('Indexed original source action/type/choice drift');
   linkedNamed+=named.length;linkedCount+=counted.length;linkedChoices+=choices;
   ledger.push({
    year:y as Year,committeeName:r.committee,hearingDate:r.hearingDate,
    writtenMinuteClass:'official_index_linked_pdf',
    officialOriginalSha:r.originalMinutes[0]!.originalPdfSha256,
    namedRollCandidates:named.length,namedChoiceOccurrences:choices,countOnlyCandidates:counted.length,
    boundedOtherActionCandidates:actions.length-named.length-counted.length,
    resultTextSignalsNotMotionCertified:null,
    sourcePublicationDayVerified:false,storedNamedVoteParityChecked:false,
    noVoteFromMissingSourceInferred:false
   });
   continue;
  }
  if(r.originalMinutes.length!==0||r.status!=='indexed_without_linked_minutes')
   throw Error('No-linked source is not an indexed original absent-Minutes meeting');
  const g=gapIndex.get(id);
  if(!g)throw Error('Indexed no-PDF day absent from original 141-row crosswalk');
  let docSha:string|null=null,named:null|number=null,choices:null|number=null;
  let counted:null|number=null,candidates:null|number=null,cues:null|number=null;
  let category:'authenticated_clerk_html'|'authenticated_other_lrl_pdf'|
    'unverified_written_minutes'='unverified_written_minutes';
  if(g.originalClerkSha256!==null){
   if(!isSha(g.originalClerkSha256)||!isSha(g.originalClerkTextSha256)||
    !Number.isSafeInteger(g.originalSenateHearingId)||g.originalSenateHearingId!<15000)
    throw Error('Unverified original Clerk byte SHA or government Senate ID');
   category='authenticated_clerk_html';alternateClerk++;docSha=g.originalClerkSha256;
   if(g.sourceClass==='initial_2023_Clerk_written_minute'){
    const m=initial2023.get(id);
    if(!m||m.onlineSenateClerkMinutesSourceStatus!=='independently_authenticated_original_html'||
      m.originalSenateHtmlSha256!==docSha)
     throw Error('Initial independent 2023 Clerk original not pinned to actual meeting');
    named=0;choices=0;
    counted=m.parserRecognizedCountOnlyRollCallCandidates??0;
    candidates=(m.parserRecognizedResultOnlyMotionCandidates??0)+counted;
    first2023Count+=counted;
    first2023Result+=m.parserRecognizedResultOnlyMotionCandidates??0;
   }else if(g.sourceClass==='additional_2023_Clerk_written_minute'||
             g.sourceClass==='2023_third_original_source_run_Clerk_minutes'){
    const m=later2023Index.get(id);
    if(!m||!m.clerkOriginalFoundInAtLeastOneOfficialSourceRun||
      m.originalClerkHtmlSha256!==docSha)
     throw Error('Later original 2023 Clerk SHA or unique source identity drift');
    named=m.originalPrintedNamedRollCandidatesNonExhaustive??0;
    choices=0;counted=null;candidates=m.currentSourceActionCandidatesNonExhaustive;
    later2023Candidate+=candidates??0;
   }else if(g.sourceClass==='2024_25_high_gap_Clerk_written_minute'){
    const m=high.get(id);
    if(!m||m.senateClerkHtmlSha!==docSha||
      m.actionCandidates!==m.originalExplicitNamedRolls+m.countOnly+m.resultOnly+m.voice)
     throw Error('Strict original 2024/25 Clerk roll and motion candidates drift');
    named=m.originalExplicitNamedRolls;choices=m.originalExplicitNamedChoiceEntries;
    counted=m.countOnly;candidates=m.actionCandidates;
    altExplicitNamed+=named;altExplicitChoices+=choices;
    highCandidates+=m.actionCandidates;highCounts+=m.countOnly;
    highResult+=m.resultOnly;highVoice+=m.voice;
   }else if(g.sourceClass==='other_2022_24_25_Clerk_written_minute'){
    const m=otherIndex.get(id);
    if(!m||!m.authenticatedClerkOriginalBoolean||m.originalClerkHtmlSha256!==docSha)
     throw Error('Other 24 original Clerk hash and dated identity drift');
    named=null;choices=null;counted=null;candidates=null;
    cues=m.originalMotionResultTextCues??0;otherResultCues+=cues;
   }else throw Error('Unauthorized alternate Clerk origin class');
  }else if(g.independentOrphanOfficialLrlPdfSource){
   const m=g.independentOrphanOfficialLrlPdfSource;
   if(g.sourceClass!=='independent_original_lrl_archived_minutes_pdf_without_index_link'||
    !isSha(m.originalPdfSha256)||m.namedIndividualVoteEvidence!==false||
    m.parliamentaryMotionProposalsNotCertifiedOutcomes!==2||
    m.originalShaVerifiedRun!==38621595082)
    throw Error('Original archived but index-unlinked 2022 PDF proof drift');
   orphanPdf++;category='authenticated_other_lrl_pdf';docSha=m.originalPdfSha256;
   orphanMotionProposals+=m.parliamentaryMotionProposalsNotCertifiedOutcomes;
  }else{
   if(g.sourceClass!=='no_written_minutes_authenticated_through_independent_routes')
    throw Error('Missing original Minutes must retain explicit source hold');
   held++;
  }
  ledger.push({
   year:y as Year,committeeName:r.committee,hearingDate:r.hearingDate,
   writtenMinuteClass:category,officialOriginalSha:docSha,
   namedRollCandidates:named,namedChoiceOccurrences:choices,
   countOnlyCandidates:counted,boundedOtherActionCandidates:candidates,
   resultTextSignalsNotMotionCertified:cues,sourcePublicationDayVerified:false,
   storedNamedVoteParityChecked:false,noVoteFromMissingSourceInferred:false
  });
 }
 if(ledger.length!==1592||seen.size!==1592||gapIndex.size!==141||
  [...gapIndex.keys()].some(k=>!seen.has(k))||
  officialLinked!==1451||linkedPdfs!==1452||
  alternateClerk!==111||orphanPdf!==1||held!==29||
  linkedNamed!==104||linkedCount!==49||linkedChoices!==989||
  altExplicitNamed!==27||altExplicitChoices!==343||
  first2023Count!==2||first2023Result!==31||
  later2023Candidate!==111||highCandidates!==129||highCounts!==1||
  highResult!==96||highVoice!==5||otherResultCues!==10||
  orphanMotionProposals!==2)
  throw Error('Known official source actions, 207 OCR cohort or 29 held-source counts drift');
 const byYear=([2022,2023,2024,2025] as const).map(year=>{
  const list=ledger.filter(r=>r.year===year);
  return {year,indexedMeetings:list.length,
   governmentLinkedMinutes:list.filter(r=>r.writtenMinuteClass==='official_index_linked_pdf').length,
   alternateOfficialClerkMinutes:list.filter(r=>r.writtenMinuteClass==='authenticated_clerk_html').length,
   archiveMinutesWithoutIndexLink:list.filter(r=>r.writtenMinuteClass==='authenticated_other_lrl_pdf').length,
   missingOriginalWrittenMinutes:list.filter(r=>r.writtenMinuteClass==='unverified_written_minutes').length,
   parserNamedRollsFirstPassPlusVerifiedClerk:list.reduce((n,r)=>n+(r.namedRollCandidates??0),0),
   parserOriginalNamedChoiceOccurrencesFirstPassPlusClerk:list.reduce((n,r)=>n+(r.namedChoiceOccurrences??0),0),
   sourceCandidatesNotExhaustive:true};
 });
 return {
  schemaVersion:'senate-864-all-known-2022-25-independent-original-motion-sources-v1' as const,
  originalLrlMeetingIndexSha256:SOURCE_SHA,years:[2022,2023,2024,2025] as const,
  officialIndexedMeetings:1592,officialLinkedOriginalPdfBodies:1452,
  originalClerkHtmlMinutes:111,otherOriginalArchivedMinutes:1,
  authenticatedWrittenMinutesMeetingDates:1563,
  indexedMeetingDatesStillWithoutWrittenMinutes:29,
  sourceExplicitNamedRollCandidatesInFrozenLinkedPdfs:104,
  sourceExplicitNamedRollCandidatesInCurrentLinkedPdfParserV3:112,
  v3LinkedOriginalNamedRollGainOverFrozen:8,
  sourceNamedRollsInNewClerkWrittenMinutes:27,
  combinedCurrentNamedRollSourceCandidates:139,
  namedSideChoiceOccurrencesInFrozenOriginalLinkedPdfs:989,
  namedSideChoiceOccurrencesInNewOriginalClerkMinutes:343,
  totalProvenOriginalNamedChoiceOccurrencesBeforeV3AddedRollChoices:1332,
  separateNamedV3AddedRollChoiceOccurrencesNotYetCrosswalked:true,
  originalLinkedPdfCountOnlySourceCandidates:49,
  clerk2023InitialAggregateRollCandidates:2,
  clerk2023LaterCountOnlyIncludedIn111Candidates:3,
  clerk2024_25CountOnlyCandidates:1,
  originalAlternativeClerkSourceActionCandidates2023Initial:33,
  originalAlternativeClerkSourceActionCandidates2023New:111,
  originalAlternativeClerkSourceActionCandidates2024_25HighGap:129,
  sumNonExhaustiveDistinctCohortSourceActionCandidates:273,
  otherOriginalClerkOutcomeTextCuesNotCertifiedMotions:10,
  additionalOrphanOfficialPdfMotionProposalsWithNoResult:2,
  allOriginalSenateCommitteeActionsKnown:false,
  exactMissingPersistedVoteEventsOrMemberVotesKnown:false,
  privateDbMemberVoteReconciliationPerformed:false,
  safeToRerunLegacyPositionalBackfill:false,
  originalClerkFirstPublishedAtProven:false,
  dayLevelHearingDateAvailabilityConventionOnly:true,
  noNamedChoicesFromAttendanceVoiceOrCountOnly:true,
  sourceLedgerAndDataNotVoteRowWrite:true,
  byYear,perIndexedMeeting:ledger.sort((a,b)=>a.year-b.year||
   a.hearingDate.localeCompare(b.hearingDate)||a.committeeName.localeCompare(b.committeeName))
 };
}

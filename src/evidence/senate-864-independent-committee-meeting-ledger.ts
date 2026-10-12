/**
 * #864 independent 2021-25 MN Senate committee source-to-action ledger.
 * Offline and PUBLIC-SOURCE ONLY. The historical 2022-25 official meeting
 * index supplies the denominator; original SHA-proven PDF metadata supplies
 * candidate action records. Neither input is a complete official motion
 * census or an authorized current private database export.
 */
import type {OriginalSenateCommitteeYearAudit} from './senate-committee-source-to-db-reconciliation.js';

export const SENATE_864_MEETING_LEDGER_VERSION =
 'senate-864-independent-2021-25-committee-meeting-action-ledger-v1' as const;

type Meeting={
 year:number;committeeName:string;committeeUrl:string;meetingDate:string;
 indexHeadingVerified:boolean;minutesPdfUrls:string[];
 electronicMinutesStatus:string;
};
type Pdf=Omit<OriginalSenateCommitteeYearAudit['documentProofs'][number],
 'voteObservations'|'contextOnlyActions'|'document'> & {
 document:OriginalSenateCommitteeYearAudit['documentProofs'][number]['document']&{
  fetchedAt?:string;extractionMethod?:string;extractedTextSha256?:string;
 };
 voteObservations:Array<OriginalSenateCommitteeYearAudit['documentProofs'][number]['voteObservations'][number]&{
  billIdentifier?:string|null;amendmentRef?:string|null;voteKind?:string;
  motionTextSha256?:string;outcomePassed?:boolean|null;
 }>;
 contextOnlyActions:Array<OriginalSenateCommitteeYearAudit['documentProofs'][number]['contextOnlyActions'][number]&{
  billIdentifier?:string|null;amendmentRef?:string|null;voteKind?:string;
  motionTextSha256?:string;outcomePassed?:boolean|null;
 }>;
 missingness?:{possibleUnparsedRollCallSignal?:boolean;
  possibleUnparsedVoiceVoteSignal?:boolean;noSupportedVoteOrActionDetected?:boolean};
};
type OutputAction={
 sourcePdfSha256:string;parserCandidateOrdinal:number;
 actionType:'named_roll_call'|'count_only_roll_call'|'voice_vote'|'unanimous_action'|'result_only';
 billReference:string|null;amendmentReference:string|null;
 yeaCount:number|null;nayCount:number|null;
 explicitlyNamedChoiceOccurrences:number;
 individualChoiceIdentityProof:'one_way_source_fingerprints'|'not_available';
 outcomePassed:boolean|null;motionTextSha256:string|null;
 motionText:null;page:null;historicalMemberId:null;persistedEventId:null;
 parserCandidateNotStableMotionIdentity:true;
};
type MeetingRow={
 year:number;committee:string;committeePageUrl:string;hearingDate:string;
 status:'linked_originals_sha_authenticated'|'indexed_without_linked_minutes'|'linked_original_unprocessed';
 originalMinutes:Array<{
  sourceUrl:string;originalPdfSha256:string|null;retrievedAt:string|null;
  extractedTextSha256:string|null;
  publicationAtIndependentlyProven:null;
  ocrRecoveredFromInitiallyLowText:boolean;
  contextActionEnumeration:'first_pass_parser_candidates'|'ocr_original_context_incomplete';
  sourceActions:OutputAction[];
 }>;
 namedRollCandidates:number|null;countOnlyRollCandidates:number|null;
 namedChoiceOccurrences:number|null;
 contextualActionsEnumerated:number|null;
 originalMinutesProcessingComplete:boolean;
 hasOriginalPdf:boolean;
 noSupportedActionsProven:false;
 storedDocumentParityThisRun:null;
 storedMotionMatchThisRun:null;
 actualRecordedMotionDenominator:null;
};
type CommitteeYear={
 year:number;committee:string;committeePageUrl:string;
 indexedMeetings:number;minutesLinkedMeetings:number;
 meetingsWithoutLinkedMinutes:number;originalPdfLinks:number;
 shaAuthenticatedOriginalPdfs:number;ocrRecoveredOriginalPdfs:number;
 linkedPdfsUnprocessed:number;
 firstPassNamedRollCandidates:number;firstPassCountOnlyRollCandidates:number;
 firstPassNamedChoiceOccurrences:number;
 firstPassVoiceActions:number;firstPassUnanimousActions:number;
 firstPassResultOnlyActions:number;
 originalsWithUnenumeratedOcrContext:number;
 meetingsWithNoParserRecognizedAction:number;
 independentlyVerified2024EducationSixAmendmentRolls:boolean;
 independentlyVerifiedExtraEducationMotionsOverFirstPass:number;
 v3NamedCandidatesNotLocatedInFirstPassProofs:number|null;
 sourceToPersistedMotionMatches:null;
 sourceToPersistedMemberMatches:null;
 officialAllMeetingDenominator:null;
 officialAllRecordedMotionDenominator:null;
};
const OFFICIAL_YEAR_COUNTS={
 2022:{meetings:337,withPdf:325,noPdf:12,pdfs:325,ocr:121,v3Named:28,unplacedV3:0},
 2023:{meetings:517,withPdf:453,noPdf:64,pdfs:454,ocr:22,v3Named:22,unplacedV3:0},
 2024:{meetings:300,withPdf:258,noPdf:42,pdfs:258,ocr:13,v3Named:30,unplacedV3:1},
 2025:{meetings:438,withPdf:415,noPdf:23,pdfs:415,ocr:51,v3Named:32,unplacedV3:3},
} as const;
const EDUCATION={
 url:'https://www.lrl.mn.gov/archive/minutes/senate/2024/educ/20240214/educ_20240214_Minutes.pdf',
 pdf:'6d00d812236d4585ea315da9fdf2da8325fcad512e4089e1422fa4a96e2a7f52',
 day:'2024-02-14',committee:'Education Policy',
} as const;
const isSha=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const validDay=(value:string,year:number)=>{
 if(!new RegExp('^'+year+'-\\d\\d-\\d\\d$').test(value))return false;
 const d=new Date(value+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
};
function officialPdf(url:string,year:number){
 try{
  const u=new URL(url),p=u.pathname;
  return u.protocol==='https:'&&['lrl.mn.gov','www.lrl.mn.gov'].includes(u.hostname)
   &&u.search===''&&u.hash===''
   &&new RegExp('^/archive/minutes/senate/'+year+'/[^/]+/[0-9]{8}/[^/]+_minutes\\.pdf$','i').test(p);
 }catch{return false}
}
const numbers=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0&&Number(x)<=1000;
function voteActions(proof:Pdf):OutputAction[]{
 const result:OutputAction[]=[];
 const seenKeys=new Set<string>();
 for(const [i,v] of proof.voteObservations.entries()){
  if(!numbers(v.yeaCount)||!numbers(v.nayCount)
   ||!numbers(v.namedMemberChoicesInPdf)||!Array.isArray(v.choiceIdentitySha256)
   ||typeof v.individualVotesAvailable!=='boolean'
   ||typeof v.externalKey!=='string'||!v.externalKey
   ||seenKeys.has(v.externalKey))throw Error('Duplicate or malformed original source roll candidate');
  seenKeys.add(v.externalKey);
  if(v.individualVotesAvailable){
   if(v.namedMemberChoicesInPdf!==v.yeaCount+v.nayCount
    ||v.choiceIdentitySha256.length!==v.namedMemberChoicesInPdf
    ||!v.choiceIdentitySha256.every(isSha))
    throw Error('Original named choices cannot be inferred from a tally');
  }else if(v.namedMemberChoicesInPdf!==0||v.choiceIdentitySha256.length!==0)
    throw Error('Aggregate roll may not contain inferred named choices');
  result.push({
   sourcePdfSha256:proof.document.originalRawPdfSha256,
   parserCandidateOrdinal:i,actionType:v.individualVotesAvailable?'named_roll_call':'count_only_roll_call',
   billReference:v.billIdentifier??null,amendmentReference:v.amendmentRef??null,
   yeaCount:v.yeaCount,nayCount:v.nayCount,
   explicitlyNamedChoiceOccurrences:v.namedMemberChoicesInPdf,
   individualChoiceIdentityProof:v.individualVotesAvailable?'one_way_source_fingerprints':'not_available',
   outcomePassed:typeof v.outcomePassed==='boolean'?v.outcomePassed:null,
   motionTextSha256:isSha(v.motionTextSha256)?v.motionTextSha256!:null,
   motionText:null,page:null,historicalMemberId:null,persistedEventId:null,
   parserCandidateNotStableMotionIdentity:true,
  });
 }
 const ctxNames={voice_vote:'voice_vote',unanimous_action:'unanimous_action',
  motion_result_only:'result_only'} as const;
 for(const [i,a] of proof.contextOnlyActions.entries()){
  const k=a.actionKind as keyof typeof ctxNames;
  if(!Object.hasOwn(ctxNames,k)||a.individualVotesAvailable!==false)
   throw Error('Context action must never manufacture an individual vote');
  result.push({
   sourcePdfSha256:proof.document.originalRawPdfSha256,
   parserCandidateOrdinal:i,
   actionType:ctxNames[k],billReference:a.billIdentifier??null,
   amendmentReference:a.amendmentRef??null,yeaCount:null,nayCount:null,
   explicitlyNamedChoiceOccurrences:0,individualChoiceIdentityProof:'not_available',
   outcomePassed:typeof a.outcomePassed==='boolean'?a.outcomePassed:null,
   motionTextSha256:isSha(a.motionTextSha256)?a.motionTextSha256!:null,
   motionText:null,page:null,historicalMemberId:null,persistedEventId:null,
   parserCandidateNotStableMotionIdentity:true,
  });
 }
 return result;
}
export function buildIndependentSenateCommitteeLedger(
 census:{indexedMeetings:readonly Meeting[];anomalies?:unknown[]},
 originalYears:readonly OriginalSenateCommitteeYearAudit[],
 initiallyLowTextUrls:ReadonlySet<string>,
 strictOfficial=true,
){
 if(originalYears.length!==4||new Set(originalYears.map(y=>y.auditedYear)).size!==4
   ||originalYears.some(y=>![2022,2023,2024,2025].includes(y.auditedYear)
   ||y.documentProofs.length!==y.originalPdfsFetchedAndParsed
   ||y.unresolvedOriginalDocuments.length!==y.originalPdfsFailedOrUnparsed))
  throw Error('Four complete distinct original source years required');
 const docs=new Map<string,Pdf>();
 for(const y of originalYears)for(const source of y.documentProofs as Pdf[]){
  const d=source.document;
  if(d.year!==y.auditedYear||!validDay(d.meetingDate,d.year)
   ||!officialPdf(d.sourceUrl,d.year)||!isSha(d.originalRawPdfSha256)
   ||docs.has(d.sourceUrl)||!Array.isArray(source.voteObservations)
   ||!Array.isArray(source.contextOnlyActions))
   throw Error('Original PDF URL/SHA/date/committee identity invalid or duplicate');
  docs.set(d.sourceUrl,source);
 }
 if(!Array.isArray(census.indexedMeetings)||census.indexedMeetings.length>2000
   ||!Array.isArray(census.anomalies)||census.anomalies.length!==0)
  throw Error('Missing or anomalous official independent committee meeting census');
 const referenced=new Set<string>(),meetingKeys=new Set<string>();
 const rows:MeetingRow[]=[];
 for(const m of census.indexedMeetings){
  if(![2022,2023,2024,2025].includes(m.year)
   ||!validDay(m.meetingDate,m.year)||!m.committeeName.trim()
   ||!m.indexHeadingVerified||!Array.isArray(m.minutesPdfUrls)
   ||m.minutesPdfUrls.length>5
   ||!/^https:\/\/(?:www\.)?lrl\.mn\.gov\/minutes\/comm(?:\.aspx)?\?/i.test(m.committeeUrl))
   throw Error('Unproven dated committee index meeting');
  const key=[m.year,m.committeeUrl,m.committeeName,m.meetingDate].join('|');
  if(meetingKeys.has(key))throw Error('Duplicate original committee/date meeting');
  meetingKeys.add(key);
  const originals:MeetingRow['originalMinutes']=[];
  let unprocessed=false,named=0,count=0,namedTokens=0,context=0,hasOcrContextHold=false;
  if((m.minutesPdfUrls.length===0)!==
    (m.electronicMinutesStatus==='meeting_without_linked_minutes'))
   throw Error('A no-Minutes meeting cannot become proof of zero recorded motions');
  for(const url of m.minutesPdfUrls){
   if(!officialPdf(url,m.year)||referenced.has(url))
    throw Error('Duplicate, nonofficial or wrong-year original PDF in meeting census');
   referenced.add(url);
   const proof=docs.get(url);
   if(!proof){unprocessed=true;originals.push({
    sourceUrl:url,originalPdfSha256:null,retrievedAt:null,extractedTextSha256:null,
    publicationAtIndependentlyProven:null,ocrRecoveredFromInitiallyLowText:false,
    contextActionEnumeration:'ocr_original_context_incomplete',sourceActions:[],
   });continue}
   const d=proof.document;
   if(d.meetingDate!==m.meetingDate||d.committeeName!==m.committeeName)
    throw Error('Official index-to-PDF committee or hearing-day mismatch');
   const actions=voteActions(proof);
   const isOcr=initiallyLowTextUrls.has(url);
   if(isOcr)hasOcrContextHold=true;
   named+=actions.filter(x=>x.actionType==='named_roll_call').length;
   count+=actions.filter(x=>x.actionType==='count_only_roll_call').length;
   namedTokens+=actions.reduce((n,x)=>n+x.explicitlyNamedChoiceOccurrences,0);
   context+=actions.filter(x=>['voice_vote','unanimous_action','result_only'].includes(x.actionType)).length;
   originals.push({
    sourceUrl:url,originalPdfSha256:d.originalRawPdfSha256,
    retrievedAt:d.fetchedAt??null,extractedTextSha256:d.extractedTextSha256??null,
    publicationAtIndependentlyProven:null,
    ocrRecoveredFromInitiallyLowText:isOcr,
    contextActionEnumeration:isOcr?'ocr_original_context_incomplete':'first_pass_parser_candidates',
    sourceActions:actions,
   });
  }
  rows.push({
   year:m.year,committee:m.committeeName,committeePageUrl:m.committeeUrl,
   hearingDate:m.meetingDate,
   status:!m.minutesPdfUrls.length?'indexed_without_linked_minutes':
    unprocessed?'linked_original_unprocessed':'linked_originals_sha_authenticated',
   originalMinutes:originals,
   namedRollCandidates:!m.minutesPdfUrls.length||unprocessed?null:named,
   countOnlyRollCandidates:!m.minutesPdfUrls.length||unprocessed?null:count,
   namedChoiceOccurrences:!m.minutesPdfUrls.length||unprocessed?null:namedTokens,
   contextualActionsEnumerated:!m.minutesPdfUrls.length||unprocessed||hasOcrContextHold?null:context,
   originalMinutesProcessingComplete:m.minutesPdfUrls.length>0&&!unprocessed,
   hasOriginalPdf:m.minutesPdfUrls.length>0,
   noSupportedActionsProven:false,
   storedDocumentParityThisRun:null,storedMotionMatchThisRun:null,
   actualRecordedMotionDenominator:null,
  });
 }
 if([...docs.keys()].some(url=>!referenced.has(url)))
  throw Error('SHA-pinned original document missing from official independent meeting index');
 const yearDetails=[] as Array<Record<string,unknown>>;
 const committeeYears:CommitteeYear[]=[];
 for(const year of [2022,2023,2024,2025] as const){
  const ys=rows.filter(r=>r.year===year);
  const expected=OFFICIAL_YEAR_COUNTS[year];
  const byCommittee=new Map<string,MeetingRow[]>();
  for(const row of ys){
   const key=row.committee+'|'+row.committeePageUrl;
   byCommittee.set(key,[...(byCommittee.get(key)??[]),row]);
  }
  for(const grp of byCommittee.values()){
   const first=grp[0]!;
   const pdf=grp.flatMap(x=>x.originalMinutes);
   const actions=pdf.flatMap(x=>x.sourceActions);
   const authentic=pdf.filter(x=>x.originalPdfSha256!==null);
   const educ=year===2024&&first.committee===EDUCATION.committee
    &&authentic.some(x=>x.sourceUrl===EDUCATION.url&&x.originalPdfSha256===EDUCATION.pdf);
   const educFirstPass=educ?authentic.find(x=>x.sourceUrl===EDUCATION.url)!
    .sourceActions.filter(x=>x.actionType==='named_roll_call').length:0;
   if(educ&&educFirstPass!==2)
    throw Error('Frozen 2024 Education two-candidate source proof drifted');
   const c:CommitteeYear={
    year,committee:first.committee,committeePageUrl:first.committeePageUrl,
    indexedMeetings:grp.length,minutesLinkedMeetings:grp.filter(x=>x.hasOriginalPdf).length,
    meetingsWithoutLinkedMinutes:grp.filter(x=>!x.hasOriginalPdf).length,
    originalPdfLinks:pdf.length,shaAuthenticatedOriginalPdfs:authentic.length,
    ocrRecoveredOriginalPdfs:authentic.filter(x=>x.ocrRecoveredFromInitiallyLowText).length,
    linkedPdfsUnprocessed:pdf.length-authentic.length,
    firstPassNamedRollCandidates:actions.filter(x=>x.actionType==='named_roll_call').length,
    firstPassCountOnlyRollCandidates:actions.filter(x=>x.actionType==='count_only_roll_call').length,
    firstPassNamedChoiceOccurrences:actions.reduce((n,x)=>n+x.explicitlyNamedChoiceOccurrences,0),
    firstPassVoiceActions:actions.filter(x=>x.actionType==='voice_vote').length,
    firstPassUnanimousActions:actions.filter(x=>x.actionType==='unanimous_action').length,
    firstPassResultOnlyActions:actions.filter(x=>x.actionType==='result_only').length,
    originalsWithUnenumeratedOcrContext:authentic.filter(x=>x.contextActionEnumeration==='ocr_original_context_incomplete').length,
    meetingsWithNoParserRecognizedAction:grp.filter(x=>x.hasOriginalPdf&&x.originalMinutes.every(d=>d.sourceActions.length===0)).length,
    independentlyVerified2024EducationSixAmendmentRolls:educ,
    independentlyVerifiedExtraEducationMotionsOverFirstPass:educ?4:0,
    v3NamedCandidatesNotLocatedInFirstPassProofs:null,
    sourceToPersistedMotionMatches:null,sourceToPersistedMemberMatches:null,
    officialAllMeetingDenominator:null,officialAllRecordedMotionDenominator:null,
   };
   committeeYears.push(c);
  }
  const source=originalYears.find(x=>x.auditedYear===year)!;
  const withPdf=ys.filter(r=>r.hasOriginalPdf).length,without=ys.length-withPdf;
  const nPdf=ys.reduce((n,r)=>n+r.originalMinutes.length,0);
  const nOcr=ys.reduce((n,r)=>n+r.originalMinutes.filter(x=>x.ocrRecoveredFromInitiallyLowText).length,0);
  const named=committeeYears.filter(c=>c.year===year)
   .reduce((n,c)=>n+c.firstPassNamedRollCandidates,0);
  const countOnly=committeeYears.filter(c=>c.year===year)
   .reduce((n,c)=>n+c.firstPassCountOnlyRollCandidates,0);
  const six=committeeYears.filter(c=>c.year===year)
   .reduce((n,c)=>n+c.independentlyVerifiedExtraEducationMotionsOverFirstPass,0);
  if(strictOfficial&&(ys.length!==expected.meetings||withPdf!==expected.withPdf
    ||without!==expected.noPdf||nPdf!==expected.pdfs||nOcr!==expected.ocr
    ||source.originalPdfsFetchedAndParsed!==expected.pdfs))
   throw Error('Pinned independent statewide electronic year/meeting denominator drift');
  if(strictOfficial&&(named+six+expected.unplacedV3!==expected.v3Named))
   throw Error('Verified V3 named motion candidate reconciliation drift');
  yearDetails.push({
   year,indexedMeetings:ys.length,linkedMinutesMeetings:withPdf,
   noLinkedMinutesMeetings:without,originalPdfLinks:nPdf,authenticatedOriginalPdfShas:
    ys.reduce((n,r)=>n+r.originalMinutes.filter(p=>p.originalPdfSha256!==null).length,0),
   originallyLowTextOcrRecovered:nOcr,
   firstPassNamedRollCandidates:named,firstPassCountOnlyRollCandidates:countOnly,
   separatelyVerifiedEducationExtraMotionCount:six,
   v3UnlocalizedAdditionalNamedCandidates:expected.unplacedV3,
   verifiedV3NamedSourceCandidates:expected.v3Named,
   contextualActionsInOcrNotFullyEnumerated:true,
   completeOfficialMeetingDenominator:null,completeOfficialMotionDenominator:null,
  });
 }
 committeeYears.sort((a,b)=>a.year-b.year||a.committee.localeCompare(b.committee)
  ||a.committeePageUrl.localeCompare(b.committeePageUrl));
 rows.sort((a,b)=>a.year-b.year||a.hearingDate.localeCompare(b.hearingDate)
  ||a.committee.localeCompare(b.committee));
 const ret={
  schemaVersion:SENATE_864_MEETING_LEDGER_VERSION,issue:864,
  scope:'2021-2025 Minnesota Senate COMMITTEE meetings',
  source:'official 2022-25 electronic LRL committee index and full original SHA-pinned PDF proofs',
  knownGlobalProtectedStoredSourceShaMatchesAtEarlierSnapshot:1452,
  currentStoredSnapshotIndependentlyComparedInThisRun:false,
  independentlyProvenPdfPublicationDates:0,
  year2021:{officialPrintMeetingCount:null,originalPrintMinutesRecovered:null,
   committeeYearRecordedVoteDenominator:null,status:'print_collection_unenumerated'},
  year2022PrintVsElectronicParity:'unverified',
  historicalAsOfConvention:'hearing_day; exclude same-day prediction cutoffs',
  originalPublicationDateIndependentlyVerified:false,
  summariesByYear:yearDetails,committeeYears,meetings:rows,
  sourceRecordReconciliation:{
   parserVersionOfFullPerPdfCandidateObservations:'mn-senate-committee-minutes-v2_frozen',
   currentParserVersion:'mn-senate-committee-minutes-v3',
   reportedV3NewNamedCandidatesBeyondFrozen:8,
   firstPassMotionTextReadable:false,pageNumbersCaptured:false,
   historicalPersonChoiceIdentityPublishedInThisLedger:false,
   sourceToCurrentStoredActionsMatched:false,
   provisionalPositionalEventKeysUnsafeForReplay:true,
   one2024NamedYeaMissingFromPriorStoredSnapshot:true,
   independentHistoricalServiceDayIdentityOfMissing2024Yea:false,
   noMemberChoicesInferredFromCountsOrAttendance:true,
   noPDFLinkedMeetingAssumedNoVote:false,
   officialAllMotionDenominator:null,
  },
  noProductionDbAccess:true,noDbWrites:true,noTrainingServingDeployOrSchedulerChanges:true,
  parentIssueRemainsOpen:true,
 };
 if(strictOfficial){
  const total=(k:keyof CommitteeYear)=>committeeYears.reduce((n,c)=>n+Number(c[k]??0),0);
  if(rows.length!==1592||docs.size!==1452||initiallyLowTextUrls.size!==207
   ||total('indexedMeetings')!==1592||total('originalPdfLinks')!==1452
   ||total('meetingsWithoutLinkedMinutes')!==141
   ||total('shaAuthenticatedOriginalPdfs')!==1452
   ||total('ocrRecoveredOriginalPdfs')!==207
   ||total('independentlyVerifiedExtraEducationMotionsOverFirstPass')!==4
   ||yearDetails.length!==4)
   throw Error('Final source ledger is not the exact authenticated 1592/1452/207 universe');
 }
 return ret;
}

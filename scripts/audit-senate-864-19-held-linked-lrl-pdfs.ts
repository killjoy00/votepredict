/**
 * #864 source-only SHA and printed identity investigation of the 30 LRL
 * candidate PDFs attached to 19 of the remaining 25 indexed date gaps.
 * Determine whether a prior meeting's Minutes were linked under the newer
 * meeting's archive date, or an actual same-day written minute was missed.
 * Never promote a document merely because its URL contains the target date.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {select19OfficialUnverifiedLrlPdfMeetingSources,
 inspectHeldOfficialMinuteOriginalText} from
 '../src/evidence/senate-864-held-original-pdf-print-identity.js';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
async function download(url:string){
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(35000),
  headers:{Accept:'application/pdf'}});
 if(r.status!==200)return {bytes:null,hold:'http_'+r.status};
 if(!r.body)return {bytes:null,hold:'pdf_empty_transport'};
 if(Number(r.headers.get('content-length')??0)>10000000)
  return {bytes:null,hold:'pdf_body_declared_too_large'};
 const chunks:Uint8Array[]=[];let size=0;
 const reader=r.body.getReader();
 try{
  for(;;){
   const x=await reader.read();if(x.done)break;
   size+=x.value.byteLength;
   if(size>10000000)throw Error('PDF exceeds original raw byte cap');
   chunks.push(x.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;
 for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 if(bytes.length<300||new TextDecoder('latin1').decode(bytes.subarray(0,5))!=='%PDF-')
  return {bytes:null,hold:'http_200_not_original_pdf'};
 return {bytes,hold:null};
}
type DiagnosticRow={
 year:number;committeeName:string;hearingDate:string;originalSourceUrl:string;
 status:string;originalRawPdfSha256:string|null;
 firstPrintedDateFromOriginalHeader?:string|null;
 printedCommitteeHeaderFound?:boolean;printedMinutesDocumentType?:boolean;
 exactOriginalPrintedMeetingDay?:boolean;
 [key:string]:unknown;
};
async function one(x:{
 year:number;committeeName:string;hearingDate:string;originalSourceUrl:string;
}):Promise<DiagnosticRow>{
 const base={year:x.year,committeeName:x.committeeName,hearingDate:x.hearingDate,
  originalSourceUrl:x.originalSourceUrl,fromGovernmentOriginalIndex:true};
 let rawSha:string|null=null;
 let originalPdfBytes:number|null=null;
 let phase:'transport'|'text_extraction'|'printed_date_identity'|'motion_parser'='transport';
 try{
  const d=await download(x.originalSourceUrl);
  if(!d.bytes)return {...base,status:'download_hold',holdReason:d.hold,
   originalRawPdfSha256:null,originalPrintedMeetingDay:null};
  // Preserve actual government PDF byte integrity even when original scans,
  // encrypted PDFs or damaged text parsers prevent a printed-date claim.
  // A PDF binary retrieved from an indexed link is NOT yet same-day Minutes.
  rawSha=sha(d.bytes);originalPdfBytes=d.bytes.byteLength;
  phase='text_extraction';
  const pdf=await fetchSenateCommitteeMinutePdf({url:x.originalSourceUrl,
   fetchImpl:(async()=>
    new Response(d.bytes,{status:200,headers:{'content-type':'application/pdf'}})) as typeof fetch});
  if(pdf.contentSha256!==rawSha)throw Error('Original raw PDF digest drift');
  phase='printed_date_identity';
  const classification=inspectHeldOfficialMinuteOriginalText({
   text:pdf.text,committeeName:x.committeeName,hearingDate:x.hearingDate,
   originalSourceUrl:x.originalSourceUrl
  });
  // Source interpretation holds even if a filename and later page mentions
  // the target hearing day; first printed Minutes header date is authoritative.
  phase='motion_parser';
  const rolls=parseSenateCommitteeMinuteVotes(pdf.text);
  const named=rolls.filter(r=>r.individualVotesAvailable);
  const context=parseSenateCommitteeMinuteContextActions(pdf.text);
  const {status:printIdentityStatus,...identityFields}=classification;
  return {...base,status:'source_original_pdf_retrieved',
   originalRawPdfSha256:rawSha,originalPdfBytes,
   originalExtractedTextSha256:sha(pdf.text),
   originalTextExtractionMethod:pdf.extractionMethod,
   originalPrintedMeetingDay:classification.firstPrintedDateFromOriginalHeader,
   ...identityFields,printIdentityStatus,
   originalExplicitNamedRollParserCandidates:named.length,
   originalPrintedNamedChoiceOccurrences:named.reduce((s,r)=>s+r.memberVotes.length,0),
   originalCountOnlyParserCandidates:rolls.length-named.length,
   originalContextParserCandidates:context.length,
   sourceActionCandidatesNotCertifiedFullMotionDenominator:true,
   originalSourceIsNotStoredVoteProof:true};
 }catch{
  const holdReason=phase==='text_extraction'?'original_pdf_text_parse_or_ocr_hold':
   phase==='printed_date_identity'?'original_printed_day_committee_check_hold':
   phase==='motion_parser'?'original_motion_parser_hold':
   'original_transport_or_bytes_hold';
  return {...base,
   status:rawSha===null?'original_pdf_transport_or_bytes_hold':
    'source_pdf_bytes_sha_verified_but_meeting_identity_held',
   holdReason,originalRawPdfSha256:rawSha,originalPdfBytes,
   rawOriginalPdfByteIdentityVerified:rawSha!==null,
   originalPrintedMeetingDay:null,
   originalMeetingDateAndRecordedMotionsNotAuthenticated:true};
 }
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==6||args[0]!=='--year'||args[2]!=='--prior-index-audit'||args[4]!=='--output')
  throw Error('Exact --year --prior-index-audit --output required');
 const year=Number(args[1]) as 2023|2024|2025;
 if(![2023,2024,2025].includes(year))throw Error('2023-25 original held PDF year required');
 const src=readFileSync(resolve(args[3]!));
 if(src.length<10000||src.length>100000)throw Error('Original prior index audit outside pinned byte cap');
 const j=JSON.parse(src.toString('utf8'));
 if(j.schemaVersion!=='senate-864-original-29-gap-alternate-path-lrl-pdf-source-v1'||
  j.originalIndexedMeetingDatesExamined!==undefined||
  j.originalAcquisitionRunId!==undefined||
  j.exactGovernmentPreviouslyUnwrittenMinuteDates!==29||
  j.newlyAuthenticatedOriginalWrittenMinuteDays!==4||
  j.remainingIndexedMinutesDocumentGaps!==25||
  !Array.isArray(j.meetingDocuments))
  throw Error('Original independent source proof 29-to-25 checkpoint failed');
 const selected=select19OfficialUnverifiedLrlPdfMeetingSources(j.meetingDocuments,year);
 if(selected.length<1||selected.length>25)throw Error('Original PDF candidate year shard outside bounds');
 const rows:Awaited<ReturnType<typeof one>>[]=[];
 let cursor=0;
 await Promise.all(Array.from({length:2},async()=>{
  for(;;){const t=selected[cursor++];if(!t)break;rows.push(await one(t));}
 }));
 rows.sort((a,b)=>a.originalSourceUrl.localeCompare(b.originalSourceUrl));
 const matches=rows.filter(r=>r.status==='source_original_pdf_retrieved'&&
  r.exactOriginalPrintedMeetingDay===true&&r.printedCommitteeHeaderFound===true&&
  r.printedMinutesDocumentType===true);
 const holds=rows.filter(r=>r.status!=='source_original_pdf_retrieved');
 const shaRetrieved=rows.filter(r=>r.originalRawPdfSha256!==null).length;
 const textOrPrintedHolds=holds.filter(r=>
  r.status==='source_pdf_bytes_sha_verified_but_meeting_identity_held').length;
 const different=rows.filter(r=>r.status==='source_original_pdf_retrieved'&&
  r.firstPrintedDateFromOriginalHeader!==r.hearingDate);
 const audit={
  schemaVersion:'senate-864-19-held-LRL-30-pdf-original-printed-day-diagnostic-v1',
  issue:864,year,
  originalGovernmentIndexRun:38680515336,originalGovernmentIndexArtifact:11948425264,
  originalGovernmentIndexArtifactZipSha256:'1e4fa7a20643e3b10d750cf991935a62af70956e03d63de18a4ba545362ca893',
  originalIndexedUnverifiedMinuteDates:19,originalPdfCandidateUrlsAcrossYears:30,
  auditedCandidatePdfs:rows.length,
  originalPdfBodiesShaRetrieved:shaRetrieved,
  originalPdfBodiesTextAndPrintedHeadingInspected:rows.length-holds.length,
  originalPdfBodiesShaRetrievedButTextOrIdentityHeld:textOrPrintedHolds,
  transportDecodeOrTextHolds:holds.length,
  firstPrintedMinutesDayAndCommitteeVerified:matches.length,
  originalPdfPrintedOtherDayOrNoDay: different.length,
  noSourceUnavailabilityInferredFromHttpOrParserFailure:true,
  noNamedVotesInferredFromAgendaAttachments:true,
  originalDateNotOriginalPdfPublicationDay:true,
  noOriginalMotionOrStoredEventDatabaseParity:true,
  noDatabaseOrModelWrites:true,
  originalSources:rows
 };
 const output=resolve(args[5]!);mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(audit,null,2)+'\n');
 console.log('SENATE864_HELD_ORIGINAL_LRL_30_PDF_DIAGNOSTIC='+JSON.stringify({
  year,originalUrls:rows.length,byteRetrieved:audit.originalPdfBodiesShaRetrieved,
  textOrPrintedHolds,inspectedPrintedDay:audit.originalPdfBodiesTextAndPrintedHeadingInspected,
  exactOriginalPrintedDayAndCommittee:matches.length,
  alternatePrintedDayOrNoDay:different.length,transportOrDecodeHolds:holds.length,
  perDocument:rows.map(r=>({date:r.hearingDate,
   status:r.status==='source_original_pdf_retrieved'?
    ('firstPrintedDateFromOriginalHeader' in r?
     (r.firstPrintedDateFromOriginalHeader===r.hearingDate?'candidate_day_match':'different_printed_day_or_no_day'):'unclassified'):
    r.status,
   url:r.originalSourceUrl,sha:r.originalRawPdfSha256,holdReason:r.holdReason}))
 }));
}
void main().catch(()=>{
 console.error('SENATE864_HELD_LRL_PDF_CANDIDATES_HOLD=source_proof_or_transport');
 process.exitCode=1;
});

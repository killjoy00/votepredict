/**
 * #864 public-original-source independent parser recall sample:
 * 4-year x (4 OCR + 4 embedded) = 32 SHA-verified original 2022-25 Senate
 * committee-minute PDFs with ZERO first-pass parser action candidates.
 * Every original PDF SHA is independently pinned in the immutable 1592 ledger.
 *
 * A source MOTION/ROLL cue not extracted is review evidence, never permission
 * to create a persisted vote or infer member choices from attendance.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {selectSenate864FirstPassZeroActionOriginals,classifySourceMinuteMotionSignals}
 from '../src/evidence/senate-864-568-zero-action-original-triage.js';
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const SOURCE_LRL='https://www.lrl.mn.gov/archive/minutes/senate/';
async function verifiedOriginalPdf(url:string,originalSha:string){
 const u=new URL(url);
 if(!url.startsWith(SOURCE_LRL)||u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
  u.search||u.hash||!/^\/archive\/minutes\/senate\/202[2-5]\//.test(u.pathname))
  throw Error('Not an official indexed Senate 2022-25 original PDF path');
 return fetchSenateCommitteeMinutePdf({url,
  fetchImpl:(async(_url,init)=>{
   const response=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(45_000)});
   if(response.status!==200)throw Error('Source original PDF HTTP HOLD');
   if(Number(response.headers.get('content-length')??0)>10_000_000)
    throw Error('Source PDF declared size outside bounds');
   if(!response.body)throw Error('No original PDF stream');
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];
   let size=0;
   try{for(;;){const r=await reader.read();if(r.done)break;
    size+=r.value.byteLength;if(size>10_000_000)throw Error('Original bytes exceeded cap');
    chunks.push(r.value);
   }}finally{reader.releaseLock()}
   const bytes=new Uint8Array(size);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   if(bytes.length<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-'||
    sha(bytes)!==originalSha)
    throw Error('Original source raw PDF SHA/format changed from pinned government proof');
   return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
  }) as typeof fetch});
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==6||args[0]!=='--year'||args[2]!=='--index-ledger'||args[4]!=='--output')
  throw Error('Fixed --year --index-ledger --output required');
 const year=Number(args[1]) as 2022|2023|2024|2025;
 if(![2022,2023,2024,2025].includes(year)||!args[3]||!args[5])
  throw Error('Only 2022-25 original year and source paths');
 const path=resolve(args[3]),output=resolve(args[5]);
 if(path===output)throw Error('Input archive ledger cannot be overwritten');
 const bytes=readFileSync(path);
 if(bytes.length<1000||bytes.length>11_000_000)
  throw Error('Original fixed source action ledger byte bounds');
 const ledger=JSON.parse(bytes.toString('utf8'));
 const cohort=selectSenate864FirstPassZeroActionOriginals(ledger,year,4);
 if(cohort.selectedOriginals.length!==8)throw Error('Eight original stratified source proofs per year required');
 const rows=[];
 for(const target of cohort.selectedOriginals){
  try{
   const pdf=await verifiedOriginalPdf(target.sourceUrl,target.sourcePdfSha256);
   if(pdf.contentSha256!==target.sourcePdfSha256)
    throw Error('Previously original-authenticated government PDF SHA differs');
   const parsed=parseSenateCommitteeMinuteVotes(pdf.text);
   const context=parseSenateCommitteeMinuteContextActions(pdf.text);
   const cues=classifySourceMinuteMotionSignals(pdf.text);
   rows.push({
    year:target.year,committeeName:target.committee,hearingDate:target.hearingDate,
    originalSourceUrl:target.sourceUrl,originalPdfSha256:pdf.contentSha256,
    originalNormalizedExtractedTextSha256:sha(pdf.text.replace(/\s+/g,' ')),
    originalPdfByteCount:pdf.bytes,extractionMethod:pdf.extractionMethod,
    originallyRequiredOcr:target.originallyRequiredOcr,
    currentParserNamedRollCandidates:parsed.filter(x=>x.individualVotesAvailable).length,
    currentParserCountOnlyRollCandidates:parsed.filter(x=>!x.individualVotesAvailable).length,
    currentParserContextActionCandidates:context.length,
    currentParserNamedChoiceOccurrences:parsed.filter(x=>x.individualVotesAvailable)
      .reduce((n,x)=>n+x.memberVotes.length,0),
    ...cues,
    priority:cues.originalContainsPotentialUncapturedMotion?
      'possible_new_action_needs_original_motion_review':
      context.length||parsed.length?'parser_now_recognizes_action_needs_review':
      'zero_detected_still_not_a_certified_no_vote',
    status:'original_pdf_sha_reverified_parser_rechecked',
    noDatabaseOrHistoricalPersonRead:true,
  });
  }catch{
   rows.push({year:target.year,committeeName:target.committee,hearingDate:target.hearingDate,
    originalSourceUrl:target.sourceUrl,originalPdfSha256:target.sourcePdfSha256,
    originallyRequiredOcr:target.originallyRequiredOcr,
    status:'original_pdf_transport_ocr_or_integrity_HOLD',
    noSourceActionsOrNoVotesInferred:true});
  }
 }
 const verified=rows.filter(r=>r.status==='original_pdf_sha_reverified_parser_rechecked');
 const flagged=verified.filter(r=>r.priority!=='zero_detected_still_not_a_certified_no_vote');
 const report={
  schemaVersion:'senate-864-568-original-zero-parser-action-stratified-source-recall-v1',
  issue:864,year,originalWrittenMinuteMeetingZeroActionCohort:568,
  originalZeroActionOcrRecoveryCohort:197,originalZeroActionEmbeddedTextCohort:371,
  selectedOriginals:8,originalShaReverified:verified.length,
  originalsHeld:8-verified.length,
  possibleSourceActionsMissedOrNewlyRecognized:flagged.length,
  originalExplicitRollMotionResultsRequiringReview:verified.filter(r=>
   r.explicitRecordedMotionResultCues>0).length,
  originalNamedRollLabelsRequiringReview:verified.filter(r=>
   r.explicitNamedRollLabelCues>0).length,
  everyZeroIsNotAutomaticallyANamedVote:true,
  sourceToStoredEventAndMemberParityPerformed:false,
  noProductionDatabaseReadWrite:true,
  no2021Sources:true,
  sampleNotAll568Sources:true,
  rows
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('SENATE864_ZERO_ACTION_ORIGINAL_AUDIT='+JSON.stringify({
  year,selected:8,verified:verified.length,held:8-verified.length,
  flaggedSourceReview:flagged.length,originalExplicitResults:
   report.originalExplicitRollMotionResultsRequiringReview,
  flaggedDates:flagged.map(r=>({day:r.hearingDate,committee:r.committeeName,
   parsedRolls:r.currentParserNamedRollCandidates+r.currentParserCountOnlyRollCandidates,
   contextualMotions:r.currentParserContextActionCandidates,
   explicitMotionResultCues:r.explicitRecordedMotionResultCues}))
 }));
}
void main().catch(error=>{
 const allowed=[
 'Fixed --year --index-ledger --output required',
 'Only 2022-25 original year and source paths',
 'Input archive ledger cannot be overwritten',
 'Original fixed source action ledger byte bounds',
 'Eight original stratified source proofs per year required'];
 const message=error instanceof Error?error.message:'';
 console.error('SENATE864_ZERO_ACTION_ORIGINAL_AUDIT_HOLD='+(
  allowed.includes(message)?message.replace(/\s/g,'_'):'original_source_preflight'));
 process.exitCode=1;
});

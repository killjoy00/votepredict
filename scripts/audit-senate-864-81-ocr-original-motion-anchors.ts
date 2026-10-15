/**
 * #864 independent third-wave audit of ALL 81 flagged original 2022-25 OCR
 * Senate minute PDFs. Source-side only; never infer member YEA/NAY, stored
 * rows, or distinct parliamentary events from printed textual cues.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {identifyOriginalSourceMotionCues} from '../src/evidence/senate-864-original-motion-cue-review.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions}
 from '../src/evidence/minnesota-senate-committee-minutes.js';

const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const SOURCE_ROOT='https://www.lrl.mn.gov/archive/minutes/senate/';
const RECEIPT='docs/evaluation/source-proof/senate-864-remaining149-ocr-original-recall-v1.json';
const SCHEMA='senate-864-568-original-remaining149-ocr-source-recall-v1';
type Row={
 year:number;committeeName:string;hearingDate:string;originalSourceUrl:string;
 originalPdfSha256:string;originalNormalizedExtractedTextSha256:string;
 originallyRequiredOcr:boolean;
 currentParserNamedRollCandidates:number;currentParserCountOnlyRollCandidates:number;
 currentParserContextActionCandidates:number;explicitRecordedMotionResultCues:number;
 explicitNamedRollLabelCues:number;reportedRollOrVoiceVoteCues:number;
 priority:string;status:string;
};
export function selectOriginalFlagged81(input:unknown){
 const manifest=JSON.parse(readFileSync(RECEIPT,'utf8')) as {
  sourceAuditRunId:number;originalShaProofZipArtifacts:Array<{
   year:number;shard:number;artifactId:number;zipSha256:string;
   originalPdfs:number;flaggedSourcePdfs:number;
  }>;
 };
 const data=input as Array<{year:number;remainingOcrShardIndex:number;remainingOcrTotalShards:number;schemaVersion:string;
  sourceRecallPhase:string;selectedOriginals:number;originalShaReverified:number;
  originalsHeld:number;sourceToStoredEventAndMemberParityPerformed:boolean;
  rows:Row[]}>;
 if(!Array.isArray(data)||data.length!==16||manifest.sourceAuditRunId!==38755921210||
  manifest.originalShaProofZipArtifacts.length!==16)
  throw Error('Exactly sixteen independently authenticated OCR artifacts required');
 const all:Row[]=[];const artifactKeys=new Set<string>();
 for(const a of data){
  const key=a.year+'/'+a.remainingOcrShardIndex,receipt=manifest.originalShaProofZipArtifacts.find(
   x=>x.year===a.year&&x.shard===a.remainingOcrShardIndex);
  const cause=!receipt?'missing_receipt':
   artifactKeys.has(key)?'duplicate_year_shard':
   a.schemaVersion!==SCHEMA?'schema_version':
   a.sourceRecallPhase!=='remaining149ocr'?'recall_phase':
   a.remainingOcrTotalShards!==({2022:10,2023:1,2024:1,2025:4} as Record<number,number>)[a.year]?'shard_partition':
   !Array.isArray(a.rows)?'missing_source_rows':
   a.rows.length!==receipt.originalPdfs?'row_count':
   a.selectedOriginals!==receipt.originalPdfs?'selected_count':
   a.originalShaReverified!==receipt.originalPdfs?'verified_count':
   a.originalsHeld!==0?'held_originals':
   a.sourceToStoredEventAndMemberParityPerformed!==false?'parity_flag':
   a.rows.filter(r=>r.priority!=='zero_detected_still_not_a_certified_no_vote').length!==
    receipt.flaggedSourcePdfs?'flagged_count':null;
  if(cause)throw Error('original_shard:'+key+':'+cause);
  artifactKeys.add(key);
  all.push(...a.rows);
 }
 if(all.length!==149||new Set(all.map(x=>x.originalSourceUrl)).size!==149)
  throw Error('149 original document denominator, URL uniqueness or source registry drift');
 const flagged=all.filter(x=>x.priority!=='zero_detected_still_not_a_certified_no_vote')
  .sort((a,b)=>a.year-b.year||a.hearingDate.localeCompare(b.hearingDate)||
   a.committeeName.localeCompare(b.committeeName)||a.originalSourceUrl.localeCompare(b.originalSourceUrl));
 if(flagged.length!==81||[2022,2023,2024,2025]
  .map(y=>flagged.filter(x=>x.year===y).length).join(',')!=='54,4,1,22'||
  flagged.some(x=>x.status!=='original_pdf_sha_reverified_parser_rechecked'||
   !x.originallyRequiredOcr||
   !x.originalSourceUrl.startsWith(SOURCE_ROOT+x.year+'/')||
   !/^[a-f0-9]{64}$/.test(x.originalPdfSha256)||
   !/^[a-f0-9]{64}$/.test(x.originalNormalizedExtractedTextSha256)))
  throw Error('81 unique independently verified original flagged date/SHA identity drift');
 return flagged;
}
export async function exactOriginal(r:Row){
 const url=new URL(r.originalSourceUrl);
 if(url.protocol!=='https:'||url.hostname!=='www.lrl.mn.gov'||url.search||url.hash||
  !url.pathname.startsWith('/archive/minutes/senate/'+r.year+'/')||
  !/\.pdf$/i.test(url.pathname))
  throw Error('Original official source URL scope HOLD');
 const fetched=await fetch(r.originalSourceUrl,{
  redirect:'manual',headers:{accept:'application/pdf'},signal:AbortSignal.timeout(45000)});
 if(fetched.status!==200||!fetched.body||Number(fetched.headers.get('content-length')??0)>10000000)
  throw Error('Official PDF unavailable HOLD');
 const parts:Uint8Array[]=[];let n=0;
 const reader=fetched.body.getReader();
 try{for(;;){
  const v=await reader.read();if(v.done)break;
  n+=v.value.length;if(n>10000000)throw Error('Official original size HOLD');
  parts.push(v.value);
 }}finally{reader.releaseLock()}
 const bytes=new Uint8Array(n);let at=0;
 for(const part of parts){bytes.set(part,at);at+=part.length}
 if(n<300||new TextDecoder('latin1').decode(bytes.subarray(0,5))!=='%PDF-'||
  sha(bytes)!==r.originalPdfSha256)
  throw Error('Original LRL raw PDF byte SHA HOLD');
 const pdf=await fetchSenateCommitteeMinutePdf({url:r.originalSourceUrl,
  fetchImpl:(async()=>new Response(bytes,{status:200,
   headers:{'content-type':'application/pdf'}})) as typeof fetch});
 if(pdf.contentSha256!==r.originalPdfSha256||
  sha(pdf.text.replace(/\s+/g,' '))!==r.originalNormalizedExtractedTextSha256)
  throw Error('Original government text OCR or parser drift HOLD');
 return pdf;
}
export function readReports(folder:string){
 const names=readdirSync(folder).filter(x=>/^remaining-ocr-202[2-5]-\d+\.json$/.test(x));
 if(names.length!==16)throw Error('Need 16 unmodified source artifact JSON files');
 return names.map(n=>{
  const raw=readFileSync(join(folder,n),'utf8');
  if(raw.length<700||raw.length>40000)throw Error('Bounded original artifact size');
  return JSON.parse(raw);
 });
}
function anchoredSignals(text:string){
 const parsed=identifyOriginalSourceMotionCues(text,250);
 const formal=parsed.cues.filter(x=>x.cueType==='formal_result');
 return {formal,counts:parsed.byCueKind,overflow:parsed.sourceContainsMoreCuesThanBoundedPreview};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length===2&&args[0]==='--cohort-preflight'){
  const source=selectOriginalFlagged81(readReports(resolve(args[1]!)));
  console.log('SENATE864_81_ORIGINAL_COHORT_PREFLIGHT='+JSON.stringify({
   priorVerifiedOriginals:149,flaggedOriginals:source.length,
   byYear:[2022,2023,2024,2025].map(y=>source.filter(x=>x.year===y).length)
  }));
  return;
 }
 if(args.length!==6||args[0]!=='--shard'||args[2]!=='--artifact-dir'||args[4]!=='--output'||
  !/^[0-7]$/.test(args[1]??''))
  throw Error('Fixed --shard 0..7 --artifact-dir --output required');
 const shard=Number(args[1]),all=selectOriginalFlagged81(readReports(resolve(args[3]!)));
 const selected=all.filter((_,i)=>i%8===shard);
 if(selected.length<10||selected.length>11)throw Error('Fixed distinct document shard size');
 const results:Array<Record<string,unknown>>=[];
 for(const r of selected){
  try{
   const pdf=await exactOriginal(r);
   const original=anchoredSignals(pdf.text);
   const rolls=parseSenateCommitteeMinuteVotes(pdf.text);
   const contexts=parseSenateCommitteeMinuteContextActions(pdf.text);
   // Each textual "MOTION FAILED/PREVAILED" is only an anchor cue, not an
   // independently certified parliamentary decision or individual vote.
   const anchors=original.formal.map(x=>({
    normalizedOriginalSourceOffset:x.offsetInWhitespaceNormalizedSource,
    originalPassageSha256:x.originalExcerptSha256,
    nearbyPrintedBillReferences:x.nearbyPrintedBillReferences,
    nearbyPrintedAmendmentReferences:x.nearbyPrintedAmendmentReferences,
    cueType:x.cueType,
    distinctMotionCertified:false,
   }));
   results.push({
    year:r.year,hearingDate:r.hearingDate,committeeName:r.committeeName,
    originalGovernmentPdfSha256:r.originalPdfSha256,
    originalOfficialUrl:r.originalSourceUrl,
    status:'original_pdf_and_text_sha_verified',
    originalFormalResultCues:r.explicitRecordedMotionResultCues,
    independentlyAnchoredFormalCues:anchors.length,
    originalRollCallCues:original.counts.roll_call,
    originalNamedSideLabelCues:original.counts.named_yes_no_label,
    previousContextCandidates:r.currentParserContextActionCandidates,
    currentlyParsedContextCandidates:contexts.length,
    currentlyParsedNamedRolls:rolls.filter(x=>x.individualVotesAvailable).length,
    currentlyParsedCountOnlyRolls:rolls.filter(x=>!x.individualVotesAvailable).length,
    parserNameListsNotExported:true,anchors,
    boundedPreviewTruncated:original.overflow,
    motionLevelHumanReviewStillNeeded:true,
   });
  }catch{
   results.push({year:r.year,hearingDate:r.hearingDate,committeeName:r.committeeName,
    originalGovernmentPdfSha256:r.originalPdfSha256,
    status:'source_raw_pdf_sha_ocr_or_anchor_hold',originalVotesInferred:0});
  }
 }
 const verified=results.filter(x=>x.status==='original_pdf_and_text_sha_verified');
 const report={
  schemaVersion:'senate-864-81-flagged-original-motion-anchor-review-v1',issue:864,
  yearScope:[2022,2023,2024,2025],shard,sourceCohort:81,
  documentsInShard:selected.length,sourcePdfAndTextReverified:verified.length,
  heldOriginals:selected.length-verified.length,
  formalTextAnchorSlots:verified.reduce((n,r)=>n+Number(r.independentlyAnchoredFormalCues),0),
  originalNamedSourceRolls:verified.reduce((n,r)=>n+Number(r.currentlyParsedNamedRolls),0),
  noSourceAnchorClaimedAsDistinctVote:true,
  sourceToActualStoredMotionOrMemberVoteCompared:false,
  noProductionDatabaseReadWrite:true,no2021:true,
  documents:results
 };
 const out=resolve(args[5]!);mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('SENATE864_81_FLAGGED_ORIGINAL_MOTION_ANCHORS='+JSON.stringify({
  shard,selected:selected.length,verified:verified.length,held:report.heldOriginals,
  formalCueSlots:report.formalTextAnchorSlots,
  namedRolls:report.originalNamedSourceRolls,
 }));
 if(report.heldOriginals>0)process.exitCode=1;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-81-ocr-original-motion-anchors.ts'))
 void main().catch(error=>{
  const allowed=[
   'Exactly sixteen independently authenticated OCR artifacts required',
   'Original independent ZIP, PDF hash or source-recall cohort drift',
   '149 original document denominator, URL uniqueness or source registry drift',
   '81 unique independently verified original flagged date/SHA identity drift',
   'Need 16 unmodified source artifact JSON files',
   'Bounded original artifact size',
   'Fixed distinct document shard size',
   'Fixed --shard 0..7 --artifact-dir --output required'];
  const msg=error instanceof Error?error.message:'';
  const safeGeneric=msg.length<180&&!/https?:|postgres|token|password|secret|\/home\/|\/github\//i.test(msg)?
   msg.replace(/[^a-zA-Z0-9_:.\- ]/g,'_').replace(/\s+/g,'_'):'source_integrity_or_shard_validation';
  console.error('SENATE864_81_ORIGINAL_MOTION_HOLD='+(
   allowed.includes(msg)?msg.replace(/\s+/g,'_'):
   /^original_shard:202[2-5]\/\d{1,2}:[a-z_]{4,30}$/.test(msg)?
    msg:safeGeneric));
  process.exitCode=1;
 });

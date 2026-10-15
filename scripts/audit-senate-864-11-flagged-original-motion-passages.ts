/**
 * #864 follow 11 flagged of 32 previously independently SHA-authenticated
 * linked Senate original PDFs (2022-25, no 2021).
 * Re-check EXACT raw government original PDF SHA and extract motion/roll/voice
 * cue contexts with source-person names redacted for targeted parser review.
 * No source-to-stored member rows, production DB or ingestion changes.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {identifyOriginalSourceMotionCues} from
 '../src/evidence/senate-864-original-motion-cue-review.js';
const sha=(x:Uint8Array|string)=>createHash('sha256').update(x).digest('hex');
const ORIGINAL_AUDIT={2022:{flagged:2,zip:'a7e6fe5b4b232e0bacd78de9fd9bb16f1e02f523add82c8d5447849752ee9fb3'},
 2023:{flagged:3,zip:'5448527da4f19faa688f8fa7cd2fb49590842aaba420812a84ccd0e02b73a6c4'},
 2024:{flagged:5,zip:'ede99f0d0385184f2ec833dc92e28379329a673a0abb785db6c9d12fa082638d'},
 2025:{flagged:1,zip:'57f6c9b021c4ada542ad65acbaf09392f0075d01cba316e0d1729913fbcf3a0a'}} as const;
type OriginalTarget={
 year:number;committeeName:string;hearingDate:string;originalSourceUrl:string;
 originalPdfSha256:string;priority:string;status:string;
};
function exactTargets(year:2022|2023|2024|2025,path:string){
 const raw=readFileSync(path);
 if(raw.length<2500||raw.length>30000)throw Error('Original eight-source audit outside SHA-pinned bounds');
 const j=JSON.parse(raw.toString('utf8'));
 if(j.schemaVersion!=='senate-864-568-original-zero-parser-action-stratified-source-recall-v1'||
  j.issue!==864||j.year!==year||j.selectedOriginals!==8||
  j.originalShaReverified!==8||j.originalsHeld!==0||
  j.possibleSourceActionsMissedOrNewlyRecognized!==ORIGINAL_AUDIT[year].flagged||
  !Array.isArray(j.rows)||j.rows.length!==8||
  j.sourceToStoredEventAndMemberParityPerformed!==false)
  throw Error('Original 32 PDF SHA-verified recall cohort mismatch');
 const flagged=j.rows.filter((r:OriginalTarget)=>r.priority!==
  'zero_detected_still_not_a_certified_no_vote');
 if(flagged.length!==ORIGINAL_AUDIT[year].flagged)
  throw Error('Original flagged eleven PDF prior source receipt drift');
 const seen=new Set<string>();
 for(const r of flagged as OriginalTarget[]){
  if(r.year!==year||r.status!=='original_pdf_sha_reverified_parser_rechecked'||
   !/^202[2-5]-\d\d-\d\d$/.test(r.hearingDate)||!r.hearingDate.startsWith(String(year))||
   !r.originalSourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'+year+'/')||
   !/^[a-f0-9]{64}$/.test(r.originalPdfSha256)||
   seen.has(r.originalSourceUrl))
   throw Error('Unverifiable original source PDF SHA, year/date or duplicate');
  seen.add(r.originalSourceUrl);
 }
 return flagged as OriginalTarget[];
}
async function originalRaw(x:OriginalTarget){
 const url=x.originalSourceUrl;
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(40000),
  headers:{accept:'application/pdf'}});
 if(r.status!==200||!r.body||Number(r.headers.get('content-length')??0)>10000000)
  throw Error('Original PDF independent government transport HOLD');
 const chunks:Uint8Array[]=[];let size=0;
 const reader=r.body.getReader();
 try{for(;;){
  const item=await reader.read();if(item.done)break;
  size+=item.value.byteLength;
  if(size>10000000)throw Error('Original PDF byte cap exceeded');
  chunks.push(item.value);
 }}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;
 for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 if(bytes.length<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-'||
  sha(bytes)!==x.originalPdfSha256)
  throw Error('Independently original 2022-25 PDF raw byte SHA mismatch');
 return fetchSenateCommitteeMinutePdf({url,fetchImpl:(async()=>
  new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}})) as typeof fetch});
}
async function one(x:OriginalTarget){
 try{
  const pdf=await originalRaw(x);
  if(pdf.contentSha256!==x.originalPdfSha256)throw Error('Source original hash mismatch');
  const signals=identifyOriginalSourceMotionCues(pdf.text);
  const rolls=parseSenateCommitteeMinuteVotes(pdf.text);
  const ctx=parseSenateCommitteeMinuteContextActions(pdf.text);
  return {
   year:x.year,committeeName:x.committeeName,hearingDate:x.hearingDate,
   officialSourceUrl:x.originalSourceUrl,originalPdfSha256:x.originalPdfSha256,
   originalTextSha256:sha(pdf.text),textExtractionMethod:pdf.extractionMethod,
   originalPdfShaReverifiedThisRun:true,status:'original_source_reauthenticated' as const,
   originalNamedRollParserCandidates:rolls.filter(v=>v.individualVotesAvailable).length,
   originalCountOnlyParserCandidates:rolls.filter(v=>!v.individualVotesAvailable).length,
   currentParserContextActions:ctx.length,
   originalMotionCueReview:signals,
   noExactUniqueMotionsOrMemberVotesCertified:true
  };
 }catch{
  return {year:x.year,committeeName:x.committeeName,hearingDate:x.hearingDate,
   officialSourceUrl:x.originalSourceUrl,originalPdfSha256:x.originalPdfSha256,
   originalPdfShaReverifiedThisRun:false,status:'source_transport_or_byte_integrity_hold' as const,
   noOriginalMotionOrVoteInferred:true};
 }
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--year'||a[2]!=='--previous-source-audit'||a[4]!=='--output')
  throw Error('Only --year --previous-source-audit --output');
 const year=Number(a[1]) as 2022|2023|2024|2025;
 if(![2022,2023,2024,2025].includes(year))throw Error('Historical 2022-25 only');
 const targets=exactTargets(year,resolve(a[3]!));
 const rows=await Promise.all(targets.map(one));
 const verified=rows.filter(r=>r.status==='original_source_reauthenticated');
 const unresolved=rows.filter(r=>r.status!=='original_source_reauthenticated');
 const result={
  schemaVersion:'senate-864-followup-11-SHA-original-motion-and-roll-cue-review-v1',
  year,issue:864,originalSourceRun:38680095705,
  originalSourceArtifactSha256:ORIGINAL_AUDIT[year].zip,
  sourceCandidates:targets.length,originalPdfBodiesVerified:verified.length,
  originalPdfHolds:unresolved.length,
  originalSourceTextMotionCuesNotCertifiedDistinctVotes:true,
  originalSourceTextNamedMemberIdentityNotExported:true,
  no2021Evidence:true,noProductionDbReadWrite:true,noHistoricalPositionalReplay:true,
  originalDocuments:rows
 };
 const output=resolve(a[5]!);mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('SENATE864_FOLLOWUP_11_ORIGINAL_MOTION_REVIEW='+JSON.stringify({
  year,originals:targets.length,verified:verified.length,held:unresolved.length,
  reviewed:verified.map(r=>({
   date:r.hearingDate,committee:r.committeeName,
   namedParser:r.originalNamedRollParserCandidates,
   countParser:r.originalCountOnlyParserCandidates,
   contextParser:r.currentParserContextActions,
   originalFormalResultCueCount:r.originalMotionCueReview.byCueKind.formal_result,
   originalNamedListCueCount:r.originalMotionCueReview.byCueKind.named_yes_no_label,
   originalVoiceCueCount:r.originalMotionCueReview.byCueKind.voice_vote,
   originalRollCueCount:r.originalMotionCueReview.byCueKind.roll_call
  }))
 }));
}
void main().catch(()=>{
 console.error('SENATE864_FOLLOWUP_11_ORIGINAL_SOURCE_HOLD=source_provenance_or_parser_failure');
 process.exitCode=1;
});

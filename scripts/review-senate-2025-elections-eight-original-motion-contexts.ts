/** #864 bounded original 2025 Elections three PDFs, eight motion-context snapshots. */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  EIGHT_2025_ELECTIONS_CONTEXT_VERSION,EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS,
  FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB,inspectEight2025ElectionMotionSource,
  type Eight2025Date,type SourceCandidateEight,
} from '../src/evidence/senate-2025-elections-eight-motion-context.js';

const sha=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const blob=(b:Uint8Array)=>createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const SOURCE_LEDGER=new URL('../docs/evaluation/source-proof/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json',import.meta.url);
const cap=3_000_000;
const dates=Object.keys(EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS) as Eight2025Date[];
type PriorSource={
 year:number;committeeName:string;indexedHearingDate:string;
 officialOriginalPDFUrl:string;shaPinnedOriginalPdfBytes:number;
 shaPinnedOriginalPDF:string;shaPinnedExtractedText:string;
 provisionalNamedRollSourceBlocks:SourceCandidateEight[];
};
const redact=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[source PDF]').slice(0,180);
async function boundedPdf(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const u=input instanceof Request?input.url:String(input);
 if(!/^https:\/\/www\.lrl\.mn\.gov\/archive\/minutes\/senate\/2025\/elections\/2025(?:0211|0325|0408)\/Elections_2025(?:0211|0325|0408)_Minutes\.pdf$/.test(u))
  throw Error('Source original outside exact three dated 2025 Elections PDFs');
 const r=await fetch(u,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==u)throw Error('Original official PDF unavailable or redirected');
 if(!/^application\/pdf/i.test(r.headers.get('content-type')??''))
  throw Error('Expected official original PDF content type');
 if(Number(r.headers.get('content-length')??0)>cap)throw Error('PDF exceeds byte cap');
 const chunks:Uint8Array[]=[];let size=0;
 const reader=r.body?.getReader();if(!reader)throw Error('Original PDF body absent');
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   size+=part.value.byteLength;
   if(size>cap){await reader.cancel();throw Error('PDF stream over source cap')}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const b=new Uint8Array(size);let offset=0;
 for(const c of chunks){b.set(c,offset);offset+=c.byteLength}
 if(size<300||new TextDecoder('latin1').decode(b.slice(0,5))!=='%PDF-')
  throw Error('Non-PDF original source body');
 return new Response(b,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output')throw Error('Pass exact --output PATH');
 const out=resolve(a[1]!);
 const b=readFileSync(SOURCE_LEDGER);
 if(blob(b)!==FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB)
  throw Error('Immutable 2025 Elections original 13-roll source ledger Git blob changed');
 const ledger=JSON.parse(b.toString('utf8')) as {
  issue:number;actualSuccessfulOriginalSourceRunId:number;sourceOriginalRosterReviewRunId:number;
  sourceRecords:PriorSource[];originalPdfSourcesReverified:number;exactNamedRollOffsetsReverified:number;
 };
 if(ledger.issue!==864||ledger.actualSuccessfulOriginalSourceRunId!==38098600457
  ||ledger.sourceRecords.length!==4||ledger.originalPdfSourcesReverified!==4
  ||ledger.exactNamedRollOffsetsReverified!==13)
  throw Error('Original thirteen-roll source proof shape drifted');
 const rows:Array<Record<string,unknown>>=[];
 const errors:Array<{date:string;reason:string}>=[];
 for(const date of dates){
  const spec=ledger.sourceRecords.find(x=>x.indexedHearingDate===date);
  if(!spec||spec.year!==2025||spec.committeeName!=='Elections'
   ||spec.provisionalNamedRollSourceBlocks.length!==EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS[date].length
   ||!spec.provisionalNamedRollSourceBlocks.every(x=>
      EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS[date].includes(x.sourceTextOffset as never)))
   throw Error('Expected exact three source years/dates/offsets missing');
  try{
   const pdf=await fetchSenateCommitteeMinutePdf({
    url:spec.officialOriginalPDFUrl,fetchImpl:boundedPdf as typeof fetch});
   if(pdf.extractionMethod!=='embedded_text'
    ||pdf.bytes!==spec.shaPinnedOriginalPdfBytes
    ||pdf.contentSha256!==spec.shaPinnedOriginalPDF
    ||sha(pdf.text)!==spec.shaPinnedExtractedText)
    throw Error('Original 2025 Elections published PDF binary or text SHA changed');
   const candidates=spec.provisionalNamedRollSourceBlocks.map(candidate=>
    inspectEight2025ElectionMotionSource({date,text:pdf.text,candidate}));
   rows.push({
    hearingDate:date,committeeName:'Elections',
    originalPdfUrl:spec.officialOriginalPDFUrl,originalPdfSha256:spec.shaPinnedOriginalPDF,
    originalExtractedTextSha256:spec.shaPinnedExtractedText,
    originalSourcePdfBytes:pdf.bytes,
    exactOriginalSourceOffsets:candidates.map(x=>x.originalSourceOffset),
    originalRollMotionContexts:candidates,
    officialSenateHearingIdentityRevalidatedAgainstPdfHash:true,
    noOriginalPdfFullTextOrNamedYeaNayChoiceListsPersisted:true,
   });
  }catch(e){errors.push({date,reason:redact(e)});}
 }
 const total=rows.reduce((n,r)=>n+(r.originalRollMotionContexts as unknown[]).length,0);
 const report={
  schemaVersion:EIGHT_2025_ELECTIONS_CONTEXT_VERSION,issue:864,year:2025,
  sourcePreviousFullFourPdfSuccessRunId:38098600457,
  sourcePriorFourOriginalsProofGitBlobSha:FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB,
  expectedOriginalPdfs:3,pdfsShaReverified:rows.length,
  expectedNamedRollContextOffsets:8,sourceRollContextOffsetsReproduced:total,
  originalFetchOrContextMismatchCount:errors.length,
  records:rows,failures:errors,
  candidateMotionCuesOnlyNotCertifiedUniqueEightRecordedVotes:true,
  sourceContextSnippetRequiresSeparateSemanticallyReviewedMotionIdentity:true,
  noAutomaticMemberVoteFromNamedChoices:true,noProductionOrPrivateDbReadWrite:true,
  noModelForecastTrainingServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true,
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceOriginalsReverified:rows.length,candidateMotionContexts:total,failures:errors.length},null,2));
 if(rows.length!==3||total!==8||errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(redact(e));process.exitCode=1});

/** One-time exact ORIGINAL Apr08 2025 Elections PDF A10 source-only inspection. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf}
 from '../../src/evidence/minnesota-senate-committee-source.js';
import {SOURCE,APR08_A10_SOURCE_SCHEMA,inspectOriginalApr08A10Motion}
 from '../../src/evidence/senate-2025-elections-apr08-a10-source.js';

const cap=3_000_000;
async function bounded(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==SOURCE.originalOfficialUrl)throw Error('Not the one exact original Apr08 Senate Elections PDF');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url||!/^application\/pdf/i.test(r.headers.get('content-type')??''))
  throw Error('Original Apr08 official PDF HTTP/type/redirect changed');
 if(Number(r.headers.get('content-length')??0)>cap)throw Error('Original PDF too large');
 const reader=r.body?.getReader();if(!reader)throw Error('Original PDF body absent');
 let size=0;const chunks:Uint8Array[]=[];
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   size+=part.value.byteLength;
   if(size>cap){await reader.cancel();throw Error('Original PDF stream exceeded source cap')}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const b=new Uint8Array(size);let offset=0;
 for(const x of chunks){b.set(x,offset);offset+=x.byteLength}
 if(size<300||new TextDecoder('latin1').decode(b.slice(0,5))!=='%PDF-')
  throw Error('Not an original PDF');
 return new Response(b,{status:200,headers:{'content-type':'application/pdf'}});
}
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[original LRL PDF]').slice(0,170);
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output')throw Error('Exact --output PATH required');
 const output=resolve(args[1]!);
 const failures:string[]=[];
 let motion:ReturnType<typeof inspectOriginalApr08A10Motion>|null=null;
 try{
  const pdf=await fetchSenateCommitteeMinutePdf({url:SOURCE.originalOfficialUrl,fetchImpl:bounded as typeof fetch});
  if(pdf.extractionMethod!=='embedded_text'
    ||pdf.bytes!==SOURCE.originalPdfBytes
    ||pdf.contentSha256!==SOURCE.originalPdfSHA256
    ||createHash('sha256').update(pdf.text).digest('hex')!==SOURCE.originalTextSHA256)
    throw Error('Original Apr08 PDF bytes or extracted text changed versus successful prior SHA proof');
  motion=inspectOriginalApr08A10Motion(pdf.text);
 }catch(e){failures.push(safe(e))}
 const result={
  schemaVersion:APR08_A10_SOURCE_SCHEMA,issue:864,
  originalHearingDate:SOURCE.date,officialOriginalPdfUrl:SOURCE.originalOfficialUrl,
  expectedOriginalPdfSha256:SOURCE.originalPdfSHA256,
  expectedOriginalTextSha256:SOURCE.originalTextSHA256,
  previousFullRosterAuditRunId:SOURCE.priorElectionsOriginalSourceRun,
  previousSourceEightMotionRunId:SOURCE.priorEightMotionContextSourceRun,
  originalPdfAndTextSHAReverified:motion!==null,
  originalSourceA10MotionParsed:motion!==null,
  failedOriginalPdfOrMotionSources:failures.length,
  sourceResult:motion,failures,
  potentialNewCandidateNotYetIncludedInNamedElevenSideReview:true,
  notA2021to2025RecordedVoteDenominator:true,
  noOriginalPdfOrFullTextOrUnhashedNamedYeaNayListStored:true,
  noIndividualMemberVotesImported:true,
  noPrivateProductionDbReadWrite:true,
  noModelForecastTrainingServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true,
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
   sourcePdfHashVerified:motion!==null,a10Found:motion!==null,
   sourcePrintedTally:motion?[motion.originalResultPrintedYeaCount,
     motion.originalResultPrintedNayCount,motion.originalResultPrintedAbsentCount]:null,
   failures:failures.length
 },null,2));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

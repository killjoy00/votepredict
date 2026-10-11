/** One-time exact original April 8 Elections PDF: OTHER 10/0/1 source lead. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf}
 from '../src/evidence/minnesota-senate-committee-source.js';
import {SOURCE} from '../src/evidence/senate-2025-elections-apr08-a10-source.js';
import {SECOND_TEN_ZERO_ONE_VERSION,inspectOriginalApr08OtherTenZeroOne}
 from '../src/evidence/senate-2025-elections-apr08-second-ten-zero-one-source.js';

const MAX_PDF_BYTES=3_000_000;
async function exactOnePdfFetch(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==SOURCE.originalOfficialUrl)throw Error('Not the exact 2025 Elections Apr08 official original PDF URL');
 const response=await fetch(url,{...init,redirect:'manual'});
 if(response.status!==200||response.url!==url||
  !/^application\/pdf/i.test(response.headers.get('content-type')??''))
  throw Error('Original official Apr08 PDF request status/type/redirect changed');
 if(Number(response.headers.get('content-length')??0)>MAX_PDF_BYTES)
  throw Error('Original PDF declared too large');
 const reader=response.body?.getReader();
 if(!reader)throw Error('Original official PDF response body missing');
 const chunks:Uint8Array[]=[];
 let size=0;
 try {
  for (;;) {
   const part=await reader.read();
   if(part.done)break;
   size+=part.value.byteLength;
   if(size>MAX_PDF_BYTES){
    await reader.cancel();
    throw Error('Original source PDF exceeded maximum streamed bytes');
   }
   chunks.push(part.value);
  }
 } finally {reader.releaseLock()}
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Not exact original PDF magic');
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[original LRL source]').slice(0,180);
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Exact --output PATH required');
 const output=resolve(args[1]);
 const failures:string[]=[];
 let sourcePdfTextVerified=false;
 let other:ReturnType<typeof inspectOriginalApr08OtherTenZeroOne>|null=null;
 try {
  const pdf=await fetchSenateCommitteeMinutePdf({
   url:SOURCE.originalOfficialUrl,fetchImpl:exactOnePdfFetch as typeof fetch
  });
  if(pdf.extractionMethod!=='embedded_text'||
   pdf.bytes!==SOURCE.originalPdfBytes||
   pdf.contentSha256!==SOURCE.originalPdfSHA256||
   createHash('sha256').update(pdf.text).digest('hex')!==SOURCE.originalTextSHA256)
   throw Error('Original Apr08 PDF/text bytes changed from authenticated source proof');
  sourcePdfTextVerified=true;
  other=inspectOriginalApr08OtherTenZeroOne(pdf.text);
 } catch(e) {failures.push(safe(e))}
 const result={
  schemaVersion:SECOND_TEN_ZERO_ONE_VERSION,issue:864,
  originalHearingDate:SOURCE.date,originalSourceUrl:SOURCE.originalOfficialUrl,
  expectedPdfSHA256:SOURCE.originalPdfSHA256,
  expectedFullExtractedTextSHA256:SOURCE.originalTextSHA256,
  expectedOriginalPdfBytes:SOURCE.originalPdfBytes,
  priorAuthenticA11OriginalRunId:38149288925,
  priorAuthenticA11OriginalArtifactId:11706340911,
  originalPdfAndTextSHAReverified:sourcePdfTextVerified,
  separateOtherTenZeroOneParagraphInspected:other!==null,
  failedOriginalSourceChecks:failures.length,failures,
  result:other,
  candidateIsNotYetIndependentlyCorroboratedAmendmentOrVote:true,
  noSourceMotionAutomaticallyPromotedTo2021to2025Denominator:true,
  noOriginalPdfFullTextOrRawMemberChoiceListCommitted:true,
  noProductionPrivateDbReadWrite:true,
  noMemberVoteImport:true,noForecastModelTrainingServingSchedulerFloorOr2027Expansion:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
  exactOriginalPdfAndTextReverified:sourcePdfTextVerified,
  remainingResultOffsets:other?.allOriginalTenZeroOnePrevailTextOffsets??null,
  otherProvisionalAmendmentLabel:other?.closestIntroducedAmendmentLabel??null,
  otherOriginalResultIsASeparateMotionSection:other?
   !other.samePreviouslyAuthenticatedA11MotionSection:null,
  errors:failures.length
 }));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
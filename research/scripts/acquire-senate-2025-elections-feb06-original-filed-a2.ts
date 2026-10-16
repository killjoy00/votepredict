/** One-time original official February 6 Elections SF0529 filed A2 PDF bytes. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {FILED_FEB06_A2_SOURCE as SOURCE,checkExactFiledA2OriginalPdf}
 from '../../src/evidence/senate-2025-elections-feb06-filed-a2-original-source.js';

function safe(e:unknown) {
 return String(e instanceof Error?e.message:e)
  .replace(/https?:\/\/\S+/gi,'[official original LRL source]')
  .slice(0,175);
}
async function main() {
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Exact --output metadata-path required');
 const output=resolve(args[1]);
 const destination=dirname(output);
 const errors:string[]=[];
 let binaryProof:ReturnType<typeof checkExactFiledA2OriginalPdf>|null=null;
 const originalPdfFile='sf0529-a2-original-filed-amendment.pdf';
 let retrievedUtc:string|null=null;
 mkdirSync(destination,{recursive:true});
 try {
  const res=await fetch(SOURCE.originalPdfUrl,{redirect:'manual'});
  const declared=res.headers.get('content-length');
  if(declared!==null) {
   const size=Number(declared);
   if(!Number.isSafeInteger(size)||size<0||size>SOURCE.maxPdfBytes)
    throw Error('Original filed A2 document declared byte length invalid');
  }
  const reader=res.body?.getReader();
  if(!reader)throw Error('Original filed A2 PDF body unavailable');
  let total=0;const chunks:Uint8Array[]=[];
  try {
   for(;;) {
    const item=await reader.read();
    if(item.done)break;
    total+=item.value.byteLength;
    if(total>SOURCE.maxPdfBytes) {
     await reader.cancel();
     throw Error('Original A2 PDF streamed bytes exceeded fail-closed cap');
    }
    chunks.push(item.value);
   }
  } finally {reader.releaseLock()}
  const original=new Uint8Array(total);
  let at=0;
  for(const b of chunks) {original.set(b,at);at+=b.length}
  binaryProof=checkExactFiledA2OriginalPdf({
   requestedUrl:SOURCE.originalPdfUrl,finalResponseUrl:res.url,
   status:res.status,contentType:res.headers.get('content-type')??'',
   byteArray:original
  });
  retrievedUtc=new Date().toISOString();
  writeFileSync(resolve(destination,originalPdfFile),original);
 } catch(e) {errors.push(safe(e))}
 const report={
  schemaVersion:SOURCE.schemaVersion,issue:SOURCE.issue,
  sourceAuthority:'Minnesota Legislative Reference Library',
  sourceIndexUrl:SOURCE.documentIndexUrl,
  originalPdfUrl:SOURCE.originalPdfUrl,
  indexPublishedDocumentLabel:SOURCE.originalDocumentLabel,
  originalFeb06HearingDate:SOURCE.hearingDate,
  priorOriginalMinutesPdfSHA256:SOURCE.originalMinutesPdfSHA256,
  priorOriginalMinutesTextSHA256:SOURCE.originalMinutesExtractedTextSHA256,
  distinctPriorOriginalSourceA2OralAndWrittenTextOffsets:[
   SOURCE.originalLuceroA2OralMotionTextOffset,
   SOURCE.originalMathewsA2MotionTextOffset
  ],
  firstObservedDownloadTimestampUtc:retrievedUtc,
  originalFiledAmendmentBinaryAuthenticated:binaryProof!==null,
  originalPdfTemporaryActionArtifactName:binaryProof?originalPdfFile:null,
  binaryProof,originalFetchErrors:errors,
  originalFiledA2AuthorshipNotAssumedFromFileName:true,
  originalA2MotionDistinctnessNotCertifiedByFileName:true,
  originalDocumentIndividuallyCastVotesNotProven:true,
  notStoredEvidenceParity:true,
  noRawOriginalPdfCommittedToGit:true,
  noPrivateOrProductionDatabaseReadOrWrite:true,
  noMemberVoteBackfill:true,
  noForecastModelsTrainingServingSchedulerFloorOr2027:true,
  issue864MustRemainOpen:true
 };
 writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  originalPdfAuthenticated:binaryProof!==null,
  sha256:binaryProof?.originalPdfSha256??null,
  sourceBytes:binaryProof?.originalPdfBytes??null,
  originalFetchFailures:errors.length
 }));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
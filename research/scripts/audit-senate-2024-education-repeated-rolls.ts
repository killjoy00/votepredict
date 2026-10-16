/**
 * #864 2024 Education Policy official Minutes six repeated amendment rolls.
 * Public original source only. No Neon access, writes or identity exports.
 *
 * node --import tsx scripts/audit-senate-2024-education-repeated-rolls.ts \
 *   --source-json artifacts/original/senate-committee-2024-original-pdf-actions.json \
 *   --output artifacts/report/senate-864-2024-education-repeated-rolls-safe.json
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../../src/evidence/minnesota-senate-committee-source.js';
import {
  EDUCATION_2024_REPEATED_ROLL_SOURCE as SOURCE,
  audit2024EducationRepeatedAmendmentRolls,
  selectPinned2024EducationSource,
} from '../../src/evidence/senate-2024-education-repeated-amendment-rolls.js';

const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const MAX_BYTES=500_000,MAX_PAGES=3;
function argumentsFixed(){
  const a=process.argv.slice(2);
  if(a.length!==4||a[0]!=='--source-json'||a[2]!=='--output')
    throw Error('Exact source manifest and safe output required');
  return {source:resolve(a[1]!),out:resolve(a[3]!)};
}
async function readPinnedPdf(url:string){
  if(url!==SOURCE.sourceUrl)throw Error('Source identity mismatch');
  const response=await fetch(url,{
    headers:{accept:'application/pdf'},
    redirect:'manual',
    signal:AbortSignal.timeout(35_000),
  });
  if(response.status!==200||response.url!==SOURCE.sourceUrl)
    throw Error('Original official PDF transport changed');
  const length=response.headers.get('content-length');
  if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))
    throw Error('Original official PDF claimed bytes exceed bound');
  const reader=response.body?.getReader();
  if(!reader)throw Error('Missing original PDF stream');
  const chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){
      const next=await reader.read();
      if(next.done)break;
      size+=next.value.byteLength;
      if(size>MAX_BYTES)throw Error('Original PDF stream exceeded bound');
      chunks.push(next.value);
    }
  }finally{reader.releaseLock()}
  if(size!==SOURCE.originalPdfBytes)throw Error('Original PDF byte size drift');
  const body=new Uint8Array(size);let at=0;
  for(const chunk of chunks){body.set(chunk,at);at+=chunk.byteLength}
  if(new TextDecoder('latin1').decode(body.slice(0,5))!=='%PDF-'
    ||sha(body)!==SOURCE.originalPdfSha256)
    throw Error('Original government PDF byte SHA mismatch');
  const temp=mkdtempSync(join(tmpdir(),'senate-864-edu-source-'));
  try{
    const file=join(temp,'original.pdf');
    writeFileSync(file,body);
    const info=execFileSync('pdfinfo',[file],{
      encoding:'utf8',timeout:20_000,stdio:['ignore','pipe','pipe'],
    });
    const pageCount=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>MAX_PAGES)
      throw Error('Original PDF page bounds failed');
  }finally{rmSync(temp,{recursive:true,force:true})}
  return new Response(body,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
  const args=argumentsFixed();
  let phase:'manifest'|'source_pdf'|'source_text'|'semantic'|'output'='manifest';
  try{
    const source=selectPinned2024EducationSource(readFileSync(args.source,'utf8'));
    phase='source_pdf';
    const pdf=await fetchSenateCommitteeMinutePdf({
      url:source.sourceUrl,
      fetchImpl:((input:string|URL|Request)=>{
        const url=input instanceof Request?input.url:String(input);
        return readPinnedPdf(url);
      }) as typeof fetch,
    });
    phase='source_text';
    if(pdf.extractionMethod!=='embedded_text'
      ||pdf.bytes!==source.originalPdfBytes
      ||pdf.contentSha256!==source.originalPdfSha256
      ||sha(pdf.text)!==source.extractedTextSha256)
      throw Error('Original embedded-text source hash mismatch');
    phase='semantic';
    const safe=audit2024EducationRepeatedAmendmentRolls(
      pdf.text,source.previousCandidates);
    const report={
      ...safe,
      originalArtifactRunId:SOURCE.originalSourceRunId,
      originalArtifactId:SOURCE.originalArtifactId,
      verifiedOriginalPdfSha256:SOURCE.originalPdfSha256,
      verifiedOriginalExtractedTextSha256:SOURCE.originalEmbeddedTextSha256,
      exactOriginalManifestSha256:SOURCE.originalMetadataSha256,
      originalSourceIndependentlyRefetchedAndHashVerified:true,
      no2024MissingYeaIdentityOrRootCauseResolution:true,
      noProtectedEnvironmentOrDatabaseCredentials:true,
    };
    const body=JSON.stringify(report,null,2)+'\n';
    if(body.length>6000||/https?:|sourceName|normalizedName|membershipId|choiceIdentitySha256|sourceUrl|memberVotes/i.test(body))
      throw Error('Unsafe result schema');
    phase='output';
    mkdirSync(dirname(args.out),{recursive:true});
    writeFileSync(args.out,body);
    console.log('SENATE_864_EDUCATION_2024_SAFE_RESULT='+JSON.stringify({
      sourceStatus:'ORIGINAL_SHA_VERIFIED',verifiedDistinctMotions:safe.originalRecordedAmendmentRolls,
      previousParserCandidates:safe.originallyParserRecognizedRollCandidates,
      missingParserCandidateActions:safe.candidateRollUndercountWithinThisOnePdf,
      originalNamedChoiceOccurrences:safe.originalNamedChoiceOccurrencesAcrossActions,
      privateDatabaseAccess:false,
    }));
  }catch{
    console.error('SENATE_864_EDUCATION_2024_SOURCE_HOLD='+phase);
    process.exitCode=1;
  }
}
void main().catch(()=>{
  console.error('SENATE_864_EDUCATION_2024_SOURCE_HOLD=preflight');
  process.exitCode=1;
});

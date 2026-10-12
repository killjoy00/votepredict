/**
 * #864 one-time original PUBLIC 2022 Finance electronic PDF, no audio.
 * Download exactly one allowlisted official LRL source within 8 MiB,
 * hash whole source PDF, parse all seven named roll paragraphs fail-closed,
 * discard raw PDF/text/names and emit ONLY SHA/count/context metadata.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {FINANCE_APR07_2022,inspect2022FinanceApr07OriginalMinutes,sha256} from
 '../src/evidence/senate-2022-finance-apr07-original-seven-roll-verify.js';
const MAX_BYTES=8*1024*1024;
function failCode(e:unknown){
 const str=String(e instanceof Error?e.message:e);
 const codes=['source_unexpected_url','source_http_not_200','source_pdf_mime_mismatch',
  'source_length_not_bounded','source_size_cap','source_pdf_signature',
  'source_missing_body','original source missing exact','original source has different',
  'original printed roll tally','original roll call or tally',
  'original motion mover','original committee roll','original YEA NAY ABSENT',
  'original senator appears','original PDF roll side','original motion disposition',
  'original oral','withdrawn A21','voice motions',
  'original SF4269','original 67 named','original roll tally crosses'];
 return codes.find(c=>str.includes(c))??'source_or_parser_error';
}
export async function fetchStrictOriginalFinancePDF(input:string,init?:RequestInit){
 if(input!==FINANCE_APR07_2022.officialUrl)throw Error('source_unexpected_url');
 const response=await fetch(input,{
  ...init,redirect:'error',credentials:'omit',cache:'no-store',
  headers:{Accept:'application/pdf','user-agent':'VotePredict-864-2022-historical-official-finance-original'},
  signal:AbortSignal.timeout(90_000)
 });
 if(response.status!==200||response.url!==input)throw Error('source_http_not_200');
 if(!/^application\/pdf(?:\s*;|\s*$)/i.test(response.headers.get('content-type')??''))
  throw Error('source_pdf_mime_mismatch');
 const declaredHeader=response.headers.get('content-length');
 const declared=declaredHeader===null?null:Number(declaredHeader);
 if(declared!==null&&(!Number.isSafeInteger(declared)||declared<300||declared>MAX_BYTES))
  throw Error('source_length_not_bounded');
 if(!response.body)throw Error('source_missing_body');
 const chunks:Buffer[]=[];let size=0;
 for await(const data of response.body){
  const part=Buffer.from(data);size+=part.length;
  if(size>MAX_BYTES)throw Error('source_size_cap');
  chunks.push(part);
 }
 const raw=Buffer.concat(chunks);
 if(raw.length<300||raw.subarray(0,5).toString('ascii')!=='%PDF-')
  throw Error('source_pdf_signature');
 if(declared!==null&&declared!==raw.length)
  throw Error('source_length_not_bounded');
 return new Response(raw,{
  status:200,headers:{'content-type':'application/pdf','content-length':String(raw.length)}
 });
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1]||args[1].startsWith('-'))
  throw Error('Expected only --output PATH (metadata JSON, no original media)');
 const out=resolve(args[1]);
 let original:null|Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>=null;
 let analysis:null|ReturnType<typeof inspect2022FinanceApr07OriginalMinutes>=null;
 let failure:null|string=null;
 try{
  original=await fetchSenateCommitteeMinutePdf({
   url:FINANCE_APR07_2022.officialUrl,
   fetchImpl:fetchStrictOriginalFinancePDF as typeof fetch
  });
  if(original.httpStatus!==200||original.extractionMethod!=='embedded_text')
   throw Error('source_or_parser_error');
  analysis=inspect2022FinanceApr07OriginalMinutes(original.text);
 }catch(e){failure=failCode(e);}
 const report={
  schemaVersion:'senate-2022-finance-apr07-seven-original-electronic-rolls-first-raw-source-audit-v1',
  issue:864,
  sourceObservationUTC:new Date().toISOString(),
  originalPublicURL:FINANCE_APR07_2022.officialUrl,
  sourceAuthority:'Minnesota Legislative Reference Library official 2022 ELECTRONIC Senate Finance minutes',
  sourceAcquisitionStatus:failure===null?'ORIGINAL_COMPLETE_PDF_SHA_AND_SEVEN_ROLLS_VERIFIED':'FAILED_CLOSED',
  originalPDFHTTPStatus:original?.httpStatus??null,
  originalPDFByteLength:original?.bytes??null,
  originalFullPDFFirstSourceSHA256:original?.contentSha256??null,
  originalEmbeddedTextSHA256:original?sha256(original.text):null,
  embeddedTextExtractionMethod:original?.extractionMethod??null,
  structuredSevenOriginalElectronicRolls:failure===null?analysis:null,
  acquisitionOrContentFailures:failure===null?0:1,
  sourceFailureCode:failure,
  independentSecondFullOriginalPDFSHAConfirmed:false,
  originalDifferent2022PrintMinutesPagesObtained:false,
  originalPrintVsElectronicVoteParityCertified:false,
  2022StatewideCommitteeRecordedVoteDenominator:null,
  originalHistoricalWebPublishedAt:null,
  heardAudioOrVideo:false,
  independentHistoricalExactPublicBy:null,
  noSourceOriginalPdfTextOrRawYeaNaySenatorNameListsUploaded:true,
  noMemberVotesImportedOrPrivateProductionDatabaseAccess:true,
  noForecastModelTrainingServingSchedulerFloorOr2027:true,
  noGovernmentOfficeContact:true,issue864RemainsOpen:true
 };
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+'\n','utf8');
 console.log(JSON.stringify({
  sourceOriginalPdfSuccessfullyAuthenticated:failure===null,
  namedRollParagraphs:analysis?.electronicallyPrintedNamedRollParagraphCount??0,
  sourceNameTokens:analysis?.electronicallyPrintedNamedYeaNayCount??0,
  sourceFailures:failure===null?0:1,privateVotesImported:0,governmentContact:0
 }));
 if(failure!==null)process.exitCode=1;
}
main().catch(e=>{console.error(failCode(e));process.exitCode=1;});

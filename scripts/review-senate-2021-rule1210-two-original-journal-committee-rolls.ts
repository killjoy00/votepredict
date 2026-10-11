/** #864 original 2021 Senate Journal official *COMMITTEE* Rule12.10 source only. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf}
 from '../src/evidence/minnesota-senate-committee-source.js';
import {
 RULE1210_2021_VERSION,ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS,
 inspectAuthentic2021SenateJournalCommitteeRoll
} from '../src/evidence/senate-2021-rule1210-two-original-journal-committee-rolls.js';

const MAX_PDF_BYTES=4_000_000;
const sha=(t:string)=>createHash('sha256').update(t).digest('hex');
function safe(error:unknown){
 return String(error instanceof Error?error.message:error)
  .replace(/https?:\/\/\S+/gi,'[official 2021 Journal PDF]').slice(0,180);
}
async function exactPublicPdf(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(!ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS.some(x=>x.document===url))
  throw Error('Not one exact official 2021 Senate Journal original PDF');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.url!==url||r.status!==200||
  !/^application\/pdf\b/i.test(r.headers.get('content-type')??''))
  throw Error('Official original 2021 Senate Journal status/redirect/PDF MIME invalid');
 const declared=r.headers.get('content-length');
 if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
  Number(declared)>MAX_PDF_BYTES||Number(declared)<300))
  throw Error('Official Senate Journal PDF Content-Length bounds invalid');
 const reader=r.body?.getReader();
 if(!reader)throw Error('Official Journal PDF body absent');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;) {
   const item=await reader.read();
   if(item.done)break;
   size+=item.value.byteLength;
   if(size>MAX_PDF_BYTES){
    await reader.cancel();
    throw Error('Official Senate Journal stream exceeded exact PDF cap');
   }
   chunks.push(item.value);
  }
 } finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);
 let off=0;for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.byteLength}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Original 2021 Journal source not a PDF');
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function inspect(bill:'SF173'|'SF1470'){
 const src=ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS.find(x=>x.bill===bill)!;
 let pdf:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let motion:ReturnType<typeof inspectAuthentic2021SenateJournalCommitteeRoll>|null=null;
 const errors:string[]=[];
 try{
  pdf=await fetchSenateCommitteeMinutePdf({
   url:src.document,fetchImpl:exactPublicPdf as typeof fetch
  });
  if(pdf.extractionMethod!=='embedded_text')
   throw Error('Expected 2021 Journal PDF embedded text unavailable');
  motion=inspectAuthentic2021SenateJournalCommitteeRoll(pdf.text,bill);
 }catch(e){errors.push(safe(e))}
 return {
  bill:src.bill,originalCommittee:src.committee,
  sourceAuthority:'Official Minnesota Senate Journal, Rule 12.10 COMMITTEE report',
  journalPublicationDate:src.reportDate,reportedJournalDay:src.journalDay,
  journalPrintedPage:src.journalPage,originalJournalPdfUrl:src.document,
  independentRevisorBillHistoryUrl:src.revisor,
  originalPdfAndTextRetrievedAndHashed:pdf!==null,
  originalSourcePdfBytes:pdf?.bytes??null,
  originalSourcePdfSHA256:pdf?.contentSha256??null,
  originalExtractedTextSHA256:pdf?sha(pdf.text):null,
  originalExtractedTextType:pdf?.extractionMethod??null,
  sourceCommitteeRollParsed:motion!==null,
  namedSourceMotionProof:motion,
  sourceFailures:errors,
  historicalExactCommitteeMeetingDateNotIndependentlyProven:true,
  senateFloorVoteExplicitlyExcluded:true,
  official2021PrintedCommitteeMinutesNotReconciled:true,
  noPrivateDbReadWriteMemberVoteBackfill:true,
  noModelForecastServingTrainingSchedulerFloor2027Change:true
 };
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Exact --output PATH required');
 const out=resolve(args[1]);
 const results=await Promise.all([inspect('SF173'),inspect('SF1470')]);
 const result={
  schemaVersion:RULE1210_2021_VERSION,issue:864,
  originalPdfSourcesExpected:2,
  originalPdfSourcesVerified:results.filter(x=>x.sourceCommitteeRollParsed).length,
  results,originalRunSuccess:results.every(x=>x.sourceCommitteeRollParsed),
  printOnlyOfficialCommitteeMinutesComparisonUnavailable:true,
  journalSourceDoesNotEstablishAllCommitteeRollDenominator:true,
  journalReportDayNotInferredToBeUnderlyingVoteDay:true,
  originalPDFOrFullTextOrUnhashedNamedMemberListsNotCommitted:true,
  noMemberVoteProductionImport:true,
  noPublicOfficeOutreach:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
  journalReportsVerified:result.originalPdfSourcesVerified,
  originalSourceErrors:results.map(x=>({bill:x.bill,count:x.sourceFailures.length}))
 }));
 if(!result.originalRunSuccess)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

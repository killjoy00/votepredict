/** One-time original official 2021 Senate Journal COMMITTEE SF910 Rule12.10. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {
 SF910_2021_COMMITTEE_SOURCE as S,inspectOriginalSF9102021JournalCommitteeRoll
} from '../src/evidence/senate-2021-rule1210-sf910-original-journal-committee.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const MAX=3_000_000;
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[original Senate Journal]').slice(0,180);
async function boundedOriginal(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==S.originalJournalURL)throw Error('Not the exact official SF910 original Journal PDF');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url||!/^application\/pdf\b/i.test(r.headers.get('content-type')??''))
  throw Error('Original official SF910 PDF HTTP/MIME/redirect invalid');
 const len=r.headers.get('content-length');
 if(len!==null&&(!Number.isSafeInteger(Number(len))||Number(len)<300||Number(len)>MAX))
  throw Error('Original SF910 PDF declared size invalid');
 const reader=r.body?.getReader();if(!reader)throw Error('Original SF910 source body missing');
 const chunks:Uint8Array[]=[];let n=0;
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   n+=part.value.byteLength;
   if(n>MAX){await reader.cancel();throw Error('Original Senate SF910 PDF streaming cap')}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const b=new Uint8Array(n);let at=0;
 for(const c of chunks){b.set(c,at);at+=c.byteLength}
 if(n<300||new TextDecoder('latin1').decode(b.slice(0,5))!=='%PDF-')
  throw Error('Original SF910 source has non-PDF bytes');
 return new Response(b,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Expected exact --output PATH');
 const out=resolve(args[1]);
 let original:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let proof:ReturnType<typeof inspectOriginalSF9102021JournalCommitteeRoll>|null=null;
 const failures:string[]=[];
 try{
  original=await fetchSenateCommitteeMinutePdf({
   url:S.originalJournalURL,fetchImpl:boundedOriginal as typeof fetch
  });
  if(original.extractionMethod!=='embedded_text')
   throw Error('Original March8 Senate Journal PDF source text unavailable');
  proof=inspectOriginalSF9102021JournalCommitteeRoll(original.text);
 }catch(e){failures.push(safe(e))}
 const report={
  schemaVersion:S.version,issue:864,
  originalPublishedSenateJournalReportDay:S.journalReportDate,
  originalPrintedPage:S.journalPage,
  namedCommittee:S.committee,
  exactSourcePDFURL:S.originalJournalURL,
  sourcePdfFetched:original!==null,
  sourcePDFBytes:original?.bytes??null,
  originalPDFSHA256:original?.contentSha256??null,
  originalEmbeddedTextSHA256:original?sha(original.text):null,
  namedCommitteeMotionPassedStrictOriginalSourceValidation:proof!==null,
  originalMotion:proof,errors:failures,originalErrorCount:failures.length,
  previousOtherBillSF1470SameNamedSidesNotDeduplicated:true,
  journalReportDayNotIndependentlyAuthenticatedHearingActionDate:true,
  original2021OfficialLRLPrintCommitteeMinutesNotCompared:true,
  originalSourcePdfAndFullExtractedTextNotCommitted:true,
  noRealNameSideListsCommitted:true,
  noProductionPrivateDBOrMemberVoteImport:true,
  noModelsForecastTrainingServingSchedulerFloorOr2027:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  sourceOriginalPDFAcquired:original!==null,
  namedCommitteeRollVerified:proof!==null,
  printedTally:proof?[proof.sourcePrintedYea,proof.sourcePrintedNay]:null,
  failures:failures.length
 }));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

/** One-time #864 ORIGINAL official 2021 JOURNAL Rule 12.10 COMMITTEE roll. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf}
 from '../src/evidence/minnesota-senate-committee-source.js';
import {
 RULE1210_2021_THREE_VERSION,THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS,
 inspectAuthenticNew2021JournalCommitteeRoll
} from '../src/evidence/senate-2021-rule1210-sf2-sf566-sf1457-original.js';

const MAX_BYTES=4_000_000;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[original Senate Journal PDF]').slice(0,170);
async function exactPublicSource(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(!THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.some(x=>x.journalPdfURL===url))
  throw Error('Not an allowlisted exact 2021 official Senate Journal source');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url||!/^application\/pdf\b/i.test(r.headers.get('content-type')??''))
  throw Error('Original Journal PDF status/MIME/redirect did not match exact source');
 const declared=r.headers.get('content-length');
 if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
  Number(declared)<300||Number(declared)>MAX_BYTES))
  throw Error('Original Journal PDF declaration outside allowed byte bounds');
 const reader=r.body?.getReader();if(!reader)throw Error('Original Journal response body missing');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   size+=part.value.byteLength;
   if(size>MAX_BYTES){await reader.cancel();throw Error('Original PDF stream cap exceeded')}
   chunks.push(part.value);
  }
 } finally {reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;
 for(const c of chunks){bytes.set(c,at);at+=c.byteLength}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Unexpected non-PDF original source file');
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function inspectOne(src:(typeof THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS)[number]){
 let original:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let motion:ReturnType<typeof inspectAuthenticNew2021JournalCommitteeRoll>|null=null;
 const errors:string[]=[];
 try{
  original=await fetchSenateCommitteeMinutePdf({
   url:src.journalPdfURL,fetchImpl:exactPublicSource as typeof fetch
  });
  if(original.extractionMethod!=='embedded_text')
   throw Error('Original Senate Journal embedded-text extraction missing');
  if(src.previouslySHAAuthenticatedOriginalJournalPDF&&
   original.contentSha256!==src.previouslySHAAuthenticatedOriginalJournalPDF)
   throw Error('SF2 Feb8 same official PDF changed vs earlier verified SF173 original bytes');
  motion=inspectAuthenticNew2021JournalCommitteeRoll(original.text,src.bill);
 }catch(e){errors.push(safe(e))}
 return {
  bill:src.bill,sourceCommittee:src.committee,
  originalJournalReportDate:src.journalDate,originalJournalPage:src.journalPage,
  originalJournalDay:src.journalDay,originalPdfUrl:src.journalPdfURL,
  revisorLegislativeStatusURL:src.revisorURL,
  sourcePdfRetrieved:original!==null,
  originalPdfBytes:original?.bytes??null,
  originalPdfSHA256:original?.contentSha256??null,
  originalExtractedTextSHA256:original?sha(original.text):null,
  originalExtractionMode:original?.extractionMethod??null,
  previousIndependentSameOriginalPdfShaPin:src.previouslySHAAuthenticatedOriginalJournalPDF,
  previousSameFeb8PdfIndependentArtifactRunId:src.priorOriginalSF173SourceRunId,
  reportedNamedCommitteeMotionParsed:motion!==null,
  originalSourceMotion:motion,originalFailures:errors,
  independentSenateCommitteeBillLogHearingDateLead:src.independentSenateCommitteeBillLogMeetingDateLead,
  billLogDateIsNotAnIndependentlyVerifiedMotionDate:true,
  journalReportDateDoesNotProveUnderlyingCommitteeMotionDate:true,
  official2021PrintedLRLCommitteeMinutesNotCompared:true,
  noSourceMemberVotesImported:true,
  noPrivateDatabaseOrForecastModelUse:true
 };
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Expected exact --output PATH');
 const output=resolve(args[1]);
 const reports=await Promise.all(THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.map(inspectOne));
 const result={
  schemaVersion:RULE1210_2021_THREE_VERSION,issue:864,
  sourceAuthority:'Minnesota Senate original published Senate JOURNAL Rule12.10 COMMITTEE reports',
  originalSourceExpectedMotionReports:3,
  distinctOriginalJournalPDFURLs:3,
  actuallyParsedNamedCommitteeMotions:reports.filter(x=>x.reportedNamedCommitteeMotionParsed).length,
  everyOriginalSourcePassed:reports.every(x=>x.reportedNamedCommitteeMotionParsed),
  reports,
  previous2021SF450SameMemberSidesButDifferentBillNoDedupe:true,
  noIndividualRawSenatorBySideListsOrOriginalPdfTextCommitted:true,
  noOfficial2021LRLPrintMinutesCrosscheck:true,
  noStatewideCommitteeVoteCensus:true,
  noPrivateDbMemberVoteIngestionOrParity:true,
  noModelForecastTrainingServingSchedulerSenateFloorOr2027:true,
  noGovernmentOfficeContact:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
  sourceCount:reports.length,
  verified:result.actuallyParsedNamedCommitteeMotions,
  each:reports.map(x=>({bill:x.bill,fetched:x.sourcePdfRetrieved,
   vote:x.originalSourceMotion?
    [x.originalSourceMotion.printedYeaCount,x.originalSourceMotion.printedNayCount]:null,
   errorCount:x.originalFailures.length}))
 }));
 if(!result.everyOriginalSourcePassed)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

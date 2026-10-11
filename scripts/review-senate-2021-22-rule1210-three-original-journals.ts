/** One-time exact-original Minnesota Senate Journal Rule12.10 committee acquisition. */
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {MN_ORIGINAL_RULE1210_THREE,inspectOriginalThreeRule1210CommitteeRoll} from '../src/evidence/senate-2021-22-rule1210-three-original-journal-rolls.js';
import type {ThreeRule1210Target} from '../src/evidence/senate-2021-22-rule1210-three-original-journal-rolls.js';

const MAX=12_000_000;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official original senate PDF]').slice(0,250);
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--target'||args[2]!=='--output'||
  !Object.prototype.hasOwnProperty.call(MN_ORIGINAL_RULE1210_THREE,args[1])||!args[3])
  throw Error('Expected --target sf1|sf2909|sf9ss1 --output FILE');
 const key=args[1] as ThreeRule1210Target;
 const src=MN_ORIGINAL_RULE1210_THREE[key];
 const out=resolve(args[3]);
 async function exactOriginal(input:string|URL|Request,init?:RequestInit):Promise<Response>{
  const url=input instanceof Request?input.url:String(input);
  if(url!==src.url)throw Error('Requested URL not an exact allowlisted official Journal original');
  const response=await fetch(url,{...init,redirect:'manual'});
  if(response.status!==200||response.url!==url||
    !/^application\/pdf\b/i.test(response.headers.get('content-type')??''))
   throw Error('Original PDF source redirect/HTTP/MIME validation failed');
  const declared=response.headers.get('content-length');
  if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
     Number(declared)<300||Number(declared)>MAX))
   throw Error('Original PDF source declared content-length invalid');
  const reader=response.body?.getReader();
  if(!reader)throw Error('Original PDF source stream missing');
  const chunks:Uint8Array[]=[];let length=0;
  try{
   for(;;){
    const next=await reader.read();
    if(next.done)break;
    length+=next.value.byteLength;
    if(length>MAX){await reader.cancel();throw Error('Original PDF exceeds stream size bound')}
    chunks.push(next.value);
   }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(length);let at=0;
  for(const c of chunks){bytes.set(c,at);at+=c.byteLength}
  if(length<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
   throw Error('Original Senate source was not PDF');
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
 }
 let original:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let motion:ReturnType<typeof inspectOriginalThreeRule1210CommitteeRoll>|null=null;
 const errors:string[]=[];
 try{
  original=await fetchSenateCommitteeMinutePdf({url:src.url,fetchImpl:exactOriginal as typeof fetch});
  if(original.extractionMethod!=='embedded_text')throw Error('No original embedded PDF text');
  motion=inspectOriginalThreeRule1210CommitteeRoll(key,original.text);
 }catch(e){errors.push(safe(e))}
 const report={
  schemaVersion:'mn-rule1210-three-original-journal-one-source-v1',
  issue:864,key,sourceJournalReportDay:src.reportDay,sourceJournalPrintedPage:src.journalPage,
  session:src.session,committee:src.committee,bill:src.bill,exactMotion:src.motion,
  originalOfficialJournalURL:src.url,originalPDFReceived:original!==null,
  originalPDFBytes:original?.bytes??null,originalPDFSHA256:original?.contentSha256??null,
  originalEmbeddedTextSHA256:original?sha(original.text):null,
  originalExactNamedCommitteeMotionCertified:motion!==null,originalMotion:motion,
  errorCount:errors.length,errors,
  noAssumedOriginalCommitteeMeetingDate:true,
  noInferredSameDayHistoricalEligibility:true,
  original2021LRLPrintedMinutesNotCompared:true,
  missingAbsentFieldRemainsNull:true,
  originalFullBinaryAndExtractedTextNotCommitted:true,
  noReadableHistoricalMemberBySideListsCommitted:true,
  noMemberVoteOrPrivateDBChange:true,noFloorVotesOrForecastChanges:true,
  indexPublicationLeadNotStatewideRecordedVoteDenominator:true,issue864RemainsOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({key,sourceAcquired:original!==null,motionValid:motion!==null,
  printed:motion?[motion.printedYea,motion.printedNay]:null,errors:errors.length}));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

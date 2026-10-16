/**
 * Independently reacquire genuine 11MB April12 2021 original Senate Journal
 * and strictly verify THREE separate committee failed amendment named rolls.
 * A failed source job is preserved as an error artifact, never success.
 */
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fetchSenateCommitteeMinutePdf} from '../../src/evidence/minnesota-senate-committee-source.js';
import {
 APR12_THREE_STRICT_ORIGINAL as S,verifyThreeOriginalApril12CommitteeAmendmentRolls
} from '../../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const MAX=15_000_000;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[exact official original Senate Journal PDF]').slice(0,230);
async function bounded(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==S.sourceURL)throw Error('Only one exact original April12 PDF URL allowed');
 const res=await fetch(url,{...init,redirect:'manual'});
 if(res.status!==200||res.url!==url||
    !/^application\/pdf\b/i.test(res.headers.get('content-type')??''))
  throw Error('Original April12 PDF HTTP/MIME/redirect verification failed');
 const len=res.headers.get('content-length');
 if(len!==null&&(!Number.isSafeInteger(Number(len))||
  Number(len)!==S.originalPDFBytes||Number(len)>MAX))
  throw Error('Original April12 PDF declared bytes conflict with pinned original');
 const reader=res.body?.getReader();if(!reader)throw Error('Original PDF has no source stream');
 let n=0;const chunks:Uint8Array[]=[];
 try{
  for(;;){
   const item=await reader.read();if(item.done)break;
   n+=item.value.byteLength;
   if(n>MAX){await reader.cancel();throw Error('Original PDF exceeds bounded byte cap')}
   chunks.push(item.value);
  }
 }finally{reader.releaseLock()}
 const buf=new Uint8Array(n);let at=0;
 for(const part of chunks){buf.set(part,at);at+=part.byteLength}
 if(n!==S.originalPDFBytes||new TextDecoder('latin1').decode(buf.slice(0,5))!=='%PDF-')
  throw Error('Original Senate Journal PDF byte length/magic mismatched');
 return new Response(buf,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Expected --output ORIGINAL_RESULT_JSON');
 const out=resolve(args[1]);
 let original:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let certified:ReturnType<typeof verifyThreeOriginalApril12CommitteeAmendmentRolls>|null=null;
 const failures:string[]=[];
 try{
  original=await fetchSenateCommitteeMinutePdf({
   url:S.sourceURL,fetchImpl:bounded as typeof fetch
  });
  if(original.extractionMethod!=='embedded_text')
   throw Error('Original 2021 Senate Journal embedded source text unavailable');
  if(original.bytes!==S.originalPDFBytes||
     original.contentSha256!==S.originalPDFSHA256||
     sha(original.text)!==S.originalEmbeddedTextSHA256)
   throw Error('Original PDF byte and text SHA commitments failed');
  certified=verifyThreeOriginalApril12CommitteeAmendmentRolls(original.text);
 }catch(e){failures.push(safe(e))}
 const report={
  schemaVersion:S.version,issue:864,
  originalJournalURL:S.sourceURL,senateJournalReportDate:S.journalReportDay,
  originalPDFReceived:original!==null,originalPDFBytes:original?.bytes??null,
  originalPDFSHA256:original?.contentSha256??null,
  originalEmbeddedTextSHA256:original?sha(original.text):null,
  originalNamedRollSourceCertified:certified!==null,
  independentlyCheckedThreeDistinctCommitteeAmendmentRolls:certified,
  errorCount:failures.length,errors:failures,
  provisionalFirstSourceProbeRunId:38170792094,
  provisionalFirstSourceCommit:'a7d4569883801f72c8a71ce5c2fdd0c01655feca',
  sourceJournalDayNotOriginalMeetingDayOrPublicFirstAvailability:true,
  unprintedAbsentRemainsNull:true,
  sameSF1159NameSidesDoNotDeduplicateTwoMotionParagraphs:true,
  noReadableHistoricalMemberChoiceListsOrOriginalPDFCommitted:true,
  noPrivateStoredVoteReconciliationOrProductionImport:true,
  noFloorOrModelsForecastOr2027:true,issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  originalPdfFetched:original!==null,
  threeDistinctOriginalNamedCommitteeAmendmentsCertified:certified?.independentlyPinnedExactOriginalCommitteeNamedRolls??0,
  errorCount:failures.length
 }));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

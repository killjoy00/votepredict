/** Public-source read-only original 2023 Transportation SF3157 HTML evidence. */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {
 APR03_2023_SOURCE as SOURCE,inspectOfficialApr03SF3157,
 normalizeOfficialMinutesHtml
} from '../../src/evidence/senate-2023-transportation-apr03-sf3157-source.js';

const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official Minnesota Senate minutes]')
 .slice(0,185);
async function originalHtml(){
 const sourceUrl=SOURCE.originalOfficialMinutesUrl;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15_000);
 let res:Response;
 try{res=await fetch(sourceUrl,{redirect:'manual',signal:controller.signal});}
 finally{clearTimeout(timeout)}
 if(res.url!==sourceUrl||res.status!==200||
  !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(res.headers.get('content-type')??''))
  throw Error('Official 2023 Senate HTML direct fetch URL, status, MIME or redirect invalid');
 const cl=res.headers.get('content-length');
 if(cl!==null&&(!Number.isSafeInteger(Number(cl))||
  Number(cl)>SOURCE.maxOriginalHtmlBytes||Number(cl)<1000))
  throw Error('Original official Senate HTML reported invalid content-length');
 const body=res.body?.getReader();
 if(!body)throw Error('Original Senate HTML response body absent');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const item=await body.read();
   if(item.done)break;
   size+=item.value.byteLength;
   if(size>SOURCE.maxOriginalHtmlBytes) {
    await body.cancel();
    throw Error('Original HTML exceeded streamed source cap');
   }
   chunks.push(item.value);
  }
 }finally{body.releaseLock()}
 const bytes=new Uint8Array(size);
 let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
 const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 return {html,sha:hash(html),bytes:size};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Exact --output metadata JSON path required');
 const out=resolve(args[1]);
 mkdirSync(dirname(out),{recursive:true});
 let original:Awaited<ReturnType<typeof originalHtml>>|null=null;
 let result:ReturnType<typeof inspectOfficialApr03SF3157>|null=null;
 const failures:string[]=[];
 try{original=await originalHtml();result=inspectOfficialApr03SF3157(original.html);}
 catch(e){failures.push(safe(e))}
 const payload={
  schemaVersion:SOURCE.schemaVersion,issue:SOURCE.issue,
  committee:SOURCE.committee,hearingDate:SOURCE.date,bill:SOURCE.bill,
  sourceAuthority:'Official Minnesota State Senate',
  originalSourceUrl:SOURCE.originalOfficialMinutesUrl,
  sourceUrlExactlyAllowlisted:true,
  retrievedOriginalHtmlBytes:original?.bytes??null,
  originalHtmlSha256:original?.sha??null,
  originalVisibleTextSHA256:original?hash(normalizeOfficialMinutesHtml(original.html)):null,
  originalHtmlSuccessfullyRetrieved:original!==null,
  sevenOriginalNamedAmendmentRollsSuccessfullyParsed:result!==null,
  sevenRollsWithExactlyOneContradictoryA49Conclusion:result,
  failedOriginalSourceChecks:failures.length,failures,
  thisDoesNotProveUniquePrivateStoredVotesOr2021to2025Denominator:true,
  originalA49TextConflictCannotBeSilentlyRewritten:true,
  noOriginalHtmlOrCompleteNamedSideListsCommitted:true,
  noPrivateProductionDbMemberVotesOrModelForecastUpdates:true,
  issue864MustRemainOpen:true
 };
 writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
 console.log(JSON.stringify({
  publicOriginalSourceAvailable:original!==null,
  parsedNamedRollBlocks:result?.records.length??0,
  conflictedPrintedA49Conclusion:result?.records[6]?.contradictoryMotionVersusConclusionLabel??null,
  sourceErrors:failures.length
 }));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

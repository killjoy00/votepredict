/** One-time ORIGINAL public 2021 Minnesota Senate online SF450 committee roll. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {
 MAR10_2021_SF450_SOURCE as SOURCE,
 inspectSenate2021Mar10SF450OnlineHtml
} from '../src/evidence/senate-2021-state-government-mar10-sf450-online-source.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
function safe(e:unknown){return String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official Senate online page]').slice(0,180)}
async function boundedOneExactPublicPage(){
 const url=SOURCE.originalOnlineMinutesURL;
 const res=await fetch(url,{redirect:'manual',headers:{'Accept':'text/html'}});
 if(res.status!==200||res.url!==url||
  !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(res.headers.get('content-type')??''))
  throw Error('Original official Senate online 2021 page changed status/MIME/redirect');
 const declared=res.headers.get('content-length');
 if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
    Number(declared)<1000||Number(declared)>SOURCE.maxHtmlBytes))
  throw Error('Original 2021 HTML Content-Length invalid');
 const reader=res.body?.getReader();
 if(!reader)throw Error('Original Senate 2021 response stream missing');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const part=await reader.read();
   if(part.done)break;
   size+=part.value.byteLength;
   if(size>SOURCE.maxHtmlBytes){
    await reader.cancel();
    throw Error('Original Senate 2021 HTML stream cap exceeded');
   }
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const all=new Uint8Array(size);
 let off=0;for(const x of chunks){all.set(x,off);off+=x.byteLength}
 return {html:new TextDecoder('utf-8',{fatal:true}).decode(all),bytes:size};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Expected exact --output PATH');
 const out=resolve(args[1]!);
 let source:Awaited<ReturnType<typeof boundedOneExactPublicPage>>|null=null;
 let proof:ReturnType<typeof inspectSenate2021Mar10SF450OnlineHtml>|null=null;
 const failures:string[]=[];
 try{
  source=await boundedOneExactPublicPage();
  proof=inspectSenate2021Mar10SF450OnlineHtml(source.html);
 }catch(e){failures.push(safe(e))}
 const result={
  schemaVersion:SOURCE.schemaVersion,issue:864,
  onlineSenateHearingDay:SOURCE.hearingDate,
  historicalCommittee:SOURCE.committee,
  originalSenateOnlineMinutesUrl:SOURCE.originalOnlineMinutesURL,
  official2021PrintCollection:SOURCE.official2021PrintMinutesAuthorityURL,
  originalSenateOnlineHtmlRetrieved:source!==null,
  originalSenateHtmlBytes:source?.bytes??null,
  originalSenateHtmlSha256:source?sha(source.html):null,
  originalOnline2021NamedSf450RollParsed:proof!==null,
  originalSourceResult:proof,
  failedOriginalSourceChecks:failures.length,failures,
  original2021PrintedOfficialMinutesCompared:false,
  online2021ProvenanceNotSubstitutedForOfficialPrint:true,
  noFullOriginalHTMLOrUnhashedSenatorBySideListsStored:true,
  noAutomatic2021OfficialVoteOrStatewideDenominatorCertification:true,
  noPrivateProductionDatabaseOrMemberVoteImport:true,
  noModelsTrainingForecastServingSchedulerFloorOr2027:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
  onlineSenateSourceHtmlFetched:source!==null,
  officialPrinted2021MinutesCompared:false,
  namedOnlineSf450RollIsolated:proof!==null,
  sourceNamedSideCounts:proof?[proof.onlineOriginalNamedYeaCount,proof.onlineOriginalNamedNayCount]:null,
  originalFailures:failures.length
 }));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

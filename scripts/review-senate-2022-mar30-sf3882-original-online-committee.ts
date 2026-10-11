/** Exact-original March30 2022 Senate Property Taxes subcommittee SF3882 online 2-2 referral roll. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {
 MAR30_2022_SF3882_COMMITTEE_SOURCE as SOURCE,
 inspectOriginalMar30SF3882SubcommitteeMinutes
} from '../src/evidence/senate-2022-propertytaxes-mar30-sf3882-online-roll.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
function safe(e:unknown){return String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official Senate online page]').slice(0,180)}
async function boundedOneExactPublicPage(){
 const url=SOURCE.originalOnlineMinutesURL;
 const res=await fetch(url,{redirect:'manual',headers:{'Accept':'text/html'}});
 if(res.status!==200||res.url!==url||
  !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(res.headers.get('content-type')??''))
  throw Error('Original official Senate online 2022 page changed status/MIME/redirect');
 const declared=res.headers.get('content-length');
 if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
    Number(declared)<1000||Number(declared)>SOURCE.maxOriginalHtmlBytes))
  throw Error('Original 2022 HTML Content-Length invalid');
 const reader=res.body?.getReader();
 if(!reader)throw Error('Original Senate 2022 response stream missing');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const part=await reader.read();
   if(part.done)break;
   size+=part.value.byteLength;
   if(size>SOURCE.maxOriginalHtmlBytes){
    await reader.cancel();
    throw Error('Original Senate 2022 HTML stream cap exceeded');
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
 let proof:ReturnType<typeof inspectSenate2022Mar10SF3882OnlineHtml>|null=null;
 const failures:string[]=[];
 try{
  source=await boundedOneExactPublicPage();
  proof=inspectSenate2022Mar10SF3882OnlineHtml(source.html);
 }catch(e){failures.push(safe(e))}
 const result={
  schemaVersion:SOURCE.version,issue:864,
  onlineSenateHearingDay:SOURCE.meetingDate,
  historicalCommittee:SOURCE.subcommittee,
  originalSenateOnlineMinutesUrl:SOURCE.originalOnlineMinutesURL,
  official2022PrintCollection:'https://www.lrl.mn.gov/minutes/',
  originalSenateOnlineHtmlRetrieved:source!==null,
  originalSenateHtmlBytes:source?.bytes??null,
  originalSenateHtmlSha256:source?sha(source.html):null,
  originalOnline2022NamedSf3882RollParsed:proof!==null,
  originalSourceResult:proof,
  failedOriginalSourceChecks:failures.length,failures,
  original2022PrintedOfficialMinutesCompared:false,
  electronic2022OriginalNotAssumedEquivalentToSeparatePrintedCollection:true,
  noFullOriginalHTMLOrUnhashedSenatorBySideListsStored:true,
  noStatewideCommitteeVoteCensusOrPrivateRowParityClaim:true,
  noPrivateProductionDatabaseOrMemberVoteImport:true,
  noModelsTrainingForecastServingSchedulerFloorOr2027:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
  onlineSenateSourceHtmlFetched:source!==null,
  officialPrinted2022MinutesCompared:false,
  namedOnlineSf3882RollIsolated:proof!==null,
  sourceNamedSideCounts:proof?[proof.sourcePrintedYea,proof.sourcePrintedNay]:null,
  originalFailures:failures.length
 }));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

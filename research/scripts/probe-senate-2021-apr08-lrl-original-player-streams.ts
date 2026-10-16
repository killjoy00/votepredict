/**
 * Bounded original public Senate hearing media SOURCE accessibility ONLY.
 *
 * 2021-04-08. Retrieve exactly 2 SHA-pinned LRL pages; inspect audio/video
 * player URLs; optionally read <=64KiB of only LRL-hosted source candidates.
 * Never read a complete recording or issue vote/statement assertions.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {APR08_ORIGINAL_MEDIA} from
 '../../src/evidence/senate-2021-apr08-original-media-source-gates.js';
import {examinePinnedApril08LrlOriginalPlayerHTML} from
 '../evidence/senate-2021-apr08-lrl-original-media-player-sources.js';

const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const bytesMax=2_000_000;
const prefixMax=65536;
function errorMessage(e:unknown){
 const x=e as {message?:string;cause?:{code?:string};code?:string};
 const msg=x?.message??'unknown';
 if(/^(original |HTTP |source |unexpected |media |redirect)/i.test(msg))return msg.slice(0,160);
 return x?.cause?.code??x?.code??'network_or_source_error';
}
async function strictOriginalHTML(url:string){
 const res=await fetch(url,{
  headers:{Accept:'text/html,application/xhtml+xml',
   'user-agent':'VotePredict-864-2021-original-LRL-player-source-audit'},
  credentials:'omit',redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(30000)
 });
 if(!res.ok||new URL(res.url).origin!=='https://www.lrl.mn.gov')
  throw Error('original LRL public HTML not acquired at approved host');
 if(!res.body)throw Error('original LRL public HTML no response body');
 let length=0;const parts:Buffer[]=[];
 for await(const chunk of res.body){
  const b=Buffer.from(chunk);length+=b.length;
  if(length>bytesMax)throw Error('original LRL source exceeded byte cap');
  parts.push(b);
 }
 return Buffer.concat(parts);
}
async function limitedMediaPrefix(url:string){
 const outcome:{
  sourceURL:string;state:string;httpStatus:number|null;
  contentType:string|null;rangeHonored:boolean;
  totalDeclaredResponseBytes:string|null;
  exactRetrievedPrefixBytes:number;retrievedPrefixSHA256:string|null;
  containerSignature:string;error:string|null;
  completeRecordingAuthenticated:false;senatorVotesAuthenticated:false;
 }={
  sourceURL:url,state:'UNAVAILABLE',httpStatus:null,contentType:null,
  rangeHonored:false,totalDeclaredResponseBytes:null,
  exactRetrievedPrefixBytes:0,retrievedPrefixSHA256:null,
  containerSignature:'unknown',error:null,
  completeRecordingAuthenticated:false,senatorVotesAuthenticated:false
 };
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!['www.lrl.mn.gov','lrl.mn.gov'].includes(parsed.hostname))
  throw Error('unexpected media source outside fixed official LRL host allowlist');
 try{
  const res=await fetch(url,{
   redirect:'error',cache:'no-store',credentials:'omit',
   headers:{Range:'bytes=0-65535',
    Accept:'audio/mpeg,audio/*,video/mp4,video/*,application/octet-stream',
    'user-agent':'VotePredict-864-2021-original-LRL-player-byte-prefix'},
   signal:AbortSignal.timeout(15000)
  });
  outcome.httpStatus=res.status;
  outcome.contentType=res.headers.get('content-type');
  outcome.totalDeclaredResponseBytes=res.headers.get('content-length');
  outcome.rangeHonored=res.status===206;
  if(![200,206].includes(res.status)){
   outcome.state='HTTP_UNAVAILABLE';
   await res.body?.cancel().catch(()=>undefined);
   return outcome;
  }
  if(!res.body)throw Error('media player yielded no public prefix body');
  const reader=res.body.getReader();const parts:Buffer[]=[];let n=0;
  try{
   while(n<prefixMax){
    const item=await reader.read();
    if(item.done)break;
    const b=Buffer.from(item.value);
    if(b.length){
     const slice=b.subarray(0,prefixMax-n);parts.push(slice);n+=slice.length;
    }
   }
  }finally{await reader.cancel().catch(()=>undefined);}
  const b=Buffer.concat(parts);
  outcome.exactRetrievedPrefixBytes=b.length;
  outcome.retrievedPrefixSHA256=b.length?sha(b):null;
  if(b.subarray(0,3).toString('ascii')==='ID3')outcome.containerSignature='id3';
  else if(b.length>1&&b[0]===255&&(b[1]&224)===224)
   outcome.containerSignature='mpeg_frame';
  else if(b.length>8&&b.subarray(4,8).toString('ascii')==='ftyp')
   outcome.containerSignature='mp4';
  else if(b.subarray(0,4).toString('ascii')==='RIFF')
   outcome.containerSignature='riff';
  else outcome.containerSignature='nonmedia_or_unknown';
  outcome.state=b.length>=512&&outcome.containerSignature!=='nonmedia_or_unknown'
   ?'MEDIA_PREFIX_ACQUIRED_NOT_WHOLE_RECORDING':'NONMEDIA_OR_SHORT_RESPONSE';
 }catch(e){
  outcome.state='SOURCE_REQUEST_ERROR';outcome.error=errorMessage(e);
 }
 return outcome;
}
async function main(){
 const at=process.argv.indexOf('--output');
 if(at<0||!process.argv[at+1]||process.argv.length!==4)
  throw Error('Pass --output FILE explicitly');
 const sources:unknown[]=[];let originalFailures=0;
 for(const spec of APR08_ORIGINAL_MEDIA.cases){
  try{
   const b=await strictOriginalHTML(spec.lrlURL);
   const parsed=examinePinnedApril08LrlOriginalPlayerHTML(b,spec.bill);
   const previewOutcomes=[];
   const approved=parsed.embeddedPlayerMediaSourceLeads
    .filter(x=>x.urlForExactOfficialPrefixProbe!==null).slice(0,6);
   for(const x of approved){
    previewOutcomes.push({kind:x.kind,pathSHA256:x.pathSHA256,
     ...(await limitedMediaPrefix(x.urlForExactOfficialPrefixProbe!))});
   }
   sources.push({bill:spec.bill,state:'PINNED_LRL_ORIGINAL_HTML_SUCCESS',
    sourceURL:spec.lrlURL,originalHTMLByteCount:b.length,
    originalHTMLSHA256:sha(b),mediaPlayerOriginalMetadata:parsed,
    boundedOnlyOfficialHostMediaPrefixChecks:previewOutcomes});
  }catch(e){
   originalFailures++;
   sources.push({bill:spec.bill,state:'PINNED_LRL_ORIGINAL_HTML_FAILED',
    sourceURL:spec.lrlURL,error:errorMessage(e),
    noOriginalAudioOrVideoAuthenticated:true});
  }
 }
 const result={version:'senate-2021-apr08-two-original-lrl-media-stream-player-sources-v1',
  issue:864,observedUTC:new Date().toISOString(),
  originalLRLPagesExpected:2,originalLRLPagesValidated:2-originalFailures,
  originalSourceFailures:originalFailures,
  sources,
  fullOriginalVideoOrAudioDownloaded:false,
  trueMotionDateEstablished:false,
  senatorRecordedVoteChoicesInferred:false,
  noPrivateProductionDatabaseOrForecastOrModelChanges:true,issue864RemainsOpen:true};
 await mkdir(dirname(process.argv[at+1]!),{recursive:true});
 await writeFile(process.argv[at+1]!,JSON.stringify(result,null,2)+'\n','utf8');
 console.log(JSON.stringify({verifiedOfficialMediaPages:2-originalFailures,
  mediaPlayerSourceLeads:sources.length,fullAudioOrVideoDownloaded:0,
  originalMotionDaysAuthenticated:0,sourceErrors:originalFailures}));
 if(originalFailures>0)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});

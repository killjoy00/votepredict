/**
 * #864 one-time ORIGINAL public full-audio binary SHA proof, no transcription.
 *
 * Download exactly four public 2021 Apr 8 Minnesota LRL Senate audio MP3s,
 * each streamed with a strict 160 MiB cap into an ephemeral GitHub runner file.
 * Enforce authentic first original 65,536B prefix SHA and MP3 signature,
 * hash ALL raw original bytes, ffprobe length, securely delete all MP3s.
 *
 * Upload only metadata + SHA. No recording bytes, speaker transcript, named
 * choice rosters, historical evidence import, production database or outreach.
 */
import {createHash} from 'node:crypto';
import {mkdtemp,open,rm,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {
 APR08_FOUR_ORIGINAL_LRL_AUDIO,verifyFirstPinnedApril08AudioPrefix,
 verifyJournalMotionPreservationAcrossAudioSources,
 type April08OriginalAudio
} from '../src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.js';

const PER_RECORDING_MAX=160*1024*1024;
const firstBytesLength=APR08_FOUR_ORIGINAL_LRL_AUDIO.exactFirstPrefixBytes;

function safeError(e:unknown){
 const x=e as {message?:string;cause?:{code?:string};code?:string};
 if(x?.message&&/^(original|HTTP|media|MP3|MP4|ffprobe|Original)/i.test(x.message))
  return x.message.slice(0,180);
 return x?.cause?.code??x?.code??'network_or_source_error';
}
function probeDuration(path:string){
 try{
  const raw=execFileSync('ffprobe',[
   '-v','error','-show_entries','format=duration',
   '-of','default=noprint_wrappers=1:nokey=1',path
  ],{encoding:'utf8',timeout:120_000,maxBuffer:16_384}).trim();
  const seconds=Number(raw);
  return Number.isFinite(seconds)&&seconds>0?Number(seconds.toFixed(3)):null;
 }catch{return null;}
}
async function oneFullOriginal(spec:April08OriginalAudio,tempFolder:string,index:number){
 const fixed=new URL(spec.url);
 if(fixed.protocol!=='https:'||
    fixed.hostname!=='www.lrl.mn.gov'||
    !/^\/audio\/senate\/2021\/cmte_(?:fintrans|jud)_040821[a-b]?\.mp3$/.test(fixed.pathname))
  throw Error('original full 2021 Senate MP3 URL did not meet exact LRL allowlist');
 const res=await fetch(spec.url,{
  headers:{Accept:'audio/mpeg,application/octet-stream',
   'user-agent':'VotePredict-864-historical-2021-original-senate-audio-full-source'},
  credentials:'omit',redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(180000)
 });
 if(res.status!==200||!res.body||new URL(res.url).origin!=='https://www.lrl.mn.gov')
  throw Error('HTTP original full MP3 source unavailable (no complete 200 response)');
 const declaredLength=res.headers.get('content-length');
 const declared=declaredLength!==null?Number(declaredLength):null;
 if(declared!==null&&( !Number.isFinite(declared)||declared>PER_RECORDING_MAX))
  throw Error('original full MP3 declared source length exceeds finite bound');
 const contentType=res.headers.get('content-type');
 const filepath=join(tempFolder,'original-lrl-2021-senate-audio-'+(index+1)+'.mp3');
 const file=await open(filepath,'wx',0o600);
 const hash=createHash('sha256');
 let total=0;
 const prefix:Buffer[]=[];let prefixSize=0;
 try{
  for await(const chunk of res.body){
   const bytes=Buffer.from(chunk);
   total+=bytes.length;
   if(total>PER_RECORDING_MAX)throw Error('original full MP3 actual streaming source size exceeded 160 MiB bound');
   hash.update(bytes);
   if(prefixSize<firstBytesLength){
    const first=bytes.subarray(0,firstBytesLength-prefixSize);
    prefix.push(first);
    prefixSize+=first.length;
   }
   // Handle rare partial writes without ever retaining the original body in memory.
   let offset=0;
   while(offset<bytes.length){
    const result=await file.write(bytes,offset,bytes.length-offset);
    if(result.bytesWritten<1)throw Error('original full source file write unexpectedly short');
    offset+=result.bytesWritten;
   }
  }
 }finally{await file.close();}
 if(total<firstBytesLength)
  throw Error('original full MP3 source shorter than independent first 64KiB proof');
 if(declared!==null&&total!==declared)
  throw Error('original full MP3 streamed total differs from public HTTP Content-Length');
 const check=verifyFirstPinnedApril08AudioPrefix(spec,Buffer.concat(prefix));
 const fullSHA256=hash.digest('hex');
 const duration=probeDuration(filepath);
 return {
  bill:spec.bill,part:spec.part,originalSourceURL:spec.url,
  originalHTTPStatus:res.status,declaredContentType:contentType,
  declaredFullSourceBytes:declared,completeOriginalBytesDownloaded:total,
  entireOriginalMP3SHA256:fullSHA256,
  independentlyVerifiedOriginalFirstPrefixBytes:check.bytes,
  independentlyRevalidatedOriginalFirstPrefixSHA256:check.sha256,
  originalFirstPrefixSignature:check.signature,
  ffprobeFullOriginalAudioDurationSeconds:duration,
  ffprobeDurationIndependentlyObtained:duration!==null,
  originalAudioSourceCompleteBinaryAuthenticityProven:true,
  originalHumanAudioListeningPerformed:false,
  actualDibbleMcEwenPappasMotionContentVerified:false,
  motionOccurredOn:null,
  exactHistoricalPublicBy:null,
  rawSourceMP3UploadedOrCommitted:false
 };
}

async function main(){
 const outAt=process.argv.indexOf('--output');
 if(outAt<0||!process.argv[outAt+1]||process.argv.length!==4)
  throw Error('Pass exactly --output PATH to preserve metadata only');
 const journal=verifyJournalMotionPreservationAcrossAudioSources();
 const tempFolder=await mkdtemp(join(tmpdir(),'votepredict-apr08-2021-public-audio-'));
 const rows:unknown[]=[];let sourceFailures=0;
 try{
  for(const [i,spec] of APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.entries()){
   try{rows.push({status:'FULL_ORIGINAL_AUDIO_BINARY_AUTHENTICATED',
      ...(await oneFullOriginal(spec,tempFolder,i))});
   }catch(e){
    sourceFailures++;
    rows.push({status:'ORIGINAL_FULL_AUDIO_BINARY_ACQUISITION_FAILED',
     bill:spec.bill,part:spec.part,url:spec.url,
     sourceFailure:safeError(e),didNotAssertMissingHearing:true,
     audioContentsVerified:false,motionOccurredOn:null});
   }
  }
 }finally{
  await rm(tempFolder,{recursive:true,force:true});
 }
 const result={
  schemaVersion:'senate-2021-apr08-four-lrl-original-mp3-full-binary-source-audit-v1',
  issue:864,
  auditedAtUTC:new Date().toISOString(),
  originalMediaPageMeetingDay:'2021-04-08',
  journalReportedDay:'2021-04-12',
  firstOriginalPrefixRunId:APR08_FOUR_ORIGINAL_LRL_AUDIO.originalFirstRunId,
  mediaSourcesExpected:4,mediaSourcesFullyAuthenticated:4-sourceFailures,
  originalSourceFailures:sourceFailures,
  separateJournalMotionBoundary:journal,
  fullOriginalAudioSources:rows,
  completeAudioBinariesRemovedFromEphemeralRunner:true,
  rawMP3OrCaptionOrSenatorVoteSidesIncludedInArtifact:false,
  historicalMotionDayProvenFromAudio:false,
  readOnlyNoProductionDatabaseOrModelsForecastsFloorOr2027:true,
  issue864RemainsOpen:true
 };
 await mkdir(dirname(process.argv[outAt+1]!),{recursive:true});
 await writeFile(process.argv[outAt+1]!,JSON.stringify(result,null,2)+'\n','utf8');
 console.log(JSON.stringify({
  expected:4,fullyAuthenticated:4-sourceFailures,
  errors:sourceFailures,recordingsUploaded:0,modelsUpdated:0,sourceMembersInferred:0
 }));
 if(sourceFailures>0)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});

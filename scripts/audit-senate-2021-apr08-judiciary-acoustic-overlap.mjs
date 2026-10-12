/**
 * #864 - original Apr 8, 2021 Minnesota Senate Judiciary audio acoustic overlap.
 * This authenticates each original full source before local PCM comparison.
 * Acoustic correlation is NOT an authenticated amendment, roll call or date.
 * Only hashes/timing/correlation metadata leave the ephemeral runner.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,open,mkdtemp,mkdir,rm,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE_PROOF=join(ROOT,'docs/evaluation/source-proof/senate-2021-apr08-four-lrl-whole-mp3-strict-second-original-sha-durations-success.json');
const MAX_SOURCE_BYTES=160*1024*1024;
const FIRST_BYTES=65536;
const SAMPLE_RATE=1000;
const FEATURE_SAMPLES=125;
const CLIP_SECONDS=36;
const CUES=[3503,4004,4943]; // untrusted auto-caption leads, NOT vote times
const EXPECTED=[
 {part:'transportation',bill:'SF1159',file:'cmte_fintrans_040821.mp3',sha:'ec5f1ca5183ec0e9b40dfa9f5e30c0b3ae2fc13afefcd935856715430013a8ef',size:118836368,prefix:'8e2f01c874816f79811facc762146232f34d044a5db1cefecda4795dce04103f',duration:8179.357},
 {part:'judiciary-first',bill:'SF970',file:'cmte_jud_040821.mp3',sha:'97cbe4438cb4f541f2202cb53a27f72098152107617fe4e21622227b79af9cbc',size:106416620,prefix:'74b5c8c5580a805dfdebfbef803df02c0715e04075ba490983f38ec55e0b455a',duration:6651.037},
 {part:'judiciary-second',bill:'SF970',file:'cmte_jud_040821a.mp3',sha:'818e8ddcaad73674444dd39d8033a9887ffc4dadc1e95009817539fe65f91013',size:116669459,prefix:'0930c662d0b95ad73b661e6fd37f1549e6d64704d55d3c617ae2c3d14682f4f1',duration:6651.011},
 {part:'judiciary-third',bill:'SF970',file:'cmte_jud_040821b.mp3',sha:'160483667a070a19b6d5b33df8cc1457a2c97a2ac16de831a0882a82a4aea028',size:85774553,prefix:'b777ba4adde388217111376ecedae4d37f353875ffa52846dbb3e67630e514d7',duration:5073.006}
];
function assert(ok,message){if(!ok)throw Error(message);}
export function checkImmutableSourceManifest(proof){
 assert(proof?.issue===864&&proof?.secondIndependentCompleteSource?.runId===38188288307,'original second-proof identity mismatch');
 assert(proof?.secondIndependentCompleteSource?.sourceFailures===0,'historical full-source proof incomplete');
 assert(proof?.exactOriginalAudio?.length===4,'source count mismatch');
 for(let i=0;i<4;i++){
  const s=EXPECTED[i],r=proof.exactOriginalAudio[i];
  assert(r.sourcePart===s.part&&r.bill===s.bill,'source order/identity mismatch');
  assert(r.url==='https://www.lrl.mn.gov/audio/senate/2021/'+s.file,'unexpected original source URL');
  assert(r.firstAndSecondOriginalFullSHA256===s.sha&&r.firstAndSecondOriginalFullBytes===s.size,'original whole MP3 pinned content mismatch');
  assert(r.firstAndSecond64KiBSourcePrefixSHA256===s.prefix,'original MP3 pinned prefix mismatch');
  assert(Math.abs(r.originalAudioDurationSeconds-s.duration)<0.001,'pinned duration mismatch');
 }
 assert(proof.holds.individualDibbleMcEwenPappasMotionOccurredOn===null,'motion-specific day must remain null');
 return true;
}
function safeSourceFailure(e){
 const s=String(e instanceof Error?e.message:e);
 const codes=['source_http_status','source_redirect_rejected','source_body_unavailable',
  'source_content_length_mismatch','source_size_cap','source_timeout',
  'source_prefix_sha_mismatch','source_full_sha_mismatch','source_mp3_signature_mismatch',
  'source_media_duration_mismatch','source_audio_decode_failed','source_audio_decode_oversize'];
 return codes.find(x=>s.includes(x))??'source_or_processing_error';
}
async function acquirePinnedMP3(spec,tempFolder){
 const url='https://www.lrl.mn.gov/audio/senate/2021/'+spec.file;
 let res;
 try{res=await fetch(url,{headers:{Accept:'audio/mpeg','User-Agent':'VotePredict-864-2021-Original-Acoustic-Research'},redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(240000)});}
 catch(e){throw Error('source_timeout: request failed');}
 assert(res.status===200,'source_http_status');
 assert(res.url===url,'source_redirect_rejected');
 assert(res.body,'source_body_unavailable');
 const raw=res.headers.get('content-length'),declared=raw===null?null:Number(raw);
 assert(declared!==null&&Number.isSafeInteger(declared)&&declared>FIRST_BYTES&&declared<=MAX_SOURCE_BYTES&&declared===spec.size,'source_content_length_mismatch');
 const ctype=res.headers.get('content-type')??'';
 assert(/^audio\/(mpeg|mp3)(?:\s*;|\s*$)/i.test(ctype),'source_http_status: wrong audio content type');
 const path=join(tempFolder,spec.file);
 const file=await open(path,'wx',0o600);
 const hash=createHash('sha256');
 const prefix=[];let prefixLength=0,bytes=0;
 try{
  for await(const chunk of res.body){
   bytes+=chunk.byteLength;
   assert(bytes<=MAX_SOURCE_BYTES&&bytes<=spec.size,'source_size_cap');
   hash.update(chunk);
   if(prefixLength<FIRST_BYTES){const part=chunk.subarray(0,FIRST_BYTES-prefixLength);prefix.push(Buffer.from(part));prefixLength+=part.length;}
   let start=0;
   while(start<chunk.byteLength){
    const {bytesWritten}=await file.write(chunk,start,chunk.byteLength-start);
    assert(bytesWritten>0,'source_body_unavailable');
    start+=bytesWritten;
   }
  }
 }finally{await file.close();}
 assert(bytes===declared&&bytes===spec.size,'source_content_length_mismatch');
 const p=Buffer.concat(prefix);
 assert(p.length===FIRST_BYTES,'source_prefix_sha_mismatch');
 assert(p.toString('ascii',0,3)==='ID3'||(p[0]===255&&(p[1]&224)===224),'source_mp3_signature_mismatch');
 assert(createHash('sha256').update(p).digest('hex')===spec.prefix,'source_prefix_sha_mismatch');
 assert(hash.digest('hex')===spec.sha,'source_full_sha_mismatch');
 const stdout=execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path],{encoding:'utf8',timeout:120000,maxBuffer:16384}).trim();
 const duration=Number(stdout);
 assert(Number.isFinite(duration)&&Math.abs(duration-spec.duration)<=0.75,'source_media_duration_mismatch');
 return {path,verified:{bill:spec.bill,sourcePart:spec.part,sourceURL:url,
  fullOriginalBytes:bytes,fullOriginalSHA256:spec.sha,prefixSHA256:spec.prefix,
  verifiedAgainstTwoOriginalSourceRuns:true,ffprobeDurationSeconds:Number(duration.toFixed(3)),
  rawAudioCommittedOrUploaded:false}};
}
function decodeToPCM(sourcePath,dest){
 try{execFileSync('ffmpeg',['-nostdin','-hide_banner','-v','error','-i',sourcePath,
  '-map','0:a:0','-vn','-sn','-dn','-ac','1','-ar',String(SAMPLE_RATE),
  '-f','s16le','-y',dest],{timeout:240000,maxBuffer:1000000});}
 catch{throw Error('source_audio_decode_failed');}
}
export function makeAudioFeatures(pcm){
 assert(Buffer.isBuffer(pcm)&&pcm.length%2===0,'PCM must be 16-bit interleaved mono');
 const count=Math.floor(pcm.length/(FEATURE_SAMPLES*2));
 const fine=new Float64Array(count);
 for(let i=0;i<count;i++){
  let sum=0;
  const off=i*FEATURE_SAMPLES*2;
  for(let j=0;j<FEATURE_SAMPLES;j++){const v=pcm.readInt16LE(off+2*j);sum+=v*v;}
  fine[i]=Math.log1p(Math.sqrt(sum/FEATURE_SAMPLES)/100);
 }
 const coarse=new Float64Array(Math.floor(fine.length/8));
 for(let i=0;i<coarse.length;i++){
  let sum=0;for(let j=0;j<8;j++)sum+=fine[i*8+j];
  coarse[i]=sum/8;
 }
 return {pcm,fine,coarse,durationSeconds:pcm.length/(SAMPLE_RATE*2)};
}
function pearsonAt(a,ai,b,bi,len){
 if(ai<0||bi<0||ai+len>a.length||bi+len>b.length)return -1;
 let ax=0,bx=0,a2=0,b2=0,xy=0;
 for(let i=0;i<len;i++){
  const x=a[ai+i],y=b[bi+i];
  ax+=x;bx+=y;a2+=x*x;b2+=y*y;xy+=x*y;
 }
 const den=Math.sqrt((a2-ax*ax/len)*(b2-bx*bx/len));
 if(!Number.isFinite(den)||den<1e-6)return -1;
 return Math.max(-1,Math.min(1,(xy-ax*bx/len)/den));
}
function mostPromisingSecondStarts(a,b,at,len,count=7){
 const picks=[];
 for(let j=0;j+len<=b.length;j++){
  const score=pearsonAt(a,at,b,j,len);
  if(score<0.45)continue;
  if(picks.length>=count&&score<=picks[picks.length-1].score)continue;
  picks.push({start:j,score});
  picks.sort((x,y)=>y.score-x.score);
  if(picks.length>count)picks.pop();
 }
 return picks;
}
function precisePCMCorrelation(sourcePCM,targetPCM,sourceAtSeconds,targetAtSeconds){
 // Confirm actual decoded PCM waveform, not simply a similar loudness pattern.
 const clipSamples=4000;
 const srcStart=Math.round((sourceAtSeconds+14)*SAMPLE_RATE);
 const predicted=Math.round((targetAtSeconds+14)*SAMPLE_RATE);
 const srcCount=sourcePCM.length/2,dstCount=targetPCM.length/2;
 if(srcStart<0||srcStart+clipSamples>srcCount)return {score:-1,shiftSeconds:null};
 const a=new Float64Array(clipSamples);
 let mean=0;
 for(let i=0;i<clipSamples;i++){a[i]=sourcePCM.readInt16LE(2*(srcStart+i));mean+=a[i];}
 mean/=clipSamples;
 let aNormSquared=0;
 for(let i=0;i<clipSamples;i++){a[i]-=mean;aNormSquared+=a[i]*a[i];}
 if(aNormSquared<1e-8)return {score:-1,shiftSeconds:null};
 const min=Math.max(0,predicted-875),max=Math.min(dstCount-clipSamples,predicted+875);
 if(max<min)return {score:-1,shiftSeconds:null};
 const n=max-min+clipSamples;
 const b=new Float64Array(n),prefix=new Float64Array(n+1),prefixSq=new Float64Array(n+1);
 for(let i=0;i<n;i++){
  const v=targetPCM.readInt16LE((min+i)*2);
  b[i]=v;prefix[i+1]=prefix[i]+v;prefixSq[i+1]=prefixSq[i]+v*v;
 }
 let best=-1,bestStart=null;
 for(let begin=0;begin<=max-min;begin++){
  const sum=prefix[begin+clipSamples]-prefix[begin];
  const sq=prefixSq[begin+clipSamples]-prefixSq[begin]-sum*sum/clipSamples;
  if(sq<1e-8)continue;
  let dot=0;for(let i=0;i<clipSamples;i++)dot+=a[i]*b[begin+i];
  const corr=dot/Math.sqrt(aNormSquared*sq);
  if(corr>best){best=corr;bestStart=min+begin;}
 }
 return {score:Number(best.toFixed(4)),shiftSeconds:bestStart===null?null:
  Number(((bestStart-predicted)/SAMPLE_RATE).toFixed(3))};
}
export function matchOneWindow(source,target,startSeconds){
 const srcAt=Math.floor(startSeconds),len=CLIP_SECONDS;
 if(srcAt<0||srcAt+len>source.coarse.length)return {sourceAtSeconds:srcAt,status:'OUT_OF_SOURCE_RANGE'};
 const candidates=mostPromisingSecondStarts(source.coarse,target.coarse,srcAt,len);
 let best=null;
 for(const cand of candidates){
  const sf=srcAt*8;
  for(let delta=-32;delta<=32;delta++){
   const tf=cand.start*8+delta;
   const fineScore=pearsonAt(source.fine,sf,target.fine,tf,len*8);
   if(fineScore<0.78||(best&&fineScore<=best.energyCorrelation))continue;
   best={sourceAtSeconds:srcAt,targetAtSeconds:tf/8,
    energyCorrelation:Number(fineScore.toFixed(4)),coarseCorrelation:Number(cand.score.toFixed(4))};
  }
 }
 if(!best)return {sourceAtSeconds:srcAt,status:'NO_STRONG_ENVELOPE_MATCH'};
 const wave=precisePCMCorrelation(source.pcm,target.pcm,srcAt,best.targetAtSeconds);
 const supported=best.energyCorrelation>=0.88&&wave.score>=0.84;
 const offset=best.targetAtSeconds-srcAt+(wave.shiftSeconds??0);
 return {...best,decodedPCMCorrelation:wave.score,
  alignedOffsetSeconds:Number(offset.toFixed(3)),acousticMatchSupported:supported,
  status:supported?'SAMPLED_ACOUSTIC_WINDOW_MATCH':'WEAK_OR_MISMATCHED_PCM'};
}
export function compareAudioParts(source,target,options={}){
 const len=source.durationSeconds;
 const scheduled=(options.anchorSeconds??[0.12,0.28,0.44,0.60,0.76].map(f=>Math.floor(f*len)));
 const captionTimes=options.includeCaptionCues?CUES:[];
 const anchors=[...new Set([...scheduled,...captionTimes.map(t=>t-18)])]
  .filter(t=>t>=0&&t+CLIP_SECONDS<=len);
 const records=anchors.map(at=>matchOneWindow(source,target,at));
 const positives=records.filter(p=>p.acousticMatchSupported);
 let corroboration=[];
 for(const record of positives){
  const group=positives.filter(p=>Math.abs(p.alignedOffsetSeconds-record.alignedOffsetSeconds)<=2&&
    Math.abs(p.sourceAtSeconds-record.sourceAtSeconds)>=CLIP_SECONDS);
  if(group.length>corroboration.length)corroboration=[record,...group];
 }
 const independentMatches=corroboration.length,matching=independentMatches>=2;
 const offset=matching?Number((corroboration.reduce((a,r)=>a+r.alignedOffsetSeconds,0)/independentMatches).toFixed(3)):null;
 return {
  state:matching?'MULTIPLE_INDEPENDENT_SAMPLED_WINDOWS_ACOUSTICALLY_ALIGNED':'FULL_SESSION_OVERLAP_NOT_PROVEN',
  multipleIndependentSpeechSamplesConfirmed:matching,
  strongestSupportedConsistentWindowCount:independentMatches,
  sampledAlignmentOffsetSeconds:offset,
  sourceToTargetTimecodeMappingIsOnlyAReviewLead:true,
  aNegativeResultDoesNotProveNoOtherOverlap:true,
  partialAcousticAgreementDoesNotEstablishEntireFilesAreDuplicates:true,
  timedOriginalCaptionCuesAreNotAmendmentVotes:true,
  cueWindowMatches:records.filter(r=>captionTimes.some(t=>Math.abs(r.sourceAtSeconds-(t-18))<1)),
  sampleWindows:records.filter(r=>!captionTimes.some(t=>Math.abs(r.sourceAtSeconds-(t-18))<1))
 };
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1]||args[1].startsWith('-'))
  throw Error('Use exactly --output PATH (metadata only; no raw audio outputs)');
 const proof=JSON.parse(await readFile(SOURCE_PROOF,'utf8'));
 checkImmutableSourceManifest(proof);
 const outPath=resolve(args[1]);
 const tmp=await mkdtemp(join(tmpdir(),'votepredict-864-apr08-original-acoustics-'));
 const report={
  schemaVersion:'senate-2021-apr08-judiciary-three-original-acoustic-overlap-research-v1',
  issue:864,observedAtUTC:new Date().toISOString(),
  priorIndependentFullSourceRuns:[38187776601,38188288307],
  officialHearingArchiveDay:'2021-04-08',journalReportDay:'2021-04-12',
  exactOriginalAudioSourceFullShaValidations:[],completeOriginalAudioSourceFailures:[],
  judiciaryAcousticSampleComparisons:[],sourceRecordedCaptionClueSeconds:CUES,
  allThreeOriginalAmendmentMotionDates:[
   {bill:'SF1159',mover:'Dibble',reportedVote:'4 YEA / 6 NAY, not adopted',audioMotionRollVerified:false,occurred_on:null},
   {bill:'SF1159',mover:'McEwen',reportedVote:'4 YEA / 6 NAY, not adopted',audioMotionRollVerified:false,occurred_on:null},
   {bill:'SF970',mover:'Pappas',reportedVote:'3 YEA / 6 NAY, not adopted',audioMotionRollVerified:false,occurred_on:null}
  ],
  acousticFingerprintIsNotSpeechTranscriptionOrMotionProof:true,humanListeningPerformed:false,
  exactFirstPublicBy:null,
  uploadedContents:'only original-source SHA, durations, acoustical alignment scores and candidate timecodes; no media or full captions or transcript',
  completeSourceMP3AndPCMDeletedFromEphemeralRunner:false,
  productionDatabaseOrModelWrites:false,issue864RemainsOpen:true
 };
 const sounds=new Map();let failure=false;
 try{
  for(const spec of EXPECTED){
   try{
    const {path,verified}=await acquirePinnedMP3(spec,tmp);
    report.exactOriginalAudioSourceFullShaValidations.push(verified);
    if(spec.part!=='transportation'){
     const pcmPath=join(tmp,spec.file+'.pcm');
     decodeToPCM(path,pcmPath);
     const info=await stat(pcmPath);
     assert(info.size>5000000&&info.size<40*1024*1024,'source_audio_decode_oversize');
     sounds.set(spec.part,makeAudioFeatures(await readFile(pcmPath)));
     await rm(pcmPath,{force:true});
    }
    await rm(path,{force:true});
   }catch(e){
    failure=true;
    report.completeOriginalAudioSourceFailures.push({bill:spec.bill,sourcePart:spec.part,code:safeSourceFailure(e),sourceUnavailableIsNotProofMeetingAbsent:true});
   }
  }
  if(!failure){
   for(const [a,b] of [['judiciary-first','judiciary-second'],['judiciary-first','judiciary-third'],['judiciary-second','judiciary-third']]){
    const z=compareAudioParts(sounds.get(a),sounds.get(b),{includeCaptionCues:a==='judiciary-first'});
    report.judiciaryAcousticSampleComparisons.push({sourcePart:a,targetPart:b,...z});
   }
  }
 }catch(e){failure=true;report.completeOriginalAudioSourceFailures.push({code:safeSourceFailure(e),stage:'original-audio-processing',noMotionDayPromoted:true});}
 finally{await rm(tmp,{recursive:true,force:true});report.completeSourceMP3AndPCMDeletedFromEphemeralRunner=true;}
 await mkdir(dirname(outPath),{recursive:true});
 await writeFile(outPath,JSON.stringify(report,null,2)+'\n','utf8');
 console.log(JSON.stringify({independentlyVerifiedFullSources:report.exactOriginalAudioSourceFullShaValidations.length,
  sourceFailures:report.completeOriginalAudioSourceFailures.length,
  sourceAudioPairsSampled:report.judiciaryAcousticSampleComparisons.length,
  suspectedOverlapPairs:report.judiciaryAcousticSampleComparisons.filter(x=>x.multipleIndependentSpeechSamplesConfirmed).length,
  actualAmendmentVotesHeard:0,originalAudioFilesPersisted:0,productionWrites:0}));
 if(failure)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(safeSourceFailure(e));process.exitCode=1;});
}

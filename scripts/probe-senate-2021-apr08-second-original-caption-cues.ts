/**
 * Independent source reacquisition of Apr 8 2021 Judiciary auto captions.
 * Strict SHA / byte pin from first independently obtained original.
 * Additional unavailable-by-first-pass SF1159 and SF970-part2 captions are
 * probed once each, but never reported as certified motion evidence.
 *
 * Writes metadata/timestamps/digests only. No whole captions, MP4, audio,
 * member vote-side list, DB, output eligibility or government office contact.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {
 APR08_JUDICIARY_CAPTION_ORIGINAL,
 verifySecondOriginalJudiciaryCaptionBytes,
 summarizeApril08PappasCaptionUntrustedCues
} from '../src/evidence/senate-2021-apr08-judiciary-caption-original-cue-review.js';
import {summarizeUntrustedOriginalCaption} from
 '../src/evidence/senate-2021-apr08-original-media-source-gates.js';

const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const OPTIONAL=[
 {
  bill:'SF1159',part:'only 2021 Apr 8 transportation segment',
  url:'https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=cmte_fintrans_040821.mp4',
  movers:['Dibble','McEwen']
 },
 {
  bill:'SF970',part:'second 2021 Apr 8 judiciary segment',
  url:'https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=cmte_jud_040821b.mp4',
  movers:['Pappas']
 }
] as const;

async function boundedOfficialCaption(url:string,maxBytes=5_000_000){
 const parsed=new URL(url);
 if(parsed.origin!=='https://www.lrl.mn.gov'||
   parsed.pathname!=='/media/media_functions'||
   parsed.searchParams.get('type')!=='getCaption'||
   !/^(cmte_jud_040821|cmte_jud_040821b|cmte_fintrans_040821)\.mp4$/
       .test(parsed.searchParams.get('strmp4')??''))
  throw Error('Not an allowlisted original April 8 LRL historical caption source');
 const response=await fetch(url,{
   headers:{Accept:'text/html,application/xhtml+xml',
    Referer:'https://www.lrl.mn.gov/media/',
    'user-agent':'VotePredict-864-2021-original-caption-strict-second-acquisition'},
   credentials:'omit',redirect:'follow',cache:'no-store',
   signal:AbortSignal.timeout(40_000)
 });
 if(new URL(response.url).hostname!=='www.lrl.mn.gov')
  throw Error('Original caption unexpected redirect host');
 if(!response.ok)throw Error('original caption HTTP '+response.status);
 if(!response.body)throw Error('Original caption response without body');
 const chunks:Buffer[]=[];let bytes=0;
 for await(const piece of response.body){
  const b=Buffer.from(piece);bytes+=b.length;
  if(bytes>maxBytes)throw Error('Original caption exceeded bounded byte cap');
  chunks.push(b);
 }
 const body=Buffer.concat(chunks);
 if(body.length<500)throw Error('Original caption response implausibly short');
 return {body,originalBytes:body.length,originalSHA256:digest(body),
  observedAtUTC:new Date().toISOString()};
}
function errorSummary(error:unknown){
 const e=error as {message?:string;cause?:{code?:string};code?:string};
 const message=e?.message??'';
 const code=e?.cause?.code??e?.code;
 if(/^original caption HTTP \d{3}$/.test(message))return message;
 if(/source|redirect|cap|short|size|SHA-256|byte/.test(message))
  return message.slice(0,180);
 return code??'network_or_source_error';
}
async function main(){
 const args=process.argv;
 const at=args.indexOf('--output');
 if(at<0||!args[at+1]||args.length!==4)
  throw Error('Supply only --output FILE for first-pass-failure-preserving JSON');
 const report:{
  schemaVersion:string;originalStrictSource:unknown;
  otherFirstPassUnavailableCaptionRechecks:unknown[];
  strictSameOriginalSHAIndependentSuccess:boolean;
  noRecordingAudioOrVideoAuthenticated:boolean;
  noMotionDateOrMemberVotePromoted:boolean;
 }={
  schemaVersion:APR08_JUDICIARY_CAPTION_ORIGINAL.schemaVersion,
  originalStrictSource:null,otherFirstPassUnavailableCaptionRechecks:[],
  strictSameOriginalSHAIndependentSuccess:false,
  noRecordingAudioOrVideoAuthenticated:true,
  noMotionDateOrMemberVotePromoted:true
 };
 let mustFail=false;
 try{
  const src=await boundedOfficialCaption(APR08_JUDICIARY_CAPTION_ORIGINAL.originalCaptionURL);
  const matched=verifySecondOriginalJudiciaryCaptionBytes(src.body);
  const cues=summarizeApril08PappasCaptionUntrustedCues(src.body.toString('utf8'));
  if(cues.allCaptionTableRows!==APR08_JUDICIARY_CAPTION_ORIGINAL.firstPassTableRows||
    cues.timestampedRows!==APR08_JUDICIARY_CAPTION_ORIGINAL.firstPassDataTimeRows||
    cues.sameRowMoverAndAmendmentOrRollCall!==
     APR08_JUDICIARY_CAPTION_ORIGINAL.firstPassSameRowMoverAmendmentOrRollCallCueCount)
   throw Error('Original 2021 Judiciary automatic caption source structure or cue count mismatched');
  report.originalStrictSource={
   state:'SECOND_ORIGINAL_SHA_STRICT_SUCCESS',
   sourceURL:APR08_JUDICIARY_CAPTION_ORIGINAL.originalCaptionURL,
   originalBytes:matched.bytes,originalSHA256:matched.sha256,
   observedAtUTC:src.observedAtUTC,
   samePinnedOriginalCaptionBytesAndSHA:true,captionCues:cues,
   originalJournalMotionNamedPappasVerifiedSeparately:true,
   actualPappasAmendmentMotionHeardOnVideo:false
  };
  report.strictSameOriginalSHAIndependentSuccess=true;
 }catch(e){
  report.originalStrictSource={
   state:'SECOND_ORIGINAL_SHA_STRICT_FAILURE',
   sourceURL:APR08_JUDICIARY_CAPTION_ORIGINAL.originalCaptionURL,
   reason:errorSummary(e),
   noOriginalMotionOrSenatorVotingSideProven:true
  };
  mustFail=true;
 }
 for(const lead of OPTIONAL){
  try{
   const source=await boundedOfficialCaption(lead.url);
   const summary=summarizeUntrustedOriginalCaption(source.body.toString('utf8'),lead.movers);
   if(summary.dataTimeCount<10||summary.tableRowCount<10)
    throw Error('Original optional caption response has no usable timed rows');
   report.otherFirstPassUnavailableCaptionRechecks.push({
    bill:lead.bill,part:lead.part,sourceURL:lead.url,
    state:'NEW_FIRST_SOURCE_ORIGINAL_AUTO_CAPTION_ACQUIRED',
    originalCaptionBytes:source.originalBytes,
    originalCaptionSHA256:source.originalSHA256,
    observedAtUTC:source.observedAtUTC,
    untrustedCaptionMetadata:summary,
    independentSecondOriginalSHAReconfirmation:false,
    actualMotionTimestampOrSpeakerVerified:false
   });
  }catch(e){
   report.otherFirstPassUnavailableCaptionRechecks.push({
    bill:lead.bill,part:lead.part,sourceURL:lead.url,
    state:'UNAVAILABLE_OR_NO_USABLE_CAPTION',
    reason:errorSummary(e),
    actualMotionDateVerified:null
   });
  }
 }
 await mkdir(dirname(args[at+1]!),{recursive:true});
 await writeFile(args[at+1]!,JSON.stringify(report,null,2)+'\n','utf8');
 console.log(JSON.stringify({
  strictOriginalSuccess:report.strictSameOriginalSHAIndependentSuccess,
  optionalNewSourceCaptions:report.otherFirstPassUnavailableCaptionRechecks.filter(
   (s:unknown)=>(s as {state:string}).state==='NEW_FIRST_SOURCE_ORIGINAL_AUTO_CAPTION_ACQUIRED'
  ).length,
  originalMotionDatesAuthenticated:0,productionWrites:0
 }));
 if(mustFail)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});

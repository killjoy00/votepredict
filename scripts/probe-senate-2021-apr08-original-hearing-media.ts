/**
 * #864 one-time independent original 2021 April 8 Senate committee hearing
 * media accessibility/caption provenance only. No private DB / audio uploads.
 *
 * Exactly two fixed LRL dated media pages, three fixed Senate Granicus
 * agendas and three 64KiB candidate audio-prefix HTTP range checks.
 *
 * No listed media/automatic captions counted as actual member-vote proof.
 */
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {
  APR08_ORIGINAL_MEDIA,inspectApril08LrlMediaPage,
  inspectApril08OriginalAgenda,summarizeUntrustedOriginalCaption,
  type April08MediaCase
} from '../src/evidence/senate-2021-apr08-original-media-source-gates.js';

const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const maxPrefix=65536;

function sourceError(e:unknown){
  const err=e as {message?:string;cause?:{code?:string};code?:string};
  const message=err?.message??String(e);
  const code=err?.cause?.code??err?.code??'';
  if(/^HTTP [0-9]{3}$/.test(message))return message;
  if(/redirect|unexpected host|source cap|timeout|out of bounds/i.test(message))
    return message.slice(0,140);
  return code||'network_or_source_error';
}
async function fixedPublicHTML(url:string,maxBytes:number,expectedHost:string){
  const r=await fetch(url,{
    redirect:'follow',cache:'no-store',credentials:'omit',
    headers:{Accept:'text/html,application/xhtml+xml','user-agent':'VotePredict-864-2021-historical-public-media-source-audit'},
    signal:AbortSignal.timeout(30000)
  });
  if(new URL(r.url).hostname!==expectedHost)
    throw Error('unexpected host or redirect');
  if(!r.ok)throw Error('HTTP '+r.status);
  if(!r.body)throw Error('no source body');
  let size=0;const chunks:Buffer[]=[];
  for await(const next of r.body){
    const bytes=Buffer.from(next);size+=bytes.length;
    if(size>maxBytes)throw Error('source cap exceeded');
    chunks.push(bytes);
  }
  const b=Buffer.concat(chunks);
  if(b.length<350)throw Error('original source too short');
  return {
    html:b.toString('utf8'),bytes:b.length,
    sha256:digest(b),originalObservedUTC:new Date().toISOString(),
    url:r.url
  };
}
async function exactAudioPrefix(url:string){
  const result:{
    candidateURL:string;responseCode:number|null;contentType:string|null;
    declaredLength:string|null;rangeHonored:boolean;
    prefixBytes:number;prefixSHA256:string|null;signature:string;
    sourceState:string;failure:string|null;completeAudioDownloaded:false;
    mediaIdentityVerifiedFromThisPrefix:false;
  }={
    candidateURL:url,responseCode:null,contentType:null,declaredLength:null,
    rangeHonored:false,prefixBytes:0,prefixSHA256:null,
    signature:'unknown',sourceState:'request_not_completed',failure:null,
    completeAudioDownloaded:false,mediaIdentityVerifiedFromThisPrefix:false
  };
  try{
    const response=await fetch(url,{
      redirect:'error',credentials:'omit',cache:'no-store',
      headers:{Accept:'audio/mpeg','Range':'bytes=0-65535',
       'user-agent':'VotePredict-864-2021-historical-public-media-source-audit'},
      signal:AbortSignal.timeout(12000)
    });
    result.responseCode=response.status;
    result.contentType=response.headers.get('content-type');
    result.declaredLength=response.headers.get('content-length');
    result.rangeHonored=response.status===206 &&
      /^bytes\s+0-\d+\/(?:\d+|\*)$/i.test(response.headers.get('content-range')??'');
    if(![200,206].includes(response.status)){
      result.sourceState='HTTP_UNAVAILABLE';
      await response.body?.cancel().catch(()=>undefined);
      return result;
    }
    if(!response.body)throw Error('no audio-prefix body');
    const reader=response.body.getReader();const parts:Buffer[]=[];let length=0;
    try{
      while(length<maxPrefix){
        const next=await reader.read();
        if(next.done)break;
        const b=Buffer.from(next.value);
        if(b.length){
          const slice=b.subarray(0,maxPrefix-length);
          parts.push(slice);length+=slice.length;
        }
      }
    }finally{
      await reader.cancel().catch(()=>undefined);
    }
    const data=Buffer.concat(parts);
    result.prefixBytes=data.length;result.prefixSHA256=data.length?digest(data):null;
    result.signature=data.subarray(0,3).toString('ascii')==='ID3'
      ?'id3':data.length>1&&data[0]===0xff&&(data[1]&0xe0)===0xe0?'mpeg_frame':'not_mp3';
    result.sourceState=data.length>=512&&result.signature!=='not_mp3'
      ?'MP3_PREFIX_ONLY':'NONAUDIO_OR_EMPTY';
  }catch(e){
    result.sourceState='REQUEST_ERROR';result.failure=sourceError(e);
  }
  return result;
}

async function auditCase(spec:April08MediaCase){
  const report:{
    bill:string;committee:string;mediaSourceProbeDay:string;
    lrlPage:unknown;granicusAgendas:unknown[];granicusAudioPrefixes:unknown[];
    lrlCaptionSourceProbes:unknown[];
    originalJournalAmendmentMoverNames:string[];
    exactMotionDateVerified:null;actualSenatorMemberVotesInferred:false;
    originalAudioFullyAuthenticated:false;
  }={
    bill:spec.bill,committee:spec.committee,mediaSourceProbeDay:'2021-04-08',
    lrlPage:null,granicusAgendas:[],granicusAudioPrefixes:[],
    lrlCaptionSourceProbes:[],
    originalJournalAmendmentMoverNames:[...spec.sourceMovers],
    exactMotionDateVerified:null,actualSenatorMemberVotesInferred:false,
    originalAudioFullyAuthenticated:false
  };
  try{
    const page=await fixedPublicHTML(spec.lrlURL,2_000_000,'www.lrl.mn.gov');
    const parsed=inspectApril08LrlMediaPage(page.html,spec);
    report.lrlPage={state:'VERIFIED_DATED_MEDIA_INDEX_PAGE',originalPageBytes:page.bytes,
      originalPageSHA256:page.sha256,firstSourceObservedUTC:page.originalObservedUTC,
      ...parsed,candidateCaptionRequests:undefined};
    for(const c of parsed.candidateCaptionRequests.slice(0,2)){
      try{
        const cap=await fixedPublicHTML(c.endpointUrl,5_000_000,'www.lrl.mn.gov');
        report.lrlCaptionSourceProbes.push({
          originalCaptionEndpoint:c.endpointUrl,state:'AUTOMATED_CAPTION_PAYLOAD_ACQUIRED',
          originalPayloadBytes:cap.bytes,originalPayloadSHA256:cap.sha256,
          captionMetadata:summarizeUntrustedOriginalCaption(cap.html,spec.sourceMovers),
          noSpeechAudioOrSpeakerAttributionAuthenticated:true
        });
      }catch(e){
        report.lrlCaptionSourceProbes.push({
          originalCaptionEndpoint:c.endpointUrl,state:'CAPTION_UNAVAILABLE',
          reason:sourceError(e)
        });
      }
    }
  }catch(e){
    report.lrlPage={state:'SOURCE_UNAVAILABLE_OR_IDENTITY_HOLD',
      sourceURL:spec.lrlURL,error:sourceError(e),
      originalMeetingPageVerified:false};
  }
  for(const clip of spec.agendas){
    try{
      const original=await fixedPublicHTML(clip.url,1_500_000,'mnsenate.granicus.com');
      const parsed=inspectApril08OriginalAgenda(original.html,spec,clip);
      report.granicusAgendas.push({
        state:'AGENDA_DATE_COMMITTEE_BILL_VERIFIED',
        originalHTMLBytes:original.bytes,originalHTMLSHA256:original.sha256,
        observedAtUTC:original.originalObservedUTC,...parsed
      });
    }catch(e){
      report.granicusAgendas.push({state:'AGENDA_UNAVAILABLE_OR_IDENTITY_HOLD',
        clipId:clip.clipId,sourceURL:clip.url,reason:sourceError(e)});
    }
    report.granicusAudioPrefixes.push({
      clipId:clip.clipId, ...(await exactAudioPrefix(clip.audio))
    });
  }
  return report;
}
async function main(){
  const at=process.argv.indexOf('--output');
  if(at<0||!process.argv[at+1]||process.argv.length!==4)
    throw Error('Explicit --output METADATA.json is required');
  const cases=[];
  for(const spec of APR08_ORIGINAL_MEDIA.cases)cases.push(await auditCase(spec));
  const report={
    schemaVersion:APR08_ORIGINAL_MEDIA.schemaVersion,issue:864,
    originalPublicSourceAuditAtUTC:new Date().toISOString(),
    scope:'two LRL dated Senate media pages, three original Granicus agendas, three bounded MP3 prefix probes',
    cases,
    verifiedLrlDatedMediaPages:cases.filter(c=>
      (c.lrlPage as {state?:string}).state==='VERIFIED_DATED_MEDIA_INDEX_PAGE').length,
    verifiedOriginalGranicusAgendas:cases.reduce((sum,c)=>sum+
      c.granicusAgendas.filter((x:unknown)=>
        (x as {state?:string}).state==='AGENDA_DATE_COMMITTEE_BILL_VERIFIED').length,0),
    audioPrefixSourceAvailabilityNotMotionProof:true,
    everyAmendmentMotionSpecificDateVerified:false,
    firstPublicByVerified:false,
    original2021PrintMinutesUnavailableSelfService:true,
    noRawAudioVideoCaptionPayloadIncluded:true,
    noProductionDatabaseOrModelAccess:true,issue864RemainsOpen:true
  };
  await mkdir(dirname(process.argv[at+1]!),{recursive:true});
  await writeFile(process.argv[at+1]!,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({
    originalLrlDatedPages:report.verifiedLrlDatedMediaPages,
    originalGranicusAgendas:report.verifiedOriginalGranicusAgendas,
    audioPrefixChecks:cases.reduce((n,c)=>n+c.granicusAudioPrefixes.length,0),
    exactAmendmentDatesVerified:0,
    outputIsMetadataOnly:true
  }));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

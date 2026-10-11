/**
 * #864: independent public-only availability check for caption-bearing source
 * surfaces on 138 original archived Senate committee media record pages.
 *
 * This is NOT spoken-content adjudication, actual AV playback, human speaker
 * attribution, a named recorded vote, or the complete Senate motion census.
 */
import {createHash} from 'node:crypto';
import {extractSenateCaptionRequests,summarizeSenateCaptionPayload}
  from './minnesota-senate-media.js';

export const SENATE_138_CAPTION_SOURCE_SCHEMA=
  'senate-2022-25-138-original-media-record-caption-surface-proof-v1' as const;
export const PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS={
  2022:{artifactId:11680881578,sha256:'29cefe409462e52ed21251053af2c7fc3f3240d01248cecb4fb3f0312880c6e5',count:11},
  2023:{artifactId:11679809828,sha256:'59018e20df0bb0742ec668604a117d12dddc8c0bdb156b4b2f05e0e287ca6643',count:64},
  2024:{artifactId:11680254175,sha256:'b32b49fcb3d85184a357fead01df1319698cd8505dfa2f562fed7e55d4f00fe0',count:41},
  2025:{artifactId:11680606990,sha256:'d4a7c3c25eb3508150b799e53049f2cb20f358b28fd0fbd2472a65ffca52dd00',count:22},
} as const;
export type MediaAuditYear=keyof typeof PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS;
const sha256=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const LIMIT=1_500_000;

export type OriginalHtmlMetadataRow={
  year:number;mtgid:string;originalIndexedHearingDate:string;
  exactOriginalMediaRecordUrl:string;originalMediaRecordUrlSha256:string;
  originalHtmlSha256:string;mediaTagCandidate:boolean;
};
export function readExactPriorMediaHtmlProof(year:MediaAuditYear,raw:string):
  Map<string,OriginalHtmlMetadataRow>{
  const pinned=PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS[year];
  if(sha256(raw)!==pinned.sha256)throw Error('Actual earlier original HTML review JSON SHA changed');
  const j=JSON.parse(raw) as {
    schemaVersion:string;year:number;htmlRecordPagesFetched:number;
    exactRecordUrlsExpected:number;failedRecords:number;records:OriginalHtmlMetadataRow[];
  };
  if(j.schemaVersion!=='senate-138-source-hashed-official-media-html-visibility-v1'
    ||j.year!==year||j.htmlRecordPagesFetched!==pinned.count
    ||j.exactRecordUrlsExpected!==pinned.count||j.failedRecords!==0
    ||j.records.length!==pinned.count)
    throw Error('Prior verified media record count or source version drifted');
  const result=new Map<string,OriginalHtmlMetadataRow>();
  for(const row of j.records){
    if(row.year!==year||!row.originalIndexedHearingDate.startsWith(year+'-')
      ||!/^https:\/\/www\.lrl\.mn\.gov\/media\/file\?mtgid=\d{5,12}$/.test(row.exactOriginalMediaRecordUrl)
      ||row.exactOriginalMediaRecordUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+row.mtgid
      ||!/^[a-f0-9]{64}$/.test(row.originalHtmlSha256)
      ||sha256(row.exactOriginalMediaRecordUrl)!==row.originalMediaRecordUrlSha256
      ||result.has(row.mtgid))
      throw Error('An original archive page identity/hash was not independently source-bound');
    result.set(row.mtgid,row);
  }
  return result;
}
export function inspectMediaPageCaptionSurface(html:string,pageUrl:string){
  const u=new URL(pageUrl);
  if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
    u.pathname!=='/media/file'||u.searchParams.size!==1||
    !/^\d{5,12}$/.test(u.searchParams.get('mtgid')??''))
    throw Error('Not a pinned official LRL media record URL');
  const requests=extractSenateCaptionRequests(html,pageUrl);
  const safe=[];
  for(const request of requests){
    const ep=new URL(request.endpointUrl);
    if(ep.protocol!=='https:'||ep.hostname!=='www.lrl.mn.gov'
      ||ep.pathname!=='/media/media_functions'
      ||ep.searchParams.get('type')!=='getCaption'
      ||ep.searchParams.get('captionid')!==''||ep.searchParams.size!==3
      ||ep.searchParams.get('strmp4')!==request.mp4
      ||request.mp4.length>300
      ||!/^[a-z0-9_.\/\- %]+\.mp4$/i.test(request.mp4)
      ||request.mp4.includes('..')||/^\s*https?:/i.test(request.mp4))
      continue; // flag unsafe or unexpected structure; never contact endpoint
    safe.push(request);
  }
  return {
    totalRequestCandidates:requests.length,
    safeRequestCandidates:safe,
    rejectedRequestCandidates:requests.length-safe.length,
    pageOriginalHtmlSha256:sha256(html),
    noCapturedCaptionWordsOrMediaBodies:true,
  };
}
export type CaptionProbeClassification=
  |'caption_timed_rows_observed'
  |'caption_payload_no_timed_rows'
  |'caption_endpoint_http_unavailable'
  |'caption_endpoint_invalid_payload'
  |'caption_endpoint_oversize'
  |'caption_endpoint_fetch_failed';
export function classifyOriginalCaptionPayload(
  status:number,contentType:string,rawBody:Uint8Array,
):{
  status:CaptionProbeClassification;httpStatus:number;contentType:string;
  originalPayloadSha256:string|null;originalPayloadBytes:number;
  timedCaptionRows:number;sourceTextCharacterCount:number;
}{
  const common={httpStatus:status,contentType:contentType.slice(0,85),
    originalPayloadBytes:rawBody.byteLength};
  if(rawBody.byteLength>LIMIT)return {
    ...common,status:'caption_endpoint_oversize',originalPayloadSha256:null,
    timedCaptionRows:0,sourceTextCharacterCount:0,
  };
  if(status!==200)return {
    ...common,status:'caption_endpoint_http_unavailable',originalPayloadSha256:sha256(rawBody),
    timedCaptionRows:0,sourceTextCharacterCount:0,
  };
  if(!/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/i.test(contentType))
    return {...common,status:'caption_endpoint_invalid_payload',originalPayloadSha256:sha256(rawBody),
      timedCaptionRows:0,sourceTextCharacterCount:0};
  const original=new TextDecoder('utf-8',{fatal:false}).decode(rawBody);
  const summary=summarizeSenateCaptionPayload(original);
  return {
    ...common,status:summary.dataTimeCount>0?'caption_timed_rows_observed':'caption_payload_no_timed_rows',
    originalPayloadSha256:sha256(rawBody),
    timedCaptionRows:summary.dataTimeCount,
    sourceTextCharacterCount:summary.textChars,
  };
}
export async function fetchBoundedCaptionEvidence(url:string,referer:string){
  const endpoint=new URL(url),parent=new URL(referer);
  if(endpoint.protocol!=='https:'||endpoint.hostname!=='www.lrl.mn.gov'
    ||endpoint.pathname!=='/media/media_functions'
    ||endpoint.searchParams.size!==3||endpoint.searchParams.get('type')!=='getCaption'
    ||endpoint.searchParams.get('captionid')!==''||
    parent.protocol!=='https:'||parent.hostname!=='www.lrl.mn.gov'||
    parent.pathname!=='/media/file')
    throw Error('Untrusted caption endpoint or referrer');
  const response=await fetch(url,{
    redirect:'manual',signal:AbortSignal.timeout(30_000),
    headers:{accept:'text/html,application/xhtml+xml,text/plain',referer,
      'user-agent':'VotePredict/2.0 Senate #864 historical original caption metadata'},
  });
  const ty=response.headers.get('content-type')??'';
  if(response.status>=300&&response.status<400)
    return classifyOriginalCaptionPayload(response.status,ty,new Uint8Array());
  const len=Number(response.headers.get('content-length')??'');
  if(len>LIMIT)return classifyOriginalCaptionPayload(response.status,ty,new Uint8Array(LIMIT+1));
  if(!/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/i.test(ty))
    return classifyOriginalCaptionPayload(response.status,ty,new Uint8Array());
  const chunks:Uint8Array[]=[];let size=0;
  const reader=response.body?.getReader();
  if(!reader)throw Error('Missing caption metadata body');
  try{
    for(;;){
      const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;
      if(size>LIMIT){await reader.cancel();return classifyOriginalCaptionPayload(
        response.status,ty,new Uint8Array(LIMIT+1))}
      chunks.push(part.value);
    }
  }finally{reader.releaseLock()}
  const all=new Uint8Array(size);let index=0;
  for(const chunk of chunks){all.set(chunk,index);index+=chunk.byteLength}
  return classifyOriginalCaptionPayload(response.status,ty,all);
}

/**
 * #864: Metadata-only HTML review of exact 138 official 2022–25 committee
 * meeting-associated LRL /media/file?mtgid records. No playback, media GET,
 * transcripts, model, ingestion or production DB.
 *
 * The live HTML is untrusted. Count only explicit media markup and archive
 * record identifiers, not sitewide watch/listen nav as proof of actual files.
 */
import { createHash } from 'node:crypto';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const CAP=600_000;
const normalize=(s:string)=>s.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const count=(v:string,r:RegExp)=>[...v.matchAll(r)].length;
export function inspectSenateMediaRecordHtml(html:string,mtgid:string){
  if(!/^\d{5,12}$/.test(mtgid)||html.length<30||
     Buffer.byteLength(html,'utf8')>CAP)
    throw Error('Original LRL media record HTML outside fixed source bounds');
  if(!/<html\b|<!doctype html\b|<body\b/i.test(html))
    throw Error('Original LRL media record did not resemble HTML');
  const title=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'';
  const titleNorm=normalize(title);
  // Markup is not trusted as proof any audio/video has actually played.
  const audio=count(html,/<audio\b/gi);
  const video=count(html,/<video\b/gi);
  const source=count(html,/<source\b[^>]*(?:src|type)\s*=/gi);
  const iframe=count(html,/<iframe\b[^>]*src\s*=/gi);
  const mediaMeta=count(html,/<meta\b[^>]*(?:og:video|og:audio|twitter:player)/gi);
  const fileRefs=count(html,/\b(?:src|href)\s*=\s*["'][^"']+\.(?:mp3|mp4|m4a|m3u8|webm|wav)(?:\?[^"']*)?["']/gi);
  const hrefs=[...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  let downloadLabeled=0,transcriptLabeled=0,mediaLabeled=0;
  for(const a of hrefs){
    const label=normalize(a[2]!).toLowerCase();
    if(/\bdownload\b/.test(label))downloadLabeled++;
    if(/\btranscript|caption|subtitle\b/.test(label))transcriptLabeled++;
    if(/\b(?:play|listen|watch|recording|video|audio)\b/.test(label))mediaLabeled++;
  }
  const text=normalize(html);
  const errorText=/\b(?:file\s+not\s+found|record\s+not\s+found|404\s+not\s+found|page\s+not\s+found|this\s+file\s+is\s+unavailable)\b/i.test(text);
  const mtgidLiteralCount=count(html,new RegExp('\\b'+mtgid+'\\b','g'));
  return {
    originalHtmlSha256:sha(html),htmlUtf8Bytes:Buffer.byteLength(html,'utf8'),
    sourcePageTitleSha256:sha(titleNorm),sourcePageTitleLength:titleNorm.length,
    originalSourceMtgidLiteralCount:mtgidLiteralCount,
    explicitMissingRecordTextDetected:errorText,
    structuralSourceTags:{audio,video,source,iframe,mediaMeta,mediaFileRefs:fileRefs},
    labeledNavigation:{downloadLinks:downloadLabeled,transcriptLinks:transcriptLabeled,
      otherMediaLinks:mediaLabeled},
    mediaTagCandidate:audio+video+source+fileRefs>0,
    specificPlaybackValidated:false,meetingIdentityMatchedToRecordedContent:false,
    exactNamedVotesFromMediaVerified:false,sourceIsUntrustedHtml:true,
  };
}
export async function fetchBoundedSenateMediaRecordHtml(
  officialUrl:string,allowed:ReadonlySet<string>,
):Promise<{html:string;contentType:string;status:number}>{
  if(!allowed.has(officialUrl))throw Error('Media record outside exact hash-pinned source manifest');
  const url=new URL(officialUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.lrl.mn.gov'||url.pathname!=='/media/file'||
    url.searchParams.size!==1||!/^\d{5,12}$/.test(url.searchParams.get('mtgid')??''))
    throw Error('Media record did not match official exact mtgid URL');
  const response=await fetch(officialUrl,{
    redirect:'manual',signal:AbortSignal.timeout(30_000),
    headers:{accept:'text/html,application/xhtml+xml',
      'user-agent':'VotePredict/2.0 Minnesota Senate committee archival record metadata QA'},
  });
  if(response.status!==200 || response.url!==officialUrl)
    throw Error('Official media file metadata HTTP/redirect change');
  const type=response.headers.get('content-type')??'';
  if(!/^(?:text\/html|application\/xhtml\+xml)/i.test(type))
    throw Error('Official media record is not an HTML metadata page: no media body GET permitted');
  const len=response.headers.get('content-length');
  if(len&&Number(len)>CAP)throw Error('Official media HTML declared over source cap');
  const reader=response.body?.getReader();
  if(!reader)throw Error('Official media HTML body was absent');
  let n=0;const chunks:Uint8Array[]=[];
  try{
    for(;;){
      const r=await reader.read();
      if(r.done)break;
      n+=r.value.byteLength;
      if(n>CAP)throw Error('Official media HTML streamed bytes over cap');
      chunks.push(r.value);
    }
  }finally{reader.releaseLock()}
  const all=new Uint8Array(n);
  let i=0;for(const chunk of chunks){all.set(chunk,i);i+=chunk.byteLength}
  return {html:new TextDecoder().decode(all),contentType:type.slice(0,85),status:response.status};
}
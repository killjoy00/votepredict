/**
 * #864: source-only, bounded auto-caption MOTION-CUE discovery. No YEA/NAY,
 * no speakers, no distinct motion certification, no model or database actions.
 * Each original caption payload must already have its independent SHA-256
 * stored in the immutable previous caption-availability source artifact.
 */
import {createHash} from 'node:crypto';

export const SENATE_2025_UNLINKED_CAPTION_CUE_SCHEMA=
  'senate-2025-22-unlinked-original-caption-motion-cue-review-v1' as const;
export const PREVIOUS_2025_ORIGINAL_CAPTION_METADATA={
  runId:38103766440,artifactId:11688528042,
  jsonSha256:'2cb3071e63359a62cc74a63625b62aeb57459cebffd0f58a613d35f93383cc3a',
  count:22,
} as const;
const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const CAP=1_500_000;
const TIME_CAP=20_000;
const CUE_MAX=80;
const clean=(s:string)=>s.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
 .replace(/<!--[\s\S]*?-->/g,' ')
 .replace(/<[^>]+>/g,' ')
 .replace(/&nbsp;|&#160;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
 .replace(/&#39;|&apos;/gi,"'")
 .replace(/&#(\d+);/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/&#x([0-9a-f]+);/gi,(_m,n:string)=>String.fromCodePoint(Number.parseInt(n,16)))
 .replace(/\s+/g,' ').trim();

export interface PinnedCaptionRecord {
 year:number;originalMtgid:string;originalHearingDate:string;committeeName:string;
 originalMediaRecordUrl:string;
 previouslyVerifiedOriginalPageHtmlSha256:string;
 captionApiStatusCategories:string[];
 captionPayloadSha256s:string[];
 timedCaptionRowsVisible:number;
 returnedPayloadBytes:number;
}
export function readOriginal2025CaptionAvailabilityProof(raw:string):Map<string,PinnedCaptionRecord>{
 if(sha(raw)!==PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.jsonSha256)
   throw Error('Previously source-hashed original 2025 caption metadata has changed');
 const j=JSON.parse(raw) as {
  schemaVersion:string;year:number;originalSourceHrefArtifactId:number;
  exactRecordUrlsExpected?:number;totals:{
   officialOriginalMediaRecordsExpected:number;originalHtmlPagesReverified:number;
   originalHtmlPageFailures:number;pagesWithTimedCaptionRows:number;
  };records:PinnedCaptionRecord[];failures:unknown[];
 };
 if(j.schemaVersion!=='senate-2022-25-138-original-media-record-caption-surface-proof-v1'
   ||j.year!==2025||j.totals.officialOriginalMediaRecordsExpected!==22
   ||j.totals.originalHtmlPagesReverified!==22||j.totals.originalHtmlPageFailures!==0
   ||j.totals.pagesWithTimedCaptionRows!==22||j.records.length!==22||j.failures.length!==0)
   throw Error('Source-verified original 2025 record universe changed');
 const map=new Map<string,PinnedCaptionRecord>();
 for(const row of j.records){
  if(row.year!==2025||!/^2025-\d\d-\d\d$/.test(row.originalHearingDate)
    ||!/^\d{5,12}$/.test(row.originalMtgid)
    ||row.originalMediaRecordUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+row.originalMtgid
    ||row.captionApiStatusCategories.length!==1
    ||row.captionApiStatusCategories[0]!=='caption_timed_rows_observed'
    ||row.captionPayloadSha256s.length!==1
    ||!/^[a-f0-9]{64}$/.test(row.captionPayloadSha256s[0]??'')
    ||!/^[a-f0-9]{64}$/.test(row.previouslyVerifiedOriginalPageHtmlSha256)
    ||!Number.isInteger(row.timedCaptionRowsVisible)||row.timedCaptionRowsVisible<=0
    ||!Number.isInteger(row.returnedPayloadBytes)||row.returnedPayloadBytes<=0
    ||row.returnedPayloadBytes>CAP||map.has(row.originalMtgid))
   throw Error('Invalid/duplicate previously SHA-verified 2025 caption media source');
  map.set(row.originalMtgid,row);
 }
 return map;
}
function seconds(s:string):number|null{
 if(/^\d+(?:\.\d{1,4})?$/.test(s)){
   const n=Number(s);return Number.isFinite(n)&&n<=86400?n:null;
 }
 const m=/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(s);
 if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]),sec=Number(m[3]??0);
 if(h>23||min>59||sec>59)return null;
 return h*3600+min*60+sec+Number('0.'+(m[4]??'0'));
}
const CUES=[
 ['recorded_roll_call',/\b(?:roll[\s-]?call|call the roll|take a recorded vote|take the roll|take the vote by roll)\b/i],
 ['motion_outcome',/\b(?:motion|amendment|resolution)\s+(?:prevail(?:s|ed)?|fail(?:s|ed)?|adopt(?:ed|s)?|pass(?:es|ed)?|carr(?:y|ied)|defeat(?:ed|s)?)\b/i],
 ['motion_made',/\b(?:i move (?:that|to|the)|i would move|make a motion|motion (?:to|that|on)|move (?:that|to|the)|offer (?:the|an) amendment)\b/i],
 ['vote_call',/\b(?:all (?:those|in) (?:in )?favor|all (?:those|in) opposed|say aye|say nay|ayes have it|nays have it|the vote is|voice vote)\b/i],
 ['committee_disposition',/\b(?:pass and (?:be )?re-?referred|committee recommendation|recommend that|recommendation to pass|refer(?:red)? to (?:the )?(?:committee|rules))\b/i],
] as const;
export type CueKind=(typeof CUES)[number][0];
type Clip={ordinal:number;dataTimeToken:string;offsetSeconds:number|null;text:string};
export function findAutoCaptionMotionCueWindows(raw:string){
 if(!raw||Buffer.byteLength(raw,'utf8')>CAP)throw Error('Original caption HTML outside strict source byte cap');
 const matches=[...raw.matchAll(/\bdata-time\s*=\s*["']([^"']+)["']/gi)];
 if(matches.length>TIME_CAP)throw Error('Original caption HTML over timestamp-marker cap');
 const clips:Clip[]=[];
 for(let i=0;i<matches.length;i++){
  const m=matches[i]!,begin=m.index!,end=i+1<matches.length?matches[i+1]!.index!:raw.length;
  const token=m[1]!;
  const normalized=clean(raw.slice(begin,end).slice(0,1800)).slice(0,420);
  clips.push({ordinal:i,dataTimeToken:token,offsetSeconds:seconds(token),text:normalized});
 }
 const categories:Record<string,number>={};
 const windows=new Map<string,{
  cueKind:CueKind;captionRowOrdinal:number;sourceDataTimeToken:string;
  interpretedOffsetSeconds:number|null;originalContextSha256:string;
  unverifiedAutoCaptionPreview:string;repeatedNearbyCueCount:number;
 }>();
 for(let i=0;i<clips.length;i++){
  const a=clips[i]!;
  const context=clips.slice(Math.max(0,i-2),Math.min(clips.length,i+3))
    .map(x=>x.text).join(' ').replace(/\s+/g,' ').trim().slice(0,700);
  if(!context)continue;
  for(const [cueKind,expression] of CUES){
   if(!expression.test(context))continue;
   categories[cueKind]=(categories[cueKind]??0)+1;
   const bucket=a.offsetSeconds===null?'row-'+Math.floor(i/16):String(Math.floor(a.offsetSeconds/30));
   const key=cueKind+'|'+bucket;
   if(windows.has(key)){
    windows.get(key)!.repeatedNearbyCueCount++;
    continue;
   }
   const preview=context.slice(0,160)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,'[phone]');
   windows.set(key,{
    cueKind,captionRowOrdinal:i,sourceDataTimeToken:a.dataTimeToken,
    interpretedOffsetSeconds:a.offsetSeconds,
    originalContextSha256:sha(context),
    unverifiedAutoCaptionPreview:preview,
    repeatedNearbyCueCount:1
   });
  }
 }
 const all=[...windows.values()].sort((a,b)=>a.captionRowOrdinal-b.captionRowOrdinal
  ||a.cueKind.localeCompare(b.cueKind));
 return {
  timestampMarkers:matches.length,
  successfullyParsedTimestampTokens:clips.filter(x=>x.offsetSeconds!==null).length,
  unparseableTimestampTokens:clips.filter(x=>x.offsetSeconds===null).length,
  cueKindOccurrenceCounts:categories,
  totalDistinctThirtySecondCategoryCueWindows:all.length,
  candidateCueWindows:all.slice(0,CUE_MAX),
  additionalCueWindowsNotPreserved:Math.max(0,all.length-CUE_MAX),
  sourceCaptionTextNotVerifiedAgainstAudio:true,
  cueWindowIsNotAUniqueRecordedMotionOrVote:true,
  noSenatorVoteSideExtracted:true,
 };
}
export async function retrieveVerifiedOfficialCaptionMarkup(
 endpointUrl:string,originalMediaUrl:string,expectedBodySha256:string,
):Promise<{html:string;bodySha256:string;contentType:string;bytes:number}>{
 const e=new URL(endpointUrl),o=new URL(originalMediaUrl);
 if(o.protocol!=='https:'||o.hostname!=='www.lrl.mn.gov'||o.pathname!=='/media/file'
  ||o.searchParams.size!==1||!/^\d{5,12}$/.test(o.searchParams.get('mtgid')??'')
  ||e.protocol!=='https:'||e.hostname!=='www.lrl.mn.gov'
  ||e.pathname!=='/media/media_functions'||e.searchParams.size!==3
  ||e.searchParams.get('type')!=='getCaption'
  ||e.searchParams.get('captionid')!==''||!e.searchParams.get('strmp4')?.endsWith('.mp4')
  ||!/^[a-f0-9]{64}$/.test(expectedBodySha256))
  throw Error('Source caption request is not in original official allowlist');
 const r=await fetch(endpointUrl,{redirect:'manual',signal:AbortSignal.timeout(30_000),
  headers:{accept:'text/html,application/xhtml+xml,text/plain',referer:originalMediaUrl,
   'user-agent':'VotePredict/2.0 Senate #864 original-only motion cue study'}});
 const type=r.headers.get('content-type')??'';
 if(r.status!==200||r.url!==endpointUrl
  ||!/^(?:text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/i.test(type))
  throw Error('Original official caption endpoint HTTP/type changed');
 if(Number(r.headers.get('content-length')??0)>CAP)
  throw Error('Original caption response exceeded declared length cap');
 const reader=r.body?.getReader();if(!reader)throw Error('Missing original caption response body');
 const chunks:Uint8Array[]=[];let n=0;
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   n+=part.value.byteLength;
   if(n>CAP){await reader.cancel();throw Error('Source caption body exceeds streamed byte cap')}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const data=new Uint8Array(n);let offset=0;
 for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength}
 const originalHash=sha(data);
 if(originalHash!==expectedBodySha256)
  throw Error('Official original caption body changed versus independently pinned source SHA');
 return {html:new TextDecoder().decode(data),bodySha256:originalHash,contentType:type.slice(0,85),bytes:n};
}

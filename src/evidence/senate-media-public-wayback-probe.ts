/**
 * #987 / #946: public-only historical MPR/Reformer URL capture research.
 *
 * This is NOT the private source_documents SHA-256 reconciler. It indexes
 * exact URLs from the checked-in, bounded public research ledger, preserving
 * individual CDX capture times even if many have identical payload digests.
 *
 * A CDX record is only an INDEX CLAIM until an exact timestamped id_ replay
 * matches its SHA-1 payload digest. Even such a match is NOT an authenticated
 * VotePredict source, an initial publisher timestamp, a human senator quote,
 * or proof the interview's audio/transcript already existed at that time.
 *
 * Never follow redirects, store original bodies, connect to a database,
 * write production sources, or fall back to live publisher URLs.
 */
import {createHash} from 'node:crypto';
import {
  diagnoseMediaPublicDiscoveryPaths,
  type MediaPublicDiscoveryLeadInput,
} from './senate-media-public-discovery-gaps.js';

export const MEDIA_PUBLIC_CDX_PROBE_VERSION='senate-media-public-exact-cdx-proof-v1' as const;
export const MEDIA_PUBLIC_CDX_INDEX_MAX_BYTES=96_000;
export const MEDIA_PUBLIC_CDX_MAX_ROWS=20;
export const MEDIA_PUBLIC_REPLAY_MAX_BYTES=2_500_000;
const CDX_ENDPOINT='https://web.archive.org/cdx/search/cdx';
const SHA1_BASE32=/^[A-Z2-7]{32}$/;
const ARTICLE_MIMES=new Set(['text/html','text/plain','application/xhtml+xml']);
const DIGITS14=/^\d{14}$/;
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type PublicMediaResearchLead=Pick<MediaPublicDiscoveryLeadInput,
  'id'|'seedId'|'livePageUrl'|'publicationDayDisplayedOnPublicPage'>;

export interface PublicCdxCaptureCandidate {
  leadId:string;
  originalUrl:string;
  timestamp:string;
  archiveCapturedAt:string;
  archiveUrl:string;
  mimeType:string;
  /** Internet Archive indexed WARC payload SHA-1, base32; NOT SHA-256. */
  indexedPayloadSha1Base32:string;
  /** CDX record length is NOT a verified original HTTP-body byte length. */
  cdxRecordLength:number|null;
  indexedOriginalStatusCode:'200';
  /** Strict scope: no 2026/newer records and no substituted URL aliases. */
  historicCaptureYear:number;
  replayBytesAuthenticated:false;
  sourceDocumentsSha256Matched:false;
  senatorQuotationHumanVerified:false;
}

export interface PublicCdxIndexResult {
  version:typeof MEDIA_PUBLIC_CDX_PROBE_VERSION;
  leadId:string;
  originalUrl:string;
  queriedFromYear:2021;
  queriedThroughYear:2025;
  status:'index_candidates'|'index_empty';
  /** A full first page does NOT prove an exhaustive capture index. */
  resultLimitReachedMayHaveMoreCaptures:boolean;
  captures:PublicCdxCaptureCandidate[];
  originalHttpResponseBytesVerified:0;
  sourceDocumentsMatched:0;
  humanAttributedSenatorQuotesVerified:0;
  historicalFirstPublisherPublicByProven:false;
  historicArticleOrPublisherCensusEstablished:false;
}

export type PublicCdxReplayDisposition =
  | 'matched_indexed_payload_sha1'
  | 'untrusted_capture_input'
  | 'redirect_refused'
  | 'http_not_200'
  | 'untrusted_article_content_type'
  | 'body_size_limit'
  | 'empty_or_short_body'
  | 'cdx_payload_sha1_mismatch'
  | 'fetch_failed';

export interface PublicCdxReplayResult {
  leadId:string;
  archiveUrl:string;
  archiveCapturedAt:string;
  status:PublicCdxReplayDisposition;
  observedRawBodyBytes:number|null;
  /** Only populated after replay bytes match the CDX indexed payload SHA-1. */
  observedRawBodySha256:string|null;
  /** Match proves consistency with CDX index, NOT VotePredict private SHA. */
  matchedArchivedIndexPayload:boolean;
  privateVotePredictSourceDocumentMatched:false;
  publisherInitialPublicationTimeProven:false;
  archivedAudioOrTranscriptAvailableAtCaptureProven:false;
  exactSenatorQuoteHumanVerified:false;
  historicalForecastEligibilityProven:false;
}

/** Validate an actual 14-digit UTC capture clock, never allow JS date rollover. */
function captureUtc(ts:string):string {
  if(!DIGITS14.test(ts))throw Error('Invalid CDX 14-digit capture clock');
  const iso=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8)
    +'T'+ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z';
  const ms=Date.parse(iso);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==iso)
    throw Error('Impossible or rolled-over CDX capture timestamp');
  const yr=Number(ts.slice(0,4));
  if(yr<2021||yr>2025)throw Error('CDX capture outside 2021-2025 proof window');
  return iso;
}
function snapshotUrl(ts:string,original:string):string {
  captureUtc(ts);
  return 'https://web.archive.org/web/'+ts+'id_/'+original;
}
function base32(bytes:Uint8Array):string {
  let out='',bits=0,value=0;
  for(const byte of bytes){
    value=(value<<8)|byte;
    bits+=8;
    while(bits>=5){
      bits-=5;
      out+=ALPHABET[(value>>>bits)&31];
    }
    value &= (1<<bits)-1;
  }
  if(bits>0)out+=ALPHABET[(value<<(5-bits))&31];
  return out;
}
function sha1CdxDigest(bytes:Uint8Array):string {
  return base32(createHash('sha1').update(bytes).digest());
}

async function boundedBytes(response:Response,limit:number):Promise<Uint8Array>{
  const header=response.headers.get('content-length');
  if(header!==null && (!/^(0|[1-9]\d*)$/.test(header)
    || !Number.isSafeInteger(Number(header)) || Number(header)>limit))
    throw Error('body_size_limit');
  if(!response.body)throw Error('empty_or_short_body');
  const reader=response.body.getReader(),parts:Uint8Array[]=[];
  let size=0;
  while(true){
    const next=await reader.read();
    if(next.done)break;
    size+=next.value.byteLength;
    if(size>limit){await reader.cancel().catch(()=>undefined);throw Error('body_size_limit');}
    parts.push(next.value);
  }
  if(size===0)throw Error('empty_or_short_body');
  const output=new Uint8Array(size);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.byteLength;}
  return output;
}

function strictIndexRows(
  payload:unknown,lead:PublicMediaResearchLead,
):PublicCdxCaptureCandidate[]{
  if(!Array.isArray(payload)||!Array.isArray(payload[0])
    || payload.length<1 || payload.length>MEDIA_PUBLIC_CDX_MAX_ROWS+1)
    throw Error('Malformed or oversized public CDX response');
  const columns=payload[0] as unknown[];
  if(!columns.every(x=>typeof x==='string')||new Set(columns).size!==columns.length)
    throw Error('Malformed or duplicated CDX columns');
  const required=['timestamp','original','mimetype','statuscode','digest','length'];
  if(required.some(name=>!columns.includes(name)))
    throw Error('Missing CDX provenance column');
  const col=(row:unknown[],name:string):string=>{
    const x=row[columns.indexOf(name)];
    if(typeof x!=='string')throw Error('Non-string CDX provenance field');
    return x;
  };
  const seen=new Map<string,string>();
  const out:PublicCdxCaptureCandidate[]=[];
  for(const item of payload.slice(1)){
    if(!Array.isArray(item)||item.length!==columns.length)
      throw Error('Malformed public CDX capture row');
    const row=item as unknown[];
    const ts=col(row,'timestamp');
    const original=col(row,'original');
    const mime=col(row,'mimetype').toLowerCase();
    const status=col(row,'statuscode');
    const sha=col(row,'digest').toUpperCase();
    const length=col(row,'length');
    const utc=captureUtc(ts);
    // Do not authenticate different host, http/https alias or canonical URL.
    if(original!==lead.livePageUrl || status!=='200' || !ARTICLE_MIMES.has(mime)
      || !SHA1_BASE32.test(sha)||!(/^\d+$/.test(length))
      || !Number.isSafeInteger(Number(length))||Number(length)<0)
      throw Error('Non-identical, non-article or invalid CDX index row');
    const identity=JSON.stringify([original,mime,status,sha,length]);
    const existing=seen.get(ts);
    if(existing && existing!==identity)
      throw Error('Contradictory CDX metadata for identical capture time');
    if(existing)continue;
    seen.set(ts,identity);
    out.push({
      leadId:lead.id, originalUrl:original, timestamp:ts,
      archiveCapturedAt:utc,archiveUrl:snapshotUrl(ts,original),
      mimeType:mime,indexedPayloadSha1Base32:sha,
      cdxRecordLength:Number(length),
      indexedOriginalStatusCode:'200',
      historicCaptureYear:Number(ts.slice(0,4)),
      replayBytesAuthenticated:false,
      sourceDocumentsSha256Matched:false,
      senatorQuotationHumanVerified:false,
    });
  }
  return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}

/**
 * One CDX GET for ONE exact public URL (only ledger publisher/host paths).
 * No collapse=digest: each timestamp is independently material to public-by.
 * This is a bounded first page, not proof all captures have been enumerated.
 */
export async function discoverMediaPublicCdxCaptures(
  lead:PublicMediaResearchLead,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicCdxIndexResult> {
  diagnoseMediaPublicDiscoveryPaths([lead]); // validates canonical URL, publisher, day
  const params=new URLSearchParams({
    url:lead.livePageUrl,from:'2021',to:'2025',
    matchType:'exact',output:'json',
    fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',limit:String(MEDIA_PUBLIC_CDX_MAX_ROWS),
  });
  // The generic collector's collapse=digest would discard the timestamps we need.
  if(params.has('collapse'))throw Error('Unsafe collapse of CDX capture timestamps');
  const response=await fetchImpl(CDX_ENDPOINT+'?'+params.toString(),{
    method:'GET',redirect:'manual',
    headers:{accept:'application/json','user-agent':'VotePredict/2.0 public-media-capture-research'},
    signal:AbortSignal.timeout(20_000),
  });
  if(response.status>=300&&response.status<400)throw Error('CDX redirect refused');
  if(response.status!==200)throw Error('CDX index HTTP status '+response.status);
  const mime=(response.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();
  if(mime!=='application/json')throw Error('CDX returned non-JSON response');
  const bytes=await boundedBytes(response,MEDIA_PUBLIC_CDX_INDEX_MAX_BYTES);
  let payload:unknown;
  try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw Error('Malformed CDX JSON');}
  const captures=strictIndexRows(payload,lead);
  return {
    version:MEDIA_PUBLIC_CDX_PROBE_VERSION,
    leadId:lead.id,originalUrl:lead.livePageUrl,
    queriedFromYear:2021,queriedThroughYear:2025,
    status:captures.length?'index_candidates':'index_empty',
    resultLimitReachedMayHaveMoreCaptures:(payload as unknown[]).length-1>=MEDIA_PUBLIC_CDX_MAX_ROWS,
    captures,
    originalHttpResponseBytesVerified:0,sourceDocumentsMatched:0,
    humanAttributedSenatorQuotesVerified:0,
    historicalFirstPublisherPublicByProven:false,
    historicArticleOrPublisherCensusEstablished:false,
  };
}

function replayResult(c:PublicCdxCaptureCandidate,status:PublicCdxReplayDisposition,
  observedRawBodyBytes:number|null=null,
  observedRawBodySha256:string|null=null):PublicCdxReplayResult{
  return {
    leadId:c.leadId,archiveUrl:c.archiveUrl,archiveCapturedAt:c.archiveCapturedAt,
    status,observedRawBodyBytes,observedRawBodySha256,
    matchedArchivedIndexPayload:status==='matched_indexed_payload_sha1',
    privateVotePredictSourceDocumentMatched:false,
    publisherInitialPublicationTimeProven:false,
    archivedAudioOrTranscriptAvailableAtCaptureProven:false,
    exactSenatorQuoteHumanVerified:false,
    historicalForecastEligibilityProven:false,
  };
}

/**
 * Optional second public GET: replay the EXACT CDX timestamp/id_ original.
 * Require SHA-1 base32 == indexed CDX payload, then record observed SHA-256.
 * No body is returned, written, or counted as a senator quote or DB match.
 */
export async function verifyMediaPublicCdxReplay(
  candidate:PublicCdxCaptureCandidate,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicCdxReplayResult> {
  try{
    const parsed=new URL(candidate.originalUrl);
    if(!candidate.leadId || parsed.protocol!=='https:'
      || !['www.mprnews.org','minnesotareformer.com'].includes(parsed.hostname)
      || parsed.port || parsed.username || parsed.password
      || parsed.hash || parsed.search || parsed.toString()!==candidate.originalUrl
      || !SHA1_BASE32.test(candidate.indexedPayloadSha1Base32)
      || candidate.archiveCapturedAt!==captureUtc(candidate.timestamp)
      || candidate.archiveUrl!==snapshotUrl(candidate.timestamp,candidate.originalUrl)
      || candidate.historicCaptureYear!==Number(candidate.timestamp.slice(0,4))
      || candidate.indexedOriginalStatusCode!=='200'
      || !ARTICLE_MIMES.has(candidate.mimeType))
      return replayResult(candidate,'untrusted_capture_input');
  }catch{return replayResult(candidate,'untrusted_capture_input');}
  try{
    const r=await fetchImpl(candidate.archiveUrl,{
      method:'GET',redirect:'manual',
      headers:{accept:'text/html,text/plain,application/xhtml+xml',
        'user-agent':'VotePredict/2.0 public-media-capture-research'},
      signal:AbortSignal.timeout(20_000),
    });
    if(r.status>=300&&r.status<400)return replayResult(candidate,'redirect_refused');
    if(r.status!==200)return replayResult(candidate,'http_not_200');
    const mime=(r.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();
    if(mime!==candidate.mimeType)return replayResult(candidate,'untrusted_article_content_type');
    const body=await boundedBytes(r,MEDIA_PUBLIC_REPLAY_MAX_BYTES);
    if(body.byteLength<40)return replayResult(candidate,'empty_or_short_body');
    if(sha1CdxDigest(body)!==candidate.indexedPayloadSha1Base32)
      return replayResult(candidate,'cdx_payload_sha1_mismatch');
    return replayResult(candidate,'matched_indexed_payload_sha1',body.byteLength,
      createHash('sha256').update(body).digest('hex'));
  }catch(e){
    return replayResult(candidate,
      e instanceof Error && e.message==='body_size_limit'?'body_size_limit':
      e instanceof Error && e.message==='empty_or_short_body'?'empty_or_short_body':
      'fetch_failed');
  }
}

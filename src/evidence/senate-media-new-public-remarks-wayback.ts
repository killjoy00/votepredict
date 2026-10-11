/**
 * #987/#946 PUBLIC-ONLY exact Wayback proof for 18 separately checked-in 2021-25
 * Minnesota Senate original-publisher remarks. No private VotePredict data,
 * production sources, author quotes, models or forecasting.
 *
 * The report may prove consistency between an exact archived HTTP body and its
 * indexed CDX SHA-1. It NEVER proves initial publisher time, audio contents,
 * senator speech, an individual stance, original site authorship or coverage.
 */
import {createHash} from 'node:crypto';

export const NEW_REMARKS_WAYBACK_VERSION='senate-media-2021-25-new-remarks-exact-replay-v1' as const;
export const NEW_REMARKS_CDX_MAX_BYTES=96_000;
export const NEW_REMARKS_CDX_MAX_ROWS=20;
export const NEW_REMARKS_BODY_MAX_BYTES=2_500_000;
const CDX='https://web.archive.org/cdx/search/cdx';
const HOST_PUBLISHER=new Map([
  ['senatedfl.mn','Minnesota Senate DFL'],
  ['www.mnsenaterepublicans.com','Minnesota Senate Republicans'],
  ['www.enterpriseminnesota.org','Enterprise Minnesota'],
  ['www.mprnews.org','MPR News'],
]);
const MIMES=new Set(['text/html','text/plain','application/xhtml+xml']);
const SHA1=/^[A-Z2-7]{32}$/;
const HEX64=/^[a-f0-9]{64}$/;
const DIGITS14=/^\d{14}$/;
const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const NEW_REMARKS_PILOT_IDS=[
  'caucus-2021-coleman-sexual-assault',
  'mpr-2021-miller-hero-pay-interview',
  'caucus-2021-marty-malcolm',
  'caucus-2023-poci-joint-policing',
  'caucus-2024-marty-sports-betting',
  'caucus-2025-housley-bonding',
] as const;
export interface OriginalRemarkLead {
  id:string;
  sourceUrl:string;
  publisher:string;
  displayedPublisherDates:string[];
  individualSenatorSpeaker:string|null;
  publicPagePresentation:string;
  exactHistoricalOriginalCaptureAndBodyHashVerified:false;
  initialPublicationTimeOrHistoricalVersionVerified:false;
  individualHistoricalSenatorQuotationHumanApproved:false;
  recordedLegislativeVoteInferred:false;
}
export type NewRemarkScope='pilot'|'all';
export interface NewRemarksProbeOptions{
  scope:NewRemarkScope;
  replayCount:0|1|2;
  concurrency:1|2;
}
export type NewRemarkReplayStatus=
  |'matched_indexed_payload_sha1'
  |'archive_http_unavailable'
  |'archive_redirect_refused'
  |'archive_mime_mismatch'
  |'archive_body_size_limit'
  |'archive_body_empty_or_short'
  |'cdx_payload_sha1_mismatch'
  |'archive_fetch_failed';
export interface NewRemarkReplayReceipt{
  archiveUrl:string;
  archiveCapturedUtc:string;
  indexedPayloadSha1Base32:string;
  replayStatus:NewRemarkReplayStatus;
  observedOriginalBodySha256:string|null;
  observedOriginalBodyBytes:number|null;
  matchedIndexedPayload:boolean;
  individualSenatorQuotationVerified:false;
  archivedAudioAuthenticated:false;
  initialPublisherPublicationTimeVerified:false;
}
export interface NewRemarkLeadResult{
  leadId:string;
  publisher:string;
  originalUrl:string;
  currentPageDisplayedDates:string[];
  currentPageNamedSpeakerCandidate:string|null;
  currentPagePresentation:string;
  indexStatus:'index_candidates'|'index_empty'|'index_failed';
  indexFailureKind:'cdx_unavailable_or_invalid'|null;
  firstIndexedCaptureUtc:string|null;
  indexedCandidateCount:number|null;
  indexFirstPagePossiblyTruncated:boolean;
  unreplayedIndexedCandidateCount:number|null;
  replayAttempts:NewRemarkReplayReceipt[];
  historicalPagePresenceOrAbsenceCertified:false;
  historicSenatorQuoteAuthenticated:false;
  originalSpokenAudioAuthenticated:false;
  initialPublisherPublicationTimeProven:false;
  privateSourceRowCompared:false;
  historicPredictionEligibilityVerified:false;
}
export interface NewRemarksWaybackReport{
  version:typeof NEW_REMARKS_WAYBACK_VERSION;
  sample:'separate_non_exhaustive_18_public_url_leads';
  scope:NewRemarkScope;
  checkedInLeadCount:18;
  selectedLeadCount:number;
  cdxIndexRequests:number;
  candidateIndexLeads:number;
  emptyIndexLeads:number;
  failedIndexLeads:number;
  replayAttempts:number;
  indexConsistentOriginalHttpBodies:number;
  distinctOriginalUrlsWithConsistentBodies:number;
  studyYears:readonly [2021,2022,2023,2024,2025];
  leads:NewRemarkLeadResult[];
  noPublicArticleBodyOrAudioPersisted:true;
  noPrivateSourceDocumentsOrDatabaseAccessed:true;
  noHistoricalQuoteHumanApproved:true;
  noRecordedVoteOrForecastInferred:true;
  noPublisherOrStatewideCompletenessClaim:true;
  noProductionConfigurationChanged:true;
}
interface Indexed {
  originalUrl:string;
  archiveUrl:string;
  timestamp:string;
  utc:string;
  mime:string;
  digest:string;
}
function utc(timestamp:string):string{
  if(!DIGITS14.test(timestamp))throw Error('Invalid capture clock');
  const iso=timestamp.slice(0,4)+'-'+timestamp.slice(4,6)+'-'+timestamp.slice(6,8)
    +'T'+timestamp.slice(8,10)+':'+timestamp.slice(10,12)+':'+timestamp.slice(12,14)+'Z';
  const ms=Date.parse(iso);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==iso.slice(0,-1)+'.000Z'
    || Number(timestamp.slice(0,4))<2021 || Number(timestamp.slice(0,4))>2025)
    throw Error('Capture clock outside strict original historical window');
  return iso;
}
function base32(raw:Uint8Array):string{
  let out='',bits=0,word=0;
  for(const b of raw){
    word=(word<<8)|b;
    bits+=8;
    while(bits>=5){bits-=5;out+=BASE32[(word>>>bits)&31];}
    word &= (1<<bits)-1;
  }
  if(bits)out+=BASE32[(word<<(5-bits))&31];
  return out;
}
async function bounded(response:Response,max:number):Promise<Uint8Array>{
  const header=response.headers.get('content-length');
  if(header!==null && (!/^(0|[1-9]\d*)$/.test(header)
    || !Number.isSafeInteger(Number(header)) || Number(header)>max))
    throw Error('body_size_limit');
  if(!response.body)throw Error('body_empty');
  const reader=response.body.getReader(),parts:Uint8Array[]=[];
  let size=0;
  while(true){
    const item=await reader.read();
    if(item.done)break;
    size+=item.value.byteLength;
    if(size>max){await reader.cancel().catch(()=>undefined);throw Error('body_size_limit');}
    parts.push(item.value);
  }
  if(size===0)throw Error('body_empty');
  const result=new Uint8Array(size);
  let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.byteLength;}
  return result;
}
function publisherHost(url:string):string{
  let parsed:URL;
  try{parsed=new URL(url);}catch{throw Error('Untrusted original public remark URL');}
  if(parsed.protocol!=='https:'||parsed.port||parsed.username||parsed.password
    ||parsed.search||parsed.hash||parsed.toString()!==url
    ||!HOST_PUBLISHER.has(parsed.hostname)
    ||parsed.pathname.length<8||parsed.pathname.length>300
    ||!/^[a-z0-9/_-]+\/?$/.test(parsed.pathname))
    throw Error('Untrusted original public remark URL');
  return HOST_PUBLISHER.get(parsed.hostname)!;
}
export function selectNewRemarkLeads(leads:readonly OriginalRemarkLead[],scope:NewRemarkScope):OriginalRemarkLead[]{
  if(scope!=='pilot'&&scope!=='all')throw Error('Invalid public remarks scope');
  if(!Array.isArray(leads)||leads.length!==18)throw Error('Expected exact checked-in 18 lead cohort');
  const ids=new Set<string>(),urls=new Set<string>();
  for(const lead of leads){
    if(!lead || !/^(?:caucus|enterprise|mpr)-20(?:21|22|23|24|25)-[a-z0-9-]+$/.test(lead.id)
      || ids.has(lead.id) || typeof lead.sourceUrl!=='string' || urls.has(lead.sourceUrl)
      || lead.publisher!==publisherHost(lead.sourceUrl)
      || !Array.isArray(lead.displayedPublisherDates)
      || lead.displayedPublisherDates.length<1||lead.displayedPublisherDates.length>2
      || lead.displayedPublisherDates.some((day:string)=>typeof day!=='string'
        || !/^20(?:21|22|23|24|25)-\d\d-\d\d$/.test(day)
        || !Number.isFinite(Date.parse(day+'T00:00:00Z'))
        || new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day
        || day.slice(0,4)!==lead.id.split('-')[1])
      || !(lead.individualSenatorSpeaker===null
        || typeof lead.individualSenatorSpeaker==='string'&&lead.individualSenatorSpeaker.length>3)
      || !/^[a-z_]+$/.test(lead.publicPagePresentation)
      || lead.exactHistoricalOriginalCaptureAndBodyHashVerified!==false
      || lead.initialPublicationTimeOrHistoricalVersionVerified!==false
      || lead.individualHistoricalSenatorQuotationHumanApproved!==false
      || lead.recordedLegislativeVoteInferred!==false)
      throw Error('Untrusted, duplicate or misrepresented public remark lead');
    ids.add(lead.id);urls.add(lead.sourceUrl);
  }
  if(scope==='all')return [...leads];
  return NEW_REMARKS_PILOT_IDS.map(id=>{
    const lead=leads.find(x=>x.id===id);
    if(!lead)throw Error('Public remark pilot ID not in ledger');
    return lead;
  });
}
function parseCdx(payload:unknown,lead:OriginalRemarkLead):Indexed[]{
  if(!Array.isArray(payload)||!Array.isArray(payload[0])
    || payload.length>NEW_REMARKS_CDX_MAX_ROWS+1)
    throw Error('Invalid bounded original CDX result');
  const headers=payload[0] as unknown[];
  if(!headers.every(x=>typeof x==='string')||new Set(headers).size!==headers.length
    || ['timestamp','original','mimetype','statuscode','digest','length']
      .some(k=>!headers.includes(k)))
    throw Error('Missing CDX fields');
  const get=(row:unknown[],key:string):string=>{
    const value=row[headers.indexOf(key)];
    if(typeof value!=='string')throw Error('Unexpected original CDX column type');
    return value;
  };
  const seen=new Map<string,string>();
  const entries:Indexed[]=[];
  for(const raw of payload.slice(1)){
    if(!Array.isArray(raw)||raw.length!==headers.length)throw Error('Invalid CDX row');
    const stamp=get(raw,'timestamp'),original=get(raw,'original');
    const mime=get(raw,'mimetype').toLowerCase(),digest=get(raw,'digest').toUpperCase();
    const size=get(raw,'length'),status=get(raw,'statuscode');
    const captured=utc(stamp);
    if(original!==lead.sourceUrl||!MIMES.has(mime)
      ||status!=='200'||!SHA1.test(digest)
      ||!/^\d+$/.test(size)||!Number.isSafeInteger(Number(size)))
      throw Error('Untrusted CDX original, MIME, digest or status');
    const sig=JSON.stringify([original,mime,digest,size,status]);
    if(seen.has(stamp)){
      if(seen.get(stamp)!==sig)throw Error('Contradictory timestamped archive metadata');
      continue;
    }
    seen.set(stamp,sig);
    entries.push({
      originalUrl:original,timestamp:stamp,utc:captured,mime,digest,
      archiveUrl:'https://web.archive.org/web/'+stamp+'id_/'+original,
    });
  }
  return entries.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function lookup(lead:OriginalRemarkLead,fetchImpl:typeof fetch):Promise<Indexed[]>{
  const params=new URLSearchParams({
    url:lead.sourceUrl,from:'2021',to:'2025',matchType:'exact',
    output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',limit:String(NEW_REMARKS_CDX_MAX_ROWS),
  });
  if(params.has('collapse'))throw Error('Unsafe archived timestamp collapse');
  const r=await fetchImpl(CDX+'?'+params.toString(),{
    method:'GET',redirect:'manual',
    headers:{accept:'application/json','user-agent':'VotePredict/2.0 public-new-senate-remarks-research'},
    signal:AbortSignal.timeout(20_000),
  });
  if(r.status!==200 || (r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='application/json')
    throw Error('Archive CDX unavailable or invalid');
  const raw=await bounded(r,NEW_REMARKS_CDX_MAX_BYTES);
  return parseCdx(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)) as unknown,lead);
}
function receipt(c:Indexed,status:NewRemarkReplayStatus,bodySha:string|null=null,bodyBytes:number|null=null):NewRemarkReplayReceipt{
  if(bodySha!==null&&!HEX64.test(bodySha))throw Error('Invalid original body hash');
  return {
    archiveUrl:c.archiveUrl,archiveCapturedUtc:c.utc,indexedPayloadSha1Base32:c.digest,
    replayStatus:status,observedOriginalBodySha256:bodySha,observedOriginalBodyBytes:bodyBytes,
    matchedIndexedPayload:status==='matched_indexed_payload_sha1',
    individualSenatorQuotationVerified:false,archivedAudioAuthenticated:false,
    initialPublisherPublicationTimeVerified:false,
  };
}
async function replay(c:Indexed,fetchImpl:typeof fetch):Promise<NewRemarkReplayReceipt>{
  try{
    if(!SHA1.test(c.digest)||!MIMES.has(c.mime)
      ||c.utc!==utc(c.timestamp)
      ||c.archiveUrl!=='https://web.archive.org/web/'+c.timestamp+'id_/'+c.originalUrl)
      throw Error('Bad archive identity');
    publisherHost(c.originalUrl);
    const r=await fetchImpl(c.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html,application/xhtml+xml,text/plain','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-new-senate-remarks-research'},
    });
    if(r.status>=300&&r.status<400)return receipt(c,'archive_redirect_refused');
    if(r.status!==200)return receipt(c,'archive_http_unavailable');
    const mime=(r.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();
    if(mime!==c.mime)return receipt(c,'archive_mime_mismatch');
    const bytes=await bounded(r,NEW_REMARKS_BODY_MAX_BYTES);
    if(bytes.byteLength<40)return receipt(c,'archive_body_empty_or_short');
    if(base32(createHash('sha1').update(bytes).digest())!==c.digest)
      return receipt(c,'cdx_payload_sha1_mismatch');
    return receipt(c,'matched_indexed_payload_sha1',
      createHash('sha256').update(bytes).digest('hex'),bytes.byteLength);
  }catch(e){
    if(e instanceof Error&&e.message==='body_size_limit')return receipt(c,'archive_body_size_limit');
    if(e instanceof Error&&e.message==='body_empty')return receipt(c,'archive_body_empty_or_short');
    return receipt(c,'archive_fetch_failed');
  }
}
export async function probeNewPublicRemarks(
  fullLedger:readonly OriginalRemarkLead[],
  options:NewRemarksProbeOptions,
  fetchImpl:typeof fetch=fetch,
):Promise<NewRemarksWaybackReport>{
  if(![0,1,2].includes(options.replayCount)||![1,2].includes(options.concurrency))
    throw Error('Invalid bounded original media probing options');
  const leads=selectNewRemarkLeads(fullLedger,options.scope);
  const result:Array<NewRemarkLeadResult|undefined>=Array.from({length:leads.length});
  let next=0;
  async function worker(){
    while(next<leads.length){
      const i=next++,lead=leads[i]!;
      let candidates:Indexed[]|null=null;
      try{candidates=await lookup(lead,fetchImpl);}catch{candidates=null;}
      const attempts:NewRemarkReplayReceipt[]=[];
      if(candidates){
        for(const c of candidates.slice(0,options.replayCount))
          attempts.push(await replay(c,fetchImpl));
      }
      result[i]={
        leadId:lead.id,publisher:lead.publisher,originalUrl:lead.sourceUrl,
        currentPageDisplayedDates:[...lead.displayedPublisherDates],
        currentPageNamedSpeakerCandidate:lead.individualSenatorSpeaker,
        currentPagePresentation:lead.publicPagePresentation,
        indexStatus:candidates===null?'index_failed':candidates.length?'index_candidates':'index_empty',
        indexFailureKind:candidates===null?'cdx_unavailable_or_invalid':null,
        firstIndexedCaptureUtc:candidates?.[0]?.utc??null,
        indexedCandidateCount:candidates?.length??null,
        indexFirstPagePossiblyTruncated:(candidates?.length??0)===NEW_REMARKS_CDX_MAX_ROWS,
        unreplayedIndexedCandidateCount:candidates===null?null:candidates.length-attempts.length,
        replayAttempts:attempts,historicalPagePresenceOrAbsenceCertified:false,
        historicSenatorQuoteAuthenticated:false,originalSpokenAudioAuthenticated:false,
        initialPublisherPublicationTimeProven:false,privateSourceRowCompared:false,
        historicPredictionEligibilityVerified:false,
      };
    }
  }
  await Promise.all(Array.from({length:Math.min(leads.length,options.concurrency)},()=>worker()));
  if(result.some(x=>!x))throw Error('Incomplete public archive accounting');
  const done=result as NewRemarkLeadResult[];
  const matched=(row:NewRemarkLeadResult)=>row.replayAttempts.filter(x=>x.matchedIndexedPayload).length;
  return {
    version:NEW_REMARKS_WAYBACK_VERSION,
    sample:'separate_non_exhaustive_18_public_url_leads',scope:options.scope,
    checkedInLeadCount:18,selectedLeadCount:leads.length,cdxIndexRequests:leads.length,
    candidateIndexLeads:done.filter(x=>x.indexStatus==='index_candidates').length,
    emptyIndexLeads:done.filter(x=>x.indexStatus==='index_empty').length,
    failedIndexLeads:done.filter(x=>x.indexStatus==='index_failed').length,
    replayAttempts:done.reduce((s,x)=>s+x.replayAttempts.length,0),
    indexConsistentOriginalHttpBodies:done.reduce((s,x)=>s+matched(x),0),
    distinctOriginalUrlsWithConsistentBodies:done.filter(x=>matched(x)>0).length,
    studyYears:[2021,2022,2023,2024,2025],leads:done,
    noPublicArticleBodyOrAudioPersisted:true,noPrivateSourceDocumentsOrDatabaseAccessed:true,
    noHistoricalQuoteHumanApproved:true,noRecordedVoteOrForecastInferred:true,
    noPublisherOrStatewideCompletenessClaim:true,noProductionConfigurationChanged:true,
  };
}

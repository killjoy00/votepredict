/**
 * #987/#946 PUBLIC-ONLY original Wayback HTTP page proof for the second
 * non-exhaustive cohort of 25 NEW original Minnesota Senate media leads.
 *
 * This script does NOT fetch private VotePredict documents, certify individual
 * quoted words or original audio, infer Senate votes, or establish a publisher
 * publication census. A captured body SHA matches *that* historical version.
 */
import {createHash} from 'node:crypto';

export const BROADER_REMARKS_VERSION='senate-media-2021-25-new-25-exact-public-replay-v1' as const;
export const BROADER_CDX_MAX_ROWS=20;
export const BROADER_CDX_MAX_BYTES=100_000;
export const BROADER_REPLAY_MAX_BYTES=2_500_000;
export const PRIORITY_25_IDS=[
  'public-2022-bigham-eken-separated',
  'public-2023-rest-tax-reformer',
  'public-2021-torres-ray-retirement',
  'public-2024-mcewen-mining',
  'public-2025-clark-ice-student',
] as const;
export type BroaderScope='priority'|'all';
export interface BroaderLead {
  id:string;
  url:string;
  publisher:string;
  currentPageDisplayedDates:string[];
  attributionCategory:string;
  individuallyNamedSenatorSpeakers:{name:string;officialMemberHistoryUrl:string}[];
  existingCohortOverlapCheckedAgainstOriginal31AndEarlier18:true;
  hasOriginalHistoricalArchivedBodySha256:false;
  exactQuoteFragmentHistoricallyChecked:false;
  originalPublishingTimestampVerified:false;
  namedSenatorQuotationApprovedForHistoricalEvidence:false;
  anyPrivateEvidenceReadOrMatched:false;
  anyLegislativeVoteProvedByThisPage:false;
}
export interface BroaderOptions{
  scope:BroaderScope;
  replayCount:0|1|2;
  concurrency:1|2;
}
export type BroaderReplayStatus=
  |'matched_indexed_payload_sha1'
  |'replay_redirect_refused'
  |'replay_http_denied'
  |'replay_mime_unexpected'
  |'replay_index_sha1_mismatch'
  |'replay_too_short'
  |'replay_body_too_large'
  |'replay_fetch_failed';
export interface BroaderOriginalReceipt{
  archiveUrl:string;
  captureUtc:string;
  indexSha1Base32:string;
  replayStatus:BroaderReplayStatus;
  originalRawBodySha256:string|null;
  originalRawBodyBytes:number|null;
  indexOriginalBytesMatched:boolean;
  individualSenatorQuotationHumanApproved:false;
  originalAudioAuthenticated:false;
  originalInitialPublisherPostTimeProven:false;
}
export interface BroaderLeadResult{
  id:string;
  originalPublisher:string;
  originalPublisherUrl:string;
  displayedPublisherDates:string[];
  attributionCategory:string;
  namedSpeakerCandidates:string[];
  indexStatus:'candidates'|'empty'|'unavailable_or_invalid';
  indexCandidateCount:number|null;
  boundedIndexMayHaveMoreVersions:boolean;
  earliestIndexedCaptureUtc:string|null;
  replays:BroaderOriginalReceipt[];
  unreplayedCandidateCount:number|null;
  historicBodyVerifiedForThisOriginalUrl:boolean;
  allCandidateOriginalsCensused:false;
  historicalQuoteSpeakerApproved:false;
  originalSpokenAudioVerified:false;
  firstPublisherPostTimestampVerified:false;
  privateSourceOrVoteDataCompared:false;
}
export interface BroaderProofReport{
  version:typeof BROADER_REMARKS_VERSION;
  scope:BroaderScope;
  originalPublicUrlCohort:'25_curated_original_urls_separate_from_31_and_18';
  selectedLeadCount:number;
  eligibleLedgerLeadCount:25;
  cdxQueries:number;
  indexCandidateUrls:number;
  indexEmptyUrls:number;
  indexUnavailableUrls:number;
  replayAttempts:number;
  indexedSha1ConsistentOriginalBodies:number;
  distinctOriginalUrlsWithSha1ConsistentBodies:number;
  shortHistoricalVerbatimSenatorQuoteHumanApprovals:0;
  originalRadioAudioOrInterviewRecordingApprovals:0;
  firstPublicationTimesAuthenticated:0;
  selectedByDisplayedYear:{year:number;urlLeads:number;matchedOriginalUrlLeads:number}[];
  leads:BroaderLeadResult[];
  noRawOriginalWebpageOrAudioPersisted:true;
  noPrivateSourceOrVoteDataRead:true;
  noStatewideOrPublisherCoverageDenominatorEstablished:true;
  noSenatorSpeechOrForecastAutomaticallyApproved:true;
  noProductionIngestionOrModelSettingsChanged:true;
}
interface Indexed {
  originalUrl:string;
  timestamp:string;
  captureUtc:string;
  digest:string;
  mime:string;
  archiveUrl:string;
}
const KNOWN_HOSTS=new Map<string,string>([
  ['senatedfl.mn','Minnesota Senate DFL'],
  ['www.mnsenaterepublicans.com','Minnesota Senate Republicans'],
  ['minnesotareformer.com','Minnesota Reformer'],
]);
const MIME=new Set(['text/html','application/xhtml+xml','text/plain']);
const SHA1=/^[A-Z2-7]{32}$/;
const SHA256=/^[a-f0-9]{64}$/;
const DATE=/^20(?:21|22|23|24|25)-\d\d-\d\d$/;
const CLOCK=/^\d{14}$/;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function exactUtc(clock:string):string{
  if(!CLOCK.test(clock))throw Error('Invalid Wayback capture clock');
  const iso=clock.slice(0,4)+'-'+clock.slice(4,6)+'-'+clock.slice(6,8)
    +'T'+clock.slice(8,10)+':'+clock.slice(10,12)+':'+clock.slice(12,14)+'Z';
  const parsed=Date.parse(iso);
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString()!==iso.replace('Z','.000Z')
    ||!DATE.test(iso.slice(0,10)))
    throw Error('CDX timestamp outside 2021-2025 or malformed');
  return iso;
}
function originalUrl(lead:BroaderLead):void{
  let u:URL;
  try{u=new URL(lead.url);}catch{throw Error('Unsafe original public URL');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash
    ||u.toString()!==lead.url||u.pathname.length<8||u.pathname.length>300
    ||!/^[a-z0-9/_-]+\/?$/.test(u.pathname)
    ||KNOWN_HOSTS.get(u.hostname)!==lead.publisher)
    throw Error('Unsafe or cross-publisher public URL');
}
export function selectBroaderPublicLeads(ledger:readonly BroaderLead[],scope:BroaderScope):BroaderLead[]{
  if(scope!=='all'&&scope!=='priority')throw Error('Unknown bounded research scope');
  if(!Array.isArray(ledger)||ledger.length!==25)
    throw Error('Expected exact 25 public-media URL research cohort');
  const ids=new Set<string>(),urls=new Set<string>();
  const counts=new Map<number,number>();
  for(const l of ledger){
    if(!l||typeof l.id!=='string'
      ||!/^public-20(?:21|22|23|24|25)-[a-z0-9-]+$/.test(l.id)
      ||typeof l.url!=='string'||ids.has(l.id)||urls.has(l.url)
      ||!Array.isArray(l.currentPageDisplayedDates)
      ||l.currentPageDisplayedDates.length<1||l.currentPageDisplayedDates.length>2
      ||l.currentPageDisplayedDates.some((date:string)=>
        !DATE.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))
        ||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date
        ||date.slice(0,4)!==l.id.slice(7,11))
      ||!Array.isArray(l.individuallyNamedSenatorSpeakers)
      ||l.individuallyNamedSenatorSpeakers.length>2
      ||l.individuallyNamedSenatorSpeakers.some(x=>
        typeof x?.name!=='string'||x.name.length<6||
        !/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/
          .test(x.officialMemberHistoryUrl))
      ||!['individual','two_labeled_individuals','independent_reporter_attributed',
        'mixed_chamber_collective','unattributed_caucus_collective'].includes(l.attributionCategory)
      ||(['mixed_chamber_collective','unattributed_caucus_collective'].includes(l.attributionCategory)
        &&l.individuallyNamedSenatorSpeakers.length!==0)
      ||(['individual','independent_reporter_attributed'].includes(l.attributionCategory)
        &&l.individuallyNamedSenatorSpeakers.length!==1)
      ||(l.attributionCategory==='two_labeled_individuals'
        &&l.individuallyNamedSenatorSpeakers.length!==2)
      ||l.existingCohortOverlapCheckedAgainstOriginal31AndEarlier18!==true
      ||l.hasOriginalHistoricalArchivedBodySha256!==false
      ||l.exactQuoteFragmentHistoricallyChecked!==false
      ||l.originalPublishingTimestampVerified!==false
      ||l.namedSenatorQuotationApprovedForHistoricalEvidence!==false
      ||l.anyPrivateEvidenceReadOrMatched!==false
      ||l.anyLegislativeVoteProvedByThisPage!==false)
      throw Error('Malformed or prematurely approved public original remark lead');
    originalUrl(l);
    ids.add(l.id);urls.add(l.url);
    const y=Number(l.id.slice(7,11));
    counts.set(y,(counts.get(y)??0)+1);
  }
  for(const y of [2021,2022,2023,2024,2025])
    if(counts.get(y)!==5)throw Error('Expected exactly five newly discovered URLs per displayed year');
  if(scope==='all')return [...ledger];
  return PRIORITY_25_IDS.map(id=>{
    const l=ledger.find(x=>x.id===id);
    if(!l)throw Error('Priority source ID not in the original public ledger');
    return l;
  });
}
function parseIndex(payload:unknown,lead:BroaderLead):Indexed[]{
  if(!Array.isArray(payload)||!Array.isArray(payload[0])||payload.length>21)
    throw Error('Invalid bounded CDX index rows');
  const head=payload[0] as unknown[];
  if(head.some(x=>typeof x!=='string')||new Set(head).size!==head.length
    ||['timestamp','original','mimetype','statuscode','digest','length']
      .some(x=>!head.includes(x)))
    throw Error('Invalid CDX index provenance');
  const val=(row:unknown[],key:string):string=>{
    const v=row[head.indexOf(key)];
    if(typeof v!=='string')throw Error('CDX index field not a string');
    return v;
  };
  const out:Indexed[]=[];
  const seen=new Map<string,string>();
  for(const v of payload.slice(1)){
    if(!Array.isArray(v)||v.length!==head.length)throw Error('Invalid CDX row');
    const t=val(v,'timestamp'),original=val(v,'original');
    const mime=val(v,'mimetype').toLowerCase();
    const digest=val(v,'digest').toUpperCase();
    const length=val(v,'length');
    if(original!==lead.url||!MIME.has(mime)||!SHA1.test(digest)
      ||val(v,'statuscode')!=='200'
      ||!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length)))
      throw Error('CDX indexed response cannot authenticate original');
    const stamp=exactUtc(t);
    const signature=JSON.stringify([original,mime,digest,length]);
    if(seen.has(t)){
      if(seen.get(t)!==signature)throw Error('Contradictory historical CDX record');
      continue;
    }
    seen.set(t,signature);
    out.push({timestamp:t,originalUrl:original,mime,digest,captureUtc:stamp,
      archiveUrl:'https://web.archive.org/web/'+t+'id_/'+original});
  }
  return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function limitedBytes(response:Response,cap:number):Promise<Uint8Array>{
  const len=response.headers.get('content-length');
  if(len!==null&&(!/^(0|[1-9]\d*)$/.test(len)||!Number.isSafeInteger(Number(len))
    ||Number(len)>cap))throw Error('body_size_limit');
  if(!response.body)throw Error('body_short');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  while(true){
    const next=await reader.read();
    if(next.done)break;
    size+=next.value.byteLength;
    if(size>cap){
      await reader.cancel().catch(()=>undefined);
      throw Error('body_size_limit');
    }
    chunks.push(next.value);
  }
  if(size<40)throw Error('body_short');
  const merged=new Uint8Array(size);let offset=0;
  for(const c of chunks){merged.set(c,offset);offset+=c.byteLength;}
  return merged;
}
function base32(buffer:Uint8Array):string{
  let word=0,bits=0,out='';
  for(const n of buffer){
    word=(word<<8)|n;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(word>>>bits)&31];}
    word&=(1<<bits)-1;
  }
  if(bits)out+=B32[(word<<(5-bits))&31];
  return out;
}
async function cdx(lead:BroaderLead,fetchImpl:typeof fetch):Promise<Indexed[]>{
  const search=new URLSearchParams({
    url:lead.url,matchType:'exact',from:'2021',to:'2025',
    output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',limit:String(BROADER_CDX_MAX_ROWS),
  });
  const resp=await fetchImpl('https://web.archive.org/cdx/search/cdx?'+search.toString(),{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
    headers:{accept:'application/json','user-agent':'VotePredict/2.0 public-senate-media-original-proof'},
  });
  if(resp.status!==200 ||(resp.headers.get('content-type')??'')
    .split(';')[0]?.trim().toLowerCase()!=='application/json')
    throw Error('Public archive CDX network or format unavailable');
  const bytes=await limitedBytes(resp,BROADER_CDX_MAX_BYTES);
  return parseIndex(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown,lead);
}
function note(c:Indexed,status:BroaderReplayStatus,sha:string|null=null,n:number|null=null):BroaderOriginalReceipt{
  if(sha!==null&&!SHA256.test(sha))throw Error('Invalid observed digest');
  return {
    archiveUrl:c.archiveUrl,captureUtc:c.captureUtc,indexSha1Base32:c.digest,
    replayStatus:status,originalRawBodySha256:sha,originalRawBodyBytes:n,
    indexOriginalBytesMatched:status==='matched_indexed_payload_sha1',
    individualSenatorQuotationHumanApproved:false,originalAudioAuthenticated:false,
    originalInitialPublisherPostTimeProven:false,
  };
}
async function replay(c:Indexed,fetchImpl:typeof fetch):Promise<BroaderOriginalReceipt>{
  try{
    if(c.captureUtc!==exactUtc(c.timestamp)||!SHA1.test(c.digest)
      ||!MIME.has(c.mime)
      ||c.archiveUrl!=='https://web.archive.org/web/'+c.timestamp+'id_/'+c.originalUrl)
      throw Error('Original archive replay URL modified');
    const resp=await fetchImpl(c.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html,application/xhtml+xml,text/plain',
        'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-senate-media-original-proof'},
    });
    if(resp.status>=300&&resp.status<400)return note(c,'replay_redirect_refused');
    if(resp.status!==200)return note(c,'replay_http_denied');
    const mime=(resp.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase();
    if(mime!==c.mime)return note(c,'replay_mime_unexpected');
    const bytes=await limitedBytes(resp,BROADER_REPLAY_MAX_BYTES);
    if(base32(createHash('sha1').update(bytes).digest())!==c.digest)
      return note(c,'replay_index_sha1_mismatch');
    return note(c,'matched_indexed_payload_sha1',
      createHash('sha256').update(bytes).digest('hex'),bytes.byteLength);
  }catch(e){
    if(e instanceof Error&&e.message==='body_size_limit')return note(c,'replay_body_too_large');
    if(e instanceof Error&&e.message==='body_short')return note(c,'replay_too_short');
    return note(c,'replay_fetch_failed');
  }
}
export async function proveBroaderOriginals(
  fullLedger:readonly BroaderLead[],opts:BroaderOptions,
  fetchImpl:typeof fetch=fetch,
):Promise<BroaderProofReport>{
  if(![0,1,2].includes(opts.replayCount)||![1,2].includes(opts.concurrency))
    throw Error('Unsafe bounded archival research settings');
  const chosen=selectBroaderPublicLeads(fullLedger,opts.scope);
  const results:Array<BroaderLeadResult|undefined>=Array(chosen.length);
  let next=0;
  async function worker(){
    while(next<chosen.length){
      const i=next++,lead=chosen[i]!;
      let indexed:Indexed[]|null;
      try{indexed=await cdx(lead,fetchImpl);}catch{indexed=null;}
      const replays:BroaderOriginalReceipt[]=[];
      if(indexed!==null)
        for(const c of indexed.slice(0,opts.replayCount))
          replays.push(await replay(c,fetchImpl));
      results[i]={
        id:lead.id,originalPublisher:lead.publisher,originalPublisherUrl:lead.url,
        displayedPublisherDates:[...lead.currentPageDisplayedDates],
        attributionCategory:lead.attributionCategory,
        namedSpeakerCandidates:lead.individuallyNamedSenatorSpeakers.map(x=>x.name),
        indexStatus:indexed===null?'unavailable_or_invalid':indexed.length?'candidates':'empty',
        indexCandidateCount:indexed?.length??null,
        boundedIndexMayHaveMoreVersions:(indexed?.length??0)===BROADER_CDX_MAX_ROWS,
        earliestIndexedCaptureUtc:indexed?.[0]?.captureUtc??null,
        replays,unreplayedCandidateCount:indexed===null?null:indexed.length-replays.length,
        historicBodyVerifiedForThisOriginalUrl:replays.some(x=>x.indexOriginalBytesMatched),
        allCandidateOriginalsCensused:false,
        historicalQuoteSpeakerApproved:false,originalSpokenAudioVerified:false,
        firstPublisherPostTimestampVerified:false,privateSourceOrVoteDataCompared:false,
      };
    }
  }
  await Promise.all(Array.from({length:Math.min(opts.concurrency,chosen.length)},()=>worker()));
  if(results.some(x=>!x))throw Error('Incomplete original historical source accounting');
  const rows=results as BroaderLeadResult[];
  return {
    version:BROADER_REMARKS_VERSION,scope:opts.scope,
    originalPublicUrlCohort:'25_curated_original_urls_separate_from_31_and_18',
    selectedLeadCount:chosen.length,eligibleLedgerLeadCount:25,cdxQueries:chosen.length,
    indexCandidateUrls:rows.filter(x=>x.indexStatus==='candidates').length,
    indexEmptyUrls:rows.filter(x=>x.indexStatus==='empty').length,
    indexUnavailableUrls:rows.filter(x=>x.indexStatus==='unavailable_or_invalid').length,
    replayAttempts:rows.reduce((s,x)=>s+x.replays.length,0),
    indexedSha1ConsistentOriginalBodies:rows.reduce((s,x)=>
      s+x.replays.filter(y=>y.indexOriginalBytesMatched).length,0),
    distinctOriginalUrlsWithSha1ConsistentBodies:rows.filter(x=>x.historicBodyVerifiedForThisOriginalUrl).length,
    shortHistoricalVerbatimSenatorQuoteHumanApprovals:0,
    originalRadioAudioOrInterviewRecordingApprovals:0,firstPublicationTimesAuthenticated:0,
    selectedByDisplayedYear:[2021,2022,2023,2024,2025].map(year=>{
      const sample=rows.filter(x=>x.displayedPublisherDates[0]?.startsWith(String(year)));
      return {year,urlLeads:sample.length,
        matchedOriginalUrlLeads:sample.filter(x=>x.historicBodyVerifiedForThisOriginalUrl).length};
    }),
    leads:rows,noRawOriginalWebpageOrAudioPersisted:true,
    noPrivateSourceOrVoteDataRead:true,noStatewideOrPublisherCoverageDenominatorEstablished:true,
    noSenatorSpeechOrForecastAutomaticallyApproved:true,noProductionIngestionOrModelSettingsChanged:true,
  };
}

/**
 * #987/#946 PUBLIC independent newsroom original HTML research.
 * Exact 15 additional Minnesota Reformer reporting URLs, 3 each displayed
 * year 2021–25, 24 individually named serving state senator speaker candidates (including corrections for Roger Chamberlain, Judy Seeberger and Jen McEwen).
 * This is NOT a source census or approval of original spoken audio or votes.
 */
import {createHash} from 'node:crypto';

export const JOURNALIST_WAYBACK_VERSION='senate-media-2021-25-independent-reporter-15-original-replay-v1' as const;
const SOURCE_HOST='minnesotareformer.com';
const INDEX_MAX_BYTES=100_000;
const INDEX_MAX_ROWS=20;
const ORIGINAL_MAX_BYTES=2_500_000;
const MIME=new Set(['text/html','application/xhtml+xml','text/plain']);
const SHA1=/^[A-Z2-7]{32}$/;
const DATE=/^20(?:21|22|23|24|25)-\d\d-\d\d$/;
const CLOCK=/^\d{14}$/;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export type JournalistScope='priority'|'all';
export interface JournalistSpeaker{
  name:string;officialMemberServiceUrl:string;reporterAttributionMode:string;
  historicalRecordedIndividualQuoteApproved:false;
}
export interface JournalistLead{
  id:string;originalPublisherUrl:string;originalPublisher:string;
  displayedNewsPublicationDay:string;byline:string;reporterAttributionCaveat:string;
  namedSenatorSpeakerTurnCandidates:JournalistSpeaker[];
  exactWaybackOriginalRawBytesAlreadyVerified:false;
  individualHistoricWordsHumanApproved:false;
  originalAudioAuthenticated:false;initialPublisherPostingClockProven:false;
  observedMemberFloorOrCommitteeVoteInferred:false;
}
export interface JournalistOptions{
  scope:JournalistScope;replayCount:0|1|2;concurrency:1|2|3;
}
export const JOURNALIST_PRIORITY_IDS=[
  'new-reporter-2021-clean-cars',
  'new-reporter-2022-curriculum',
  'new-reporter-2023-family-leave',
  'new-reporter-2024-gun-proposals',
  'new-reporter-2025-solar',
] as const;
export type JournalistReplayStatus=
  |'indexed_sha1_original_body_matched'
  |'archive_redirect_refused_unknown'
  |'archive_http_denied_unknown'
  |'archive_mime_unexpected_unknown'
  |'archive_index_sha1_mismatch_unknown'
  |'archive_response_too_short_unknown'
  |'archive_response_too_large_unknown'
  |'archive_fetch_unknown';
export interface JournalistCaptureReceipt{
  exactOriginalReplayUrl:string;captureUtc:string;indexedOriginalSha1Base32:string;
  replayStatus:JournalistReplayStatus;
  sha1ConsistentOriginalRawBody:boolean;
  observedOriginalRawSha256:string|null;observedOriginalRawBytes:number|null;
  individuallySpokenAudioChecked:false;actualMemberVoteProven:false;
  historicalQuoteHumanApproved:false;
}
export interface JournalistSourceResult{
  id:string;originalReporterArticleUrl:string;displayedDay:string;
  authorLine:string;sourcePublisher:'Minnesota Reformer';
  distinctNamedSenatorSpeechCandidates:string[];
  sourceAttributionModes:string[];
  indexStatus:'indexed_candidates'|'index_empty'|'index_unavailable_or_invalid';
  candidateIndexedVersionCount:number|null;
  earliestIndexedExactCaptureUtc:string|null;
  first20IndexRowsMayNotRepresentFullArchive:boolean;
  archiveExactOriginalReplays:JournalistCaptureReceipt[];
  authenticHistoricalOriginalBodyObserved:boolean;
  originalPublisherFirstPostingTimeProven:false;
  individualSenatorAudioOrQuoteHumanApproved:false;
  originalLegislativeVoteVerified:false;
  privateEvidenceCompared:false;
}
export interface JournalistReport{
  version:typeof JOURNALIST_WAYBACK_VERSION;
  scope:JournalistScope;
  sourceSelection:'15_additional_independent_reformer_articles_separate_from_31_18_25';
  checkedInOriginalSourceUrlLeads:15;
  selectedOriginalArticleUrls:number;
  originalCdxExactIndexRequests:number;
  indexedCandidateUrlLeads:number;
  indexUnavailableOrInvalidUrlLeads:number;
  indexEmptyUrlLeads:number;
  originalCaptureReplayAttempts:number;
  sha1MatchedActualOriginalHttpBodies:number;
  distinctReporterArticleUrlsWithAuthenticatedOriginalBodies:number;
  selectedYearCoverage:{year:number;selectedOriginalUrls:number;sourceUrlsWithVerifiedOriginalBodies:number}[];
  sourceResults:JournalistSourceResult[];
  originalAudioApproved:0;
  fullHistoricalSenatorQuotationHumanApproved:0;
  originalPublisherInitialPostClocksProven:0;
  actualRecordedIndividualLegislativeVotesProven:0;
  noRawNewsArticleHtmlOrAudioSaved:true;
  noPrivateDataRead:true;
  noStatewidePublisherMediaPopulationDenominator:true;
  noModelOrProductionMediaIngestionChanged:true;
}
interface IndexCandidate{
  timestamp:string;utc:string;originalUrl:string;mime:string;indexSha1Base32:string;
  exactOriginalReplayUrl:string;
}
function clock(t:string):string{
  if(!CLOCK.test(t))throw Error('Invalid CDX indexed UTC timestamp');
  const iso=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)
    +'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14)+'Z';
  if(!DATE.test(iso.slice(0,10))||!Number.isFinite(Date.parse(iso))
    ||new Date(iso).toISOString()!==iso.replace('Z','.000Z'))
    throw Error('Unusable indexed public original capture time');
  return iso;
}
function base32(bytes:Uint8Array):string{
  let v=0,bits=0,out='';
  for(const b of bytes){
    v=(v<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}
    v&=(1<<bits)-1;
  }
  if(bits)out+=B32[(v<<(5-bits))&31];
  return out;
}
export function selectJournalistSources(leads:readonly JournalistLead[],scope:JournalistScope):JournalistLead[]{
  if(!['priority','all'].includes(scope))throw Error('Invalid public reporting scope');
  if(!Array.isArray(leads)||leads.length!==15)
    throw Error('Expected exactly 15 public journalist-original URL leads');
  const urls=new Set<string>(),ids=new Set<string>();
  const byYear=new Map<string,number>();let speakers=0;
  for(const x of leads){
    if(!x||typeof x.id!=='string'
      ||!/^new-reporter-20(?:21|22|23|24|25)-[a-z0-9-]+$/.test(x.id)
      ||ids.has(x.id)||typeof x.originalPublisherUrl!=='string'
      ||urls.has(x.originalPublisherUrl)||x.originalPublisher!=='Minnesota Reformer'
      ||!DATE.test(x.displayedNewsPublicationDay)
      ||new Date(x.displayedNewsPublicationDay+'T00:00:00Z').toISOString().slice(0,10)!==x.displayedNewsPublicationDay
      ||x.displayedNewsPublicationDay.slice(0,4)!==x.id.slice(13,17)
      ||typeof x.byline!=='string'||x.byline.length<5
      ||typeof x.reporterAttributionCaveat!=='string'||x.reporterAttributionCaveat.length<20
      ||!Array.isArray(x.namedSenatorSpeakerTurnCandidates)
      ||x.namedSenatorSpeakerTurnCandidates.length<1||x.namedSenatorSpeakerTurnCandidates.length>3
      ||x.exactWaybackOriginalRawBytesAlreadyVerified!==false
      ||x.individualHistoricWordsHumanApproved!==false
      ||x.originalAudioAuthenticated!==false
      ||x.initialPublisherPostingClockProven!==false
      ||x.observedMemberFloorOrCommitteeVoteInferred!==false)
      throw Error('Invalid unapproved original journalist article record');
    let u:URL;
    try{u=new URL(x.originalPublisherUrl);}catch{throw Error('Unsafe newsroom original URL');}
    if(u.protocol!=='https:'||u.hostname!==SOURCE_HOST||u.username||u.password
      ||u.port||u.hash||u.search||u.toString()!==x.originalPublisherUrl
      ||u.pathname.length<20||u.pathname.length>230
      ||!/^[a-z0-9/_-]+\/$/.test(u.pathname))
      throw Error('External or untrusted journalist source URL');
    for(const sen of x.namedSenatorSpeakerTurnCandidates){
      if(!sen||typeof sen.name!=='string'||sen.name.length<6
        ||!/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/.test(sen.officialMemberServiceUrl)
        ||typeof sen.reporterAttributionMode!=='string'
        ||!/^(interview|quoted_report|public_statement|quoted_public_statement|reported_[a-z_]+)$/.test(sen.reporterAttributionMode)
        ||sen.historicalRecordedIndividualQuoteApproved!==false)
        throw Error('Untrusted reporter attribution or serving senator ID');
    }
    speakers+=x.namedSenatorSpeakerTurnCandidates.length;
    const y=x.displayedNewsPublicationDay.slice(0,4);
    byYear.set(y,(byYear.get(y)??0)+1);
    urls.add(x.originalPublisherUrl);ids.add(x.id);
  }
  if(speakers!==24||[2021,2022,2023,2024,2025].some(y=>byYear.get(String(y))!==3))
    throw Error('Unexpected individual speaker/year sample coverage');
  if(scope==='all')return [...leads];
  return JOURNALIST_PRIORITY_IDS.map(id=>{
    const match=leads.find(x=>x.id===id);
    if(!match)throw Error('Priority reporter source missing');
    return match;
  });
}
async function bytesBounded(response:Response,cap:number):Promise<Uint8Array>{
  const stated=response.headers.get('content-length');
  if(stated!==null&&(!/^(0|[1-9]\d*)$/.test(stated)
    ||!Number.isSafeInteger(Number(stated))||Number(stated)>cap))
    throw Error('size_limit');
  if(!response.body)throw Error('too_short');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let length=0;
  while(true){
    const x=await reader.read();if(x.done)break;
    length+=x.value.byteLength;
    if(length>cap){await reader.cancel().catch(()=>undefined);throw Error('size_limit');}
    chunks.push(x.value);
  }
  if(length<40)throw Error('too_short');
  const data=new Uint8Array(length);let i=0;
  for(const part of chunks){data.set(part,i);i+=part.byteLength;}
  return data;
}
function parseIndex(x:unknown,lead:JournalistLead):IndexCandidate[]{
  if(!Array.isArray(x)||x.length<1||x.length>INDEX_MAX_ROWS+1
    ||!Array.isArray(x[0])||x[0].some(v=>typeof v!=='string'))
    throw Error('Invalid public CDX index response');
  const header=x[0] as string[];
  if(new Set(header).size!==header.length||['timestamp','original','mimetype','statuscode','digest','length']
    .some(k=>!header.includes(k)))throw Error('Unusable CDX index header');
  const out:IndexCandidate[]=[];
  const seen=new Map<string,string>();
  for(const source of x.slice(1)){
    if(!Array.isArray(source)||source.length!==header.length)throw Error('Invalid original index row');
    const val=(key:string):string=>{
      const v=source[header.indexOf(key)];
      if(typeof v!=='string')throw Error('Nonstring original index field');
      return v;
    };
    const t=val('timestamp'),original=val('original'),mime=val('mimetype').toLowerCase(),
      status=val('statuscode'),digest=val('digest').toUpperCase(),len=val('length');
    const utc=clock(t);
    if(original!==lead.originalPublisherUrl||status!=='200'||!MIME.has(mime)
      ||!SHA1.test(digest)||!/^\d+$/.test(len)||!Number.isSafeInteger(Number(len)))
      throw Error('Original URL or response digest not trustworthy');
    const signature=[original,mime,status,digest,len].join('|');
    if(seen.has(t)){
      if(seen.get(t)!==signature)throw Error('Contradictory indexed archive same UTC');
      continue;
    }
    seen.set(t,signature);
    out.push({timestamp:t,utc,originalUrl:original,mime,indexSha1Base32:digest,
      exactOriginalReplayUrl:'https://web.archive.org/web/'+t+'id_/'+original});
  }
  return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function index(lead:JournalistLead,request:typeof fetch):Promise<IndexCandidate[]>{
  const params=new URLSearchParams({
    url:lead.originalPublisherUrl,matchType:'exact',
    from:'2021',to:'2025',output:'json',
    fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',limit:String(INDEX_MAX_ROWS),
  });
  const r=await request('https://web.archive.org/cdx/search/cdx?'+params.toString(),{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
    headers:{accept:'application/json',
      'user-agent':'VotePredict/2.0 public-independent-newsroom-original-sources'},
  });
  if(r.status!==200
    ||(r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='application/json')
    throw Error('CDX original URL index unavailable');
  const raw=await bytesBounded(r,INDEX_MAX_BYTES);
  return parseIndex(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)) as unknown,lead);
}
function result(c:IndexCandidate,status:JournalistReplayStatus,
  rawSha:string|null=null,len:number|null=null):JournalistCaptureReceipt{
  return {
    exactOriginalReplayUrl:c.exactOriginalReplayUrl,captureUtc:c.utc,
    indexedOriginalSha1Base32:c.indexSha1Base32,replayStatus:status,
    sha1ConsistentOriginalRawBody:status==='indexed_sha1_original_body_matched',
    observedOriginalRawSha256:rawSha,observedOriginalRawBytes:len,
    individuallySpokenAudioChecked:false,actualMemberVoteProven:false,
    historicalQuoteHumanApproved:false,
  };
}
async function replay(c:IndexCandidate,request:typeof fetch):Promise<JournalistCaptureReceipt>{
  try{
    if(!SHA1.test(c.indexSha1Base32)
      ||c.utc!==clock(c.timestamp)
      ||c.exactOriginalReplayUrl!=='https://web.archive.org/web/'+c.timestamp+'id_/'+c.originalUrl)
      throw Error('Untrusted original URL');
    const r=await request(c.exactOriginalReplayUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html,application/xhtml+xml,text/plain',
        'accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-independent-newsroom-original-sources'},
    });
    if(r.status>=300&&r.status<400)return result(c,'archive_redirect_refused_unknown');
    if(r.status!==200)return result(c,'archive_http_denied_unknown');
    const content=(r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase();
    if(content!==c.mime)return result(c,'archive_mime_unexpected_unknown');
    const raw=await bytesBounded(r,ORIGINAL_MAX_BYTES);
    if(base32(createHash('sha1').update(raw).digest())!==c.indexSha1Base32)
      return result(c,'archive_index_sha1_mismatch_unknown');
    return result(c,'indexed_sha1_original_body_matched',
      createHash('sha256').update(raw).digest('hex'),raw.byteLength);
  }catch(e){
    if(e instanceof Error&&e.message==='size_limit')
      return result(c,'archive_response_too_large_unknown');
    if(e instanceof Error&&e.message==='too_short')
      return result(c,'archive_response_too_short_unknown');
    return result(c,'archive_fetch_unknown');
  }
}
export async function probeIndependentJournalistOriginals(
  full:readonly JournalistLead[],opts:JournalistOptions,request:typeof fetch=fetch,
):Promise<JournalistReport>{
  if(![0,1,2].includes(opts.replayCount)||![1,2,3].includes(opts.concurrency))
    throw Error('Unbounded original journalistic source replay settings');
  const selected=selectJournalistSources(full,opts.scope),out:Array<JournalistSourceResult|undefined>=Array(selected.length);
  let next=0;
  async function worker(){
    while(next<selected.length){
      const i=next++,lead=selected[i]!;
      let indices:IndexCandidate[]|null;
      try{indices=await index(lead,request);}catch{indices=null;}
      const replays:JournalistCaptureReceipt[]=[];
      if(indices!==null)for(const cap of indices.slice(0,opts.replayCount))
        replays.push(await replay(cap,request));
      out[i]={
        id:lead.id,originalReporterArticleUrl:lead.originalPublisherUrl,
        displayedDay:lead.displayedNewsPublicationDay,authorLine:lead.byline,
        sourcePublisher:'Minnesota Reformer',
        distinctNamedSenatorSpeechCandidates:lead.namedSenatorSpeakerTurnCandidates.map(x=>x.name),
        sourceAttributionModes:lead.namedSenatorSpeakerTurnCandidates.map(x=>x.reporterAttributionMode),
        indexStatus:indices===null?'index_unavailable_or_invalid'
          :indices.length?'indexed_candidates':'index_empty',
        candidateIndexedVersionCount:indices?.length??null,
        earliestIndexedExactCaptureUtc:indices?.[0]?.utc??null,
        first20IndexRowsMayNotRepresentFullArchive:(indices?.length??0)===INDEX_MAX_ROWS,
        archiveExactOriginalReplays:replays,
        authenticHistoricalOriginalBodyObserved:replays.some(x=>x.sha1ConsistentOriginalRawBody),
        originalPublisherFirstPostingTimeProven:false,
        individualSenatorAudioOrQuoteHumanApproved:false,
        originalLegislativeVoteVerified:false,privateEvidenceCompared:false,
      };
    }
  }
  await Promise.all(Array.from({length:Math.min(selected.length,opts.concurrency)},()=>worker()));
  if(out.some(x=>!x))throw Error('Incomplete publisher article archive provenance');
  const rows=out as JournalistSourceResult[];
  return {
    version:JOURNALIST_WAYBACK_VERSION,scope:opts.scope,
    sourceSelection:'15_additional_independent_reformer_articles_separate_from_31_18_25',
    checkedInOriginalSourceUrlLeads:15,selectedOriginalArticleUrls:selected.length,
    originalCdxExactIndexRequests:selected.length,
    indexedCandidateUrlLeads:rows.filter(x=>x.indexStatus==='indexed_candidates').length,
    indexUnavailableOrInvalidUrlLeads:rows.filter(x=>x.indexStatus==='index_unavailable_or_invalid').length,
    indexEmptyUrlLeads:rows.filter(x=>x.indexStatus==='index_empty').length,
    originalCaptureReplayAttempts:rows.reduce((n,x)=>n+x.archiveExactOriginalReplays.length,0),
    sha1MatchedActualOriginalHttpBodies:rows.reduce((n,x)=>n+
      x.archiveExactOriginalReplays.filter(y=>y.sha1ConsistentOriginalRawBody).length,0),
    distinctReporterArticleUrlsWithAuthenticatedOriginalBodies:rows.filter(x=>
      x.authenticHistoricalOriginalBodyObserved).length,
    selectedYearCoverage:[2021,2022,2023,2024,2025].map(year=>{
      const sample=rows.filter(x=>x.displayedDay.startsWith(String(year)));
      return {year,selectedOriginalUrls:sample.length,
        sourceUrlsWithVerifiedOriginalBodies:sample.filter(x=>x.authenticHistoricalOriginalBodyObserved).length};
    }),
    sourceResults:rows,originalAudioApproved:0,fullHistoricalSenatorQuotationHumanApproved:0,
    originalPublisherInitialPostClocksProven:0,actualRecordedIndividualLegislativeVotesProven:0,
    noRawNewsArticleHtmlOrAudioSaved:true,noPrivateDataRead:true,
    noStatewidePublisherMediaPopulationDenominator:true,noModelOrProductionMediaIngestionChanged:true,
  };
}

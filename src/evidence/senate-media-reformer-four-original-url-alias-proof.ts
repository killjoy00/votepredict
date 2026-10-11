/**
 * #946 PUBLIC-only: four 2022–25 Minnesota Reformer /briefs/ vs YYYY/MM/DD
 * publisher path hypotheses. Do not deduplicate on title, URL slug, present-day
 * page parity, or a unilateral canonical header. Historical exact HTTP body
 * index SHA1 and raw SHA256 receipts first. No raw article text saved.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';

export const ALIAS_VERSION='senate-media-four-reformer-public-original-url-alias-proof-v1' as const;
const HOST='minnesotareformer.com';
const MAX_INDEX=100_000,MAX_HTML=2_500_000,MAX_ROWS=20;
const SHA1=/^[A-Z2-7]{32}$/;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const REQUIRED=[
 ['public-safety-2022','mn-reformer-2022-dfl-public-safety-brief','mn-reformer-2022-dfl-public-safety-dated'],
 ['driver-licenses-2023','mn-reformer-2023-driver-licenses','mn-reformer-2023-driver-licenses-dated'],
 ['sanctuary-2024','mn-reformer-2024-sanctuary-brief','mn-reformer-2024-sanctuary-dated'],
 ['road-signs-2025','mn-reformer-2025-road-signs-brief','mn-reformer-2025-road-signs-dated'],
] as const;
export interface AliasPair{
 pair:string;briefId:string;briefOriginalUrl:string;datedId:string;datedOriginalUrl:string;
}
export interface AliasQueue{
 version:string;observedOn:string;original31UrlLeadLedger:string;
 previousOriginalIndexedShaReceipts:string;pairs:AliasPair[];
 samePresentDayTitleDoesNotProveHistoricallyIdenticalArticle:true;
 noPathAliasResolutionWithoutBothOriginalArchivedBodies:true;
 noAutomaticArticleDuplicateMerger:true;
 originalPublicationTimeUnknown:true;
 noSenatorQuoteOrVoteAutomaticallyApproved:true;
 originalHtmlAudioNotPersisted:true;
}
export interface OldOriginalLead{id:string;livePageUrl:string;}
export interface PreviousOriginalDigest{
 indexConsistentCaptureReceipts:Array<{
  leadId:string;archivedCaptureUtc:string;observedOriginalHtmlSha256:string;observedRawBodyBytes:number;
  indexedPayloadSha1Base32:string;
 }>;
}
type IndexResult='index_candidates'|'index_empty'|'index_unavailable_unknown';
type ReplayResult='indexed_sha1_original_html_authenticated'|
 'archive_redirect_unknown'|'archive_http_unknown'|'archive_mime_unknown'|
 'archive_indexed_sha1_mismatch_unknown'|'archive_too_big_unknown'|
 'archive_too_short_unknown'|'archive_fetch_failed_unknown';
interface Indexed{
 timestamp:string;captureUtc:string;indexedSha1Base32:string;
 mime:string;originalUrl:string;
}
export interface AliasOriginalVersion{
 originalArchiveUtc:string;indexedSha1Base32:string;
 archivedReplayUrl:string;status:ReplayResult;
 rawSha256:string|null;rawBytes:number|null;
 previouslyVerifiedSameCaptureSha256Matches:boolean|null;
 historicRawHtmlCanonicalUrlIfEitherOriginalPair:string|null;
 normalizedVisiblePageTextSha256:string|null;
 originalPublisherHtmlOrAudioSaved:false;
}
export interface AliasUrlStatus{
 originalSourceUrl:string;sourceId:string;role:'brief'|'dated';
 first20IndexedCandidates:number|null;
 indexStatus:IndexResult;
 selectedHistoricallyIndexedUtc:string[];
 actualOriginalReplays:AliasOriginalVersion[];
 originalHtmlVerifiedInAtLeastOneArchiveVersion:boolean;
}
export interface AliasRelationship{
 pair:string;brief:AliasUrlStatus;dated:AliasUrlStatus;
 bothOriginalUrlVariantsHistoricallySha1Verified:boolean;
 sharedHistoricalCanonicalUrlObserved:boolean;
 identicalNormalizedVisibleArchivedHtmlPageTextSha256Observed:boolean;
 historicalUrlIdentityProvenAndSafeToDeduplicate:false;
 historicSamePathSlugDoesNotProveSameArticle:true;
 unknownCdxOrUnverifiedReplayIsNotNegativeProof:true;
 noPublisherFirstPostClockEstablished:true;
}
export interface AliasReport{
 version:typeof ALIAS_VERSION;
 originalPublisherUrlAliasHypotheses:4;
 independentlyQueriedExactPublicOriginalUrls:8;
 urlsWithHistoricalIndexedCdxCandidates:number;
 urlsCdxUnavailableOrInvalidUnknown:number;
 urlsCdxEmptyNotHistoricalArticleAbsence:number;
 originalHttpReplaysAttempted:number;
 exactlyIndexedSha1VerifiedRawHtmlCaptureVersions:number;
 originalUrlVariantsWithAtLeastOneVerifiedHtml:number;
 possibleAliasPairsWithBothSidesExactlyVerified:number;
 historicalSameCanonicalPairs:number;
 historicalSameVisibleTextDigestPairs:number;
 pairResults:AliasRelationship[];
 allProposedArticleDeduplicationStillHeld:true;
 noHumanVerifiedOriginalAudioOrSenatorQuote:true;
 noActualMemberRecordedVoteEvidenceApproved:true;
 noPrivateSourceOrModelDataRead:true;
 noRawOriginalArticleHtmlSaved:true;
 noMediaPublisherUniverseCensus:true;
}
function time(t:string):string{
 if(!/^\d{14}$/.test(t))throw Error('Bad original Wayback timestamp');
 const iso=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14)+'Z';
 if(!/^20(?:21|22|23|24|25)-/.test(iso)||!Number.isFinite(Date.parse(iso))
   ||new Date(iso).toISOString()!==iso.replace('Z','.000Z'))throw Error('Invalid original historical archive clock');
 return iso;
}
function b32(body:Uint8Array):string{
 let v=0,bits=0,out='';
 for(const x of body){v=(v<<8)|x;bits+=8;while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[(v<<(5-bits))&31];return out;
}
function checkUrl(url:string,role:'brief'|'dated'){
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||parsed.hostname!==HOST||parsed.username||parsed.password
   ||parsed.port||parsed.search||parsed.hash||parsed.href!==url
   ||(role==='brief'?!/^\/briefs\/[a-z0-9-]+\/$/.test(parsed.pathname):
       !/^\/202[2345]\/\d\d\/\d\d\/[a-z0-9-]+\/$/.test(parsed.pathname)))
   throw Error('Untrusted /briefs/ versus dated exact publisher URL');
 return parsed;
}
export function validateAliasHypotheses(q:AliasQueue,old:OldOriginalLead[],
 proof:PreviousOriginalDigest):AliasPair[]{
 if(!q||q.version!=='minnesota-reformer-original-briefs-vs-dated-path-pairs-2021-25-v1'
   ||q.observedOn!=='2026-10-11'
   ||q.original31UrlLeadLedger!=='docs/evaluation/senate-media-public-article-discovery-2021-25.json'
   ||q.previousOriginalIndexedShaReceipts!=='docs/evaluation/senate-media-2021-25-exact-public-replay-receipts-20261010.json'
   ||q.samePresentDayTitleDoesNotProveHistoricallyIdenticalArticle!==true
   ||q.noPathAliasResolutionWithoutBothOriginalArchivedBodies!==true
   ||q.noAutomaticArticleDuplicateMerger!==true||q.originalPublicationTimeUnknown!==true
   ||q.noSenatorQuoteOrVoteAutomaticallyApproved!==true||q.originalHtmlAudioNotPersisted!==true
   ||!Array.isArray(q.pairs)||q.pairs.length!==4||!Array.isArray(old)
   ||!Array.isArray(proof.indexConsistentCaptureReceipts))
   throw Error('Wrong original public publisher path alias hypothesis input');
 const seen=new Set<string>();
 for(let i=0;i<REQUIRED.length;i++){
  const p=q.pairs[i],fixed=REQUIRED[i]!;
  if(!p||p.pair!==fixed[0]||p.briefId!==fixed[1]||p.datedId!==fixed[2])
   throw Error('Unexpected alias pair id');
  const a=checkUrl(p.briefOriginalUrl,'brief'),z=checkUrl(p.datedOriginalUrl,'dated');
  if(a.pathname.split('/').at(-2)!==z.pathname.split('/').at(-2))
   throw Error('Path hypotheses differ in original article slug');
  if(seen.has(p.briefOriginalUrl)||seen.has(p.datedOriginalUrl))throw Error('Duplicate original article URL');
  seen.add(p.briefOriginalUrl);seen.add(p.datedOriginalUrl);
  for(const [id,url] of [[p.briefId,p.briefOriginalUrl],[p.datedId,p.datedOriginalUrl]]){
   if(!old.some(x=>x.id===id&&x.livePageUrl===url))
    throw Error('Original URL not actually in prior selected public publisher source set');
  }
 }
 return q.pairs;
}
async function bound(r:Response,cap:number):Promise<Uint8Array>{
 const head=r.headers.get('content-length');
 if(head!==null&&(!/^(0|[1-9]\d*)$/.test(head)
   ||!Number.isSafeInteger(Number(head))||Number(head)>cap))throw Error('big');
 if(!r.body)throw Error('short');
 const reader=r.body.getReader(),pieces:Uint8Array[]=[];let total=0;
 while(true){const next=await reader.read();if(next.done)break;total+=next.value.byteLength;
  if(total>cap){await reader.cancel().catch(()=>undefined);throw Error('big');}pieces.push(next.value);
 }
 if(total<15)throw Error('short');
 const data=new Uint8Array(total);let k=0;for(const p of pieces){data.set(p,k);k+=p.byteLength;}
 return data;
}
function parseIndex(d:unknown,url:string):Indexed[]{
 if(!Array.isArray(d)||!Array.isArray(d[0])||d.length>MAX_ROWS+1
   ||d[0].some(x=>typeof x!=='string'))throw Error('Bad original index');
 const h=d[0] as string[];
 if(new Set(h).size!==h.length||['timestamp','original','mimetype','statuscode','digest','length']
   .some(x=>!h.includes(x)))throw Error('CDX response missing source SHA or original URL');
 const seen=new Set<string>(),out:Indexed[]=[];
 for(const row of d.slice(1)){
  if(!Array.isArray(row)||row.length!==h.length)throw Error('Invalid original CDX row');
  const get=(key:string)=>row[h.indexOf(key)] as unknown;
  const t=get('timestamp'),original=get('original'),mime=get('mimetype'),
    status=get('statuscode'),digest=get('digest'),bytes=get('length');
  if(typeof t!=='string'||typeof original!=='string'||typeof mime!=='string'
    ||typeof status!=='string'||typeof digest!=='string'||typeof bytes!=='string'
    ||original!==url||status!=='200'||mime!=='text/html'
    ||!SHA1.test(digest.toUpperCase())||!/^\d+$/.test(bytes)
    ||!Number.isSafeInteger(Number(bytes)))
    throw Error('Original public publisher index status or digest untrusted');
  const captureUtc=time(t);
  if(seen.has(t))continue;seen.add(t);
  out.push({timestamp:t,captureUtc,indexedSha1Base32:digest.toUpperCase(),mime,originalUrl:url});
 }
 return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function indexed(url:string,f:typeof fetch):Promise<Indexed[]|null>{
 const q=new URLSearchParams({url,matchType:'exact',from:'2021',to:'2025',
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',limit:String(MAX_ROWS)});
 try{
  const res=await f('https://web.archive.org/cdx/search/cdx?'+q.toString(),{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
   headers:{accept:'application/json','user-agent':'VotePredict/2.0 public-reformer-historic-url-alias-research'}});
  if(res.status!==200||res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')
   return null;
  const data=await bound(res,MAX_INDEX);
  return parseIndex(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown,url);
 }catch{return null;}
}
function historicalCanonical(html:string,a:string,b:string):string|null{
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]??'';
 const links=head.match(/<link\b[^>]*>/gi)??[];
 for(const l of links){
  if(!/\brel\s*=\s*["']canonical["']/i.test(l))continue;
  const src=l.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(src===a||src===b)return src;
 }
 return null;
}
async function replay(x:Indexed,a:string,b:string,pins:PreviousOriginalDigest,
 role:'brief'|'dated',id:string,f:typeof fetch):Promise<AliasOriginalVersion>{
 const address='https://web.archive.org/web/'+x.timestamp+'id_/'+x.originalUrl;
 const known={originalArchiveUtc:x.captureUtc,indexedSha1Base32:x.indexedSha1Base32,archivedReplayUrl:address,
   originalPublisherHtmlOrAudioSaved:false as const};
 const unknown=(status:ReplayResult):AliasOriginalVersion=>({...known,status,rawSha256:null,rawBytes:null,
  previouslyVerifiedSameCaptureSha256Matches:null,historicRawHtmlCanonicalUrlIfEitherOriginalPair:null,
  normalizedVisiblePageTextSha256:null});
 try{
  const r=await f(address,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
   headers:{accept:'text/html','accept-encoding':'identity',
    'user-agent':'VotePredict/2.0 public-reformer-historic-url-alias-research'}});
  if(r.status>=300&&r.status<400)return unknown('archive_redirect_unknown');
  if(r.status!==200)return unknown('archive_http_unknown');
  if(r.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='text/html')
   return unknown('archive_mime_unknown');
  const raw=await bound(r,MAX_HTML);
  if(raw.length<40)return unknown('archive_too_short_unknown');
  if(b32(createHash('sha1').update(raw).digest())!==x.indexedSha1Base32)
   return unknown('archive_indexed_sha1_mismatch_unknown');
  const sha=createHash('sha256').update(raw).digest('hex'),html=new TextDecoder().decode(raw);
  const pinned=pins.indexConsistentCaptureReceipts.find(y=>y.leadId===id&&y.archivedCaptureUtc===x.captureUtc);
  return {...known,status:'indexed_sha1_original_html_authenticated',rawSha256:sha,rawBytes:raw.byteLength,
   previouslyVerifiedSameCaptureSha256Matches:pinned
    ?pinned.observedOriginalHtmlSha256===sha&&pinned.observedRawBodyBytes===raw.byteLength:null,
   historicRawHtmlCanonicalUrlIfEitherOriginalPair:historicalCanonical(html,a,b),
   normalizedVisiblePageTextSha256:createHash('sha256')
    .update(approximatePublicHtmlText(html)).digest('hex')};
 }catch(e){
  if(e instanceof Error&&e.message==='big')return unknown('archive_too_big_unknown');
  if(e instanceof Error&&e.message==='short')return unknown('archive_too_short_unknown');
  return unknown('archive_fetch_failed_unknown');
 }
}
export async function verifyReformerHistoricalAliasPaths(q:AliasQueue,leads:OldOriginalLead[],
 pins:PreviousOriginalDigest,f:typeof fetch=fetch):Promise<AliasReport>{
 const pairs=validateAliasHypotheses(q,leads,pins);
 const out:Array<AliasRelationship|undefined>=Array(pairs.length);
 let next=0;
 async function worker(){
  while(next<pairs.length){
   const k=next++,p=pairs[k]!;
   const sides=await Promise.all([['brief',p.briefId,p.briefOriginalUrl],['dated',p.datedId,p.datedOriginalUrl]]
    .map(async ([role,id,url])=>{
     const found=await indexed(url!,f);
     const versions:AliasOriginalVersion[]=[];
     if(found)for(const index of found.slice(0,2))
      versions.push(await replay(index,p.briefOriginalUrl,p.datedOriginalUrl,pins,role as 'brief'|'dated',id!,f));
     const r:AliasUrlStatus={originalSourceUrl:url!,sourceId:id!,role:role as 'brief'|'dated',
      first20IndexedCandidates:found?.length??null,
      indexStatus:found===null?'index_unavailable_unknown':found.length===0?'index_empty':'index_candidates',
      selectedHistoricallyIndexedUtc:found?.slice(0,2).map(x=>x.captureUtc)??[],
      actualOriginalReplays:versions,
      originalHtmlVerifiedInAtLeastOneArchiveVersion:versions.some(x=>x.status==='indexed_sha1_original_html_authenticated')};
     return r;
    }));
   const [brief,dated]=sides as [AliasUrlStatus,AliasUrlStatus];
   const good=brief.actualOriginalReplays.filter(x=>x.status==='indexed_sha1_original_html_authenticated');
   const datedGood=dated.actualOriginalReplays.filter(x=>x.status==='indexed_sha1_original_html_authenticated');
   const shared=good.some(x=>x.historicRawHtmlCanonicalUrlIfEitherOriginalPair!==null
    &&datedGood.some(y=>y.historicRawHtmlCanonicalUrlIfEitherOriginalPair===x.historicRawHtmlCanonicalUrlIfEitherOriginalPair));
   const bodyMatches=good.some(x=>x.normalizedVisiblePageTextSha256!==null
    &&datedGood.some(y=>y.normalizedVisiblePageTextSha256===x.normalizedVisiblePageTextSha256));
   out[k]={pair:p.pair,brief,dated,bothOriginalUrlVariantsHistoricallySha1Verified:good.length>0&&datedGood.length>0,
    sharedHistoricalCanonicalUrlObserved:shared,
    identicalNormalizedVisibleArchivedHtmlPageTextSha256Observed:bodyMatches,
    historicalUrlIdentityProvenAndSafeToDeduplicate:false,
    historicSamePathSlugDoesNotProveSameArticle:true,
    unknownCdxOrUnverifiedReplayIsNotNegativeProof:true,
    noPublisherFirstPostClockEstablished:true};
  }
 }
 await Promise.all([worker(),worker()]);
 if(out.some(x=>!x))throw Error('Incomplete public URL pair research');
 const pairsDone=out as AliasRelationship[],urls=pairsDone.flatMap(x=>[x.brief,x.dated]);
 return {version:ALIAS_VERSION,originalPublisherUrlAliasHypotheses:4,
  independentlyQueriedExactPublicOriginalUrls:8,
  urlsWithHistoricalIndexedCdxCandidates:urls.filter(x=>x.indexStatus==='index_candidates').length,
  urlsCdxUnavailableOrInvalidUnknown:urls.filter(x=>x.indexStatus==='index_unavailable_unknown').length,
  urlsCdxEmptyNotHistoricalArticleAbsence:urls.filter(x=>x.indexStatus==='index_empty').length,
  originalHttpReplaysAttempted:urls.reduce((n,x)=>n+x.actualOriginalReplays.length,0),
  exactlyIndexedSha1VerifiedRawHtmlCaptureVersions:urls.reduce((n,x)=>n+
   x.actualOriginalReplays.filter(v=>v.status==='indexed_sha1_original_html_authenticated').length,0),
  originalUrlVariantsWithAtLeastOneVerifiedHtml:urls.filter(x=>x.originalHtmlVerifiedInAtLeastOneArchiveVersion).length,
  possibleAliasPairsWithBothSidesExactlyVerified:pairsDone.filter(x=>x.bothOriginalUrlVariantsHistoricallySha1Verified).length,
  historicalSameCanonicalPairs:pairsDone.filter(x=>x.sharedHistoricalCanonicalUrlObserved).length,
  historicalSameVisibleTextDigestPairs:pairsDone.filter(x=>x.identicalNormalizedVisibleArchivedHtmlPageTextSha256Observed).length,
  pairResults:pairsDone,allProposedArticleDeduplicationStillHeld:true,
  noHumanVerifiedOriginalAudioOrSenatorQuote:true,noActualMemberRecordedVoteEvidenceApproved:true,
  noPrivateSourceOrModelDataRead:true,noRawOriginalArticleHtmlSaved:true,noMediaPublisherUniverseCensus:true};
}

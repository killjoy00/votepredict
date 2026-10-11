/**
 * #864 dated acquisition of 2022 campaign-site original bytes, for people
 * actually documented to have served in the MN Senate (LRL independent HTML).
 *
 * Allowed only five precise candidate campaign URLs and 2022 Wayback/CDX
 * and original Common Crawl WARC ranges. No arbitrary URL input, no secrets,
 * Neon/Vercel, candidate-opponent data, evidence writes or scheduled work.
 *
 * No result is deemed available before an election from a mutable web page,
 * an on-page date claim or a Wayback/Common Crawl index entry alone.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import targetData from '../data/evaluation/senate-2022-ever-served-campaign-archive-public-targets-v1.json' with {type:'json'};
import {
 parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection,
 type AuditedOfficialSenateDirectory,
} from '../src/evidence/senate-official-ever-served-directory.js';
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';

export const HISTORIC_2022_SENATOR_WEBSITE_ACQUISITION_VERSION=
  'senate-2022-ever-served-original-campaign-site-byte-acquisition-v1' as const;
const MAX_INDEX=1_500_000,MAX_HTML=2_500_000,MAX_WARC=5_000_000,MAX_DECODED=18_000_000;
const GENERAL_CUTOFF='2022-11-08T00:00:00.000Z';
const YEAR_START='2022-01-01T00:00:00.000Z';
const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const sha256=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function base32Sha1Archive(bytes:Buffer):string {
 const digest=createHash('sha1').update(bytes).digest();
 let held=0,bits=0,out='';
 for(const byte of digest){
  held=(held<<8)|byte;bits+=8;
  while(bits>=5){out+=BASE32[(held>>(bits-5))&31];bits-=5;}
  held&=(1<<bits)-1;
 }
 if(bits)out+=BASE32[(held<<(5-bits))&31];
 return out;
}
const personKeys=[
 '2022|24|Carla Nelson','2022|47|Nicole Mitchell',
 '2022|4|Rob Kupec','2022|32|Michael Kreun',
] as const;
function urlKey(value:string):string {
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port
   ||url.hash||url.search)throw Error('Unsafe historical original candidate URL');
 return url.hostname.toLowerCase().replace(/^www\./,'')+
   url.pathname.replace(/\/+$/,'').toLowerCase();
}
export function strictlySenatorsOnly2022Targets(official:AuditedOfficialSenateDirectory){
 if(targetData.schema!=='senate-2022-ever-served-campaign-archive-public-targets-v1'
   ||targetData.scope.mustRevalidateActualSenateServiceFromLRLRawOriginalBeforeAnyFetch!==true
   ||targetData.scope.exactCampaignUrls!==5
   ||targetData.scope.uniqueEverServedSenators!==4
   ||targetData.targets.length!==5
   ||targetData.sourceQueryWindows.commoncrawlCollections.join(',')!==
     'CC-MAIN-2022-21,CC-MAIN-2022-33,CC-MAIN-2022-40'
   ||official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
   ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true)
   throw Error('Campaign index targets or independent official Senate service source untrusted');
 const ids=new Set<string>(),sitePeople=new Set<string>(),seenUrls=new Set<string>();
 const eligible=targetData.targets.map(t=>{
  if(ids.has(t.id)||seenUrls.has(urlKey(t.sourceUrl))
    ||t.originating2022ArchivedResponseVerified!==false
    ||t.campaignSiteLive2026ResponseObtained!==false
    ||t.originalHistoricCampaignFilingWebsiteAssignmentProven!==false
    ||t.historicalIssueStatementPromoted!==false
    ||t.earliestKnownCurrentRetrievalUtc!==null)
    throw Error('Unrecognized or promoted old campaign URL lead');
  ids.add(t.id);seenUrls.add(urlKey(t.sourceUrl));
  if(!personKeys.includes(('2022|'+t.district+'|'+t.candidateName) as typeof personKeys[number]))
    throw Error('Research must contain only independently established actual Senate service');
  const service=validateActualSenateServiceForElection(
    official,t.candidateName,t.district,2022);
  if(service.status!=='verified_senate_service'
    ||service.serviceForThisElectionFollowingYearVerified!==true)
    throw Error('Campaign target person has not been verified as a served senator in exact Senate district');
  sitePeople.add(t.candidateName);
  return{...t,verifiedOfficialSenatorName:service.officialName!,
    verifiedSenateServiceTerm:service.term!,
    officialSenateServiceSource:service.officialServiceSource!,
    officialServiceSourceObservedAt:official.source.observedAt,
    officialServiceOriginalSourceSha256:official.source.sourceBytesSha256,
    independentlyVerifiedSenatorService:true};
 });
 if(sitePeople.size!==4)throw Error('All four intended source targets must qualify as independently served senators');
 return eligible;
}
function safeFile(dir:string,name:string,body:Buffer|null){
 if(!body||!body.length)return null;
 if(!/^[a-z0-9._-]{1,100}$/.test(name)||name.includes('..'))
   throw Error('Unsafe saved source filename');
 writeFileSync(join(dir,name),body,{flag:'wx',mode:0o600});
 return name;
}
export type PublicReply={
 requestUrl:string;requestedAtUtc:string;observedAtUtc:string;
 status:number|null;error:string|null;
 responseUrl:string|null;responseBodySha256:string|null;responseByteLength:number|null;
 headers:{date:string|null;lastModified:string|null;contentType:string|null;
  contentRange:string|null;mementoDatetime:string|null};
 body:Buffer|null;
};
function safeNetworkUrl(u:string){
 const x=new URL(u);
 const hosts=[
  ...targetData.targets.map(t=>new URL(t.sourceUrl).hostname),
  'web.archive.org','index.commoncrawl.org','data.commoncrawl.org',
 ];
 if(x.protocol!=='https:'||x.port||x.username||x.password||x.hash||!hosts.includes(x.hostname))
   throw Error('Unapproved fixed public archive network host');
 if(targetData.targets.some(t=>new URL(t.sourceUrl).hostname===x.hostname)
   &&!targetData.targets.some(t=>t.sourceUrl===u))
   throw Error('Unapproved new campaign-site path, only pinned targets allowed');
 if(x.hostname==='index.commoncrawl.org'
   &&!/^(?:\/CC-MAIN-2022-(?:21|33|40)-index)$/.test(x.pathname))
   throw Error('Unapproved 2022 Common Crawl index collection');
 if(x.hostname==='data.commoncrawl.org'
   &&!/^\/crawl-data\/CC-MAIN-2022-(?:21|33|40)\/segments\/[A-Za-z0-9._-]+\/warc\/CC-MAIN-[A-Za-z0-9._-]+\.warc\.gz$/.test(x.pathname))
   throw Error('Unapproved historical compressed WARC path');
 if(x.hostname==='web.archive.org'
   &&!(x.pathname==='/cdx/search/cdx'||/^\/web\/\d{14}id_\//.test(x.pathname)))
   throw Error('Unapproved Wayback archive operation');
 return x;
}
export async function fetchDatedBoundedPublic(
 url:string,byteCap:number,impl:typeof fetch=fetch,range?:{start:number;end:number},
):Promise<PublicReply>{
 safeNetworkUrl(url);
 if(!Number.isInteger(byteCap)||byteCap<1||byteCap>MAX_WARC
   ||range&&(!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)
     ||range.start<0||range.end<range.start||range.end-range.start+1>byteCap))
   throw Error('Unbounded public HTTP source request');
 const requestedAtUtc=new Date().toISOString();
 const result:PublicReply={
  requestUrl:url,requestedAtUtc,observedAtUtc:requestedAtUtc,
  status:null,error:null,responseUrl:null,responseBodySha256:null,responseByteLength:null,
  headers:{date:null,lastModified:null,contentType:null,contentRange:null,mementoDatetime:null},
  body:null,
 };
 try{
  const response=await impl(url,{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(16000),
   headers:{
    accept:'text/html,application/json,text/plain,application/octet-stream',
    'user-agent':'VotePredict/2.0 issue864-2022-senators-original-source',
    ...(range?{range:'bytes='+range.start+'-'+range.end}:{}),
   },
  });
  result.status=response.status;
  result.responseUrl=response.url||url;
  result.headers={
   date:response.headers.get('date'),
   lastModified:response.headers.get('last-modified'),
   contentType:response.headers.get('content-type'),
   contentRange:response.headers.get('content-range'),
   mementoDatetime:response.headers.get('memento-datetime'),
  };
  const declared=response.headers.get('content-length');
  if(declared&&/^\d+$/.test(declared)&&Number(declared)>byteCap){
   result.error='HTTP source exceeds bounded body cap';
   await response.body?.cancel();return result;
  }
  if(!response.body){result.error='No original source response body';return result;}
  const r=response.body.getReader();let n=0;const fragments:Buffer[]=[];
  while(true){
   const part=await r.read();
   if(part.done)break;
   n+=part.value.byteLength;
   if(n>byteCap){await r.cancel();result.error='Public source body exceeds byte cap';return result;}
   fragments.push(Buffer.from(part.value));
  }
  result.body=Buffer.concat(fragments,n);
  result.responseByteLength=n;
  result.responseBodySha256=sha256(result.body);
 }catch(e){
  result.error=e instanceof Error?e.name+': '+e.message.slice(0,140):'Network operation unavailable';
 }finally{result.observedAtUtc=new Date().toISOString();}
 return result;
}
const withoutBody=(r:PublicReply)=>{
 const {body,...meta}=r;return meta;
};
function parseWaybackExact2022(raw:Buffer,sourceUrl:string):WaybackCapture[]{
 let payload:unknown;
 try{payload=JSON.parse(raw.toString('utf8'));}catch{throw Error('Historic Wayback CDX response is not JSON');}
 const captures=parseWaybackCdxJson(payload);
 if(captures.length>200)throw Error('Excessive historical candidate exact-page archive index records');
 const seen=new Set<string>();
 return captures.filter(c=>{
  const stamp=Date.parse(c.capturedAt),reference=Date.parse(GENERAL_CUTOFF);
  if(!(stamp>=Date.parse(YEAR_START)&&stamp<reference)
    ||urlKey(c.original)!==urlKey(sourceUrl)
    ||!/^[A-Z2-7]{32}$/.test(c.digest))return false;
  const k=c.timestamp+'|'+c.digest;
  if(seen.has(k))return false;
  seen.add(k);return true;
 });
}
function waybackIndexUrl(url:string){
 const p=new URLSearchParams({
  url,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',from:'20220101',to:'20221107',limit:'200',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+p.toString();
}
type CcIndexed={
 url:string;timestamp:string;capturedAtUtc:string;status:'200';mime:string;
 digest:string;filename:string;offset:number;length:number;
 originalCollection:string;
};
function fromStamp(value:string){
 if(!/^\d{14}$/.test(value))throw Error('Malformed archive timestamp');
 const iso=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T'+
  value.slice(8,10)+':'+value.slice(10,12)+':'+value.slice(12,14)+'.000Z';
 const n=Date.parse(iso);
 if(!Number.isFinite(n)||new Date(n).toISOString()!==iso)throw Error('Impossible archive capture timestamp');
 return iso;
}
export function parseStrict2022CommonCrawlCdxj(
 raw:Buffer,originalUrl:string,collection:string,
):CcIndexed[]{
 if(!/^CC-MAIN-2022-(?:21|33|40)$/.test(collection))
   throw Error('Unknown original historical Common Crawl collection');
 if(raw.byteLength>MAX_INDEX)throw Error('Common Crawl raw index too large');
 const lines=raw.toString('utf8').trim().split(/\r?\n/);
 if(lines.length>200)throw Error('Excessive original campaign CDX index rows');
 const results:CcIndexed[]=[];
 for(const line of lines){
  if(!line)continue;
  const pos=line.indexOf(' {');
  if(pos<1)throw Error('Malformed Common Crawl CDXJ original index row');
  let data:Record<string,unknown>;
  try{data=JSON.parse(line.slice(pos+1)) as Record<string,unknown>;}
  catch{throw Error('Common Crawl CDXJ original row is not JSON');}
  if(typeof data.url!=='string'||typeof data.timestamp!=='string'
    ||typeof data.status!=='string'||typeof data.mime!=='string'
    ||typeof data.digest!=='string'||typeof data.filename!=='string'
    ||typeof data.offset!=='string'||typeof data.length!=='string')
    throw Error('Common Crawl index missing identity/range metadata');
  const when=fromStamp(data.timestamp);
  if(urlKey(data.url)!==urlKey(originalUrl)
    ||when<YEAR_START||when>=GENERAL_CUTOFF
    ||data.status!=='200'||!['text/html','application/xhtml+xml','text/plain'].includes(data.mime))
    continue;
  if(!/^[A-Z2-7]{32}$/.test(data.digest)
    ||!new RegExp('^crawl-data/'+collection+
      '/segments/[A-Za-z0-9._-]+/warc/CC-MAIN-[A-Za-z0-9._-]+\\.warc\\.gz$').test(data.filename)
    ||Number(data.length)<1||Number(data.length)>MAX_WARC
    ||!Number.isSafeInteger(Number(data.offset))||Number(data.offset)<0)
    throw Error('Unsafe Common Crawl original campaign WARC metadata');
  results.push({
   url:data.url,timestamp:data.timestamp,capturedAtUtc:when,status:'200',
   mime:data.mime,digest:data.digest,filename:data.filename,
   offset:Number(data.offset),length:Number(data.length),
   originalCollection:collection,
  });
 }
 return results;
}
function parseHeaders(raw:string){
 const ls=raw.split('\r\n');const first=ls.shift()??'';
 const fields=new Map<string,string>();
 for(const line of ls){
  const pos=line.indexOf(':');
  if(pos<=0||/^[\t ]/.test(line))throw Error('Malformed original WARC/HTTP header');
  const name=line.slice(0,pos).toLowerCase(),v=line.slice(pos+1).trim();
  if(!/^[a-z0-9-]+$/.test(name)||!v)throw Error('Bad source header name/value');
  if(fields.has(name)){
   if(name==='warc-protocol'&&/^[a-zA-Z0-9._/-]{1,40}$/.test(v))continue;
   throw Error('Duplicate original source identity/date/digest header');
  }
  fields.set(name,v);
 }
 return{first,fields};
}
function needed(fields:Map<string,string>,name:string){
 const value=fields.get(name);
 if(!value)throw Error('Original WARC missing '+name);
 return value;
}
export function verifyActual2022CommonCrawlWarc(
 row:CcIndexed,gzipBytes:Buffer,
):{report:{
 captureAtUtc:string;originalUrl:string;originalHtmlSha256:string;
 originalHtmlSha1Base32:string;compressedWarcSha256:string;warcBlockSha1Verified:true;
 pagePayloadSha1MatchesIndexAndWarc:true;warcTargetAndDateMatchIndex:true;
 pageWasPublicByNoLaterThanCaptureUtc:string;firstAuthorPublicationDateEstablished:false;
 forecastEvidenceInserted:false;
};html:Buffer}{
 if(gzipBytes.length!==row.length||gzipBytes.length>MAX_WARC
   ||gzipBytes[0]!==0x1f||gzipBytes[1]!==0x8b)
   throw Error('Original WARC byte-range size or gzip signature mismatch');
 const data=gunzipSync(gzipBytes,{maxOutputLength:MAX_DECODED});
 const marker=Buffer.from('\r\n\r\n');
 const h=data.indexOf(marker);
 if(h<8||h>65536)throw Error('Original WARC header too long/missing');
 const wh=parseHeaders(data.subarray(0,h).toString('latin1'));
 if(!/^WARC\/1\.[01]$/.test(wh.first)
   ||needed(wh.fields,'warc-type')!=='response'
   ||!needed(wh.fields,'content-type').startsWith('application/http')
   ||needed(wh.fields,'warc-target-uri')!==row.url
   ||Date.parse(needed(wh.fields,'warc-date'))!==Date.parse(row.capturedAtUtc))
   throw Error('Original WARC response URL/date incompatible with source index');
 const size=Number(needed(wh.fields,'content-length'));
 const blockStart=h+4;
 if(!Number.isSafeInteger(size)||size<1||size>MAX_DECODED||blockStart+size>data.length)
   throw Error('WARC source HTTP block length invalid');
 const block=data.subarray(blockStart,blockStart+size);
 const trailer=data.subarray(blockStart+size);
 if(!trailer.equals(marker)&&!trailer.equals(Buffer.from('\r\n')))
   throw Error('Unexpected bytes after original WARC record');
 if(needed(wh.fields,'warc-block-digest')!=='sha1:'+base32Sha1Archive(block))
   throw Error('Original archived WARC block digest mismatch');
 const offset=block.indexOf(marker);
 if(offset<8||offset>65536)throw Error('Missing original archived HTTP headers');
 const http=parseHeaders(block.subarray(0,offset).toString('latin1'));
 if(!/^HTTP\/1\.[01] 200(?:\s|$)/.test(http.first)
   ||needed(http.fields,'content-type').split(';')[0].trim().toLowerCase()!==row.mime
   ||http.fields.get('content-encoding')&&!/^identity$/i.test(http.fields.get('content-encoding')!)
   ||http.fields.has('transfer-encoding'))
   throw Error('Archived original webpage HTTP status/media/encoding mismatch');
 const html=block.subarray(offset+4);
 if(!html.length||needed(wh.fields,'warc-payload-digest')!=='sha1:'+base32Sha1Archive(html)
   ||base32Sha1Archive(html)!==row.digest)
   throw Error('Original HTML content not equal to 2022 CDX/WARC digest');
 return{
  report:{
   captureAtUtc:row.capturedAtUtc,originalUrl:row.url,
   originalHtmlSha256:sha256(html),originalHtmlSha1Base32:base32Sha1Archive(html),
   compressedWarcSha256:sha256(gzipBytes),
   warcBlockSha1Verified:true,pagePayloadSha1MatchesIndexAndWarc:true,
   warcTargetAndDateMatchIndex:true,
   pageWasPublicByNoLaterThanCaptureUtc:row.capturedAtUtc,
   firstAuthorPublicationDateEstablished:false,
   forecastEvidenceInserted:false,
  },html:Buffer.from(html),
 };
}
function currentPlanTargets(official:AuditedOfficialSenateDirectory){
 const list=strictlySenatorsOnly2022Targets(official);
 if(new Set(list.map(x=>x.candidateName)).size!==4)throw Error('Missing official served-senator source');
 return list;
}
export async function acquire2022EverServedSenateCampaignOriginals(
 dirName:string,official:AuditedOfficialSenateDirectory,
 impl:typeof fetch=fetch,
){
 const output=resolve(dirName);
 if(existsSync(output))throw Error('Refuse source acquisition overwrite');
 const targets=currentPlanTargets(official); // validates ONLY served senators before any fetch
 mkdirSync(output,{mode:0o700,recursive:true});
 const items=[];
 let warcDownloads=0;
 for(const target of targets){
  const live=await fetchDatedBoundedPublic(target.sourceUrl,MAX_HTML,impl);
  const savedLive=safeFile(output,target.id+'-retrieved-now.html',
    live.status===200?live.body:null);
  const waybackIndex=await fetchDatedBoundedPublic(waybackIndexUrl(target.sourceUrl),MAX_INDEX,impl);
  const savedWaybackIndex=safeFile(output,target.id+'-wayback-cdx.json',
    waybackIndex.status===200?waybackIndex.body:null);
  let waybackRows:WaybackCapture[]=[];let indexParsingError:string|null=null;
  if(waybackIndex.status===200&&waybackIndex.body){
   try{waybackRows=parseWaybackExact2022(waybackIndex.body,target.sourceUrl);}
   catch(e){indexParsingError=e instanceof Error?e.message:'bad Wayback index';}
  }
  const replayed=[];
  const firstAndLast=waybackRows.length
    ?[waybackRows[0],waybackRows.at(-1)!].filter((x,i,a)=>
      a.findIndex(y=>y.timestamp===x.timestamp&&y.digest===x.digest)===i):[];
  for(const capture of firstAndLast){
   const source=await fetchDatedBoundedPublic(capture.archiveUrl,MAX_HTML,impl);
   const match=Boolean(source.status===200&&source.body
     &&base32Sha1Archive(source.body)===capture.digest);
   const file=safeFile(output,target.id+'-wayback-'+capture.timestamp+'.html',match?source.body:null);
   replayed.push({
    originalIndexCapturedAtUtc:capture.capturedAt,indexOriginalUrl:capture.original,
    claimedHistoricalIndexDigest:capture.digest,sourceArchiveUrl:capture.archiveUrl,
    realResponse:withoutBody(source),byteDigestMatchedOriginalCdx:match,
    savedOriginalHistoricalHtmlFile:file,
    exactPageAvailableByHistoricalCaptureUtc:match?capture.capturedAt:null,
    issueStatementTextAttestedByOriginalHtmlReview:false,
    earliestAuthorPostedOn:null,
    modelEvidenceAdmitted:false,
   });
  }
  const cc=[];
  const candidates:CcIndexed[]=[];
  for(const collection of targetData.sourceQueryWindows.commoncrawlCollections){
   const queryUrl='https://index.commoncrawl.org/'+collection+'-index?'+new URLSearchParams({
    url:target.sourceUrl,output:'json',
   }).toString();
   const response=await fetchDatedBoundedPublic(queryUrl,MAX_INDEX,impl);
   const file=safeFile(output,target.id+'-'+collection+'-index.cdxj',
     response.status===200?response.body:null);
   let parsed:CcIndexed[]=[];let parseErr:string|null=null;
   if(response.status===200&&response.body){
    try{parsed=parseStrict2022CommonCrawlCdxj(response.body,target.sourceUrl,collection);}
    catch(e){parseErr=e instanceof Error?e.message:'Malformed Common Crawl rows';}
   }
   candidates.push(...parsed);
   cc.push({
    collection,request:withoutBody(response),savedIndexBytesFile:file,
    acceptedPreElectionExactPageIndexRows:parsed.length,
    parseError:parseErr,
    indexRowsAreNotIndependentStatementTextProof:true,
   });
  }
  const verifiedWarcs=[];
  const uniqueRecords=new Set<string>();
  for(const row of candidates.sort((a,b)=>a.timestamp.localeCompare(b.timestamp))){
   const key=row.url+'|'+row.digest;
   if(uniqueRecords.has(key))continue;
   uniqueRecords.add(key);
   if(warcDownloads>=5)break;
   warcDownloads++;
   const url='https://data.commoncrawl.org/'+row.filename;
   const http=await fetchDatedBoundedPublic(url,MAX_WARC,impl,{
    start:row.offset,end:row.offset+row.length-1,
   });
   const contentRange='bytes '+row.offset+'-'+(row.offset+row.length-1)+'/';
   const returnedRange=http.headers.contentRange??'';
   const rangeTotal=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(returnedRange);
   const rangeVerified=http.status===206&&Boolean(rangeTotal)
     &&Number(rangeTotal![1])===row.offset
     &&Number(rangeTotal![2])===row.offset+row.length-1
     &&Number(rangeTotal![3])>row.offset+row.length-1
     &&http.body?.length===row.length;
   let original:null|ReturnType<typeof verifyActual2022CommonCrawlWarc>=null;
   let proofError:string|null=null;
   if(rangeVerified&&http.body){
    try{original=verifyActual2022CommonCrawlWarc(row,http.body);}
    catch(e){proofError=e instanceof Error?e.message:'WARC source mismatch';}
   }
   const warcFile=safeFile(output,target.id+'-'+row.timestamp+'-'+row.originalCollection+'.warc.gz',
     original?http.body:null);
   const originalHtmlFile=safeFile(output,target.id+'-'+row.timestamp+'-'+row.originalCollection+'.html',
     original?.html??null);
   verifiedWarcs.push({
    sourceCrawlCollection:row.originalCollection,
    indexClaimCapturedAtUtc:row.capturedAtUtc,
    originalCampaignUrl:row.url,
    originalWarcRangeRequestUrl:url,indexPayloadDigest:row.digest,
    rangeOffset:row.offset,rangeLength:row.length,
    originalWarcHttpResponse:withoutBody(http),
    fullByteRangeContentRangeHttp206Verified:rangeVerified,
    completeOriginalWarcAndHtmlDigestProof:original?.report??null,
    proofError,originalCompressedWarcFile:warcFile,originalHtmlFile,
    verifiedHistoricPageAvailableBy:original?.report.captureAtUtc??null,
    originalWebsiteStatementExcerptHumanReviewed:false,
    forecastEvidenceAdmitted:false,
   });
  }
  const datedHistoricPages=[
   ...replayed.filter(x=>x.byteDigestMatchedOriginalCdx).map(x=>x.exactPageAvailableByHistoricalCaptureUtc!),
   ...verifiedWarcs.filter(x=>x.completeOriginalWarcAndHtmlDigestProof).map(x=>x.verifiedHistoricPageAvailableBy!),
  ].sort();
  const report={
   targetId:target.id,candidateName:target.candidateName,
   district:target.district,officialSenateMemberName:target.verifiedOfficialSenatorName,
   independentlySenateServed:true,officialServiceTerm:target.verifiedSenateServiceTerm,
   officialSenateServiceSource:target.officialSenateServiceSource,
   officialServiceSourceObservedAtUtc:target.officialServiceSourceObservedAt,
   actualResearchRunObservedAtUtc:new Date().toISOString(),
   currentWebPageRetrieval:withoutBody(live),currentOriginalResponseFile:savedLive,
   currentPageRetrievedAtUtc:live.body?live.observedAtUtc:null,
   currentPageMinimumKnownDateUtc:live.status===200&&live.body?live.observedAtUtc:null,
   currentPageBytesAreNotPreElectionEvidence:true,
   originalFiledCandidateWebsiteFieldVerified:false,
   waybackIndex:{query:withoutBody(waybackIndex),rawFile:savedWaybackIndex,
    parsedPreElectionExactPageRows:waybackRows.length,
    parseError:indexParsingError},
   waybackHistoricOriginals:replayed,
   commonCrawlIndexQueries:cc,
   commonCrawlIndexPreElectionRows:candidates.length,
   commonCrawlHistoricalOriginals:verifiedWarcs,
   earliestVerifiedOriginalPageCaptureByUtc:datedHistoricPages[0]??null,
   earliestVerifiedOriginalPolicyStatementPublicBy:null,
   originalPageFirstAuthorPublicationDate:null,
   senatorIssueEvidenceForecastPromoted:false,
  };
  console.log('SENATE-2022-ORIGINAL '+JSON.stringify({
   person:target.candidateName,
   observedAtUtc:report.actualResearchRunObservedAtUtc,
   currentPageHttp:live.status,
   waybackRows:waybackRows.length,waybackOriginalVerified:
     replayed.filter(x=>x.byteDigestMatchedOriginalCdx).length,
   commonCrawlRows:candidates.length,warcOriginalVerified:
     verifiedWarcs.filter(x=>x.completeOriginalWarcAndHtmlDigestProof).length,
   earliestSourceOriginalCaptureUtc:report.earliestVerifiedOriginalPageCaptureByUtc,
   noEvidenceAdmission:true,
  }));
  items.push(report);
 }
 const totals={
  actualEverServedSenators:4,exactSourcePathsAttempted:items.length,
  originalCampaignSiteCurrent2026BodiesAcquired:items.filter(x=>x.currentOriginalResponseFile).length,
  waybackIndexQueries:items.length,
  waybackIndexHistoricalRows:items.reduce((a,x)=>a+x.waybackIndex.parsedPreElectionExactPageRows,0),
  historicWaybackPagesVerifiedByOriginalDigest:items.reduce((a,x)=>
   a+x.waybackHistoricOriginals.filter(y=>y.byteDigestMatchedOriginalCdx).length,0),
  commonCrawlHistoricalIndexQueries:items.reduce((a,x)=>a+x.commonCrawlIndexQueries.length,0),
  commonCrawlHistoricalIndexCandidateRows:items.reduce((a,x)=>a+x.commonCrawlIndexPreElectionRows,0),
  commonCrawlOriginalWarcRangesAttempted:warcDownloads,
  commonCrawlOriginalPagesVerifiedByWarcAndIndexDigest:items.reduce((a,x)=>
   a+x.commonCrawlHistoricalOriginals.filter(y=>y.completeOriginalWarcAndHtmlDigestProof).length,0),
  senatorsWithAtLeastOneVerifiedPreElectionPage: new Set(items.filter(x=>
   x.earliestVerifiedOriginalPageCaptureByUtc!==null).map(x=>x.candidateName)).size,
  historicallyOriginalCandidatePolicyExcerptsAttributed:0,
  originalFiledCandidateWebsiteAssignmentsValidated:0,
  nonsenatorNamesIncluded:0,forecastEvidenceAdmitted:0,
 };
 const manifest={
  schema:HISTORIC_2022_SENATOR_WEBSITE_ACQUISITION_VERSION,
  acquiredAtUtc:new Date().toISOString(),officialServiceSourceObservedAtUtc:official.source.observedAt,
  officialServiceSourceSha256:official.source.sourceBytesSha256,
  sourceControls:{
   onlyFourIndependentOfficiallyEverServedSenators:true,
   generalElection2022CutoffUtcExclusive:GENERAL_CUTOFF,
   currentPageAcquiredTodayOrLaterNotBackdated:true,
   pageCaptureDateOnlyAfterOriginalBytesDigestVerified:true,
   archiveIndexAloneCannotDateCampaignPolicyText:true,
   campaignIssueExcerptNeedsSeparateContentAttribution:true,
   noNonSenatorResearchTargets:true,originalSosFiledWebsiteFieldProven:false,
   noProductionDbQueriesOrWrites:true,noForecastOrServingChanges:true,
  },
  totals,persons:items,
 };
 safeFile(output,'acquisition-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 console.log('SENATE-2022-SOURCE-SUMMARY '+JSON.stringify(totals));
 return manifest;
}

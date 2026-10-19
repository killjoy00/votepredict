/**
 * #946/#987 public-only historical evidence-gap follow-up. Seven exact
 * Reformer dated-URL hypotheses and three pre-identified APM/3Play PDFs.
 * One bounded CDX request per exact URL, up to two index-authenticated
 * original replays per URL, no publisher fetching, stored article/audio
 * bytes, DB access, production source changes, model or forecast writes.
 *
 * Finding a dated-path HTML or PDF copy is NOT by itself historical
 * duplicate identity, first publisher publication, approved quotation,
 * human-verified speaker audio, or a forecast-eligible feature.
 */
import {createHash} from 'node:crypto';
import {
 discoverMediaPublicCdxCaptures,verifyMediaPublicCdxReplay,
 type PublicCdxCaptureCandidate,type PublicCdxIndexResult,
 type PublicCdxReplayResult,
} from '../evidence/senate-media-public-wayback-probe.js';
import {
 validateTrackDHistoricalShadowPins,type HistoricalShadowPin,
} from './senate-media-track-d-historic-shadow.js';

export const TRACK_D_REMAINING_ORIGINAL_V6='track-d-946-987-seven-alias-three-pdf-public-original-v1';
export const TRACK_D_REMAINING_MAIN_MARKER='TRACK_D_946_987_REMAINING_ORIGINAL_V6_20261019';
const CDX='https://web.archive.org/cdx/search/cdx';
const PDF_MIME=new Set(['application/pdf','application/octet-stream','binary/octet-stream','application/x-pdf']);
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PDF_MAX=1_000_000,INDEX_MAX=95_000;
const DAY=/^20(?:21|22|23|24|25)-\d\d-\d\d$/;
const PDF_PINS=Object.freeze([
 Object.freeze({id:'mpr-2024-hauschild-3play',publisherDay:'2024-02-19',
  exactUrl:'https://codytranscripts.apmcdn.org/production/70fb369cef19a16a739671110457b6b9.pdf',
  independentlyPreviouslyRetrievedPdfSha256:'e246a7b8e9a12a47bd65c54031196a08395b02aed490369be954ac9647ce6991',
  previouslyAuthenticatedArchiveUtc:'2025-07-27T18:09:08Z'}),
 Object.freeze({id:'mpr-2025-pha-3play',publisherDay:'2025-04-24',
  exactUrl:'https://codytranscripts.apmcdn.org/production/f6c5cb374510772be01fbc20ea88d2d0.pdf',
  independentlyPreviouslyRetrievedPdfSha256:'5e2b772277789a5470dc7803019aa970fbcd9566e4f60d8177fcb466eb1c0b9a',
  previouslyAuthenticatedArchiveUtc:null}),
 Object.freeze({id:'mpr-2025-coleman-3play',publisherDay:'2025-09-11',
  exactUrl:'https://codytranscripts.apmcdn.org/production/2d9064e094aab7627c6e05a3c2aad608.pdf',
  independentlyPreviouslyRetrievedPdfSha256:'463c8e352130d0db9d3407470ae24226cb53f07f50d27515e9a0a6c689e493ca',
  previouslyAuthenticatedArchiveUtc:null}),
] as const);
type PdfPin=typeof PDF_PINS[number];
export type IndexedPdf={timestamp:string,captureUtc:string,mime:string,sha1Base32:string};
export type DatedCandidate={
 id:string;publisherDay:string;datedOriginalUrl:string;
 briefOriginalUrl:string;briefArchiveUtc:string;issue:946;
};

function strictlyHistoricalUtc(ts:string):string{
 if(!/^20(?:21|22|23|24|25)\d{10}$/.test(ts))
  throw Error('Source capture outside 2021–2025 original scope');
 const utc=ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8)+'T'+
  ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z';
 if(!Number.isFinite(Date.parse(utc))||
  new Date(utc).toISOString()!==utc.slice(0,-1)+'.000Z')
  throw Error('Invalid or rolled original capture time');
 return utc;
}
export function getRemainingAliasCandidates(
 pins:readonly HistoricalShadowPin[],
):DatedCandidate[]{
 validateTrackDHistoricalShadowPins(pins);
 const grouped=new Map<string,DatedCandidate>();
 for(const pin of pins){
  if(pin.issue!==946||pin.candidateDatedAlias===null)continue;
  const parsed=new URL(pin.candidateDatedAlias);
  const m=/^\/(20(?:21|22|23|24|25))\/(0[1-9]|1[0-2])\/([0-3]\d)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/.exec(parsed.pathname);
  if(!m||parsed.hostname!=='minnesotareformer.com'||parsed.protocol!=='https:'||
   parsed.search||parsed.hash||parsed.port||parsed.username||parsed.password||
   parsed.href!==pin.candidateDatedAlias||
   pin.displayedPublisherDay!==m[1]+'-'+m[2]+'-'+m[3]||
   !pin.originalUrl.endsWith('/briefs/'+m[4]+'/'))
   throw Error('Untrusted historical dated URL source identity');
  const old=grouped.get(parsed.href);
  if(old){
   if(old.briefOriginalUrl!==pin.originalUrl||
    old.publisherDay!==pin.displayedPublisherDay)
    throw Error('Contradictory candidate alias originals');
   if(pin.capturedUtc<old.briefArchiveUtc)old.briefArchiveUtc=pin.capturedUtc;
  }else grouped.set(parsed.href,{
   id:pin.publicId.split('@')[0]!,publisherDay:pin.displayedPublisherDay,
   datedOriginalUrl:parsed.href,briefOriginalUrl:pin.originalUrl,
   briefArchiveUtc:pin.capturedUtc,issue:946,
  });
 }
 const result=[...grouped.values()].sort((a,b)=>a.datedOriginalUrl.localeCompare(b.datedOriginalUrl));
 if(result.length!==7||new Set(result.map(x=>x.briefOriginalUrl)).size!==7||
  result.some(x=>!DAY.test(x.publisherDay)))
  throw Error('Seven independently reviewed dated-path hypotheses changed');
 return result;
}
export function fixedMprPdfTargets(){return PDF_PINS;}
const sourceSha=(raw:Uint8Array)=>createHash('sha256').update(raw).digest('hex');
function sha1Base32(raw:Uint8Array):string{
 const bytes=createHash('sha1').update(raw).digest();
 let bits=0,val=0,out='';
 for(const byte of bytes){
  val=val<<8|byte;bits+=8;
  while(bits>=5){bits-=5;out+=B32[val>>>bits&31];}
  val&=(1<<bits)-1;
 }
 if(bits)out+=B32[(val<<(5-bits))&31];
 return out;
}
async function bounded(r:Response,cap:number):Promise<Uint8Array>{
 const length=r.headers.get('content-length');
 if(length!==null&&(!/^(0|[1-9]\d*)$/.test(length)||
   !Number.isSafeInteger(+length)||+length>cap))throw Error('untrusted-body-size');
 if(!r.body)throw Error('unavailable-body');
 const reader=r.body.getReader(),pieces:Uint8Array[]=[];let size=0;
 for(;;){
  const next=await reader.read();
  if(next.done)break;
  size+=next.value.byteLength;
  if(size>cap){await reader.cancel().catch(()=>undefined);throw Error('body-limit');}
  pieces.push(next.value);
 }
 if(!size)throw Error('empty-body');
 const out=new Uint8Array(size);let cursor=0;
 for(const p of pieces){out.set(p,cursor);cursor+=p.byteLength;}
 return out;
}
function mimeOf(r:Response){return (r.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();}
export function parseExactPdfIndex(
 value:unknown,expected:PdfPin,
):IndexedPdf[]{
 const fields=['timestamp','original','mimetype','statuscode','digest','length'];
 if(!Array.isArray(value)||value.length<1||value.length>13||
  !Array.isArray(value[0])||JSON.stringify(value[0])!==JSON.stringify(fields))
  throw Error('Unexpected original PDF index shape');
 const originals:IndexedPdf[]=[],seen=new Map<string,string>();
 for(const row of value.slice(1)){
  if(!Array.isArray(row)||row.length!==fields.length||
   row.some(x=>typeof x!=='string))throw Error('Malformed indexed PDF row');
  const [ts,url,mime,status,sha,length]=row as string[];
  const utc=strictlyHistoricalUtc(ts!);
  if(url!==expected.exactUrl||status!=='200'||!PDF_MIME.has(mime!)||
   !/^[A-Z2-7]{32}$/.test(sha!)||!/^(0|[1-9]\d*)$/.test(length!)||
   !Number.isSafeInteger(Number(length))||
   utc<expected.publisherDay+'T00:00:00Z')
   throw Error('Nonmatching historical first-party original PDF index provenance');
  const key=JSON.stringify(row),prior=seen.get(ts!);
  if(prior&&prior!==key)throw Error('Contradictory PDF captures at exact second');
  if(prior)continue;
  seen.set(ts!,key);
  originals.push({timestamp:ts!,captureUtc:utc,mime:mime!,sha1Base32:sha!});
 }
 return originals.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
type PDFStatus='sha1_indexed_original_pdf_authenticated'|
 'index_or_archive_unavailable_unknown'|'original_pdf_integrity_mismatch_quarantined';
export async function auditExactHistoricalPdf(
 pin:PdfPin, f:typeof fetch=fetch,
){
 const indexOutput:{indexStatus:'index_candidates'|'index_empty'|'index_unavailable_unknown';
  indexedOriginalCount:number|null;boundedFirstPageMayBeIncomplete:boolean;
  selectedOriginals:Array<{archiveUtc:string;status:PDFStatus;rawBodySha256:string|null;
   byteIdenticalToEarlierPublisherOriginalReceipt:boolean|null;
   observedOriginalBeforePreviouslyKnownArchive:boolean|null}>}={
  indexStatus:'index_unavailable_unknown',indexedOriginalCount:null,
  boundedFirstPageMayBeIncomplete:false,selectedOriginals:[],
 };
 if(!pin.exactUrl.startsWith('https://codytranscripts.apmcdn.org/production/')||
  !/^https:\/\/codytranscripts\.apmcdn\.org\/production\/[a-f0-9]{32}\.pdf$/.test(pin.exactUrl))
  throw Error('Unknown public-first-party transcript PDF URL');
 const query=new URLSearchParams({url:pin.exactUrl,from:'2021',to:'2025',
  matchType:'exact',output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',limit:'12'});
 let found:IndexedPdf[];
 try{
  const r=await f(CDX+'?'+query.toString(),{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000),
   headers:{accept:'application/json','user-agent':'VotePredict/2.0 historical-mpr-3play-metadata-research'}});
  if(r.status!==200||mimeOf(r)!=='application/json')return indexOutput;
  const bytes=await bounded(r,INDEX_MAX);
  found=parseExactPdfIndex(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),pin);
 }catch{return indexOutput;}
 indexOutput.indexedOriginalCount=found.length;
 indexOutput.boundedFirstPageMayBeIncomplete=found.length===12;
 indexOutput.indexStatus=found.length?'index_candidates':'index_empty';
 for(const candidate of found.slice(0,2)){
  const entry:{archiveUtc:string;status:PDFStatus;rawBodySha256:string|null;
   byteIdenticalToEarlierPublisherOriginalReceipt:boolean|null;
   observedOriginalBeforePreviouslyKnownArchive:boolean|null}={
   archiveUtc:candidate.captureUtc,status:'index_or_archive_unavailable_unknown',
   rawBodySha256:null,byteIdenticalToEarlierPublisherOriginalReceipt:null,
   observedOriginalBeforePreviouslyKnownArchive:null,
  };
  const address='https://web.archive.org/web/'+candidate.timestamp+'id_/'+pin.exactUrl;
  try{
   const r=await f(address,{method:'GET',redirect:'manual',
    signal:AbortSignal.timeout(20000),
    headers:{accept:'application/pdf,application/octet-stream','accept-encoding':'identity',
     'user-agent':'VotePredict/2.0 historical-mpr-3play-metadata-research'}});
   if(r.status===200&&mimeOf(r)===candidate.mime){
    const raw=await bounded(r,PDF_MAX);
    if(raw.length>=40&&new TextDecoder().decode(raw.slice(0,8)).startsWith('%PDF-1.')&&
     sha1Base32(raw)===candidate.sha1Base32){
     const digest=sourceSha(raw);
     entry.status='sha1_indexed_original_pdf_authenticated';entry.rawBodySha256=digest;
     entry.byteIdenticalToEarlierPublisherOriginalReceipt=
      digest===pin.independentlyPreviouslyRetrievedPdfSha256;
     entry.observedOriginalBeforePreviouslyKnownArchive=
      pin.previouslyAuthenticatedArchiveUtc===null?null:
       candidate.captureUtc<pin.previouslyAuthenticatedArchiveUtc;
    }else entry.status='original_pdf_integrity_mismatch_quarantined';
   }
  }catch{/* Unavailable or size-capped original remains UNKNOWN. */}
  indexOutput.selectedOriginals.push(entry);
 }
 return indexOutput;
}
export async function auditReformerDatedOriginal(
 target:DatedCandidate,f:typeof fetch=fetch,
 discover:typeof discoverMediaPublicCdxCaptures=discoverMediaPublicCdxCaptures,
 replay:typeof verifyMediaPublicCdxReplay=verifyMediaPublicCdxReplay,
){
 const base={issue:946 as const,publicBriefOriginalId:target.id,
  publisherDisplayedDay:target.publisherDay,
  briefOriginalPreviouslyAuthenticated:true,
  datedOriginalIndexStatus:'index_unavailable_unknown' as
   'index_unavailable_unknown'|'index_empty'|'index_candidates',
  indexedDatedOriginalSnapshots:null as number|null,
  boundedFirstPageMayBeIncomplete:false,
  datedReplays:[] as Array<{archivedUtc:string;
   status:'dated_original_sha1_indexed_original_authenticated'|
    'archival_copy_unavailable_unknown'|'dated_original_integrity_mismatch_quarantined';
   rawOriginalHtmlSha256:string|null}>,
  bothOriginalPathVersionsAuthenticatedInResearch:false,
  historicallySameArticleNotEstablished:true,
  automaticallyDeduplicatedArticleCount:0,
 };
 let index:PublicCdxIndexResult;
 try{
  index=await discover({
   id:target.id+'-dated-research',seedId:'minnesota-reformer-article-archive',
   livePageUrl:target.datedOriginalUrl,
   publicationDayDisplayedOnPublicPage:target.publisherDay,
  },f);
 }catch{return base;}
 if(index.originalUrl!==target.datedOriginalUrl||
  index.historicalFirstPublisherPublicByProven!==false||
  index.originalHttpResponseBytesVerified!==0)
  throw Error('Historical original CDX index source boundaries violated');
 const selected=index.captures.filter(c=>c.archiveCapturedAt>=target.publisherDay+'T00:00:00Z').slice(0,2);
 base.datedOriginalIndexStatus=index.status;
 base.indexedDatedOriginalSnapshots=index.captures.length;
 base.boundedFirstPageMayBeIncomplete=index.resultLimitReachedMayHaveMoreCaptures;
 for(const candidate of selected){
  const result:PublicCdxReplayResult=await replay(candidate,f);
  if(result.archiveUrl!==candidate.archiveUrl||result.leadId!==candidate.leadId||
   result.archiveCapturedAt!==candidate.archiveCapturedAt||
   result.privateVotePredictSourceDocumentMatched!==false||
   result.historicalForecastEligibilityProven!==false||
   result.exactSenatorQuoteHumanVerified!==false)
   throw Error('Untrusted dated-original source validation returned unexpected facts');
  const authenticated=result.status==='matched_indexed_payload_sha1'&&
   result.matchedArchivedIndexPayload&&/^[a-f0-9]{64}$/.test(result.observedRawBodySha256??'');
  const quarantine=result.status==='cdx_payload_sha1_mismatch'||result.status==='untrusted_capture_input'||
   result.status==='matched_indexed_payload_sha1'&&!authenticated;
  base.datedReplays.push({archivedUtc:candidate.archiveCapturedAt,
   status:authenticated?'dated_original_sha1_indexed_original_authenticated':
    quarantine?'dated_original_integrity_mismatch_quarantined':'archival_copy_unavailable_unknown',
   rawOriginalHtmlSha256:authenticated?result.observedRawBodySha256:null,
  });
 }
 base.bothOriginalPathVersionsAuthenticatedInResearch=
  base.datedReplays.some(x=>x.status==='dated_original_sha1_indexed_original_authenticated');
 return base;
}
export async function runTrackDRemainingHistoricalOriginalProbe(
 pins:readonly HistoricalShadowPin[], f:typeof fetch=fetch,
 discover:typeof discoverMediaPublicCdxCaptures=discoverMediaPublicCdxCaptures,
 replay:typeof verifyMediaPublicCdxReplay=verifyMediaPublicCdxReplay,
 pdfAudit:typeof auditExactHistoricalPdf=auditExactHistoricalPdf,
 pause:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,1500)),
){
 const candidates=getRemainingAliasCandidates(pins);
 const aliases=[];
 for(let i=0;i<candidates.length;i++){
  if(i)await pause();
  aliases.push(await auditReformerDatedOriginal(candidates[i]!,f,discover,replay));
 }
 const pdfs=[];
 for(const pin of PDF_PINS){
  await pause();
  pdfs.push({id:pin.id,publisherDay:pin.publisherDay,...await pdfAudit(pin,f)});
 }
 const datedAuthenticated=aliases.filter(x=>x.bothOriginalPathVersionsAuthenticatedInResearch).length;
 const pdfAuthenticated=pdfs.reduce((n,x)=>n+x.selectedOriginals.filter(
  p=>p.status==='sha1_indexed_original_pdf_authenticated').length,0);
 return{
  version:TRACK_D_REMAINING_ORIGINAL_V6,
  mode:'public_only_original_historical_index_and_binary_research',
  exactPublicIndexQueriesPlanned:10,
  exactReformerDatedPathHypotheses:7,
  exactMprTranscriptPdfSources:3,
  reformerDatedUrlsWithIndependentlyAuthenticatedOriginalHtml:datedAuthenticated,
  reformerDatedUrlsWithUnresolvedOrUnverifiedOriginalHtml:7-datedAuthenticated,
  originalPdfArchiveVersionsAuthenticated:pdfAuthenticated,
  reformerHistoricalAliasIdentitiesVerifiedAndApproved:0,
  originalMprAudioBinariesAuthenticated:0,
  fullSpeakerUtterancesHumanApproved:0,
  retrospectiveAsOfFeatureOrActualVoteApproved:0,
  publisherOriginalPostingClockAuthenticated:0,
  automaticArticleAliasDeduplication:0,
  boundedArchivalSourceVersionsNotStatewideCensus:true,
  archiveIndexAvailabilityFailureRemainsUnknown:true,
  directPublisherHttpRequests:0,
  privateDatabaseSourceOrEvidenceReadsOrWrites:0,
  forecastModelCollectorOrVercelWrites:0,
  rawPdfAudioOrArticleHtmlPersisted:false,
  historicalReformerAliasResults:aliases,
  historicalMprTranscriptPdfResults:pdfs,
 };
}

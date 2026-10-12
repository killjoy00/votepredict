/** #864: attempt exact historical indexed original replays for 8 NEW first-party bill statement URLs.
 * Research only; cannot mark source as training/production-eligible. Never dump full copyrighted bodies.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyCurrentLeadManifest} from './audit-senate-864-substantive-public-positions-offline.mjs';
const MAX=2_500_000,ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function sha1Base32(b){
 const d=createHash('sha1').update(b).digest();let bit=0,v=0,out='';
 for(const octet of d){v=(v<<8)|octet;bit+=8;while(bit>=5){bit-=5;out+=ABC[(v>>>bit)&31];}v&=(1<<bit)-1;}
 return out;
}
export function decodeVisibleOriginal(html){
 return String(html).replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:script|style|head|noscript|svg|template)\b[^>]*>[\s\S]*?<\/(?:script|style|head|noscript|svg|template)>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,num)=>{
   const code=hex?Number.parseInt(hex,16):Number(num);
   return code>=0&&code<=0x10FFFF?String.fromCodePoint(code):' ';
  })
  .replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&').replace(/&(?:ldquo|rdquo|lsquo|rsquo);/gi,m=>({
   '&ldquo;':'“','&rdquo;':'”','&lsquo;':'‘','&rsquo;':'’'})[m.toLowerCase()]||m)
  .replace(/&quot;/gi,'"').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
}
export function validCdxEntries(raw,url,afterDay){
 if(!Array.isArray(raw)||JSON.stringify(raw[0])!==JSON.stringify(['timestamp','original','mimetype','statuscode','digest','length']))
  throw Error('incomplete or unverified original CDX schema');
 const target=new URL(url),seen=new Set(),out=[];
 for(const row of raw.slice(1)){
  if(!Array.isArray(row)||row.length!==6)continue;
  const [time,origin,mime,status,digest,length]=row;
  if(!/^20\d{12}$/.test(time)||time<'20210101000000'||time>'20251231235959'||
   !/^(200)$/.test(status)||mime!=='text/html'||!/^[A-Z2-7]{32}$/.test(digest)||!/^\d+$/.test(length))continue;
  let p;try{p=new URL(origin);}catch{continue;}
  if(p.hostname!==target.hostname||p.pathname.replace(/\/$/,'')!==target.pathname.replace(/\/$/,'')||
   Number(length)>MAX||seen.has(time+'|'+digest))continue;
  seen.add(time+'|'+digest);
  out.push({timestamp:time,archiveOriginalUrl:origin,indexedSha1Base32:digest,indexedLength:Number(length)});
 }
 return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).slice(0,5);
}
async function bounded(r,max=MAX){
 if(r.status!==200||!r.body)throw Error('non-200 or empty archive body');
 const header=r.headers.get('content-length');
 if(header&&Number(header)>max)throw Error('body capped');
 let n=0,chunks=[];const reader=r.body.getReader();
 while(true){const k=await reader.read();if(k.done)break;
  n+=k.value.byteLength;if(n>max){await reader.cancel().catch(()=>{});throw Error('body over cap');}
  chunks.push(Buffer.from(k.value));
 }
 return Buffer.concat(chunks,n);
}
export function attributedShortCue(originalBytes,q){
 const full=decodeVisibleOriginal(originalBytes.toString('utf8'));
 const cue=decodeVisibleOriginal(q.exactCurrentlyVisibleShortQuote);
 const offset=full.indexOf(cue);
 const occurrences=offset<0?0:full.split(cue).length-1;
 const before=offset<0?'':full.slice(Math.max(0,offset-260),offset);
 const after=offset<0?'':full.slice(offset+cue.length,offset+cue.length+190);
 // Not a full speaker boundary proof: these names are localization *candidates*.
 const names=q.officialSenatorName.toLowerCase().replace(/\./g,'').split(/\s+/).filter(Boolean);
 const surname=names[names.length-1];
 const nearbySpeaker=Boolean(surname&&(before+after).includes(surname));
 return {literalShortPublisherCueFound:occurrences>0,
  selectedCueOccurrenceCount:occurrences,
  namedSenatorSurnameNearCueHeuristic:nearbySpeaker,
  speakerBoundaryRequiresHumanReview:true,
  wholeHumanApprovedVerbatimQuote:false,
  fullOriginalPublisherHtmlNotPersisted:true};
}
/**
 * Exact written-quote speaker bound: excerpt must be inside closed curly
 * quotation marks, followed immediately by "said Senator First Last" or
 * "said Last" with a uniquely named senator in the preceding source body.
 * This validates *one selected short cue*, not a whole human speech.
 */
export function boundedNamedSpeakerQuote(rawOriginalHtml,q){
 const full=decodeVisibleOriginal(rawOriginalHtml.toString('utf8'));
 const cue=decodeVisibleOriginal(q.exactCurrentlyVisibleShortQuote||'');
 const at=cue.length>=18?full.indexOf(cue):-1;
 if(at<0||full.indexOf(cue,at+1)>=0)return {boundedNamedSpeakerQuote:false,reason:'cue_not_unique_or_absent'};
 const open=full.lastIndexOf('“',at),close=full.indexOf('”',at+cue.length);
 if(open<0||close<0||at-open>1300||close-open>2500||full.indexOf('”',open)<close)
  return {boundedNamedSpeakerQuote:false,reason:'cue_not_within_one_closed_quotation'};
 const parts=q.officialSenatorName.toLowerCase().replace(/\./g,'').split(/\s+/).filter(Boolean);
 const surname=parts.at(-1),given=parts[0];
 if(!/^[a-z]+$/.test(surname)||!/^[a-z]+$/.test(given))
  return {boundedNamedSpeakerQuote:false,reason:'untrusted_senator_identity'};
 const after=full.slice(close+1,close+150);
 const before=full.slice(Math.max(0,open-1300),open);
 const e=surname.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\export async function probe(q,fetcher=fetch){');
 const g=given.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\export async function probe(q,fetcher=fetch){');
 const x=after.match(new RegExp('^\\s*,?\\s*(?:said|stated|added|noted)\\s+(?:(?:senator|sen\\.)\\s+)?(?:'+g+'\\s+(?:[a-z]\\.??\\s+)?)?'+e+'\\b','i'));
 const priorFullName=new RegExp('\\b(?:senator|sen\\.)\\s+'+g+'\\s+(?:[a-z]\\.??\\s+)?'+e+'\\b','i').test(before);
 const afterHasFullName=Boolean(x&&new RegExp('\\b'+g+'\\b','i').test(x[0]));
 const passed=Boolean(x&&(afterHasFullName||priorFullName));
 return {boundedNamedSpeakerQuote:passed,
  reason:passed?'exact_original_closed_quote_immediately_attributed_to_named_senator':'speaker_name_or_quotation_boundary_not_proven',
  selectedCueInsideClosedQuotedRegion:true,
  namedPublisherAttributionAfterQuote:Boolean(x),
  fullSenatorIdentityInSameLocalSpeakerTurn:passed,
  quoteBeginOffset:open,quoteEndOffset:close,
  quoteCharacterSpan:close-open+1,
  completeHumanApprovedWholeSpeech:false,
  noFullCopyrightedSourceSaved:true
 };
}

export async function probe(q,fetcher=fetch){
 const result={sourceId:q.id,originalPublisherUrl:q.originalPublisherUrl,senator:q.officialSenatorName,
  selectedSpeakerCue:q.exactCurrentlyVisibleShortQuote,
  publisherDisplayedDayNotOriginalPublishingProof:q.publisherDisplayedDay,
  originalIndexedArchivePublicByUtc:null,originalBodySHA256:null,indexedOriginalSHA1Base32:null,
  quoteProof:null,archiveState:'UNAVAILABLE_UNKNOWN',
  approvedHistoricalPredictionEvidence:false,individualChamberVoteAuthenticated:false,
  sourceBodyAndCdxIndexIndependentlyReverified:false,errors:[]};
 try{
  const url=new URL('https://web.archive.org/cdx/search/cdx');
  for(const [k,v] of Object.entries({url:q.originalPublisherUrl,output:'json',from:'2021',to:'2025',
   filter:'statuscode:200',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'60'}))url.searchParams.set(k,v);
  url.searchParams.append('filter','mimetype:text/html');
  const r=await fetcher(url,{method:'GET',redirect:'manual',headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(r.status!==200){result.archiveState='CDX_HTTP_'+r.status+'_UNKNOWN';return result;}
  const data=await r.text();
  if(data.length>250000){result.archiveState='CDX_BODY_TOO_LONG_UNKNOWN';return result;}
  let entries;
  try{entries=validCdxEntries(JSON.parse(data),q.originalPublisherUrl,q.publisherDisplayedDay);}catch(e){result.errors.push('invalid_complete_index_schema_or_json');result.archiveState='CDX_INVALID_UNKNOWN';return result;}
  if(!entries.length){result.archiveState='NO_QUALIFYING_INDEXED_CAPTURE_IN_THIS_BOUNDED_QUERY_UNKNOWN';return result;}
  result.eligibleIndexedEntries=entries.length;
  for(const e of entries){
   try{
    const rawurl='https://web.archive.org/web/'+e.timestamp+'id_/'+e.archiveOriginalUrl;
    const b=await fetcher(rawurl,{method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity'},signal:AbortSignal.timeout(25000)});
    if(b.status!==200){result.errors.push('original_replay_http_'+b.status);continue;}
    if(!(b.headers.get('content-type')||'').toLowerCase().startsWith('text/html')){result.errors.push('original_replay_mime_wrong');continue;}
    const body=await bounded(b);
    if(sha1Base32(body)!==e.indexedSha1Base32){result.errors.push('replay_original_sha1_does_not_match_CDX');continue;}
    const proof={...attributedShortCue(body,q),...boundedNamedSpeakerQuote(body,q)};
    result.originalIndexedArchivePublicByUtc=e.timestamp.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3T$4:$5:$6Z');
    result.originalBodySHA256=sha(body);result.indexedOriginalSHA1Base32=e.indexedSha1Base32;
    result.archiveState=proof.literalShortPublisherCueFound?'ARCHIVED_ORIGINAL_BODY_AND_EXACT_SHORT_CUE_VERIFIED':'ARCHIVED_ORIGINAL_BODY_VERIFIED_SHORT_CUE_MISSING';
    result.sourceBodyAndCdxIndexIndependentlyReverified=true;
    result.quoteProof=proof;
    if(proof.literalShortPublisherCueFound)break;
   }catch(e){result.errors.push('original_replay_unavailable_or_invalid');}
  }
  if(!result.originalIndexedArchivePublicByUtc)result.archiveState='INDEX_AVAILABLE_REPLAY_OR_SHA_FAILED_UNKNOWN';
 }catch(e){result.errors.push('archive_access_timeout_or_provider_error');}
 return result;
}
export async function run(manifest,fetcher=fetch){
 const totals=verifyCurrentLeadManifest(manifest);
 const targets=manifest.leads.filter(x=>x.attribution==='individually_named_written_quote');
 const sources=[];
 for(const q of targets)sources.push(await probe(q,fetcher));
 return {schema:'senate-864-new-2023-25-bill-specific-original-source-replay-v1',issue:864,
  pinnedResearchManifests:true,totals,sourceResults:sources,
  wholeOriginalHtmlAuthenticated:sources.filter(x=>x.sourceBodyAndCdxIndexIndependentlyReverified).length,
  originalQuoteCueFound:sources.filter(x=>x.quoteProof?.literalShortPublisherCueFound).length,
  independentlyHumanApprovedFullSenatorSpeechQuotes:0,
  historicalPredictionOrProductionSourcePromotion:0,
  sourceUnreachableIsNeverEvidenceAbsent:true,
  noRawHtmlPersisted:true,noProductionDbForecastModelOrServingChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-substantive-firstparty-current-original-leads-v1.json','utf8'));
 const out=process.argv[2]||'/tmp/senate-864-new-substantive-original-replay.json';
 const report=await run(manifest);
 mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({out,sources:report.sourceResults.length,wholeOriginalHtmlAuthenticated:report.wholeOriginalHtmlAuthenticated,originalQuoteCueFound:report.originalQuoteCueFound,states:report.sourceResults.map(q=>[q.sourceId,q.archiveState])}));
}

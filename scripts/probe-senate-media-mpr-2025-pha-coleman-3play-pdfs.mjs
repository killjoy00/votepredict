/**
 * Public MPR -> American Public Media/3Play PDF evidence audit, two 2025
 * serving Minnesota senators. This is strictly original-source byte proof,
 * not a quote transcript/audio authentication or legislative vote.
 *
 * Never save raw publisher PDF/HTML/WARC; only SHA, byte count, UTC, indexes,
 * short visible speaker-cue flags and self-declared PDF dates may be retained.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {inspectPdfBytes} from './probe-senate-media-mpr-hauschild-3play-pdf.mjs';
export const VERSION='mpr-2025-pha-coleman-3play-original-pdf-history-v1';
export const LEADS=Object.freeze([
 Object.freeze({
  id:'mpr-2025-pha-hmong-lao-veterans',
  displayedDay:'2025-04-24',
  episode:'https://www.mprnews.org/episode/2025/04/24/bill-granting-benefits-to-hmong-lao-veterans-passes-minnesota-senate',
  pdf:'https://codytranscripts.apmcdn.org/production/f6c5cb374510772be01fbc20ea88d2d0.pdf',
  senator:'Susan Pha',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15583',
  speakerLabel:'susan pha:',shortTranscriptCue:"veterans designation on driver's license",
  topic:'veterans_benefits_after_prior_senate_passage',
  collections:['CC-MAIN-2025-21','CC-MAIN-2025-26','CC-MAIN-2025-30'],
  sameDayOriginalMemberVotePredictive:false
 }),
 Object.freeze({
  id:'mpr-2025-coleman-civic-violence',
  displayedDay:'2025-09-11',
  episode:'https://www.mprnews.org/episode/2025/09/11/we-cannot-let-evil-win-minnesota-sen-julia-coleman-on-uptick-in-political-violence',
  pdf:'https://codytranscripts.apmcdn.org/production/2d9064e094aab7627c6e05a3c2aad608.pdf',
  senator:'Julia Coleman',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15556',
  speakerLabel:'julia coleman:',shortTranscriptCue:'we absolutely need to keep guns away from bad people',
  topic:'public_safety_and_political_violence',
  collections:['CC-MAIN-2025-40','CC-MAIN-2025-43','CC-MAIN-2025-47'],
  sameDayOriginalMemberVotePredictive:false
 })
]);
const CAP_PDF=12_000_000,CAP_HTML=2_500_000,CAP_INDEX=110_000,CAP_WARC=13_000_000;
const PDF_TYPES=new Set(['application/pdf','application/octet-stream','application/x-pdf','binary/octet-stream']);
const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',BASE32RE=/^[A-Z2-7]{32}$/;
const cols=['timestamp','original','mimetype','statuscode','digest','length'];
function mime(r){return (r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();}
function sha256(b){return createHash('sha256').update(b).digest('hex');}
function sha1b32(b){let val=0,bits=0,out='';for(const n of createHash('sha1').update(b).digest()){
 val=val<<8|n;bits+=8;while(bits>=5){bits-=5;out+=BASE32[(val>>>bits)&31];}val&=(1<<bits)-1;}
 if(bits)out+=BASE32[(val<<(5-bits))&31];return out;}
function captureStamp(s){
 if(typeof s!=='string'||!/^2025\d{10}$/.test(s))throw Error('out_of_study_year');
 const t=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T'+s.slice(8,10)+':'+s.slice(10,12)+':'+s.slice(12,14)+'Z';
 if(new Date(t).toISOString()!==t.replace('Z','.000Z'))throw Error('invalid_utc');
 return t;
}
export function validateLeads(x=LEADS){
 if(!Array.isArray(x)||x.length!==2)throw Error('unapproved lead count');
 const set=new Set();
 for(let i=0;i<x.length;i++){
  const r=x[i],target=LEADS[i];
  if(JSON.stringify(r)!==JSON.stringify(target)||set.has(r.pdf))throw Error('lead modified, wrong index or repeated URL');
  set.add(r.pdf);
  const page=new URL(r.episode),pdf=new URL(r.pdf);
  if(page.hostname!=='www.mprnews.org'||page.search||page.hash||page.port||page.protocol!=='https:'
   ||!page.pathname.startsWith('/episode/'+r.displayedDay.replaceAll('-','/')+'/')
   ||pdf.hostname!=='codytranscripts.apmcdn.org'||pdf.search||pdf.hash||pdf.port
   ||pdf.protocol!=='https:'||!/^\/production\/[a-f0-9]{32}\.pdf$/.test(pdf.pathname)
   ||!r.lrl.startsWith('https://www.lrl.mn.gov/legdb/fulldetail?ID='))throw Error('not the exact first-party transcript source');
 }
 return x;
}
async function request(url,f,accept,headers={},ms=18000){
 return f(url,{method:'GET',redirect:'manual',
  headers:{accept,'accept-encoding':'identity','user-agent':'VotePredict/2.0-public-mpr-transcript-originals',...headers},
  signal:AbortSignal.timeout(ms)});
}
async function bounded(response,max,min=40){
 const reported=response.headers.get('content-length');
 if(reported!==null&&(!/^\d+$/.test(reported)||+reported>max))throw Error('too_large');
 if(!response.body)throw Error('empty_body');
 const chunks=[],reader=response.body.getReader();let len=0;
 for(;;){const x=await reader.read();if(x.done)break;len+=x.value.byteLength;
  if(len>max){await reader.cancel().catch(()=>{});throw Error('too_large');}chunks.push(x.value);}
 if(len<min)throw Error('too_short');
 const b=Buffer.allocUnsafe(len);let i=0;for(const x of chunks){Buffer.from(x).copy(b,i);i+=x.byteLength;}return b;
}
function visibleText(s){
 return s.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:head|script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/(?:head|script|style|noscript|svg|template)>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&(?:rsquo|lsquo|apos|#39|#x27);/gi,"'")
  .replace(/&(?:ldquo|rdquo|quot|#34);/gi,'"')
  .replace(/&nbsp;|&#160;/gi,' ')
  .normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/\s+/g,' ').toLowerCase();
}
export function inspectParentHtml(body,lead){
 const src=body.replace(/\\\//g,'/').replace(/&amp;/g,'&');
 const text=visibleText(src);
 return {
  literalExactApmCdnPdfUrlReferenced:src.includes(lead.pdf),
  selectedSenatorLabelVisible:text.includes(lead.speakerLabel),
  shortSelectedUtteranceVisible:text.includes(lead.shortTranscriptCue),
  currentSpeakerCueNotHistoricalPdfOrAudioProof:true
 };
}
export async function probeCurrentPublisher(lead,f=fetch){
 const result={htmlStatus:'unknown',pdfStatus:'unknown',originalEpisode:lead.episode,linkedPdf:lead.pdf,
  htmlSha256:null,htmlBytes:null,currentPublisherHtmlCues:null,
  pdfSha256:null,pdfSha1Base32:null,pdfBytes:null,pdfVersion:null,
  embeddedPdfDates:null,httpLastModified:null,httpEtagPresent:false,
  currentPdfShaDoesNotProveHistoricalAvailability:true};
 try{
  const r=await request(lead.episode,f,'text/html');
  if(r.status!==200||mime(r)!=='text/html')result.htmlStatus='current_publisher_html_http_or_mime_unknown';
  else {const b=await bounded(r,CAP_HTML);
   result.htmlStatus='current_first_party_html_sha256_verified';result.htmlSha256=sha256(b);result.htmlBytes=b.length;
   result.currentPublisherHtmlCues=inspectParentHtml(b.toString('utf8'),lead);}
 }catch{result.htmlStatus='current_publisher_html_fetch_unknown';}
 try{
  const r=await request(lead.pdf,f,'application/pdf,application/octet-stream');
  if(r.status!==200||!PDF_TYPES.has(mime(r)))result.pdfStatus='current_first_party_pdf_http_or_mime_unknown';
  else{const b=await bounded(r,CAP_PDF),ins=inspectPdfBytes(b);
   result.pdfStatus='current_apm_original_pdf_bytes_sha256_verified';
   result.pdfSha256=sha256(b);result.pdfSha1Base32=sha1b32(b);result.pdfBytes=b.length;
   result.pdfVersion=ins.pdfVersion;result.embeddedPdfDates=ins.selectedEmbeddedDateFields;
   result.httpLastModified=r.headers.get('last-modified')?.slice(0,100)??null;
   result.httpEtagPresent=!!r.headers.get('etag');}
 }catch{result.pdfStatus='current_first_party_pdf_fetch_or_magic_unknown';}
 return result;
}
export function parseExactPdfCdx(data,lead){
 if(!Array.isArray(data)||data.length<1||data.length>17
  ||JSON.stringify(data[0])!==JSON.stringify(cols))throw Error('invalid_exact_pdf_cdx');
 const out=[],seen=new Map();
 for(const r of data.slice(1)){
  if(!Array.isArray(r)||r.length!==6)throw Error('invalid_cdx_row');
  const[t,u,m,s,d,n]=r,utc=captureStamp(t);
  if(u!==lead.pdf||s!=='200'||!PDF_TYPES.has(m)||!BASE32RE.test(d)
   ||! /^\d+$/.test(n)||!Number.isSafeInteger(+n))throw Error('not_same_original_pdf');
  if(t<lead.displayedDay.replaceAll('-','')+'000000')throw Error('capture_predates_displayed_episode_day');
  const raw=JSON.stringify(r);
  if(seen.has(t)&&seen.get(t)!==raw)throw Error('conflicting_original_capture');seen.set(t,raw);
  if(out.some(v=>v.timestamp===t))continue;
  out.push({timestamp:t,captureUtc:utc,indexedSha1Base32:d,indexedMime:m});
 }
 return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function replayWaybackPdf(lead,record,f){
 const v={captureUtc:record.captureUtc,indexedSha1Base32:record.indexedSha1Base32,status:'unknown',rawSha256:null,bytes:null,pdfVersion:null,
  embeddedPdfDates:null,historicQuoteAndAudioNotCertified:true};
 try{
  const r=await request('https://web.archive.org/web/'+record.timestamp+'id_/'+lead.pdf,f,'application/pdf,application/octet-stream',{},25000);
  if(r.status!==200||!PDF_TYPES.has(mime(r))){v.status='archived_original_pdf_http_mime_or_redirect_unknown';return v;}
  const b=await bounded(r,CAP_PDF);
  if(sha1b32(b)!==record.indexedSha1Base32){v.status='original_pdf_cdx_payload_digest_mismatch_unknown';return v;}
  const meta=inspectPdfBytes(b);
  v.status='sha1_authenticated_historical_original_apm_pdf';
  v.rawSha256=sha256(b);v.bytes=b.length;v.pdfVersion=meta.pdfVersion;
  v.embeddedPdfDates=meta.selectedEmbeddedDateFields;return v;
 }catch{v.status='archived_original_pdf_replay_unknown';return v;}
}
export async function probeWaybackPdf(lead,f=fetch){
 let records=null;
 try{
  const q=new URLSearchParams({url:lead.pdf,matchType:'exact',
   from:lead.displayedDay.replaceAll('-',''),to:'2025',output:'json',
   fl:cols.join(','),filter:'statuscode:200',limit:'16'});
  const r=await request('https://web.archive.org/cdx/search/cdx?'+q,f,'application/json');
  if(r.status!==200||mime(r)!=='application/json')throw Error('index_unavailable');
  records=parseExactPdfCdx(JSON.parse((await bounded(r,CAP_INDEX,10)).toString('utf8')),lead);
 }catch{}
 const replays=[];for(const v of records?.slice(0,2)??[])replays.push(await replayWaybackPdf(lead,v,f));
 return {status:records===null?'historical_index_unavailable_unknown':records.length?'historical_index_candidates':'historical_index_no_matching_originals_unknown',
  candidateCount:records?.length??null,possiblyTruncated:records?.length===16,
  historicalPdfReplays:replays,emptyOrFailedIndexNotProofNo2025Pdf:true};
}
export function parseExactCrawlPdf(jsonl,lead,collection){
 if(!lead.collections.includes(collection))throw Error('unapproved_commoncrawl_year');
 const lines=jsonl.trim().split(/\r?\n/);
 if(lines.length>11)throw Error('too_many_original_pdf_records');
 const entries=[],known=new Set();
 for(const l of lines){
  if(!l.trim())continue;const x=JSON.parse(l),utc=captureStamp(x.timestamp);
  if(x.timestamp<lead.displayedDay.replaceAll('-','')+'000000'
   ||x.url!==lead.pdf||x.status!=='200'||!PDF_TYPES.has(x.mime)||!BASE32RE.test(x.digest)
   ||typeof x.filename!=='string'||!x.filename.startsWith('crawl-data/'+collection+'/segments/')
   ||x.filename.includes('..')||!/^[a-zA-Z0-9/_.-]+\.warc\.gz$/.test(x.filename)
   ||! /^\d+$/.test(String(x.offset))||! /^\d+$/.test(String(x.length))
   ||+x.length<100||+x.length>CAP_WARC||!Number.isSafeInteger(+x.offset)||!Number.isSafeInteger(+x.length)
   ||+x.offset>Number.MAX_SAFE_INTEGER-(+x.length))throw Error('untrusted_warc_record');
  const key=x.timestamp+'|'+x.digest;
  if(known.has(key))continue;known.add(key);
  entries.push({timestamp:x.timestamp,captureUtc:utc,indexedSha1Base32:x.digest,
   filename:x.filename,offset:+x.offset,compressedLength:+x.length,collection});
 }
 return entries.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
function splitHead(buffer,start=0){
 let at=buffer.indexOf('\r\n\r\n',start),size=4;
 if(at<0){at=buffer.indexOf('\n\n',start);size=2;}
 if(at<0||at-start>30_000)throw Error('no_warc_http_header');
 return {headers:buffer.subarray(start,at).toString('utf8'),next:at+size};
}
function field(src,key){return src.match(new RegExp('^'+key+':\\s*(.+)$','im'))?.[1]?.trim()??null;}
export function extractOriginalWarcPdf(compressed,entry,pdfUrl){
 if(!Buffer.isBuffer(compressed)||compressed.length!==entry.compressedLength)throw Error('warc_compressed_range_length_mismatch');
 const raw=gunzipSync(compressed,{maxOutputLength:CAP_PDF+160_000}),a=splitHead(raw);
 if(!a.headers.startsWith('WARC/1.')||field(a.headers,'WARC-Type')!=='response'
  ||field(a.headers,'WARC-Target-URI')!==pdfUrl
  ||field(a.headers,'WARC-Payload-Digest')!=='sha1:'+entry.indexedSha1Base32
  ||!field(a.headers,'WARC-Date')?.startsWith(entry.captureUtc.slice(0,19)))throw Error('warc_original_envelope_not_authenticated');
 const b=splitHead(raw,a.next),len=field(a.headers,'Content-Length');
 if(!/^HTTP\/[12](?:\.\d)? 200\b/.test(b.headers)||! /^\d+$/.test(len||''))throw Error('original_warc_http_not_200');
 const ty=field(b.headers,'content-type')?.split(';')[0].trim().toLowerCase();
 if(ty&&!PDF_TYPES.has(ty))throw Error('original_warc_payload_mime_not_pdf');
 const last=a.next+Number(len);
 if(last>raw.length||last<b.next||last-b.next>CAP_PDF)throw Error('original_payload_outside_warc_record');
 const pdf=raw.subarray(b.next,last);
 if(sha1b32(pdf)!==entry.indexedSha1Base32)throw Error('original_pdf_not_equal_to_crawl_index_digest');
 const inspected=inspectPdfBytes(pdf);
 return {rawSha256:sha256(pdf),bytes:pdf.length,pdfVersion:inspected.pdfVersion,
  embeddedPdfDates:inspected.selectedEmbeddedDateFields};
}
async function crawlRange(lead,entry,f){
 const result={utc:entry.captureUtc,collection:entry.collection,sourceWarcFilename:entry.filename,
  sourceCompressedRangeOffset:entry.offset,sourceCompressedRangeBytes:entry.compressedLength,
  indexedSha1Base32:entry.indexedSha1Base32,status:'unknown',rawSha256:null,bytes:null,
  embeddedPdfDates:null,historicAudioOrSpeakerAttributionNotApproved:true};
 try{
  const stop=entry.offset+entry.compressedLength-1;
  const r=await request('https://data.commoncrawl.org/'+entry.filename,f,
   'application/gzip,application/octet-stream',{Range:'bytes='+entry.offset+'-'+stop},25000);
  if(r.status!==206||!r.headers.get('content-range')?.startsWith('bytes '+entry.offset+'-'+stop+'/')){
   result.status='non_exact_commoncrawl_byte_range_unknown';return result;}
  const original=extractOriginalWarcPdf(await bounded(r,CAP_WARC,100),entry,lead.pdf);
  result.status='sha1_authenticated_original_commoncrawl_pdf';
  result.rawSha256=original.rawSha256;result.bytes=original.bytes;result.embeddedPdfDates=original.embeddedPdfDates;
  return result;
 }catch{result.status='commoncrawl_warc_or_index_digest_unknown';return result;}
}
export async function probeCommonCrawlPdf(lead,f=fetch){
 const collections=[];
 for(const c of lead.collections){
  let rows=null,status='index_unavailable_unknown';
  try{
   const q=new URLSearchParams({url:lead.pdf,output:'json',filter:'status:200',limit:'10'});
   const r=await request('https://index.commoncrawl.org/'+c+'-index?'+q,f,'application/x-ndjson,text/plain,application/json');
   if(r.status===404)status='not_indexed_selected_collection_unknown';
   else if(r.status===200){rows=parseExactCrawlPdf((await bounded(r,CAP_INDEX,2)).toString('utf8'),lead,c);status='exact_pdf_index_retrieved';}
  }catch{status='index_unavailable_unknown';}
  const originalAttempts=[];for(const item of rows?.slice(0,1)??[])originalAttempts.push(await crawlRange(lead,item,f));
  collections.push({collection:c,status,candidateCount:rows?.length??null,originalAttempts});
 }
 return {collections,unavailableOrMissingIndexCannotProvePdfWasAbsent:true};
}
export async function runPhaColemanTranscriptPdfProbe(f=fetch){
 const reports=[];
 for(const lead of validateLeads()){
  const current=await probeCurrentPublisher(lead,f);
  const [wayback,commonCrawl]=await Promise.all([probeWaybackPdf(lead,f),probeCommonCrawlPdf(lead,f)]);
  const successful=[...wayback.historicalPdfReplays,...commonCrawl.collections.flatMap(x=>x.originalAttempts)]
   .filter(x=>x.status==='sha1_authenticated_historical_original_apm_pdf'
    ||x.status==='sha1_authenticated_original_commoncrawl_pdf');
  reports.push({
   id:lead.id,senator:lead.senator,publisherDisplayedDay:lead.displayedDay,
   episodeUrl:lead.episode,apm3PlayPdfUrl:lead.pdf,topic:lead.topic,
   current,wayback,commonCrawl,
   authenticatedHistoricalOriginalPdfCaptures:successful.length,
   authenticHistoricalPdfBodies:successful.map(x=>({
    utc:x.captureUtc??x.utc,source:x.collection?'commoncrawl_warc':'wayback_original',
    indexedSha1Base32:x.indexedSha1Base32,rawSha256:x.rawSha256,bytes:x.bytes,
    embeddedPdfDates:x.embeddedPdfDates
   })),
   earliestVerifiedPublicArchiveCaptureUtc:successful.length?successful.map(x=>x.captureUtc??x.utc).sort()[0]:null,
   selectedHistoricalSenatorVerbatimQuoteHumanApproved:false,
   publicationTimeOfTranscriptNotProvedByPdfInternalCreationDate:true,
   noActualRecordedIndividualVoteAuthenticated:true,
   preBroadcast2025TranscriptAvailabilityProved:false
  });
 }
 return {version:VERSION,researchDate:'2026-10-11',namedServingSenators:2,displayedOriginalStudyYear:2025,
  sourcePdfUrls:reports.length,reports,
  verified2025OriginalApMTranscriptPdfCaptures:reports.reduce((n,x)=>n+x.authenticatedHistoricalOriginalPdfCaptures,0),
  currentPdfBytesNeverBackdatedToBroadcastDay:true,
  publicOriginalMediaNotHumanApprovedAsSenatorQuote:true,
  noPrivateExportOrDbTouched:true,noArticlePdfAudioWarcBytesSaved:true,
  noProductionSeedCollectorOrIngestionOrForecastOrModelChanges:true};
}

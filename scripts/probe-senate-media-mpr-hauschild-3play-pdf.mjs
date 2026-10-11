/**
 * Public MPR News 2024 Hauschild interview transcript PDF provenance.
 *
 * Bound one exact APM/CDN 3Play transcript PDF URL, original historical MPR HTML
 * (three previously SHA1 and SHA256-pinned versions), original Wayback PDF,
 * and 3 selected Common Crawl original PDF WARC-HTTP captures.
 * Raw source HTML/PDF/WARC is never written to disk or an artifact. Page date,
 * PDF embedded metadata and today's HTTP headers never prove first posting time.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
export const VERSION='senate-media-mpr-hauschild-3play-original-pdf-provenance-v1';
export const EPISODE='https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south';
export const PDF='https://codytranscripts.apmcdn.org/production/70fb369cef19a16a739671110457b6b9.pdf';
export const COLLECTIONS=Object.freeze(['CC-MAIN-2024-10','CC-MAIN-2024-22','CC-MAIN-2025-30']);
export const ORIGINAL_PAGE_PINS=Object.freeze([
 Object.freeze({id:'2024-original-early',stamp:'20240219225556',sha1:'DHKJFEB7VR76PWGE7EY2ZOUDZKLYKV5X',sha256:'a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387',bytes:80716}),
 Object.freeze({id:'2024-original-next',stamp:'20240220030216',sha1:'RBCAJH6FOUINBMBZWYXEX7GWIEIBHNDQ',sha256:'da848c28bb3c3e1335076de4606ec472d8695a4c2533add45812614df3fc9536',bytes:80716}),
 Object.freeze({id:'2025-transcript-positive-original',stamp:'20250724232322',sha1:'TKIPF5NUQ7HICXBKMOAPLBBOTJCVBLPO',sha256:'9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725',bytes:121462})
]);
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',CAP_INDEX=90_000,CAP_PDF=12_000_000,CAP_HTML=2_500_000,CAP_WARC=13_000_000;
const MIME_PDF=new Set(['application/pdf','application/octet-stream','binary/octet-stream','application/x-pdf']);
const timestamp=s=>{if(!/^20(?:24|25)\d{10}$/.test(s))throw Error('out_of_time_window');
 const x=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T'+s.slice(8,10)+':'+s.slice(10,12)+':'+s.slice(12,14)+'Z';
 if(new Date(x).toISOString()!==x.replace('Z','.000Z'))throw Error('invalid_capture_utc');return x;};
const sha256=b=>createHash('sha256').update(b).digest('hex');
function sha1b32(b){let v=0,bits=0,out='';for(const byte of createHash('sha1').update(b).digest()){
 v=v<<8|byte;bits+=8;while(bits>=5){bits-=5;out+=B32[v>>>bits&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[v<<(5-bits)&31];return out;}
const mime=r=>(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
async function bounded(response,max,min=40){const h=response.headers.get('content-length');
 if(h!==null&&(!/^\d+$/.test(h)||Number(h)>max))throw Error('body_size_limit');
 if(!response.body)throw Error('no_body');
 const r=response.body.getReader(),parts=[];let n=0;
 while(true){const x=await r.read();if(x.done)break;n+=x.value.byteLength;if(n>max){await r.cancel().catch(()=>{});throw Error('body_size_limit');}parts.push(x.value);}
 if(n<min)throw Error('small_body');const raw=Buffer.allocUnsafe(n);let p=0;
 for(const part of parts){Buffer.from(part).copy(raw,p);p+=part.byteLength;}
 return raw;
}
async function req(url,f,accept,headers={},timeout=25000){return f(url,{method:'GET',redirect:'manual',
 headers:{accept,'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-transcript-original-audit',...headers},
 signal:AbortSignal.timeout(timeout)});}
function pdfMagic(b){return b.length>=50&&b.subarray(0,8).toString('latin1').startsWith('%PDF-1.');}
export function inspectPdfBytes(b){
 if(!Buffer.isBuffer(b)||!pdfMagic(b))throw Error('not_pdf_original_magic');
 const h=b.subarray(0,32).toString('latin1').match(/^%PDF-(\d\.\d)/)?.[1]||null;
 const src=b.toString('latin1');
 const info={};
 for(const [key,regex] of Object.entries({
  embeddedPdfCreationDate:/\/CreationDate\s*\(\s*(D:[^)]{5,90})\)/,
  embeddedPdfModificationDate:/\/ModDate\s*\(\s*(D:[^)]{5,90})\)/,
  xmpCreateDate:/<xmp:CreateDate>([^<]{5,60})<\/xmp:CreateDate>/,
  xmpModifyDate:/<xmp:ModifyDate>([^<]{5,60})<\/xmp:ModifyDate>/
 })){const m=src.match(regex);info[key]=m?.[1]?.slice(0,65)??null;}
 return {pdfVersion:h,selectedEmbeddedDateFields:info,
  metadataDatesDoNotProvePublicFirstAvailability:true,fullPdfContentNotRetained:true};
}
export function inspectPublisherHtml(html){
 const src=html.replace(/\\\//g,'/').replace(/&amp;/g,'&');
 const low=src.toLowerCase();
 return {exact3PlayCdnPdfUrlStringFound:src.includes(PDF),
  apmTranscriptPdfHostStringFound:src.includes('codytranscripts.apmcdn.org'),
  selectedSpeakerLabelLiteralFound:low.includes('grant hauschild:'),
  selectedHistoricalTranscriptPhraseLiteralFound:low.includes('i feel that immigration is a federal issue'),
  negativeExactLiteralIsNotProofNoOtherTranscriptReferences:true};
}
export async function probeCurrentPdf(f=fetch){
 const out={url:PDF,status:'unknown',mime:null,bytes:null,rawSha256:null,httpLastModified:null,httpETagPresent:false,
  pdfMetadata:null,nonHistoricCurrentPdf:true,firstPublishedAtNotCertified:true};
 try{const r=await req(PDF,f,'application/pdf,application/octet-stream');
  if(r.status!==200){out.status=r.status>=300&&r.status<400?'publisher_pdf_redirect_unfollowed_unknown':'publisher_pdf_http_unknown';return out;}
  out.mime=mime(r);
  if(!MIME_PDF.has(out.mime)){out.status='unexpected_pdf_http_mime_unknown';return out;}
  const b=await bounded(r,CAP_PDF);
  out.pdfMetadata=inspectPdfBytes(b);out.rawSha256=sha256(b);out.bytes=b.length;
  out.httpLastModified=r.headers.get('last-modified')?.slice(0,100)||null;
  out.httpETagPresent=!!r.headers.get('etag');
  out.status='current_publisher_pdf_bytes_sha256_verified';
  return out;
 }catch(e){out.status=e instanceof Error&&e.message==='body_size_limit'?'current_pdf_size_limit_unknown':'current_pdf_unavailable_or_format_unknown';return out;}
}
export async function probePinnedMprHtml(f=fetch){
 const out=[];
 for(const p of ORIGINAL_PAGE_PINS){
  const x={id:p.id,captureUtc:timestamp(p.stamp),indexSha1Base32:p.sha1,
   previouslyVerifiedSha256:p.sha256,status:'unknown',rawSha256:null,originalBytes:null,selectedReferences:null};
  try{
   const r=await req('https://web.archive.org/web/'+p.stamp+'id_/'+EPISODE,f,'text/html');
   if(r.status>=300&&r.status<400){x.status='historical_page_replay_redirect_unknown';out.push(x);continue;}
   if(r.status!==200||mime(r)!=='text/html'){x.status='historical_page_replay_http_or_mime_unknown';out.push(x);continue;}
   const b=await bounded(r,CAP_HTML),a=sha1b32(b),d=sha256(b);
   if(a!==p.sha1||d!==p.sha256||b.length!==p.bytes){x.status='original_historic_page_sha_or_length_mismatch_unknown';out.push(x);continue;}
   x.status='reverified_original_publisher_html_sha1_sha256';x.rawSha256=d;x.originalBytes=b.length;
   x.selectedReferences=inspectPublisherHtml(b.toString('utf8'));
  }catch{x.status='historical_page_replay_unavailable_unknown';}
  out.push(x);
 }
 return out;
}
export function parsePdfCdx(v){
 const columns=['timestamp','original','mimetype','statuscode','digest','length'];
 if(!Array.isArray(v)||v.length<1||v.length>17||JSON.stringify(v[0])!==JSON.stringify(columns))throw Error('unsafe_cdx_shape');
 const out=[],seen=new Map();
 for(const row of v.slice(1)){
  if(!Array.isArray(row)||row.length!==6)throw Error('unsafe_cdx_row');
  const[t,u,m,s,d,n]=row;
  timestamp(t);
  if(t<'20240219000000'||u!==PDF||!MIME_PDF.has(m)||s!=='200'
   ||!/^[A-Z2-7]{32}$/.test(d)||!/^\d+$/.test(n)||!Number.isSafeInteger(+n))throw Error('unsafe_cdx_original_pdf');
  const ref=JSON.stringify(row);if(seen.has(t)){if(seen.get(t)!==ref)throw Error('conflicting_original_pdf_capture');continue;}
  seen.set(t,ref);out.push({timestamp:t,captureUtc:timestamp(t),mime:m,indexedSha1Base32:d});
 }
 return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function pdfWaybackIndex(f){
 const q=new URLSearchParams({url:PDF,matchType:'exact',from:'20240219',to:'2025',output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',limit:'16'});
 const r=await req('https://web.archive.org/cdx/search/cdx?'+q,f,'application/json');
 if(r.status!==200||mime(r)!=='application/json')throw Error('wayback_pdf_index_unavailable');
 const buf=await bounded(r,CAP_INDEX,10);
 return parsePdfCdx(JSON.parse(buf.toString('utf8')));
}
async function replayPdfWayback(r,f){
 const out={captureUtc:r.captureUtc,indexedOriginalSha1:r.indexedSha1Base32,status:'unknown',rawOriginalSha256:null,originalBytes:null,
  pdfMetadata:null,originalPdfSpeakerWordsNotHumanReviewed:true};
 try{const res=await req('https://web.archive.org/web/'+r.timestamp+'id_/'+PDF,f,'application/pdf,application/octet-stream',{},30000);
  if(res.status>=300&&res.status<400){out.status='wayback_pdf_archive_redirect_unknown';return out;}
  if(res.status!==200||mime(res)!==r.mime){out.status='wayback_pdf_replay_http_mime_unknown';return out;}
  const body=await bounded(res,CAP_PDF);
  if(sha1b32(body)!==r.indexedSha1Base32){out.status='wayback_pdf_index_sha1_mismatch_unknown';return out;}
  const meta=inspectPdfBytes(body);
  out.status='historically_authenticated_original_pdf_sha1';out.rawOriginalSha256=sha256(body);out.originalBytes=body.length;out.pdfMetadata=meta;
  return out;
 }catch{out.status='wayback_pdf_replay_unavailable_unknown';return out;}
}
export async function probePdfWayback(f=fetch){
 let rows=null;try{rows=await pdfWaybackIndex(f);}catch{}
 const captures=[];for(const r of rows?.slice(0,2)??[])captures.push(await replayPdfWayback(r,f));
 return {indexStatus:rows===null?'index_unavailable_unknown':rows.length?'indexed_original_pdf_candidates':'index_empty_unknown',
  indexedCandidates:rows?.length??null,firstPagePossiblyTruncated:rows?.length===16,
  firstTwoArchivePdfReplayAttempts:captures,missingIndexDoesNotMeanPdfUnavailableThen:true};
}
export function parsePdfCommonCrawl(jsonl,collection){
 if(!COLLECTIONS.includes(collection))throw Error('unapproved_crawl_collection');
 const lines=jsonl.trim().split(/\r?\n/);if(lines.length>9)throw Error('too_many_crawl_pdf_rows');
 const out=[];
 for(const line of lines){
  if(!line.trim())continue;const x=JSON.parse(line),t=x.timestamp;
  timestamp(t);
  if(t<'20240219000000'||x.url!==PDF||x.status!=='200'||!MIME_PDF.has(x.mime)
   ||!/^[A-Z2-7]{32}$/.test(x.digest)
   ||typeof x.filename!=='string'||!x.filename.startsWith('crawl-data/'+collection+'/segments/')
   ||!/^[-A-Za-z0-9/_.]+\.warc\.gz$/.test(x.filename)||x.filename.includes('..')
   ||!/^\d+$/.test(String(x.offset))||!/^\d+$/.test(String(x.length))
   ||+x.length<100||+x.length>CAP_WARC||!Number.isSafeInteger(+x.offset)||!Number.isSafeInteger(+x.length)
   ||+x.offset>Number.MAX_SAFE_INTEGER-(+x.length))throw Error('untrusted_exact_crawl_pdf_original');
  out.push({collection,captureUtc:timestamp(t),indexedSha1Base32:x.digest,
   warcFilename:x.filename,offset:+x.offset,compressedLength:+x.length});
 }
 return out;
}
function head(b,from=0){let idx=b.indexOf('\r\n\r\n',from),plus=4;if(idx<0){idx=b.indexOf('\n\n',from);plus=2;}
 if(idx<0||idx-from>30000)throw Error('untrusted_http_or_warc_header');return {text:b.subarray(from,idx).toString('utf8'),next:idx+plus};}
function field(s,name){return s.match(new RegExp('^'+name+':\\s*(.+)$','im'))?.[1]?.trim()??null;}
export function extractOriginalWarcPdf(compressed,row){
 if(!Buffer.isBuffer(compressed)||compressed.length!==row.compressedLength)throw Error('compressed_range_size_mismatch');
 const body=gunzipSync(compressed,{maxOutputLength:CAP_PDF+120_000}),wh=head(body);
 if(!wh.text.startsWith('WARC/1.')||field(wh.text,'WARC-Type')!=='response'
  ||field(wh.text,'WARC-Target-URI')!==PDF
  ||field(wh.text,'WARC-Payload-Digest')!=='sha1:'+row.indexedSha1Base32
  ||!field(wh.text,'WARC-Date')?.startsWith(row.captureUtc.slice(0,19)))throw Error('warc_pdf_envelope_mismatch');
 const hh=head(body,wh.next),size=field(wh.text,'Content-Length');
 if(!/^HTTP\/[12](?:\.\d)? 200\b/.test(hh.text)||!/^\d+$/.test(size||''))throw Error('recorded_pdf_http_or_warc_content_length_mismatch');
 const type=field(hh.text,'content-type')?.split(';')[0].trim().toLowerCase();
 if(type&&!MIME_PDF.has(type))throw Error('recorded_pdf_mime_mismatch');
 const end=wh.next+Number(size);
 if(end>body.length||end<hh.next||end-hh.next>CAP_PDF)throw Error('recorded_pdf_length_out_of_range');
 const original=body.subarray(hh.next,end);
 if(sha1b32(original)!==row.indexedSha1Base32)throw Error('recorded_pdf_original_sha1_mismatch');
 return {pdf:inspectPdfBytes(original),originalSha256:sha256(original),originalBytes:original.length};
}
async function pdfCrawlIndex(c,f){
 const q=new URLSearchParams({url:PDF,output:'json',filter:'status:200',limit:'8'});
 const r=await req('https://index.commoncrawl.org/'+c+'-index?'+q,f,'application/x-ndjson,text/plain,application/json');
 if(r.status===404)return {indexStatus:'not_indexed_selected_collection_unknown',rows:[]};
 if(r.status!==200)throw Error('crawl_index_unavailable');
 const body=await bounded(r,CAP_INDEX,2);
 return {indexStatus:'index_rows_received',rows:parsePdfCommonCrawl(body.toString('utf8'),c)};
}
async function replayCrawlPdf(row,f){
 const url='https://data.commoncrawl.org/'+row.warcFilename,stop=row.offset+row.compressedLength-1;
 const out={utc:row.captureUtc,collection:row.collection,
  indexedOriginalSha1:row.indexedSha1Base32,sourceRangeFileUrl:url,sourceRangeOffset:row.offset,
  sourceRangeCompressedBytes:row.compressedLength,status:'unknown',rawOriginalSha256:null,originalBytes:null,pdfMetadata:null};
 try{
  const r=await req(url,f,'application/gzip,application/octet-stream',{Range:'bytes='+row.offset+'-'+stop},30000);
  if(r.status!==206||!r.headers.get('content-range')?.startsWith('bytes '+row.offset+'-'+stop+'/')){
   out.status='not_verified_exact_warc_range_unknown';return out;}
  const raw=await bounded(r,CAP_WARC,100),verified=extractOriginalWarcPdf(raw,row);
  out.status='historically_authenticated_original_commoncrawl_pdf_sha1';
  out.rawOriginalSha256=verified.originalSha256;out.originalBytes=verified.originalBytes;out.pdfMetadata=verified.pdf;return out;
 }catch{out.status='commoncrawl_pdf_original_replay_or_digest_unknown';return out;}
}
export async function probePdfCommonCrawl(f=fetch){
 const collections=[];
 for(const c of COLLECTIONS){
  let v;
  try{v=await pdfCrawlIndex(c,f);}catch{collections.push({collection:c,indexStatus:'index_unavailable_unknown',indexedCandidates:null,firstWarcReplayAttempts:[]});continue;}
  const replays=[];for(const row of v.rows.slice(0,1))replays.push(await replayCrawlPdf(row,f));
  collections.push({collection:c,indexStatus:v.indexStatus,indexedCandidates:v.rows.length,firstWarcReplayAttempts:replays});
 }
 return {sourceExactPdfUrl:PDF,collections,exactIndexedOriginalPdfOnly:true,
  noIndependentlyAuthenticatedArchivePdfIsNotEvidenceOfAbsence:true};
}
export async function runHauschildPdfOriginalProbe(f=fetch){
 const current=await probeCurrentPdf(f),parent=await probePinnedMprHtml(f);
 const [wayback,common]=await Promise.all([probePdfWayback(f),probePdfCommonCrawl(f)]);
 const successful=[...wayback.firstTwoArchivePdfReplayAttempts,
  ...common.collections.flatMap(c=>c.firstWarcReplayAttempts)].filter(x=>x.status?.startsWith('historically_authenticated_original_'));
 return {version:VERSION,researchDay:'2026-10-11',firstPartyOriginalMprEpisode:EPISODE,
  exactPublisherLinkedTranscriptPdf:PDF,
  hostedByAmericanPublicMediaCdn:true,thirdPartyTranscriberListedByMpr:'3Play Media',
  currentTranscriptPdf:current,exactHistoricalMprHtmlVersions:parent,
  historicalExactTranscriptPdfWaybackIndex:wayback,historicalExactTranscriptPdfCommonCrawl:common,
  historicallySha1AuthenticatedOriginalTranscriptPdfVersions:successful.length,
  earliestAuthenticatedPdfCaptureUtc:successful.length?successful.map(x=>x.captureUtc??x.utc).sort()[0]:null,
  noFullTranscriptOrPdfOrSourceHtmlPersisted:true,
  rawCurrentlyServedPdfNotProofOfHistoricalPosting:true,
  embeddedPdfCreationOrModificationMetadataNotServerPublishDate:true,
  noIndividualSpeechFromPdfAutomaticallyCertified:true,noRecordedIndividualSenateVotesCertified:true,
  noOriginal2024Mp3HistoricalBinaryAuthenticated:true,
  privateDataOrProductionCollectorsOrForecastsTouched:false};
}

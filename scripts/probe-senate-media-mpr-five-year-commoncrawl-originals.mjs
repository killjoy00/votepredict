/**
 * Public MPR News original reporting + Common Crawl WARC historical-source audit.
 * Seven named serving senator speech candidates across six /story/ pages (2021-25),
 * and one 2024 /episode/ historical transcript cue-source followup.
 *
 * Every original archived body requires (a) exact-indexed original URL, UTC,
 * (b) 200/HTML response, (c) independently matched indexed SHA-1 raw payload.
 * Neither current HTML nor an index-only row authenticates historical words.
 * Original publisher bodies/WARC/media never persist to disk.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

export const AUDIT_VERSION='mpr-five-year-first-party-original-reporter-and-commoncrawl-warc-v1';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',CAP_INDEX=110_000,CAP_HTML=2_500_000,CAP_WARC=4_500_000;
const HEX=/^[a-f0-9]{64}$/,SHA1=/^[A-Z2-7]{32}$/;
export const LEADS=Object.freeze([
 {
  id:'mpr-2021-miller-special-session',displayedDay:'2021-11-23',
  url:'https://www.mprnews.org/story/2021/11/23/stalemate-over-special-session-appears-to-be-easing',
  title:'Stalemate over special session appears to be easing',
  byline:'Cathy Wurzer and Brian Bakst',topic:'hero_pay_and_special_session_negotiations',
  quoted:[{senator:'Jeremy Miller',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15335',
   cue:'senate republicans would be willing to back off any discussions regarding commissioners',attribution:'reported_MPR_minnesota_now_interview'}],
  ccCollections:['CC-MAIN-2021-49','CC-MAIN-2022-05']
 },
 {
  id:'mpr-2022-miller-redistricting',displayedDay:'2022-02-15',
  url:'https://www.mprnews.org/story/2022/02/15/new-political-district-maps-shake-up-minnesota-politics',
  title:'New political district maps shake up Minnesota politics',
  byline:'Tim Pugmire and David H. Montgomery',topic:'redistricting_analysis_not_member_vote',
  quoted:[{senator:'Jeremy Miller',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15335',
   cue:'based on our initial analysis, they appear to be fair',attribution:'reported_reaction_to_redistricting'}],
  ccCollections:['CC-MAIN-2022-21','CC-MAIN-2022-27']
 },
 {
  id:'mpr-2023-kunesh-child-welfare',displayedDay:'2023-04-18',
  url:'https://www.mprnews.org/story/2023/04/18/minnesota-moves-to-protect-native-children-as-supreme-court-decision-looms',
  title:'Minnesota moves to protect Native children as Supreme Court decision looms',
  byline:'Dan Gunderson',topic:'minnesota_indian_family_preservation',
  quoted:[{senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',
   cue:'gold standard of protection for our native kids',attribution:'reporter_attributed_public_remarks'}],
  ccCollections:['CC-MAIN-2023-23','CC-MAIN-2023-40']
 },
 {
  id:'mpr-2023-kunesh-ethnic-studies',displayedDay:'2023-12-06',
  url:'https://www.mprnews.org/story/2023/12/06/minnesota-schools-ethnic-studies-what-that-might-look-like',
  title:'Minnesota schools will soon require ethnic studies. Here is what that might look like',
  byline:'Elizabeth Shockman',topic:'ethnic_studies_education',
  quoted:[{senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',
   cue:'their stories were absolutely heartbreaking',attribution:'reporter_attributed_public_remarks'}],
  ccCollections:['CC-MAIN-2023-50','CC-MAIN-2024-10']
 },
 {
  id:'mpr-2024-kunesh-indian-citizenship',displayedDay:'2024-05-06',
  url:'https://www.mprnews.org/story/2024/05/06/tribal-members-reflect-on-anniversary-indian-citizenship-act-minnesota',
  title:'Tribal members reflect on 100th anniversary of Indian Citizenship Act at Minnesota Capitol',
  byline:'Ellie Roth',topic:'native_voting_rights_commemoration',
  quoted:[{senator:'Mary Kunesh',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15466',
   cue:'there were elders that told me they never even knew that they could vote in general elections',
   attribution:'reported_public_capitol_speech'}],
  ccCollections:['CC-MAIN-2024-22','CC-MAIN-2024-26']
 },
 {
  id:'mpr-2025-miller-champion-senate-tie',displayedDay:'2025-01-23',
  url:'https://www.mprnews.org/story/2025/01/23/the-chamber-that-chose-cooperation-minnesota-senate-sees-smoother-sailing-under-temporary-tie',
  title:'The chamber that chose cooperation: Minnesota Senate sees smoother sailing under temporary tie',
  byline:'Catharine Richert',topic:'temporary_senate_co_presidency_and_cooperation',
  quoted:[
   {senator:'Jeremy Miller',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15335',
    cue:'our leaders could either choose chaos or cooperation',attribution:'reported_2025_opening_day_speech'},
   {senator:'Bobby Joe Champion',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15317',
    cue:'the opportunity to come together and figure out how to go forward together',attribution:'reported_2025_opening_day_speech'},
  ],
  ccCollections:['CC-MAIN-2025-05','CC-MAIN-2025-08']
 }
]);
export const HAUSCHILD={
 id:'mpr-2024-hauschild-commoncrawl-transcript',
 url:'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
 displayedDay:'2024-02-19',quoted:[{senator:'Grant Hauschild',lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15577',
  cue:'i feel that immigration is a federal issue',attribution:'current_publisher_printed_transcript_not_original_audio'}],
 ccCollections:['CC-MAIN-2024-10','CC-MAIN-2024-18','CC-MAIN-2025-30'],
 original2024CuesAbsentInPreviouslyShaAuthenticatedWayback:true,
 later2025SourceOriginalCueSha:'9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725'
};

function b32(bytes){let val=0,bits=0,out='';for(const c of bytes){val=(val<<8)|c;bits+=8;while(bits>=5){bits-=5;out+=B32[(val>>>bits)&31];}val&=(1<<bits)-1;}if(bits)out+=B32[(val<<(5-bits))&31];return out;}
const hash=x=>({sha1Base32:b32(createHash('sha1').update(x).digest()),sha256:createHash('sha256').update(x).digest('hex'),bytes:x.length});
function parsedStamp(s){if(!/^20(?:21|22|23|24|25)\d{10}$/.test(s))throw Error('bad_capture_time');const t=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T'+s.slice(8,10)+':'+s.slice(10,12)+':'+s.slice(12,14)+'Z';if(new Date(t).toISOString()!==t.replace('Z','.000Z'))throw Error('bad_capture_utc');return t;}
const mime=r=>(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
export function simplify(html){
 return html.replace(/<!--[\\s\\S]*?-->/g,' ')
  .replace(/<(script|head|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&(?:rsquo|lsquo|apos|#39|#x27);/gi,"'")
  .replace(/&(?:ldquo|rdquo|quot|#34);/gi,'"')
  .replace(/&nbsp;|&#160;/gi,' ').replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(Math.min(1114111,Number(d))))
  .normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
}
export function checkCues(rawHtml,lead){
 const text=simplify(rawHtml);
 return lead.quoted.map(q=>{
  const at=text.indexOf(q.cue);
  const prev=at===-1?'':text.slice(Math.max(0,at-520),at+q.cue.length+220);
  return {senator:q.senator,selectedShortCue:q.cue,
   cueFound:at>=0,
   fullNameInNearbySourceText:at>=0&&prev.includes(q.senator.toLowerCase()),
   surnameInNearbySourceText:at>=0&&prev.includes(q.senator.toLowerCase().split(' ').at(-1)),
   fullReportedUtteranceApproved:false,authenticatedRecordedAudioQuote:false};
 });
}
export function validateLeads(leads=LEADS){
 if(!Array.isArray(leads)||leads.length!==6)throw Error('wrong MPR sample cardinality');
 const yrs=new Set(),urls=new Set();let turns=0;
 for(let i=0;i<leads.length;i++){
  const l=leads[i],e=LEADS[i],url=new URL(l.url);
  if(JSON.stringify(l)!==JSON.stringify(e)||url.protocol!=='https:'||url.hostname!=='www.mprnews.org'
    ||url.search||url.hash||url.port||!url.pathname.startsWith('/story/'+l.displayedDay.replaceAll('-','/')+'/')
    ||urls.has(l.url)||!l.quoted?.length||l.quoted.some(q=>!q.lrl.startsWith('https://www.lrl.mn.gov/legdb/fulldetail?ID=')))
    throw Error('unapproved original MPR source');
  urls.add(l.url);yrs.add(l.displayedDay.slice(0,4));turns+=l.quoted.length;
 }
 if(yrs.size!==5||turns!==7)throw Error('unexpected lead population');
 return leads;
}
async function bounded(response,max,min=32){
 const l=response.headers.get('content-length');if(l!==null&&(!/^\d+$/.test(l)||Number(l)>max))throw Error('body_too_big');
 if(!response.body)throw Error('body_missing');
 const r=response.body.getReader(),chunks=[];let n=0;
 while(true){const x=await r.read();if(x.done)break;n+=x.value.byteLength;if(n>max){await r.cancel().catch(()=>{});throw Error('body_too_big');}chunks.push(x.value);}
 if(n<min)throw Error('body_too_small');
 const out=Buffer.allocUnsafe(n);let off=0;for(const c of chunks){Buffer.from(c).copy(out,off);off+=c.byteLength;}return out;
}
async function request(url,f,accept,headers={},seconds=22){
 return f(url,{method:'GET',redirect:'manual',headers:{accept,'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-mpr-archival-research',...headers},signal:AbortSignal.timeout(seconds*1000)});
}
function sameUrl(uri,lead){return uri===lead.url;}
export function parseWaybackCdx(data,lead){
 const cols=['timestamp','original','mimetype','statuscode','digest','length'];
 if(!Array.isArray(data)||data.length<1||data.length>17||JSON.stringify(data[0])!==JSON.stringify(cols))throw Error('untrusted Wayback index shape');
 const rows=[],seen=new Map();
 for(const line of data.slice(1)){if(!Array.isArray(line)||line.length!==6)throw Error('bad Wayback index row');
  const[t,u,m,s,d,n]=line;
  parsedStamp(t);if(t.slice(0,8)<lead.displayedDay.replaceAll('-','')||!sameUrl(u,lead)||m!=='text/html'||s!=='200'||!SHA1.test(d)||!/^\d+$/.test(n)||!Number.isSafeInteger(+n))throw Error('untrusted Wayback original row');
  if(seen.has(t)){if(seen.get(t)!==JSON.stringify(line))throw Error('conflicting Wayback original');continue;}
  seen.set(t,JSON.stringify(line));rows.push({timestamp:t,captureUtc:parsedStamp(t),indexedSha1Base32:d});
 }
 return rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function waybackIndex(lead,f){
 const q=new URLSearchParams({url:lead.url,matchType:'exact',from:lead.displayedDay.replaceAll('-',''),to:'2025',output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',limit:'16'});
 const r=await request('https://web.archive.org/cdx/search/cdx?'+q,f,'application/json');
 if(r.status!==200||mime(r)!=='application/json')throw Error('index_unavailable');
 return parseWaybackCdx(JSON.parse((await bounded(r,CAP_INDEX)).toString('utf8')),lead);
}
async function waybackReplay(lead,row,f){
 const out={captureUtc:row.captureUtc,indexedOriginalSha1:row.indexedSha1Base32,rawOriginalSha256:null,originalBytes:null,status:'unknown',shortCues:null};
 try{
  const r=await request('https://web.archive.org/web/'+row.timestamp+'id_/'+lead.url,f,'text/html');
  if(r.status>=300&&r.status<400){out.status='original_archive_redirect_unknown';return out;}
  if(r.status!==200){out.status='original_archive_http_unknown';return out;}
  if(mime(r)!=='text/html'){out.status='original_archive_mime_unknown';return out;}
  const body=await bounded(r,CAP_HTML),check=hash(body);
  if(check.sha1Base32!==row.indexedSha1Base32){out.status='original_archive_index_digest_mismatch_unknown';return out;}
  out.status='sha1_authenticated_original_publisher_html';out.rawOriginalSha256=check.sha256;out.originalBytes=body.length;
  out.shortCues=checkCues(body.toString('utf8'),lead);return out;
 }catch{out.status='original_archive_fetch_or_body_unknown';return out;}
}
export async function probeWayback(lead,f=fetch){
 let rows=null;try{rows=await waybackIndex(lead,f);}catch{}
 const replays=[];for(const row of rows?.slice(0,2)||[])replays.push(await waybackReplay(lead,row,f));
 return {indexStatus:rows===null?'index_unavailable_unknown':rows.length?'index_candidates':'index_empty_unknown',
  indexCandidates:rows?.length??null,firstPagePossiblyTruncated:rows?.length===16,
  originalHtmlReplayAttempts:replays,unavailableIndexCannotProveAbsent:true};
}

export function parseCommonCrawlIndex(jsonLines,lead,collection){
 if(!/^CC-MAIN-20(?:21|22|23|24|25)-\d{2}$/.test(collection)||!lead.ccCollections.includes(collection))
  throw Error('unapproved Common Crawl collection');
 const lines=jsonLines.trim().split(/\r?\n/);if(lines.length>10)throw Error('too many Common Crawl results');
 const out=[],seen=new Set();
 for(const line of lines){if(!line.trim())continue;const r=JSON.parse(line);
  if(!r||typeof r!=='object')throw Error('bad Common Crawl record');
  const t=r.timestamp,u=r.url,d=r.digest,off=r.offset,len=r.length,file=r.filename;
  parsedStamp(t);
  if(!sameUrl(u,lead)||t.slice(0,8)<lead.displayedDay.replaceAll('-','')||r.status!=='200'||r.mime!=='text/html'||!SHA1.test(d)
    ||!/^\d+$/.test(String(off))||!/^\d+$/.test(String(len))||+len>CAP_WARC||+len<100
    ||!Number.isSafeInteger(+off)||!Number.isSafeInteger(+len)||+off>Number.MAX_SAFE_INTEGER-(+len)
    ||typeof file!=='string'||!file.startsWith('crawl-data/'+collection+'/segments/')
    ||!/^[A-Za-z0-9/_.-]+\.warc\.gz$/.test(file)||file.includes('..'))
    throw Error('untrusted Common Crawl WARC original');
  const key=t+'_'+d;if(seen.has(key))continue;seen.add(key);
  out.push({captureUtc:parsedStamp(t),timestamp:t,indexedSha1Base32:d,filename:file,offset:+off,length:+len,collection});
 }
 return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
function splitHead(buf,start=0){
 const i=buf.indexOf('\r\n\r\n',start);
 if(i>=0&&i-start<40_000)return {header:buf.subarray(start,i).toString('utf8'),next:i+4};
 const j=buf.indexOf('\n\n',start);
 if(j>=0&&j-start<40_000)return {header:buf.subarray(start,j).toString('utf8'),next:j+2};
 throw Error('no WARC/HTTP header boundary');
}
function field(str,key){return str.match(new RegExp('^'+key+':\\s*(.+)$','im'))?.[1]?.trim()||null;}
export function extractOriginalWarcPayload(compressed,entry,expectedUrl){
 if(!Buffer.isBuffer(compressed)||compressed.length!==entry.length)throw Error('compressed WARC length mismatch');
 const body=gunzipSync(compressed,{maxOutputLength:CAP_HTML+160_000});
 const w=splitHead(body);
 if(!w.header.startsWith('WARC/1.')||field(w.header,'WARC-Type')!=='response'
   ||field(w.header,'WARC-Target-URI')!==expectedUrl
   ||field(w.header,'WARC-Payload-Digest')!=='sha1:'+entry.indexedSha1Base32
   ||!field(w.header,'WARC-Date')?.startsWith(entry.captureUtc.slice(0,19)))
   throw Error('untrusted WARC envelope');
 const h=splitHead(body,w.next);
 if(!/^HTTP\/[12](?:\.\d)? 200\b/m.test(h.header)||!/^HTTP\/[12](?:\.\d)? 200\b/.test(h.header))
  throw Error('WARC archived HTTP not 200');
 const type=field(h.header,'content-type');
 if(type&&!type.toLowerCase().startsWith('text/html'))throw Error('WARC recorded MIME not html');
 const len=field(w.header,'Content-Length');
 if(!/^\d+$/.test(len||''))throw Error('WARC reported content length invalid');
 // WARC Content-Length covers HTTP status/header plus payload, not WARC trailer.
 const httpPayloadStart=w.next,httpEnd=httpPayloadStart+Number(len);
 if(httpEnd>body.length||httpEnd<h.next||httpEnd-h.next>CAP_HTML)throw Error('WARC payload bounds');
 const payload=body.subarray(h.next,httpEnd);
 const sha=hash(payload);
 if(sha.sha1Base32!==entry.indexedSha1Base32)throw Error('indexed raw original SHA1 mismatch');
 return {rawSha256:sha.sha256,rawBytes:payload.length,rawOriginalHtmlInMemory:payload.toString('utf8')};
}
async function commonCrawlQuery(lead,collection,f){
 const q=new URLSearchParams({url:lead.url,output:'json',filter:'status:200',limit:'10'});
 const r=await request('https://index.commoncrawl.org/'+collection+'-index?'+q,f,'application/x-ndjson,text/plain,application/json');
 if(r.status===404)return {status:'not_indexed_this_collection_unknown',rows:[]};
 if(r.status!==200)throw Error('index_unavailable');
 const raw=await bounded(r,CAP_INDEX,2);
 return {status:'index_lookup_success',rows:parseCommonCrawlIndex(raw.toString('utf8'),lead,collection)};
}
async function commonCrawlReplay(lead,row,f){
 const out={collection:row.collection,captureUtc:row.captureUtc,indexedOriginalSha1:row.indexedSha1Base32,
  archiveRangeUrl:'https://data.commoncrawl.org/'+row.filename,
  archiveWarcOffset:row.offset,archiveWarcCompressedLength:row.length,
  rawOriginalSha256:null,rawBytes:null,shortCues:null,status:'unknown'};
 try{
  const upper=row.offset+row.length-1;
  const r=await request(out.archiveRangeUrl,f,'application/gzip,application/octet-stream',{Range:'bytes='+row.offset+'-'+upper},30000);
  const range=r.headers.get('content-range');
  if(r.status!==206||!range?.startsWith('bytes '+row.offset+'-'+upper+'/')){
   out.status='warc_http_range_unverified_unknown';return out;
  }
  const bytes=await bounded(r,CAP_WARC,100);
  const result=extractOriginalWarcPayload(bytes,row,lead.url);
  out.status='sha1_authenticated_original_commoncrawl_warc_html';out.rawOriginalSha256=result.rawSha256;out.rawBytes=result.rawBytes;
  out.shortCues=checkCues(result.rawOriginalHtmlInMemory,lead);
  return out;
 }catch{out.status='warc_fetch_or_digest_unknown';return out;}
}
export async function probeCommonCrawl(lead,f=fetch){
 const collections=[];
 for(const collection of lead.ccCollections){
  let result;
  try{result=await commonCrawlQuery(lead,collection,f);}
  catch{collections.push({collection,indexStatus:'index_unavailable_unknown',indexedCandidates:null,originalWarcReplayAttempts:[]});continue;}
  const replays=[];
  for(const row of result.rows.slice(0,1))replays.push(await commonCrawlReplay(lead,row,f));
  collections.push({collection,indexStatus:result.status,indexedCandidates:result.rows.length,
   originalWarcReplayAttempts:replays});
 }
 return {queriedCollections:collections,oneIndexedWarcPerCollectionMax:true,
  originalCrawlPageVersionNotAssumedPublisherFirstPost:true,unknownArchiveIndexNotEvidenceAbsent:true};
}
export async function probeCurrentFirstParty(lead,f=fetch){
 const out={status:'current_publisher_unknown',rawCurrentSha256:null,rawBytes:null,cues:null,notHistoricalOriginal:true};
 try{
  const r=await request(lead.url,f,'text/html');
  if(r.status!==200){out.status=r.status>=300&&r.status<400?'current_redirect_unfollowed_unknown':'current_http_unknown';return out;}
  if(mime(r)!=='text/html'){out.status='current_mime_unknown';return out;}
  const body=await bounded(r,CAP_HTML);out.status='current_publisher_html_sha256_observed';
  out.rawCurrentSha256=hash(body).sha256;out.rawBytes=body.length;out.cues=checkCues(body.toString('utf8'),lead);return out;
 }catch{out.status='current_fetch_unknown';return out;}
}
export async function runMprOriginalResearch(f=fetch){
 const sources=[];
 const leads=[...validateLeads(),HAUSCHILD];
 for(const lead of leads){
  const first=await probeCurrentFirstParty(lead,f);
  const [wayback,commonCrawl]=await Promise.all([probeWayback(lead,f),probeCommonCrawl(lead,f)]);
  sources.push({sourceId:lead.id,displayedDay:lead.displayedDay,originalPublisherUrl:lead.url,
   publisherByline:lead.byline??null,selectedSenatorSpeechCandidates:lead.quoted.map(q=>({name:q.senator,lrl:q.lrl,
    attribution:q.attribution,cueId:q.cue,notSpokenVerbatimCertified:true})),
   sourceIsPreviouslyStudied2024Transcript:lead.id===HAUSCHILD.id,firstPartyCurrent:first,waybackOriginal:wayback,
   commonCrawlOriginal:commonCrawl,fullSpeakerStatementsApproved:false,actualMemberVoteObserved:false});
 }
 const historical=sources.flatMap(s=>[
  ...s.waybackOriginal.originalHtmlReplayAttempts,
  ...s.commonCrawlOriginal.queriedCollections.flatMap(c=>c.originalWarcReplayAttempts)
 ]);
 return {version:AUDIT_VERSION,researchDay:'2026-10-11',publicOriginalReporterStoriesSelected:6,
  selectedNamedSenatorQuotedSpeechCandidates:7,distinctSelectedStoryYears:5,
  additionalSelectedHistoricalEpisodePages:1,sourcePages:sources,
  sha1AuthenticatedHistoricalOriginalHtmlBodies:historical.filter(x=>x.status?.startsWith('sha1_authenticated_original_')).length,
  historicallySha1AuthenticatedPositiveShortCueChecks:historical.filter(x=>x.status?.startsWith('sha1_authenticated_original_')).flatMap(x=>x.shortCues??[]).filter(q=>q.cueFound).length,
  fullPublisherSourceHtmlOrWarcPersisted:false,historicalMp3BodiesAuthenticated:0,
  actualSenatorMemberVotesAuthenticated:0,completeVerbatimSenatorSpeechHumanApproved:0,
  existingHouseSpeakerOrGovernorNotCountedAsSenateSpeaker:true,
  noUnverifiedTranscriptBackdating:true,notCompletePopulationCensus:true,privateSourceOrProductionDataUsed:false};
}

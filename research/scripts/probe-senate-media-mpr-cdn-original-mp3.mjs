/**
 * #987 exact historical source MP3 archive test for TWO derived but distinct
 * public first-party CDN URL hypotheses. Neither URL without redirect query
 * is assumed to be identical to the original MP3 path in the 2021/2024 HTML.
 * Only original indexed SHA1-matched archive bytes authenticate historical audio.
 * Raw publisher MP3 bytes never persisted, full speech never verified.
 */
import {createHash} from 'node:crypto';
export const CDN_ARCHIVE_VERSION='senate-media-mpr-first-party-cdn-historical-mp3-version-audit-v1';
export const SOURCE_MP3S=Object.freeze([
 Object.freeze({
  id:'mpr-2021-jeremy-miller',originalEpisode:'https://www.mprnews.org/episode/2021/11/15/minnesota-senate-majority-leader-talks-bipartisan-effort-to-distribute-hero-pay',
  derivedExactQuerylessCdnUrl:'https://download.stream.publicradio.org/minnesota/news/programs/2021/11/15/Minnesota_Senate_Majority_Leaders_talks_bipartisan_effort_to_distribute_hero_pay_20211115_64.mp3',
  from:'20211115',currentPublisherMp3Sha256:'41c845920ea87ec83c2b955c0e42101d36c03c2c7f9f6273357895aacc1b1b10',currentPublisherMp3Bytes:2606791
 }),
 Object.freeze({
  id:'mpr-2024-grant-hauschild',originalEpisode:'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
  derivedExactQuerylessCdnUrl:'https://download.stream.publicradio.org/minnesota/podcasts/minnesota_now/2024/02/19/mn_now_20240219_hauschild_20240219_128.mp3',
  from:'20240219',currentPublisherMp3Sha256:'894bdf42ed5bc383827a8cfd258531a7b49e9a3b7751d447f24eea1957ebe0b0',currentPublisherMp3Bytes:6638508
 })
]);
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',MAX_INDEX=100_000,MAX_MP3=25_000_000;
const MIMES=new Set(['audio/mpeg','audio/mp3','audio/x-mpeg','application/octet-stream']);
function encode32(bytes){let value=0,bits=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=B32[(value>>>bits)&31];}value&=(1<<bits)-1;}if(bits)out+=B32[(value<<(5-bits))&31];return out;}
function iso(t){if(!/^20(?:21|22|23|24|25)\d{10}$/.test(t))throw Error('invalid historic audio capture');const s=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14)+'Z';if(new Date(s).toISOString()!==s.replace('Z','.000Z'))throw Error('invalid historical UTC');return s;}
const mime=r=>(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
async function bounded(r,max,min=129){const l=r.headers.get('content-length');if(l!==null&&(!/^\d+$/.test(l)||Number(l)>max))throw Error('body_limit');if(!r.body)throw Error('body_empty');const reader=r.body.getReader(),p=[];let size=0;while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>max){await reader.cancel().catch(()=>{});throw Error('body_limit');}p.push(x.value);}if(size<min)throw Error('body_short');const out=new Uint8Array(size);let o=0;for(const b of p){out.set(b,o);o+=b.byteLength;}return out;}
async function request(url,f,accept,timeout=20000){return f(url,{method:'GET',redirect:'manual',headers:{accept,'accept-encoding':'identity','user-agent':'VotePredict/2.0 strict-original-audio-archive-check'},signal:AbortSignal.timeout(timeout)});}
export function validateSourceMp3s(leads=SOURCE_MP3S){
 if(!Array.isArray(leads)||leads.length!==2)throw Error('unexpected source audio universe');
 for(let i=0;i<leads.length;i++){
  const l=leads[i],e=SOURCE_MP3S[i],u=new URL(l.derivedExactQuerylessCdnUrl);
  if(JSON.stringify(l)!==JSON.stringify(e)||u.protocol!=='https:'||u.hostname!=='download.stream.publicradio.org'
   ||u.search||u.hash||u.port||!/\.mp3$/.test(u.pathname)||!/^https:\/\/www\.mprnews\.org\/episode\/20(?:21|24)\//.test(l.originalEpisode)
   ||!/^[a-f0-9]{64}$/.test(l.currentPublisherMp3Sha256)||l.currentPublisherMp3Bytes<1000)throw Error('unknown source MP3 provenance');
 }
 return leads;
}
export function parseAudioCdx(json,lead){
 const keys=['timestamp','original','mimetype','statuscode','digest','length'];
 if(!Array.isArray(json)||json.length<1||json.length>21||JSON.stringify(json[0])!==JSON.stringify(keys))throw Error('invalid CDX shape');
 const seen=new Map(),rows=[];
 for(const r of json.slice(1)){
  if(!Array.isArray(r)||r.length!==6)throw Error('invalid CDX row');
  const[t,u,m,s,h,n]=r;
  iso(t);
  if(t.slice(0,8)<lead.from||u!==lead.derivedExactQuerylessCdnUrl||!MIMES.has(m)||s!=='200'
    ||!/^[A-Z2-7]{32}$/.test(h)||!/^\d+$/.test(n)||!Number.isSafeInteger(+n))throw Error('untrusted historical audio index');
  const identity=JSON.stringify(r);if(seen.has(t)){if(seen.get(t)!==identity)throw Error('contradictory media capture');continue;}seen.set(t,identity);rows.push({timestamp:t,capturedUtc:iso(t),indexedSha1Base32:h,mime:m});
 }
 return rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function index(lead,f){
 const q=new URLSearchParams({url:lead.derivedExactQuerylessCdnUrl,matchType:'exact',from:lead.from,to:'2025',
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',limit:'20'});
 const r=await request('https://web.archive.org/cdx/search/cdx?'+q,f,'application/json');
 if(r.status!==200||mime(r)!=='application/json')throw Error('index_unavailable');
 const raw=await bounded(r,MAX_INDEX,20);
 return parseAudioCdx(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),lead);
}
function looksMp3(b){return b.length>128&&(b[0]===73&&b[1]===68&&b[2]===51||b[0]===255&&(b[1]&0xe0)===0xe0);}
async function replay(lead,row,f){
 const url='https://web.archive.org/web/'+row.timestamp+'id_/'+lead.derivedExactQuerylessCdnUrl;
 const result={captureUtc:row.capturedUtc,originalReplayUrl:url,indexedRawSha1Base32:row.indexedSha1Base32,
  mimeExpected:row.mime,status:'unknown',rawMp3Sha256:null,rawMp3Bytes:null,sameRawBodyAsCurrentPublisherAudio:null,
  actualSpokenSenatorTranscriptAuthenticated:false};
 try{
  const r=await request(url,f,'audio/mpeg,application/octet-stream',30000);
  if(r.status>=300&&r.status<400){result.status='archive_redirect_unknown';return result;}
  if(r.status!==200){result.status='archive_non_200_unknown';return result;}
  if(mime(r)!==row.mime){result.status='archive_mime_unknown';return result;}
  const b=await bounded(r,MAX_MP3);if(!looksMp3(b)){result.status='archive_not_mp3_unknown';return result;}
  const sha1=encode32(createHash('sha1').update(b).digest());if(sha1!==row.indexedSha1Base32){result.status='original_index_sha1_mismatch_unknown';return result;}
  const sha256=createHash('sha256').update(b).digest('hex');
  result.status='authenticated_historical_original_mp3_binary';
  result.rawMp3Sha256=sha256;result.rawMp3Bytes=b.length;
  result.sameRawBodyAsCurrentPublisherAudio=sha256===lead.currentPublisherMp3Sha256&&b.length===lead.currentPublisherMp3Bytes;
  return result;
 }catch(e){result.status=e instanceof Error&&e.message==='body_limit'?'archive_audio_size_limit_unknown':'archive_audio_fetch_unknown';return result;}
}
export async function researchOriginalCdnMp3s(f=fetch){
 const rows=[];
 for(const lead of validateSourceMp3s()){
  let candidates=null;try{candidates=await index(lead,f);}catch{candidates=null;}
  const captures=[];
  for(const row of candidates?.slice(0,2)??[])captures.push(await replay(lead,row,f));
  rows.push({sourceId:lead.id,parentOriginalMprPage:lead.originalEpisode,
   separatelyTrackedExactQuerylessOriginalCdnHypothesis:lead.derivedExactQuerylessCdnUrl,
   firstPartyRedirectQueryVersionNotAssumedIdentical:true,
   currentPublisherMp3Sha256:lead.currentPublisherMp3Sha256,currentPublisherMp3Bytes:lead.currentPublisherMp3Bytes,
   indexStatus:candidates===null?'index_unavailable_unknown':candidates.length?'indexed_candidates':'index_empty_unknown',
   indexedCandidatesOnBoundedPage:candidates?.length??null,
   earliestTwoIndexedHistoricalOriginalAudioReplays:captures,
   historicalAudioBytePresenceOrAbsenceNotInferredFromMissingIndex:true});
 }
 return {version:CDN_ARCHIVE_VERSION,observedDay:'2026-10-11',testedExactPublisherDerivedCDNPaths:2,
  independentlyShaAuthenticatedHistoricalOriginalAudioVersions:rows.reduce((a,r)=>a+r.earliestTwoIndexedHistoricalOriginalAudioReplays.filter(x=>x.status==='authenticated_historical_original_mp3_binary').length,0),
  shaIdenticalToCurrentPublisherAudioHistoricalVersions:rows.reduce((a,r)=>a+r.earliestTwoIndexedHistoricalOriginalAudioReplays.filter(x=>x.sameRawBodyAsCurrentPublisherAudio===true).length,0),
  mediaLeadResults:rows,
  anySpokenWordsVerifiedFromListening:false,publisherFirstAudioPostingTimeCertified:false,
  publisherRedirectedQuerylessPathNotAutoAlias:true,originalMP3BytesPersisted:false,
  noPrivateMediaEvidenceOrVotesUsed:true};
}

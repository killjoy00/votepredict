/**
 * Public-only original MPR episode follow-up: contemporaneous RSS/enclosure evidence,
 * bounded first-party audio redirects, and historical transcript URL/HTML metadata.
 * Never saves original MP3, publisher HTML, feed XML or full transcripts.
 */
import {createHash} from 'node:crypto';
export const BRIDGE_VERSION='senate-media-mpr-original-feed-redirect-transcript-bridge-v1';
export const FEED='https://feeds.publicradio.org/public_feeds/minnesota-now';
export const PAGE='https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south';
export const AUDIO=Object.freeze([
 {id:'mpr-2021-jeremy-miller',url:'https://play.publicradio.org/unreplaced_ua/o/minnesota/news/programs/2021/11/15/Minnesota_Senate_Majority_Leaders_talks_bipartisan_effort_to_distribute_hero_pay_20211115_64.mp3'},
 {id:'mpr-2024-grant-hauschild',url:'https://play.publicradio.org/unreplaced_ua/o/minnesota/podcasts/minnesota_now/2024/02/19/mn_now_20240219_hauschild_20240219_128.mp3'},
]);
export const ALTERNATES=Object.freeze([
 'https://mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
 'http://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
 'http://mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
 'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south/',
]);
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', MAXINDEX=110_000,MAXHTML=2_500_000,MAXRSS=4_000_000,MAXAUDIO=25_000_000;
const AUDIO_HOSTS=new Set(['play.publicradio.org','ondemand.publicradio.org','download.publicradio.org','download.stream.publicradio.org','files.apmcdn.org','podcasts.publicradio.org']);
const RSS_MIMES=new Set(['application/xml','application/rss+xml','text/xml','text/plain']);
function hash32(raw){let n=0,b=0,out='';for(const v of raw){n=(n<<8)|v;b+=8;while(b>=5){b-=5;out+=B32[(n>>>b)&31];}n&=(1<<b)-1;}if(b)out+=B32[(n<<(5-b))&31];return out;}
const sha256=raw=>createHash('sha256').update(raw).digest('hex');
const sha1b32=raw=>hash32(createHash('sha1').update(raw).digest());
function stampUTC(t){if(!/^20(?:24|25)\d{10}$/.test(t))throw Error('outside archive window');const s=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14)+'Z';if(new Date(s).toISOString()!==s.replace('Z','.000Z'))throw Error('invalid UTC');return s;}
function getMime(r){return(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();}
async function bounded(r,max,min=40){const l=r.headers.get('content-length');if(l!==null&&(!/^\d+$/.test(l)||Number(l)>max))throw Error('body_limit');if(!r.body)throw Error('body_missing');const reader=r.body.getReader(),pieces=[];let total=0;while(true){const x=await reader.read();if(x.done)break;total+=x.value.byteLength;if(total>max){await reader.cancel().catch(()=>{});throw Error('body_limit');}pieces.push(x.value);}if(total<min)throw Error('body_short');const raw=new Uint8Array(total);let at=0;for(const p of pieces){raw.set(p,at);at+=p.byteLength;}return raw;}
async function get(url,accept,f,timeout=20000){return f(url,{method:'GET',redirect:'manual',headers:{accept,'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-MPR-original-history-probe'},signal:AbortSignal.timeout(timeout)});}
export function classifyMediaRedirect(origin,location){let u;try{u=new URL(location,origin);}catch{return {status:'invalid_location_unknown',host:null,normalizedPath:null,approved:false,url:null};}
 if(u.username||u.password||u.port||u.hash||u.protocol!=='https:')return {status:'redirect_not_secure_unknown',host:u.hostname,normalizedPath:null,approved:false,url:null};
 const queryPermitted=!u.search || (u.hostname==='download.stream.publicradio.org' && u.search.length<=400 && !u.searchParams.has('url') && !u.searchParams.has('redirect'));
 const approved=AUDIO_HOSTS.has(u.hostname)&&queryPermitted&&u.href.length<=900&&/^\/[a-zA-Z0-9%_./~-]+$/.test(u.pathname);
 return {status:approved?'allowlisted_first_party_media_redirect':'unapproved_redirect_host_or_query_unknown',
 host:u.hostname,normalizedPath:approved?u.pathname.slice(0,550):null,queryPresent:!!u.search,approved,url:approved?u.href:null};
}
function mp3(raw){return raw.length>128&&(raw[0]===73&&raw[1]===68&&raw[2]===51 || raw[0]===255&&(raw[1]&0xe0)===0xe0);}
export async function traceAudio(ref,f=fetch){if(!AUDIO.some(x=>x.id===ref.id&&x.url===ref.url))throw Error('unapproved contemporary publisher source audio');
 const steps=[],visited=new Set();let url=ref.url,currentBinarySha256=null,currentBinaryBytes=null;
 for(let hop=0;hop<4;hop++){if(visited.has(url)){steps.push({status:'cycle_unknown'});break;}visited.add(url);
  try{const r=await get(url,'audio/mpeg,application/octet-stream',f,30000),status=r.status,mime=getMime(r);
   if(status>=300&&status<400){const redirect=classifyMediaRedirect(url,r.headers.get('location')||'');steps.push({httpStatus:status,status:redirect.status,host:redirect.host,normalizedPath:redirect.normalizedPath,queryPresent:redirect.queryPresent??null,approved:redirect.approved});if(!redirect.approved)break;url=redirect.url;continue;}
   if(status!==200){steps.push({httpStatus:status,status:'non_200_unknown'});break;}
   if(!['audio/mpeg','audio/mp3','audio/x-mpeg','application/octet-stream'].includes(mime)){steps.push({httpStatus:status,status:'unexpected_mime_unknown',mime});break;}
   const raw=await bounded(r,MAXAUDIO,129);if(!mp3(raw)){steps.push({httpStatus:status,status:'not_mp3_unknown'});break;}
   currentBinarySha256=sha256(raw);currentBinaryBytes=raw.length;steps.push({httpStatus:status,status:'current_publisher_mp3_byte_sha256_observed',mime,host:new URL(url).hostname});break;
  }catch(e){steps.push({status:e instanceof Error?e.message==='body_limit'?'media_body_limit_unknown':'media_fetch_or_body_unknown':'media_fetch_unknown'});break;}
 }
 return {sourceId:ref.id,originalAudioUrl:ref.url,redirectSteps:steps,publisherCurrentAudioSha256:currentBinarySha256,publisherCurrentAudioBytes:currentBinaryBytes,historicalOriginalAudioAuthenticated:false,spokenSenatorWordsHumanVerified:false,redirectTargetDoesNotEstablishSourceDate:true};
}
const decodeXml=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function tag(text,key){return decodeXml(text.match(new RegExp('<'+key+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+key+'>','i'))?.[1]||'').slice(0,260);}
function enclosure(item){const m=item.match(/<enclosure\b[^>]*>/i);if(!m)return null;const attr=m[0].match(/\burl\s*=\s*(?:"([^"]+)"|'([^']+)')/i);if(!attr)return null;let url=decodeXml(attr[1]||attr[2]||'');try{const p=new URL(url);if(!['https:'].includes(p.protocol)||p.username||p.password||p.port||p.href.length>750)return null;return {host:p.hostname,path:p.pathname.slice(0,550),queryPresent:!!p.search,rawUrl:p.hostname.endsWith('publicradio.org')&&!p.search?p.href:null};}catch{return null;}}
export function findRelevantFeedItems(xml){if(!/<(?:rss|feed)\b/i.test(xml))throw Error('not RSS XML');
 const items=[];for(const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){const item=match[1],title=tag(item,'title'),guid=tag(item,'guid'),pubDate=tag(item,'pubDate'),summary=tag(item,'description');
  if(!/hauschild|north star act|2024[/-]02[/-]19|jeremy miller|hero pay/i.test([title,guid,summary].join(' ')))continue;
  items.push({title:title.slice(0,150),pubDate:pubDate.slice(0,100),guid:guid.slice(0,230),enclosure:enclosure(item)});if(items.length>=8)break;
 }
 return {matchCountWithinFirstEight:items.length,relevantItems:items};
}
export function parseIndex(json,exact){const keys=['timestamp','original','mimetype','statuscode','digest','length'];if(!Array.isArray(json)||json.length<1||json.length>21||JSON.stringify(json[0])!==JSON.stringify(keys))throw Error('unsafe CDX header or size');const out=[],seen=new Map();
 for(const row of json.slice(1)){if(!Array.isArray(row)||row.length!==6)throw Error('unsafe CDX row');
  const [t,u,mime,code,sha,length]=row;stampUTC(t);if(u!==exact||!['text/html',...RSS_MIMES].includes(mime)||code!=='200'||!/^[A-Z2-7]{32}$/.test(sha)||!/^\d+$/.test(length)||!Number.isSafeInteger(+length))throw Error('untrusted CDX original identity');
  const value=JSON.stringify(row);if(seen.has(t)){if(seen.get(t)!==value)throw Error('contradictory same UTC');continue;}seen.set(t,value);out.push({timestamp:t,captureUtc:stampUTC(t),mime,indexSha1Base32:sha});}
 return out.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
async function cdx(url,from,to,f){const q=new URLSearchParams({url,matchType:'exact',from,to,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',limit:'20'}),r=await get('https://web.archive.org/cdx/search/cdx?'+q,'application/json',f);
 if(r.status!==200||getMime(r)!=='application/json')throw Error('index_unavailable');
 return parseIndex(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(r,MAXINDEX,12))),url);}
const normalized=s=>s.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(?:script|style|head|template|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|head|template|noscript)>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&(?:rsquo|lsquo);/gi,"'").replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').toLowerCase();
const cues=['grant hauschild:','i feel that immigration is a federal issue'];
export function inspectPublisherPage(html){const text=normalized(html),dates={};for(const k of ['datePublished','dateModified','article:published_time','article:modified_time','dateCreated']){const escaped=k.replace(':','\\:');const patterns=[new RegExp('["\\x27]'+escaped+'["\\x27]\\s*[:=]\\s*["\\x27]([^"\\x27<>]{8,70})','i'),new RegExp('<meta[^>]+(?:property|name)=["\\x27]'+escaped+'["\\x27][^>]+content=["\\x27]([^"\\x27<>]{8,70})','i')];for(const pattern of patterns){const found=html.match(pattern)?.[1];if(found){dates[k]=found.slice(0,70);break;}}}
 const metadataUrls=[];for(const m of html.matchAll(/https?:\/\/[a-zA-Z0-9./_%?&=:~+-]{14,700}/g)){const raw=m[0].replace(/&amp;/g,'&'),p=(()=>{try{return new URL(raw);}catch{return null;}})();if(!p||p.protocol!=='https:'||p.username||p.password||p.port||p.search||!(/3playmedia\.com$|mprnews\.org$/.test(p.hostname)))continue;if(/transcript|caption|3play|\.pdf(?:$|\?)/i.test(p.href))metadataUrls.push(p.href.slice(0,650));}
 return {selectedTranscriptTextCues:cues.map(c=>text.includes(c)),publisherStructuredDates:dates,externalTranscriptMetadataRefs:[...new Set(metadataUrls)].slice(0,10),rawPageNotSaved:true};
}
async function originalReplay(url,row,f,role,pin=null){const result={captureUtc:row.captureUtc,indexSha1Base32:row.indexSha1Base32,sourceOriginalUrl:url,status:'unverified_unknown',observedSha256:null,originalBytes:null,relevantFeedItems:null,pageMetadata:null,originalAudioByteAuthenticated:false};
 try{const r=await get('https://web.archive.org/web/'+row.timestamp+'id_/'+url,role==='feed'?'application/xml,text/xml,text/plain':'text/html',f);
  if(r.status>=300&&r.status<400){result.status='archive_redirect_unknown';return result;}
  if(r.status!==200){result.status='archive_non_200_unknown';return result;}
  if(getMime(r)!==row.mime){result.status='archive_mime_mismatch_unknown';return result;}
  const raw=await bounded(r,role==='feed'?MAXRSS:MAXHTML);
  if(sha1b32(raw)!==row.indexSha1Base32){result.status='original_index_sha1_mismatch_unknown';return result;}
  const obs=sha256(raw);if(pin&&(pin.sha256!==obs||pin.bytes!==raw.length||pin.indexSha1Base32!==row.indexSha1Base32)){result.status='prior_sha256_or_length_mismatch_unknown';return result;}
  result.status='authenticated_original_'+role;result.observedSha256=obs;result.originalBytes=raw.length;const source=new TextDecoder('utf-8',{fatal:false}).decode(raw);
  if(role==='feed')result.relevantFeedItems=findRelevantFeedItems(source);
  else result.pageMetadata=inspectPublisherPage(source);
  return result;
 }catch(e){result.status='archive_fetch_or_format_unknown';return result;}
}
export async function probeIndexAndOriginals(url,from,to,role,f=fetch){let rows=null;try{rows=await cdx(url,from,to,f);}catch{rows=null;}
 const selected=rows?.slice(0,2)||[],results=[];
 for(const row of selected)results.push(await originalReplay(url,row,f,role));
 return {url,indexStatus:rows===null?'index_unavailable_unknown':rows.length?'indexed_candidates':'index_empty_unknown',indexedCandidates:rows?.length??null,firstPagePossiblyTruncated:rows?.length===20,originalReplayAttempts:results,notEvidenceOfPublicationAbsence:true};
}
const hauschildPin={sha256:'9d1fddfd3983a138515175c6ffe7842cd37e54391a37932e8a503c43876bf725',bytes:121462,indexSha1Base32:'TKIPF5NUQ7HICXBKMOAPLBBOTJCVBLPO'};
export async function probePinnedHauschildLater(f=fetch){const row={timestamp:'20250724232322',captureUtc:'2025-07-24T23:23:22Z',indexSha1Base32:hauschildPin.indexSha1Base32};
 return originalReplay(PAGE,row,f,'html',hauschildPin);}
export async function probeCurrentHauschildPage(f=fetch){
 const r={url:PAGE,status:'unverified_unknown',rawSha256:null,rawBytes:null,sourceMetadata:null,authenticated2024TranscriptOriginal:false};
 try{const response=await get(PAGE,'text/html',f);
  if(response.status!==200){r.status=response.status>=300&&response.status<400?'current_page_redirect_unknown':'current_page_non_200_unknown';return r;}
  if(getMime(response)!=='text/html'){r.status='current_page_mime_unknown';return r;}
  const bytes=await bounded(response,MAXHTML);
  r.status='current_publisher_html_sha256_observed';r.rawSha256=sha256(bytes);r.rawBytes=bytes.length;
  r.sourceMetadata=inspectPublisherPage(new TextDecoder('utf8',{fatal:false}).decode(bytes));
  return r;
 }catch{r.status='current_page_fetch_unknown';return r;}
}

export async function probeCurrentFeed(f=fetch){const result={url:FEED,status:'unknown',observedRawSha256:null,observedBytes:null,relevantFeedItems:null,historicalFeedDateEstablished:false};
 try{const r=await get(FEED,'application/rss+xml,application/xml,text/xml',f);
  if(r.status!==200){result.status=r.status>=300&&r.status<400?'redirect_unfollowed_unknown':'non_200_unknown';return result;}
  if(!RSS_MIMES.has(getMime(r))){result.status='mime_unknown';return result;}
  const raw=await bounded(r,MAXRSS);const match=findRelevantFeedItems(new TextDecoder('utf8',{fatal:false}).decode(raw));result.status='current_feed_body_hashed';result.observedRawSha256=sha256(raw);result.observedBytes=raw.length;result.relevantFeedItems=match;return result;
 }catch{result.status='fetch_or_body_unknown';return result;}}
export async function researchMprHistoryBridge(f=fetch){const currentFeed=await probeCurrentFeed(f);
 const currentHauschildPage=await probeCurrentHauschildPage(f);
 const historicalFeed=await probeIndexAndOriginals(FEED,'20240215','20240315','feed',f);
 const historicalPageVariants=[];
 for(const url of ALTERNATES)historicalPageVariants.push(await probeIndexAndOriginals(url,'2024','2025','html',f));
 const laterPinned=await probePinnedHauschildLater(f);
 const mediaRedirects=[];
 for(const lead of AUDIO)mediaRedirects.push(await traceAudio(lead,f));
 return {version:BRIDGE_VERSION,observationDay:'2026-10-11',exactMpr2024HauschildPage:PAGE,publisherOfficialRssLink:FEED,
  historicalFeedCaptureWindowUtc:'2024-02-15 to 2024-03-15',nonExhaustiveBoundedOriginalUrlVariants:ALTERNATES.length,
  currentPublisherPodcastFeed:currentFeed,currentPublisherHauschildPageMetadata:currentHauschildPage,historicallyReplayedPublisherFeed:historicalFeed,
  separatelyIndexedHistoricPageUrlHypotheses:historicalPageVariants,
  previouslyShaPinnedJuly2025HtmlMetadataRecheck:laterPinned,
  originalPageLinkedFirstPartyMp3RedirectChecks:mediaRedirects,
  authenticatedHistoricalMp3Binaries:0,authenticHistoricalAudioTranscriptFromRecording:false,
  neitherCurrentFeedNorHttpRedirectProvesHistoricalSpeech:true,
  alternatePageHostsNotAutomaticallyEquivalent:true,publisherDisplayedDatesNotFirstPostClock:true,
  audioAndHtmlBytesPersisted:false,privateEvidenceOrVotesTouched:false};
}

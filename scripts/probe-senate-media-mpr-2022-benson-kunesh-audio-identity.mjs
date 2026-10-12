/**
 * Evidence Track D: 2022 Benson/Kunesh MPR audio-asset identity bridge.
 *
 * The 2022 Feb23 named-senator program's original archive was UNKNOWN. A
 * separate MPR Feb23 program has two independently SHA1-indexed original
 * publisher HTML bodies, including Feb24 2022. Do either publisher pages
 * refer to exactly the same identifiable public AUDIO asset? We investigate
 * *only metadata* from two present-day first-party pages and the two genuinely
 * SHA1+SHA256 pinned archival HTML originals. No audio contents/transcripts
 * are stored, fetched or claimed to contain a senator.
 */
import {createHash} from 'node:crypto';
export const VERSION='mpr-2022-benson-kunesh-two-episode-original-audio-identity-v1';
const MAIN='https://www.mprnews.org/episode/2022/02/23/measures-give-parents-more-control-over-instruction-await-votes';
const OTHER='https://www.mprnews.org/episode/2022/02/23/a-closer-look-at-the-parents-bill-of-rights-at-the-minnesota-legislature';
export const PAGES=Object.freeze([
 {id:'2022-mpr-benson-kunesh-named-interviews',url:MAIN,namedSenators:['Michelle Benson','Mary Kunesh']},
 {id:'2022-mpr-related-separate-parents-rights-program',url:OTHER,namedSenators:[]}
].map(Object.freeze));
export const ORIGINALS=Object.freeze([
 Object.freeze({utc:'2022-02-24T02:53:02Z',indexedSha1:'JKOP2SQNH64XOLKSKAU6P67ZQGHTFKPQ',
   rawSha256:'4c0d261abbbee79f31a2520b983bb84c8a998a488cf7e834b673b65d3b6be780',bytes:49351}),
 Object.freeze({utc:'2022-11-08T20:55:33Z',indexedSha1:'ZXFOYHV5KJIORHRIOQDGLDIZAUXJAGFW',
   rawSha256:'3715f4b97a12a5ed59ef0506a24be311464501dad3ed72bc9192d1efc53a1d1e',bytes:39930})
]);
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',CAP_HTML=2_500_000;
const digest=raw=>createHash('sha256').update(raw).digest('hex');
function sha1b32(raw){let v=0,b=0,o='';for(const k of createHash('sha1').update(raw).digest()){
 v=v<<8|k;b+=8;while(b>=5){b-=5;o+=B32[v>>>b&31];}v&=(1<<b)-1;}if(b)o+=B32[v<<(5-b)&31];return o;}
function decodeEmbeddedUrlEscapes(raw){
 return raw.replace(/&amp;|&#38;|&#x26;/gi,'&').replace(/&#47;|&#x2f;/gi,'/')
 .replace(/\\u002[fF]|\\\//g,'/').replace(/\\u003[aA]/g,':')
 .replace(/\\u002[6]/g,'&').replace(/%3A%2F%2F/gi,'://');
}
export function audioSourceIndicators(html){
 if(typeof html!=='string'||html.length>CAP_HTML)throw Error('unexpected publisher HTML size');
 const decoded=decodeEmbeddedUrlEscapes(html);
 const audioTags=(decoded.match(/<audio\b/gi)||[]).length;
 const ogAudioTags=(decoded.match(/<meta\b[^>]*(?:og:audio|twitter:player:stream)[^>]*>/gi)||[]).length;
 const literalAudioFieldCount=(decoded.match(/(?:audioUrl|audio_url|audio_file|audioFile|audioSources?|audioSource|audio_id|audioId|mediaUrl)\s*["'=:\s]/gi)||[]).length;
 const mediaIds=[...decoded.matchAll(/(?:data-audio-id|data-media-id|audio_id|audioId|media_id|mediaId)\s*[":= ]+\s*["']?([a-zA-Z0-9_-]{8,120})/gi)].slice(0,24);
 const mediaIdsHashed=[...new Set(mediaIds.map(x=>digest(x[1])))];
 const urlSeen=new Set(),candidates=[];
 for(const m of decoded.matchAll(/https?:\/\/[^\s<>"'\)\\]{8,650}/gi)){
  const cleaned=m[0].replace(/(?:&quot;|&apos;|[,;}\]]+)$/gi,'');
  let u;try{u=new URL(cleaned);}catch{continue;}
  if(u.protocol!=='https:'||u.username||u.password||u.port)continue;
  const host=u.hostname.toLowerCase(),path=u.pathname.toLowerCase();
  const extension=path.match(/\.(mp3|m4a|aac|m4b|ogg|wav|flac|m3u8|mp4)$/)?.[1]||null;
  const audioHost=/^(?:download|audio|ondemand|mediadownload|media|assets)\.(?:publicradio\.org|mpr\.org|mprnews\.org|apmcdn\.org|americanpublicmedia\.org)$/.test(host)
   ||/^(?:download|assets|codytranscripts)\.apmcdn\.org$/.test(host);
  const approvedAudioPublisherHost=/(?:^|\.)(?:publicradio\.org|mpr\.org|mprnews\.org|apmcdn\.org|americanpublicmedia\.org|apmg\.io)$/.test(host);
  const playable=approvedAudioPublisherHost&&(extension!==null||(/\b(?:audio|ondemand|podcast|enclosure)\b/.test(path)&&audioHost));
  if(!playable)continue;
  // No raw signed URL or source download keys persisted.
  const normalized=u.origin+u.pathname;
  const hash=digest(normalized),fullHash=digest(u.href);
  if(urlSeen.has(hash))continue;urlSeen.add(hash);
  candidates.push({hostname:host,mediaExtension:extension,originPathSha256:hash,
   fullUrlSha256:fullHash,hasQuery:u.search.length>0,possibleAudioAssetNotAudioContents:true});
  if(candidates.length>=48)break;
 }
 return {explicitAudioTagCount:audioTags,openGraphAudioTags:ogAudioTags,
  sourceAudioFieldNameOccurrences:literalAudioFieldCount,
  distinctCandidateMediaUrlCount:candidates.length,
  candidateMediaUrlFingerprints:candidates,
  nonSensitiveMediaIdDigests:mediaIdsHashed,
  decoderOnlyFindsRenderedPublisherHtmlNotLoadedApiCalls:true,
  stringMatchNotRecordedAudioOrNamedSenatorSpeech:true};
}
async function bounded(r){
 const len=r.headers.get('content-length');
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>CAP_HTML))throw Error('Oversized publisher source');
 if(!r.body)throw Error('missing body');
 const rd=r.body.getReader(),chunks=[];let size=0;
 for(;;){const x=await rd.read();if(x.done)break;size+=x.value.byteLength;
  if(size>CAP_HTML){await rd.cancel().catch(()=>{});throw Error('large source');}
  chunks.push(x.value);}
 if(size<2500)throw Error('very short publisher page');
 const out=Buffer.allocUnsafe(size);let i=0;
 for(const c of chunks){Buffer.from(c).copy(out,i);i+=c.byteLength;}return out;
}
async function exactHtml(url,f){
 const r=await f(url,{method:'GET',redirect:'manual',headers:{accept:'text/html',
  'accept-encoding':'identity','user-agent':'VotePredict/2.0-public-2022-original-radio-evidence'},
  signal:AbortSignal.timeout(26000)});
 if(r.status!==200||(r.headers.get('content-type')||'').split(';')[0].toLowerCase().trim()!=='text/html')return null;
 return bounded(r);
}
function metadata(raw,source,original=null){
 const observedSha=digest(raw),indicators=audioSourceIndicators(raw.toString('utf8'));
 return {source,rawHtmlSha256:observedSha,bytes:raw.length,
   firstPartyMediaEvidence:indicators,originalCaptureIndexedSha1:original?.indexedSha1??null,
   originalCaptureUtc:original?.utc??null,
   originalHistoricalBodySha1AndSha256Matched:original!==null,
   audioBinaryNeverRequestedOrAuthenticated:true};
}
function shared(a,b){
 if(!a||!b)return {identicalAudioAssetFingerprintCount:null,identicalMediaIdFingerprintCount:null,
  mediaIdentityNotProvedWithoutBothSourceBodies:true};
 const one=new Set(a.firstPartyMediaEvidence.candidateMediaUrlFingerprints.map(x=>x.originPathSha256));
 const two=new Set(b.firstPartyMediaEvidence.candidateMediaUrlFingerprints.map(x=>x.originPathSha256));
 const names=new Set(a.firstPartyMediaEvidence.nonSensitiveMediaIdDigests);
 const name2=new Set(b.firstPartyMediaEvidence.nonSensitiveMediaIdDigests);
 return {identicalAudioAssetFingerprintCount:[...one].filter(x=>two.has(x)).length,
  identicalMediaIdFingerprintCount:[...names].filter(x=>name2.has(x)).length,
  audioMediaSharedOnlyIfExplicitFirstPartyAssetFingerprintMatches:true,
  noMatchDoesNotProveDifferentPlayableAudio:true};
}
export async function run2022MprRadioIdentity(f=fetch){
 const current=[];
 for(const p of PAGES){try{
  const raw=await exactHtml(p.url,f);
  current.push({id:p.id,url:p.url,availability:raw?'current_page_source_sha256_verified':'current_page_unavailable_unknown',
   source:raw?metadata(raw,'current_2026_publisher_html'):null,
   namedIntervieweeDescriptionOnly:p.namedSenators});
 }catch{current.push({id:p.id,url:p.url,availability:'current_page_unavailable_unknown',source:null,
   namedIntervieweeDescriptionOnly:p.namedSenators});}}
 const historical=[];
 for(const p of ORIGINALS){let result={pageId:PAGES[1].id,publisherUrl:OTHER,archiveUtc:p.utc,
   previouslyIndexedOriginalSha1:p.indexedSha1,previouslyRawSha256:p.rawSha256,
   previouslyExactRawBytes:p.bytes,status:'historical_original_unavailable_unknown',source:null};
  try{
   const raw=await exactHtml('https://web.archive.org/web/'+p.utc.replace(/[-:TZ]/g,'')+'id_/'+OTHER,f);
   if(raw){
    if(sha1b32(raw)!==p.indexedSha1||digest(raw)!==p.rawSha256||raw.length!==p.bytes)
     result.status='original_index_sha1_or_raw_sha256_changed_unknown';
    else{result.status='historical_original_sha1_sha256_reverified';
     result.source=metadata(raw,'historical_archive_original_html',p);}
   }
  }catch{}
  historical.push(result);
 }
 return {version:VERSION,researchDayLocal:'2026-10-11',publisherPages:PAGES.length,
  historicalKnownOriginalPageVersions:ORIGINALS.length,
  firstNamedBensonKuneshProgramHistoricalOriginalStillUnverified:true,
  currentPages:current,archivedSeparateProgramPageVersions:historical,
  currentTwoPagesMediaFingerprintComparison:shared(current[0].source,current[1].source),
  separate2022ArchivedPageAudioVsCurrentNamedPage:historical.map(x=>({
   archiveUtc:x.archiveUtc,archiveReplayStatus:x.status,
   comparison:shared(current[0].source,x.source)})),
  noActualMprMp3OrWavContentsDownloadedOrSpeechRecognized:true,
  identicalUrlNotSufficientToHumanApproveSenatorVoice:true,
  newCurrentPublisherHtmlNotHistoricPublicByProof:true,
  noPrivateSourceDocsOrModelOrForecastOrCollectorChanges:true,
  noRawPageOrAudioWritten:true};
}

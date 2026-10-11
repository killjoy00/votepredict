import {createHash} from 'node:crypto';

// Public historical publisher research only. HTTP bodies/audio stay in memory.
export const MPR_EPISODE_VERSION = 'senate-media-mpr-episode-historic-original-embeds-v1';
const CDX = 'https://web.archive.org/cdx/search/cdx';
const MAX_INDEX = 100_000, MAX_HTML = 2_500_000;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SHA1 = /^[A-Z2-7]{32}$/;
const HEX = /^[a-f0-9]{64}$/;
export const EPISODES = Object.freeze([
  Object.freeze({
    id: 'mpr-2021-jeremy-miller-hero-pay',
    url: 'https://www.mprnews.org/episode/2021/11/15/minnesota-senate-majority-leader-talks-bipartisan-effort-to-distribute-hero-pay',
    displayedDay: '2021-11-15',
    byline: 'Cathy Wurzer and Brian Bakst',
    senator: 'Jeremy Miller',
    lrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=15335',
    genre: 'journalist_relayed_own_mpr_interview',
    fragments: ["it's been difficult for the legislature to get the governor's cooperation"],
    pins: [
      ['20211115215512', '3PZ4AZNKIMNXWJLETZ2JSVWI7ZWXKGLF', 'a5dde038ca7558d8ed8209e57721443e84b569c7e0c7b4eb627be38265a730bf', 91141],
      ['20211115232633', '3PZ4AZNKIMNXWJLETZ2JSVWI7ZWXKGLF', 'a5dde038ca7558d8ed8209e57721443e84b569c7e0c7b4eb627be38265a730bf', 91141],
    ],
  }),
  Object.freeze({
    id: 'mpr-2024-grant-hauschild-north-star-act',
    url: 'https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south',
    displayedDay: '2024-02-19',
    byline: 'Cathy Wurzer and Alanna Elder',
    senator: 'Grant Hauschild',
    lrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=15577',
    genre: 'first_party_publisher_audio_transcript_current_page',
    fragments: ['i feel that immigration is a federal issue', 'grant hauschild:'],
    pins: [],
  }),
]);
function base32(bytes) {
  let n = 0, bits = 0, result = '';
  for (const byte of bytes) {
    n = (n << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; result += B32[(n >>> bits) & 31]; }
    n &= (1 << bits) - 1;
  }
  if (bits) result += B32[(n << (5 - bits)) & 31];
  return result;
}
function captureUtc(stamp) {
  if (!/^20(?:21|22|23|24|25)\d{10}$/.test(stamp)) throw Error('invalid capture UTC');
  const s = stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8)+'T'+stamp.slice(8,10)+':'+stamp.slice(10,12)+':'+stamp.slice(12,14)+'Z';
  if (new Date(s).toISOString() !== s.replace('Z', '.000Z')) throw Error('invalid capture date');
  return s;
}
async function bounded(response, cap) {
  const l = response.headers.get('content-length');
  if (l !== null && (!/^(0|[1-9]\d*)$/.test(l) || Number(l) > cap)) throw Error('body_limit');
  if (!response.body) throw Error('empty_body');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) { await reader.cancel().catch(()=>{}); throw Error('body_limit'); }
    chunks.push(value);
  }
  if (size < 40) throw Error('empty_body');
  const raw = new Uint8Array(size); let off = 0;
  for (const chunk of chunks) { raw.set(chunk,off); off += chunk.byteLength; }
  return raw;
}
export function approximateText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|head|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:rsquo|lsquo|apos|#39|#x27);/gi, "'")
    .replace(/&(?:ldquo|rdquo|quot|#34);/gi, '"')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(\d+);/g, (_,d)=>String.fromCodePoint(Math.min(0x10ffff,Number(d))))
    .normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
    .replace(/\s+/g,' ').trim().toLowerCase();
}
// Discovery only, NOT historical audio authentication. Do not fetch these URLs automatically.
export function discoverPublisherMediaUrls(html) {
  const normalized = html.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const hits = new Set();
  for (const m of normalized.matchAll(/https?:\/\/[a-z0-9._~%!$&'()*+,;=:@/?#-]{8,650}/gi)) {
    const raw = m[0].replace(/[.,;)}\]']+$/g, '');
    let url;
    try { url = new URL(raw); } catch { continue; }
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) continue;
    if (!(/(^|\.)(?:apmcdn\.org|mprnews\.org|mpr\.org|publicradio\.org)$/.test(url.hostname))) continue;
    if (!(/\.(?:mp3|m4a|wav|ogg|aac|mp4)(?:$|[?])/i.test(url.pathname+url.search)
      || /\/(?:audio|media|podcast|enclosure|download|streams?)\//i.test(url.pathname))) continue;
    if (url.href.length <= 500) hits.add(url.href);
  }
  return [...hits].sort().slice(0,16);
}
export function validateEpisodes(leads=EPISODES) {
  if (!Array.isArray(leads) || leads.length !== 2) throw Error('unexpected MPR episode selection');
  if (leads[0]?.id !== EPISODES[0].id || leads[1]?.id !== EPISODES[1].id) throw Error('wrong source selection');
  for (let i=0; i<2; i++) {
    const lead=leads[i], expected=EPISODES[i], parsed=new URL(lead.url);
    if (lead.url !== expected.url || lead.senator !== expected.senator || lead.lrl !== expected.lrl
      || lead.displayedDay !== expected.displayedDay || lead.byline !== expected.byline
      || JSON.stringify(lead.fragments) !== JSON.stringify(expected.fragments)
      || JSON.stringify(lead.pins) !== JSON.stringify(expected.pins)
      || parsed.hostname !== 'www.mprnews.org' || parsed.protocol !== 'https:'
      || parsed.search || parsed.hash || parsed.port || !parsed.pathname.startsWith('/episode/'+lead.displayedDay.replaceAll('-','/')+'/'))
      throw Error('unapproved original public publisher or speaker');
  }
  return leads;
}
export function parseCdx(data, lead) {
  const keys = ['timestamp','original','mimetype','statuscode','digest','length'];
  if (!Array.isArray(data) || data.length < 1 || data.length > 21 || JSON.stringify(data[0]) !== JSON.stringify(keys))
    throw Error('bad CDX response');
  const seen = new Map();
  for (const line of data.slice(1)) {
    if (!Array.isArray(line) || line.length !== 6) throw Error('bad CDX row');
    const [stamp,original,mime,status,digest,length]=line;
    captureUtc(stamp);
    if (original !== lead.url || mime !== 'text/html' || status !== '200' || !SHA1.test(digest)
      || !/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) throw Error('unsafe historical CDX row');
    const identity = JSON.stringify(line);
    if (seen.has(stamp) && seen.get(stamp).identity !== identity) throw Error('contradictory archive timestamp');
    seen.set(stamp,{stamp,digest,length:Number(length),identity});
  }
  return [...seen.values()].sort((a,b)=>a.stamp.localeCompare(b.stamp));
}
async function lookup(lead,fetcher) {
  const q = new URLSearchParams({url:lead.url,matchType:'exact',from:'2021',to:'2025',output:'json',
    fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',limit:'20'});
  const r=await fetcher(CDX+'?'+q.toString(),{redirect:'manual',method:'GET',
    headers:{accept:'application/json','user-agent':'VotePredict/2.0 public-mpr-episode-research'},signal:AbortSignal.timeout(20000)});
  if (r.status !== 200 || r.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error('index_unavailable');
  return parseCdx(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(r,MAX_INDEX))),lead);
}
async function replay(lead, row, fetcher) {
  const original = 'https://web.archive.org/web/'+row.stamp+'id_/'+lead.url;
  const result = {captureUtc:captureUtc(row.stamp),originalArchiveReplayUrl:original,
    indexedSha1Base32:row.digest,rawSha256:null,rawBytes:null,status:'unknown',
    historicalFragmentPresence:null,nearbySpeakerNameClue:null,possiblePublisherAudioResourceUrls:[],
    originalAudioAuthenticated:false,actualFullSpeechChecked:false,humanSpeakerApproval:false};
  try {
    const r=await fetcher(original,{redirect:'manual',method:'GET',headers:{accept:'text/html',
      'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-mpr-episode-research'},signal:AbortSignal.timeout(20000)});
    if (r.status >= 300 && r.status < 400) {result.status='replay_redirect_unknown';return result;}
    if (r.status !== 200) {result.status='replay_non_200_unknown';return result;}
    if (r.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'text/html') {result.status='replay_mime_unknown';return result;}
    const raw=await bounded(r,MAX_HTML);
    const sha1=base32(createHash('sha1').update(raw).digest());
    if (sha1 !== row.digest) {result.status='indexed_sha1_mismatch_unknown';return result;}
    const sha256=createHash('sha256').update(raw).digest('hex');
    const pin=lead.pins.find(x=>x[0]===row.stamp);
    if (pin && (pin[1]!==row.digest || pin[2]!==sha256 || pin[3]!==raw.length)) {
      result.status='prior_sha256_or_length_mismatch_unknown';return result;
    }
    if (!HEX.test(sha256)) throw Error('unexpected sha');
    const html=new TextDecoder('utf-8',{fatal:false}).decode(raw), text=approximateText(html);
    const cues=lead.fragments.map(x=>text.includes(x));
    result.status='authenticated_original_html';
    result.rawSha256=sha256;
    result.rawBytes=raw.length;
    result.historicalFragmentPresence=cues;
    result.nearbySpeakerNameClue=cues.map((present,i)=>{
      if (!present) return null;
      const at=text.indexOf(lead.fragments[i]);
      return text.slice(Math.max(0,at-450),Math.min(text.length,at+120)).includes(lead.senator.toLowerCase());
    });
    result.possiblePublisherAudioResourceUrls=discoverPublisherMediaUrls(html);
    return result;
  } catch (e) {
    result.status=e instanceof Error&&e.message==='body_limit'?'replay_body_limit_unknown':
      e instanceof Error&&e.message==='empty_body'?'replay_body_short_unknown':'replay_fetch_unknown';
    return result;
  }
}
export async function researchMprEpisodes(fetcher=fetch) {
  const leads=validateEpisodes();
  const episodes=[];
  for (const lead of leads) {
    let rows=null;
    try { rows=await lookup(lead,fetcher); } catch { rows=null; }
    const selected=rows===null?[]:lead.pins.length
      ?lead.pins.map(pin=>rows.find(x=>x.stamp===pin[0])).filter(Boolean)
      :rows.slice(0,2);
    const captures=[];
    for (const row of selected) captures.push(await replay(lead,row,fetcher));
    episodes.push({id:lead.id,publisher:'MPR News',url:lead.url,displayedPublisherDay:lead.displayedDay,
      publisherByline:lead.byline,individualSenator:lead.senator,lrlHistoricalMembership:lead.lrl,
      sourceGenre:lead.genre,indexStatus:rows===null?'index_unavailable_unknown':rows.length?'index_candidates':'index_empty_unknown',
      indexedExactUrlCandidatesOnBoundedPage:rows?.length??null,indexedPagePossiblyTruncated:rows?.length===20,
      previouslyPinned2021CaptureVersionsSelected:lead.pins.length,
      historicallyPinnedOriginalsRechecked:captures.filter(x=>lead.pins.some(p=>p[0]===x.captureUtc.replace(/\D/g,'')) && x.status==='authenticated_original_html').length,
      historicalCaptureReplays:captures,
      exactOriginalFullSpeechAndAudioNotAuthenticated:true,originalPublicationClockUnknown:true});
  }
  return {version:MPR_EPISODE_VERSION,researchDate:'2026-10-11',nonexhaustiveOriginalMprEpisodeCount:2,
    indexedOriginalHtmlBodiesAuthenticated:episodes.reduce((a,e)=>a+e.historicalCaptureReplays.filter(x=>x.status==='authenticated_original_html').length,0),
    episodes,originalAudioAuthenticationCount:0,manualFullSenatorQuoteApprovals:0,officialMemberVotesCertified:0,
    currentPublisherPageNotHistoricProof:true,notAStatewideMediaCensus:true,fullPublisherHtmlOrAudioStored:false,
    noPrivateEvidenceOrProductionDataTouched:true};
}
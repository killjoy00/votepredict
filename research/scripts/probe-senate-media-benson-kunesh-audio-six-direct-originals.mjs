/**
 * Public Track D: exact 2022 Benson/Kunesh first-party audio identities +
 * six selected 2021-25 individually attributed first-party source URLs.
 * The current web page is never a historical capture. No original copyrighted
 * article, transcript, audio or private database rows are written.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {probeWayback, probeCommonCrawl, probeCurrentFirstParty} from '../../scripts/probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
import {parseAudioIndex} from '../../scripts/probe-senate-media-mpr-original-mp3s.mjs';
import {LEADS as MPR_SIX} from './probe-senate-media-mpr-six-interviews-originals.mjs';

export const VERSION='senate-media-2022-benson-kunesh-exact-audio-and-six-direct-originals-v1';
const BASE='https://web.archive.org/cdx/search/cdx';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAX_HTML=2_500_000,MAX_INDEX=110_000,MAX_AUDIO=25_000_000;
const NAMED=MPR_SIX[1];
export const AUDIO_PINNED_FINGERPRINTS=Object.freeze([
 '1a775e898b632cc74d2281da8e2a93a88245364c9baf11e74685d27c9108931b',
 '821cab3680de70bac205f93e49bd53964a756596e43a8e723b14ea94c88ffa91'
]);
const press=[
 ['2021-coleman-sexual-assault-prospective','2021-03-29','https://www.mnsenaterepublicans.com/senator-coleman-pushing-legislation-to-get-justice-for-victims-of-sexual-assault/','Julia Coleman',15556,'we need to get this fix done now',true,['CC-MAIN-2021-17','CC-MAIN-2021-25']],
 ['2021-miller-enterprise-manufacturing-qa','2021-11-08','https://www.enterpriseminnesota.org/articles/winter-2021/valuable-legislative-support/','Jeremy Miller',15335,'my view is that the free market is working',true,['CC-MAIN-2021-49','CC-MAIN-2022-05']],
 ['2023-pratt-budget-tax-relief','2023-02-27','https://www.mnsenaterepublicans.com/pratt-responds-to-february-forecast-and-17-5-billion-surplus/','Eric Pratt',15386,'permanent tax relief and elimination of the tax on social security benefits',true,['CC-MAIN-2023-14','CC-MAIN-2023-23']],
 ['2024-marty-online-sports-betting','2024-01-24','https://senatedfl.mn/senator-john-marty-statement-on-online-sports-betting-legislation/','John Marty',10403,'the bill is not ready to pass out of the senate finance committee',true,['CC-MAIN-2024-10','CC-MAIN-2024-18']],
 ['2025-pha-post-eichorn-charges','2025-03-20','https://senatedfl.mn/senator-susan-pha-statement-on-charges-against-justin-eichorn/','Susan Pha',15583,'i am committed to strengthening protections for children',false,['CC-MAIN-2025-13','CC-MAIN-2025-18']],
 ['2025-coleman-post-annunciation','2025-08-27','https://www.mnsenaterepublicans.com/sen-coleman-statement-on-annunciation-church-and-school-shooting/','Julia Coleman',15556,'now is the time to make school security funding a priority',false,['CC-MAIN-2025-35','CC-MAIN-2025-40']]
];
export const PRESS=Object.freeze(press.map(([id,displayedDay,url,senator,lrl,cue,prospectiveIssueDiscussion,ccCollections])=>Object.freeze({
 id,displayedDay,url,senator,
 lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID='+lrl,
 quoted:Object.freeze([{senator,cue,attribution:'selected current-publisher printed statement or named magazine interview answer; not yet an approved historic quotation'}]),
 prospectiveIssueDiscussion,ccCollections:Object.freeze(ccCollections),
 sourceClass:id.includes('enterprise')?'printed_individually_labeled_magazine_qa':'individual_senate_caucus_written_press_statement'
})));
export function validatePress(list=PRESS){
 if(!Array.isArray(list)||list.length!==6)throw Error('six exact public original leads required');
 const seen=new Set();
 for(let i=0;i<list.length;i++){
  const x=list[i],e=PRESS[i],u=new URL(x.url);
  if(JSON.stringify(x)!==JSON.stringify(e)||seen.has(x.url)||u.protocol!=='https:'||
    !['senatedfl.mn','www.mnsenaterepublicans.com','www.enterpriseminnesota.org'].includes(u.hostname)||
    u.username||u.password||u.port||u.search||u.hash||x.quoted.length!==1)
   throw Error('unapproved source URL/senator or altered sample');
  seen.add(x.url);
 }
 return list;
}
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
function sha1Base32(raw){
 let acc=0,bits=0,out='';
 for(const c of createHash('sha1').update(raw).digest()){
  acc=(acc<<8)|c;bits+=8;
  while(bits>=5){bits-=5;out+=B32[(acc>>>bits)&31];}acc&=(1<<bits)-1;
 }
 if(bits)out+=B32[(acc<<(5-bits))&31];
 return out;
}
function mime(r){return (r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();}
async function bounded(r,cap,min=100){
 const n=r.headers.get('content-length');
 if(n!==null&&(!/^\d+$/.test(n)||Number(n)>cap))throw Error('response too large');
 if(!r.body)throw Error('response body missing');
 const parts=[];let size=0;
 for(const reader=r.body.getReader();;){
  const p=await reader.read();if(p.done)break;
  size+=p.value.byteLength;
  if(size>cap){await reader.cancel().catch(()=>{});throw Error('response too large');}
  parts.push(p.value);
 }
 if(size<min)throw Error('body too short');
 const buf=Buffer.alloc(size);let off=0;
 for(const p of parts){Buffer.from(p).copy(buf,off);off+=p.byteLength;}
 return buf;
}
function opts(accept,timeout=24000){return {method:'GET',redirect:'manual',headers:{
 accept,'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-track-d-historical-source-evidence'},
 signal:AbortSignal.timeout(timeout)};}
/**
 * Does not trust a topic-matched substitute, third-party file, or any MP3 with
 * a different first-party origin/path fingerprint. Raw URLs stay in memory.
 */
export function approvedNamedAudioUrls(html,pins=AUDIO_PINNED_FINGERPRINTS){
 if(typeof html!=='string'||html.length>MAX_HTML)throw Error('unexpected MPR HTML');
 if(!Array.isArray(pins)||pins.length!==2||new Set(pins).size!==2||
    pins.some(s=>!/^[a-f0-9]{64}$/.test(s)))throw Error('bad audio URI allowlist');
 const normalized=html.replace(/\\\//g,'/').replace(/\\u002f/gi,'/').replace(/\\u003a/gi,':')
  .replace(/&amp;|&#38;|&#x26;/gi,'&');
 const hits=new Map();
 for(const m of normalized.matchAll(/https?:\/\/[^\s<>"'\\]{10,680}/gi)){
  let u;try{u=new URL(m[0].replace(/[.,;}\])]+$/g,''));}catch{continue;}
  if(u.protocol!=='https:'||u.hostname!=='play.publicradio.org'||u.username||u.password||u.port||
     !u.pathname.toLowerCase().endsWith('.mp3'))continue;
  if(u.search||u.hash)throw Error('unexpected unpinned audio query/fragment');
  const id=sha256(u.origin+u.pathname);
  if(!pins.includes(id))throw Error('unrecognized first-party MP3; no unapproved lookups');
  if(hits.has(id)&&hits.get(id)!==u.href)throw Error('conflicting approved media URI');
  hits.set(id,u.href);
 }
 if(hits.size!==2||pins.some(id=>!hits.has(id)))throw Error('both selected named-program audio IDs not recovered');
 return pins.map(id=>({originPathSha256:id,url:hits.get(id)}));
}
function strip(x){return {utc:x.captureUtc||null,indexedSha1:x.indexedOriginalSha1||null,
 rawSha256:x.rawOriginalSha256||null,bytes:x.originalBytes??x.rawBytes??null,status:x.status,
 selectedShortCueFound:x.shortCues?.[0]?.cueFound??null,
 namedSenatorNearSelectedCue:x.shortCues?.[0]?.fullNameInNearbySourceText??null};}
async function pressOne(x,f){
 const current=await probeCurrentFirstParty(x,f);
 const [w,c]=await Promise.all([probeWayback(x,f),probeCommonCrawl(x,f)]);
 const wb=w.originalHtmlReplayAttempts.map(strip);
 const cc=c.queriedCollections.map(t=>({
  collection:t.collection,indexStatus:t.indexStatus,indexCandidates:t.indexedCandidates,
  originalReplays:t.originalWarcReplayAttempts.map(strip)}));
 const auth=[...wb,...cc.flatMap(t=>t.originalReplays)].filter(t=>
  t.status==='sha1_authenticated_original_publisher_html'||
  t.status==='sha1_authenticated_original_commoncrawl_warc_html');
 return {id:x.id,exactOriginalUrl:x.url,displayedDay:x.displayedDay,senator:x.senator,
  memberSource:x.lrl,sourceClass:x.sourceClass,prospectivePolicyCandidate:x.prospectiveIssueDiscussion,
  current:{status:current.status,currentRawSha256:current.rawCurrentSha256,
   cueOnCurrentPublisherPage:current.cues?.[0]?.cueFound??null},
  wayback:{indexStatus:w.indexStatus,indexCandidates:w.indexCandidates,replays:wb},
  commonCrawl:cc,authenticatedHistoricalHtmlCaptureVersions:auth.length,
  earliestAuthenticatedCaptureUtc:auth.length?auth.map(y=>y.utc).sort()[0]:null,
  selectedCueFoundOnAuthenticOriginal:auth.some(y=>y.selectedShortCueFound===true),
  exactNamedSenatorNearCueOnAuthenticOriginal:auth.some(y=>y.selectedShortCueFound&&y.namedSenatorNearSelectedCue),
  noRecordedSpokenAudioAuthenticated:true,notAutomaticallyPreVoteEligible:true};
}
export function parseExactAudioCdx(data,url){return parseAudioIndex(data,url);}
async function audioIndex(url,f){
 const q=new URLSearchParams({url,matchType:'exact',from:'2022',to:'2025',output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',limit:'20'});
 const r=await f(BASE+'?'+q,opts('application/json',23000));
 if(r.status!==200||mime(r)!=='application/json')throw Error('audio index unavailable');
 return parseExactAudioCdx(JSON.parse((await bounded(r,MAX_INDEX,5)).toString('utf8')),url);
}
async function archivedAudio(url,row,f){
 const utc=row.stamp.slice(0,4)+'-'+row.stamp.slice(4,6)+'-'+row.stamp.slice(6,8)+'T'+row.stamp.slice(8,10)+':'+row.stamp.slice(10,12)+':'+row.stamp.slice(12,14)+'Z';
 const out={utc,indexedSha1:row.digest,rawSha256:null,bytes:null,status:'archive_unknown',
  humanApprovedVoiceOrVerbatimSenatorWords:false};
 try{
  const r=await f('https://web.archive.org/web/'+row.stamp+'id_/'+url,opts('audio/mpeg,application/octet-stream',30000));
  if(r.status!==200){out.status=r.status>=300&&r.status<400?'redirect_not_equated_to_original_unknown':'archive_http_unknown';return out;}
  if(mime(r)!==row.mime){out.status='recorded_mime_mismatch_unknown';return out;}
  const raw=await bounded(r,MAX_AUDIO,129);
  if(!((raw[0]===73&&raw[1]===68&&raw[2]===51)||(raw[0]===255&&(raw[1]&224)===224))){
   out.status='not_mp3_unknown';return out;
  }
  if(sha1Base32(raw)!==row.digest){out.status='index_digest_mismatch_unknown';return out;}
  out.status='exact_sha1_authenticated_original_audio_binary';
  out.rawSha256=sha256(raw);out.bytes=raw.length;
 }catch{out.status='archive_binary_unavailable_or_too_large_unknown';}
 return out;
}
async function audioOne(asset,f){
 let rows=null;
 try{rows=await audioIndex(asset.url,f);}catch{}
 const replays=[];
 for(const row of (rows||[]).slice(0,2))replays.push(await archivedAudio(asset.url,row,f));
 return {publisherMediaOriginPathSha256:asset.originPathSha256,
  indexedExactHistoricalAudioStatus:rows===null?'index_unavailable_unknown':rows.length?'index_candidates':'index_empty_unknown',
  indexedHistoricalAudioCandidates:rows?.length??null,replays,
  audioContentAndSpokenSenatorIdentitiesNotHumanVerified:true};
}
async function named2022(f){
 let current={status:'current_named_program_html_unavailable_unknown',assets:[]};
 try{
  const r=await f(NAMED.url,opts('text/html'));
  if(r.status===200&&mime(r)==='text/html'){
   const raw=await bounded(r,MAX_HTML,2500);
   const assets=approvedNamedAudioUrls(raw.toString('utf8'));
   current={status:'current_named_program_audio_assets_recovered_from_original_publisher',
    currentHtmlSha256:sha256(raw),assets:await Promise.all(assets.map(a=>audioOne(a,f)))};
  }
 }catch(e){
  current={status:'current_named_program_or_fingerprint_unknown',assets:[],
   errorClass:'fail_closed_no_unpinned_asset_lookups'};
 }
 const [w,c]=await Promise.all([probeWayback(NAMED,f),probeCommonCrawl(NAMED,f)]);
 const wb=w.originalHtmlReplayAttempts.map(strip);
 const cc=c.queriedCollections.map(t=>({collection:t.collection,indexStatus:t.indexStatus,
  indexCandidates:t.indexedCandidates,replays:t.originalWarcReplayAttempts.map(strip)}));
 const auth=[...wb,...cc.flatMap(x=>x.replays)].filter(x=>
 x.status==='sha1_authenticated_original_publisher_html'||x.status==='sha1_authenticated_original_commoncrawl_warc_html');
 return {url:NAMED.url,intervieweeNamesOnCurrentPublisherPage:['Michelle Benson','Mary Kunesh'],
  current,namedEpisodeArchive:{indexStatus:w.indexStatus,indexCandidates:w.indexCandidates,
   waybackReplays:wb,commonCrawl:cc,authenticatedHistoricalHtmlVersions:auth.length},
  differentSameDayProgramIsNotAnAudioAlias:true,notAnAuthenticatedSpokenTurn:true};
}
export async function run(f=fetch){
 const statements=[];
 for(let i=0;i<PRESS.length;i+=2)statements.push(...await Promise.all(PRESS.slice(i,i+2).map(x=>pressOne(x,f))));
 const named=await named2022(f);
 return {version:VERSION,researchDateAmericaChicago:'2026-10-11',
  selectedExactNewlyProbedPublisherUrls:PRESS.length,
  previouslyKnownNotYetAuthenticatedStatementUrls:2,
  distinctSelectedIndividualSourceUrls:PRESS.length,
  additionalMprNamedInterviewUrlAudited:1,
  distinctSenatorsInSixPressSources:new Set(PRESS.map(x=>x.senator)).size,
  pressStatements:statements,bensonKunesh2022:named,
  authenticatedPressOriginalVersions:statements.reduce((n,x)=>n+x.authenticatedHistoricalHtmlCaptureVersions,0),
  authenticatedPressDistinctOriginalUrls:statements.filter(x=>x.authenticatedHistoricalHtmlCaptureVersions>0).length,
  authenticatedNamedInterviewOriginals:named.namedEpisodeArchive.authenticatedHistoricalHtmlVersions,
  authenticated2022NamedProgramMp3Originals:named.current.assets.flatMap(x=>x.replays).filter(x=>x.status==='exact_sha1_authenticated_original_audio_binary').length,
  humanCertifiedVerbatimAudioQuotes:0,recordedSenateVotesVerified:0,
  anyClaimOfPrivateVotePredictSourceCompleteness:false,sourcePrefixUnchanged:true,
  noOriginalArticleAudioOrWarcPersisted:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const i=process.argv.indexOf('--output');
 if(i<0||!process.argv[i+1]||!process.argv[i+1].startsWith('artifacts/'))throw Error('require safe metadata output path');
 const result=await run();
 mkdirSync('artifacts',{recursive:true});
 writeFileSync(process.argv[i+1],JSON.stringify(result,null,2)+'\n');
 console.log('TRACK_D_PUBLIC_RESEARCH_SUMMARY='+JSON.stringify({
  version:result.version,authenticatedPressDistinctOriginalUrls:result.authenticatedPressDistinctOriginalUrls,
  authenticatedPressOriginalVersions:result.authenticatedPressOriginalVersions,
  authenticatedNamedInterviewOriginals:result.authenticatedNamedInterviewOriginals,
  authenticated2022NamedProgramMp3Originals:result.authenticated2022NamedProgramMp3Originals,
  press:result.pressStatements.map(x=>({id:x.id,earliestUtc:x.earliestAuthenticatedCaptureUtc,
   replays:x.wayback.replays.concat(x.commonCrawl.flatMap(y=>y.originalReplays)).filter(z=>z.rawSha256)})),
  audio:result.bensonKunesh2022.current.assets.map(x=>({fingerprint:x.publisherMediaOriginPathSha256,
   archiveIndexStatus:x.indexedExactHistoricalAudioStatus,replays:x.replays})),
  namedArchive:result.bensonKunesh2022.namedEpisodeArchive
 }));
}

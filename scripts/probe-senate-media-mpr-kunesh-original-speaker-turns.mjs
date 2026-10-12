/**
 * Public MPR historical original HTML speaker-turn adjacency source review.
 * Unlike independent selected-cue presence, this checks that a short selected
 * phrase falls after MARY KUNESH: and before the next explicitly labeled
 * transcript turn in one SHA1+SHA256-authenticated original HTML body.
 *
 * Page HTML and entire turns are never persisted; no original audio, human
 * full-verbatim quote approval, 2025/2026 forecast or database changes.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const VERSION='mpr-two-kunesh-historic-pinned-original-speaker-turn-v1';
const PINNED=new URL('../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json',import.meta.url);
export const QUOTES=Object.freeze({
 'mpr-2023-kunesh-native-family-preservation':Object.freeze({
  speakerLabel:'MARY KUNESH:',
  shortCue:'we want to make sure this is codified in our state legislature',
  topic:'tribal_child_welfare'}),
 'mpr-2024-kunesh-charter-school-oversight':Object.freeze({
  speakerLabel:'MARY KUNESH:',
  shortCue:'we need to really look at probably some kind of reform',
  topic:'charter_school_accountability'})
});
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function sha1b32(bytes){let acc=0,bits=0,out='';
 for(const n of createHash('sha1').update(bytes).digest()){acc=acc<<8|n;bits+=8;
  while(bits>=5){bits-=5;out+=B32[(acc>>>bits)&31];}acc&=(1<<bits)-1;}
 if(bits)out+=B32[(acc<<(5-bits))&31];return out;}
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
function sourceUtc(s){
 if(typeof s!=='string'||!/^20(?:23|24)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s))throw Error('untrusted original capture timestamp');
 if(new Date(s).toISOString()!==s.replace('Z','.000Z'))throw Error('invalid archive UTC');
 return s;
}
export function publicPinnedOriginals(data){
 if(data?.version!=='mpr-six-senator-interviews-public-original-and-seed-receipts-v1'
  ||!Array.isArray(data.urls))throw Error('unknown public source proof baseline');
 const originals=[];
 const ids=Object.keys(QUOTES);
 for(const id of ids){
  const l=data.urls.filter(v=>v.id===id);
  if(l.length!==1||!l[0].url.startsWith('https://www.mprnews.org/episode/')
   ||l[0].senators?.join('|')!=='Mary Kunesh'||l[0].originals?.length!==2)
   throw Error('not the exact prior pinned senator source');
  for(const x of l[0].originals){
   sourceUtc(x.captureUtc);
   if(!/^[A-Z2-7]{32}$/.test(x.sha1)||!/^[a-f0-9]{64}$/.test(x.sha256)
    ||!Number.isSafeInteger(x.bytes)||x.bytes<2000||x.bytes>2_500_000)throw Error('invalid prior SHA');
   originals.push(Object.freeze({leadId:id,senator:'Mary Kunesh',topic:QUOTES[id].topic,
    pageUrl:l[0].url,captureUtc:x.captureUtc,sha1:x.sha1,sha256:x.sha256,bytes:x.bytes,
    cue:QUOTES[id].shortCue,label:QUOTES[id].speakerLabel,
    previouslyPinnedSeparateCueResults:x.selectedCuesPresent}));
  }
 }
 if(originals.length!==4)throw Error('wrong original sample size');
 return originals;
}
function cleanText(x){
 return x.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:head|script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/(?:head|script|style|noscript|template|svg)>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&(?:rsquo|lsquo|apos|#39|#x27);/gi,"'")
  .replace(/&(?:ldquo|rdquo|quot|#34);/gi,'"')
  .replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Math.min(+v,0x10ffff)))
  .normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/\s+/g,' ').trim();
}
function normalize(x){return x.toLowerCase().replace(/\s+/g,' ').trim();}
export function inspectBoundedNamedSpeakerTurn(originalHtml,pin){
 if(typeof originalHtml!=='string'||originalHtml.length>2_500_000
  ||!pin?.cue||!pin?.label)throw Error('invalid source or selected public cue');
 const visible=cleanText(originalHtml),lower=normalize(visible),heading='audio transcript';
 const headingIndex=lower.indexOf(heading);
 const headingSeen=headingIndex>=0;
 const segment=headingSeen?visible.slice(headingIndex+heading.length):'';
 const selectedCue=normalize(pin.cue),label=pin.label.trim().toUpperCase();
 // Require FULL uppercase given-name + surname + colon. Do not mistake an
 // article's contextual senator mention or host's question for a speaker turn.
 const pattern=/(?:^|\s)([A-Z][A-Z'’-]+(?:\s+[A-Z][A-Z'’-]+){1,3}):(?=\s)/g;
 const marks=[];let m;
 while((m=pattern.exec(segment))!==null){
  if(marks.length>=400)throw Error('implausible speaker label count');
  const start=m.index+(m[0].length-m[1].length-1);
  marks.push({name:m[1].toUpperCase()+':',start,end:m.index+m[0].length});
 }
 let matchingSenatorLabels=0,withinSameTurn=false,closestShortCueWindowChars=null;
 const shortCueOwners=[];
 for(let i=0;i<marks.length;i++){
  const speaker=marks[i];
  if(speaker.name===label)matchingSenatorLabels++;
  const stop=i+1<marks.length?marks[i+1].start:segment.length;
  if(stop<speaker.end)throw Error('invalid speaker turn boundaries');
  const length=Math.min(6000,stop-speaker.end);
  const turn=normalize(segment.slice(speaker.end,speaker.end+length));
  const idx=turn.indexOf(selectedCue);
  if(idx<0)continue;
  const name=speaker.name===label?label:
   (speaker.name==='NINA MOINI:'||speaker.name==='CATHY WURZER:'?speaker.name:'OTHER NAMED SPEAKER:');
  if(!shortCueOwners.includes(name))shortCueOwners.push(name);
  if(speaker.name===label){withinSameTurn=true;closestShortCueWindowChars=idx;}
 }
 const hasShortCueInTranscript=normalize(segment).includes(selectedCue);
 return {
  transcriptSectionHeadingVisible:headingSeen,
  senatorFullNameSpeakerLabelsInTranscript:matchingSenatorLabels,
  selectedShortCueVisibleAnywhereOnOriginalPage:lower.includes(selectedCue),
  selectedShortCueVisibleInsideTranscriptSection:hasShortCueInTranscript,
  selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn:withinSameTurn,
  selectedShortCueInsideOtherNamedSpeakerTurn:shortCueOwners.some(s=>s!==label),
  selectedShortCueSpeakerTurnOwnerLabels:shortCueOwners.slice(0,5),
  selectedShortCueOutsideAllBoundedSpeakerTurns:hasShortCueInTranscript&&shortCueOwners.length===0,
  selectedShortCueCharacterDistanceFromStartOfTurn:withinSameTurn?closestShortCueWindowChars:null,
  maximumConsideredSpeakerTurnCharacters:6000,
  speakerTurnAdjacencyIsNotRecordedAudioOrHumanCertifiedFullQuotation:true,
  noPrivateEvidenceOrForecastPromotion:true
 };
}
async function bounded(response){
 const n=response.headers.get('content-length');
 if(n!==null&&(!/^\d+$/.test(n)||+n>2_500_000))throw Error('original HTML oversized');
 if(!response.body)throw Error('missing original publisher body');
 const chunks=[],r=response.body.getReader();let len=0;
 for(;;){const v=await r.read();if(v.done)break;len+=v.value.byteLength;
  if(len>2_500_000){await r.cancel().catch(()=>{});throw Error('original HTML over body cap');}
  chunks.push(v.value);}
 if(len<3000)throw Error('source original too short');
 const out=Buffer.allocUnsafe(len);let at=0;
 for(const c of chunks){Buffer.from(c).copy(out,at);at+=c.byteLength;}return out;
}
export async function reverifyPinnedOriginalSpeakerTurn(pin,f=fetch){
 const stamp=pin.captureUtc.replace(/[-:TZ]/g,'');
 const out={leadId:pin.leadId,senator:'Mary Kunesh',publicOriginalPage:pin.pageUrl,
  archivedCaptureUtc:pin.captureUtc,priorIndexedSha1:pin.sha1,priorOriginalSha256:pin.sha256,
  status:'unknown',reverifiedRawSha256:null,reverifiedRawBytes:null,turnIndicators:null,
  originalPublisherFirstPublishedAtNotInferred:true,
  independentlyAuthenticatedAudioOfSpeaker:false,
  notLegislativeRecordedVote:true};
 try{
  const r=await f('https://web.archive.org/web/'+stamp+'id_/'+pin.pageUrl,
   {method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity',
    'user-agent':'VotePredict/2.0-public-original-mpr-speaker-turn'},
    signal:AbortSignal.timeout(26000)});
  if(r.status!==200||(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='text/html'){
   out.status='historical_original_replay_http_redirect_or_mime_unknown';return out;}
  const raw=await bounded(r),a=sha1b32(raw),b=sha256(raw);
  if(a!==pin.sha1||b!==pin.sha256||raw.length!==pin.bytes){
   out.status='historical_original_sha1_sha256_or_length_mismatch_unknown';return out;}
  out.status='sha1_and_sha256_reverified_same_original_html';
  out.reverifiedRawSha256=b;out.reverifiedRawBytes=raw.length;
  out.turnIndicators=inspectBoundedNamedSpeakerTurn(raw.toString('utf8'),pin);
  return out;
 }catch{out.status='historical_original_replay_unavailable_unknown';return out;}
}
export async function runKuneshSpeakerTurnProof(f=fetch){
 const input=JSON.parse(readFileSync(PINNED,'utf8')),pins=publicPinnedOriginals(input);
 const results=[];
 for(const p of pins)results.push(await reverifyPinnedOriginalSpeakerTurn(p,f));
 return {version:VERSION,researchDay:'2026-10-11',
  originalPublicSourceDocumentCount:pins.length,
  originalDistinctFirstPartyEpisodeUrls:new Set(pins.map(x=>x.pageUrl)).size,
  studiedSenator:'Mary Kunesh',
  verifiedOriginalHtmlRawBodyCount:results.filter(x=>x.status==='sha1_and_sha256_reverified_same_original_html').length,
  candidateSameLabeledSpeakerTurnCount:results.filter(x=>x.turnIndicators?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn).length,
  results,theseAreSelectedShortCuesNotReviewedFullVerbatimUtterances:true,
  sameOriginalAudioNotIndependentlyAuthenticated:true,
  originalMprPublicationClockNotInferred:true,
  originalSpeakerTurnNotAutomaticallyEligibleForAnyPastVote:true,
  neverSavedRawMprHtmlOrAudioOrTranscript:true,
  noPrivateDbOrCollectorOrModelTouched:true};
}

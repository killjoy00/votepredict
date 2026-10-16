/**
 * Narrower verification after independent CDX-indexed SHA1 + raw SHA256
 * source authentication: four entirely different serving Minnesota state
 * senators' original 2023/24/25 MPR *printed* audio transcript speaker turns.
 * No later current publisher text or a page-wide cue can substitute for a
 * selected phrase inside that senator's actual named transcript turn.
 * Original HTML is never persisted; no audio or full quote approved.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectBoundedNamedSpeakerTurn} from '../../scripts/probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
export const VERSION='mpr-four-more-senators-2023-25-original-speaker-turn-source-proof-v1';
export const STUDIES=Object.freeze([
 Object.freeze({id:'2023-steve-cwodzinski-education-funding',speaker:'Steve Cwodzinski',label:'STEVE CWODZINSKI:',
  shortPhrase:'difference between an unfunded mandate and a funded mandate',topic:'education_funding'}),
 Object.freeze({id:'2023-john-hoffman-mississippi-compact',speaker:'John Hoffman',label:'JOHN HOFFMAN:',
  shortPhrase:'it would be the largest compact ever',topic:'interstate_water_management'}),
 Object.freeze({id:'2024-zach-duckworth-free-meals',speaker:'Zach Duckworth',label:'ZACH DUCKWORTH:',
  shortPhrase:'recipient of an unfunded mandate',topic:'free_school_meals_future_budget'}),
 Object.freeze({id:'2025-sandra-pappas-capital-bonding',speaker:'Sandra Pappas',label:'SANDRA PAPPAS:',
  shortPhrase:"it's just the timing isn't very good",topic:'bonding_funding_downtown_infrastructure'})
]);
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',CAP=2_500_000;
function sha1Base32(bytes){let acc=0,bits=0,out='';
 for(const b of createHash('sha1').update(bytes).digest()){acc=acc<<8|b;bits+=8;
 while(bits>=5){bits-=5;out+=ALPH[acc>>>bits&31];}acc&=(1<<bits)-1;}
 if(bits)out+=ALPH[acc<<(5-bits)&31];return out;}
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function selectExactOriginalSpeakerStudyPins(manifest){
 if(manifest?.version!=='senate-media-nine-mpr-caucus-public-original-receipts-v1'
  ||manifest?.scope?.independentlySha1AuthenticatedOriginalHtmlCaptureCount!==10)
  throw Error('Historical original source manifest mismatch');
 const records=[];
 for(const q of STUDIES){
  const originals=manifest.sourceOriginals.filter(s=>s.id===q.id);
  const expected=q.id.startsWith('2023-steve')?1:2;
  if(originals.length!==expected)throw Error('Original speaker-study archived versions changed');
  for(const o of originals){
   if(!/^20(?:23|24|25)-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(o.captureUtc)
    ||! /^[A-Z2-7]{32}$/.test(o.indexedSha1Base32)
    ||! /^[a-f0-9]{64}$/.test(o.rawOriginalHtmlSha256)
    ||!Number.isSafeInteger(o.rawOriginalHtmlBytes)||o.rawOriginalHtmlBytes<3000||o.rawOriginalHtmlBytes>CAP)
    throw Error('Untrusted historical original');
   const lookup={
    '2023-steve-cwodzinski-education-funding':'https://www.mprnews.org/episode/2023/01/17/what-do-dfl-lawmakers-mean-by-fully-funding-schools-in-the-state',
    '2023-john-hoffman-mississippi-compact':'https://www.mprnews.org/episode/2023/09/13/it-would-be-the-biggest-compact-ever-proposal-looks-to-protect-mississippi-river',
    '2024-zach-duckworth-free-meals':'https://www.mprnews.org/episode/2024/09/09/with-costs-ballooning-whats-the-future-of-universal-school-lunch-programs',
    '2025-sandra-pappas-capital-bonding':'https://www.mprnews.org/episode/2025/03/25/legislator-says-its-bad-timing-for-397-million-update-to-xcel-energy-center'
   };
   records.push(Object.freeze({
    ...q,url:lookup[q.id],originalArchiveUtc:o.captureUtc,indexedSha1:o.indexedSha1Base32,
    rawSha256:o.rawOriginalHtmlSha256,bytes:o.rawOriginalHtmlBytes
   }));
  }
 }
 if(records.length!==7||new Set(records.map(x=>x.url)).size!==4)throw Error('Wrong media speaker study size');
 return records;
}
async function bounded(r){
 const h=r.headers.get('content-length');
 if(h!==null&&(!/^\d+$/.test(h)||+h>CAP))throw Error('source-body-size');
 if(!r.body)throw Error('body-missing');
 const rd=r.body.getReader(),chunks=[];let count=0;
 for(;;){const v=await rd.read();if(v.done)break;count+=v.value.byteLength;
 if(count>CAP){await rd.cancel().catch(()=>{});throw Error('large-original');}chunks.push(v.value);}
 if(count<3000)throw Error('original-too-small');
 const b=Buffer.allocUnsafe(count);let i=0;
 for(const chunk of chunks){Buffer.from(chunk).copy(b,i);i+=chunk.byteLength;}return b;
}
export async function checkPinnedOriginalSpeakerTurn(pin,f=fetch){
 const out={
  id:pin.id,senator:pin.speaker,topic:pin.topic,firstPartyEpisodeUrl:pin.url,
  originalArchiveUtc:pin.originalArchiveUtc,indexedSourceOriginalSha1:pin.indexedSha1,
  priorRawOriginalSha256:pin.rawSha256,priorOriginalBytes:pin.bytes,
  replayStatus:'unknown',actualOriginalSha256:null,actualOriginalBytes:null,
  speakerTurnIndicators:null,speakerRecordedAudioIndependentlyVerified:false,
  humanFullVerbatimQuoteApproved:false,memberActualRecordedVoteVerified:false,
  originalHtmlCaptureTimeNotTranscriptFirstPublicTime:true
 };
 try{
  const stamp=pin.originalArchiveUtc.replace(/[-:TZ]/g,'');
  const url='https://web.archive.org/web/'+stamp+'id_/'+pin.url;
  const r=await f(url,{method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity',
   'user-agent':'VotePredict/2.0-state-senator-original-MPR-speaker-proof'},signal:AbortSignal.timeout(26000)});
  if(r.status!==200||(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='text/html'){
   out.replayStatus='archived_http_or_mime_unknown';return out;}
  const b=await bounded(r),digest=sha1Base32(b),raw=sha256(b);
  if(digest!==pin.indexedSha1||raw!==pin.rawSha256||b.length!==pin.bytes){
   out.replayStatus='sha1_sha256_or_bytes_mismatch_unknown';return out;}
  out.replayStatus='sha1_sha256_and_bytes_reverified_original_mpr_html';
  out.actualOriginalSha256=raw;out.actualOriginalBytes=b.length;
  out.speakerTurnIndicators=inspectBoundedNamedSpeakerTurn(b.toString('utf8'),{label:pin.label,cue:pin.shortPhrase});
  return out;
 }catch{out.replayStatus='original_page_replay_unavailable_unknown';return out;}
}
export async function runFourSenatorOriginalSpeakerTurns(f=fetch){
 const originals=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.json',import.meta.url),'utf8'));
 const pins=selectExactOriginalSpeakerStudyPins(originals);
 const results=await Promise.all(pins.map(x=>checkPinnedOriginalSpeakerTurn(x,f)));
 return {version:VERSION,studyDateLocal:'2026-10-11',
  selectedFourDistinctServingSenatorInterviewUrls:4,knownIndexedSourceOriginalHtmlVersions:pins.length,
  sourceVersionsRawSha1Sha256Reverified:results.filter(x=>x.replayStatus==='sha1_sha256_and_bytes_reverified_original_mpr_html').length,
  sameFullNameSpeakerTurnShortPhraseAuthenticated:results.filter(x=>x.speakerTurnIndicators?.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn).length,
  results,
  allSelectedCuesAreShortNotFullVerbatimSenatorQuotes:true,
  noHistoricalOriginalAudioBinariesAuthenticated:true,
  noEarlierModelCutoffDeducedFromDisplayedPublisherDate:true,
  multipleArchiveVersionsNotExtraDistinctArticles:true,
  noPrivateRecordsOrCollectorsOrForecastsTouched:true,
  noRawHtmlAudioPdfWarcRetained:true};
}

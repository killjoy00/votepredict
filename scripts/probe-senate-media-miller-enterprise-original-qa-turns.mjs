/**
 * Track D follow-up: attribution, not new page discovery.
 * Reverify exactly the TWO previously indexed-original Enterprise Minnesota
 * 2022/2023 HTML bodies, then ask whether the short policy phrase occurs
 * inside the SAME printed paragraph that starts with "Miller:".
 * No complete Q&A, HTML or private source information is persisted.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import originals from '../docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json' with {type:'json'};
export const VERSION='senate-media-miller-enterprise-two-indexed-original-print-qa-turns-v1';
const PAGE='https://www.enterpriseminnesota.org/articles/winter-2021/valuable-legislative-support/';
const CUE='my view is that the free market is working';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',CAP=2_500_000;
export function exactPins(ledger=originals){
 if(ledger?.version!=='senate-media-2022-benson-kunesh-and-six-source-originals-public-receipts-v1')throw Error('unrecognized immutable public evidence receipts');
 const candidates=ledger.sources.filter(x=>x.id==='2021-miller-enterprise-manufacturing-qa');
 if(candidates.length!==1||candidates[0].url!==PAGE||candidates[0].senator!=='Jeremy Miller'||candidates[0].memberId!==15335)throw Error('wrong archived individual Minnesota senator');
 const proofs=candidates[0].archivedOriginalHtml;
 if(proofs?.length!==2)throw Error('expected two prior SHA-indexed original versions');
 const expected=[
 ['2022-10-05T01:59:37Z','Z55ODFJANQV2PCOGS32J3IZE3GEL2DBR','28dada90321263cbf20a75cc9949c176527a97c2d89d33c0831ed63469167f36',65348],
 ['2023-01-31T06:39:41Z','KDDZ7S7QX7HETNGDLYUQLZUUTAO5275J','fb8fd1d2c4bd209e54a905d5b050310a520a46d46f82c3a910a7270c723f3251',67207]
 ];
 for(let i=0;i<expected.length;i++){
  const p=proofs[i],e=expected[i];
  if(p.captureUtc!==e[0]||p.indexedOriginalSha1Base32!==e[1]||p.rawOriginalHtmlSha256!==e[2]||p.rawOriginalBytes!==e[3]||
   p.exactReplayStatus!=='sha1_authenticated_original_publisher_html')throw Error('previous pinned original changed; no attribution proof');
 }
 return proofs.map(x=>Object.freeze({utc:x.captureUtc,sha1:x.indexedOriginalSha1Base32,sha256:x.rawOriginalHtmlSha256,bytes:x.rawOriginalBytes,sourceUrl:PAGE}));
}
function normalize(s){
 return s.replace(/&(?:rsquo|lsquo|apos|#39|#x27);/gi,"'")
  .replace(/&(?:ldquo|rdquo|quot|#34);/gi,'"')
  .replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):+n;return Number.isFinite(code)&&code<=0x10ffff?String.fromCodePoint(code):' ';})
  .replace(/<[^>]*>/g,' ')
  .normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/\s+/g,' ').trim().toLowerCase();
}
export function boundedMillerParagraphProof(html){
 if(typeof html!=='string'||html.length>CAP)throw Error('unexpected raw archived HTML');
 const clean=html.replace(/<!--[\s\S]*?-->/g,' ')
   .replace(/<(script|head|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
 const paragraphs=[...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)];
 if(paragraphs.length>2500)throw Error('implausible HTML paragraph count');
 const visible=normalize(clean);
 const cue=CUE;
 let labeled=0,correct=0,other=0,earliest=null,similar=0;
 for(const p of paragraphs){
  const t=normalize(p[1]);
  if(t.length>11000)throw Error('implausible single paragraph');
  const isMiller=/^miller\s*:\s+\S/i.test(t);
  const isOther=/^(?:kill|bob kill|other speaker)\s*:\s+\S/i.test(t);
  if(isMiller)labeled++;
  if(!t.includes(cue))continue;
  similar++;
  const distance=t.indexOf(cue);
  // No named interviewer/senator turn-switch before the policy phrase, and no
  // cross-paragraph prose carryover. The same HTML <p> must START Miller:.
  const prefix=t.slice(0,distance);
  const otherTurnBefore=/(?:^|\s)(?:kill|bob kill|speaker|interviewer|moderator|reporter|other)\s*:/i.test(prefix);
  const anotherLabelBefore=/(?:^|\s)(?:miller)\s*:\s+\S/gi;
  const countLabels=[...prefix.matchAll(anotherLabelBefore)].length;
  if(isMiller&&!otherTurnBefore&&distance<=700&&countLabels===1){
   correct++;earliest=earliest===null?distance:Math.min(earliest,distance);
  }else if(isOther||otherTurnBefore){other++;}
 }
 return {
  totalHtmlParagraphsReviewed:paragraphs.length,
  explicitMillerLabeledParagraphCount:labeled,
  selectedShortPolicyFragmentPresentInPageVisibleText:visible.includes(cue),
  paragraphsContainingSelectedShortPolicyFragment:similar,
  fragmentInsideSameExplicitMillerLabeledParagraph:correct>0,
  independentlyMatchingExplicitMillerParagraphs:correct,
  fragmentWithinExplicitOtherSpeakerParagraphs:other,
  characterDistanceFromPrintedMillerLabelToFragment:earliest,
  proofRequiresSameParagraphStartingWithMillerLabel:true,
  zeroApprovalOfRecordedAudioOrCompleteHumanReviewedQuotation:true,
  historicalFirstPublicAtCurrentDisplayed2021DateNotEstablished:true
 };
}
function b32(raw){
 let n=0,bits=0,out='';
 for(const c of createHash('sha1').update(raw).digest()){
  n=n<<8|c;bits+=8;
  while(bits>=5){bits-=5;out+=B32[(n>>>bits)&31];}
  n&=(1<<bits)-1;
 }
 if(bits)out+=B32[(n<<(5-bits))&31];return out;
}
async function bounded(res){
 const s=res.headers.get('content-length');
 if(s!==null&&(!/^\d+$/.test(s)||+s>CAP))throw Error('excessive HTML length header');
 if(!res.body)throw Error('missing response body');
 const parts=[];let n=0;
 const rd=res.body.getReader();
 for(;;){
  const v=await rd.read();if(v.done)break;
  n+=v.value.byteLength;if(n>CAP){await rd.cancel().catch(()=>{});throw Error('overcap body');}
  parts.push(v.value);
 }
 if(n<2000)throw Error('too short original');
 const buf=Buffer.alloc(n);let off=0;
 for(const x of parts){Buffer.from(x).copy(buf,off);off+=x.byteLength;}
 return buf;
}
export async function replayPinnedMillerTurn(p,f=fetch){
 const o={url:PAGE,captureUtc:p.utc,indexedOriginalSha1:p.sha1,
  originalRawSha256:p.sha256,originalRawBytes:p.bytes,
  status:'archive_unavailable_unknown',turn:null,
  printedAnswerNotSpokenRecording:true,notFirstPublicationUtc:true,notHumanApprovedVerbatimQuote:true};
 try{
  const stamp=p.utc.replace(/[-:TZ]/g,'');
  const r=await f('https://web.archive.org/web/'+stamp+'id_/'+PAGE,{method:'GET',redirect:'manual',headers:{
   accept:'text/html','accept-encoding':'identity','user-agent':'VotePredict/2.0-original-miller-speaker-boundary'
  },signal:AbortSignal.timeout(27000)});
  if(r.status!==200){o.status=r.status>=300&&r.status<400?'archive_redirect_unknown':'archive_http_unknown';return o;}
  if((r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='text/html'){o.status='archive_mime_unknown';return o;}
  const bytes=await bounded(r);
  if(bytes.length!==p.bytes||b32(bytes)!==p.sha1||
   createHash('sha256').update(bytes).digest('hex')!==p.sha256){o.status='source_sha1_sha256_or_length_mismatch_unknown';return o;}
  o.status='indexed_sha1_and_raw_sha256_reverified';
  o.turn=boundedMillerParagraphProof(bytes.toString('utf8'));
 }catch{o.status='archive_fetch_or_body_unknown';}
 return o;
}
export async function run(f=fetch){
 const versions=[];
 for(const p of exactPins())versions.push(await replayPinnedMillerTurn(p,f));
 return {version:VERSION,localResearchDate:'2026-10-11',sourceUrl:PAGE,
  person:'Jeremy Miller',memberRecord:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15335',
  selectedShortCue:CUE,
  selectedOriginalSourceUrls:1,selectedOriginalArchiveVersions:2,versions,
  originalsCryptographicallyReverified:versions.filter(v=>v.status==='indexed_sha1_and_raw_sha256_reverified').length,
  historicalVersionsWithFragmentInsideSameLabeledMillerParagraph:versions.filter(v=>v.turn?.fragmentInsideSameExplicitMillerLabeledParagraph).length,
  contemporaneousNovember2021PostingProved:false,
  fullHumanReviewedVerbatimSenatorSpeechApproved:false,recordedSenateVotesVerified:0,
  noAudioOrFullPublisherArticlePersisted:true,noPrivateOrProductionChanges:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const k=process.argv.indexOf('--output'),file=process.argv[k+1];
 if(k<0||!file||!file.startsWith('artifacts/')||file.includes('..'))throw Error('must specify safe metadata-only artifact path');
 const r=await run();
 mkdirSync('artifacts',{recursive:true});writeFileSync(file,JSON.stringify(r,null,2)+'\n');
 console.log('PUBLIC_MILLER_ORIGINAL_TURN_SUMMARY='+JSON.stringify({version:r.version,verified:r.originalsCryptographicallyReverified,
  sameLabeledParagraphVersions:r.historicalVersionsWithFragmentInsideSameLabeledMillerParagraph,
  versions:r.versions.map(v=>({utc:v.captureUtc,sha1:v.indexedOriginalSha1,sha256:v.originalRawSha256,status:v.status,turn:v.turn}))}));
}

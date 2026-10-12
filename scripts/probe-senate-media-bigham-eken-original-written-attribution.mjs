/**
 * Track D (#987): EXACT two first-party SHA1-indexed historical original
 * publisher HTML bodies of ONE Jan-2022 DFL Senate Whips article.
 * Check separate Bigham and Eken short issue statements only if each selected
 * cue follows "said Senator <the specific full name>" inside the SAME visible
 * quoted paragraph. Do not infer audio, initial posting clock or votes.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import earlier from '../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};
export const VERSION='senate-media-two-original-bigham-eken-own-written-quote-paragraphs-v1';
const URL='https://senatedfl.mn/senators-karla-bigham-and-kent-eken-named-senate-dfl-whips-for-2022-legislative-session/';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',CAP=2_500_000;
export const SPEAKERS=Object.freeze([
 Object.freeze({name:'Karla Bigham',shortIssueCue:'unite the caucus around the important issues',
  marker:'said senator karla bigham',memberId:'15281'}),
 Object.freeze({name:'Kent Eken',shortIssueCue:'unique challenges our rural communities face',
  marker:'said senator kent eken',memberId:'10764'})
]);
export function originalPins(data=earlier){
 if(data?.version!=='senate-media-eight-caucus-originals-public-receipts-v1')throw Error('unknown previously authenticated original-source ledger');
 const matches=data.sources.filter(x=>x.id==='public-2022-bigham-eken-separated');
 if(matches.length!==1||matches[0].url!==URL||matches[0].originals?.length!==2||
  matches[0].individuals?.map(x=>x.name).join('|')!=='Karla Bigham|Kent Eken'||
  matches[0].individuals?.map(x=>x.officialMemberHistoryUrl.split('ID=')[1]).join('|')!=='15281|10764')throw Error('different original article/senator identities');
 const exp=[
  ['2022-03-11T19:51:03Z','W6T26AXVFFZJHAPPTOFAAZB6NDQWKV76','026e8becb82577a34cc27388faed93048a6f247991853ba3f60f1a5287268131',154251],
  ['2022-06-29T12:45:13Z','54ASOGEJRZQXKNSVI3XQKOTBVNTH4ON5','7a2621bdbe093c90c594af36124f53203399504758ce48c07eaec168afb9f06b',151424]
 ];
 for(let i=0;i<exp.length;i++){
  const x=matches[0].originals[i],e=exp[i];
  if(x.utc!==e[0]||x.indexSha1!==e[1]||x.rawSha256!==e[2]||x.bytes!==e[3]||
   x.status!=='sha1_authenticated_original_publisher_html')throw Error('previous indexed raw source proof differs');
 }
 return matches[0].originals.map(v=>Object.freeze({
  url:URL,utc:v.utc,indexedSha1:v.indexSha1,rawSha256:v.rawSha256,bytes:v.bytes
 }));
}
function normalize(s){
 return s.replace(/&(?:ldquo|rdquo|quot|#34);/gi,'"')
  .replace(/&(?:lsquo|rsquo|apos|#39|#x27);/gi,"'")
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):+n;return Number.isFinite(code)&&code<=0x10ffff?String.fromCodePoint(code):' ';})
  .replace(/<[^>]+>/g,' ').normalize('NFKC')
  .replace(/[\u201c\u201d]/g,'"').replace(/[\u2018\u2019]/g,"'")
  .replace(/\s+/g,' ').trim().toLowerCase();
}
export function inspectOriginalWrittenQuoteParagraphs(html,speakers=SPEAKERS){
 if(typeof html!=='string'||html.length>CAP||!Array.isArray(speakers)||speakers.length!==2
  ||JSON.stringify(speakers)!==JSON.stringify(SPEAKERS))throw Error('invalid original source or selected attribution');
 const stripped=html.replace(/<!--[\s\S]*?-->/g,' ')
   .replace(/<(head|script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
 const paragraphs=[...stripped.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].map(x=>normalize(x[1]));
 if(paragraphs.length>2500)throw Error('implausible original HTML paragraph population');
 const originalBodyText=normalize(stripped);
 const outcomes=speakers.map(person=>{
  let ownParagraphCount=0,foundFragmentInOtherParagraph=0,foundCueAnywhere=originalBodyText.includes(person.shortIssueCue);
  let successfulDistances=[],matchingQuotes=0;
  for(const p of paragraphs){
   if(p.length>12000)throw Error('implausible paragraph size');
   const markerIdx=p.indexOf(person.marker),fragmentIdx=p.indexOf(person.shortIssueCue);
   if(fragmentIdx<0)continue;
   const otherMarker=SPEAKERS.find(x=>x.name!==person.name).marker;
   if(markerIdx>=0)ownParagraphCount++;
   if(markerIdx<0||fragmentIdx<=markerIdx||fragmentIdx-markerIdx>550){foundFragmentInOtherParagraph++;continue;}
   const prefix=p.slice(markerIdx+person.marker.length,fragmentIdx);
   if(prefix.includes(otherMarker)){foundFragmentInOtherParagraph++;continue;}
   const openQuote=p.lastIndexOf('"',fragmentIdx);
   const closeQuote=p.indexOf('"',fragmentIdx+person.shortIssueCue.length);
   if(openQuote<=markerIdx+person.marker.length-1||closeQuote<fragmentIdx+person.shortIssueCue.length){
    foundFragmentInOtherParagraph++;continue;
   }
   // Must belong to the quotation *after* the exact person's reporter
   // attribution, not an interviewer, another senator, or later prose.
   const quoteArea=p.slice(openQuote+1,closeQuote);
   if(!quoteArea.includes(person.shortIssueCue)){foundFragmentInOtherParagraph++;continue;}
   successfulDistances.push(fragmentIdx-markerIdx);
   matchingQuotes++;
  }
  return {senator:person.name,selectedCueVisibleAnywhereInArchivedHtml:foundCueAnywhere,
   selectedCueInsideSameParagraphWithCorrectFullNameAndAfterAttribution:matchingQuotes>0,
   individualOwnQuotedParagraphMatches:matchingQuotes,
   cueOccurrencesNotInApprovedOwnAttributedQuotedParagraph:foundFragmentInOtherParagraph,
   selectedCueCharDistanceAfterOwnAttribution:successfulDistances.length?Math.min(...successfulDistances):null,
   requiresOwnExactSaidSenatorFullNameAndEnclosedLaterQuote:true,
   completeVerbatimStatementNotHumanReviewed:true,independentAudioNotAuthenticated:true};
 });
 return {originalHtmlParagraphsReviewed:paragraphs.length,individualSpeakerResults:outcomes,
  twoSeparatelyAttributedIndividualWrittenStatementCandidatesNotTwoArticles:true,
  notProofOfInitialJanuaryPublisherPublicationUtc:true,
  noHumanApprovedCompleteVerbatimSpokenQuotes:true};
}
function base32Sha1(raw){let v=0,bits=0,out='';for(const n of createHash('sha1').update(raw).digest()){
 v=v<<8|n;bits+=8;while(bits>=5){bits-=5;out+=B32[v>>>bits&31];}v&=(1<<bits)-1;}if(bits)out+=B32[v<<(5-bits)&31];return out;}
async function bounded(r){
 const hdr=r.headers.get('content-length');
 if(hdr!==null&&(!/^\d+$/.test(hdr)||Number(hdr)>CAP))throw Error('source body too large');
 if(!r.body)throw Error('missing source body');
 const chunks=[],rd=r.body.getReader();let n=0;
 for(;;){const a=await rd.read();if(a.done)break;n+=a.value.byteLength;if(n>CAP){await rd.cancel().catch(()=>{});throw Error('original body over cap');}chunks.push(a.value);}
 if(n<2500)throw Error('very short original HTML');
 const b=Buffer.allocUnsafe(n);let pos=0;
 for(const c of chunks){Buffer.from(c).copy(b,pos);pos+=c.byteLength;}return b;
}
export async function reverifyOne(pin,f=fetch){
 const out={originalUrl:URL,captureUtc:pin.utc,priorIndexedOriginalSha1:pin.indexedSha1,
  priorOriginalRawSha256:pin.rawSha256,priorOriginalBytes:pin.bytes,
  sourceStatus:'original_unavailable_unknown',speakerEvidence:null,
  sourceOriginalFirstPublicationTimeNotInferred:true,noRecordedSpeechOrVoteValidated:true};
 try{
  const stamp=pin.utc.replace(/[-:TZ]/g,'');
  const r=await f('https://web.archive.org/web/'+stamp+'id_/'+URL,{method:'GET',redirect:'manual',
   headers:{accept:'text/html','accept-encoding':'identity','user-agent':'VotePredict/2.0 public-2022-individual-original-caucus-speech'},
   signal:AbortSignal.timeout(30000)});
  if(r.status!==200){out.sourceStatus=r.status>=300&&r.status<400?'archived_original_redirect_unknown':'archived_original_non200_unknown';return out;}
  if((r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='text/html'){out.sourceStatus='archived_original_mime_unknown';return out;}
  const raw=await bounded(r),sha=createHash('sha256').update(raw).digest('hex');
  if(raw.length!==pin.bytes||sha!==pin.rawSha256||base32Sha1(raw)!==pin.indexedSha1){
   out.sourceStatus='archived_original_sha1_sha256_or_bytes_mismatch_unknown';return out;
  }
  out.sourceStatus='previously_pinned_indexed_sha1_raw_sha256_original_reverified';
  out.speakerEvidence=inspectOriginalWrittenQuoteParagraphs(raw.toString('utf8'));
 }catch{out.sourceStatus='archived_original_unavailable_or_body_unknown';}
 return out;
}
export async function run(f=fetch){
 const originals=[];
 for(const p of originalPins())originals.push(await reverifyOne(p,f));
 return {version:VERSION,researchLocalDate:'2026-10-11',oneOriginalPublisherArticleUrl:URL,
  servingSenators:SPEAKERS.map(x=>({senator:x.name,lrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID='+x.memberId})),
  originalCaptureVersionsReused:2,originals,
  versionsIndependentlyReverified:originals.filter(x=>x.sourceStatus==='previously_pinned_indexed_sha1_raw_sha256_original_reverified').length,
  originalsWithBothPersonallyAttributedShortCueQuotes:originals.filter(x=>x.speakerEvidence?.individualSpeakerResults.every(y=>y.selectedCueInsideSameParagraphWithCorrectFullNameAndAfterAttribution)).length,
  newDistinctArticleUrls:0,newArchiveVersionCount:0,
  completeVerbatimSpokenAudioHumanApproved:0,recordedMemberVotesVerified:0,
  originalFirstPublisherPostingClockKnown:false,noSourceHtmlOrMediaPersisted:true,noPrivateOrProductionChanges:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const k=process.argv.indexOf('--output'),file=process.argv[k+1];
 if(k<0||!/^artifacts\/[a-zA-Z0-9._-]+\.json$/.test(file||''))throw Error('safe metadata output required');
 const report=await run();
 mkdirSync('artifacts',{recursive:true});writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 console.log('TRACK_D_BIGHAM_EKEN_WRITTEN_ATTRIBUTION='+JSON.stringify({
  version:report.version,reverified:report.versionsIndependentlyReverified,
  bothSpeakers:report.originalsWithBothPersonallyAttributedShortCueQuotes,
  sources:report.originals.map(v=>({utc:v.captureUtc,priorIndexedSha1:v.priorIndexedOriginalSha1,
   rawSha256:v.priorOriginalRawSha256,status:v.sourceStatus,speakerEvidence:v.speakerEvidence}))
 }));
}

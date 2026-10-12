/**
 * Issue #987, Track D: two distinct 2024 first-party Minnesota Senate DFL
 * historical originals with individually attributed printed policy statements.
 * Reuse pinned independent Wayback indexed SHA1/raw SHA256 exact original HTML.
 * Inspect individual quotation boundaries, not current publisher HTML,
 * audio, original publication clock, Senate roll calls or forecast eligibility.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import previouslyAuthenticated from '../docs/evaluation/senate-media-eight-caucus-originals-20261011.json' with {type:'json'};

export const VERSION='senate-media-hawj-mcewen-two-2024-original-own-publisher-written-quote-v1';
const MAX_BYTES=2_500_000,BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TARGETS=Object.freeze([
 Object.freeze({
  id:'public-2024-mcewen-mining',
  url:'https://senatedfl.mn/senator-jen-mcewen-statement-following-informational-hearing-on-prove-it-first-legislation/',
  senator:'Jen McEwen',memberId:'15537',
  cue:'my support for prove it first legislation stems from a deep commitment',
  bills:Object.freeze(['SF 1416']),
  publisherDates:Object.freeze(['2024-02-26','2024-03-01']),
  priorEvent:'February 22, 2024 informational Prove It First hearing',
  expected:Object.freeze([Object.freeze({
   utc:'2024-04-22T03:56:26Z',
   sha1:'LUERCXLMTQVWEL5LPAM3RDXGEBHTLMKN',
   sha256:'d2a3d97c9519fa64f219dbd8d45be0c4c98904bde749a6a0e3c385e9bde7a6b9',
   bytes:94499
  })])
 }),
 Object.freeze({
  id:'public-2024-hawj-transport',
  url:'https://senatedfl.mn/senator-foung-hawj-testifies-in-support-of-transportation-equity-legislation/',
  senator:'Foung Hawj',memberId:'15380',
  cue:'my legislative proposals are inclusive, improve quality of service',
  bills:Object.freeze(['SF 4056','SF 3257','SF 3250']),
  publisherDates:Object.freeze(['2024-03-15']),
  priorEvent:'March 11, 2024 Senate Transportation Committee testimony',
  expected:Object.freeze([
   Object.freeze({
    utc:'2024-03-24T19:01:09Z',
    sha1:'YI4BL3IHGZ27R4JBNOVXUTI5XFGMQNSR',
    sha256:'aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743',
    bytes:93076
   }),
   Object.freeze({
    utc:'2024-04-22T04:14:23Z',
    sha1:'RPGCVOQOMF7AOA2UQ6R7E5QIALFQB7S2',
    sha256:'a168aef89b0f2e50e588c1aa404491de41a241b13739edfe394e4ec6b70e0a01',
    bytes:93360
   })
  ])
 })
]);
export function selectExactPins(receipts=previouslyAuthenticated,targets=TARGETS){
 if(receipts?.version!=='senate-media-eight-caucus-originals-public-receipts-v1'||
  !Array.isArray(receipts.sources)||receipts.sources.length!==8||
  targets!==TARGETS)throw Error('unknown prior 2024 historical source receipt universe');
 const out=[],seen=new Set();
 for(const target of targets){
  const found=receipts.sources.filter(x=>x.id===target.id);
  if(found.length!==1||seen.has(found[0]?.url)||found[0].url!==target.url||
   JSON.stringify(found[0].displayDates)!==JSON.stringify(target.publisherDates)||
   found[0].individuals?.length!==1||
   found[0].individuals[0].name!==target.senator||
   found[0].individuals[0].officialMemberHistoryUrl!=='https://www.lrl.mn.gov/legdb/fulldetail?ID='+target.memberId||
   found[0].originals?.length!==target.expected.length)throw Error('wrong original URL, state senator, service or dates');
  seen.add(found[0].url);
  for(let i=0;i<target.expected.length;i++){
   const pin=found[0].originals[i],exp=target.expected[i];
   if(pin.utc!==exp.utc||pin.indexSha1!==exp.sha1||pin.rawSha256!==exp.sha256||pin.bytes!==exp.bytes||
    pin.status!=='sha1_authenticated_original_publisher_html')
    throw Error('prior independently verified original source SHA/time changed');
   out.push(Object.freeze({
    leadId:target.id,originalUrl:target.url,senator:target.senator,memberId:target.memberId,
    publisherDisplayedDates:[...target.publisherDates],priorEvent:target.priorEvent,
    utc:pin.utc,sha1:pin.indexSha1,sha256:pin.rawSha256,bytes:pin.bytes
   }));
  }
 }
 if(out.length!==3||seen.size!==2)throw Error('original source sample unexpectedly changed');
 return out;
}
function decodeEntities(text){
 return text.replace(/&(?:ldquo|#8220|#x201c);/gi,'“')
  .replace(/&(?:rdquo|#8221|#x201d);/gi,'”')
  .replace(/&(?:quot|#34|#x22);/gi,'"')
  .replace(/&(?:lsquo|#8216|#x2018);/gi,'‘')
  .replace(/&(?:rsquo|#8217|#x2019|apos|#39);/gi,'’')
  .replace(/&(?:nbsp|#160|#xa0);/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,number)=>{
   const n=number.toLowerCase().startsWith('x')?Number.parseInt(number.slice(1),16):Number(number);
   return Number.isInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):' ';
  });
}
function normalizedVisibleText(html){
 const decoded=decodeEntities(html.replace(/<[^>]*>/g,' '));
 return decoded.normalize('NFKC').replace(/[\u00a0]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
export function inspectHistoricalAttributedStatement(html,target){
 if(typeof html!=='string'||html.length<1||html.length>MAX_BYTES||!TARGETS.includes(target))
  throw Error('untrusted publisher original HTML/speaker target');
 const visible=html.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(head|script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
 const paras=[...visible.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
  .map(x=>normalizedVisibleText(x[1])).filter(Boolean);
 if(paras.length>2500||paras.some(x=>x.length>15000))throw Error('implausible original paragraph set');
 const name='senator '+target.senator.toLowerCase();
 const preamble='issued the following statement';
 const introductionIndices=[];
 for(let i=0;i<paras.length;i++){
  const p=paras[i],at=p.indexOf(name),action=p.indexOf(preamble);
  const between=at<0?'':p.slice(at+name.length,action).trim();
  // Exact issuer must be this named senator, not an intervening reporter,
  // different speaker or contextual "senator X was present" description.
  const personallyIssued=between===''||/^\\(dfl[-\\s.a-z]+\\)$/.test(between);
  if(at>=0&&action>at&&action-at<=240&&action+preamble.length<=p.length&&personallyIssued){
   introductionIndices.push(i);
  }
 }
 const candidateResults=[];
 for(const ix of introductionIndices){
  // A new publisher statement must start in the first immediately following
  // nonempty visible HTML paragraph, never in a distant quote or page footer.
  if(ix+1>=paras.length)continue;
  const first=paras[ix+1];
  const quoteOpener=first[0];
  if(quoteOpener!=='“'&&quoteOpener!=='"')continue;
  const closing=quoteOpener==='“'?'”':'"';
  const cue=target.cue;
  let cueHits=0,closingFound=false,foundInSameNamedQuote=false;
  let covered=0,quoteLength=0,firstCueOffset=null,closingParagraphOffset=null;
  for(let z=ix+1;z<paras.length&&z<ix+7;z++){
   const p=paras[z],part=z===ix+1?p.slice(1):p;
   if(p.includes('issued the following statement')&&z!==ix+1)break;
   // Do not allow a different speaker's new reporter attribution to inherit
   // someone else's earlier quote. A senator may use the word "senator" in
   // their own first-person statement; require the new attribution verb.
   if(z!==ix+1&&/\b(?:said|stated)\s+senator\s+[a-z]/.test(p))break;
   const closeAt=part.indexOf(closing);
   const quotedPart=closeAt>=0?part.slice(0,closeAt):part;
   const cpos=quotedPart.indexOf(cue);
   if(cpos>=0){
    cueHits++;
    if(firstCueOffset===null)firstCueOffset=quoteLength+cpos;
    if(z===ix+1)foundInSameNamedQuote=true;
   }
   covered++;quoteLength+=quotedPart.length;
   if(quoteLength>8500)break;
   if(closeAt>=0){closingFound=true;closingParagraphOffset=z-(ix+1);break;}
  }
  candidateResults.push({startIntroParagraph:ix,
   namedSenatorIntroductionFollowedImmediatelyByOpeningQuotation:true,
   policyFragmentInsideFollowingBoundedQuotedStatement:closingFound&&cueHits===1&&foundInSameNamedQuote,
   completeQuotedSpanClosed:closingFound,
   matchedPolicyCueOccurrencesInsideQuote:cueHits,
   quotedParagraphCount:covered,
   selectedCueCharOffsetWithinOpeningQuotedStatement:firstCueOffset,
   finalQuoteClosingParagraphOffset:closingParagraphOffset
  });
 }
 const confirmed=candidateResults.filter(x=>x.policyFragmentInsideFollowingBoundedQuotedStatement);
 const allVisible=paras.join(' ');
 return {senator:target.senator,exactOriginalIntroParagraphs:introductionIndices.length,
  candidateQuotedStatementRuns:candidateResults.length,
  individuallyAttributedBoundedWrittenStatement:confirmed.length===1&&candidateResults.length===1,
  exactOriginalNamedIntroImmediatelyPrecedesOwnQuotation:confirmed.length===1,
  selectedCueAppearsOnceInsideOpeningOfClosedNamedQuote:confirmed.length===1,
  matchedStatementQuoteParagraphCount:confirmed.length===1?confirmed[0].quotedParagraphCount:null,
  policyCueOffsetWithinOpeningQuotedStatement:confirmed.length===1?confirmed[0].selectedCueCharOffsetWithinOpeningQuotedStatement:null,
  visibleOriginalParagraphCount:paras.length,
  namedBillReferences:target.bills.map(b=>({bill:b,visibleOriginalPublisherBodyContainsReference:
   new RegExp('\\b'+b.replace(' ','\\s*')+'\\b','i').test(allVisible)})),
  noStandaloneVideoHearingRecordingAuth:true,
  completeHumanApprovedVerbatimStatement:false,
  originalPublisherFirstPublicTimestampNotProven:true,
  exactLegislativeVoteOrForecastCutoffNotInferred:true};
}
function sha1Base32(bytes){
 let word=0,bits=0,out='';
 for(const octet of createHash('sha1').update(bytes).digest()){
  word=(word<<8)|octet;bits+=8;
  while(bits>=5){bits-=5;out+=BASE32[(word>>>bits)&31];}
  word &= (1<<bits)-1;
 }
 if(bits)out+=BASE32[(word<<(5-bits))&31];
 return out;
}
async function boundedHtmlBody(r){
 const length=r.headers.get('content-length');
 if(length!==null&&(!/^(0|[1-9]\d*)$/.test(length)||Number(length)>MAX_BYTES))throw Error('original body too large');
 if(!r.body)throw Error('missing raw original publisher response');
 const chunks=[],reader=r.body.getReader();let size=0;
 while(true){
  const item=await reader.read();if(item.done)break;
  size+=item.value.byteLength;
  if(size>MAX_BYTES){await reader.cancel().catch(()=>{});throw Error('raw original body over cap');}
  chunks.push(item.value);
 }
 if(size<2500)throw Error('implausibly short original historical source');
 const buf=Buffer.allocUnsafe(size);let offset=0;
 for(const chunk of chunks){Buffer.from(chunk).copy(buf,offset);offset+=chunk.byteLength;}
 return buf;
}
export async function probeOriginal(pin,f=fetch){
 const out={originalPublisherUrl:pin.originalUrl,sourceId:pin.leadId,senator:pin.senator,captureUtc:pin.utc,
  indexedOriginalSha1Base32:pin.sha1,expectedRawOriginalSha256:pin.sha256,expectedRawBytes:pin.bytes,
  originalBodyVerificationStatus:'historical_original_unavailable_unknown',
  historicalWrittenStatementEvidence:null,priorHearingOrTestimony:pin.priorEvent,
  noAudioVoteOrOriginalPublicationClockInferred:true};
 try{
  const stamp=pin.utc.replace(/[-:TZ]/g,'');
  const response=await f('https://web.archive.org/web/'+stamp+'id_/'+pin.originalUrl,{
   method:'GET',redirect:'manual',
   headers:{accept:'text/html','accept-encoding':'identity','user-agent':'VotePredict/2.0 public-senate-2024-original-attribution'},
   signal:AbortSignal.timeout(30000)
  });
  if(response.status!==200){out.originalBodyVerificationStatus=response.status>=300&&response.status<400?
   'archive_redirect_refused_unknown':'archive_non200_unavailable_unknown';return out;}
  if((response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='text/html'){
   out.originalBodyVerificationStatus='archive_html_mime_unverified_unknown';return out;
  }
  const raw=await boundedHtmlBody(response),sha=createHash('sha256').update(raw).digest('hex');
  if(raw.length!==pin.bytes||sha!==pin.sha256||sha1Base32(raw)!==pin.sha1){
   out.originalBodyVerificationStatus='historical_original_sha1_sha256_or_bytes_mismatch_unknown';return out;
  }
  out.originalBodyVerificationStatus='exact_indexed_sha1_raw_sha256_bytes_original_html_reverified';
  const target=TARGETS.find(x=>x.id===pin.leadId);
  out.historicalWrittenStatementEvidence=inspectHistoricalAttributedStatement(raw.toString('utf8'),target);
 }catch{
  out.originalBodyVerificationStatus='historical_original_download_or_parse_unavailable_unknown';
 }
 return out;
}
export async function run(f=fetch){
 const sources=[];
 for(const pin of selectExactPins())sources.push(await probeOriginal(pin,f));
 const successful=sources.filter(x=>x.originalBodyVerificationStatus==='exact_indexed_sha1_raw_sha256_bytes_original_html_reverified');
 const own=successful.filter(x=>x.historicalWrittenStatementEvidence?.individuallyAttributedBoundedWrittenStatement===true);
 return {version:VERSION,researchLocalDate:'2026-10-12',previouslyDiscoveredOriginalUrlCount:2,
  previouslyAuthenticatedOriginalHtmlVersionCount:3,
  individualHistoricalSpeakerCandidates:2,sources,
  reverifiedPinnedExactOriginalHtmlVersions:successful.length,
  verifiedIndividualPrintedSpeakerQuoteOriginalVersions:own.length,
  distinctSenatorsWithVerifiedOriginalWrittenQuote:new Set(own.map(x=>x.senator)).size,
  newlyFoundPublisherUrls:0,newArchiveVersionIdentities:0,
  recordedActualSenateRollCallVotesChecked:0,independentlyRecordedSpeechAudiosAuthenticated:0,
  originalPublisherInitialPostingTimesAuthenticated:0,
  noPublisherHtmlTranscriptVideoOrAudioSaved:true,noPrivateVotePredictDataRead:true,
  noProductionModelCollectorDatabaseServingOrForecastChanges:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const idx=process.argv.indexOf('--output'),filename=process.argv[idx+1];
 if(idx<0||!/^artifacts\/[a-z0-9._-]+\.json$/i.test(filename||''))throw Error('safe metadata-only JSON output required');
 const result=await run();
 mkdirSync('artifacts',{recursive:true});
 writeFileSync(filename,JSON.stringify(result,null,2)+'\n');
 console.log('TRACK_D_HAWJ_MCEWEN_ORIGINAL_WRITTEN_QUOTES='+JSON.stringify({
  reverified:result.reverifiedPinnedExactOriginalHtmlVersions,
  fullyAttributableOriginalVersions:result.verifiedIndividualPrintedSpeakerQuoteOriginalVersions,
  individualSenators:result.distinctSenatorsWithVerifiedOriginalWrittenQuote,
  publicOnlyVersions:result.sources.map(x=>({sourceId:x.sourceId,senator:x.senator,utc:x.captureUtc,
   originalIndexedSha1:x.indexedOriginalSha1Base32,rawSha256:x.expectedRawOriginalSha256,bytes:x.expectedRawBytes,
   status:x.originalBodyVerificationStatus,
   evidence:x.historicalWrittenStatementEvidence}))
 }));
}

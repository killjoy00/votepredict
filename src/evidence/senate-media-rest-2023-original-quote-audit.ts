/**
 * PUBLIC-ONLY exact original HTTP body research: two Ann Rest quotation cues
 * in the April 26, 2023 Minnesota Reformer reporter's article.
 *
 * The observed original HTML capture is NOT original interview audio or an
 * individual legislator's recorded vote. Keep reporter attribution separate
 * from contemporaneous recorded speech authentication.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';

export const REST_ORIGINAL_QUOTE_AUDIT_VERSION='rest-2023-reformer-sha-pinned-html-cues-v1' as const;
export const REST_ORIGINAL_MAX_BYTES=2_500_000;
const ARTICLE_URL='https://minnesotareformer.com/2023/04/26/here-are-some-of-the-differences-between-the-senate-and-house-dfl-tax-plans/';
const ARTICLE_LEAD='public-2023-rest-tax-reformer';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const REPLAY_CAPTURE_UTC=['2023-04-27T00:52:03Z','2023-12-03T13:07:09Z'] as const;
const CUES=[
  'rest-2023-individual-tax-promise',
  'rest-2023-anticipated-34-votes',
] as const;
export interface RestQuoteCue{
  id:string;fragment:string;attributionLabel:string;
  currentPublisherAttributionType:string;actualMemberRollCallRecordedByThisClaim:false;
}
export interface RestQueue{
  version:string;original25LeadId:string;person:string;
  publisher:string;reporter:string;displayedArticleDate:string;
  originalPublisherUrlSource:string;historicalRawBodyReceiptSource:string;
  officialMinnesotaSenateService:string;
  cues:RestQuoteCue[];targetExactPriorOriginalCaptures:string[];
  noOriginalAudioAuthenticated:true;
  archivedPageWordingNotHumanApprovedAsOriginalSpeakerRecording:true;
  noFirstPublisherPostClockProven:true;
  noPrivateSourceOrRecordedVoteCompared:true;
  collectiveStatementsOrContextualSenatorsNeverAssignedThisQuote:true;
}
export interface RestArticleLead{
  id:string;url:string;publisher:string;attributionCategory:string;
  individuallyNamedSenatorSpeakers:{name:string;officialMemberHistoryUrl:string}[];
}
export interface RestOriginalPinnedBody{
  captureUtc:string;indexSha1Base32:string;rawOriginalSha256:string;originalBytes:number;
}
export interface RestOriginalReceiptManifest{
  version:string;
  pinnedExactSha1AndRawSha256OriginalCaptureReceipts:{
    leadId:string;verifiedOriginalHttpBodies:RestOriginalPinnedBody[];
  }[];
}
export type OriginalRestSourceResult=
  |'original_exact_sha_verified'
  |'archive_redirect_refused'
  |'archive_http_denied'
  |'archive_content_type_untrusted'
  |'archive_body_size_limit'
  |'archive_body_too_short'
  |'indexed_original_sha1_mismatch'
  |'pinned_original_sha256_or_length_mismatch'
  |'archive_http_fetch_failed';
export interface RestHistoricalCue{
  id:string;
  originalHistoricHtmlTextHasShortPhrase:boolean|null;
  speakerLabelAppearsInSameHtmlParagraph:boolean|null;
  reporterAttributionOnCurrentPublisherPageNotHistoricallyHumanReapproved:true;
  individualSenatorQuoteHumanApproved:false;
  actualLegislatorVoteProven:false;
}
export interface RestHistoricSource{
  originalArticleUrl:string;
  captureUtc:string;archiveUrl:string;
  expectedOriginalBodySha256:string;
  expectedIndexedSha1Base32:string;
  result:OriginalRestSourceResult;
  actualBodySha256AfterRecheck:string|null;
  verifiedExactOriginalHttpBodyLength:number|null;
  cues:RestHistoricalCue[];
  originalAudioChecked:false;
  publisherInitialPostingTimestampProven:false;
  senatorQuotationHumanApproved:false;
}
export interface RestReviewReport{
  version:typeof REST_ORIGINAL_QUOTE_AUDIT_VERSION;
  source:"original_2023_minnesota_reformer_direct_senator_quotation";
  separatelyReportedSenator:"Ann Rest";
  exactArchivedHttpBodiesRequested:2;
  sha1AndSha256ReverifiedOriginals:number;
  sourceOriginalHttpVersionsUnverified:number;
  shortPhraseAndVersionChecks:4;
  historicalHtmlPhraseFound:number;
  historicalHtmlPhraseNotFound:number;
  historicalHtmlUnknown:number;
  historicalHtmlSameParagraphSpeakerLabelCues:number;
  originals:RestHistoricSource[];
  originalRecordingCompared:false;
  individualHistoricalSenatorQuoteHumanApproved:0;
  originalArticlePublishedAtFirstClockProven:false;
  actualRecordedLegislativeVotesProven:0;
  noRawArticleHtmlOrAudioPersisted:true;
  noPrivateVotePredictSourceOrDatabaseAccessed:true;
}
interface Target {captureUtc:string;archiveUrl:string;pin:RestOriginalPinnedBody;}
const SHA1=/^[A-Z2-7]{32}$/;
const SHA256=/^[a-f0-9]{64}$/;
function base32(bytes:Uint8Array):string{
  let out='',buf=0,bits=0;
  for(const b of bytes){
    buf=(buf<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(buf>>>bits)&31];}
    buf&=(1<<bits)-1;
  }
  if(bits)out+=B32[(buf<<(5-bits))&31];
  return out;
}
function stamp(value:string):string{
  if(!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value)
    ||!Number.isFinite(Date.parse(value))
    ||new Date(value).toISOString()!==value.replace('Z','.000Z'))
    throw Error('Invalid exact original Wayback capture time');
  return value.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
}
export function validateRestOriginalTarget(
  queue:RestQueue,leads:readonly RestArticleLead[],
  archived:RestOriginalReceiptManifest,
):{cues:RestQuoteCue[];targets:Target[]}{
  if(queue?.version!=='senate-media-rest-2023-exact-historical-quote-fragment-queue-v1'
    ||queue.original25LeadId!==ARTICLE_LEAD
    ||queue.publisher!=='Minnesota Reformer'
    ||queue.reporter!=='Michelle Griffith'||queue.person!=='Ann Rest'
    ||queue.displayedArticleDate!=='2023-04-26'
    ||queue.officialMinnesotaSenateService!=='https://www.lrl.mn.gov/legdb/fulldetail?ID=10558'
    ||queue.originalPublisherUrlSource!=='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json'
    ||queue.historicalRawBodyReceiptSource!=='docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json'
    ||queue.noOriginalAudioAuthenticated!==true
    ||queue.archivedPageWordingNotHumanApprovedAsOriginalSpeakerRecording!==true
    ||queue.noFirstPublisherPostClockProven!==true
    ||queue.noPrivateSourceOrRecordedVoteCompared!==true
    ||queue.collectiveStatementsOrContextualSenatorsNeverAssignedThisQuote!==true
    ||!Array.isArray(queue.cues)||queue.cues.length!==2
    ||!Array.isArray(queue.targetExactPriorOriginalCaptures)
    ||JSON.stringify(queue.targetExactPriorOriginalCaptures)!==JSON.stringify(REPLAY_CAPTURE_UTC))
    throw Error('Untrusted Rest historical quotation research queue');
  const ids=new Set<string>();
  for(const cue of queue.cues){
    if(!CUES.includes(cue.id as typeof CUES[number])||ids.has(cue.id)
      ||typeof cue.fragment!=='string'||cue.fragment.length<25||cue.fragment.length>110
      ||cue.fragment.split(/\s+/).length>18
      ||/[<>]|https?:\/\//.test(cue.fragment)
      ||cue.attributionLabel!=='Ann Rest'
      ||cue.currentPublisherAttributionType!=='reporter_directly_quotes_senator'
      ||cue.actualMemberRollCallRecordedByThisClaim!==false)
      throw Error('Untrusted or overstated historical quoted phrase');
    ids.add(cue.id);
  }
  if(!CUES.every(id=>ids.has(id)))throw Error('Missing independently sourced Rest quote phrase');
  const original=leads.find(x=>x.id===ARTICLE_LEAD);
  if(!original||original.url!==ARTICLE_URL||original.publisher!=='Minnesota Reformer'
    ||original.attributionCategory!=='independent_reporter_attributed'
    ||original.individuallyNamedSenatorSpeakers.length!==1
    ||original.individuallyNamedSenatorSpeakers[0]?.name!=='Ann Rest'
    ||original.individuallyNamedSenatorSpeakers[0]?.officialMemberHistoryUrl!==queue.officialMinnesotaSenateService)
    throw Error('Wrong 2023 reporter article or source senator attribution');
  if(archived.version!=='senate-media-2021-25-broader-25-original-public-archive-receipts-v1')
    throw Error('No trusted historical original body receipt manifest');
  const receipt=archived.pinnedExactSha1AndRawSha256OriginalCaptureReceipts.find(x=>x.leadId===ARTICLE_LEAD);
  if(!receipt||receipt.verifiedOriginalHttpBodies.length!==2)
    throw Error('Expected two independently CDX-verified original reporter article captures');
  const targets:Target[]=[];
  for(const exact of REPLAY_CAPTURE_UTC){
    const pin=receipt.verifiedOriginalHttpBodies.find(x=>x.captureUtc===exact);
    if(!pin||!SHA1.test(pin.indexSha1Base32)||!SHA256.test(pin.rawOriginalSha256)
      ||!Number.isSafeInteger(pin.originalBytes)
      ||pin.originalBytes<40||pin.originalBytes>REST_ORIGINAL_MAX_BYTES)
      throw Error('Original 2023 archive raw SHA provenance not pinned');
    targets.push({captureUtc:exact,pin,
      archiveUrl:'https://web.archive.org/web/'+stamp(exact)+'id_/'+ARTICLE_URL});
  }
  return {cues:[...queue.cues],targets};
}
async function readBounded(r:Response):Promise<Uint8Array>{
  const declared=r.headers.get('content-length');
  if(declared!==null&&(!/^(0|[1-9]\d*)$/.test(declared)
    ||!Number.isSafeInteger(Number(declared))
    ||Number(declared)>REST_ORIGINAL_MAX_BYTES))
    throw Error('body_size_limit');
  if(!r.body)throw Error('body_too_short');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];
  let size=0;
  while(true){
    const item=await reader.read();
    if(item.done)break;
    size+=item.value.byteLength;
    if(size>REST_ORIGINAL_MAX_BYTES){
      await reader.cancel().catch(()=>undefined);
      throw Error('body_size_limit');
    }
    parts.push(item.value);
  }
  if(size<40)throw Error('body_too_short');
  const result=new Uint8Array(size);let at=0;
  for(const p of parts){result.set(p,at);at+=p.byteLength;}
  return result;
}
function normalizedMarkupCue(text:string):string{
  return approximatePublicHtmlText(text);
}
function paragraphLabelHint(html:string,fragment:string):boolean{
  const normalizedCue=normalizedMarkupCue(fragment);
  // This is strictly a weak same-paragraph source-label clue, never
  // independent authentication of the person's exact recorded utterance.
  const p=html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)??[];
  return p.some(raw=>{
    const txt=approximatePublicHtmlText(raw);
    return txt.includes(normalizedCue)
      &&(txt.includes('ann rest')||txt.includes('rest said'));
  });
}
function failed(cue:RestQuoteCue):RestHistoricalCue{
  return {id:cue.id,originalHistoricHtmlTextHasShortPhrase:null,
    speakerLabelAppearsInSameHtmlParagraph:null,
    reporterAttributionOnCurrentPublisherPageNotHistoricallyHumanReapproved:true,
    individualSenatorQuoteHumanApproved:false,actualLegislatorVoteProven:false};
}
async function verifyOriginal(t:Target,cues:RestQuoteCue[],fetchImpl:typeof fetch):Promise<RestHistoricSource>{
  const base={
    originalArticleUrl:ARTICLE_URL,captureUtc:t.captureUtc,archiveUrl:t.archiveUrl,
    expectedOriginalBodySha256:t.pin.rawOriginalSha256,
    expectedIndexedSha1Base32:t.pin.indexSha1Base32,
    originalAudioChecked:false as const,publisherInitialPostingTimestampProven:false as const,
    senatorQuotationHumanApproved:false as const,
  };
  const unresolved=(result:OriginalRestSourceResult):RestHistoricSource=>({
    ...base,result,actualBodySha256AfterRecheck:null,
    verifiedExactOriginalHttpBodyLength:null,cues:cues.map(failed),
  });
  try{
    const response=await fetchImpl(t.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-rest-original-senate-remark-research'},
    });
    if(response.status>=300&&response.status<400)return unresolved('archive_redirect_refused');
    if(response.status!==200)return unresolved('archive_http_denied');
    if((response.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='text/html')
      return unresolved('archive_content_type_untrusted');
    const body=await readBounded(response);
    if(base32(createHash('sha1').update(body).digest())!==t.pin.indexSha1Base32)
      return unresolved('indexed_original_sha1_mismatch');
    const sha=createHash('sha256').update(body).digest('hex');
    if(sha!==t.pin.rawOriginalSha256||body.byteLength!==t.pin.originalBytes)
      return unresolved('pinned_original_sha256_or_length_mismatch');
    const html=new TextDecoder('utf-8',{fatal:false}).decode(body);
    const text=approximatePublicHtmlText(html);
    return {...base,result:'original_exact_sha_verified',
      actualBodySha256AfterRecheck:sha,
      verifiedExactOriginalHttpBodyLength:body.byteLength,
      cues:cues.map(cue=>{
        const found=text.includes(normalizedMarkupCue(cue.fragment));
        return {
          id:cue.id,
          originalHistoricHtmlTextHasShortPhrase:found,
          speakerLabelAppearsInSameHtmlParagraph:found?paragraphLabelHint(html,cue.fragment):false,
          reporterAttributionOnCurrentPublisherPageNotHistoricallyHumanReapproved:true,
          individualSenatorQuoteHumanApproved:false,actualLegislatorVoteProven:false,
        };
      }),
    };
  }catch(e){
    if(e instanceof Error&&e.message==='body_size_limit')
      return unresolved('archive_body_size_limit');
    if(e instanceof Error&&e.message==='body_too_short')
      return unresolved('archive_body_too_short');
    return unresolved('archive_http_fetch_failed');
  }
}
export async function auditRestOriginalQuotes(
  queue:RestQueue,leads:readonly RestArticleLead[],pin:RestOriginalReceiptManifest,
  fetchImpl:typeof fetch=fetch,
):Promise<RestReviewReport>{
  const trusted=validateRestOriginalTarget(queue,leads,pin);
  const originals=await Promise.all(trusted.targets.map(t=>
    verifyOriginal(t,trusted.cues,fetchImpl)));
  const checks=originals.flatMap(x=>x.cues);
  const trueFound=checks.filter(x=>x.originalHistoricHtmlTextHasShortPhrase===true).length;
  const falseFound=checks.filter(x=>x.originalHistoricHtmlTextHasShortPhrase===false).length;
  return {
    version:REST_ORIGINAL_QUOTE_AUDIT_VERSION,
    source:'original_2023_minnesota_reformer_direct_senator_quotation',
    separatelyReportedSenator:'Ann Rest',
    exactArchivedHttpBodiesRequested:2,
    sha1AndSha256ReverifiedOriginals:originals.filter(x=>x.result==='original_exact_sha_verified').length,
    sourceOriginalHttpVersionsUnverified:originals.filter(x=>x.result!=='original_exact_sha_verified').length,
    shortPhraseAndVersionChecks:4,
    historicalHtmlPhraseFound:trueFound,
    historicalHtmlPhraseNotFound:falseFound,
    historicalHtmlUnknown:checks.length-trueFound-falseFound,
    historicalHtmlSameParagraphSpeakerLabelCues:checks.filter(x=>
      x.speakerLabelAppearsInSameHtmlParagraph===true).length,
    originals,originalRecordingCompared:false,individualHistoricalSenatorQuoteHumanApproved:0,
    originalArticlePublishedAtFirstClockProven:false,
    actualRecordedLegislativeVotesProven:0,
    noRawArticleHtmlOrAudioPersisted:true,noPrivateVotePredictSourceOrDatabaseAccessed:true,
  };
}

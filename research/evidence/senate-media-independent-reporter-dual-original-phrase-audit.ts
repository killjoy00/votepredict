/**
 * #987 Public-only: historical journalist quotes from TWO original
 * Minnesota Reformer articles with two separately reported SENATE speakers
 * per article. Four historic SHA-pinned original response versions, eight
 * short HTML wording checks. Not human/audio attribution or recorded votes.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from '../../src/evidence/senate-media-historical-phrase-presence.js';

export const TWO_NEWS_ORIGINAL_VERSION='senate-media-independent-dual-speaker-historic-original-html-v1';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAX_BYTES=2_500_000;
const SHA1=/^[A-Z2-7]{32}$/;
const SHA256=/^[a-f0-9]{64}$/;
const expected=[
 {id:'new-reporter-2021-clean-cars',sp:['Paul Gazelka','Susan Kent'],
  captures:['2021-01-22T18:33:37Z','2021-02-03T17:43:23Z'],
  cueIds:['2021-clean-cars-paul-gazelka','2021-clean-cars-susan-kent']},
 {id:'new-reporter-2024-gun-proposals',sp:['John Marty','Jen McEwen'],
  captures:['2024-02-21T12:39:14Z','2024-02-21T17:52:18Z'],
  cueIds:['2024-firearms-john-marty','2024-firearms-jen-mcewen']},
] as const;

export interface ShortReporterCue{
  id:string;namedSpeaker:string;originalReporterQuoteShortPhrase:string;
  quotedSpeakerCurrentWebReporterAttribution:true;fullOriginalAudioChecked:false;
  humanQuoteSpeakerApproved:false;
}
export interface ReporterArticleTarget{
  leadId:string;originalPublisherUrl:string;historicalOriginalCaptureUtc:string[];
  shortSeparateSenatorCues:ShortReporterCue[];
}
export interface DualReporterQueue{
  version:string;preparedOn:string;originalsManifest:string;
  independentReporterLeadLedger:string;publisher:string;articleTargets:ReporterArticleTarget[];
  noOtherSenatorOrHousePersonAssignedTheseFragments:true;
  reporterInterviewAndJournalistSpeechNotAuthenticatedOriginalAudio:true;
  rawOriginalHttpArchiveDigestRequiredBeforeTextReview:true;
  originalPublisherInitialPostingClocksNotProven:true;
  individuallyRecordedFloorOrCommitteeVotesNotInferred:true;
}
export interface ReporterArticleLead{
  id:string;originalPublisherUrl:string;originalPublisher:string;
  namedSenatorSpeakerTurnCandidates:Array<{name:string;officialMemberServiceUrl:string}>;
}
export interface ReporterOriginalBody {
  captureUtc:string;indexSha1Base32:string;rawOriginalBodySha256:string;originalBytes:number;
}
export interface ReporterOriginalReceipt {
  leadId:string;rawSha1ConsistentOriginalHttpCaptures:ReporterOriginalBody[];
}
export interface JournalistOriginalProof {
  version:string;originalSourceBodies:ReporterOriginalReceipt[];
}
export type DualHistoricReplayStatus=
 |'exact_indexed_sha1_and_raw_sha256_verified'
 |'archive_redirect_refused_unknown'
 |'archive_http_denied_unknown'
 |'archive_non_html_unknown'
 |'archive_indexed_sha1_mismatch_unknown'
 |'archive_pinned_sha256_or_length_mismatch_unknown'
 |'archive_body_limit_unknown'
 |'archive_short_body_unknown'
 |'archive_fetch_failed_unknown';
export interface DualPhraseReceipt{
  cueId:string;separatelyReportedSenator:string;
  shortPhraseInAuthenticatedOriginalHtml:boolean|null;
  namedSpeakerFoundNearTextWithinOriginalVisibleArticle:boolean|null;
  reporterAttributionNotHumanSpeakerApproval:true;
  originalAudioIndependentVerification:false;
  actualLegislativeVoteVerified:false;
}
export interface DualPageReceipt {
  sourceId:string;originalUrl:string;originalUtc:string;originalArchiveUrl:string;
  indexedRawSha1Base32:string;pinnedRawSha256:string;pinnedOriginalBodyBytes:number;
  observedRawSha256:string|null;
  status:DualHistoricReplayStatus;
  phrases:DualPhraseReceipt[];
  firstPublisherPostingClockAuthenticated:false;
  fullHumanIndividualQuoteApproved:false;
}
export interface DualNewsReport {
  version:typeof TWO_NEWS_ORIGINAL_VERSION;
  selectedIndependentJournalistArticleUrls:2;
  namedServingSenatorSpeechCandidates:4;
  originalHttpCaptureVersionsRequested:4;
  originalRawSha1AndSha256BodyVersionsReverified:number;
  verifiedOriginalBodyVersionsUnavailable:number;
  shortPhraseChecksAttempted:8;
  historicalPageTextPhrasePresent:number;
  historicalPageTextPhraseNotFound:number;
  historicalPageTextUnknown:number;
  speakerNameNearVerbatimCueInHistoricalHtml:number;
  sources:DualPageReceipt[];
  humanApprovedFullSenatorQuotes:0;
  recordedAudioIndependentlyCompared:false;
  originalPublisherFirstPostTimesEstablished:0;
  individuallyRecordedMemberVotesProven:0;
  rawArticleHtmlOrAudioSaved:false;
  privateEvidenceOrForecastRead:false;
}
interface Target {
  q:ReporterArticleTarget;
  cue:ShortReporterCue[];
  pin:ReporterOriginalBody;archiveUrl:string;
}
const makeUtc=(iso:string):string=>{
  if(!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(iso)
    ||!Number.isFinite(Date.parse(iso))
    ||new Date(iso).toISOString()!==iso.replace('Z','.000Z'))
    throw Error('Invalid previously captured historic UTC');
  return iso.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
};
function b32(raw:Uint8Array):string{
  let word=0,bits=0,out='';
  for(const n of raw){
    word=(word<<8)|n;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(word>>>bits)&31];}
    word&=(1<<bits)-1;
  }
  if(bits)out+=B32[(word<<(5-bits))&31];
  return out;
}
function shortText(s:string):string{
  return approximatePublicHtmlText(s);
}
export function validateTwoJournalistOriginals(
  queue:DualReporterQueue,leads:readonly ReporterArticleLead[],pinned:JournalistOriginalProof,
):Target[]{
  if(queue?.version!=='senate-media-2021-and-2024-two-original-reformer-dual-senator-speech-cues-v1'
    ||queue.preparedOn!=='2026-10-11'
    ||queue.originalsManifest!=='docs/evaluation/senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json'
    ||queue.independentReporterLeadLedger!=='docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json'
    ||queue.publisher!=='Minnesota Reformer'
    ||queue.noOtherSenatorOrHousePersonAssignedTheseFragments!==true
    ||queue.reporterInterviewAndJournalistSpeechNotAuthenticatedOriginalAudio!==true
    ||queue.rawOriginalHttpArchiveDigestRequiredBeforeTextReview!==true
    ||queue.originalPublisherInitialPostingClocksNotProven!==true
    ||queue.individuallyRecordedFloorOrCommitteeVotesNotInferred!==true
    ||!Array.isArray(queue.articleTargets)||queue.articleTargets.length!==2
    ||pinned.version!=='senate-media-2021-25-independent-reporter-15-original-http-sha1-proof-v1')
    throw Error('Invalid two independent journalist original source study');
  const out:Target[]=[];
  for(let i=0;i<expected.length;i++){
    const want=expected[i]!,item=queue.articleTargets[i];
    if(!item||item.leadId!==want.id
      ||JSON.stringify(item.historicalOriginalCaptureUtc)!==JSON.stringify(want.captures)
      ||!Array.isArray(item.shortSeparateSenatorCues)
      ||item.shortSeparateSenatorCues.length!==2)
      throw Error('Original publisher reporter URL or UTC wrong');
    const original=leads.find(x=>x.id===item.leadId);
    if(!original||original.originalPublisherUrl!==item.originalPublisherUrl
      ||original.originalPublisher!=='Minnesota Reformer'
      ||original.namedSenatorSpeakerTurnCandidates.length!==2
      ||JSON.stringify(original.namedSenatorSpeakerTurnCandidates.map(x=>x.name))
        !==JSON.stringify(want.sp)
      ||original.namedSenatorSpeakerTurnCandidates.some(x=>
        !/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/
          .test(x.officialMemberServiceUrl)))
      throw Error('Incorrect senator speaker identity for original independent newsroom source');
    const url=new URL(item.originalPublisherUrl);
    if(url.protocol!=='https:'||url.hostname!=='minnesotareformer.com'||url.search
      ||url.hash||url.username||url.password||url.port||url.toString()!==item.originalPublisherUrl)
      throw Error('Untrusted original publisher article URL');
    const old=pinned.originalSourceBodies.find(x=>x.leadId===want.id);
    if(!old||old.rawSha1ConsistentOriginalHttpCaptures.length!==2)
      throw Error('Actual original archive HTTP body proof not available');
    for(let k=0;k<2;k++){
      const c=item.shortSeparateSenatorCues[k];
      if(!c||c.namedSpeaker!==want.sp[k]
        ||c.id!==want.cueIds[k]
        ||typeof c.originalReporterQuoteShortPhrase!=='string'
        ||c.originalReporterQuoteShortPhrase.length<30
        ||c.originalReporterQuoteShortPhrase.length>125
        ||c.originalReporterQuoteShortPhrase.split(/\s+/).length>19
        ||/[<>]|https?:\/\//.test(c.originalReporterQuoteShortPhrase)
        ||c.quotedSpeakerCurrentWebReporterAttribution!==true
        ||c.fullOriginalAudioChecked!==false||c.humanQuoteSpeakerApproved!==false)
        throw Error('Quote cue assigned to wrong senator or prematurely human approved');
    }
    for(const t of want.captures){
      const pin=old.rawSha1ConsistentOriginalHttpCaptures.find(x=>x.captureUtc===t);
      if(!pin||!SHA1.test(pin.indexSha1Base32)||!SHA256.test(pin.rawOriginalBodySha256)
        ||!Number.isSafeInteger(pin.originalBytes)||pin.originalBytes<40
        ||pin.originalBytes>MAX_BYTES)
        throw Error('Raw original index and SHA256 body proof missing');
      out.push({q:item,cue:item.shortSeparateSenatorCues,pin,
        archiveUrl:'https://web.archive.org/web/'+makeUtc(t)+'id_/'+url.toString()});
    }
  }
  return out;
}
async function bounded(r:Response):Promise<Uint8Array>{
  const len=r.headers.get('content-length');
  if(len!==null&&(!/^(0|[1-9]\d*)$/.test(len)
    ||!Number.isSafeInteger(Number(len))||Number(len)>MAX_BYTES))
    throw Error('too_large');
  if(!r.body)throw Error('short');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
  while(true){
    const v=await reader.read();if(v.done)break;
    size+=v.value.byteLength;
    if(size>MAX_BYTES){await reader.cancel().catch(()=>undefined);throw Error('too_large');}
    parts.push(v.value);
  }
  if(size<40)throw Error('short');
  const data=new Uint8Array(size);let n=0;
  for(const p of parts){data.set(p,n);n+=p.byteLength;}
  return data;
}
function phraseResult(c:ShortReporterCue,found:boolean|null,near:boolean|null):DualPhraseReceipt{
  return {
    cueId:c.id,separatelyReportedSenator:c.namedSpeaker,
    shortPhraseInAuthenticatedOriginalHtml:found,
    namedSpeakerFoundNearTextWithinOriginalVisibleArticle:near,
    reporterAttributionNotHumanSpeakerApproval:true,
    originalAudioIndependentVerification:false,actualLegislativeVoteVerified:false,
  };
}
async function examine(t:Target,f:typeof fetch):Promise<DualPageReceipt>{
  const base={
    sourceId:t.q.leadId,originalUrl:t.q.originalPublisherUrl,originalUtc:t.pin.captureUtc,
    originalArchiveUrl:t.archiveUrl,indexedRawSha1Base32:t.pin.indexSha1Base32,
    pinnedRawSha256:t.pin.rawOriginalBodySha256,pinnedOriginalBodyBytes:t.pin.originalBytes,
    firstPublisherPostingClockAuthenticated:false as const,
    fullHumanIndividualQuoteApproved:false as const,
  };
  const fail=(status:DualHistoricReplayStatus):DualPageReceipt=>({
    ...base,status,observedRawSha256:null,phrases:t.cue.map(c=>phraseResult(c,null,null)),
  });
  try{
    const response=await f(t.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-independent-news-senator-original-quote-research'},
    });
    if(response.status>=300&&response.status<400)return fail('archive_redirect_refused_unknown');
    if(response.status!==200)return fail('archive_http_denied_unknown');
    if((response.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='text/html')
      return fail('archive_non_html_unknown');
    const bytes=await bounded(response);
    if(b32(createHash('sha1').update(bytes).digest())!==t.pin.indexSha1Base32)
      return fail('archive_indexed_sha1_mismatch_unknown');
    const sha=createHash('sha256').update(bytes).digest('hex');
    if(sha!==t.pin.rawOriginalBodySha256||bytes.length!==t.pin.originalBytes)
      return fail('archive_pinned_sha256_or_length_mismatch_unknown');
    const visible=shortText(new TextDecoder('utf-8',{fatal:false}).decode(bytes));
    return {...base,status:'exact_indexed_sha1_and_raw_sha256_verified',observedRawSha256:sha,
      phrases:t.cue.map(c=>{
        const phrase=shortText(c.originalReporterQuoteShortPhrase);
        const at=visible.indexOf(phrase);
        if(at<0)return phraseResult(c,false,false);
        const context=visible.slice(Math.max(0,at-450),Math.min(visible.length,at+phrase.length+140));
        const named=shortText(c.namedSpeaker);
        return phraseResult(c,true,context.includes(named));
      }),
    };
  }catch(e){
    if(e instanceof Error&&e.message==='too_large')return fail('archive_body_limit_unknown');
    if(e instanceof Error&&e.message==='short')return fail('archive_short_body_unknown');
    return fail('archive_fetch_failed_unknown');
  }
}
export async function auditTwoJournalistOriginalSpeakerPhrases(
  q:DualReporterQueue,leads:readonly ReporterArticleLead[],pins:JournalistOriginalProof,
  f:typeof fetch=fetch,
):Promise<DualNewsReport>{
  const originals=validateTwoJournalistOriginals(q,leads,pins);
  const outputs=await Promise.all(originals.map(x=>examine(x,f)));
  const phrases=outputs.flatMap(x=>x.phrases);
  const present=phrases.filter(x=>x.shortPhraseInAuthenticatedOriginalHtml===true).length;
  const absent=phrases.filter(x=>x.shortPhraseInAuthenticatedOriginalHtml===false).length;
  return {
    version:TWO_NEWS_ORIGINAL_VERSION,
    selectedIndependentJournalistArticleUrls:2,namedServingSenatorSpeechCandidates:4,
    originalHttpCaptureVersionsRequested:4,
    originalRawSha1AndSha256BodyVersionsReverified:outputs.filter(x=>
      x.status==='exact_indexed_sha1_and_raw_sha256_verified').length,
    verifiedOriginalBodyVersionsUnavailable:outputs.filter(x=>
      x.status!=='exact_indexed_sha1_and_raw_sha256_verified').length,
    shortPhraseChecksAttempted:8,historicalPageTextPhrasePresent:present,
    historicalPageTextPhraseNotFound:absent,historicalPageTextUnknown:phrases.length-present-absent,
    speakerNameNearVerbatimCueInHistoricalHtml:phrases.filter(x=>
      x.namedSpeakerFoundNearTextWithinOriginalVisibleArticle===true).length,
    sources:outputs,humanApprovedFullSenatorQuotes:0,
    recordedAudioIndependentlyCompared:false,originalPublisherFirstPostTimesEstablished:0,
    individuallyRecordedMemberVotesProven:0,rawArticleHtmlOrAudioSaved:false,
    privateEvidenceOrForecastRead:false,
  };
}

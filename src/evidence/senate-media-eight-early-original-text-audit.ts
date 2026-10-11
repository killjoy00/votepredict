/**
 * PUBLIC-ONLY #987 historical original source-language research.
 * Eight serving Minnesota state senators on eight earlier SHA-pinned exact
 * archive original publisher HTML bodies. No original article/audio saved.
 *
 * A short text cue + nearby speaker label does not prove audio, an authentic
 * member's complete verbatim turn, first publisher clock, or a recorded vote.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';

export const EIGHT_HISTORICAL_VERSION='senate-media-eight-independent-original-text-cues-v1' as const;
const SOURCE_MAX=2_500_000;
const HOSTS=new Set(['senatedfl.mn']);
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIMES=/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const SHA1=/^[A-Z2-7]{32}$/;
const SHA256=/^[a-f0-9]{64}$/;
const TARGETS=[
 ['public-2021-torres-ray-retirement','Patricia Torres Ray','2021-11-16T19:51:35Z'],
 ['public-2022-torres-ray-richfield','Patricia Torres Ray','2022-03-11T18:20:01Z'],
 ['public-2023-murphy-reproduction','Erin Murphy','2023-03-29T03:13:14Z'],
 ['public-2024-mitchell-tax','Nicole Mitchell','2024-03-02T15:41:08Z'],
 ['public-2024-mcewen-mining','Jen McEwen','2024-04-22T03:56:26Z'],
 ['public-2024-hawj-transport','Foung Hawj','2024-03-24T19:01:09Z'],
 ['public-2024-seeberger-ems','Judy Seeberger','2024-06-21T20:28:16Z'],
 ['public-2025-clark-ice-student','Doron Clark','2025-03-31T08:06:09Z'],
] as const;
export interface EightCue{
  cueId:string;originalLeadId:string;namedSenatorSpeaker:string;
  historicalCaptureUtc:string;currentPublisherShortFragment:string;
  reportingAttributionClass:string;datingQualification:string;
  historicalOriginalBodyRecheckedByThisNewStudy:false;
  speakerLabelWithinArchivedBodyActuallyChecked:false;
  originalArticleSpokenAudioAuthenticated:false;
  individualSpeakerHumanApproved:false;
  recordedLegislativeVoteVerified:false;
}
export interface EightQueue{
  version:string;preparedOn:string;sourceLedger:string;sourceOriginalRawReceiptLedger:string;
  cues:EightCue[];
  originalPublisherAudioNotChecked:true;noIndividualHistoricalQuotationHumanApproved:true;
  historicalCaptureCannotBackdateCurrentPublisherArticleUpdate:true;
  originalSenateVotesInferred:false;
}
export interface EightLead{
  id:string;url:string;publisher:string;
  attributionCategory:string;
  currentPageDisplayedDates:string[];
  individuallyNamedSenatorSpeakers:{name:string;officialMemberHistoryUrl:string}[];
}
export interface EightReceipt{
  leadId:string;
  verifiedOriginalHttpBodies?:Array<{captureUtc:string;indexSha1Base32:string;rawOriginalSha256:string;originalBytes:number}>;
  independentlyNewShaConsistentOriginalVersions?:Array<{
    captureUtc:string;indexSha1Base32:string;rawOriginalSha256:string;originalBytes:number
  }>;
}
export interface EightHistoricManifest{
  version:string;
  pinnedExactSha1AndRawSha256OriginalCaptureReceipts:EightReceipt[];
  independentSecondPublicRun:{
    additionalVerifiedExactArchivedBodyReceipts:EightReceipt[];
  };
}
export type EightStatus=
  |'verified_exact_archive_short_fragment_present'
  |'verified_exact_archive_short_fragment_absent'
  |'archive_redirect_unknown'
  |'archive_http_unknown'
  |'archive_mime_unknown'
  |'archive_bytes_too_large_unknown'
  |'archive_bytes_short_unknown'
  |'archive_index_sha1_mismatch_unknown'
  |'archive_previous_sha256_or_size_mismatch_unknown'
  |'archive_fetch_unknown';
export interface EightPhraseResult{
  cueId:string;sourceId:string;historicalCaptureUtc:string;
  namedSenatorSpeaker:string;
  originalUrl:string;archiveUrl:string;
  originalObservedSha256:string|null;
  previousVerifiedRawSha256:string;
  previousIndexedSha1Base32:string;
  previouslyPinnedOriginalBytes:number;
  verifiedOriginalRawBytesAgain:boolean;
  originalHtmlFragmentPresence:EightStatus;
  originalHtmlSpeakerNamePresentBeforeFragmentWithin600Characters:boolean|null;
  historicalOriginalAudioCompared:false;
  namedSenatorQuoteHumanApproved:false;
  firstPublisherPostingClockProven:false;
  anyMemberVoteVerified:false;
}
export interface EightReport{
  version:typeof EIGHT_HISTORICAL_VERSION;
  separatePinnedOriginalPublisherUrlsRequested:8;
  sha1AndSha256ReverifiedOriginalHtmlBodies:number;
  shortPhrasePresentInVerifiedOriginalHtml:number;
  shortPhraseAbsentFromVerifiedOriginalHtml:number;
  indexOrReplayFailuresUnknown:number;
  speakerNameNearbyPrior600VisibleCharacters:number;
  originalVersions:EightPhraseResult[];
  originalAudioCompared:false;
  namedSenatorHistoricalQuoteHumanApproved:0;
  firstPublisherPostingClockProofs:0;
  memberRecordedVotesVerified:0;
  noOriginalHtmlOrAudioPersisted:true;
  noPrivateEvidenceOrForecastRead:true;
  noStatewideArticlePopulationDenominator:true;
}
interface Trusted{cue:EightCue;lead:EightLead;capture:{
  captureUtc:string;indexSha1Base32:string;rawOriginalSha256:string;originalBytes:number;
};archiveUrl:string;}
function time(ts:string):string{
  if(!TIMES.test(ts)||!Number.isFinite(Date.parse(ts))
    ||new Date(ts).toISOString()!==ts.replace('Z','.000Z'))
    throw Error('Invalid archive capture time');
  return ts.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
}
function base32(bytes:Uint8Array):string{
  let out='',v=0,bits=0;
  for(const b of bytes){
    v=(v<<8)|b;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}
    v&=(1<<bits)-1;
  }
  if(bits)out+=B32[(v<<(5-bits))&31];
  return out;
}
export function validateEightOriginalTargets(q:EightQueue,leads:readonly EightLead[],
  pinned:EightHistoricManifest):Trusted[]{
  if(!q||q.version!=='senate-media-2021-25-eight-selected-authenticated-original-phrase-cues-v1'
    ||q.preparedOn!=='2026-10-11'
    ||q.sourceLedger!=='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json'
    ||q.sourceOriginalRawReceiptLedger!=='docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json'
    ||q.originalPublisherAudioNotChecked!==true
    ||q.noIndividualHistoricalQuotationHumanApproved!==true
    ||q.historicalCaptureCannotBackdateCurrentPublisherArticleUpdate!==true
    ||q.originalSenateVotesInferred!==false
    ||!Array.isArray(q.cues)||q.cues.length!==8||!Array.isArray(leads)
    ||pinned.version!=='senate-media-2021-25-broader-25-original-public-archive-receipts-v1')
    throw Error('Invalid original eight source evidence queue');
  const indexed=new Map<string,Trusted['capture']>();
  for(const group of [
    ...pinned.pinnedExactSha1AndRawSha256OriginalCaptureReceipts,
    ...pinned.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts,
  ]){
    for(const cap of [
      ...(group.verifiedOriginalHttpBodies??[]),
      ...(group.independentlyNewShaConsistentOriginalVersions??[]),
    ]){
      const key=group.leadId+'|'+cap.captureUtc;
      if(indexed.has(key))throw Error('Duplicate historical source body receipt');
      indexed.set(key,cap);
    }
  }
  const targets:Trusted[]=[];
  for(let i=0;i<TARGETS.length;i++){
    const qrow=q.cues[i],expected=TARGETS[i]!;
    if(!qrow||qrow.cueId!=='word-'+expected[0]
      ||qrow.originalLeadId!==expected[0]||qrow.namedSenatorSpeaker!==expected[1]
      ||qrow.historicalCaptureUtc!==expected[2]
      ||typeof qrow.currentPublisherShortFragment!=='string'
      ||qrow.currentPublisherShortFragment.length<28
      ||qrow.currentPublisherShortFragment.length>130
      ||qrow.currentPublisherShortFragment.split(/\s+/).length>18
      ||/[<>]|https?:\/\//.test(qrow.currentPublisherShortFragment)
      ||qrow.historicalOriginalBodyRecheckedByThisNewStudy!==false
      ||qrow.speakerLabelWithinArchivedBodyActuallyChecked!==false
      ||qrow.originalArticleSpokenAudioAuthenticated!==false
      ||qrow.individualSpeakerHumanApproved!==false
      ||qrow.recordedLegislativeVoteVerified!==false
      ||typeof qrow.reportingAttributionClass!=='string'
      ||!qrow.reportingAttributionClass.startsWith('own_publisher_')
      ||typeof qrow.datingQualification!=='string')
      throw Error('Misattributed or preapproved early historical source cue');
    const lead=leads.find(x=>x.id===expected[0]);
    if(!lead||lead.attributionCategory!=='individual'
      ||lead.publisher!=='Minnesota Senate DFL'
      ||lead.individuallyNamedSenatorSpeakers.length!==1
      ||lead.individuallyNamedSenatorSpeakers[0]?.name!==expected[1]
      ||!/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/
        .test(lead.individuallyNamedSenatorSpeakers[0]!.officialMemberHistoryUrl))
      throw Error('Speaker identity does not match independent senator service record');
    const uri=new URL(lead.url);
    if(uri.protocol!=='https:'||!HOSTS.has(uri.hostname)||uri.username
      ||uri.password||uri.search||uri.hash||uri.port||uri.toString()!==lead.url)
      throw Error('Untrusted original publisher network destination');
    const capture=indexed.get(expected[0]+'|'+expected[2]);
    if(!capture||!SHA1.test(capture.indexSha1Base32)
      ||!SHA256.test(capture.rawOriginalSha256)
      ||!Number.isSafeInteger(capture.originalBytes)
      ||capture.originalBytes<40||capture.originalBytes>SOURCE_MAX)
      throw Error('Exact original historical SHA certificate unavailable');
    targets.push({cue:qrow,lead,capture,archiveUrl:
      'https://web.archive.org/web/'+time(expected[2])+'id_/'+lead.url});
  }
  return targets;
}
async function bounded(r:Response):Promise<Uint8Array>{
  const size=r.headers.get('content-length');
  if(size!==null&&(!/^(0|[1-9]\d*)$/.test(size)
    ||!Number.isSafeInteger(Number(size))||Number(size)>SOURCE_MAX))
    throw Error('overlimit');
  if(!r.body)throw Error('short');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let len=0;
  while(true){
    const next=await reader.read();
    if(next.done)break;
    len+=next.value.byteLength;
    if(len>SOURCE_MAX){await reader.cancel().catch(()=>undefined);throw Error('overlimit');}
    parts.push(next.value);
  }
  if(len<40)throw Error('short');
  const all=new Uint8Array(len);let off=0;
  for(const chunk of parts){all.set(chunk,off);off+=chunk.byteLength;}
  return all;
}
async function readCue(t:Trusted,fetchImpl:typeof fetch):Promise<EightPhraseResult>{
  const fixed={
    cueId:t.cue.cueId,sourceId:t.cue.originalLeadId,
    historicalCaptureUtc:t.cue.historicalCaptureUtc,namedSenatorSpeaker:t.cue.namedSenatorSpeaker,
    originalUrl:t.lead.url,archiveUrl:t.archiveUrl,
    previousVerifiedRawSha256:t.capture.rawOriginalSha256,
    previousIndexedSha1Base32:t.capture.indexSha1Base32,
    previouslyPinnedOriginalBytes:t.capture.originalBytes,
    historicalOriginalAudioCompared:false as const,namedSenatorQuoteHumanApproved:false as const,
    firstPublisherPostingClockProven:false as const,anyMemberVoteVerified:false as const,
  };
  const unknown=(status:EightStatus):EightPhraseResult=>({
    ...fixed,originalObservedSha256:null,verifiedOriginalRawBytesAgain:false,
    originalHtmlFragmentPresence:status,
    originalHtmlSpeakerNamePresentBeforeFragmentWithin600Characters:null,
  });
  try{
    const r=await fetchImpl(t.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-early-archived-senator-remarks-only'},
    });
    if(r.status>=300&&r.status<400)return unknown('archive_redirect_unknown');
    if(r.status!==200)return unknown('archive_http_unknown');
    if((r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='text/html')
      return unknown('archive_mime_unknown');
    const bytes=await bounded(r);
    if(base32(createHash('sha1').update(bytes).digest())!==t.capture.indexSha1Base32)
      return unknown('archive_index_sha1_mismatch_unknown');
    const sha=createHash('sha256').update(bytes).digest('hex');
    if(sha!==t.capture.rawOriginalSha256||bytes.byteLength!==t.capture.originalBytes)
      return unknown('archive_previous_sha256_or_size_mismatch_unknown');
    const visible=approximatePublicHtmlText(new TextDecoder('utf-8',{fatal:false}).decode(bytes));
    const needle=approximatePublicHtmlText(t.cue.currentPublisherShortFragment);
    const pos=visible.indexOf(needle);
    const prior=pos<0?null:visible.slice(Math.max(0,pos-600),pos);
    const member=approximatePublicHtmlText(t.cue.namedSenatorSpeaker);
    return {...fixed,originalObservedSha256:sha,verifiedOriginalRawBytesAgain:true,
      originalHtmlFragmentPresence:pos>=0
        ?'verified_exact_archive_short_fragment_present'
        :'verified_exact_archive_short_fragment_absent',
      originalHtmlSpeakerNamePresentBeforeFragmentWithin600Characters:
        prior===null?false:prior.includes(member)};
  }catch(e){
    if(e instanceof Error&&e.message==='overlimit')
      return unknown('archive_bytes_too_large_unknown');
    if(e instanceof Error&&e.message==='short')
      return unknown('archive_bytes_short_unknown');
    return unknown('archive_fetch_unknown');
  }
}
export async function auditEightEarlyOriginalPhrases(
 q:EightQueue,leads:readonly EightLead[],receipt:EightHistoricManifest,
 fetchImpl:typeof fetch=fetch,
):Promise<EightReport>{
  const selected=validateEightOriginalTargets(q,leads,receipt);
  const out:Array<EightPhraseResult|undefined>=Array(selected.length);
  let index=0;
  async function worker(){
    while(index<selected.length){
      const at=index++;
      out[at]=await readCue(selected[at]!,fetchImpl);
    }
  }
  await Promise.all([worker(),worker()]);
  if(out.some(x=>!x))throw Error('Missing archived source audit outcome');
  const rows=out as EightPhraseResult[];
  return {
    version:EIGHT_HISTORICAL_VERSION,separatePinnedOriginalPublisherUrlsRequested:8,
    sha1AndSha256ReverifiedOriginalHtmlBodies:rows.filter(x=>x.verifiedOriginalRawBytesAgain).length,
    shortPhrasePresentInVerifiedOriginalHtml:rows.filter(x=>
      x.originalHtmlFragmentPresence==='verified_exact_archive_short_fragment_present').length,
    shortPhraseAbsentFromVerifiedOriginalHtml:rows.filter(x=>
      x.originalHtmlFragmentPresence==='verified_exact_archive_short_fragment_absent').length,
    indexOrReplayFailuresUnknown:rows.filter(x=>!x.verifiedOriginalRawBytesAgain).length,
    speakerNameNearbyPrior600VisibleCharacters:rows.filter(x=>
      x.originalHtmlSpeakerNamePresentBeforeFragmentWithin600Characters===true).length,
    originalVersions:rows,originalAudioCompared:false,
    namedSenatorHistoricalQuoteHumanApproved:0,firstPublisherPostingClockProofs:0,
    memberRecordedVotesVerified:0,noOriginalHtmlOrAudioPersisted:true,
    noPrivateEvidenceOrForecastRead:true,noStatewideArticlePopulationDenominator:true,
  };
}

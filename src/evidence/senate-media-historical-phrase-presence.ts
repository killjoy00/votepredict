/**
 * PUBLIC-ONLY #987. Download six EXACT previously CDX-SHA1-consistent original
 * archived HTTP article bodies, re-verify pinned SHA1 and SHA256, and look for
 * seven SHORT presently visible publisher phrase cues in approximate rendered
 * HTML text. No original page, original audio or surrounding text persisted.
 *
 * A textual cue is NOT individually authenticated senator speech, publisher
 * first-publication timing, original audio or a prediction feature.
 */
import {createHash} from 'node:crypto';

export const HISTORIC_MEDIA_PHRASE_VERSION='senate-media-historical-phrase-presence-v1' as const;
export const HISTORIC_MEDIA_HTML_MAX_BYTES=2_500_000;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SHA256=/^[a-f0-9]{64}$/;
const SHA1BASE32=/^[A-Z2-7]{32}$/;
const TIME=/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const PERMITTED_HOSTS=new Set([
  'www.mprnews.org','senatedfl.mn','www.mnsenaterepublicans.com',
]);
export interface HistoricPhraseCue {
  id:string;originalLeadId:string;archiveCapturedUtc:string;
  expectedRawBodySha256:string;expectedRawBodyBytes:number;
  indexedPayloadSha1Base32:string;currentPublisherShortPhraseCue:string;
  attributionMode:string;speakerLabel:string;
  individualHistoricSenatorQuotationHumanApproved:false;
  originalAudioHistoricallyAuthenticated:false;
  exactHistoricalFirstPublicationTimeProven:false;
}
export interface HistoricalOriginalLedgerLead{
  id:string;sourceUrl:string;
}
export interface HistoricalOriginalReceipt{
  leadId:string;verifiedCaptureReplays:Array<{
    archivedCaptureUtc:string;observedOriginalBodySha256:string;
    observedOriginalBodyBytes:number;indexedPayloadSha1Base32:string;
  }>;
}
export interface HistoricalReviewReceipts{
  matchedOriginalCaptureReceipts:HistoricalOriginalReceipt[];
  independentSecondLiveOriginalRecheck:{
    newlyVerifiedEarlierCapture:{
      leadId:string;archiveCapturedUtc:string;observedOriginalBodySha256:string;
      observedOriginalBodyBytes:number;indexedPayloadSha1Base32:string;
    };
  };
}
export type HistoricalHtmlCueStatus=
  |'verified_original_body_phrase_present'
  |'verified_original_body_phrase_not_found_in_markup'
  |'archive_redirect_refused_unknown'
  |'archive_non_200_unknown'
  |'archive_unexpected_mime_unknown'
  |'archive_too_short_unknown'
  |'archive_body_limit_unknown'
  |'archived_index_sha1_mismatch_unknown'
  |'previously_pinned_sha256_or_length_mismatch_unknown'
  |'archive_fetch_failed_unknown';
export interface HistoricalHtmlPhraseReceipt {
  cueId:string;originalLeadId:string;capturedAtUtc:string;
  observedOriginalBodySha256:string|null;
  observedOriginalBodyBytes:number|null;
  originalBodyReverifiedAgainstExactPriorReceipt:boolean;
  historicalMarkupCueStatus:HistoricalHtmlCueStatus;
  originalAudioCompared:false;
  individualSenatorQuotationHumanApproved:false;
  currentPublisherTextBackdatedToEarlierClock:false;
  anyPrivateOrVoteDataCompared:false;
}
export interface HistoricalHtmlPhraseReport {
  version:typeof HISTORIC_MEDIA_PHRASE_VERSION;
  exactDistinctArchivedHttpBodiesRequested:number;
  shortPhraseCuesTested:number;
  originalBodiesSha256Reverified:number;
  originalBodiesFailedOrUnresolved:number;
  cuesFoundInHashReverifiedHtmlText:number;
  cuesNotFoundInHashReverifiedHtmlText:number;
  cuesWithUnavailableOrUnverifiedOriginal:number;
  records:HistoricalHtmlPhraseReceipt[];
  senatorVoiceOrAudioIndependentlyAuthenticated:false;
  humanSenatorQuotationApprovals:0;
  noInitialPublisherChronologyProven:true;
  originalBytesOrSourceHtmlPersisted:false;
  noPrivateEvidenceOrRecordedVotesUsed:true;
  separateDiscoveryCohortNotHistoricalQuotedProof:true;
}
interface ValidCue{cue:HistoricPhraseCue;archiveUrl:string;}
function base32(data:Uint8Array):string{
  let value=0,bits=0,out='';
  for(const byte of data){
    value=(value<<8)|byte;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(value>>>bits)&31];}
    value&=(1<<bits)-1;
  }
  if(bits)out+=B32[(value<<(5-bits))&31];
  return out;
}
function validateClock(captured:string):string{
  if(!TIME.test(captured))throw Error('Invalid historical UTC capture');
  const ms=Date.parse(captured);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==captured.replace('Z','.000Z'))
    throw Error('Impossible historical UTC');
  return captured.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
}
export function validatePinnedHistoricPhraseCues(
  cues:readonly HistoricPhraseCue[],
  originalLeads:readonly HistoricalOriginalLedgerLead[],
  originalReceipt:HistoricalReviewReceipts,
):ValidCue[]{
  if(!Array.isArray(cues)||cues.length!==7||!Array.isArray(originalLeads)
    ||!Array.isArray(originalReceipt?.matchedOriginalCaptureReceipts))
    throw Error('Invalid seven-cue original public history research cohort');
  const receipt=new Map<string,{
    archivedCaptureUtc:string;observedOriginalBodySha256:string;
    observedOriginalBodyBytes:number;indexedPayloadSha1Base32:string;
  }>();
  for(const item of originalReceipt.matchedOriginalCaptureReceipts)
    for(const capture of item.verifiedCaptureReplays){
      const key=item.leadId+'|'+capture.archivedCaptureUtc;
      if(receipt.has(key))throw Error('Duplicate original archive receipt');
      receipt.set(key,capture);
    }
  const second=originalReceipt.independentSecondLiveOriginalRecheck?.newlyVerifiedEarlierCapture;
  if(!second)throw Error('Second original archived body verification unavailable');
  const secondKey=second.leadId+'|'+second.archiveCapturedUtc;
  if(receipt.has(secondKey))throw Error('Second recheck duplicates existing original');
  receipt.set(secondKey,{archivedCaptureUtc:second.archiveCapturedUtc,
    observedOriginalBodySha256:second.observedOriginalBodySha256,
    observedOriginalBodyBytes:second.observedOriginalBodyBytes,
    indexedPayloadSha1Base32:second.indexedPayloadSha1Base32});
  const ids=new Set<string>();
  const validated:ValidCue[]=[];
  for(const cue of cues){
    if(!cue||typeof cue.id!=='string'||!/^[-a-z0-9]{12,90}$/.test(cue.id)
      ||ids.has(cue.id)||typeof cue.originalLeadId!=='string'
      ||!SHA256.test(cue.expectedRawBodySha256)
      ||!SHA1BASE32.test(cue.indexedPayloadSha1Base32)
      ||!Number.isSafeInteger(cue.expectedRawBodyBytes)
      ||cue.expectedRawBodyBytes<40||cue.expectedRawBodyBytes>HISTORIC_MEDIA_HTML_MAX_BYTES
      ||typeof cue.currentPublisherShortPhraseCue!=='string'
      ||cue.currentPublisherShortPhraseCue.length<28
      ||cue.currentPublisherShortPhraseCue.length>170
      ||!Array.isArray(cue.currentPublisherShortPhraseCue.match(/\S+/g))
      ||(cue.currentPublisherShortPhraseCue.match(/\S+/g)??[]).length>27
      ||/[<>]|https?:\/\//i.test(cue.currentPublisherShortPhraseCue)
      ||!['reporter_attributed_miller',
        'secondhand_marty_description_of_miller_interview_not_original_audio',
        'named_senator_caucus_quotation','collective_caucus_unassigned_to_individual']
        .includes(cue.attributionMode)
      ||typeof cue.speakerLabel!=='string'
      ||cue.individualHistoricSenatorQuotationHumanApproved!==false
      ||cue.originalAudioHistoricallyAuthenticated!==false
      ||cue.exactHistoricalFirstPublicationTimeProven!==false)
      throw Error('Untrusted short quote cue, attribution, or inappropriate historical approval');
    ids.add(cue.id);
    const timestamp=validateClock(cue.archiveCapturedUtc);
    const original=originalLeads.find(x=>x.id===cue.originalLeadId);
    if(!original || typeof original.sourceUrl!=='string')throw Error('Unknown original lead');
    const u=new URL(original.sourceUrl);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash
      ||!PERMITTED_HOSTS.has(u.hostname)||u.toString()!==original.sourceUrl)
      throw Error('Untrusted original publisher URL');
    const prior=receipt.get(cue.originalLeadId+'|'+cue.archiveCapturedUtc);
    if(!prior
      ||prior.observedOriginalBodySha256!==cue.expectedRawBodySha256
      ||prior.observedOriginalBodyBytes!==cue.expectedRawBodyBytes
      ||prior.indexedPayloadSha1Base32!==cue.indexedPayloadSha1Base32)
      throw Error('Attempted original phrase review without exact previous archive hash receipt');
    if(cue.attributionMode==='collective_caucus_unassigned_to_individual'
      &&(cue.speakerLabel!=='NO_INDIVIDUAL_SPEAKER'
        ||cue.originalLeadId!=='caucus-2023-poci-joint-policing'))
      throw Error('Attributing collective quote to an individual');
    if(cue.attributionMode==='secondhand_marty_description_of_miller_interview_not_original_audio'
      &&cue.originalLeadId!=='mpr-2021-miller-hero-pay-interview')
      throw Error('Secondhand Miller excerpt cross-source mixup');
    validated.push({cue,archiveUrl:
      'https://web.archive.org/web/'+timestamp+'id_/'+original.sourceUrl});
  }
  if(validated.filter(x=>x.cue.attributionMode==='collective_caucus_unassigned_to_individual').length!==1
    ||validated.filter(x=>x.cue.attributionMode==='secondhand_marty_description_of_miller_interview_not_original_audio').length!==1
    ||new Set(validated.map(x=>x.archiveUrl)).size!==6)
    throw Error('Incorrect original evidence review targets');
  return validated;
}
async function boundedBody(r:Response):Promise<Uint8Array>{
  const length=r.headers.get('content-length');
  if(length!==null&&(!/^(0|[1-9]\d*)$/.test(length)
    ||!Number.isSafeInteger(Number(length))||Number(length)>HISTORIC_MEDIA_HTML_MAX_BYTES))
    throw Error('body_size_limit');
  if(!r.body)throw Error('body_empty');
  const reader=r.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  while(true){
    const part=await reader.read();
    if(part.done)break;
    size+=part.value.length;
    if(size>HISTORIC_MEDIA_HTML_MAX_BYTES){
      await reader.cancel().catch(()=>undefined);
      throw Error('body_size_limit');
    }
    chunks.push(part.value);
  }
  if(size<40)throw Error('body_short');
  const result=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
  return result;
}
const namedEntities:Record<string,string>={
  amp:'&',quot:'"',apos:"'",nbsp:' ',ldquo:'"',rdquo:'"',
  lsquo:"'",rsquo:"'",ndash:'-',mdash:'-',hellip:'...',lt:'<',gt:'>',
};
function decodeEntities(text:string):string{
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g,(whole,key:string)=>{
    if(key[0]!=='#')return namedEntities[key.toLowerCase()]??whole;
    const cp=key[1]?.toLowerCase()==='x'
      ?Number.parseInt(key.slice(2),16):Number.parseInt(key.slice(1),10);
    return Number.isSafeInteger(cp)&&cp>=0&&cp<=0x10ffff
      ?String.fromCodePoint(cp):whole;
  });
}
function normalized(text:string):string{
  return decodeEntities(text).normalize('NFKC')
    .replace(/[\u2018\u2019\u02bc]/g,"'")
    .replace(/[\u201c\u201d]/g,'"')
    .replace(/[\u2013\u2014]/g,'-')
    .replace(/[\u00a0\u200b]/g,' ')
    .replace(/\s+/g,' ').trim().toLocaleLowerCase('en-US');
}
/**
 * Deliberately simple text-of-markup approximation. Scripts, metadata, CSS,
 * comments, navigation templates are not original article quotation evidence.
 * A positive cue is still NOT speaker verification or proof it was spoken.
 */
export function approximatePublicHtmlText(body:string):string{
  const notContent=body
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|template|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ');
  return normalized(notContent);
}
function output(cue:HistoricPhraseCue,status:HistoricalHtmlCueStatus,
  bodySha:string|null=null,bytes:number|null=null):HistoricalHtmlPhraseReceipt{
  return {
    cueId:cue.id,originalLeadId:cue.originalLeadId,capturedAtUtc:cue.archiveCapturedUtc,
    observedOriginalBodySha256:bodySha,observedOriginalBodyBytes:bytes,
    originalBodyReverifiedAgainstExactPriorReceipt:status.startsWith('verified_original_body_'),
    historicalMarkupCueStatus:status,
    originalAudioCompared:false,individualSenatorQuotationHumanApproved:false,
    currentPublisherTextBackdatedToEarlierClock:false,anyPrivateOrVoteDataCompared:false,
  };
}
async function examine(record:ValidCue,fetchImpl:typeof fetch):Promise<{
  status:HistoricalHtmlCueStatus;sha:string|null;bytes:number|null;text:string|null;
}>{
  try{
    const response=await fetchImpl(record.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-historical-senate-media-phrase-research'},
    });
    if(response.status>=300&&response.status<400)
      return {status:'archive_redirect_refused_unknown',sha:null,bytes:null,text:null};
    if(response.status!==200)
      return {status:'archive_non_200_unknown',sha:null,bytes:null,text:null};
    const mime=(response.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase();
    if(mime!=='text/html'&&mime!=='application/xhtml+xml')
      return {status:'archive_unexpected_mime_unknown',sha:null,bytes:null,text:null};
    const bytes=await boundedBody(response);
    const payloadSha1=base32(createHash('sha1').update(bytes).digest());
    if(payloadSha1!==record.cue.indexedPayloadSha1Base32)
      return {status:'archived_index_sha1_mismatch_unknown',sha:null,bytes:null,text:null};
    const sha=createHash('sha256').update(bytes).digest('hex');
    if(sha!==record.cue.expectedRawBodySha256
      ||bytes.length!==record.cue.expectedRawBodyBytes)
      return {status:'previously_pinned_sha256_or_length_mismatch_unknown',sha:null,bytes:null,text:null};
    const html=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    return {status:'verified_original_body_phrase_not_found_in_markup',
      sha,bytes:bytes.length,text:approximatePublicHtmlText(html)};
  }catch(e){
    if(e instanceof Error &&e.message==='body_size_limit')
      return {status:'archive_body_limit_unknown',sha:null,bytes:null,text:null};
    if(e instanceof Error &&['body_empty','body_short'].includes(e.message))
      return {status:'archive_too_short_unknown',sha:null,bytes:null,text:null};
    return {status:'archive_fetch_failed_unknown',sha:null,bytes:null,text:null};
  }
}
export async function auditHistoricalMediaPhraseCues(
  cues:readonly HistoricPhraseCue[],
  leadRows:readonly HistoricalOriginalLedgerLead[],
  prior:HistoricalReviewReceipts,
  fetchImpl:typeof fetch=fetch,
):Promise<HistoricalHtmlPhraseReport>{
  const checked=validatePinnedHistoricPhraseCues(cues,leadRows,prior);
  const byUrl=new Map<string,ValidCue[]>();
  for(const c of checked)byUrl.set(c.archiveUrl,[...(byUrl.get(c.archiveUrl)??[]),c]);
  const urls=[...byUrl.keys()];
  const outcomes=new Map<string,ReturnType<typeof output>>();
  let next=0;
  async function worker(){
    while(next<urls.length){
      const url=urls[next++]!;
      const list=byUrl.get(url)!;
      const original=await examine(list[0]!,fetchImpl);
      for(const {cue} of list){
        let status=original.status;
        if(original.text!==null)
          status=original.text.includes(normalized(cue.currentPublisherShortPhraseCue))
            ?'verified_original_body_phrase_present'
            :'verified_original_body_phrase_not_found_in_markup';
        outcomes.set(cue.id,output(cue,status,original.sha,original.bytes));
      }
    }
  }
  await Promise.all([worker(),worker()]);
  const records=checked.map(x=>{
    const receipt=outcomes.get(x.cue.id);
    if(!receipt)throw Error('Original phrase research incomplete');
    return receipt;
  });
  const reverified=new Set(
    records.filter(x=>x.originalBodyReverifiedAgainstExactPriorReceipt)
      .map(x=>x.originalLeadId+'|'+x.capturedAtUtc));
  return {
    version:HISTORIC_MEDIA_PHRASE_VERSION,
    exactDistinctArchivedHttpBodiesRequested:urls.length,
    shortPhraseCuesTested:records.length,
    originalBodiesSha256Reverified:reverified.size,
    originalBodiesFailedOrUnresolved:urls.length-reverified.size,
    cuesFoundInHashReverifiedHtmlText:records.filter(x=>
      x.historicalMarkupCueStatus==='verified_original_body_phrase_present').length,
    cuesNotFoundInHashReverifiedHtmlText:records.filter(x=>
      x.historicalMarkupCueStatus==='verified_original_body_phrase_not_found_in_markup').length,
    cuesWithUnavailableOrUnverifiedOriginal:records.filter(x=>
      !x.originalBodyReverifiedAgainstExactPriorReceipt).length,
    records,
    senatorVoiceOrAudioIndependentlyAuthenticated:false,humanSenatorQuotationApprovals:0,
    noInitialPublisherChronologyProven:true,originalBytesOrSourceHtmlPersisted:false,
    noPrivateEvidenceOrRecordedVotesUsed:true,separateDiscoveryCohortNotHistoricalQuotedProof:true,
  };
}

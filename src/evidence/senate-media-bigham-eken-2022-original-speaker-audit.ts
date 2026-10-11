/**
 * #987 PUBLIC only. Two individually named senator quotation cues in ONE
 * 2022 Minnesota Senate DFL source, against two CDX SHA-pinned original bodies.
 *
 * Identical original page presence and same-paragraph current publisher
 * attribution are NOT first publisher posting proof, original audio, verified
 * human quote approval, or a recorded member vote.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';

export const BIGHAM_EKEN_ORIGINAL_VERSION='bigham-eken-2022-separate-speaker-original-markup-v1' as const;
export const BIGHAM_EKEN_MAX_ORIGINAL_BODY_BYTES=2_500_000;
const ORIGINAL_URL='https://senatedfl.mn/senators-karla-bigham-and-kent-eken-named-senate-dfl-whips-for-2022-legislative-session/';
const SOURCE_ID='public-2022-bigham-eken-separated';
const EXACT_TIMES=['2022-03-11T19:51:03Z','2022-06-29T12:45:13Z'] as const;
const EXPECTED=[
 {id:'bigham-2022-whip-individual-statement',speaker:'Karla Bigham',
  memberUrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=15281',
  fragment:'I look forward to using this position',
  label:'said Senator Karla Bigham'},
 {id:'eken-2022-whip-individual-statement',speaker:'Kent Eken',
  memberUrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID=10764',
  fragment:'As a lifelong resident of Western Minnesota',
  label:'said Senator Kent Eken'},
] as const;
const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SHA1=/^[A-Z2-7]{32}$/;
const SHA256=/^[a-f0-9]{64}$/;
export interface TwoSpeakerCue {
  id:string;speaker:string;officialSenateService:string;
  shortOriginalPublisherTextCue:string;currentPublisherAttribution:string;
  originalSpokenRecordingAuthenticated:false;senatorQuotedWordsHumanApproved:false;
}
export interface TwoSpeakerQueue{
  version:string;originalLeadId:string;originalSourceUrl:string;
  originalPublisher:string;publisherDisplayedDay:string;
  originalFirstPostingClockVerified:false;
  exactArchiveUtcVersions:string[];
  twoIndividualsInOnePublisherArticle:true;
  independentOriginalAudioCompared:false;
  originalBodyShaProofManifest:string;sourceDiscoveryLedger:string;
  cues:TwoSpeakerCue[];
  historicalSourceNotARecordedVote:true;
  twoOriginalPageVersionsDoNotProveDisplayedFirstPublishClock:true;
  noPrivateSourceDatabaseOrOriginalAudioUsed:true;
}
export interface TwoSpeakerLedger{
  id:string;url:string;publisher:string;attributionCategory:string;
  individuallyNamedSenatorSpeakers:{name:string;officialMemberHistoryUrl:string}[];
}
export interface TwoSpeakerRawPin{
  captureUtc:string;indexSha1Base32:string;rawOriginalSha256:string;originalBytes:number;
}
export interface TwoSpeakerFirstAndSecondRun{
  version:string;
  independentSecondPublicRun:{
    runId:number;additionalVerifiedExactArchivedBodyReceipts:{
      leadId:string;independentlyNewShaConsistentOriginalVersions:TwoSpeakerRawPin[];
    }[];
  };
}
export type TwoSpeakerArchiveStatus=
 |'verified_exact_index_sha1_and_raw_sha256'
 |'archive_redirect_refused'
 |'archive_http_denied'
 |'archive_content_type_untrusted'
 |'archive_body_too_large'
 |'archive_body_too_short'
 |'archive_index_sha1_mismatch'
 |'archive_prior_raw_sha256_or_size_mismatch'
 |'archive_fetch_error';
export interface TwoSpeakerShortPhraseStatus{
 id:string;speaker:string;
 presentInRawShaVerifiedHistoricalMarkup:boolean|null;
 sameParagraphHasThisSpeakerLabel:boolean|null;
 otherSpeakerTurnNotAssignedToThisSenator:true;
 originalSpeakerAudioNotAuthenticated:true;
 historicalIndividualQuoteHumanApproved:false;
 senatorRecordedVoteInferred:false;
}
export interface TwoSpeakerOriginalResult{
 originalSourceUrl:string;originalArchiveUtc:string;
 archiveUrl:string;indexSha1Base32:string;expectedRawSha256:string;
 exactRawArchiveBodySha256Observed:string|null;observedOriginalBytes:number|null;
 status:TwoSpeakerArchiveStatus;
 cues:TwoSpeakerShortPhraseStatus[];
 firstPublisherPublicByClockAuthenticated:false;
 individuallySpokenAudioAuthenticated:false;
 originalQuoteHumanApproved:false;
}
export interface TwoSpeakerStudy{
 version:typeof BIGHAM_EKEN_ORIGINAL_VERSION;
 source:'2022_first_party_senate_dfl_two_separately_named_individuals_in_one_article';
 originalPublisherPageCount:1;
 servingSenatorSpeakerCandidates:2;
 rawArchivedOriginalVersionsRequested:2;
 rawOriginalVersionsSha1AndSha256Reverified:number;
 originalVersionsUnverified:number;
 fourHistoricalHtmlShortPhraseChecks:4;
 historicMarkupShortPhraseFound:number;
 historicMarkupShortPhraseAbsent:number;
 historicMarkupUnknown:number;
 sameParagraphCorrectSpeakerLabelCues:number;
 originalVersions:TwoSpeakerOriginalResult[];
 originalAudioCompared:false;
 historicalIndividualSenatorQuotationsHumanApproved:0;
 originalFirstPublicPostingClockProven:false;
 actualRecordedMemberVotesEstablished:0;
 noOriginalHtmlOrAudioPersisted:true;
 noPrivateSourceDatabaseOrForecastUsed:true;
}
interface Target{captureUtc:string;archiveUrl:string;pin:TwoSpeakerRawPin;}
function compactCaptureUtc(day:string):string{
  if(!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(day)
    ||!Number.isFinite(Date.parse(day))
    ||new Date(day).toISOString()!==day.replace('Z','.000Z'))
    throw Error('Invalid exact archived capture time');
  return day.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
}
function b32(data:Uint8Array):string{
  let buf=0,bits=0,out='';
  for(const byte of data){
    buf=(buf<<8)|byte;bits+=8;
    while(bits>=5){bits-=5;out+=BASE32[(buf>>>bits)&31];}
    buf&=(1<<bits)-1;
  }
  if(bits)out+=BASE32[(buf<<(5-bits))&31];
  return out;
}
export function validateTwoSpeakerExactArchive(
 queue:TwoSpeakerQueue,leads:readonly TwoSpeakerLedger[],prior:TwoSpeakerFirstAndSecondRun,
):{cues:TwoSpeakerCue[];targets:Target[]}{
  if(!queue||queue.version!=='senate-media-2022-bigham-eken-original-archived-two-speakers-v1'
    ||queue.originalLeadId!==SOURCE_ID||queue.originalSourceUrl!==ORIGINAL_URL
    ||queue.originalPublisher!=='Minnesota Senate DFL'
    ||queue.publisherDisplayedDay!=='2022-01-31'
    ||queue.originalFirstPostingClockVerified!==false
    ||queue.twoIndividualsInOnePublisherArticle!==true
    ||queue.independentOriginalAudioCompared!==false
    ||queue.originalBodyShaProofManifest!=='docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json'
    ||queue.sourceDiscoveryLedger!=='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json'
    ||queue.historicalSourceNotARecordedVote!==true
    ||queue.twoOriginalPageVersionsDoNotProveDisplayedFirstPublishClock!==true
    ||queue.noPrivateSourceDatabaseOrOriginalAudioUsed!==true
    ||JSON.stringify(queue.exactArchiveUtcVersions)!==JSON.stringify(EXACT_TIMES)
    ||!Array.isArray(queue.cues)||queue.cues.length!==2)
    throw Error('Invalid original 2022 dual senator quote research queue');
  for(let i=0;i<EXPECTED.length;i++){
    const e=EXPECTED[i]!,q=queue.cues[i];
    if(!q||q.id!==e.id||q.speaker!==e.speaker
      ||q.officialSenateService!==e.memberUrl
      ||q.shortOriginalPublisherTextCue!==e.fragment
      ||q.currentPublisherAttribution!==e.label
      ||q.originalSpokenRecordingAuthenticated!==false
      ||q.senatorQuotedWordsHumanApproved!==false)
      throw Error('Unknown speaker or misassigned original publisher quote fragment');
  }
  const original=leads.find(x=>x.id===SOURCE_ID);
  if(!original||original.url!==ORIGINAL_URL
    ||original.publisher!=='Minnesota Senate DFL'
    ||original.attributionCategory!=='two_labeled_individuals'
    ||original.individuallyNamedSenatorSpeakers.length!==2
    ||original.individuallyNamedSenatorSpeakers.some((x,i)=>
      x.name!==EXPECTED[i]?.speaker||x.officialMemberHistoryUrl!==EXPECTED[i]?.memberUrl))
    throw Error('Wrong source or historic senator serving-membership attribution');
  if(prior.version!=='senate-media-2021-25-broader-25-original-public-archive-receipts-v1'
    ||prior.independentSecondPublicRun?.runId!==38160362555)
    throw Error('Expected independently downloaded second historical original-URL research run');
  const row=prior.independentSecondPublicRun.additionalVerifiedExactArchivedBodyReceipts.find(
    x=>x.leadId===SOURCE_ID);
  if(!row||row.independentlyNewShaConsistentOriginalVersions.length!==2)
    throw Error('No two authenticated historical original Bigham and Eken URL captures');
  const targets:Target[]=[];
  for(const date of EXACT_TIMES){
    const p=row.independentlyNewShaConsistentOriginalVersions.find(x=>x.captureUtc===date);
    if(!p||!SHA1.test(p.indexSha1Base32)||!SHA256.test(p.rawOriginalSha256)
      ||!Number.isSafeInteger(p.originalBytes)||p.originalBytes<40
      ||p.originalBytes>BIGHAM_EKEN_MAX_ORIGINAL_BODY_BYTES)
      throw Error('Original Bigham/Eken history SHA receipt missing or invalid');
    targets.push({captureUtc:date,pin:p,
      archiveUrl:'https://web.archive.org/web/'+compactCaptureUtc(date)+'id_/'+ORIGINAL_URL});
  }
  return {cues:[...queue.cues],targets};
}
async function bounded(response:Response):Promise<Uint8Array>{
  const header=response.headers.get('content-length');
  if(header!==null&&(!/^(0|[1-9]\d*)$/.test(header)
    ||!Number.isSafeInteger(Number(header))
    ||Number(header)>BIGHAM_EKEN_MAX_ORIGINAL_BODY_BYTES))
    throw Error('body_size_limit');
  if(!response.body)throw Error('body_too_short');
  const parts:Uint8Array[]=[],reader=response.body.getReader();
  let length=0;
  while(true){
    const p=await reader.read();
    if(p.done)break;
    length+=p.value.byteLength;
    if(length>BIGHAM_EKEN_MAX_ORIGINAL_BODY_BYTES){
      await reader.cancel().catch(()=>undefined);
      throw Error('body_size_limit');
    }
    parts.push(p.value);
  }
  if(length<40)throw Error('body_too_short');
  const raw=new Uint8Array(length);let at=0;
  for(const p of parts){raw.set(p,at);at+=p.byteLength;}
  return raw;
}
function speakerSameParagraph(html:string,phrase:string,label:string):boolean{
  const p=html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)??[];
  const n=approximatePublicHtmlText(phrase);
  const speakerName=approximatePublicHtmlText(label);
  return p.some(x=>{
    const t=approximatePublicHtmlText(x);
    return t.includes(n)&&t.includes(speakerName);
  });
}
function unavailable(c:TwoSpeakerCue):TwoSpeakerShortPhraseStatus{
  return {id:c.id,speaker:c.speaker,presentInRawShaVerifiedHistoricalMarkup:null,
    sameParagraphHasThisSpeakerLabel:null,otherSpeakerTurnNotAssignedToThisSenator:true,
    originalSpeakerAudioNotAuthenticated:true,
    historicalIndividualQuoteHumanApproved:false,senatorRecordedVoteInferred:false};
}
async function replay(t:Target,cues:TwoSpeakerCue[],fetchImpl:typeof fetch):Promise<TwoSpeakerOriginalResult>{
  const known={
    originalSourceUrl:ORIGINAL_URL,originalArchiveUtc:t.captureUtc,archiveUrl:t.archiveUrl,
    indexSha1Base32:t.pin.indexSha1Base32,
    expectedRawSha256:t.pin.rawOriginalSha256,
    firstPublisherPublicByClockAuthenticated:false as const,
    individuallySpokenAudioAuthenticated:false as const,
    originalQuoteHumanApproved:false as const,
  };
  const unresolved=(status:TwoSpeakerArchiveStatus):TwoSpeakerOriginalResult=>({
    ...known,status,exactRawArchiveBodySha256Observed:null,observedOriginalBytes:null,
    cues:cues.map(unavailable),
  });
  try{
    const r=await fetchImpl(t.archiveUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
      headers:{accept:'text/html','accept-encoding':'identity',
        'user-agent':'VotePredict/2.0 public-two-senator-archived-caucus-quote-research'},
    });
    if(r.status>=300&&r.status<400)return unresolved('archive_redirect_refused');
    if(r.status!==200)return unresolved('archive_http_denied');
    if((r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='text/html')
      return unresolved('archive_content_type_untrusted');
    const body=await bounded(r);
    if(b32(createHash('sha1').update(body).digest())!==t.pin.indexSha1Base32)
      return unresolved('archive_index_sha1_mismatch');
    const sha=createHash('sha256').update(body).digest('hex');
    if(sha!==t.pin.rawOriginalSha256||body.byteLength!==t.pin.originalBytes)
      return unresolved('archive_prior_raw_sha256_or_size_mismatch');
    const html=new TextDecoder('utf-8',{fatal:false}).decode(body);
    const rendered=approximatePublicHtmlText(html);
    return {...known,status:'verified_exact_index_sha1_and_raw_sha256',
      exactRawArchiveBodySha256Observed:sha,observedOriginalBytes:body.byteLength,
      cues:cues.map(c=>{
        const matched=rendered.includes(approximatePublicHtmlText(c.shortOriginalPublisherTextCue));
        return {id:c.id,speaker:c.speaker,
          presentInRawShaVerifiedHistoricalMarkup:matched,
          sameParagraphHasThisSpeakerLabel:matched?
            speakerSameParagraph(html,c.shortOriginalPublisherTextCue,c.currentPublisherAttribution):false,
          otherSpeakerTurnNotAssignedToThisSenator:true,
          originalSpeakerAudioNotAuthenticated:true,
          historicalIndividualQuoteHumanApproved:false,senatorRecordedVoteInferred:false,
        };
      }),
    };
  }catch(e){
    if(e instanceof Error&&e.message==='body_size_limit')
      return unresolved('archive_body_too_large');
    if(e instanceof Error&&e.message==='body_too_short')
      return unresolved('archive_body_too_short');
    return unresolved('archive_fetch_error');
  }
}
export async function auditTwoSpeakerHistoricalMarkup(
 queue:TwoSpeakerQueue,leads:readonly TwoSpeakerLedger[],prior:TwoSpeakerFirstAndSecondRun,
 fetchImpl:typeof fetch=fetch,
):Promise<TwoSpeakerStudy>{
  const source=validateTwoSpeakerExactArchive(queue,leads,prior);
  const originals=await Promise.all(source.targets.map(t=>replay(t,source.cues,fetchImpl)));
  const cues=originals.flatMap(x=>x.cues);
  const hits=cues.filter(x=>x.presentInRawShaVerifiedHistoricalMarkup===true).length;
  const missing=cues.filter(x=>x.presentInRawShaVerifiedHistoricalMarkup===false).length;
  return {
    version:BIGHAM_EKEN_ORIGINAL_VERSION,
    source:'2022_first_party_senate_dfl_two_separately_named_individuals_in_one_article',
    originalPublisherPageCount:1,servingSenatorSpeakerCandidates:2,
    rawArchivedOriginalVersionsRequested:2,
    rawOriginalVersionsSha1AndSha256Reverified:originals.filter(x=>
      x.status==='verified_exact_index_sha1_and_raw_sha256').length,
    originalVersionsUnverified:originals.filter(x=>
      x.status!=='verified_exact_index_sha1_and_raw_sha256').length,
    fourHistoricalHtmlShortPhraseChecks:4,
    historicMarkupShortPhraseFound:hits,
    historicMarkupShortPhraseAbsent:missing,
    historicMarkupUnknown:cues.length-hits-missing,
    sameParagraphCorrectSpeakerLabelCues:cues.filter(x=>x.sameParagraphHasThisSpeakerLabel===true).length,
    originalVersions:originals,originalAudioCompared:false,
    historicalIndividualSenatorQuotationsHumanApproved:0,
    originalFirstPublicPostingClockProven:false,actualRecordedMemberVotesEstablished:0,
    noOriginalHtmlOrAudioPersisted:true,noPrivateSourceDatabaseOrForecastUsed:true,
  };
}

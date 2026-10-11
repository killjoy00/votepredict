/**
 * #987 PUBLIC exact historical ORIGINAL reported state senator quotes.
 * Completes SHORT text fragment review of the seven independent reporter
 * article URLs not covered by prior two-article and three-article studies.
 * Indexed original raw SHA1 and previously pinned raw SHA256 + byte length
 * MUST ALL agree before any short historical visible HTML phrase is counted.
 * NEVER saves article source HTML/audio, approves an individual utterance or
 * treats a reporter's description of legislative voting as member roll call.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';

export const SEVEN_REPORTER_ORIGINAL_VERSION='senate-media-seven-independently-original-reporter-senator-short-cues-v1' as const;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const S1=/^[A-Z2-7]{32}$/;
const S256=/^[a-f0-9]{64}$/;
const MAX_ORIGINAL_BYTES=2_500_000;
const EXACT=[
  {id:'new-reporter-2021-line3',name:'Mary Kunesh',
    clock:['2021-08-26T13:52:12Z','2021-09-18T09:55:47Z']},
  {id:'new-reporter-2022-ethics',name:'David Osmek',
    clock:['2022-06-15T21:52:00Z','2022-06-15T22:25:14Z']},
  {id:'new-reporter-2023-license-rally',name:'Zaynab Mohamed',
    clock:['2023-01-04T01:59:08Z','2023-01-04T02:05:29Z']},
  {id:'new-reporter-2023-family-leave',name:'Alice Mann',
    clock:['2023-01-06T13:57:07Z','2023-01-07T01:20:15Z']},
  {id:'new-reporter-2023-rideshare-floor',name:'Omar Fateh',
    clock:['2023-05-22T07:10:00Z','2023-05-23T11:37:54Z']},
  {id:'new-reporter-2024-session-opening',name:'Erin Murphy',
    clock:['2024-02-12T22:42:53Z','2024-02-12T22:51:02Z']},
  {id:'new-reporter-2025-solar',name:'Nick Frentz',
    clock:['2025-06-30T13:15:32Z','2025-06-30T13:51:00Z']},
] as const;
type Status='exact_original_raw_sha1_and_pinned_sha256_verified'
  |'archive_redirect_unknown'|'archive_status_unknown'
  |'archive_unexpected_mime_unknown'
  |'archive_too_short_unknown'|'archive_too_large_unknown'
  |'archive_original_indexed_sha1_mismatch_unknown'
  |'archive_previous_sha256_or_bytes_mismatch_unknown'
  |'archive_fetch_unknown';
export interface OriginalSevenCue{
 id:string;speakingSenator:string;currentReporterOriginalShortTextFragment:string;
 currentPublisherHasNamedReporterAttribution:true;
 fullSpokenAudioCompared:false;quoteHumanApproved:false;
 independentlyRecordedMemberVoteVerified:false;
}
export interface SevenSourceTarget{
 originalLeadId:string;expectedNamedServingSenatorSpeaker:string;
 historicalOriginalCaptureUtcs:string[];originalCurrentPublisherReporterSpeechType:string;
 attributionExclusionCaveat:string;cueFragments:OriginalSevenCue[];
}
export interface SevenOriginalQueue{
 version:string;preparedOn:string;originalArticlesLedger:string;
 indexedAndPreviouslyVerifiedOriginalBodyManifest:string;
 selectedSourceArticleUrls:7;actualHistoricalBodyVersionsPreviouslySha1Sha256Pinned:14;
 individuallyNamedServingStateSenatorSpeakerCandidates:7;
 shortIndividuallyPublisherAttributedTextFragmentCues:14;
 historicShortPhraseChecksAcrossTwoOriginalVersionsEach:28;
 originalSpeakerRecordedAudioAuthenticated:false;
 originalFullQuotationHumanApproved:false;
 independentlyAuthenticatedRecordedCommitteeOrFloorVote:false;
 originalPublisherInitialPostClockProven:false;
 noPrivateVotePredictDataOrModelCodeRead:true;
 remainderOfTwelveHistoricallyOriginalVerifiedNewsArticleUrlCohort:true;
 sourceArticles:SevenSourceTarget[];
}
export interface IndependentSourceLead{
 id:string;originalPublisherUrl:string;originalPublisher:string;
 namedSenatorSpeakerTurnCandidates:Array<{
  name:string;officialMemberServiceUrl:string;reporterAttributionMode:string;
  historicalRecordedIndividualQuoteApproved:false;
 }>;
}
export interface PublicOriginalCapture{
 captureUtc:string;indexSha1Base32:string;rawOriginalBodySha256:string;originalBytes:number;
}
export interface EarlierIndependentReporterReceipt{
 version:string;
 originalSourceBodies:Array<{leadId:string;rawSha1ConsistentOriginalHttpCaptures:PublicOriginalCapture[]}>;
 independentFinalPublicRun:{newExactHistoricalOriginalReceipts:Array<{
  leadId:string;captureUtc:string;indexSha1Base32:string;
  rawOriginalBodySha256:string;originalBytes:number;
 }>};
}
export interface NamedHistoricalReporterCue {
 sourceCueId:string;namedServingSenator:string;
 shortPhraseInVerifiedHistoricalOriginalHtml:boolean|null;
 fullNameFoundInSameHistoricalHtmlParagraph:boolean|null;
 surnameFoundInSameHistoricalHtmlParagraph:boolean|null;
 weakerParagraphNameSignalNotManualSpeakerApproval:true;
 fullSenatorQuotationHumanApproved:false;
 originalAudioAuthenticated:false;
 committeeOrFloorRecordedIndividualVoteProven:false;
}
export interface SevenRawOriginalReceipt {
 sourceLeadId:string;originalReporterUrl:string;originalArchivedCaptureUtc:string;
 exactRawOriginalArchiveReplayUrl:string;sourceArticleSpeaker:string;
 previouslyIndexedOriginalRawSha1Base32:string;
 previouslyProvenOriginalRawSha256:string;
 previouslyProvenOriginalRawHttpBytes:number;
 observedOriginalSha256:string|null;
 status:Status;
 individualShortTextCueObservations:NamedHistoricalReporterCue[];
 originalPublisherFirstPostingClockEstablished:false;
 newsroomFloorOrCommitteeCoverageIsNotMemberRecordedVoteEvidence:true;
 noFullOriginalArticleTextSaved:true;
}
export interface SevenOriginalHistoricalQuoteReport {
 version:typeof SEVEN_REPORTER_ORIGINAL_VERSION;
 selectedIndependentOriginalReporterArticleUrls:7;
 verifiedServingSenatorSpeechCandidateNames:7;
 originalArchiveHttpBodyVersionsRequested:14;
 shortCurrentPublisherReporterTextCueIds:14;
 historicalBodyVersionCueChecksRequested:28;
 originalBodiesReverifiedIndexedSha1AndPriorSha256:number;
 originalBodiesUnknownOrUnverified:number;
 shortTextHistoricallyPresent:number;
 shortTextHistoricallyAbsent:number;
 shortTextHistoricallyUnknown:number;
 speakerFullNameInSameParagraphClues:number;
 speakerSurnameInSameParagraphClues:number;
 receipts:SevenRawOriginalReceipt[];
 historicOriginalArticleHtmlOrAudioPersisted:false;
 historicalAudioIndependentlyCompared:false;
 entireVerbatimSenatorUtteranceHumanApproved:0;
 originalPublisherFirstPostClockEstablished:0;
 individuallyRecordedSenateMemberVotesEstablished:0;
 currentWebPageQuotationBackdatedToUnknownArchiveCapture:false;
 privateEvidenceOrPredictionFeaturesRead:false;
 publicPublisherArticlePopulationDenominatorEstablished:false;
}
interface ExactOriginal {
 leadId:string;url:string;archiveUtc:string;archiveUrl:string;
 speaker:string;pinned:PublicOriginalCapture;cues:OriginalSevenCue[];
}
function b32(raw:Uint8Array):string{
 let value=0,bits=0,out='';
 for(const c of raw){
  value=(value<<8)|c;bits+=8;
  while(bits>=5){bits-=5;out+=B32[(value>>>bits)&31];}
  value&=(1<<bits)-1;
 }
 if(bits)out+=B32[(value<<(5-bits))&31];
 return out;
}
function utcTimestamp(s:string):string{
 if(!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s)
   ||!Number.isFinite(Date.parse(s))
   ||new Date(s).toISOString()!==s.replace('Z','.000Z'))
   throw Error('Original source archive UTC missing');
 return s.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
}
function pubUrl(s:string):void{
 let url:URL;
 try{url=new URL(s);}catch{throw Error('Untrusted reporter original article URL');}
 if(url.protocol!=='https:'||url.hostname!=='minnesotareformer.com'
   ||url.port||url.username||url.password||url.search||url.hash||url.href!==s
   ||!/^\/(?:briefs\/|202[12345]\/\d\d\/\d\d\/)[a-z0-9-]+\/$/.test(url.pathname))
   throw Error('Historical source outside the exact verified Reformer publisher articles');
}
export function selectSevenOriginalSources(
 q:SevenOriginalQueue,leads:readonly IndependentSourceLead[],archive:EarlierIndependentReporterReceipt,
):ExactOriginal[]{
 if(!q||q.version!=='senate-media-seven-remaining-authentic-independent-reporter-quote-targets-v1'
   ||q.preparedOn!=='2026-10-11'
   ||q.originalArticlesLedger!=='docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json'
   ||q.indexedAndPreviouslyVerifiedOriginalBodyManifest!=='docs/evaluation/senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json'
   ||q.selectedSourceArticleUrls!==7
   ||q.actualHistoricalBodyVersionsPreviouslySha1Sha256Pinned!==14
   ||q.individuallyNamedServingStateSenatorSpeakerCandidates!==7
   ||q.shortIndividuallyPublisherAttributedTextFragmentCues!==14
   ||q.historicShortPhraseChecksAcrossTwoOriginalVersionsEach!==28
   ||q.originalSpeakerRecordedAudioAuthenticated!==false
   ||q.originalFullQuotationHumanApproved!==false
   ||q.independentlyAuthenticatedRecordedCommitteeOrFloorVote!==false
   ||q.originalPublisherInitialPostClockProven!==false
   ||q.noPrivateVotePredictDataOrModelCodeRead!==true
   ||q.remainderOfTwelveHistoricallyOriginalVerifiedNewsArticleUrlCohort!==true
   ||!Array.isArray(q.sourceArticles)||q.sourceArticles.length!==7
   ||!Array.isArray(leads)
   ||archive?.version!=='senate-media-2021-25-independent-reporter-15-original-http-sha1-proof-v1'
   ||!Array.isArray(archive.originalSourceBodies)
   ||!Array.isArray(archive.independentFinalPublicRun?.newExactHistoricalOriginalReceipts))
   throw Error('Untrusted source-only original seven-article quote review inputs');
 const pinById=new Map<string,PublicOriginalCapture>();
 const add=(id:string,cap:PublicOriginalCapture)=>{
   const key=id+'|'+cap.captureUtc;
   if(pinById.has(key))throw Error('Duplicate original pinned source body');
   pinById.set(key,cap);
 };
 for(const group of archive.originalSourceBodies)
   for(const body of group.rawSha1ConsistentOriginalHttpCaptures)add(group.leadId,body);
 for(const cap of archive.independentFinalPublicRun.newExactHistoricalOriginalReceipts)
   add(cap.leadId,cap);
 const out:ExactOriginal[]=[];
 const seenCues=new Set<string>();
 for(let i=0;i<EXACT.length;i++){
   const required=EXACT[i]!,record=q.sourceArticles[i];
   if(!record||record.originalLeadId!==required.id
     ||record.expectedNamedServingSenatorSpeaker!==required.name
     ||record.originalCurrentPublisherReporterSpeechType!=='reporter_attributed_senator_quote'
     ||typeof record.attributionExclusionCaveat!=='string'
     ||record.attributionExclusionCaveat.length<75
     ||JSON.stringify(record.historicalOriginalCaptureUtcs)!==JSON.stringify(required.clock)
     ||!Array.isArray(record.cueFragments)||record.cueFragments.length!==2)
     throw Error('Seven selected source targets or original archived UTCs corrupted');
   const lead=leads.find(x=>x.id===record.originalLeadId);
   if(!lead||lead.originalPublisher!=='Minnesota Reformer'
     ||lead.namedSenatorSpeakerTurnCandidates.length!==1
     ||lead.namedSenatorSpeakerTurnCandidates[0]?.name!==required.name
     ||!/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/.test(
       lead.namedSenatorSpeakerTurnCandidates[0]!.officialMemberServiceUrl)
     ||lead.namedSenatorSpeakerTurnCandidates[0]!.historicalRecordedIndividualQuoteApproved!==false)
     throw Error('Source article speaker not the originally attributed sitting senator');
   pubUrl(lead.originalPublisherUrl);
   for(let k=0;k<2;k++){
     const phrase=record.cueFragments[k];
     if(!phrase||phrase.id!==required.id+'-fragment-'+(k+1)
       ||seenCues.has(phrase.id)||phrase.speakingSenator!==required.name
       ||typeof phrase.currentReporterOriginalShortTextFragment!=='string'
       ||phrase.currentReporterOriginalShortTextFragment.length<16
       ||phrase.currentReporterOriginalShortTextFragment.length>100
       ||phrase.currentReporterOriginalShortTextFragment.split(/\s+/).length>16
       ||/[<>]|https?:\/\//.test(phrase.currentReporterOriginalShortTextFragment)
       ||phrase.currentPublisherHasNamedReporterAttribution!==true
       ||phrase.fullSpokenAudioCompared!==false||phrase.quoteHumanApproved!==false
       ||phrase.independentlyRecordedMemberVoteVerified!==false)
       throw Error('Wrong named speaker, source quote text cue or fake approval');
     seenCues.add(phrase.id);
   }
   for(const t of required.clock){
     const pin=pinById.get(required.id+'|'+t);
     if(!pin||!S1.test(pin.indexSha1Base32)||!S256.test(pin.rawOriginalBodySha256)
       ||!Number.isSafeInteger(pin.originalBytes)||pin.originalBytes<40
       ||pin.originalBytes>MAX_ORIGINAL_BYTES)
       throw Error('Previously matched raw original SHA1 and SHA256 proof missing');
     out.push({leadId:record.originalLeadId,url:lead.originalPublisherUrl,
       archiveUtc:t,archiveUrl:'https://web.archive.org/web/'+utcTimestamp(t)+'id_/'+lead.originalPublisherUrl,
       speaker:required.name,pinned:pin,cues:record.cueFragments});
   }
 }
 return out;
}
async function boundedBody(r:Response):Promise<Uint8Array>{
 const len=r.headers.get('content-length');
 if(len!==null&&(!/^(0|[1-9]\d*)$/.test(len)
   ||!Number.isSafeInteger(Number(len))||Number(len)>MAX_ORIGINAL_BYTES))
   throw Error('size_limit');
 if(!r.body)throw Error('short_body');
 const reader=r.body.getReader(),parts:Uint8Array[]=[];
 let size=0;
 while(true){
   const p=await reader.read();
   if(p.done)break;
   size+=p.value.byteLength;
   if(size>MAX_ORIGINAL_BYTES){
     await reader.cancel().catch(()=>undefined);
     throw Error('size_limit');
   }
   parts.push(p.value);
 }
 if(size<40)throw Error('short_body');
 const body=new Uint8Array(size);let next=0;
 for(const p of parts){body.set(p,next);next+=p.byteLength;}
 return body;
}
const norm=(x:string)=>approximatePublicHtmlText(x);
function quoteStatus(cue:OriginalSevenCue,
 text:boolean|null,fullName:boolean|null,surname:boolean|null):NamedHistoricalReporterCue{
 return {
   sourceCueId:cue.id,namedServingSenator:cue.speakingSenator,
   shortPhraseInVerifiedHistoricalOriginalHtml:text,
   fullNameFoundInSameHistoricalHtmlParagraph:fullName,
   surnameFoundInSameHistoricalHtmlParagraph:surname,
   weakerParagraphNameSignalNotManualSpeakerApproval:true,
   fullSenatorQuotationHumanApproved:false,originalAudioAuthenticated:false,
   committeeOrFloorRecordedIndividualVoteProven:false,
 };
}
async function inspect(t:ExactOriginal,f:typeof fetch):Promise<SevenRawOriginalReceipt>{
 const header={
  sourceLeadId:t.leadId,originalReporterUrl:t.url,originalArchivedCaptureUtc:t.archiveUtc,
  exactRawOriginalArchiveReplayUrl:t.archiveUrl,sourceArticleSpeaker:t.speaker,
  previouslyIndexedOriginalRawSha1Base32:t.pinned.indexSha1Base32,
  previouslyProvenOriginalRawSha256:t.pinned.rawOriginalBodySha256,
  previouslyProvenOriginalRawHttpBytes:t.pinned.originalBytes,
  originalPublisherFirstPostingClockEstablished:false as const,
  newsroomFloorOrCommitteeCoverageIsNotMemberRecordedVoteEvidence:true as const,
  noFullOriginalArticleTextSaved:true as const,
 };
 const fail=(status:Status):SevenRawOriginalReceipt=>({...header,status,observedOriginalSha256:null,
   individualShortTextCueObservations:t.cues.map(c=>quoteStatus(c,null,null,null))});
 try{
   const res=await f(t.archiveUrl,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
     headers:{accept:'text/html','accept-encoding':'identity',
       'user-agent':'VotePredict/2.0 public-7-original-newsroom-senator-source-audit'}});
   if(res.status>=300&&res.status<400)return fail('archive_redirect_unknown');
   if(res.status!==200)return fail('archive_status_unknown');
   if((res.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase()!=='text/html')
     return fail('archive_unexpected_mime_unknown');
   const body=await boundedBody(res);
   if(b32(createHash('sha1').update(body).digest())!==t.pinned.indexSha1Base32)
     return fail('archive_original_indexed_sha1_mismatch_unknown');
   const sha=createHash('sha256').update(body).digest('hex');
   if(sha!==t.pinned.rawOriginalBodySha256||body.byteLength!==t.pinned.originalBytes)
     return fail('archive_previous_sha256_or_bytes_mismatch_unknown');
   const html=new TextDecoder('utf-8',{fatal:false}).decode(body);
   const visible=norm(html);
   const paragraphs=(html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)??[]).map(norm);
   return {...header,status:'exact_original_raw_sha1_and_pinned_sha256_verified',
     observedOriginalSha256:sha,
     individualShortTextCueObservations:t.cues.map(c=>{
       const fragment=norm(c.currentReporterOriginalShortTextFragment),
         found=visible.includes(fragment),
         paragraphsWithFragment=found?paragraphs.filter(p=>p.includes(fragment)):[];
       const fullName=norm(c.speakingSenator),
         surname=fullName.split(' ').at(-1)!;
       return quoteStatus(c,found,
         found?paragraphsWithFragment.some(p=>p.includes(fullName)):false,
         found?paragraphsWithFragment.some(p=>p.includes(surname)):false);
     }),
   };
 }catch(e){
   if(e instanceof Error&&e.message==='size_limit')return fail('archive_too_large_unknown');
   if(e instanceof Error&&e.message==='short_body')return fail('archive_too_short_unknown');
   return fail('archive_fetch_unknown');
 }
}
export async function auditSevenIndependentHistoricalSenatorRemarks(
 q:SevenOriginalQueue,leads:readonly IndependentSourceLead[],
 archive:EarlierIndependentReporterReceipt,request:typeof fetch=fetch,
):Promise<SevenOriginalHistoricalQuoteReport>{
 const targets=selectSevenOriginalSources(q,leads,archive);
 const observed:Array<SevenRawOriginalReceipt|undefined>=new Array(targets.length);
 let next=0;
 async function worker(){
   while(next<targets.length){
     const i=next++;
     observed[i]=await inspect(targets[i]!,request);
   }
 }
 await Promise.all([worker(),worker(),worker()]);
 if(observed.some(x=>x===undefined))throw Error('Incomplete archived public story cue study');
 const rows=observed as SevenRawOriginalReceipt[];
 const cues=rows.flatMap(x=>x.individualShortTextCueObservations);
 const positive=cues.filter(x=>x.shortPhraseInVerifiedHistoricalOriginalHtml===true).length,
   negative=cues.filter(x=>x.shortPhraseInVerifiedHistoricalOriginalHtml===false).length;
 return {
   version:SEVEN_REPORTER_ORIGINAL_VERSION,
   selectedIndependentOriginalReporterArticleUrls:7,
   verifiedServingSenatorSpeechCandidateNames:7,
   originalArchiveHttpBodyVersionsRequested:14,
   shortCurrentPublisherReporterTextCueIds:14,
   historicalBodyVersionCueChecksRequested:28,
   originalBodiesReverifiedIndexedSha1AndPriorSha256:rows.filter(x=>
     x.status==='exact_original_raw_sha1_and_pinned_sha256_verified').length,
   originalBodiesUnknownOrUnverified:rows.filter(x=>
     x.status!=='exact_original_raw_sha1_and_pinned_sha256_verified').length,
   shortTextHistoricallyPresent:positive,shortTextHistoricallyAbsent:negative,
   shortTextHistoricallyUnknown:cues.length-positive-negative,
   speakerFullNameInSameParagraphClues:cues.filter(x=>x.fullNameFoundInSameHistoricalHtmlParagraph===true).length,
   speakerSurnameInSameParagraphClues:cues.filter(x=>x.surnameFoundInSameHistoricalHtmlParagraph===true).length,
   receipts:rows,historicOriginalArticleHtmlOrAudioPersisted:false,
   historicalAudioIndependentlyCompared:false,entireVerbatimSenatorUtteranceHumanApproved:0,
   originalPublisherFirstPostClockEstablished:0,
   individuallyRecordedSenateMemberVotesEstablished:0,
   currentWebPageQuotationBackdatedToUnknownArchiveCapture:false,
   privateEvidenceOrPredictionFeaturesRead:false,
   publicPublisherArticlePopulationDenominatorEstablished:false,
 };
}

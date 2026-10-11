/**
 * #987 Public-only three multi-senator newsroom original-body wording audit.
 * Two 2022 curriculum, two 2024 housing, two 2025 labor ORIGINAL archived
 * HTML versions, indexed SHA1 and previously pinned raw SHA256 checks BEFORE
 * exact brief text cues. Speaker-name paragraph clues are NOT speech audio or
 * verified roll-call votes. No raw HTML persisted.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';

export const THREE_REPORTER_VERSION='senate-media-three-reporter-original-multi-speaker-cues-v1' as const;
const MAX=2_500_000;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const HEX=/^[a-f0-9]{64}$/;const S1=/^[A-Z2-7]{32}$/;
const EXPECT=[
 {id:'new-reporter-2022-curriculum',
  utc:['2022-02-14T22:22:10Z','2022-02-15T03:12:23Z'],
  names:['Paul Gazelka','Michelle Benson','Roger Chamberlain']},
 {id:'new-reporter-2024-housing-zoning',
  utc:['2024-04-19T12:52:13Z','2024-04-19T14:24:44Z'],
  names:['Steve Drazkowski','Heather Gustafson','Lindsey Port']},
 {id:'new-reporter-2025-federal-cuts',
  utc:['2025-04-25T15:28:44Z','2025-04-25T15:29:28Z'],
  names:['Erin Maye Quade','Erin Maye Quade']},
] as const;
export interface OriginalCue {
 cueId:string;speaker:string;originalReporterShortFragment:string;reportedGenre:string;
 currentSiteNamedSpeakerAttributionObserved:true;fullOriginalAudioVerified:false;
 fullVerbatimIndividualQuotationHumanApproved:false;verifiedRecordedSenateMemberVote:false;
}
export interface ThreeOriginalQueue {
 version:string;preparedOn:string;originalReporterPageLedger:string;
 pinnedOriginalHttpBodyManifest:string;humanVerifiedCompleteSpokenQuotes:false;
 originalInterviewAudioCompared:false;newsroomReportedFloorSpeechNeverRecordedVote:true;
 sourceCaptureUtcNotPublisherFirstPostClock:true;threeDistinctOriginalReporterArticles:true;
 individuallyNamedSenatorSpeakerCandidates:7;eightShortHistoricallyTestableTextCues:8;
 originalHttpPageVersionsToReverify:6;
 selectedOriginalReporterArticles:Array<{
  leadId:string;archiveCapturedUtc:string[];shortReporterAttributedSpeakerCues:OriginalCue[];
 }>;
}
export interface PublicArticle {
 id:string;originalPublisherUrl:string;originalPublisher:string;
 namedSenatorSpeakerTurnCandidates:Array<{name:string;officialMemberServiceUrl:string;reporterAttributionMode:string}>;
}
export interface Capture {
 captureUtc:string;indexSha1Base32:string;rawOriginalBodySha256:string;originalBytes:number;
}
export interface PublicProof {
 version:string;originalSourceBodies:Array<{leadId:string;rawSha1ConsistentOriginalHttpCaptures:Capture[]}>;
 independentFinalPublicRun:{newExactHistoricalOriginalReceipts:Array<{
  leadId:string;captureUtc:string;indexSha1Base32:string;rawOriginalBodySha256:string;originalBytes:number;
 }>};
}
type Gate='raw_sha1_and_prior_sha256_verified'|'redirect_unknown'|'http_unknown'|
 'mime_unknown'|'short_unknown'|'size_limit_unknown'|'indexed_sha1_mismatch_unknown'|
 'prior_sha256_or_byte_size_mismatch_unknown'|'archive_fetch_unknown';
type Observed={cueId:string;speaker:string;exactShortTextInHistoricalBody:boolean|null;
 namedSpeakerInSameHistoricalParagraph:boolean|null;otherSenatorWordsNeverAssigned:true;
 humanApprovedFullQuotation:false;independentOriginalAudioCompared:false;
 actualRecordedSenateMemberVoteInferred:false;};
interface Target{url:string;archiveUtc:string;archiveUrl:string;pin:Capture;cues:OriginalCue[];id:string;}
interface PageResult {
 leadId:string;sourceUrl:string;archiveUtc:string;archiveReplayUrl:string;
 originalIndexSha1Base32:string;originalPinnedRawSha256:string;originalPinnedBytes:number;
 observedSha256:string|null;status:Gate;quotes:Observed[];
 originalFirstPostedDayByClockVerified:false;
}
export interface TripleReporterResult {
 version:typeof THREE_REPORTER_VERSION;
 distinctIndependentPublisherArticleUrls:3;
 differentNamedSenatorSpeakerCandidates:7;
 shortIndividuallyAttributedTextCues:8;
 originalHistoricalRawHtmlVersionsRequested:6;
 originalSha1AndPriorSha256Matched: number;
 failedOrUnavailableOriginalVersions:number;
 shortTextFragmentChecks:16;
 shortTextFragmentsPresent:number;
 shortTextFragmentsAbsent:number;
 shortTextFragmentsUnknown:number;
 correctlyNamedSameParagraphClues:number;
 sourceVersions:PageResult[];
 originalPublisherInterviewAudioVersionsAuthenticated:0;
 fullSpokenSenatorQuotationsHumanApproved:0;
 separatelyRecordedSenateMemberVotesVerified:0;
 articlePublisherFirstPublicTimestampProven:0;
 originalRawPublisherHtmlOrAudioStored:false;
 privateResearchSourceOrForecastDataAccessed:false;
}
function utcCompact(s:string):string{
 if(!/^20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s)
   ||!Number.isFinite(Date.parse(s))
   ||new Date(s).toISOString()!==s.replace('Z','.000Z'))
   throw Error('Incorrect exact historical source UTC time');
 return s.replaceAll('-','').replaceAll(':','').replace('T','').replace('Z','');
}
function shaBase32(data:Uint8Array):string{
 let bits=0,v=0,out='';
 for(const byte of data){v=(v<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=B32[(v>>>bits)&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[(v<<(5-bits))&31];return out;
}
export function selectTripleOriginals(q:ThreeOriginalQueue,leadRows:PublicArticle[],p:PublicProof):Target[]{
 if(q?.version!=='senate-media-2021-25-three-new-independent-newsroom-source-quote-review-v1'
   ||q.preparedOn!=='2026-10-11'
   ||q.originalReporterPageLedger!=='docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json'
   ||q.pinnedOriginalHttpBodyManifest!=='docs/evaluation/senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json'
   ||q.humanVerifiedCompleteSpokenQuotes!==false||q.originalInterviewAudioCompared!==false
   ||q.newsroomReportedFloorSpeechNeverRecordedVote!==true||q.sourceCaptureUtcNotPublisherFirstPostClock!==true
   ||q.threeDistinctOriginalReporterArticles!==true||q.individuallyNamedSenatorSpeakerCandidates!==7
   ||q.eightShortHistoricallyTestableTextCues!==8||q.originalHttpPageVersionsToReverify!==6
   ||!Array.isArray(q.selectedOriginalReporterArticles)||q.selectedOriginalReporterArticles.length!==3
   ||p.version!=='senate-media-2021-25-independent-reporter-15-original-http-sha1-proof-v1')
   throw Error('Untrusted original reporter quote target manifest');
 const pins=new Map<string,Capture>();
 for(const g of p.originalSourceBodies)for(const cap of g.rawSha1ConsistentOriginalHttpCaptures){
  const id=g.leadId+'|'+cap.captureUtc;if(pins.has(id))throw Error('Duplicate source SHA proof');
  pins.set(id,cap);
 }
 for(const cap of p.independentFinalPublicRun.newExactHistoricalOriginalReceipts){
  const id=cap.leadId+'|'+cap.captureUtc;if(pins.has(id))throw Error('Contradictory source SHA proof');
  pins.set(id,cap);
 }
 const out:Target[]=[];
 for(let i=0;i<EXPECT.length;i++){
  const wanted=EXPECT[i]!,source=q.selectedOriginalReporterArticles[i];
  if(!source||source.leadId!==wanted.id||JSON.stringify(source.archiveCapturedUtc)!==JSON.stringify(wanted.utc)
    ||source.shortReporterAttributedSpeakerCues.length!==wanted.names.length)
    throw Error('Reporter source/capture/speaker mismatch');
  const l=leadRows.find(x=>x.id===source.leadId);
  const uniqueNames=[...new Set(wanted.names)];
  if(!l||l.originalPublisher!=='Minnesota Reformer'
    ||JSON.stringify(l.namedSenatorSpeakerTurnCandidates.map(x=>x.name))!==JSON.stringify(uniqueNames)
    ||l.namedSenatorSpeakerTurnCandidates.some(x=>!/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/.test(x.officialMemberServiceUrl)))
    throw Error('Named state senators not confirmed in public legislative service history');
  const u=new URL(l.originalPublisherUrl);
  if(u.protocol!=='https:'||u.hostname!=='minnesotareformer.com'||u.port||u.username||u.password
    ||u.search||u.hash||u.href!==l.originalPublisherUrl)
    throw Error('Not exact permitted original journalism URL');
  for(let j=0;j<wanted.names.length;j++){
   const c=source.shortReporterAttributedSpeakerCues[j]!;
   if(c.cueId!==source.leadId+'-cue-'+(j+1)
     ||c.speaker!==wanted.names[j]||typeof c.originalReporterShortFragment!=='string'
     ||c.originalReporterShortFragment.length<20||c.originalReporterShortFragment.length>95
     ||c.originalReporterShortFragment.split(/\s+/).length>17
     ||/[<>]|https?:\/\//.test(c.originalReporterShortFragment)
     ||c.reportedGenre!==l.namedSenatorSpeakerTurnCandidates.find(s=>s.name===c.speaker)?.reporterAttributionMode
     ||c.currentSiteNamedSpeakerAttributionObserved!==true
     ||c.fullOriginalAudioVerified!==false||c.fullVerbatimIndividualQuotationHumanApproved!==false
     ||c.verifiedRecordedSenateMemberVote!==false)
     throw Error('Untrusted original journalist speaker phrase attribution');
  }
  for(const day of wanted.utc){
   const pin=pins.get(source.leadId+'|'+day);
   if(!pin||!S1.test(pin.indexSha1Base32)||!HEX.test(pin.rawOriginalBodySha256)
     ||!Number.isSafeInteger(pin.originalBytes)||pin.originalBytes<40||pin.originalBytes>MAX)
     throw Error('Historic original raw SHA proof missing');
   out.push({url:l.originalPublisherUrl,archiveUtc:day,
    archiveUrl:'https://web.archive.org/web/'+utcCompact(day)+'id_/'+l.originalPublisherUrl,
    id:source.leadId,cues:source.shortReporterAttributedSpeakerCues,pin});
  }
 }
 return out;
}
async function rawBody(r:Response):Promise<Uint8Array>{
 const size=r.headers.get('content-length');
 if(size!==null&&(!/^(0|[1-9]\d*)$/.test(size)||!Number.isSafeInteger(Number(size))
   ||Number(size)>MAX))throw Error('too_large');
 if(!r.body)throw Error('too_short');
 const reader=r.body.getReader(),parts:Uint8Array[]=[];let len=0;
 while(true){const next=await reader.read();if(next.done)break;len+=next.value.byteLength;
  if(len>MAX){await reader.cancel().catch(()=>undefined);throw Error('too_large');}
  parts.push(next.value);
 }
 if(len<40)throw Error('too_short');
 const out=new Uint8Array(len);let at=0;for(const part of parts){out.set(part,at);at+=part.byteLength;}return out;
}
const norm=(s:string)=>approximatePublicHtmlText(s);
function sameParagraph(html:string,fragment:string,who:string):boolean{
 return (html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)??[]).some(p=>{
  const t=norm(p);return t.includes(norm(fragment))&&t.includes(norm(who));
 });
}
async function observe(t:Target,fetchImpl:typeof fetch):Promise<PageResult>{
 const known={leadId:t.id,sourceUrl:t.url,archiveUtc:t.archiveUtc,archiveReplayUrl:t.archiveUrl,
  originalIndexSha1Base32:t.pin.indexSha1Base32,originalPinnedRawSha256:t.pin.rawOriginalBodySha256,
  originalPinnedBytes:t.pin.originalBytes,originalFirstPostedDayByClockVerified:false as const};
 const empty=(status:Gate):PageResult=>({...known,status,observedSha256:null,
  quotes:t.cues.map(c=>({cueId:c.cueId,speaker:c.speaker,exactShortTextInHistoricalBody:null,
   namedSpeakerInSameHistoricalParagraph:null,otherSenatorWordsNeverAssigned:true,
   humanApprovedFullQuotation:false,independentOriginalAudioCompared:false,
   actualRecordedSenateMemberVoteInferred:false}))});
 try{
  const r=await fetchImpl(t.archiveUrl,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
   headers:{accept:'text/html','accept-encoding':'identity',
    'user-agent':'VotePredict/2.0 public-2021-25-exact-reporter-quote-audit'}});
  if(r.status>=300&&r.status<400)return empty('redirect_unknown');
  if(r.status!==200)return empty('http_unknown');
  if((r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='text/html')
   return empty('mime_unknown');
  const body=await rawBody(r);
  if(shaBase32(createHash('sha1').update(body).digest())!==t.pin.indexSha1Base32)
   return empty('indexed_sha1_mismatch_unknown');
  const sha=createHash('sha256').update(body).digest('hex');
  if(sha!==t.pin.rawOriginalBodySha256||body.length!==t.pin.originalBytes)
   return empty('prior_sha256_or_byte_size_mismatch_unknown');
  const html=new TextDecoder('utf-8',{fatal:false}).decode(body),visible=norm(html);
  return {...known,status:'raw_sha1_and_prior_sha256_verified',observedSha256:sha,
   quotes:t.cues.map(c=>{
    const found=visible.includes(norm(c.originalReporterShortFragment));
    return {cueId:c.cueId,speaker:c.speaker,exactShortTextInHistoricalBody:found,
      namedSpeakerInSameHistoricalParagraph:found?sameParagraph(html,c.originalReporterShortFragment,c.speaker):false,
      otherSenatorWordsNeverAssigned:true,humanApprovedFullQuotation:false,
      independentOriginalAudioCompared:false,actualRecordedSenateMemberVoteInferred:false};
   })};
 }catch(e){
  if(e instanceof Error&&e.message==='too_large')return empty('size_limit_unknown');
  if(e instanceof Error&&e.message==='too_short')return empty('short_unknown');
  return empty('archive_fetch_unknown');
 }
}
export async function auditThreeReporterOriginalQuotes(q:ThreeOriginalQueue,
 leads:PublicArticle[],p:PublicProof,fetchImpl:typeof fetch=fetch):Promise<TripleReporterResult>{
 const x=selectTripleOriginals(q,leads,p);
 const result=await Promise.all(x.map(t=>observe(t,fetchImpl)));
 const cues=result.flatMap(y=>y.quotes);
 const present=cues.filter(z=>z.exactShortTextInHistoricalBody===true).length;
 const absent=cues.filter(z=>z.exactShortTextInHistoricalBody===false).length;
 return {version:THREE_REPORTER_VERSION,
  distinctIndependentPublisherArticleUrls:3,differentNamedSenatorSpeakerCandidates:7,
  shortIndividuallyAttributedTextCues:8,originalHistoricalRawHtmlVersionsRequested:6,
  originalSha1AndPriorSha256Matched:result.filter(z=>z.status==='raw_sha1_and_prior_sha256_verified').length,
  failedOrUnavailableOriginalVersions:result.filter(z=>z.status!=='raw_sha1_and_prior_sha256_verified').length,
  shortTextFragmentChecks:16,shortTextFragmentsPresent:present,shortTextFragmentsAbsent:absent,
  shortTextFragmentsUnknown:cues.length-present-absent,
  correctlyNamedSameParagraphClues:cues.filter(z=>z.namedSpeakerInSameHistoricalParagraph===true).length,
  sourceVersions:result,
  originalPublisherInterviewAudioVersionsAuthenticated:0,fullSpokenSenatorQuotationsHumanApproved:0,
  separatelyRecordedSenateMemberVotesVerified:0,articlePublisherFirstPublicTimestampProven:0,
  originalRawPublisherHtmlOrAudioStored:false,privateResearchSourceOrForecastDataAccessed:false};
}

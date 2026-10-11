/**
 * #987/#946 PUBLIC-ONLY historical original /briefs/ URL recovery for three
 * previously missing-dated-path Minnesota Reformer news articles.
 *
 * THREE original dated publisher source URLs already in selected sample, THREE
 * exact same-slug publisher /briefs/ URL HISTORICAL candidates. Different
 * paths remain distinct unless both original historical bodies independently
 * authenticate. This NEVER infers an article duplicate, roll-call vote,
 * original spoken audio or earliest posting clock. Saves no raw article HTML.
 */
import {createHash} from 'node:crypto';
import {approximatePublicHtmlText} from './senate-media-historical-phrase-presence.js';
export const BRIEF_GAP_VERSION='senate-media-three-newspaper-brief-historical-original-candidate-replays-v1' as const;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SHA1=/^[A-Z2-7]{32}$/;
const MAX_INDEX=100_000,MAX_HTML=2_500_000,MAX_ROWS=20;
const ids=['new-reporter-2021-commissioners','new-reporter-2022-special-session','new-reporter-2025-sick-leave'] as const;
const speakers=[
 ['Michelle Benson','Susan Kent'],
 ['Jeremy Miller'],
 ['Grant Hauschild','Judy Seeberger','Jen McEwen'],
] as const;
type IndexStatus='indexed_candidates'|'index_empty'|'index_unavailable_unknown';
type BodyStatus='actual_original_indexed_sha1_verified'
 |'archive_redirect_unknown'|'archive_status_unknown'
 |'archive_unexpected_html_mime_unknown'
 |'archive_raw_sha1_mismatch_unknown'|'archive_body_too_short_unknown'
 |'archive_body_limit_unknown'|'archive_fetch_unknown';
export interface BriefCue{
 id:string;memberName:string;shortCurrentPublisherReporterCue:string;
 originalAudioChecked:false;fullTextIndividuallyApproved:false;recordedVoteProven:false;
}
export interface BriefLeadPair{
 originalReporterArticleLeadId:string;displayedPublisherDay:string;reporterByline:string;
 indexedPreviouslyUnavailableDatedUrl:string;proposedAlternativeOriginalBriefUrl:string;
 publisherAlternatePathEvidenceType:string;
 publisherSiblingArticleThatCrossLinksToBriefsUrl:string|null;
 candidateArticleTitleOrSlugIsNotOriginalArchiveIdentityProof:true;
 bylineAndPublisherCurrentSiteDateNotHistoricFirstPostingProof:true;
 memberQuoteShortCues:BriefCue[];
}
export interface BriefQueue{
 version:string;preparedOn:string;referenced15OriginalNewsroomLeads:string;
 originalShaArchiveDatedPathIndexUnavailableAsOfPreviousResearch:true;
 originalArticleExactAliasNotAssumedFromMatchingSlug:true;
 futureYearOriginalPublisherTimeNotBackdated:true;
 humanFullSenatorQuoteApproval:false;authenticOriginalAudioCompared:false;
 individualFloorCommitteeVotesAuthenticated:false;
 originalReporterTextOnlyNotOfficialRollCall:true;
 articleTextAndAudioNeverSaved:true;
 sourcePairs:BriefLeadPair[];
}
export interface OriginalLead{
 id:string;originalPublisherUrl:string;originalPublisher:string;
 displayedNewsPublicationDay:string;byline:string;
 namedSenatorSpeakerTurnCandidates:Array<{
  name:string;officialMemberServiceUrl:string;historicalRecordedIndividualQuoteApproved:false;
 }>;
}
interface CDXRow{captureUtc:string;indexedUtc:string;originalUrl:string;originalRawSha1Base32:string;}
export interface RecoveredCue{
 senator:string;cueId:string;currentReporterShortCuePresentInHistoricalOriginal:boolean|null;
 nameFoundSameHistoricParagraph:boolean|null;
 originalSpokenAudioNotAuthenticated:true;individualRecordedVoteNotProven:true;
 entireQuotedSentenceNotHumanApproved:true;
}
export interface HistoricBriefBody {
 captureUtc:string;rawReplayUrl:string;originalIndexSha1Base32:string;
 replayStatus:BodyStatus;originalObservedRawSha256:string|null;
 originalObservedRawHttpBytes:number|null;
 observedHistoricalCanonicalUrlIfAllowedPair:string|null;
 historicalOriginalContainsAllNamedReporterFragments:boolean|null;
 fragmentProofs:RecoveredCue[];
 originalPublisherFirstPostingClockEstablished:false;
}
export interface HistoricBriefVariant {
 variantRole:'currently_selected_dated_path'|'alternative_briefs_path';
 originalPublisherUrl:string;cdxStatus:IndexStatus;
 originalIndexedCaptureCandidateCount:number|null;
 exactOriginalReplayAttempts:number;
 originalHttpSha1MatchedVersionCount:number;
 allHistoricalOriginalBodyVersions:HistoricBriefBody[];
 noHistoricallyVerifiedBodyIsNotMissingPublisherArticle:true;
}
export interface HistoricBriefPairResult{
 selectedOriginalLeadId:string;displayedCurrentPublisherDay:string;originalReporterByline:string;
 historicallyUnverifiedDatedUrl:HistoricBriefVariant;
 publisherBriefsOriginalPathHypothesis:HistoricBriefVariant;
 sameOriginalArticleIdentityProvenAcrossBothHistoricalPaths:false;
 automaticNewsArticleDeduplications:0;
 verifiedBriefHistoricalCaptureWithPublisherCueButStillNoDatedPathIdentity:boolean;
 }
export interface HistoricalBriefRecoveryReport{
 version:typeof BRIEF_GAP_VERSION;
 originallyUnknownJournalistArticleUrlLeads:3;
 separatelyNamedCurrentPublisherServingSenatorSpeechCandidates:6;
 originalPublisherUrlVariantsIndividuallyIndexed:6;
 selectedPublisherDatedPaths:3;
 newlyProposedOriginalPublisherBriefsPathHypotheses:3;
 sourceUrlVariantsWithCdxOriginalCandidates:number;
 cdxIndexUnknownOriginalUrlVariants:number;
 cdxIndexEmptyOriginalUrlVariants:number;
 originalRawHttpReplaysAttempted:number;
 originalIndexedSha1ConsistentHtmlBodiesFound:number;
 originalPublisherUrlVariantsWithAtLeastOneVerifiedHistoricOriginal:number;
 briefCandidatesWithSomeAuthenticatedOriginalPublisherBody:number;
 briefCandidatesWithAllShortNamedSenatorTextCuesInAnAuthenticBody:number;
 datedSourceAndBriefBothAuthenticatedHistoricalPaths:number;
 headlineOrSlugOnlyAutomaticAliasesApproved:0;
 sourcePairResults:HistoricBriefPairResult[];
 noNewOriginalPublisherFirstPostingClocksProven:true;
 noFullVerbatimIndividualSenatorQuotesHumanApproved:true;
 noOriginalSpokenAudioAuthenticated:true;
 noActualRecordedSenateMemberVotesAuthenticated:true;
 noRawPublisherHtmlOrAudioPersisted:true;
 noPrivateEvidenceOrPredictionDataRead:true;
}
function checkOriginal(url:string,role:'dated'|'brief'):void{
 let x:URL;
 try{x=new URL(url);}catch{throw Error('Invalid exact Reformer source path');}
 if(x.protocol!=='https:'||x.hostname!=='minnesotareformer.com'||x.port||x.username||x.password
  ||x.search||x.hash||x.href!==url
  ||(role==='dated'?!/^\/202(?:1|2|5)\/\d\d\/\d\d\/[a-z0-9-]+\/$/.test(x.pathname):
   !/^\/briefs\/[a-z0-9-]+\/$/.test(x.pathname)))
  throw Error('Historical original URL variant outside three selected Reformer sources');
}
export function validateThreePublisherBriefCandidates(q:BriefQueue,leads:OriginalLead[]):BriefLeadPair[]{
 if(!q||q.version!=='senate-media-three-unverified-reformer-brief-original-urls-v1'
  ||q.preparedOn!=='2026-10-11'
  ||q.referenced15OriginalNewsroomLeads!=='docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json'
  ||q.originalShaArchiveDatedPathIndexUnavailableAsOfPreviousResearch!==true
  ||q.originalArticleExactAliasNotAssumedFromMatchingSlug!==true
  ||q.futureYearOriginalPublisherTimeNotBackdated!==true
  ||q.humanFullSenatorQuoteApproval!==false
  ||q.authenticOriginalAudioCompared!==false
  ||q.individualFloorCommitteeVotesAuthenticated!==false
  ||q.originalReporterTextOnlyNotOfficialRollCall!==true
  ||q.articleTextAndAudioNeverSaved!==true
  ||!Array.isArray(q.sourcePairs)||q.sourcePairs.length!==3||!Array.isArray(leads))
  throw Error('Unknown public original Reformer short report path alias cohort');
 const urls=new Set<string>(),out:BriefLeadPair[]=[];
 for(let i=0;i<3;i++){
  const p=q.sourcePairs[i],id=ids[i]!,expected=speakers[i]!;
  if(!p||p.originalReporterArticleLeadId!==id
    ||!/^20(?:21|22|25)-\d\d-\d\d$/.test(p.displayedPublisherDay)
    ||!Number.isFinite(Date.parse(p.displayedPublisherDay+'T00:00:00Z'))
    ||typeof p.reporterByline!=='string'||p.reporterByline.length<6
    ||p.memberQuoteShortCues?.length!==expected.length
    ||p.candidateArticleTitleOrSlugIsNotOriginalArchiveIdentityProof!==true
    ||p.bylineAndPublisherCurrentSiteDateNotHistoricFirstPostingProof!==true)
    throw Error('Untrusted exact senator source or source URL candidate');
  const lead=leads.find(x=>x.id===id);
  if(!lead||lead.originalPublisherUrl!==p.indexedPreviouslyUnavailableDatedUrl
    ||lead.originalPublisher!=='Minnesota Reformer'
    ||lead.displayedNewsPublicationDay!==p.displayedPublisherDay
    ||lead.byline!==p.reporterByline
    ||JSON.stringify(lead.namedSenatorSpeakerTurnCandidates.map(x=>x.name))
      !==JSON.stringify([...expected])
    ||lead.namedSenatorSpeakerTurnCandidates.some(s=>
      !/^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/.test(s.officialMemberServiceUrl)
      ||s.historicalRecordedIndividualQuoteApproved!==false))
    throw Error('Named state senator source not found in verified publisher/LRL current cohort');
  checkOriginal(p.indexedPreviouslyUnavailableDatedUrl,'dated');
  checkOriginal(p.proposedAlternativeOriginalBriefUrl,'brief');
  const slug=p.indexedPreviouslyUnavailableDatedUrl.split('/').filter(Boolean).at(-1);
  if(p.proposedAlternativeOriginalBriefUrl!=='https://minnesotareformer.com/briefs/'+slug+'/')
    throw Error('Brief alternate path changed article slug');
  if(urls.has(p.indexedPreviouslyUnavailableDatedUrl)||urls.has(p.proposedAlternativeOriginalBriefUrl))
    throw Error('Repeated exact original publisher URL variants');
  urls.add(p.indexedPreviouslyUnavailableDatedUrl);urls.add(p.proposedAlternativeOriginalBriefUrl);
  if(i===2){
   if(p.publisherAlternatePathEvidenceType!=='publisher-current-brief-plus-crosslinked-in-2025-05-09-story'
     ||p.publisherSiblingArticleThatCrossLinksToBriefsUrl!==
     'https://minnesotareformer.com/2025/05/09/labor-fights-to-preserve-recent-gains-at-minnesota-legislature-and-other-labor-news/')
    throw Error('Missing publisher-owned sick-leave original /briefs/ crosslink evidence');
  }else if(p.publisherAlternatePathEvidenceType!=='publisher-current-brief-category'
    ||p.publisherSiblingArticleThatCrossLinksToBriefsUrl!==null)
    throw Error('Missing source category hypothesis boundary');
  for(let k=0;k<expected.length;k++){
   const cue=p.memberQuoteShortCues[k];
   if(!cue||cue.id!==id+'-senator-fragment-'+(k+1)
     ||cue.memberName!==expected[k]
     ||typeof cue.shortCurrentPublisherReporterCue!=='string'
     ||cue.shortCurrentPublisherReporterCue.length<16
     ||cue.shortCurrentPublisherReporterCue.length>90
     ||cue.shortCurrentPublisherReporterCue.split(/\s+/).length>14
     ||/[<>]|https?:\/\//.test(cue.shortCurrentPublisherReporterCue)
     ||cue.originalAudioChecked!==false||cue.fullTextIndividuallyApproved!==false
     ||cue.recordedVoteProven!==false)
     throw Error('Unapproved reporter source fragment or wrong senator');
  }
  out.push(p);
 }
 return out;
}
function timeUTC(t:string):string{
 if(!/^\d{14}$/.test(t))throw Error('Invalid original capture UTC');
 const value=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'
  +t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14)+'Z';
 if(!/^20(?:21|22|23|24|25)-/.test(value)
  ||!Number.isFinite(Date.parse(value))
  ||new Date(value).toISOString()!==value.replace('Z','.000Z'))
  throw Error('Outside historically bound archive capture');
 return value;
}
function base32(body:Uint8Array){
 let n=0,bits=0,out='';
 for(const c of body){n=(n<<8)|c;bits+=8;while(bits>=5){bits-=5;out+=B32[(n>>>bits)&31];}n&=(1<<bits)-1;}
 if(bits)out+=B32[(n<<(5-bits))&31];return out;
}
async function bounded(r:Response,max:number):Promise<Uint8Array>{
 const contentLength=r.headers.get('content-length');
 if(contentLength!==null&&(!/^(0|[1-9]\d*)$/.test(contentLength)
  ||!Number.isSafeInteger(Number(contentLength))||Number(contentLength)>max))
  throw Error('body_limit');
 if(!r.body)throw Error('body_short');
 const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
 while(true){
  const c=await reader.read();if(c.done)break;
  size+=c.value.byteLength;if(size>max){await reader.cancel().catch(()=>undefined);throw Error('body_limit');}
  parts.push(c.value);
 }
 if(size<30)throw Error('body_short');
 const result=new Uint8Array(size);let at=0;
 for(const part of parts){result.set(part,at);at+=part.byteLength;}
 return result;
}
async function index(url:string,f:typeof fetch):Promise<CDXRow[]|null>{
 try{
  const qs=new URLSearchParams({
   url,matchType:'exact',from:'2021',to:'2025',output:'json',
   fl:'timestamp,original,mimetype,statuscode,digest,length',filter:'statuscode:200',
   limit:String(MAX_ROWS),
  });
  const r=await f('https://web.archive.org/cdx/search/cdx?'+qs.toString(),{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
   headers:{accept:'application/json','user-agent':'VotePredict/2.0 public-brief-archive-original-gap-recovery'},
  });
  if(r.status!==200||(r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='application/json')
   return null;
  const raw=await bounded(r,MAX_INDEX);
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)) as unknown;
  if(!Array.isArray(body)||!Array.isArray(body[0])||body.length>MAX_ROWS+1)
   throw Error('Malformed exact CDX original index');
  const h=body[0];
  if(h.some((x:unknown)=>typeof x!=='string')||new Set(h).size!==h.length
   ||['timestamp','original','mimetype','statuscode','digest','length'].some(x=>!h.includes(x)))
   throw Error('Unverified CDX original response fields');
  const all:CDXRow[]=[],seen=new Set<string>();
  for(const line of body.slice(1)){
   if(!Array.isArray(line)||line.length!==h.length)throw Error('Malformed CDX capture row');
   const get=(key:string):unknown=>line[h.indexOf(key)];
   const stamp=get('timestamp'),original=get('original'),mime=get('mimetype'),
    status=get('statuscode'),sha=get('digest'),bytes=get('length');
   if(typeof stamp!=='string'||typeof original!=='string'||typeof mime!=='string'
    ||typeof status!=='string'||typeof sha!=='string'||typeof bytes!=='string'
    ||original!==url||mime!=='text/html'||status!=='200'
    ||!SHA1.test(sha.toUpperCase())
    ||!/^\d+$/.test(bytes)||!Number.isSafeInteger(Number(bytes)))
    throw Error('Untrusted exact original indexed historical publisher URL/digest');
   const captureUtc=timeUTC(stamp);
   if(seen.has(stamp))continue;seen.add(stamp);
   all.push({captureUtc,indexedUtc:stamp,originalUrl:url,originalRawSha1Base32:sha.toUpperCase()});
  }
  return all.sort((a,b)=>a.indexedUtc.localeCompare(b.indexedUtc));
 }catch{return null;}
}
function quote(cue:BriefCue,present:boolean|null,sameParagraph:boolean|null):RecoveredCue{
 return {senator:cue.memberName,cueId:cue.id,
  currentReporterShortCuePresentInHistoricalOriginal:present,
  nameFoundSameHistoricParagraph:sameParagraph,
  originalSpokenAudioNotAuthenticated:true,individualRecordedVoteNotProven:true,
  entireQuotedSentenceNotHumanApproved:true};
}
function historicCanonical(html:string,p:BriefLeadPair):string|null{
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]??'';
 const matches=head.match(/<link\b[^>]*>/gi)??[];
 for(const tag of matches){
  if(!/\brel\s*=\s*["']canonical["']/i.test(tag))continue;
  const match=tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(match===p.indexedPreviouslyUnavailableDatedUrl||match===p.proposedAlternativeOriginalBriefUrl)
    return match;
 }
 return null;
}
async function replay(row:CDXRow,p:BriefLeadPair,f:typeof fetch):Promise<HistoricBriefBody>{
 const address='https://web.archive.org/web/'+row.indexedUtc+'id_/'+row.originalUrl;
 const base={captureUtc:row.captureUtc,rawReplayUrl:address,
  originalIndexSha1Base32:row.originalRawSha1Base32,
  originalPublisherFirstPostingClockEstablished:false as const};
 const unknown=(status:BodyStatus):HistoricBriefBody=>({...base,replayStatus:status,
  originalObservedRawSha256:null,originalObservedRawHttpBytes:null,
  observedHistoricalCanonicalUrlIfAllowedPair:null,
  historicalOriginalContainsAllNamedReporterFragments:null,
  fragmentProofs:p.memberQuoteShortCues.map(c=>quote(c,null,null))});
 try{
  const r=await f(address,{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(20_000),
   headers:{accept:'text/html','accept-encoding':'identity',
    'user-agent':'VotePredict/2.0 public-brief-archive-original-gap-recovery'},
  });
  if(r.status>=300&&r.status<400)return unknown('archive_redirect_unknown');
  if(r.status!==200)return unknown('archive_status_unknown');
  if((r.headers.get('content-type')??'').split(';')[0]?.trim().toLowerCase()!=='text/html')
   return unknown('archive_unexpected_html_mime_unknown');
  const bytes=await bounded(r,MAX_HTML);
  if(base32(createHash('sha1').update(bytes).digest())!==row.originalRawSha1Base32)
   return unknown('archive_raw_sha1_mismatch_unknown');
  const html=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  const rendered=approximatePublicHtmlText(html);
  const paragraphs=(html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)??[])
   .map(approximatePublicHtmlText);
  const outcomes=p.memberQuoteShortCues.map(c=>{
   const phrase=approximatePublicHtmlText(c.shortCurrentPublisherReporterCue),
     matched=rendered.includes(phrase);
   const surname=c.memberName.split(' ').at(-1)!.toLocaleLowerCase('en-US');
   return quote(c,matched,
    matched?paragraphs.some(x=>x.includes(phrase)&&x.includes(surname)):false);
  });
  return {...base,replayStatus:'actual_original_indexed_sha1_verified',
   originalObservedRawSha256:createHash('sha256').update(bytes).digest('hex'),
   originalObservedRawHttpBytes:bytes.length,
   observedHistoricalCanonicalUrlIfAllowedPair:historicCanonical(html,p),
   historicalOriginalContainsAllNamedReporterFragments:outcomes.every(x=>
     x.currentReporterShortCuePresentInHistoricalOriginal===true),
   fragmentProofs:outcomes};
 }catch(e){
  if(e instanceof Error&&e.message==='body_limit')return unknown('archive_body_limit_unknown');
  if(e instanceof Error&&e.message==='body_short')return unknown('archive_body_too_short_unknown');
  return unknown('archive_fetch_unknown');
 }
}
async function inspectVariant(p:BriefLeadPair,role:'dated'|'brief',f:typeof fetch):Promise<HistoricBriefVariant>{
 const url=role==='dated'?p.indexedPreviouslyUnavailableDatedUrl:p.proposedAlternativeOriginalBriefUrl;
 const candidates=await index(url,f);
 const replays:HistoricBriefBody[]=[];
 if(candidates!==null)for(const row of candidates.slice(0,2))
  replays.push(await replay(row,p,f));
 return {
  variantRole:role==='dated'?'currently_selected_dated_path':'alternative_briefs_path',
  originalPublisherUrl:url,
  cdxStatus:candidates===null?'index_unavailable_unknown':candidates.length?'indexed_candidates':'index_empty',
  originalIndexedCaptureCandidateCount:candidates?.length??null,
  exactOriginalReplayAttempts:replays.length,
  originalHttpSha1MatchedVersionCount:replays.filter(x=>x.replayStatus==='actual_original_indexed_sha1_verified').length,
  allHistoricalOriginalBodyVersions:replays,
  noHistoricallyVerifiedBodyIsNotMissingPublisherArticle:true,
 };
}
export async function researchThreeMissingHistoricallyOriginalBriefs(
 q:BriefQueue,leads:OriginalLead[],request:typeof fetch=fetch,
):Promise<HistoricalBriefRecoveryReport>{
 const pairs=validateThreePublisherBriefCandidates(q,leads);
 const output:Array<HistoricBriefPairResult|undefined>=new Array(3);
 let next=0;
 async function worker(){
  while(next<3){
   const i=next++,pair=pairs[i]!;
   const [dated,brief]=await Promise.all([
    inspectVariant(pair,'dated',request),inspectVariant(pair,'brief',request),
   ]);
   output[i]={
    selectedOriginalLeadId:pair.originalReporterArticleLeadId,
    displayedCurrentPublisherDay:pair.displayedPublisherDay,
    originalReporterByline:pair.reporterByline,
    historicallyUnverifiedDatedUrl:dated,publisherBriefsOriginalPathHypothesis:brief,
    sameOriginalArticleIdentityProvenAcrossBothHistoricalPaths:false,
    automaticNewsArticleDeduplications:0,
    verifiedBriefHistoricalCaptureWithPublisherCueButStillNoDatedPathIdentity:
      brief.allHistoricalOriginalBodyVersions.some(x=>x.historicalOriginalContainsAllNamedReporterFragments===true),
   };
  }
 }
 await Promise.all([worker(),worker()]);
 if(output.some(x=>!x))throw Error('Incomplete public alternative brief source archive results');
 const found=output as HistoricBriefPairResult[],
  variants=found.flatMap(x=>[x.historicallyUnverifiedDatedUrl,x.publisherBriefsOriginalPathHypothesis]);
 return {
  version:BRIEF_GAP_VERSION,originallyUnknownJournalistArticleUrlLeads:3,
  separatelyNamedCurrentPublisherServingSenatorSpeechCandidates:6,
  originalPublisherUrlVariantsIndividuallyIndexed:6,
  selectedPublisherDatedPaths:3,newlyProposedOriginalPublisherBriefsPathHypotheses:3,
  sourceUrlVariantsWithCdxOriginalCandidates:variants.filter(x=>x.cdxStatus==='indexed_candidates').length,
  cdxIndexUnknownOriginalUrlVariants:variants.filter(x=>x.cdxStatus==='index_unavailable_unknown').length,
  cdxIndexEmptyOriginalUrlVariants:variants.filter(x=>x.cdxStatus==='index_empty').length,
  originalRawHttpReplaysAttempted:variants.reduce((n,x)=>n+x.exactOriginalReplayAttempts,0),
  originalIndexedSha1ConsistentHtmlBodiesFound:variants.reduce((n,x)=>n+x.originalHttpSha1MatchedVersionCount,0),
  originalPublisherUrlVariantsWithAtLeastOneVerifiedHistoricOriginal:variants.filter(x=>x.originalHttpSha1MatchedVersionCount>0).length,
  briefCandidatesWithSomeAuthenticatedOriginalPublisherBody:found.filter(x=>x.publisherBriefsOriginalPathHypothesis.originalHttpSha1MatchedVersionCount>0).length,
  briefCandidatesWithAllShortNamedSenatorTextCuesInAnAuthenticBody:found.filter(x=>x.verifiedBriefHistoricalCaptureWithPublisherCueButStillNoDatedPathIdentity).length,
  datedSourceAndBriefBothAuthenticatedHistoricalPaths:found.filter(x=>
   x.historicallyUnverifiedDatedUrl.originalHttpSha1MatchedVersionCount>0
   &&x.publisherBriefsOriginalPathHypothesis.originalHttpSha1MatchedVersionCount>0).length,
  headlineOrSlugOnlyAutomaticAliasesApproved:0,sourcePairResults:found,
  noNewOriginalPublisherFirstPostingClocksProven:true,
  noFullVerbatimIndividualSenatorQuotesHumanApproved:true,
  noOriginalSpokenAudioAuthenticated:true,noActualRecordedSenateMemberVotesAuthenticated:true,
  noRawPublisherHtmlOrAudioPersisted:true,noPrivateEvidenceOrPredictionDataRead:true,
 };
}

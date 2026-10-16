/** #864 exactly one previously unexamined 2023 Apr27 Senate Taxes
 * original LRL safe HTML caption endpoint. SOURCE AVAILABILITY ONLY.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {selectPinnedMtgidRecords} from '../../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface,
 fetchBoundedCaptionEvidence} from '../../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../../src/evidence/senate-committee-138-record-html-metadata.js';
import {ORIGINAL_APR27_TAXES_CAPTION_SOURCE,verifyOriginalApr27ThirdCaptionLead}
 from '../../src/evidence/senate-2023-taxes-third-original-caption-source.js';
const args=process.argv.slice(2);
if(args.length!==8||args[0]!=='--hrefs'||args[2]!=='--original-html'
  ||args[4]!=='--prior-caption'||args[6]!=='--output')
 throw Error('Exact --hrefs FILE --original-html FILE --prior-caption FILE --output FILE');
const [href,html,caps,out]=[args[1]!,args[3]!,args[5]!,args[7]!].map(v=>resolve(v));
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const safe=(x:unknown)=>String(x instanceof Error?x.message:x)
 .replace(/https?:\/\/\S+/gi,'[official LRL record]').slice(0,150);

async function main(){
 const p=ORIGINAL_APR27_TAXES_CAPTION_SOURCE;
 const index=selectPinnedMtgidRecords(2023,readFileSync(href,'utf8'));
 const previous=readExactPriorMediaHtmlProof(2023,readFileSync(html,'utf8'));
 const exact=verifyOriginalApr27ThirdCaptionLead(readFileSync(caps,'utf8'));
 if(index.length!==64||previous.size!==64||exact.remainingUninspectedStreams!==1)
  throw Error('Original 2023 indexed and 64 LRL HTML source inventory not complete');
 const matches=index.filter(x=>x.mtgid===p.officialMtgid);
 const row=matches[0],old=previous.get(p.officialMtgid);
 if(matches.length!==1||!row||!old
   ||row.year!==2023||row.meetingDate!==p.hearingDate
   ||row.committeeName!==p.committeeName
   ||row.mediaUrl!==p.exactOriginalMediaUrl
   ||old.originalHtmlSha256!==p.exactOriginalPageHtmlSha256
   ||old.originalIndexedHearingDate!==p.hearingDate
   ||old.exactOriginalMediaRecordUrl!==p.exactOriginalMediaUrl)
  throw Error('Original source meeting identity/HTML SHA unexpectedly changed');
 const result:{
  sourcePageHtmlSHAReverified:boolean;safeOriginalCaptionLinkCount:number|null;
  thirdOriginalCaptionInterfaceIndex:number;
  originalThirdTrackFilenameSha256:string|null;
  thirdCaptionSourceStatus:string;
  thirdPayloadSha256:string|null;thirdPayloadBytes:number|null;
  thirdOriginalCaptionTimestampMarkers:number|null;sourceError:string|null
 }={
  sourcePageHtmlSHAReverified:false,
  safeOriginalCaptionLinkCount:null,
  thirdOriginalCaptionInterfaceIndex:2,
  originalThirdTrackFilenameSha256:null,
  thirdCaptionSourceStatus:'unavailable_source_not_reviewed',
  thirdPayloadSha256:null,thirdPayloadBytes:null,
  thirdOriginalCaptionTimestampMarkers:null,sourceError:null
 };
 let sourceOk=false;
 try{
  const media=await fetchBoundedSenateMediaRecordHtml(row.mediaUrl,new Set([row.mediaUrl]));
  const surface=inspectMediaPageCaptionSurface(media.html,row.mediaUrl);
  if(surface.pageOriginalHtmlSha256!==p.exactOriginalPageHtmlSha256
    ||surface.safeRequestCandidates.length!==3
    ||surface.totalRequestCandidates!==3||surface.rejectedRequestCandidates!==0)
   throw Error('Original April27 third caption interface not exact HTML source');
  result.sourcePageHtmlSHAReverified=true;
  result.safeOriginalCaptionLinkCount=3;
  const request=surface.safeRequestCandidates[2]!;
  if(!request)throw Error('Missing exact previously-uninspected third caption request');
  result.originalThirdTrackFilenameSha256=digest(request.mp4);
  const third=await fetchBoundedCaptionEvidence(request.endpointUrl,row.mediaUrl);
  result.thirdCaptionSourceStatus=third.status;
  result.thirdPayloadSha256=third.originalPayloadSha256;
  result.thirdPayloadBytes=third.originalPayloadBytes;
  result.thirdOriginalCaptionTimestampMarkers=third.timedCaptionRows;
  sourceOk=third.status==='caption_timed_rows_observed'||third.status==='caption_payload_no_timed_rows';
 }catch(e){result.sourceError=safe(e)}
 const summary={
  schemaVersion:'senate-2023-apr27-third-previously-unseen-official-caption-source-proof-v1',
  issue:864,hearingYear:2023,indexedHearingDate:p.hearingDate,
  committeeName:p.committeeName,
  officialMediaRecordUrl:p.exactOriginalMediaUrl,mtgid:p.officialMtgid,
  priorFirstCaptionSourceRunId:p.originalFirstCaptionRunId,
  originalFirstRunConclusion:'failure',
  priorFirstRunOriginalJsonSha256:p.originalFirstArtifactJsonSha256,
  officialIndexedHrefOriginalRunId:38079233118,
  priorOriginalHtmlRunId:38081463362,
  exactPinnedOriginalHtmlSha256:p.exactOriginalPageHtmlSha256,
  priorInspectedOriginalCaptionPayloadSha256s:p.originalFirstTwoCaptionPayloadSha256s,
  previouslyUninspectedOriginalCaptionTrackOrdinal:2,
  sourceStatus:sourceOk?'third_original_caption_source_status_observed':'third_original_caption_source_unavailable',
  sourceResult:result,
  thirdCaptionInterfaceCheckedOnlyAfterOriginalHtmlSha:true,
  didNotRedownloadEarlierTwoOriginalCaptionPayloads:true,
  didNotDownloadAudioVideoBodies:true,
  didNotStoreRawCaptionWords:true,
  cannotDeduceDistinctMotionFromCaptionTrack:true,
  noHumanAudioPlaybackOrSpeakerProof:true,
  noRecordedNamedVoteOrBillStanceCertified:true,
  fullOriginalSenate2021to2025CommitteeVoteDenominator:null,
  privateDbModelServingForecastTrainingSchedulerFloor2027Unchanged:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({sourceStatus:summary.sourceStatus,
  thirdPayloadBytes:result.thirdPayloadBytes,
  timestampMarkers:result.thirdOriginalCaptionTimestampMarkers},null,2));
 if(!sourceOk)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

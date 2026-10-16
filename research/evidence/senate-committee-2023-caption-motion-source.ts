/**
 * #864 — ORIGINAL 2023 Senate no-linked-Minutes caption research metadata.
 * Two different source runs are needed: the first 62/64 HTML-sha cohort was
 * PARTIALLY FAILED; the later retry independently proved the other two.
 * Caption discovery does not prove a motion, bill, speaker, AV, or vote.
 */
import {createHash} from 'node:crypto';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const ORIGINAL_2023_CAPTION_PROOFS={
  first:{
    runId:38103766440,runStatus:'failure',artifactId:11688587941,
    originalZipSha256:'d8043c34346c21b06b4f2a30d70cf7c80225ae1d5a6d4863e15801a24a2f1240',
    originalJsonSha256:'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4',
    originalJsonBytes:64282,observedRecordHtmlShas:62,failedGet:2,
    timedPageCount:56,timestampMarkers:162749,captionRequestsInspected:62,
  },
  retry:{
    runId:38104325591,runStatus:'success',artifactId:11688688635,
    originalZipSha256:'514c359aeb5c5743ec6538137d9359fe1a82bba186a14eccc2efdedc5ecbc588',
    originalJsonSha256:'4c4564531edd35c1c14cf1cc08defc62e107516c1cd371dfd1b9b6e428eeff4e',
    originalJsonBytes:2704,observedRecordHtmlShas:2,timedPageCount:2,
    timestampMarkers:4845,
  },
  expectedMediaPages:64,timedCaptionPages:58,
  timedCaptionStreams:63,confirmedNoTimedCaptionPages:6,
  totalTimestampMarkers:167594,
  originalEmptyCaptionMtgid:'1046896',
  audioOnlyMtgids:['1047437','1047599','1047707','1048027','1048030'],
  unreviewedExtraTrack:{
    originalMtgid:'1048125',indexedHearingDate:'2023-04-27',
    committeeName:'Taxes',sourceLinks:3,earlierCaptionStreamsInspected:2
  },
  twoOriginalRetryMtgids:['1046920','1047266'],
} as const;
const DIGEST=/^[a-f0-9]{64}$/;
const REPLAY_SCHEMA='senate-2023-two-previously-failed-taxes-caption-original-source-retry-v1';
const FIRST_SCHEMA='senate-2022-25-138-original-media-record-caption-surface-proof-v1';

export type Pinned2023CaptionRecord={
  year:2023;committeeName:string;originalHearingDate:string;originalMtgid:string;
  officialOriginalPageUrl:string;previouslyVerifiedOriginalPageHtmlSha256:string;
  safeCaptionRequestCandidates:number;captionRequestsInspected:number;
  pinnedOriginalCaptionPayloadSha256s:string[];pinnedOriginalCaptionBytes:number;
  pinnedOriginalTimedCaptionRows:number;unreviewedExtraCaptionRequestCount:number;
  captionSourceHold:'none'|'empty_original_caption'|'no_video_caption_interface';
  originalSourceKind:'first_failed_parent_partial'|'successful_two_record_retry';
  originalHtmlAndPriorCaptionProofReconciled:true;
};
export function sourcePinned2023CaptionRecords(firstBytes:string,retryBytes:string):Map<string,Pinned2023CaptionRecord>{
 const cfg=ORIGINAL_2023_CAPTION_PROOFS;
 if(Buffer.byteLength(firstBytes,'utf8')!==cfg.first.originalJsonBytes
  ||sha(firstBytes)!==cfg.first.originalJsonSha256
  ||Buffer.byteLength(retryBytes,'utf8')!==cfg.retry.originalJsonBytes
  ||sha(retryBytes)!==cfg.retry.originalJsonSha256)
  throw Error('Original 2023 failed/retry source metadata JSON bytes or SHA changed');
 const first=JSON.parse(firstBytes) as {
  schemaVersion:string;year:number;originalSourceHrefArtifactId:number;
  pinnedOriginalHrefJsonSha256:string;previouslyVerifiedOriginalHtmlSourceArtifactId:number;
  pinnedPreviousHtmlSourceJsonSha256:string;
  totals:{
   officialOriginalMediaRecordsExpected:number;originalHtmlPagesReverified:number;
   originalHtmlPageFailures:number;captionRequestCandidatePages:number;
   safeCaptionRequestPages:number;captionEndpointRequestsMade:number;
   pagesWithTimedCaptionRows:number;totalCaptionTimestampMarkers:number;
   pagesWithCaptionHttpOrContentFailure:number;
  };
  records:Array<{
   year:number;committeeName:string;originalHearingDate:string;originalMediaRecordUrl:string;
   originalMtgid:string;previouslyVerifiedOriginalPageHtmlSha256:string;
   captionRequestCandidates:number;safeCaptionRequestCandidates:number;
   rejectedCaptionRequestCandidates:number;inspectedCaptionRequests:number;
   captionApiStatusCategories:string[];timedCaptionRowsVisible:number;
   returnedPayloadBytes:number;captionPayloadSha256s:string[];
   sourcePageReselectedSameOriginalHash:boolean;noRecordedMediaFileDownloaded:boolean;
   noCaptionTextPublished:boolean;noSpeakerOrNamedYeaNayProven:boolean;
   playbackNotVerified:boolean;
  }>;
  failures:Array<{mtgid:string;hearingDate:string;reason:string}>;
 };
 const t=first.totals;
 if(first.schemaVersion!==FIRST_SCHEMA||first.year!==2023
  ||first.originalSourceHrefArtifactId!==11679855972
  ||first.pinnedOriginalHrefJsonSha256!=='dbc2cea3cc58f5bbbde89d143456eddb3086050934d058ac499cbb3a29faa4b1'
  ||first.previouslyVerifiedOriginalHtmlSourceArtifactId!==11679809828
  ||first.pinnedPreviousHtmlSourceJsonSha256!=='59018e20df0bb0742ec668604a117d12dddc8c0bdb156b4b2f05e0e287ca6643'
  ||t.officialOriginalMediaRecordsExpected!==64||t.originalHtmlPagesReverified!==62
  ||t.originalHtmlPageFailures!==2||t.captionRequestCandidatePages!==57
  ||t.safeCaptionRequestPages!==57||t.captionEndpointRequestsMade!==62
  ||t.pagesWithTimedCaptionRows!==56||t.totalCaptionTimestampMarkers!==162749
  ||t.pagesWithCaptionHttpOrContentFailure!==0
  ||first.records.length!==62||first.failures.length!==2
  ||first.failures.some((f,i)=>f.mtgid!==cfg.twoOriginalRetryMtgids[i]
    ||f.hearingDate!==['2023-01-12','2023-02-08'][i]||f.reason!=='fetch failed'))
  throw Error('Original 2023 source first-run failed/shard metadata incorrectly upgraded');
 const retry=JSON.parse(retryBytes) as {
  schemaVersion:string;year:number;sourceOriginalHrefAuditRun:number;
  originalHtmlAuditRun:number;previousSourceRunId:number;
  previousFailedRunJsonSha256:string;expectedOnlyTwoExactOriginals:number;
  reverifiedOriginalHtmlPages:number;retryFailures:number;
  records:Array<{
   year:number;committeeName:string;originalHearingDate:string;originalMtgid:string;
   officialOriginalPageUrl:string;originalHtmlSha256:string;
   captionRequestCandidates:number;safeCaptionRequests:number;
   captionResponses:Array<{
    status:string;timedCaptionRows:number;originalPayloadSha256:string;originalPayloadBytes:number
   }>;
   totalTimedCaptionMarkers:number;originalHtmlPageShaReverified:boolean;
   noMediaOrTranscriptStored:boolean;noVoteOrSpeakerCertified:boolean;
  }>;failures:unknown[];
 };
 if(retry.schemaVersion!==REPLAY_SCHEMA||retry.year!==2023
  ||retry.sourceOriginalHrefAuditRun!==38079233118
  ||retry.originalHtmlAuditRun!==38081463362
  ||retry.previousSourceRunId!==cfg.first.runId
  ||retry.previousFailedRunJsonSha256!==cfg.first.originalJsonSha256
  ||retry.expectedOnlyTwoExactOriginals!==2
  ||retry.reverifiedOriginalHtmlPages!==2||retry.retryFailures!==0
  ||retry.records.length!==2||retry.failures.length!==0)
  throw Error('Targeted 2023 source retry not exact prior failed IDs');
 const source=new Map<string,Pinned2023CaptionRecord>();
 let actualTimed=0,actuallyRead=0,noTimed=0,sourceCount=0,thirdUnreviewed=0;
 for(const row of first.records){
  const audioOnly=cfg.audioOnlyMtgids.includes(row.originalMtgid as (typeof cfg.audioOnlyMtgids)[number]);
  const empty=row.originalMtgid===cfg.originalEmptyCaptionMtgid;
  const extra=row.originalMtgid===cfg.unreviewedExtraTrack.originalMtgid;
  const req=audioOnly?0:extra?3:(row.captionRequestCandidates===2?2:1);
  const read=Math.min(2,req);
  if(row.year!==2023||!/^2023-\d\d-\d\d$/.test(row.originalHearingDate)
   ||row.originalMediaRecordUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+row.originalMtgid
   ||!DIGEST.test(row.previouslyVerifiedOriginalPageHtmlSha256)
   ||row.captionRequestCandidates!==req
   ||row.safeCaptionRequestCandidates!==req
   ||row.rejectedCaptionRequestCandidates!==0||row.inspectedCaptionRequests!==read
   ||row.captionApiStatusCategories.length!==read||row.captionPayloadSha256s.length!==read
   ||row.captionPayloadSha256s.some(v=>!DIGEST.test(v))
   ||row.captionApiStatusCategories.some(s=>s!==(empty?'caption_payload_no_timed_rows':'caption_timed_rows_observed'))
   ||!Number.isSafeInteger(row.timedCaptionRowsVisible)
   ||(audioOnly||empty?row.timedCaptionRowsVisible!==0:row.timedCaptionRowsVisible<=0)
   ||!Number.isSafeInteger(row.returnedPayloadBytes)||row.returnedPayloadBytes<0
   ||row.returnedPayloadBytes>1_500_000*read
   ||row.sourcePageReselectedSameOriginalHash!==true
   ||row.noRecordedMediaFileDownloaded!==true||row.noCaptionTextPublished!==true
   ||row.noSpeakerOrNamedYeaNayProven!==true||row.playbackNotVerified!==true
   ||source.has(row.originalMtgid))
   throw Error('2023 original caption source record does not match prior verified source');
  if(extra&&(row.originalHearingDate!==cfg.unreviewedExtraTrack.indexedHearingDate
     ||row.committeeName!==cfg.unreviewedExtraTrack.committeeName))
   throw Error('2023 April27 third caption link moved to a different hearing');
  if(empty&&(row.originalHearingDate!=='2023-01-10'||row.committeeName!=='Taxes'
    ||row.returnedPayloadBytes!==0))
   throw Error('Jan10 2023 original empty caption attribution changed');
  if(audioOnly||empty)noTimed++;
  actualTimed+=row.timedCaptionRowsVisible;actuallyRead+=read;
  thirdUnreviewed+=req-read;sourceCount++;
  source.set(row.originalMtgid,{
    year:2023,committeeName:row.committeeName,originalHearingDate:row.originalHearingDate,
    originalMtgid:row.originalMtgid,officialOriginalPageUrl:row.originalMediaRecordUrl,
    previouslyVerifiedOriginalPageHtmlSha256:row.previouslyVerifiedOriginalPageHtmlSha256,
    safeCaptionRequestCandidates:req,captionRequestsInspected:read,
    pinnedOriginalCaptionPayloadSha256s:row.captionPayloadSha256s,
    pinnedOriginalCaptionBytes:row.returnedPayloadBytes,
    pinnedOriginalTimedCaptionRows:row.timedCaptionRowsVisible,
    unreviewedExtraCaptionRequestCount:req-read,
    captionSourceHold:audioOnly?'no_video_caption_interface':empty?'empty_original_caption':'none',
    originalSourceKind:'first_failed_parent_partial',
    originalHtmlAndPriorCaptionProofReconciled:true
  });
 }
 if(actualTimed!==cfg.first.timestampMarkers||actuallyRead!==cfg.first.captionRequestsInspected
  ||noTimed!==6||thirdUnreviewed!==1||sourceCount!==62)
  throw Error('First 2023 source-shard stream count, caption holds or extra link not conserved');
 let retryTimed=0;
 for(let i=0;i<retry.records.length;i++){
  const r=retry.records[i]!;
  const expectedId=cfg.twoOriginalRetryMtgids[i]!;
  const c=r.captionResponses[0];
  if(!c||r.originalMtgid!==expectedId
   ||r.year!==2023||r.committeeName!=='Taxes'
   ||r.originalHearingDate!==['2023-01-12','2023-02-08'][i]
   ||r.officialOriginalPageUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+expectedId
   ||!DIGEST.test(r.originalHtmlSha256)
   ||r.captionRequestCandidates!==1||r.safeCaptionRequests!==1
   ||r.captionResponses.length!==1||c.status!=='caption_timed_rows_observed'
   ||!DIGEST.test(c.originalPayloadSha256)||c.originalPayloadBytes<=0
   ||!Number.isSafeInteger(c.timedCaptionRows)||c.timedCaptionRows<=0
   ||c.timedCaptionRows!==r.totalTimedCaptionMarkers
   ||r.originalHtmlPageShaReverified!==true
   ||r.noMediaOrTranscriptStored!==true||r.noVoteOrSpeakerCertified!==true
   ||source.has(r.originalMtgid))
   throw Error('2023 exact second-run recovered original not independently SHA-proven');
  retryTimed+=c.timedCaptionRows;
  source.set(expectedId,{
    year:2023,committeeName:r.committeeName,originalHearingDate:r.originalHearingDate,
    originalMtgid:expectedId,officialOriginalPageUrl:r.officialOriginalPageUrl,
    previouslyVerifiedOriginalPageHtmlSha256:r.originalHtmlSha256,
    safeCaptionRequestCandidates:1,captionRequestsInspected:1,
    pinnedOriginalCaptionPayloadSha256s:[c.originalPayloadSha256],
    pinnedOriginalCaptionBytes:c.originalPayloadBytes,
    pinnedOriginalTimedCaptionRows:c.timedCaptionRows,
    unreviewedExtraCaptionRequestCount:0,captionSourceHold:'none',
    originalSourceKind:'successful_two_record_retry',
    originalHtmlAndPriorCaptionProofReconciled:true
  });
 }
 if(retryTimed!==cfg.retry.timestampMarkers||source.size!==64
  ||[...source.values()].reduce((n,x)=>n+x.pinnedOriginalTimedCaptionRows,0)
    !==cfg.totalTimestampMarkers
  ||[...source.values()].filter(x=>x.pinnedOriginalTimedCaptionRows>0).length!==cfg.timedCaptionPages
  ||[...source.values()].reduce((n,x)=>n+x.captionRequestsInspected,0)!==64
  ||[...source.values()].reduce((n,x)=>n+x.unreviewedExtraCaptionRequestCount,0)!==1)
  throw Error('Combined verified 2023 caption page/multistream source denominator changed');
 return source;
}

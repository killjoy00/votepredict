/**
 * #864: independently SHA-verify all 41 original 2024 Senate unlinked-minutes
 * caption provenance records before opening any source text for motion-CUE review.
 * No member/vote/quote authentication and no private DB actions.
 */
import {createHash} from 'node:crypto';
export const ORIGINAL_2024_CAPTION_PROOF={
  schema:'senate-2022-25-138-original-media-record-caption-surface-proof-v1',
  priorRunId:38103766440,
  artifactId:11688174345,
  sourceZipSha256:'abb6130e6c9b5cdb5600453ba86ac94dc88a3bc22976e1518b084824eada1305',
  sourceJsonSha256:'5bcc3c7b15d80ddfe37b34b7b2df025251f8ea9f91cf35ecfffe0fdf93402ccd',
  sourceJsonBytes:42908,
  year:2024,
  exactRecords:41,
  totalTimedCaptionMarkers:122128,
  committeeCounts:{
    'Taxes':23,
    'State and Local Government and Veterans':13,
    'Jobs and Economic Development':3,
    'Energy, Utilities, Environment and Climate':1,
    'Health and Human Services':1,
  },
} as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export interface Original2024CaptionRecord{
  year:2024;committeeName:string;originalHearingDate:string;
  originalMediaRecordUrl:string;originalMtgid:string;
  previouslyVerifiedOriginalPageHtmlSha256:string;
  captionRequestCandidates:number;safeCaptionRequestCandidates:number;
  rejectedCaptionRequestCandidates:number;inspectedCaptionRequests:number;
  captionApiStatusCategories:string[];
  timedCaptionRowsVisible:number;returnedPayloadBytes:number;
  captionPayloadSha256s:string[];
  sourcePageReselectedSameOriginalHash:boolean;
  noRecordedMediaFileDownloaded:boolean;
  noCaptionTextPublished:boolean;
  noSpeakerOrNamedYeaNayProven:boolean;
  playbackNotVerified:boolean;
}
export function sourcePinned2024CaptionRecords(raw:string){
  const bytes=Buffer.byteLength(raw,'utf8');
  if(bytes!==ORIGINAL_2024_CAPTION_PROOF.sourceJsonBytes
   ||sha(raw)!==ORIGINAL_2024_CAPTION_PROOF.sourceJsonSha256)
    throw Error('Original 2024 41-caption research source JSON bytes/SHA mismatch');
  const j=JSON.parse(raw) as {
    schemaVersion:string;year:number;
    originalSourceHrefArtifactId:number;pinnedOriginalHrefJsonSha256:string;
    previouslyVerifiedOriginalHtmlSourceArtifactId:number;
    pinnedPreviousHtmlSourceJsonSha256:string;
    totals:{
      officialOriginalMediaRecordsExpected:number;originalHtmlPagesReverified:number;
      originalHtmlPageFailures:number;captionRequestCandidatePages:number;
      safeCaptionRequestPages:number;captionEndpointRequestsMade:number;
      pagesWithTimedCaptionRows:number;totalCaptionTimestampMarkers:number;
      pagesWithCaptionHttpOrContentFailure:number;
    };
    records:Original2024CaptionRecord[];failures:unknown[];
  };
  const t=j.totals;
  if(j.schemaVersion!==ORIGINAL_2024_CAPTION_PROOF.schema||j.year!==2024
    ||j.originalSourceHrefArtifactId!==11679701503
    ||j.pinnedOriginalHrefJsonSha256!=='fd09197149998c792bb6c6195c59811d6b14cb4cdcd9f783055bff287035eef2'
    ||j.previouslyVerifiedOriginalHtmlSourceArtifactId!==11680254175
    ||j.pinnedPreviousHtmlSourceJsonSha256!=='b32b49fcb3d85184a357fead01df1319698cd8505dfa2f562fed7e55d4f00fe0'
    ||t.officialOriginalMediaRecordsExpected!==41||t.originalHtmlPagesReverified!==41
    ||t.originalHtmlPageFailures!==0||t.captionRequestCandidatePages!==41
    ||t.safeCaptionRequestPages!==41||t.captionEndpointRequestsMade!==41
    ||t.pagesWithTimedCaptionRows!==41||t.totalCaptionTimestampMarkers!==122128
    ||t.pagesWithCaptionHttpOrContentFailure!==0
    ||j.records.length!==41||j.failures.length!==0)
    throw Error('Original 2024 official caption availability counts drifted');
  const map=new Map<string,Original2024CaptionRecord>();
  const committeeCount=new Map<string,number>();
  let totalTime=0;
  for(const row of j.records){
    if(row.year!==2024||!/^2024-\d\d-\d\d$/.test(row.originalHearingDate)
      ||!/^\d{5,12}$/.test(row.originalMtgid)
      ||row.originalMediaRecordUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+row.originalMtgid
      ||!/^[a-f0-9]{64}$/.test(row.previouslyVerifiedOriginalPageHtmlSha256)
      ||row.captionRequestCandidates!==1||row.safeCaptionRequestCandidates!==1
      ||row.rejectedCaptionRequestCandidates!==0||row.inspectedCaptionRequests!==1
      ||row.captionApiStatusCategories.length!==1
      ||row.captionApiStatusCategories[0]!=='caption_timed_rows_observed'
      ||row.captionPayloadSha256s.length!==1
      ||!/^[a-f0-9]{64}$/.test(row.captionPayloadSha256s[0]!)
      ||!Number.isSafeInteger(row.timedCaptionRowsVisible)||row.timedCaptionRowsVisible<1
      ||!Number.isSafeInteger(row.returnedPayloadBytes)
      ||row.returnedPayloadBytes<100||row.returnedPayloadBytes>1500000
      ||row.sourcePageReselectedSameOriginalHash!==true
      ||row.noRecordedMediaFileDownloaded!==true
      ||row.noCaptionTextPublished!==true
      ||row.noSpeakerOrNamedYeaNayProven!==true
      ||row.playbackNotVerified!==true
      ||map.has(row.originalMtgid))
      throw Error('Unrecognized original 2024 caption source record');
    map.set(row.originalMtgid,row);
    totalTime+=row.timedCaptionRowsVisible;
    committeeCount.set(row.committeeName,(committeeCount.get(row.committeeName)??0)+1);
  }
  if(totalTime!==122128
    ||Object.keys(ORIGINAL_2024_CAPTION_PROOF.committeeCounts).length!==committeeCount.size
    ||Object.entries(ORIGINAL_2024_CAPTION_PROOF.committeeCounts).some(
        ([name,count])=>committeeCount.get(name)!==count))
    throw Error('Original 2024 committee/timestamp source identity drift');
  return map;
}

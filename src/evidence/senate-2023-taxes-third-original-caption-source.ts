/** Issue #864: one never-reviewed third caption link from the SAME original
 * 2023-04-27 Senate Taxes archive hearing. Only source metadata, never
 * senator YEA/NAY, recorded motion, video/audio playback or quote text.
 */
import {createHash} from 'node:crypto';
export const ORIGINAL_APR27_TAXES_CAPTION_SOURCE={
  year:2023,hearingDate:'2023-04-27',committeeName:'Taxes',
  officialMtgid:'1048125',
  exactOriginalMediaUrl:'https://www.lrl.mn.gov/media/file?mtgid=1048125',
  exactOriginalPageHtmlSha256:'82f26b59ad2210b3b46682a7000a9c237473a71359c3fd72645889b4d86fcf08',
  originalFirstCaptionRunId:38103766440,
  originalFirstRunConclusion:'failure',
  originalFirstArtifactId:11688587941,
  originalFirstArtifactJsonBytes:64282,
  originalFirstArtifactJsonSha256:'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4',
  originalFirstTwoCaptionPayloadSha256s:[
    '312b36d875952203c1605b3926550d730e2d66ab33f6dd9fc2b34693cb6cdc68',
    '90141a530077bfdf1c8b79a86f80b860c39af786e60de9710ab67cc0e8846321'
  ],
  previousOriginalTwoPayloadTotalBytes:524678,
  previousOriginalTwoPayloadTimestampMarkers:3116,
  originalCaptionInterfaceLinks:3,previouslyInspectedCaptionLinks:2,
  previouslyUninspectedCaptionIndex:2,
} as const;
const sha=(r:string)=>createHash('sha256').update(r).digest('hex');
export function verifyOriginalApr27ThirdCaptionLead(firstCaptionJson:string){
 const p=ORIGINAL_APR27_TAXES_CAPTION_SOURCE;
 if(Buffer.byteLength(firstCaptionJson,'utf8')!==p.originalFirstArtifactJsonBytes
  ||sha(firstCaptionJson)!==p.originalFirstArtifactJsonSha256)
  throw Error('Original 2023 partial-run caption source artifact full bytes/SHA changed');
 const j=JSON.parse(firstCaptionJson) as {
   schemaVersion:string;year:number;totals:{originalHtmlPagesReverified:number;
   originalHtmlPageFailures:number};
   failures:unknown[];records:Array<{
    year:number;committeeName:string;originalHearingDate:string;
    originalMediaRecordUrl:string;originalMtgid:string;
    previouslyVerifiedOriginalPageHtmlSha256:string;
    captionRequestCandidates:number;safeCaptionRequestCandidates:number;
    rejectedCaptionRequestCandidates:number;inspectedCaptionRequests:number;
    captionApiStatusCategories:string[];captionPayloadSha256s:string[];
    timedCaptionRowsVisible:number;returnedPayloadBytes:number;
    sourcePageReselectedSameOriginalHash:boolean;
   }>
 };
 if(j.schemaVersion!=='senate-2022-25-138-original-media-record-caption-surface-proof-v1'
  ||j.year!==2023||j.totals.originalHtmlPagesReverified!==62
  ||j.totals.originalHtmlPageFailures!==2||j.failures.length!==2)
  throw Error('Previously partially failed source run status must remain authentic');
 const rows=j.records.filter(r=>r.originalMtgid===p.officialMtgid);
 if(rows.length!==1)throw Error('Original April27 Taxes source record missing or duplicated');
 const r=rows[0]!;
 if(r.year!==p.year||r.originalHearingDate!==p.hearingDate
  ||r.committeeName!==p.committeeName||r.originalMediaRecordUrl!==p.exactOriginalMediaUrl
  ||r.previouslyVerifiedOriginalPageHtmlSha256!==p.exactOriginalPageHtmlSha256
  ||r.captionRequestCandidates!==p.originalCaptionInterfaceLinks
  ||r.safeCaptionRequestCandidates!==p.originalCaptionInterfaceLinks
  ||r.rejectedCaptionRequestCandidates!==0
  ||r.inspectedCaptionRequests!==p.previouslyInspectedCaptionLinks
  ||r.captionApiStatusCategories.length!==2
  ||r.captionApiStatusCategories.some(x=>x!=='caption_timed_rows_observed')
  ||r.captionPayloadSha256s.length!==2
  ||r.captionPayloadSha256s.some((x,i)=>x!==p.originalFirstTwoCaptionPayloadSha256s[i])
  ||r.returnedPayloadBytes!==p.previousOriginalTwoPayloadTotalBytes
  ||r.timedCaptionRowsVisible!==p.previousOriginalTwoPayloadTimestampMarkers
  ||r.sourcePageReselectedSameOriginalHash!==true)
  throw Error('April27 extra caption source was previously inspected or source identity drifted');
 return {mtgid:p.officialMtgid,verifiedTwoOriginalStreams:2,remainingUninspectedStreams:1};
}

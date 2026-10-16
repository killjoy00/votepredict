/** #864: exact original 2022 Senate no-Minutes caption research source proof.
 *
 * Twelve original caption requests across 11 dated media pages; one April 4
 * source has TWO independently SHA-pinned caption payloads. Do not collapse
 * these into a single motion or interpret duplicated timing as two votes.
 */
import {createHash} from 'node:crypto';
export const ORIGINAL_2022_CAPTION_SOURCE={
  schema:'senate-2022-25-138-original-media-record-caption-surface-proof-v1',
  year:2022,priorRunId:38103766440,artifactId:11687874692,
  originalZipSha256:'f2c6628ebea5179c340dd2048c9490a5bfc3d572d596724d0a7d4f46d6388ab7',
  originalJsonSha256:'afcf73a3b757241ed9da987b2df62d455d53e2296c59a493af87cac7e3ba60d4',
  originalJsonBytes:12946,
  expectedMediaPages:11,
  pagesWithTimedCaptions:10,
  exactCaptionRequests:12,
  allTimestampMarkers:24147,
  noTimedCaption:{
    indexedHearingDate:'2022-03-15',committee:'Housing Finance and Policy',
    mtgid:'1046040',originalPayloadSha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },
  twoDistinctCaptionSources:{
    indexedHearingDate:'2022-04-04',committee:'Education Finance and Policy',
    mtgid:'1046323',requestCount:2
  },
} as const;
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
export type Original2022CaptionRow={
  year:number;committeeName:string;originalHearingDate:string;originalMediaRecordUrl:string;
  originalMtgid:string;previouslyVerifiedOriginalPageHtmlSha256:string;
  captionRequestCandidates:number;safeCaptionRequestCandidates:number;
  rejectedCaptionRequestCandidates:number;inspectedCaptionRequests:number;
  captionApiStatusCategories:string[];timedCaptionRowsVisible:number;
  returnedPayloadBytes:number;captionPayloadSha256s:string[];
  sourcePageReselectedSameOriginalHash:boolean;noRecordedMediaFileDownloaded:boolean;
  noCaptionTextPublished:boolean;noSpeakerOrNamedYeaNayProven:boolean;
  playbackNotVerified:boolean;
};
export function sourcePinned2022CaptionRecords(raw:string){
 const p=ORIGINAL_2022_CAPTION_SOURCE;
 if(Buffer.byteLength(raw,'utf8')!==p.originalJsonBytes
   ||sha(raw)!==p.originalJsonSha256)
  throw Error('Original 2022 caption source JSON length/SHA256 drift');
 const j=JSON.parse(raw) as {
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
  records:Original2022CaptionRow[];failures:unknown[];
 };
 const t=j.totals;
 if(j.schemaVersion!==p.schema||j.year!==2022
   ||j.originalSourceHrefArtifactId!==11679835908
   ||j.pinnedOriginalHrefJsonSha256!=='f0ab42ba46eca582739896956b5dc32a81e6c93b9b834e45eb539c49f19cfd4f'
   ||j.previouslyVerifiedOriginalHtmlSourceArtifactId!==11680881578
   ||j.pinnedPreviousHtmlSourceJsonSha256!=='29cefe409462e52ed21251053af2c7fc3f3240d01248cecb4fb3f0312880c6e5'
   ||t.officialOriginalMediaRecordsExpected!==11||t.originalHtmlPagesReverified!==11
   ||t.originalHtmlPageFailures!==0||t.captionRequestCandidatePages!==11
   ||t.safeCaptionRequestPages!==11||t.captionEndpointRequestsMade!==12
   ||t.pagesWithTimedCaptionRows!==10||t.totalCaptionTimestampMarkers!==24147
   ||t.pagesWithCaptionHttpOrContentFailure!==0
   ||j.records.length!==11||j.failures.length!==0)
  throw Error('Original 2022 official LRL caption-year totals drift');
 const map=new Map<string,Original2022CaptionRow>();
 let total=0,requests=0,noTimed=0;
 for(const r of j.records){
  const expectedCount=r.originalMtgid===p.twoDistinctCaptionSources.mtgid?2:1;
  const zero=r.originalMtgid===p.noTimedCaption.mtgid;
  if(r.year!==2022||!/^2022-\d\d-\d\d$/.test(r.originalHearingDate)
    ||r.originalMediaRecordUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+r.originalMtgid
    ||!/^[a-f0-9]{64}$/.test(r.previouslyVerifiedOriginalPageHtmlSha256)
    ||r.captionRequestCandidates!==expectedCount||r.safeCaptionRequestCandidates!==expectedCount
    ||r.rejectedCaptionRequestCandidates!==0||r.inspectedCaptionRequests!==expectedCount
    ||r.captionApiStatusCategories.length!==expectedCount
    ||r.captionPayloadSha256s.length!==expectedCount
    ||r.captionPayloadSha256s.some(x=>!/^[a-f0-9]{64}$/.test(x))
    ||r.captionApiStatusCategories.some(x=>x!==(zero?'caption_payload_no_timed_rows':'caption_timed_rows_observed'))
    ||!Number.isSafeInteger(r.timedCaptionRowsVisible)
    ||(zero?r.timedCaptionRowsVisible!==0:r.timedCaptionRowsVisible<=0)
    ||!Number.isSafeInteger(r.returnedPayloadBytes)||r.returnedPayloadBytes<0
    ||r.returnedPayloadBytes>expectedCount*1_500_000
    ||r.sourcePageReselectedSameOriginalHash!==true
    ||r.noRecordedMediaFileDownloaded!==true||r.noCaptionTextPublished!==true
    ||r.noSpeakerOrNamedYeaNayProven!==true||r.playbackNotVerified!==true
    ||map.has(r.originalMtgid))
   throw Error('Untrusted original 2022 caption source record');
  if(zero&&(r.originalHearingDate!==p.noTimedCaption.indexedHearingDate
   ||r.committeeName!==p.noTimedCaption.committee
   ||r.returnedPayloadBytes!==0
   ||r.captionPayloadSha256s[0]!==p.noTimedCaption.originalPayloadSha256))
   throw Error('2022 empty Housing caption request improperly promoted');
  if(expectedCount===2&&(r.originalHearingDate!==p.twoDistinctCaptionSources.indexedHearingDate
   ||r.committeeName!==p.twoDistinctCaptionSources.committee))
   throw Error('2022 two-caption Education hearing mislabeled');
  if(zero)noTimed++;
  requests+=expectedCount;total+=r.timedCaptionRowsVisible;
  map.set(r.originalMtgid,r);
 }
 if(map.size!==11||requests!==12||noTimed!==1||total!==p.allTimestampMarkers)
  throw Error('Original 2022 multi-source/empty-caption source total not conserved');
 return map;
}

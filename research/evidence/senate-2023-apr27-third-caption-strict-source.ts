/** #864: original third 2023 Apr27 Taxes caption payload now independently
 * SHA-authenticated. Only time/category cues; no senator, motion or vote proof.
 */
import {createHash} from 'node:crypto';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const PROVEN_2023_APR27_THIRD_CAPTION={
  originalSourceRunId:38110655145,
  originalSourceRunConclusion:'success',
  sourceImplementationPr:1039,
  sourceImplementationMergeSha:'c62c2fdf0168b036b7328aeaf86a7e62d9c0d136',
  originalArtifactId:11691229670,
  sourceArtifactZipSha256:'c00437bee62646e48ffebc503e75a32f7ee24ba130ea4d363e72acfc36b55397',
  sourceUncompressedJsonSha256:'1d97c6f530c22dca4ca37d59f5a0004bfe8d9e2cbce525fc910cf8247a46c714',
  sourceUncompressedJsonBytes:2072,
  schema:'senate-2023-apr27-third-previously-unseen-official-caption-source-proof-v1',
  mediaMtgid:'1048125',
  meetingDate:'2023-04-27',
  committee:'Taxes',
  originalMediaUrl:'https://www.lrl.mn.gov/media/file?mtgid=1048125',
  originalHtmlSha256:'82f26b59ad2210b3b46682a7000a9c237473a71359c3fd72645889b4d86fcf08',
  thirdOriginalCaptionStreamOrdinal:2,
  thirdOriginalCaptionFilenameSha256:'e4d5c618e495af33b2a6301ffd9d97cf969b3a5b0dae4ffc877963efbcdd7837',
  thirdOriginalCaptionBodySha256:'2b76c31f7ece2a26b60de38493f7ddff43f48bc386ed0260f86c0a8e984ccd10',
  thirdOriginalCaptionBodyBytes:234392,
  thirdOriginalTimestampMarkers:1390,
} as const;
export function verifyProven2023Apr27ThirdCaptionJson(raw:string){
 const p=PROVEN_2023_APR27_THIRD_CAPTION;
 if(Buffer.byteLength(raw,'utf8')!==p.sourceUncompressedJsonBytes
   ||sha(raw)!==p.sourceUncompressedJsonSha256)
  throw Error('Actual original third-caption source ZIP-extracted JSON SHA or length changed');
 const j=JSON.parse(raw) as {
  schemaVersion:string;issue:number;hearingYear:number;
  indexedHearingDate:string;committeeName:string;officialMediaRecordUrl:string;
  mtgid:string;priorFirstCaptionSourceRunId:number;originalFirstRunConclusion:string;
  exactPinnedOriginalHtmlSha256:string;previouslyUninspectedOriginalCaptionTrackOrdinal:number;
  sourceStatus:string;sourceResult:{
   sourcePageHtmlSHAReverified:boolean;safeOriginalCaptionLinkCount:number;
   thirdOriginalCaptionInterfaceIndex:number;originalThirdTrackFilenameSha256:string;
   thirdCaptionSourceStatus:string;thirdPayloadSha256:string;thirdPayloadBytes:number;
   thirdOriginalCaptionTimestampMarkers:number;sourceError:null|string
  };
  thirdCaptionInterfaceCheckedOnlyAfterOriginalHtmlSha:boolean;
  didNotRedownloadEarlierTwoOriginalCaptionPayloads:boolean;
  didNotDownloadAudioVideoBodies:boolean;didNotStoreRawCaptionWords:boolean;
  noRecordedNamedVoteOrBillStanceCertified:boolean;issue864MustRemainOpen:boolean;
 };
 const r=j.sourceResult;
 if(j.schemaVersion!==p.schema||j.issue!==864||j.hearingYear!==2023
   ||j.indexedHearingDate!==p.meetingDate||j.committeeName!==p.committee
   ||j.officialMediaRecordUrl!==p.originalMediaUrl||j.mtgid!==p.mediaMtgid
   ||j.priorFirstCaptionSourceRunId!==38103766440
   ||j.originalFirstRunConclusion!=='failure'
   ||j.exactPinnedOriginalHtmlSha256!==p.originalHtmlSha256
   ||j.previouslyUninspectedOriginalCaptionTrackOrdinal!==2
   ||j.sourceStatus!=='third_original_caption_source_status_observed'
   ||r.sourcePageHtmlSHAReverified!==true
   ||r.safeOriginalCaptionLinkCount!==3||r.thirdOriginalCaptionInterfaceIndex!==2
   ||r.originalThirdTrackFilenameSha256!==p.thirdOriginalCaptionFilenameSha256
   ||r.thirdCaptionSourceStatus!=='caption_timed_rows_observed'
   ||r.thirdPayloadSha256!==p.thirdOriginalCaptionBodySha256
   ||r.thirdPayloadBytes!==p.thirdOriginalCaptionBodyBytes
   ||r.thirdOriginalCaptionTimestampMarkers!==p.thirdOriginalTimestampMarkers
   ||r.sourceError!==null
   ||j.thirdCaptionInterfaceCheckedOnlyAfterOriginalHtmlSha!==true
   ||j.didNotRedownloadEarlierTwoOriginalCaptionPayloads!==true
   ||j.didNotDownloadAudioVideoBodies!==true||j.didNotStoreRawCaptionWords!==true
   ||j.noRecordedNamedVoteOrBillStanceCertified!==true
   ||j.issue864MustRemainOpen!==true)
  throw Error('Actual previously uninspected third original caption source could not be authenticated');
 return {originalMtgid:p.mediaMtgid,thirdSourceCaptionSha256:p.thirdOriginalCaptionBodySha256};
}

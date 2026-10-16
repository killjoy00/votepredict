/** #864: one original previously GET-failed 2022 Senate committee hearing.
 * The actual parent source run failed; never label it 11/11 success.
 * Only source metadata and no named member voting evidence.
 */
import {createHash} from 'node:crypto';
export const ORIGINAL_2022_FEB08_RETRY={
 originalHearingYear:2022,hearingDate:'2022-02-08',
 committeeName:'Environment and Natural Resources Finance',
 mtgid:'1045607',
 originalPageUrl:'https://www.lrl.mn.gov/media/file?mtgid=1045607',
 originalPageHtmlSha256:'342a43b65a652fabcaa69c10c61fea25728b3f302e2559fa64c40dc6be42adb1',
 originalCaptionPayloadSha256:'7f11f63f10ea03d899c0555c76e6c8e99aec8b34c50f9900bc50e9067c36b66e',
 originalCaptionPayloadBytes:440730,
 originalTimestampMarkers:2615,
 firstSourceRunId:38110343054,
 firstSourceRunConclusion:'failure',
 firstRunArtifactId:11691578389,
 firstRunArtifactZipSha256:'a9decadea79c69858f41a85f03aaac410e2aebaab7d791d34c4872704ede98f7',
 firstRunArtifactJsonSha256:'b223b015014ec3444ffe7dae4bd2b85515e9602b9111f2ce9dbf00917a347c29',
 firstRunArtifactJsonBytes:39773,
 priorTimedPageCount:9,
 priorNoTimePageHolds:1,
 priorOriginalHtmlPagesVerified:10,
 priorOriginalSourceFailures:1,
 priorTimedCaptionStreamsVerified:10,
 priorTimestampMarkers:21532,
} as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function checkActualFirstFailed2022CaptionCueRun(originalSourceJson:string){
 const p=ORIGINAL_2022_FEB08_RETRY;
 if(Buffer.byteLength(originalSourceJson,'utf8')!==p.firstRunArtifactJsonBytes
  ||sha(originalSourceJson)!==p.firstRunArtifactJsonSha256)
  throw Error('Original partially failed 2022 source run payload bytes/SHA mismatch');
 const j=JSON.parse(originalSourceJson) as {
  schemaVersion:string;totals:{
    originalDatedIndexRecordLeads:number;originalPagesHtmlShaReverified:number;
    sourceRecordFailures:number;originalPagesWithTimedCaptionSource:number;
    originalPagesNoTimedCaptionHold:number;independentlyAuthenticatedTimedCaptionStreams:number;
    originalTimestampMarkersFromVerifiedStreams:number;
  };
  records:Array<{originalHearingDate:string;originalMediaMtgid:string}>;
  failures:Array<{hearingDate:string;mtgid:string;reason:string}>;
 };
 const t=j.totals;
 if(j.schemaVersion!=='senate-2022-11-unlinked-original-caption-ten-timed-pages-procedural-cues-v1'
  ||t.originalDatedIndexRecordLeads!==11||t.originalPagesHtmlShaReverified!==10
  ||t.sourceRecordFailures!==1||t.originalPagesWithTimedCaptionSource!==9
  ||t.originalPagesNoTimedCaptionHold!==1
  ||t.independentlyAuthenticatedTimedCaptionStreams!==10
  ||t.originalTimestampMarkersFromVerifiedStreams!==21532
  ||j.records.length!==10||j.failures.length!==1
  ||j.failures[0]!.mtgid!==p.mtgid
  ||j.failures[0]!.hearingDate!==p.hearingDate
  ||j.failures[0]!.reason!=='fetch failed'
  ||j.records.some(x=>x.originalMediaMtgid===p.mtgid))
  throw Error('Original Feb08 2022 failed-source identity or first-run failure changed');
 return {year:2022,mtgid:p.mtgid,firstRunActualStatus:'failure' as const};
}

/**
 * #864: ORIGINAL 2024 caption motion-cue first run failed 4/41 HTTP GETs.
 * Pin exact source JSON bytes and two independent original source inventories.
 * This is only metadata/candidate timing, never confirmed motions or votes.
 */
import {createHash} from 'node:crypto';

export const ORIGINAL_2024_FOUR_RETRY_SOURCE={
  previousRunId:38109706957,
  previousRunStatus:'failure',
  previousArtifactId:11691581526,
  previousZipSha256:'d65e12e91b20aadbf23e1ca8a2815820253ac4bb622e352d4514ad97e6a76a03',
  previousJsonSha256:'beaa3b011257804a2672d751d07b514caa4e2f7f2dba3f238882499db4855823',
  previousJsonBytes:293209,
  expectedSourceRecords:41,
  firstVerifiedSourceRecords:37,
  firstFailedOriginalHtmlFetches:4,
  firstActualTimedMarkers:110581,
  firstStrictCueWindows:588,
  previousTopLevelStrictCueTotal:null,
} as const;
export const EXACT_2024_FOUR_FAILURES=[
  {date:'2024-02-14',mtgid:'1049197',committee:'Taxes'},
  {date:'2024-02-15',mtgid:'1049227',committee:'Taxes'},
  {date:'2024-02-19',mtgid:'1049249',committee:'Jobs and Economic Development'},
  {date:'2024-04-03',mtgid:'1049765',committee:'Taxes'},
] as const;
const sha256=(s:string)=>createHash('sha256').update(s).digest('hex');
export function readExact2024FirstFailedSourceJson(raw:string){
  if(Buffer.byteLength(raw)!==ORIGINAL_2024_FOUR_RETRY_SOURCE.previousJsonBytes
    ||sha256(raw)!==ORIGINAL_2024_FOUR_RETRY_SOURCE.previousJsonSha256)
    throw Error('Original 2024 first partial-source JSON byte SHA drift');
  const j=JSON.parse(raw) as {
    schemaVersion:string;issue:number;
    totals:{expectedIndexedNoMinutesMediaLeads:number;
      exactOriginalPageAndCaptionBodyShaVerified:number;
      originalSourceFailures:number;totalCaptionTimestampMarkers:number;
      totalCueCategoryThirtySecondWindows:number|null;
      preservedUnverifiedReviewWindows:number;overflowNotIncludedInReviewWindows:number};
    records:Array<{originalMediaMtgid:string;
      categoryThirtySecondWindowsNotDistinctMotions:number;
      sourceReviewCueTimeWindows:unknown[];cueWindowsAboveOutputCap:number}>;
    failures:Array<{hearingDate:string;mtgid:string;reason:string}>;
  };
  const t=j.totals;
  if(j.schemaVersion!=='senate-2024-41-unlinked-original-caption-procedural-motion-cue-review-v1'
    ||j.issue!==864||t.expectedIndexedNoMinutesMediaLeads!==41
    ||t.exactOriginalPageAndCaptionBodyShaVerified!==37
    ||t.originalSourceFailures!==4||t.totalCaptionTimestampMarkers!==110581
    ||t.totalCueCategoryThirtySecondWindows!==null
    ||t.preservedUnverifiedReviewWindows!==588
    ||t.overflowNotIncludedInReviewWindows!==0
    ||j.records.length!==37||j.failures.length!==4
    ||new Set(j.records.map(r=>r.originalMediaMtgid)).size!==37
    ||j.records.some(r=>EXACT_2024_FOUR_FAILURES.some(f=>r.originalMediaMtgid===f.mtgid))
    ||j.records.reduce((n,r)=>n+r.categoryThirtySecondWindowsNotDistinctMotions,0)!==588
    ||j.records.some(r=>r.sourceReviewCueTimeWindows.length+r.cueWindowsAboveOutputCap
      !==r.categoryThirtySecondWindowsNotDistinctMotions)
    ||j.failures.some((x,i)=>x.hearingDate!==EXACT_2024_FOUR_FAILURES[i]!.date
      ||x.mtgid!==EXACT_2024_FOUR_FAILURES[i]!.mtgid
      ||x.reason!=='fetch failed'))
    throw Error('Original 2024 first failed-run exact source facts or failures drifted');
  return j;
}

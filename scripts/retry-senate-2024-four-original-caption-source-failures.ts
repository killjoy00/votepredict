/** #864 one-time bounded retry of EXACTLY FOUR failed 2024 original LRL Senate media pages. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectPinnedMtgidRecords} from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
 from '../src/evidence/senate-committee-138-caption-surface.js';
import {sourcePinned2024CaptionRecords}
 from '../src/evidence/senate-committee-2024-caption-motion-source.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {retrieveVerifiedOfficialCaptionMarkup}
 from '../src/evidence/senate-committee-caption-motion-cues.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../src/evidence/senate-committee-caption-motion-cues-v2.js';
import {EXACT_2024_FOUR_FAILURES,ORIGINAL_2024_FOUR_RETRY_SOURCE,
 readExact2024FirstFailedSourceJson}
 from '../src/evidence/senate-committee-2024-four-exact-caption-failure-retry.js';

const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/g,'[official source]').slice(0,150);

export async function originalFourRetryMain(argv:string[]){
 if(argv.length!==10||argv[0]!=='--hrefs'||argv[2]!=='--original-html'||
   argv[4]!=='--prior-caption'||argv[6]!=='--first-failed-run'||argv[8]!=='--output')
   throw Error('Require exact --hrefs FILE --original-html FILE --prior-caption FILE --first-failed-run FILE --output FILE');
 const [href,html,caption,failed,out]=[argv[1]!,argv[3]!,argv[5]!,argv[7]!,argv[9]!]
   .map(p=>resolve(p));
 const rows=selectPinnedMtgidRecords(2024,readFileSync(href,'utf8'));
 const originals=readExactPriorMediaHtmlProof(2024,readFileSync(html,'utf8'));
 const originalCaption=sourcePinned2024CaptionRecords(readFileSync(caption,'utf8'));
 const first=readExact2024FirstFailedSourceJson(readFileSync(failed,'utf8'));
 if(rows.length!==41||originals.size!==41||originalCaption.size!==41
    ||first.failures.length!==4)throw Error('Original 2024 all-three-source provenance incomplete');
 const targets=EXACT_2024_FOUR_FAILURES.map(target=>{
  const row=rows.find(r=>r.mtgid===target.mtgid);
  const original=originals.get(target.mtgid),prior=originalCaption.get(target.mtgid);
  if(!row||!original||!prior||row.year!==2024||row.meetingDate!==target.date
    ||row.committeeName!==target.committee||row.mediaUrl!==original.exactOriginalMediaRecordUrl
    ||row.mediaUrl!==prior.originalMediaRecordUrl
    ||original.originalHtmlSha256!==prior.previouslyVerifiedOriginalPageHtmlSha256
    ||row.mediaUrl!=='https://www.lrl.mn.gov/media/file?mtgid='+target.mtgid)
    throw Error('One of the four original failed meeting IDs cannot be bound to dated primary source');
  return row;
 });
 const allowed=new Set(targets.map(t=>t.mediaUrl));
 const succeeded:Array<Record<string,unknown>>=[];
 const failures:Array<{originalHearingDate:string;mtgid:string;reason:string}>=[];
 for(const row of targets){
  try{
   const page=await fetchBoundedSenateMediaRecordHtml(row.mediaUrl,allowed);
   const source=inspectMediaPageCaptionSurface(page.html,row.mediaUrl);
   const prior=originalCaption.get(row.mtgid)!;
   if(source.pageOriginalHtmlSha256!==originals.get(row.mtgid)!.originalHtmlSha256
      ||source.safeRequestCandidates.length!==1||source.rejectedRequestCandidates!==0)
     throw Error('Previously original SHA-pinned HTML or safe caption interface drift');
   const request=source.safeRequestCandidates[0]!;
   const result=await retrieveVerifiedOfficialCaptionMarkup(
     request.endpointUrl,row.mediaUrl,prior.captionPayloadSha256s[0]!);
   if(result.bytes!==prior.returnedPayloadBytes)
     throw Error('Previously original SHA-pinned caption byte length drift');
   const cues=findStrict2025OriginalAutoCaptionMotionCues(result.html);
   if(cues.originalTimestampAttributeMarkers!==prior.timedCaptionRowsVisible)
     throw Error('Previously original SHA-pinned caption timestamp markers drift');
   if(!Number.isSafeInteger(cues.categoryThirtySecondWindowsNotDistinctMotions)
     ||cues.sourceReviewCueTimeWindows.length+cues.cueWindowsAboveOutputCap
       !==cues.categoryThirtySecondWindowsNotDistinctMotions)
     throw Error('Strict v2 procedural cue aggregate cannot be trusted');
   succeeded.push({
     year:2024,originalHearingDate:row.meetingDate,originalCommittee:row.committeeName,
     originalMediaMtgid:row.mtgid,officialMediaRecordUrl:row.mediaUrl,
     originalRecordHtmlSha256:source.pageOriginalHtmlSha256,
     originalCaptionBodySha256:result.bodySha256,originalCaptionBodyBytes:result.bytes,
     originalCaptionTimedMarkers:cues.originalTimestampAttributeMarkers,
     strictCueCategoryThirtySecondWindowsNotUniqueMotions:
       cues.categoryThirtySecondWindowsNotDistinctMotions,
     sourceReviewCueTimeWindows:cues.sourceReviewCueTimeWindows,
     sourceCueWindowsAboveCap:cues.cueWindowsAboveOutputCap,
     noOriginalCaptionWordsSaved:true,noSenatorSideCertified:true,
   });
  }catch(e){failures.push({originalHearingDate:row.meetingDate,mtgid:row.mtgid,reason:safe(e)});}
 }
 const totals={
  onlyPreviouslyFailedOriginalRecordsExpected:4,
  originalHTMLAndCaptionSHAReverified:succeeded.length,
  stillFailedOriginalSourceRecords:failures.length,
  totalOriginalCaptionTimeMarkers:succeeded.reduce((n,r)=>n+Number(r.originalCaptionTimedMarkers),0),
  sourceStrictCueCategoryWindowsNotUniqueMotions:succeeded.reduce(
   (n,r)=>n+Number(r.strictCueCategoryThirtySecondWindowsNotUniqueMotions),0),
 };
 const report={
  schemaVersion:'senate-2024-four-failed-original-source-precise-caption-cue-retry-v1',
  issue:864,year:2024,originalSourceAuthority:'Minnesota Legislative Reference Library',
  previousFirstOriginalSourceRunId:ORIGINAL_2024_FOUR_RETRY_SOURCE.previousRunId,
  previousFirstOriginalSourceRunConclusion:'failure',
  previousFirstOriginalSourceArtifactId:ORIGINAL_2024_FOUR_RETRY_SOURCE.previousArtifactId,
  previousFirstOriginalSourceJsonSha256:ORIGINAL_2024_FOUR_RETRY_SOURCE.previousJsonSha256,
  previousOriginalMeetingHrefRunId:38079233118,
  previousOriginalHTMLRunId:38081463362,
  previousOriginalCaptionRunId:38103766440,
  sourceTargetsOnlyPreviouslyFourExactFailedIds:true,
  totals,succeeded,failures,
  noCaptionOrAudioVideoBodiesRetained:true,noNamedVoteSidesDerived:true,
  actual2021to2025RecordedCommitteeVoteDenominator:null,
  noPrivateProductionDbReadOrWrite:true,
  noModelForecastTrainingServingSchedulerFloor2027Changes:true,
  noGovernmentOfficeContact:true,issue864MustRemainOpen:true,
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({year:2024,totals},null,2));
 if(failures.length)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 originalFourRetryMain(process.argv.slice(2)).catch(e=>{console.error(safe(e));process.exitCode=1});
}

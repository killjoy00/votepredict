/** One-record source-only retry, 2022-02-08 Senate Environment Finance
 * LRL missing-minutes caption source, #864. Not member-vote attribution.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {selectPinnedMtgidRecords} from '../../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
 from '../../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../../src/evidence/senate-committee-138-record-html-metadata.js';
import {retrieveVerifiedOfficialCaptionMarkup}
 from '../evidence/senate-committee-caption-motion-cues.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../../src/evidence/senate-committee-caption-motion-cues-v2.js';
import {sourcePinned2022CaptionRecords}
 from '../evidence/senate-committee-2022-caption-motion-source.js';
import {ORIGINAL_2022_FEB08_RETRY,checkActualFirstFailed2022CaptionCueRun}
 from '../evidence/senate-2022-feb08-caption-source-retry.js';

const args=process.argv.slice(2);
if(args.length!==10||args[0]!=='--hrefs'||args[2]!=='--original-html'
 ||args[4]!=='--original-caption'||args[6]!=='--first-failed-run'||args[8]!=='--output')
 throw Error('Exact --hrefs, --original-html, --original-caption, --first-failed-run, --output');
const [href,html,prior,first,out]=[args[1]!,args[3]!,args[5]!,args[7]!,args[9]!].map(s=>resolve(s));
const safe=(x:unknown)=>String(x instanceof Error?x.message:x)
 .replace(/https?:\/\/\S+/gi,'[official LRL source]').slice(0,150);
async function main(){
 const p=ORIGINAL_2022_FEB08_RETRY;
 const originals=selectPinnedMtgidRecords(2022,readFileSync(href,'utf8'));
 const pages=readExactPriorMediaHtmlProof(2022,readFileSync(html,'utf8'));
 const captions=sourcePinned2022CaptionRecords(readFileSync(prior,'utf8'));
 const failed=checkActualFirstFailed2022CaptionCueRun(readFileSync(first,'utf8'));
 if(originals.length!==11||pages.size!==11||captions.size!==11||failed.mtgid!==p.mtgid)
  throw Error('Original 2022 indexed source inventory not complete');
 const matches=originals.filter(x=>x.mtgid===p.mtgid),target=matches[0];
 const prev=pages.get(p.mtgid),known=captions.get(p.mtgid);
 if(matches.length!==1||!target||!prev||!known
  ||target.meetingDate!==p.hearingDate||target.committeeName!==p.committeeName
  ||target.mediaUrl!==p.originalPageUrl
  ||prev.originalHtmlSha256!==p.originalPageHtmlSha256
  ||prev.originalIndexedHearingDate!==p.hearingDate
  ||known.originalHearingDate!==p.hearingDate
  ||known.captionPayloadSha256s.length!==1
  ||known.captionPayloadSha256s[0]!==p.originalCaptionPayloadSha256
  ||known.timedCaptionRowsVisible!==p.originalTimestampMarkers
  ||known.returnedPayloadBytes!==p.originalCaptionPayloadBytes)
  throw Error('Original exact Feb08 historical source identity drift');
 let result:Record<string,unknown>={sourcePageHtmlShaReverified:false,
  captionBodyReverified:false,originalCaptionBodySha256:null,
  originalCaptionBodyBytes:null,originalCaptionTimeMarkers:null,
  proceduralReviewCueTimesNotUniqueMotions:null,sourceError:null};
 let success=false;
 try{
  const page=await fetchBoundedSenateMediaRecordHtml(
    p.originalPageUrl,new Set([p.originalPageUrl]));
  const surface=inspectMediaPageCaptionSurface(page.html,p.originalPageUrl);
  if(surface.pageOriginalHtmlSha256!==p.originalPageHtmlSha256
   ||surface.safeRequestCandidates.length!==1||surface.rejectedRequestCandidates!==0)
   throw Error('Original Feb08 HTML SHA or safe official caption request changed');
  result.sourcePageHtmlShaReverified=true;
  const request=surface.safeRequestCandidates[0]!;
  const body=await retrieveVerifiedOfficialCaptionMarkup(
    request.endpointUrl,p.originalPageUrl,p.originalCaptionPayloadSha256);
  const cue=findStrict2025OriginalAutoCaptionMotionCues(body.html);
  if(body.bytes!==p.originalCaptionPayloadBytes
    ||cue.originalTimestampAttributeMarkers!==p.originalTimestampMarkers)
   throw Error('Original Feb08 caption full-body SHA/bytes/timed markers changed');
  result={...result,captionBodyReverified:true,originalCaptionBodySha256:body.bodySha256,
    originalCaptionBodyBytes:body.bytes,originalCaptionTimeMarkers:cue.originalTimestampAttributeMarkers,
    proceduralReviewCueTimesNotUniqueMotions:{
      matchedRowsByPhraseCategoryNotDistinctMotions:cue.matchedRowsByPhraseCategoryNotDistinctMotions,
      categoryThirtySecondWindowsNotDistinctMotions:cue.categoryThirtySecondWindowsNotDistinctMotions,
      sourceReviewCueTimeWindows:cue.sourceReviewCueTimeWindows,
      cueWindowsAboveOutputCap:cue.cueWindowsAboveOutputCap,
      rawCaptionTextOrHtmlSaved:cue.rawCaptionTextOrHtmlSaved,
      noUniqueMotionOrRecordedSenatorVoteCertified:cue.noUniqueMotionOrRecordedSenatorVoteCertified,
    }};
  success=true;
 }catch(e){result.sourceError=safe(e)}
 const final={
  schemaVersion:'senate-2022-feb08-one-failed-original-caption-source-retry-v1',
  issue:864,authority:'Minnesota Legislative Reference Library',
  year:2022,hearingDate:p.hearingDate,committeeName:p.committeeName,
  originalOfficialMediaRecordUrl:p.originalPageUrl,mtgid:p.mtgid,
  previousOriginalCaptionRunId:38103766440,
  previousOriginal2022CueRunId:p.firstSourceRunId,
  previous2022CueRunConclusion:'failure',
  previousOriginalPartialJsonSha256:p.firstRunArtifactJsonSha256,
  previouslyExpectedOriginalCaptionSha256:p.originalCaptionPayloadSha256,
  originalSourceRetryResult:success?'success':'failed',
  sourceResult:result,sourceOriginalMediaHtmlSha256:p.originalPageHtmlSha256,
  noOriginalAudioVideoBodyRetrieved:true,
  noOriginalCaptionTextOrSpeakerNamesStored:true,
  cuesNotCertifiedMotionsOrNamedVotes:true,
  sameDayHearingDateNotExactOriginalMotionClock:true,
  firstFailedParentSourceRunStatusNotRewritten:true,
  actualOfficialFiveYearCommitteeVoteDenominator:null,
  noPrivateProductionDbModelTrainingForecastServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(final,null,2)+'\n');
 console.log(JSON.stringify({hearingDate:p.hearingDate,sourceStatus:final.originalSourceRetryResult,
  markers:result.originalCaptionTimeMarkers},null,2));
 if(!success)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

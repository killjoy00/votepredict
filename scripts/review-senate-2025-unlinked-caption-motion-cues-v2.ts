/** One-time 2025/22 LRL original caption source cue review, #864, metadata only. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectPinnedMtgidRecords,PINNED_ORIGINAL_MEDIA_YEAR}
 from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
 from '../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {
  readOriginal2025CaptionAvailabilityProof,
  retrieveVerifiedOfficialCaptionMarkup,
  PREVIOUS_2025_ORIGINAL_CAPTION_METADATA,
} from '../src/evidence/senate-committee-caption-motion-cues.js';
import {SENATE_2025_CAPTION_CUE_V2,findStrict2025OriginalAutoCaptionMotionCues}
 from '../src/evidence/senate-committee-caption-motion-cues-v2.js';

const args=process.argv.slice(2);
if(args.length!==8||args[0]!=='--hrefs'||args[2]!=='--original-html'||
 args[4]!=='--caption-metadata'||args[6]!=='--output')
 throw Error('Exact --hrefs FILE --original-html FILE --caption-metadata FILE --output FILE');
const [hrefsPath,htmlPath,captionsPath,out]=[args[1],args[3],args[5],args[7]].map(x=>resolve(x!));
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official source]').slice(0,170);
async function main(){
 const original=selectPinnedMtgidRecords(2025,readFileSync(hrefsPath,'utf8'));
 const originalHtml=readExactPriorMediaHtmlProof(2025,readFileSync(htmlPath,'utf8'));
 const captions=readOriginal2025CaptionAvailabilityProof(readFileSync(captionsPath,'utf8'));
 if(original.length!==22||originalHtml.size!==22||captions.size!==22)
  throw Error('Original 2025 missing-minutes source coverage not fully pinned');
 const allowed=new Set(original.map(x=>x.mediaUrl));
 const results:Array<Record<string,unknown>>=[];
 const failures:Array<{hearingDate:string;mtgid:string;reason:string}>=[];
 let index=0;
 const workers=Array.from({length:2},async()=>{
  for(;;){
   const row=original[index++];if(!row)break;
   try{
    const originalPage=originalHtml.get(row.mtgid),initial=captions.get(row.mtgid);
    if(!originalPage||!initial||originalPage.originalIndexedHearingDate!==row.meetingDate
      ||initial.originalHearingDate!==row.meetingDate
      ||initial.committeeName!==row.committeeName
      ||originalPage.originalHtmlSha256!==initial.previouslyVerifiedOriginalPageHtmlSha256)
     throw Error('Official indexed hearing and independent original 2025 page hashes disagree');
    const current=await fetchBoundedSenateMediaRecordHtml(row.mediaUrl,allowed);
    const surface=inspectMediaPageCaptionSurface(current.html,row.mediaUrl);
    if(surface.pageOriginalHtmlSha256!==originalPage.originalHtmlSha256
      ||surface.safeRequestCandidates.length!==1)
     throw Error('Independently verified original 2025 HTML/source caption interface drift');
    const request=surface.safeRequestCandidates[0]!;
    const payload=await retrieveVerifiedOfficialCaptionMarkup(
      request.endpointUrl,row.mediaUrl,initial.captionPayloadSha256s[0]!);
    if(payload.bytes!==initial.returnedPayloadBytes)
     throw Error('Original 2025 caption body byte length drifted');
    const cues=findStrict2025OriginalAutoCaptionMotionCues(payload.html);
    if(cues.originalTimestampAttributeMarkers!==initial.timedCaptionRowsVisible)
     throw Error('Original 2025 source caption timestamp counts drifted');
    results.push({
     originalYear:2025,originalHearingDate:row.meetingDate,
     originalCommitteeName:row.committeeName,exactOfficialMediaUrl:row.mediaUrl,
     originalMediaRecordId:row.mtgid,
     sourceOriginalMediaHtmlSha256:originalPage.originalHtmlSha256,
     sourceOriginalCaptionPayloadSha256:payload.bodySha256,
     sourceOriginalCaptionPayloadBytes:payload.bytes,
     sourceOriginalCaptionTimestampMarkerCount:initial.timedCaptionRowsVisible,
     ...cues,
     sourceHtmlAndCaptionByteShaReverified:true,
     candidateTimingRequiresHumanAudioConfirmation:true,
     derivedAnyMemberYeaNay:false,
    });
   }catch(e){failures.push({hearingDate:row.meetingDate,mtgid:row.mtgid,reason:safe(e)});}
  }
 });
 await Promise.all(workers);
 results.sort((a,b)=>String(a.originalHearingDate).localeCompare(String(b.originalHearingDate))
  ||String(a.originalMediaRecordId).localeCompare(String(b.originalMediaRecordId)));
 failures.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate));
 const total={
  original2025IndexedMediaLeadsExpected:22,
  fullOriginalHtmlAndCaptionBodyShaReverified:results.length,
  failedSourceBodies:failures.length,
  combinedSourceCaptionTimestampMarkers:results.reduce((n,r)=>n+Number(r.originalTimestampAttributeMarkers),0),
  sourcePagesWithAnyMotionCue:results.filter(r=>Number(r.categoryThirtySecondWindowsNotDistinctMotions)>0).length,
  sourceCueWindowsTotal:results.reduce((n,r)=>n+Number(r.totalDistinctThirtySecondCategoryCueWindows),0),
  sourceCueWindowsInReviewPacket:results.reduce((n,r)=>n+(r.sourceReviewCueTimeWindows as unknown[]).length,0),
  sourceCueWindowsOmittedByDisplayCap:results.reduce((n,r)=>n+Number(r.cueWindowsAboveOutputCap),0),
 };
 const report={
  schemaVersion:SENATE_2025_CAPTION_CUE_V2,issue:864,year:2025,
  sourceAuthority:'Minnesota Legislative Reference Library',
  sourceHrefRunId:38079233118,sourceHrefArtifactId:PINNED_ORIGINAL_MEDIA_YEAR[2025].artifactId,
  sourceHrefOriginalJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[2025].jsonSha256,
  originalRecordHtmlRunId:38081463362,priorCaptionAvailabilityRunId:38103766440,
  originalCaptionMetadataArtifactId:PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.artifactId,
  priorCaptionOriginalJsonSha256:PREVIOUS_2025_ORIGINAL_CAPTION_METADATA.jsonSha256,
  total,records:results,failures,
  sourceCaptionBodyMustMatchEarlierIndependentSha256:true,
  noRawCaptionOrFullMediaFileStored:true,
  noHumanUnverifiedAutoCaptionPreviewTextStored:true,
  sourceReviewOnlyStrictProceduralPhraseClassifier:true,
  automaticallyGeneratedCaptionCuesMayBeWrong:true,
  previewSnippetsAreNotVerifiedSpeakerTranscripts:true,
  timestampsAreSourceMetadataNotConfirmedMotionTimes:true,
  noIndependentAudioVideoPlaybackPerformed:true,
  noNamedIndividualVotesOrSenatorPolicyStancesCertified:true,
  actualOfficialCommitteeVoteDenominator:null,
  noPrivateDbModelForecastTrainingServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true,
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({year:2025,total},null,2));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

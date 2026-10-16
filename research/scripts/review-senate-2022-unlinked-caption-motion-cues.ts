/** #864 read-only public 2022 Senate 11 no-Minutes original caption procedural cues.
 * Do not infer motions/votes from automatic captions, HTML or attendance.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectPinnedMtgidRecords,PINNED_ORIGINAL_MEDIA_YEAR}
 from '../../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
 from '../../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
 from '../../src/evidence/senate-committee-138-record-html-metadata.js';
import {retrieveVerifiedOfficialCaptionMarkup}
 from '../evidence/senate-committee-caption-motion-cues.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
 from '../../src/evidence/senate-committee-caption-motion-cues-v2.js';
import {ORIGINAL_2022_CAPTION_SOURCE,sourcePinned2022CaptionRecords}
 from '../evidence/senate-committee-2022-caption-motion-source.js';

const args=process.argv.slice(2);
if(args.length!==8||args[0]!=='--hrefs'||args[2]!=='--original-html'
 ||args[4]!=='--prior-caption'||args[6]!=='--output')
 throw Error('Exact --hrefs FILE --original-html FILE --prior-caption FILE --output FILE');
const [hrefPath,htmlPath,capPath,out]=[args[1]!,args[3]!,args[5]!,args[7]!].map(resolvePath=>resolve(resolvePath));
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official LRL source]').slice(0,150);
async function main(){
 const originals=selectPinnedMtgidRecords(2022,readFileSync(hrefPath,'utf8'));
 const htmlPinned=readExactPriorMediaHtmlProof(2022,readFileSync(htmlPath,'utf8'));
 const captions=sourcePinned2022CaptionRecords(readFileSync(capPath,'utf8'));
 if(originals.length!==11||htmlPinned.size!==11||captions.size!==11)
  throw Error('Original 2022 official indexed-source cohort incomplete');
 const allowed=new Set(originals.map(x=>x.mediaUrl));
 const found:Array<Record<string,unknown>>=[];
 const errors:Array<{hearingDate:string;mtgid:string;reason:string}>=[];
 let cursor=0;
 const worker=async()=>{
  for(;;){
   const row=originals[cursor++];if(!row)return;
   try{
    const old=htmlPinned.get(row.mtgid),before=captions.get(row.mtgid);
    if(!old||!before
      ||old.originalIndexedHearingDate!==row.meetingDate
      ||before.originalHearingDate!==row.meetingDate
      ||before.committeeName!==row.committeeName
      ||before.originalMediaRecordUrl!==row.mediaUrl
      ||old.exactOriginalMediaRecordUrl!==row.mediaUrl
      ||old.originalHtmlSha256!==before.previouslyVerifiedOriginalPageHtmlSha256)
      throw Error('Original LRL 2022 date/committee/record HTML SHA mismatch');
    const page=await fetchBoundedSenateMediaRecordHtml(row.mediaUrl,allowed);
    const surface=inspectMediaPageCaptionSurface(page.html,row.mediaUrl);
    if(surface.pageOriginalHtmlSha256!==old.originalHtmlSha256
      ||surface.safeRequestCandidates.length!==before.inspectedCaptionRequests
      ||surface.rejectedRequestCandidates!==0)
      throw Error('Previously source authenticated 2022 HTML/caption request drift');
    const skips=before.timedCaptionRowsVisible===0;
    const streams:Array<Record<string,unknown>>=[];
    if(!skips){
      for(let i=0;i<surface.safeRequestCandidates.length;i++){
        const request=surface.safeRequestCandidates[i]!;
        const payload=await retrieveVerifiedOfficialCaptionMarkup(
          request.endpointUrl,row.mediaUrl,before.captionPayloadSha256s[i]!);
        const cue=findStrict2025OriginalAutoCaptionMotionCues(payload.html);
        streams.push({
          originalCaptionStreamOrdinal:i,
          independentlyPinnedCaptionPayloadSha256:payload.bodySha256,
          originalPayloadByteLength:payload.bytes,
          ...cue,
          sourceIsUnreviewedAutoCaption:true,
          independentAudioSpeakerBillAndMotionCheckRequired:true
        });
      }
      if(streams.reduce((n,s)=>n+Number(s.originalPayloadByteLength),0)!==before.returnedPayloadBytes
        ||streams.reduce((n,s)=>n+Number(s.originalTimestampAttributeMarkers),0)
          !==before.timedCaptionRowsVisible)
        throw Error('Original 2022 multi-stream SHA/byte/timed caption-source arithmetic drift');
    }else{
      if(row.mtgid!==ORIGINAL_2022_CAPTION_SOURCE.noTimedCaption.mtgid
        ||before.captionPayloadSha256s[0]!==ORIGINAL_2022_CAPTION_SOURCE.noTimedCaption.originalPayloadSha256
        ||before.returnedPayloadBytes!==0)
        throw Error('Empty original caption source was not the independently pinned March 15 case');
    }
    found.push({
      indexedYear:2022,originalHearingDate:row.meetingDate,
      officialCommitteeName:row.committeeName,originalMediaMtgid:row.mtgid,
      originalOfficialPageUrl:row.mediaUrl,originalHtmlSha256:old.originalHtmlSha256,
      previouslyCertifiedCaptionPayloadSha256s:before.captionPayloadSha256s,
      originalCaptionRequests:Number(before.inspectedCaptionRequests),
      priorOriginalTimedMarkerTotal:before.timedCaptionRowsVisible,
      captionProvenanceStreams:streams,
      noTimedCaptionSourceHold:skips,
      sourcePageAndAllTimedCaptionOriginalBodiesShaReverified:!skips,
      sourcePageOriginalHtmlShaReverified:true,
      noSpeakerMotionsOrRecordedVotesCertified:true,
    });
   }catch(e){
    errors.push({hearingDate:row.meetingDate,mtgid:row.mtgid,reason:safe(e)});
   }
  }
 };
 await Promise.all([worker(),worker()]);
 found.sort((a,b)=>String(a.originalHearingDate).localeCompare(String(b.originalHearingDate))
  ||String(a.originalMediaMtgid).localeCompare(String(b.originalMediaMtgid)));
 errors.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate));
 const all=found.flatMap(x=>x.captionProvenanceStreams as Record<string,unknown>[]);
 const totals={
  originalDatedIndexRecordLeads:11,
  originalPagesHtmlShaReverified:found.length,
  sourceRecordFailures:errors.length,
  originalPagesWithTimedCaptionSource:found.filter(x=>!x.noTimedCaptionSourceHold).length,
  originalPagesNoTimedCaptionHold:found.filter(x=>x.noTimedCaptionSourceHold).length,
  independentlyAuthenticatedTimedCaptionStreams:all.length,
  originalTimestampMarkersFromVerifiedStreams:all.reduce((n,x)=>n+Number(x.originalTimestampAttributeMarkers),0),
  pagesWithProceduralCaptionCueWindows:found.filter(r=>
    (r.captionProvenanceStreams as Record<string,unknown>[]).some(
      x=>Number(x.categoryThirtySecondWindowsNotDistinctMotions)>0)).length,
  totalThirtySecondCategoryCueWindowsNotDistinctMotions:all.reduce(
    (n,x)=>n+Number(x.categoryThirtySecondWindowsNotDistinctMotions),0),
  preservedResearchWindows:all.reduce((n,x)=>n+(x.sourceReviewCueTimeWindows as unknown[]).length,0),
  overflowResearchWindows:all.reduce((n,x)=>n+Number(x.cueWindowsAboveOutputCap),0),
 };
 const output={
  schemaVersion:'senate-2022-11-unlinked-original-caption-ten-timed-pages-procedural-cues-v1',
  issue:864,sourceAuthority:'Minnesota Legislative Reference Library',
  year:2022,sourceOriginalHrefRunId:38079233118,
  sourceHrefArtifactId:PINNED_ORIGINAL_MEDIA_YEAR[2022].artifactId,
  sourceHrefOriginalJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[2022].jsonSha256,
  originalHtmlProofRunId:38081463362,
  originalCaptionRunId:ORIGINAL_2022_CAPTION_SOURCE.priorRunId,
  originalCaptionArtifactId:ORIGINAL_2022_CAPTION_SOURCE.artifactId,
  priorOriginalCaptionJsonSha256:ORIGINAL_2022_CAPTION_SOURCE.originalJsonSha256,
  totals,records:found,failures:errors,
  sourceCaptionAlwaysPreviouslyHashPinned:true,
  multipleCaptionStreamsNotEquivalentToDistinctMotions:true,
  automaticCaptionTimestampsNotTrueMotionOrSpeakerTimes:true,
  noUniqueRecordedMotionsOrIndividualSenatorYeaNayCertified:true,
  noFullCaptionWordsSavedToArtifact:true,
  noAudioVideoBodiesDownloadedOrPlayed:true,
  original2021PrintOnlySourceMissing:true,
  original2022PrintElectronicParityUnknown:true,
  statewideOfficialCommitteeVoteDenominator:null,
  noPrivateDbModelForecastTrainingServingSchedulerFloor2027Changes:true,
  issue864MustRemainOpen:true,
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({year:2022,totals},null,2));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

/** One-time #864 public original 2023 Senate 64 missing-Minutes source caption-cue audit.
 * Actually inspected original caption tracks only; no YEA/NAY, speaker/AV claims.
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
import {ORIGINAL_2023_CAPTION_PROOFS,sourcePinned2023CaptionRecords}
 from '../evidence/senate-committee-2023-caption-motion-source.js';

const a=process.argv.slice(2);
if(a.length!==10||a[0]!=='--hrefs'||a[2]!=='--original-html'
 ||a[4]!=='--first-caption'||a[6]!=='--exact-retry'||a[8]!=='--output')
 throw Error('Expected --hrefs, --original-html, --first-caption, --exact-retry, --output');
const [href,htmlPath,firstPath,retryPath,output]=
 [a[1]!,a[3]!,a[5]!,a[7]!,a[9]!].map(v=>resolve(v));
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[LRL public original]').slice(0,160);

async function main(){
 const originals=selectPinnedMtgidRecords(2023,readFileSync(href,'utf8'));
 const html=readExactPriorMediaHtmlProof(2023,readFileSync(htmlPath,'utf8'));
 const caption=sourcePinned2023CaptionRecords(
  readFileSync(firstPath,'utf8'),readFileSync(retryPath,'utf8'));
 if(originals.length!==64||html.size!==64||caption.size!==64)
  throw Error('2023 original official hearing roster incomplete after source-only targeted retry');
 const allow=new Set(originals.map(v=>v.mediaUrl));
 const results:Array<Record<string,unknown>>=[];
 const failures:Array<{hearingDate:string;mtgid:string;reason:string}>=[];
 let next=0;
 const worker=async()=>{
  for(;;){
   const r=originals[next++];if(!r)return;
   try{
    const old=html.get(r.mtgid),prior=caption.get(r.mtgid);
    if(!old||!prior
     ||old.originalIndexedHearingDate!==r.meetingDate
     ||prior.originalHearingDate!==r.meetingDate
     ||prior.committeeName!==r.committeeName
     ||prior.officialOriginalPageUrl!==r.mediaUrl
     ||old.exactOriginalMediaRecordUrl!==r.mediaUrl
     ||prior.previouslyVerifiedOriginalPageHtmlSha256!==old.originalHtmlSha256)
     throw Error('Source original 2023 Senate hearing date/committee/sha not reconciled');
    const raw=await fetchBoundedSenateMediaRecordHtml(r.mediaUrl,allow);
    const surface=inspectMediaPageCaptionSurface(raw.html,r.mediaUrl);
    if(surface.pageOriginalHtmlSha256!==old.originalHtmlSha256
     ||surface.safeRequestCandidates.length!==prior.safeCaptionRequestCandidates
     ||surface.rejectedRequestCandidates!==0)
     throw Error('2023 actual original page bytes or safe caption links changed');
    const outputs:Array<Record<string,unknown>>=[];
    if(prior.captionSourceHold==='none'){
      for(let i=0;i<prior.captionRequestsInspected;i++){
        const request=surface.safeRequestCandidates[i]!;
        if(!request)throw Error('Missing exact original 2023 caption request slot');
        const payload=await retrieveVerifiedOfficialCaptionMarkup(
          request.endpointUrl,r.mediaUrl,prior.pinnedOriginalCaptionPayloadSha256s[i]!);
        const parsed=findStrict2025OriginalAutoCaptionMotionCues(payload.html);
        outputs.push({
          sourceCaptionTrackOrdinal:i,originalCaptionPayloadSha256:payload.bodySha256,
          originalCaptionPayloadBytes:payload.bytes,
          ...parsed,
          proceduralCueIsNotDistinctLegislativeMotion:true,
          humanAudioAndSpeakerVerificationRequired:true
        });
      }
      if(outputs.length!==prior.captionRequestsInspected
       ||outputs.reduce((n,x)=>n+Number(x.originalCaptionPayloadBytes),0)
           !==prior.pinnedOriginalCaptionBytes
       ||outputs.reduce((n,x)=>n+Number(x.originalTimestampAttributeMarkers),0)
           !==prior.pinnedOriginalTimedCaptionRows)
       throw Error('Original 2023 source caption stream SHAs/bytes/timestamp totals drift');
    }else{
      if(outputs.length!==0||prior.pinnedOriginalTimedCaptionRows!==0)
       throw Error('2023 no timed-caption source wrongly assigned procedural cues');
      if(prior.captionSourceHold==='empty_original_caption'
       &&(r.mtgid!==ORIGINAL_2023_CAPTION_PROOFS.originalEmptyCaptionMtgid
       ||prior.captionRequestsInspected!==1||prior.pinnedOriginalCaptionBytes!==0))
       throw Error('Source 2023 Jan10 empty caption moved');
      if(prior.captionSourceHold==='no_video_caption_interface'
       &&prior.captionRequestsInspected!==0)
       throw Error('Source 2023 audio-only recording presented fake caption source');
    }
    results.push({
      hearingYear:2023,hearingDate:r.meetingDate,
      officialCommitteeName:r.committeeName,officialOriginalMediaUrl:r.mediaUrl,
      officialMediaMtgid:r.mtgid,originalPageHtmlSha256:old.originalHtmlSha256,
      originalCaptionMetadataSource:prior.originalSourceKind,
      originalCaptionRequestsExposed:prior.safeCaptionRequestCandidates,
      previouslyReviewedOriginalCaptionRequestCount:prior.captionRequestsInspected,
      originalCaptionStreamBodySha256s:prior.pinnedOriginalCaptionPayloadSha256s,
      unreviewedExtraOriginalCaptionLinks:prior.unreviewedExtraCaptionRequestCount,
      originalCaptionAccessHold:prior.captionSourceHold,
      originalTimedCaptionMarkers:prior.pinnedOriginalTimedCaptionRows,
      independentlyReverifiedTimedCaptionSources:outputs,
      allPreviouslyReviewedOriginalCaptionsShaReverified:prior.captionSourceHold==='none',
      originalHtmlSHAReverified:true,
      noUniqueMotionsRecordedVotesOrNamedSidesCertified:true,
    });
   }catch(e){failures.push({hearingDate:r.meetingDate,mtgid:r.mtgid,reason:safe(e)});}
  }
 };
 await Promise.all([worker(),worker()]);
 results.sort((a,b)=>String(a.hearingDate).localeCompare(String(b.hearingDate))
  ||String(a.officialMediaMtgid).localeCompare(String(b.officialMediaMtgid)));
 failures.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate));
 const streams=results.flatMap(r=>r.independentlyReverifiedTimedCaptionSources as Record<string,unknown>[]);
 const totals={
  independentlyOfficialIndexedNoMinutesMediaLeads:64,
  originalHtmlPagesShaReverified:results.length,
  actualSourcePageOrCaptionFailures:failures.length,
  originalHearingPagesWithTimedCaptionSources:results.filter(x=>x.originalCaptionAccessHold==='none').length,
  originalAudioOnlyMediaPageHolds:results.filter(x=>x.originalCaptionAccessHold==='no_video_caption_interface').length,
  originalEmptyCaptionSourceHolds:results.filter(x=>x.originalCaptionAccessHold==='empty_original_caption').length,
  originalAuthenticatedTimedCaptionStreams:streams.length,
  additionalExposedUninspectedCaptionTracks:results.reduce(
    (n,r)=>n+Number(r.unreviewedExtraOriginalCaptionLinks),0),
  exactOriginalTimedCaptionAttributeMarkers:streams.reduce(
    (n,x)=>n+Number(x.originalTimestampAttributeMarkers),0),
  hearingPagesWithProceduralCueWindows:results.filter(x=>
    (x.independentlyReverifiedTimedCaptionSources as Record<string,unknown>[]).some(
      s=>Number(s.categoryThirtySecondWindowsNotDistinctMotions)>0)).length,
  thirtySecondCategoryCueWindowsNotDistinctMotions:streams.reduce(
    (n,x)=>n+Number(x.categoryThirtySecondWindowsNotDistinctMotions),0),
  boundedCueResearchWindowsRetained:streams.reduce(
    (n,x)=>n+(x.sourceReviewCueTimeWindows as unknown[]).length,0),
  cueWindowsBeyondReviewCap:streams.reduce((n,x)=>n+Number(x.cueWindowsAboveOutputCap),0)
 };
 const j={
  schemaVersion:'senate-2023-64-no-minutes-two-original-runs-strict-caption-motion-cues-v1',
  issue:864,authority:'Minnesota Legislative Reference Library',
  originalYear:2023,
  originalHearingMediaIdentityRunId:38079233118,
  originalHearingMediaSourceJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[2023].jsonSha256,
  independentOriginalHtmlProofRunId:38081463362,
  sourceFirstCaptionArtifactId:ORIGINAL_2023_CAPTION_PROOFS.first.artifactId,
  firstSourceParentRunConclusion:'failure',
  originalFirstCaptionPartialJsonSha256:ORIGINAL_2023_CAPTION_PROOFS.first.originalJsonSha256,
  sourceExactRetryArtifactId:ORIGINAL_2023_CAPTION_PROOFS.retry.artifactId,
  sourceExactRetryRunConclusion:'success',
  originalSecondCaptionRetryJsonSha256:ORIGINAL_2023_CAPTION_PROOFS.retry.originalJsonSha256,
  totals,records:results,failures,
  noAutomatedCaptionAsVerifiedMotionOrSenatorChoice:true,
  uninspectedThirdApril27TrackRemainsUnreviewed:true,
  noRawCaptionTextOrSpeakerPreviewsSaved:true,
  noAudioVideoFilePlaybackOrDownloadPerformed:true,
  original2021SenatePrintOnlyOfficialMinutesUnknown:true,
  original2022PrintVsElectronicDifferenceUnreconciled:true,
  fullStatewide2021to2025SenateCommitteeRecordedVoteDenominator:null,
  noPrivateProductionDbModelForecastTrainingServingSchedulerFloor2027Operations:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(j,null,2)+'\n');
 console.log(JSON.stringify({year:2023,totals},null,2));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

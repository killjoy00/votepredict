/** One-time #864 source-only original caption endpoint audit. Not AV playback. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {selectPinnedMtgidRecords,type MediaYear,PINNED_ORIGINAL_MEDIA_YEAR}
  from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {fetchBoundedSenateMediaRecordHtml}
  from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {
  SENATE_138_CAPTION_SOURCE_SCHEMA,PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS,
  readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface,
  fetchBoundedCaptionEvidence,type MediaAuditYear,
} from '../src/evidence/senate-committee-138-caption-surface.js';

const args=process.argv.slice(2);
if(args.length!==8||args[0]!=='--year'||args[2]!=='--hrefs'||
   args[4]!=='--original-html-proof'||args[6]!=='--output')
  throw Error('Exact --year 2022|2023|2024|2025 --hrefs FILE --original-html-proof FILE --output FILE');
const year=Number(args[1]) as MediaYear&MediaAuditYear;
if(![2022,2023,2024,2025].includes(year))throw Error('Only Senate 2022 through 2025 allowed');
const hrefPath=resolve(args[3]!),priorPath=resolve(args[5]!),output=resolve(args[7]!);
function safe(e:unknown):string {
  return (e instanceof Error?e.message:String(e)).replace(/https?:\/\/\S+/g,'[official source]')
    .slice(0,140);
}
async function run(){
  const original=selectPinnedMtgidRecords(year,readFileSync(hrefPath,'utf8'));
  const prior=readExactPriorMediaHtmlProof(year,readFileSync(priorPath,'utf8'));
  if(original.length!==prior.size||original.length!==PINNED_ORIGINAL_MEDIA_YEAR[year].mediaRecords)
    throw Error('Source original 138 candidate-to-HTML proof count did not reconcile');
  const allowed=new Set(original.map(x=>x.mediaUrl));
  const records:Array<Record<string,unknown>>=[];
  const failures:Array<{mtgid:string;hearingDate:string;reason:string}>=[];
  let next=0;
  const workers=Array.from({length:2},async()=>{
    for(;;){
      const row=original[next++];
      if(!row)return;
      try{
        const old=prior.get(row.mtgid);
        if(!old||old.originalIndexedHearingDate!==row.meetingDate
          ||old.exactOriginalMediaRecordUrl!==row.mediaUrl
          ||old.originalMediaRecordUrlSha256!==row.originalMediaUrlSha256
          ||old.mediaTagCandidate!==true)
          throw Error('Original source meeting/HTML proof mismatch');
        const fetched=await fetchBoundedSenateMediaRecordHtml(row.mediaUrl,allowed);
        const visible=inspectMediaPageCaptionSurface(fetched.html,row.mediaUrl);
        if(visible.pageOriginalHtmlSha256!==old.originalHtmlSha256)
          throw Error('Original source page HTML SHA drift: HOLD until independently reconciled');
        const returned={
          year,committeeName:row.committeeName,originalHearingDate:row.meetingDate,
          originalMediaRecordUrl:row.mediaUrl,originalMtgid:row.mtgid,
          previouslyVerifiedOriginalPageHtmlSha256:old.originalHtmlSha256,
          captionRequestCandidates:visible.totalRequestCandidates,
          safeCaptionRequestCandidates:visible.safeRequestCandidates.length,
          rejectedCaptionRequestCandidates:visible.rejectedRequestCandidates,
          inspectedCaptionRequests:0,
          captionApiStatusCategories:[] as string[],
          timedCaptionRowsVisible:0,
          returnedPayloadBytes:0,
          captionPayloadSha256s:[] as string[],
          sourcePageReselectedSameOriginalHash:true,
          noRecordedMediaFileDownloaded:true,noCaptionTextPublished:true,
          noSpeakerOrNamedYeaNayProven:true,playbackNotVerified:true,
        };
        for(const request of visible.safeRequestCandidates.slice(0,2)){
          let caption;
          try{caption=await fetchBoundedCaptionEvidence(request.endpointUrl,row.mediaUrl)}
          catch(e){
            returned.captionApiStatusCategories.push('caption_endpoint_fetch_failed');
            continue;
          }
          returned.inspectedCaptionRequests++;
          returned.captionApiStatusCategories.push(caption.status);
          returned.timedCaptionRowsVisible+=caption.timedCaptionRows;
          returned.returnedPayloadBytes+=caption.originalPayloadBytes;
          if(caption.originalPayloadSha256)
            returned.captionPayloadSha256s.push(caption.originalPayloadSha256);
        }
        records.push(returned);
      }catch(e){
        failures.push({mtgid:row.mtgid,hearingDate:row.meetingDate,reason:safe(e)});
      }
    }
  });
  await Promise.all(workers);
  records.sort((a,b)=>String(a.originalHearingDate).localeCompare(String(b.originalHearingDate))
    ||String(a.originalMtgid).localeCompare(String(b.originalMtgid)));
  failures.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||a.mtgid.localeCompare(b.mtgid));
  const totals={
    officialOriginalMediaRecordsExpected:original.length,
    originalHtmlPagesReverified:records.length,
    originalHtmlPageFailures:failures.length,
    captionRequestCandidatePages:records.filter(r=>Number(r.captionRequestCandidates)>0).length,
    safeCaptionRequestPages:records.filter(r=>Number(r.safeCaptionRequestCandidates)>0).length,
    rejectOnlyCaptionRequestPages:records.filter(r=>Number(r.captionRequestCandidates)>0&&
      Number(r.safeCaptionRequestCandidates)===0).length,
    captionEndpointRequestsMade:records.reduce((n,r)=>n+Number(r.inspectedCaptionRequests),0),
    pagesWithTimedCaptionRows:records.filter(r=>Number(r.timedCaptionRowsVisible)>0).length,
    totalCaptionTimestampMarkers:records.reduce((n,r)=>n+Number(r.timedCaptionRowsVisible),0),
    pagesWithCaptionHttpOrContentFailure:records.filter(r=>
      (r.captionApiStatusCategories as string[]).some(s=>
        s!=='caption_timed_rows_observed'&&s!=='caption_payload_no_timed_rows')).length,
  };
  const report={
    schemaVersion:SENATE_138_CAPTION_SOURCE_SCHEMA,
    issue:864,year,sourceArchive:'Minnesota Legislative Reference Library',
    originalSourceHrefArtifactId:PINNED_ORIGINAL_MEDIA_YEAR[year].artifactId,
    pinnedOriginalHrefJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[year].jsonSha256,
    previouslyVerifiedOriginalHtmlSourceArtifactId:PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS[year].artifactId,
    pinnedPreviousHtmlSourceJsonSha256:PREVIOUS_138_ORIGINAL_HTML_ARTIFACTS[year].sha256,
    totals,records,failures,
    originalHtmlAndPriorSourceHashesRequired:true,
    captionEndpointResponseBodyMaxBytes:1_500_000,
    originalHtmlMaxBytes:600_000,
    originalMediaAudioVideoBodiesNeverFetched:true,
    noCaptionTextOrNamedSpeakersSaved:true,
    noHumanAudioVideoPlaybackPerformed:true,
    noMotionsOrNamedIndividualVotesCertified:true,
    sourceMeetingDateIsNotMotionTimestamp:true,
    independentOfficialVoteDenominatorUnknown:true,
    productionAndPrivateDbUnchanged:true,
    modelForecastTrainingServingSchedulerFloor2027Unchanged:true,
    issue864MustRemainOpen:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({year,totals},null,2));
  if(failures.length)process.exitCode=1;
}
run().catch(e=>{console.error(safe(e));process.exitCode=1});

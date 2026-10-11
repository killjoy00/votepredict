/**
 * #864 one-time original 2024 Senate 41/no-Minutes caption PROCEDURAL CUE review.
 * Original public caption body is re-hashed against prior independent acquisition
 * before reading any words. No audio/video, names/sides output or DB access.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {selectPinnedMtgidRecords,PINNED_ORIGINAL_MEDIA_YEAR}
  from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {readExactPriorMediaHtmlProof,inspectMediaPageCaptionSurface}
  from '../src/evidence/senate-committee-138-caption-surface.js';
import {fetchBoundedSenateMediaRecordHtml}
  from '../src/evidence/senate-committee-138-record-html-metadata.js';
import {retrieveVerifiedOfficialCaptionMarkup}
  from '../src/evidence/senate-committee-caption-motion-cues.js';
import {findStrict2025OriginalAutoCaptionMotionCues}
  from '../src/evidence/senate-committee-caption-motion-cues-v2.js';
import {ORIGINAL_2024_CAPTION_PROOF,sourcePinned2024CaptionRecords}
  from '../src/evidence/senate-committee-2024-caption-motion-source.js';

const argv=process.argv.slice(2);
if(argv.length!==8||argv[0]!=='--hrefs'||argv[2]!=='--original-html'
  ||argv[4]!=='--prior-caption'||argv[6]!=='--output')
  throw Error('Arguments required: --hrefs FILE --original-html FILE --prior-caption FILE --output FILE');
const [hrefPath,htmlPath,priorPath,out]=[argv[1]!,argv[3]!,argv[5]!,argv[7]!].map(x=>resolve(x));
const safe=(error:unknown)=>String(error instanceof Error?error.message:error)
  .replace(/https?:\/\/\S+/gi,'[official source]').slice(0,160);
async function main(){
 const rows=selectPinnedMtgidRecords(2024,readFileSync(hrefPath,'utf8'));
 const originalHtml=readExactPriorMediaHtmlProof(2024,readFileSync(htmlPath,'utf8'));
 const prior=sourcePinned2024CaptionRecords(readFileSync(priorPath,'utf8'));
 if(rows.length!==41||originalHtml.size!==41||prior.size!==41)
   throw Error('One of three independent official original 2024 source inventories is incomplete');
 const allow=new Set(rows.map(r=>r.mediaUrl));
 const records:Array<Record<string,unknown>>=[];
 const failures:Array<{hearingDate:string;mtgid:string;reason:string}>=[];
 let next=0;
 const workers=Array.from({length:2},async()=>{
  for(;;){
   const source=rows[next++];
   if(!source)return;
   try{
    const htmlProven=originalHtml.get(source.mtgid),captionProven=prior.get(source.mtgid);
    if(!htmlProven||!captionProven||source.year!==2024
      ||source.meetingDate!==htmlProven.originalIndexedHearingDate
      ||source.meetingDate!==captionProven.originalHearingDate
      ||source.committeeName!==captionProven.committeeName
      ||source.mediaUrl!==htmlProven.exactOriginalMediaRecordUrl
      ||source.mediaUrl!==captionProven.originalMediaRecordUrl
      ||htmlProven.originalHtmlSha256!==captionProven.previouslyVerifiedOriginalPageHtmlSha256)
      throw Error('Original 2024 indexed source vs separate SHA records disagree');
    const html=await fetchBoundedSenateMediaRecordHtml(source.mediaUrl,allow);
    const surface=inspectMediaPageCaptionSurface(html.html,source.mediaUrl);
    if(surface.pageOriginalHtmlSha256!==htmlProven.originalHtmlSha256
      ||surface.safeRequestCandidates.length!==1||surface.rejectedRequestCandidates!==0)
      throw Error('Original 2024 HTML hash/official caption interface mismatch');
    const request=surface.safeRequestCandidates[0]!;
    const originalCaption=await retrieveVerifiedOfficialCaptionMarkup(
      request.endpointUrl,source.mediaUrl,captionProven.captionPayloadSha256s[0]!);
    if(originalCaption.bytes!==captionProven.returnedPayloadBytes)
      throw Error('Original 2024 caption source byte length mismatch');
    // The v2 strict tagged-text parser is year-neutral. Do NOT use the noisy v1 parser.
    const result=findStrict2025OriginalAutoCaptionMotionCues(originalCaption.html);
    if(result.originalTimestampAttributeMarkers!==captionProven.timedCaptionRowsVisible)
      throw Error('Original 2024 caption timestamp marker count changed');
    records.push({
      originalYear:2024,
      originalHearingDate:source.meetingDate,
      originalCommitteeName:source.committeeName,
      officialMediaRecordUrl:source.mediaUrl,
      originalMediaMtgid:source.mtgid,
      originalHTMLSha256:htmlProven.originalHtmlSha256,
      originalCaptionPayloadSha256:originalCaption.bodySha256,
      originalCaptionPayloadBytes:originalCaption.bytes,
      ...result,
      sourcePageAndCaptionBodySHAReverified:true,
      actualAudioVideoPlaybackPerformed:false,
      derivedAnyNamedSenatorVote:false,
    });
   }catch(e){
    failures.push({hearingDate:source.meetingDate,mtgid:source.mtgid,reason:safe(e)});
   }
  }
 });
 await Promise.all(workers);
 records.sort((a,b)=>String(a.originalHearingDate).localeCompare(String(b.originalHearingDate))
  ||String(a.originalMediaMtgid).localeCompare(String(b.originalMediaMtgid)));
 failures.sort((a,b)=>a.hearingDate.localeCompare(b.hearingDate)||a.mtgid.localeCompare(b.mtgid));
 const totals={
   expectedIndexedNoMinutesMediaLeads:41,
   exactOriginalPageAndCaptionBodyShaVerified:records.length,
   originalSourceFailures:failures.length,
   totalCaptionTimestampMarkers:records.reduce((n,r)=>n+Number(r.originalTimestampAttributeMarkers),0),
   pagesWithProceduralCueWindows:records.filter(r=>Number(r.categoryThirtySecondWindowsNotDistinctMotions)>0).length,
   totalCueCategoryThirtySecondWindows:records.reduce((n,r)=>n+Number(r.totalDistinctThirtySecondCategoryCueWindows),0),
   preservedUnverifiedReviewWindows:records.reduce((n,r)=>n+(r.sourceReviewCueTimeWindows as unknown[]).length,0),
   overflowNotIncludedInReviewWindows:records.reduce((n,r)=>n+Number(r.cueWindowsAboveOutputCap),0),
 };
 const payload={
   schemaVersion:'senate-2024-41-unlinked-original-caption-procedural-motion-cue-review-v1',
   issue:864,
   authority:'Minnesota Legislative Reference Library',
   originalSourceHrefRunId:38079233118,
   sourceHrefArtifactId:PINNED_ORIGINAL_MEDIA_YEAR[2024].artifactId,
   sourceHrefJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[2024].jsonSha256,
   originalHtmlProofRunId:38081463362,
   originalCaptionRunId:ORIGINAL_2024_CAPTION_PROOF.priorRunId,
   originalCaptionArtifactId:ORIGINAL_2024_CAPTION_PROOF.artifactId,
   originalCaptionJsonSha256:ORIGINAL_2024_CAPTION_PROOF.sourceJsonSha256,
   totals,records,failures,
   originalHtmlMustMatchEarlierSourceSha:true,
   originalCaptionBodyMustMatchEarlierIndependentSourceSha:true,
   sourceCueTimesNotVerifiedMotionClock:true,
   previewTextIsUnverifiedAutoCaption:true,
   audioVideoBodiesNotDownloaded:true,
   noRawCaptionBodyCommitted:true,
   noMemberYeaNaySidesExtracted:true,
   noAutoCaptionWordsOrSpeakerPreviewsInSourceArtifact:true,
   noDistinctMotionsOrBillStancesCertified:true,
   actualOfficial2021to2025RecordedVoteDenominator:null,
   noPrivateProductionDBReadWrite:true,
   noModelTrainingForecastServingSchedulerFloor2027Changes:true,
   issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
 console.log(JSON.stringify({year:2024,totals},null,2));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});

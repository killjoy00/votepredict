/** #864 one-time bounded GET HTML metadata for 138 exact source-hashed LRL mtgid records. */
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import {
  selectPinnedMtgidRecords,PINNED_ORIGINAL_MEDIA_YEAR,type MediaYear,
} from '../src/evidence/senate-committee-138-mtgid-head-source.js';
import {
  fetchBoundedSenateMediaRecordHtml,inspectSenateMediaRecordHtml,
} from '../src/evidence/senate-committee-138-record-html-metadata.js';

const a=process.argv.slice(2);
if(a.length!==6||a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
  throw Error('Exact --year 2022|2023|2024|2025 --source-json PATH --output PATH');
const year=Number(a[1]);
if(![2022,2023,2024,2025].includes(year))throw Error('Only year-scoped historical Senate original media IDs');
const y=year as MediaYear, source=resolve(a[3]!),out=resolve(a[5]!);
function safe(e:unknown){
  return (e instanceof Error?e.message:String(e))
    .replace(/https?:\/\/\S+/gi,'[official LRL media]').slice(0,175);
}
async function main(){
  const official=selectPinnedMtgidRecords(y,readFileSync(source,'utf8'));
  const allowed=new Set(official.map(x=>x.mediaUrl));
  const reviews:Record<string,unknown>[]=[];
  const errors:Array<{committeeName:string;meetingDate:string;recordId:string;reason:string}>=[];
  let next=0;
  const workers=Array.from({length:2},async()=>{
    for(;;){
      const row=official[next++];
      if(!row)return;
      try{
        const fetched=await fetchBoundedSenateMediaRecordHtml(row.mediaUrl,allowed);
        const finding=inspectSenateMediaRecordHtml(fetched.html,row.mtgid);
        reviews.push({
          year:y,committeeName:row.committeeName,
          originalIndexedHearingDate:row.meetingDate,
          originalOfficialHearingPage:row.originalCommitteeUrl,
          exactOriginalMediaRecordUrl:row.mediaUrl,
          originalMediaRecordUrlSha256:row.originalMediaUrlSha256,mtgid:row.mtgid,
          sourceHttpStatus:fetched.status,sourceContentType:fetched.contentType,
          ...finding,
        });
      }catch(e){
        errors.push({committeeName:row.committeeName,meetingDate:row.meetingDate,
          recordId:row.mtgid,reason:safe(e)});
      }
    }
  });
  await Promise.all(workers);
  reviews.sort((a,b)=>String(a.originalIndexedHearingDate).localeCompare(String(b.originalIndexedHearingDate))
    ||String(a.mtgid).localeCompare(String(b.mtgid)));
  const withTags=reviews.filter(r=>r.mediaTagCandidate===true).length;
  const missingText=reviews.filter(r=>r.explicitMissingRecordTextDetected===true).length;
  const withDirectAudio=reviews.filter(r=>(r.structuralSourceTags as {audio:number}).audio>0).length;
  const withDirectVideo=reviews.filter(r=>(r.structuralSourceTags as {video:number}).video>0).length;
  const transcript=reviews.filter(r=>(r.labeledNavigation as {transcriptLinks:number}).transcriptLinks>0).length;
  const report={
    schemaVersion:'senate-138-source-hashed-official-media-html-visibility-v1',
    issue:864,year:y,originalHrefMetadataProofArtifactId:PINNED_ORIGINAL_MEDIA_YEAR[y].artifactId,
    sourceEarlierHrefJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[y].jsonSha256,
    exactRecordUrlsExpected:official.length,htmlRecordPagesFetched:reviews.length,failedRecords:errors.length,
    findings:{explicitAudioElementPages:withDirectAudio,explicitVideoElementPages:withDirectVideo,
      pagesWithMediaElementOrFileReference:withTags,
      pageTextDeclaringMissingRecord:missingText,pagesWithTranscriptLabeledAnchors:transcript},
    records:reviews,failures:errors,
    htmlBodyBound600KBNoRedirects:true,noMediaAudioOrVideoDownloaded:true,
    noHumanPlaybackOrTranscriptPerformed:true,
    matchingMtgidNotProofOfRecording:true,
    sourceHtmlIsNotNamedSenatorVoteEvidence:true,
    noProductionDbReadWritesOrModelForecastServingSchedulerChanges:true,
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({year:y,expected:official.length,htmlFetched:reviews.length,
    failures:errors.length,findings:report.findings},null,2));
  if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
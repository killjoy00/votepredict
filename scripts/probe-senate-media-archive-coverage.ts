import {
  discoverSenateMediaRecordingPages,
  MN_SENATE_MEDIA_ARCHIVE_SOURCE_VERSION,
} from '../src/evidence/minnesota-senate-media-archive.js';

const YEARS=[2021,2022,2023,2024,2025,2026];

async function main(){
  const byYear=[];
  const unique=new Set<string>();
  let totalFailures=0;
  for(const year of YEARS){
    const result=await discoverSenateMediaRecordingPages({year,concurrency:5});
    for(const row of result.recordings)unique.add(row.mtgid);
    totalFailures+=result.eventFailures.length;
    const countsByEvent=result.recordings.reduce<Record<string,number>>((acc,row)=>{
      acc[row.eventName]=(acc[row.eventName]??0)+1;
      return acc;
    },{});
    byYear.push({
      year,
      eventCount:result.events.length,
      recordingPageCount:result.recordings.length,
      eventsWithRecordings:Object.keys(countsByEvent).length,
      eventFailures:result.eventFailures,
      largestEventCounts:Object.entries(countsByEvent)
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
        .slice(0,12)
        .map(([eventName,count])=>({eventName,count})),
      firstRecordingPages:result.recordings.slice(0,8).map(row=>row.url),
    });
  }

  if(unique.size===0)throw new Error('Official LRL Senate media discovery returned zero recording pages');
  if(totalFailures>0)throw new Error('Official LRL Senate media discovery had '+totalFailures+' event-level failures');
  console.log(JSON.stringify({
    senateMediaArchiveCoverageProbe:{
      sourceVersion:MN_SENATE_MEDIA_ARCHIVE_SOURCE_VERSION,
      years:YEARS,
      uniqueRecordingPages:unique.size,
      totalEventFailures:totalFailures,
      byYear,
      policy:{
        readOnly:true,
        source:'official Minnesota Legislative Reference Library media archive',
        captionFetch:false,
        transcriptIngestion:false,
        speakerAttribution:false,
        databaseWrites:false,
        productionAction:'none',
      },
    },
  },null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});

import {
  discoverSenateVideoRecordingPages,
  MN_SENATE_MEDIA_SOURCE_VERSION,
} from '../src/evidence/minnesota-senate-media-source.js';

const YEARS=[2021,2022,2023,2024,2025,2026];

async function main(){
  const byYear=[];
  const all=new Set<string>();
  for(const year of YEARS){
    const result=await discoverSenateVideoRecordingPages({year});
    for(const row of result.recordings)all.add(row.mtgid);
    const byEvent=result.recordings.reduce<Record<string,number>>((acc,row)=>{
      acc[row.committeeName]=(acc[row.committeeName]??0)+1;
      return acc;
    },{});
    byYear.push({
      year,
      eventCount:result.committees.length,
      recordingPageCount:result.recordings.length,
      eventsWithRecordings:Object.keys(byEvent).length,
      largestEventCounts:Object.entries(byEvent)
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
        .slice(0,15)
        .map(([eventName,count])=>({eventName,count})),
      firstRecordingPages:result.recordings.slice(0,8).map(row=>row.url),
    });
  }
  if(all.size===0)throw new Error('Official LRL Senate media discovery returned zero recording pages');
  console.log(JSON.stringify({
    senateMediaArchiveCoverageProbe:{
      sourceVersion:MN_SENATE_MEDIA_SOURCE_VERSION,
      years:YEARS,
      uniqueRecordingPages:all.size,
      byYear,
      policy:{
        readOnly:true,
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

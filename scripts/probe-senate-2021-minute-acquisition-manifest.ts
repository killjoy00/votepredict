import {
  parseSenateMediaEventsJson,
  parseSenateMediaFilesHtml,
  senateMediaEventsUrl,
  senateMediaFilesUrl,
  type SenateMediaEvent,
} from '../src/evidence/minnesota-senate-media-archive.js';

const YEAR=2021;
const BASE='https://www.lrl.mn.gov/media/';

async function fetchText(url:string):Promise<string>{
  const response=await fetch(url,{
    headers:{
      accept:'application/json,text/html,text/plain,*/*',
      referer:BASE,
      'user-agent':'VotePredict/2.0 issue-514-senate-minute-manifest',
    },
    signal:AbortSignal.timeout(30_000),
  });
  if(!response.ok)throw new Error('Minnesota LRL media endpoint returned HTTP '+response.status);
  return response.text();
}

function categoryHint(eventName:string):'floor'|'conference'|'press_or_special'|'committee_or_other'{
  const value=eventName.toLowerCase();
  if(value.includes('floor session'))return 'floor';
  if(value.includes('conference committee'))return 'conference';
  if(value.includes('press conference')||value.includes('capitol report')||value.includes('special event')){
    return 'press_or_special';
  }
  return 'committee_or_other';
}

async function main(){
  const eventText=await fetchText(senateMediaEventsUrl(YEAR));
  const events=parseSenateMediaEventsJson(eventText);
  const rows:Array<{
    eventId:string;
    eventName:string;
    categoryHint:ReturnType<typeof categoryHint>;
    recordingPages:number;
    mtgids:string[];
  }>=[];
  const failures:Array<{eventId:string;eventName:string;message:string}>=[];

  let next=0;
  async function worker(){
    while(true){
      const index=next++;
      if(index>=events.length)return;
      const event:SenateMediaEvent=events[index];
      try{
        const html=await fetchText(senateMediaFilesUrl(YEAR,event.id));
        const recordings=parseSenateMediaFilesHtml({html,year:YEAR,event});
        rows[index]={
          eventId:event.id,
          eventName:event.name,
          categoryHint:categoryHint(event.name),
          recordingPages:recordings.length,
          mtgids:recordings.map(row=>row.mtgid),
        };
      }catch(error){
        failures.push({
          eventId:event.id,
          eventName:event.name,
          message:error instanceof Error?error.message:String(error),
        });
        rows[index]={
          eventId:event.id,
          eventName:event.name,
          categoryHint:categoryHint(event.name),
          recordingPages:0,
          mtgids:[],
        };
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(5,Math.max(1,events.length))},()=>worker()));

  const uniqueMtgids=new Set(rows.flatMap(row=>row.mtgids));
  const committeeCandidates=rows
    .filter(row=>row.categoryHint==='committee_or_other')
    .sort((a,b)=>a.eventName.localeCompare(b.eventName)||a.eventId.localeCompare(b.eventId));

  console.log(JSON.stringify({
    senate2021MinuteAcquisitionManifest:{
      source:'official Minnesota Legislative Reference Library Senate media archive',
      year:YEAR,
      totalEvents:rows.length,
      totalEventRecordingLinks:rows.reduce((sum,row)=>sum+row.recordingPages,0),
      uniqueRecordingPages:uniqueMtgids.size,
      eventFailures:failures,
      categoryCounts:Object.fromEntries(
        ['floor','conference','press_or_special','committee_or_other'].map(category=>[
          category,
          rows.filter(row=>row.categoryHint===category).length,
        ]),
      ),
      committeeOrOtherEvents:committeeCandidates.map(row=>({
        eventId:row.eventId,
        eventName:row.eventName,
        recordingPages:row.recordingPages,
      })),
      allEvents:rows
        .slice()
        .sort((a,b)=>a.categoryHint.localeCompare(b.categoryHint)||a.eventName.localeCompare(b.eventName))
        .map(row=>({
          eventId:row.eventId,
          eventName:row.eventName,
          categoryHint:row.categoryHint,
          recordingPages:row.recordingPages,
        })),
      interpretation:{
        readOnly:true,
        acquisitionPurpose:'scope an authoritative LRL request/digitization pass for 2021 official Senate print committee minutes',
        categoryHintIsEvidence:false,
        eventNameDoesNotProveMinutesExist:true,
        officialPrintMinutesBoundary:'LRL states official Senate print minutes are held for 1999-2022; 2021 is outside the electronic minute index',
        persistenceChanged:false,
        modelOrServingChanged:false,
      },
    },
  },null,2));

  if(failures.length>0){
    throw new Error('2021 Senate media manifest had '+failures.length+' event discovery failures');
  }
}

main().catch(error=>{
  console.error(error instanceof Error?(error.stack??error.message):String(error));
  process.exitCode=1;
});

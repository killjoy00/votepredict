/** Read-only full-body smoke: 2023 DFL original in public Internet Archive. */
import {getWaybackRecords,loadArchivedDFL} from '../src/sources/minnesota/senate-dfl-wayback.js';

const ORIGINAL='https://senatedfl.mn/senate-finance-chair-john-marty-releases-statement-in-response-to-february-budget-forecast/';
async function main():Promise<void>{
  try {
    const records=await getWaybackRecords(ORIGINAL);
    let recovered=0;
    const attempts:Array<{capture:string;status:string;publishedYear?:string;contentBytes?:number}>=[];
    for(const row of records.slice(0,3)){
      try {
        const full=await loadArchivedDFL(row);
        recovered++;
        attempts.push({capture:row.timestamp,status:'full-original',
          publishedYear:full.item.published_on?.slice(0,4),contentBytes:full.item.raw_text.length});
        break;
      }catch(error){
        attempts.push({capture:row.timestamp,status:error instanceof Error?error.message:'unavailable'});
      }
    }
    console.log('SENATE_DFL_WAYBACK_REPLAY_PROBE='+JSON.stringify({records:records.length,recovered,attempts}));
  }catch(error){
    console.log('SENATE_DFL_WAYBACK_REPLAY_PROBE='+JSON.stringify({
      recovered:0,index:'unavailable',reason:error instanceof Error?error.message:'unknown',
    }));
  }
}
void main();

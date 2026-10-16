/** Keyless 2023-2025 Internet Archive CDX + immediate full original replay. */
import { setTimeout as sleep } from 'node:timers/promises';
import {getWaybackRecords,loadArchivedDFL} from '../src/sources/minnesota/senate-dfl-wayback.js';

const SAMPLES=[
  {year:'2023',url:'https://senatedfl.mn/senate-finance-chair-john-marty-releases-statement-in-response-to-february-budget-forecast/'},
  {year:'2024',url:'https://senatedfl.mn/senator-mitchell-responds-to-new-and-expanded-tax-savings-for-2024-providing-relief-to-families-social-security-recipients/'},
  {year:'2025',url:'https://senatedfl.mn/senator-bobby-joe-champion-says-final-bipartisan-jobs-and-economic-development-budget-clears-senate-heads-to-governors-desk/'},
];
async function main():Promise<void>{
  const outcome=[];
  for(const sample of SAMPLES){
    let found=0,recovered=0;
    const attempts:Array<{capture:string;status:string;publishedYear?:string;contentBytes?:number}>=[];
    try {
      const records=await getWaybackRecords(sample.url,fetch,5);
      found=records.length;
      for(const record of records.slice(-2).reverse()){
        try {
          const page=await loadArchivedDFL(record);
          recovered++;
          attempts.push({capture:record.timestamp,status:'full-first-party-html',
            publishedYear:page.item.published_on?.slice(0,4),
            contentBytes:page.item.raw_text.length});
          break;
        }catch(error){
          attempts.push({capture:record.timestamp,status:error instanceof Error?error.message:'unavailable'});
        }
      }
    }catch(error){
      attempts.push({capture:'none',status:error instanceof Error?error.message:'index unavailable'});
    }
    outcome.push({year:sample.year,found,recovered,attempts});
    console.log('SENATE_DFL_WAYBACK_YEAR='+JSON.stringify(outcome[outcome.length-1]));
    await sleep(3000);
  }
  console.log('SENATE_DFL_WAYBACK_REPLAY_PROBE='+JSON.stringify({byYear:outcome}));
  if(process.env.VOTEPREDICT_DFL_ARCHIVE_REQUIRES_FULL==='true' &&
    outcome.reduce((n,x)=>n+x.recovered,0)===0)
    throw Error('No original complete DFL archive content accessible; protected production held');
}
void main().catch(()=>{console.error('SENATE_DFL_WAYBACK_REPLAY_PROBE_FAILED');process.exitCode=1;});

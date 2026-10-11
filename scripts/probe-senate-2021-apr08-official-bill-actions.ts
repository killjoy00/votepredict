/**
 * One-shot #864 ORIGINAL public Minnesota Senate 2021 committee bill-log source
 * check. Acquires just two official HTTPS HTML pages, fingerprints in memory,
 * uploads metadata only, and leaves all individual motion days null.
 *
 * Run: node --import tsx scripts/probe-senate-2021-apr08-official-bill-actions.ts
 *   --output artifacts/2021-senate-apr08-committee-bill-actions/source.json
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {APR08_COMMITTEE_ACTION_CROSSCHECK,inspectOriginalApril08BillLog,
  verifyPinnedOriginalApril08BillLogBytes, type HistoricalBillCase} from
  '../src/evidence/senate-2021-apr08-rule1210-hearing-action-crosscheck.js';

const maxBytes=2_000_000;

async function readOriginalOfficialSource(spec:HistoricalBillCase){
  const res=await fetch(spec.source,{
    headers:{'User-Agent':'VotePredict-2021-Senate-public-source-research/1.0','Accept':'text/html'},
    signal:AbortSignal.timeout(30_000),
    redirect:'follow'
  });
  if(!res.ok||!res.body||new URL(res.url).hostname!=='www.senate.mn')
    throw Error('Original Senate official public HTTPS page fetch failed or unexpected redirect');
  const received:Buffer[]=[];
  let count=0;
  for await(const chunk of res.body){
    const buffer=Buffer.from(chunk);
    count+=buffer.byteLength;
    if(count>maxBytes)throw Error('Original Senate HTML exceeded hard source-byte cap');
    received.push(buffer);
  }
  const data=Buffer.concat(received);
  if(data.length<150)throw Error('Official original Senate HTML unexpectedly short');
  // Actual independent strict second source SHA/byte check, before parsing.
  const pinned=verifyPinnedOriginalApril08BillLogBytes(data,spec);
  return {
    html:data.toString('utf8'),
    originalBytes:pinned.originalBytes,
    originalHTMLSHA256:pinned.originalHTMLSHA256,
    observedAtUTC:new Date().toISOString()
  };
}

async function main(){
  const flag=process.argv.indexOf('--output');
  if(flag<0||!process.argv[flag+1]||process.argv.length!==4)
    throw Error('Pass explicit --output PATH for metadata-only original source observation');
  const out=process.argv[flag+1]!;
  const report:{
    schemaVersion:string;originalSourceChecks:unknown[];originalFetchErrors:unknown[];
    expectedOriginalBillLogs:number;passedBillLevelActionChecks:number;
    exactMotionMeetingDayProven:boolean;privateDatabaseTouched:boolean;
  }={
    schemaVersion:APR08_COMMITTEE_ACTION_CROSSCHECK.version,
    originalSourceChecks:[],originalFetchErrors:[],
    expectedOriginalBillLogs:2,passedBillLevelActionChecks:0,
    exactMotionMeetingDayProven:false,privateDatabaseTouched:false
  };
  for(const spec of APR08_COMMITTEE_ACTION_CROSSCHECK.cases){
    try{
      const original=await readOriginalOfficialSource(spec);
      const parsed=inspectOriginalApril08BillLog(original.html,spec);
      report.originalSourceChecks.push({
        ...parsed,originalSourceBytes:original.originalBytes,
        originalHTMLSHA256:original.originalHTMLSHA256,
        independentlyObservedAtUTC:original.observedAtUTC,
        separatePinnedOriginalHTMLSHA256StrictlyReauthenticated:true
      });
      report.passedBillLevelActionChecks++;
    }catch(e){
      report.originalFetchErrors.push({
        bill:spec.bill,originalSourceURL:spec.source,
        sourceCheckConclusion:'FAILED',error:String(e)
      });
    }
  }
  await mkdir(dirname(out),{recursive:true});
  await writeFile(out,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({
    expectedOriginalBillLogs:2,
    verifiedOriginalBillLevelApril08Actions:report.passedBillLevelActionChecks,
    errors:report.originalFetchErrors.length,
    exactMotionDayNotProven:true
  }));
  if(report.originalFetchErrors.length||report.passedBillLevelActionChecks!==2)
    process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
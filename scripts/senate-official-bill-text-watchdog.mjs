/**
 * Independent, keyless recovery for official MN Senate raw bill-text collection.
 * Reuses DFL's tested 75-minute active/stale decision logic but verifies the
 * protected collector's actual Neon readback before calling an idle run healthy.
 * Uses only GITHUB_TOKEN actions:write, never Neon secrets or database access.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {decideRecovery,MIN_IDLE_MS} from './senate-dfl-sitemap-watchdog.mjs';

export const REPO='killjoy00/votepredict';
export const TEXT_WORKFLOW_ID=387035882;
export const TEXT_WORKFLOW_PATH='.github/workflows/senate-official-bill-text-production.yml';
export const WATCHDOG_CRON='13 * * * *';
const ACTIVE=new Set(['queued','in_progress','waiting','pending','requested']);
const EVENTS=new Set(['push','schedule','workflow_dispatch']);
const THROTTLE_BACKOFF_MS=6*60*60*1000;

export function validateGitHubEvent(env,payload){
  if(env.GITHUB_REPOSITORY!==REPO || payload?.repository?.full_name!==REPO
    || env.GITHUB_REF!=='refs/heads/main' || env.GITHUB_RUN_ATTEMPT!=='1'
    || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))
    return {eligible:false,reason:'not_reviewed_main_repository'};
  if(env.GITHUB_EVENT_NAME==='push'){
    if(payload.ref!=='refs/heads/main'||payload.after!==env.GITHUB_SHA
      ||payload.deleted===true||payload.forced===true
      ||payload.head_commit?.id!==env.GITHUB_SHA)
      return {eligible:false,reason:'untrusted_main_push'};
  }else if(env.GITHUB_EVENT_NAME==='schedule'){
    if(payload.schedule!==WATCHDOG_CRON)
      return {eligible:false,reason:'unexpected_schedule'};
  }else if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
    if(payload.ref&&!['main','refs/heads/main'].includes(payload.ref))
      return {eligible:false,reason:'dispatch_not_main'};
  }else return {eligible:false,reason:'unapproved_event'};
  return {eligible:true,reason:'reviewed_main_event'};
}

export function eligibleCollectorRuns(runs){
  if(!Array.isArray(runs))throw Error('GitHub collector run list is not an array');
  // PR CI, deliberately skipped workflows, and other branches must not make
  // the protected production backfill appear recently healthy.
  return runs.filter(run=>EVENTS.has(run.event)
    && (!run.head_branch || run.head_branch==='main')
    && !['skipped','cancelled'].includes(run.conclusion));
}
export function decideBillTextRecovery(runs,now=Date.now()){
  return decideRecovery(eligibleCollectorRuns(runs),now,MIN_IDLE_MS);
}

export function parseProtectedReadback(log){
  if(typeof log!=='string')return null;
  const marker='SENATE_OFFICIAL_TEXT_RAW_READBACK=';
  const line=log.split('\n').reverse().find(s=>s.includes(marker));
  if(!line)return null;
  let data;
  try{data=JSON.parse(line.slice(line.indexOf(marker)+marker.length).trim());}
  catch{return null;}
  if(!data||data.baselineUnchanged!==true||data.servingInputsUntouched!==true
    ||typeof data.status!=='string'||!data.counts||!Array.isArray(data.families))
    return null;
  const counts=data.counts;
  if(!['stopped_on_official_throttle','bounded_batch_committed',
    'stopped_on_repeated_discovery_failures'].includes(data.status))return null;
  const numeric=(v)=>Number.isSafeInteger(v)&&v>=0?v:null;
  if(numeric(counts.versionsRecovered)===null||numeric(counts.discovered)===null
    ||numeric(counts.failedDiscovery)===null)return null;
  const captured=data.families.reduce((total,row)=>total+
    (Number.isSafeInteger(row.captures)&&row.captures>=0?row.captures:0),0);
  const billsWithText=data.families.reduce((total,row)=>total+
    (Number.isSafeInteger(row.bills_with_text)&&row.bills_with_text>=0?row.bills_with_text:0),0);
  const backlogBills=Array.isArray(data.eligible)?data.eligible.reduce((sum,row)=>
    sum+(numeric(row.unstaged_bills)??0),0):null;
  const backlogJournals=Array.isArray(data.rawDocuments)?data.rawDocuments.reduce((sum,row)=>
    sum+(numeric(row.unscanned_documents)??0),0):null;
  const outstanding=data.outstanding??{};
  const complete=backlogBills===0&&backlogJournals===0
    &&['pending_discovery','pending_versions','failed_versions','failed_discovery'].every(
      name=>outstanding[name]===0);
  return {
    status:data.status,throttled:data.throttled===true,
    discovered:counts.discovered,versionsRecovered:counts.versionsRecovered,
    failedDiscovery:counts.failedDiscovery,
    totalCaptures:captured,billsWithText,backlogBills,backlogJournals,
    complete,baselineUnchanged:true,servingInputsUntouched:true,
  };
}
export function applyReceiptGuard(decision,receipt,now,lastRun){
  if(receipt?.complete)
    return {...decision,dispatch:false,reason:'collection_backfill_exhausted'};
  if(decision.dispatch&&receipt?.throttled===true
    &&Number.isFinite(Date.parse(lastRun?.created_at??''))
    &&now-Date.parse(lastRun.created_at)<THROTTLE_BACKOFF_MS)
    return {...decision,dispatch:false,reason:'official_source_throttle_cooldown'};
  return decision;
}

function report(row){
  console.log('SENATE_OFFICIAL_TEXT_RECOVERY_WATCHDOG='+JSON.stringify(row));
  if(process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### MN Senate official bill-text recovery watchdog\n\n'
      +'- Status: '+row.status+'\n'
      +'- Reason: '+row.reason+'\n'
      +'- Last collector run: '+(row.latestId??'none')+'\n'
      +'- Recovery run: '+(row.dispatchedRunId??'none')+'\n'
      +'- Last verified total raw captures: '+(row.totalCaptures??'unknown')+'\n'
      +'- Last batch new versions: '+(row.versionsRecovered??'unknown')+'\n\n');
}

async function github(method,path,body,logText=false){
  const token=process.env.GH_TOKEN;
  if(!token)throw Error('Watchdog GitHub token missing');
  const response=await fetch('https://api.github.com/repos/'+REPO+path,{
    method,headers:{
      Authorization:'Bearer '+token,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'votepredict-senate-official-text-watchdog',
      ...(body?{'Content-Type':'application/json'}:{}),
    },
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(20000),
  });
  if(!response.ok)
    throw Error('Guarded GitHub API '+method+' failed HTTP '+response.status);
  if(response.status===204)return null;
  if(logText){
    if(Number(response.headers.get('content-length'))>8_000_000)
      throw Error('Protected job log exceeds bounded inspection');
    const txt=await response.text();
    if(txt.length>8_000_000)throw Error('Protected job log exceeds bounded inspection');
    return txt;
  }
  return response.json();
}
async function collectorRuns(){
  const data=await github('GET','/actions/workflows/'+TEXT_WORKFLOW_ID+'/runs?per_page=30');
  if(!Array.isArray(data?.workflow_runs))throw Error('Missing official-text workflow run list');
  return eligibleCollectorRuns(data.workflow_runs);
}
async function readbackForCompleted(run){
  if(!run||run.status!=='completed')return {kind:'not_completed',receipt:null};
  const jobs=await github('GET','/actions/runs/'+run.id+'/jobs?per_page=100');
  const protectedJob=jobs?.jobs?.find(job=>job.name==='protected-neon');
  if(!protectedJob||protectedJob.conclusion!=='success')
    return {kind:'protected_neon_not_successful',receipt:null};
  const log=await github('GET','/actions/jobs/'+protectedJob.id+'/logs',undefined,true);
  const receipt=parseProtectedReadback(log);
  return {kind:receipt?'verified':'missing_or_invalid_production_readback',receipt};
}

export async function main(){
  if(!process.env.GITHUB_EVENT_PATH)throw Error('GitHub event payload missing');
  const payload=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const trusted=validateGitHubEvent(process.env,payload);
  if(!trusted.eligible){
    report({status:'ignored',reason:trusted.reason});return;
  }
  const workflow=await github('GET','/actions/workflows/'+TEXT_WORKFLOW_ID);
  if(workflow?.id!==TEXT_WORKFLOW_ID||workflow?.path!==TEXT_WORKFLOW_PATH)
    throw Error('Official collector identity/path mismatch');
  if(workflow?.state!=='active'){
    report({status:'blocked',reason:'target_workflow_not_active'});
    throw Error('Collector intentionally inactive; refusing to re-enable');
  }
  const now=Date.now();
  const runs=await collectorRuns();
  const newest=[...runs].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0];
  const decision=decideBillTextRecovery(runs,now);
  if(!decision.dispatch&&decision.reason==='existing_collection_active'){
    report({status:'healthy',reason:decision.reason,latestId:decision.latestId,
      ageMinutes:decision.ageMinutes});return;
  }
  if(!decision.dispatch&&decision.reason==='existing_collection_stuck'){
    report({status:'stalled',reason:decision.reason,latestId:decision.latestId,
      ageMinutes:decision.ageMinutes});
    // Never start a second protected production job while one is active.
    process.exitCode=1;return;
  }
  let inspected={kind:'no_completed_run',receipt:null};
  if(newest?.status==='completed')
    inspected=await readbackForCompleted(newest);
  const resolved=applyReceiptGuard(decision,inspected.receipt,now,newest);
  const observation={
    reason:resolved.reason,latestId:resolved.latestId??null,
    ageMinutes:resolved.ageMinutes??null,
    productionReceipt:inspected.kind,
    totalCaptures:inspected.receipt?.totalCaptures??null,
    versionsRecovered:inspected.receipt?.versionsRecovered??null,
    backlogBills:inspected.receipt?.backlogBills??null,
    backlogJournals:inspected.receipt?.backlogJournals??null,
  };
  if(!resolved.dispatch){
    report({status:inspected.kind==='verified'?'healthy':'degraded',...observation});
    return;
  }
  await github('POST','/actions/workflows/'+TEXT_WORKFLOW_ID+'/dispatches',{ref:'main'});
  const dispatchedAfter=Date.now();
  let dispatchedRunId=null;
  for(let i=0;i<5;i++){
    await sleep(3_000);
    const recent=await collectorRuns();
    const found=recent.find(run=>run.event==='workflow_dispatch'
      &&Date.parse(run.created_at??'')>=dispatchedAfter-30_000);
    if(found){dispatchedRunId=found.id;break;}
  }
  report({status:dispatchedRunId?'dispatch_run_verified':'dispatch_accepted_awaiting_visibility',
    ...observation,dispatchedRunId});
  if(!dispatchedRunId)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    // No token, body, response, or stack trace ever leaves the runner.
    console.error('SENATE_OFFICIAL_TEXT_RECOVERY_WATCHDOG_ERROR='+JSON.stringify({
      kind:error instanceof Error?error.name:'non_error',category:'guarded_recovery_failed',
    }));
    process.exitCode=1;
  });
}

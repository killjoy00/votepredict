/**
 * Keyless decision logic for a GitHub Actions event-driven DFL recovery watchdog.
 * The action needs only its own GITHUB_TOKEN (actions:write), never Neon secrets.
 * It dispatches the existing protected DFL workflow, not production SQL itself.
 */
import {readFileSync, appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';

export const REPO = 'killjoy00/votepredict';
export const DFL_WORKFLOW_ID = 386885534;
export const MIN_IDLE_MS = 75 * 60 * 1000;
const FALLBACK_CRON = '23 * * * *';
const ACTIVE = new Set(['queued','in_progress','waiting','pending','requested']);

export function validateGitHubEvent(env, payload) {
  if(env.GITHUB_REPOSITORY !== REPO || payload?.repository?.full_name !== REPO ||
     env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_RUN_ATTEMPT !== '1')
    return {eligible:false,reason:'not_reviewed_main_repository'};
  if(!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA ?? ''))
    return {eligible:false,reason:'invalid_main_sha'};
  if(env.GITHUB_EVENT_NAME === 'push') {
    if(payload.ref !== 'refs/heads/main' || payload.after !== env.GITHUB_SHA ||
       payload.deleted === true || payload.forced === true)
      return {eligible:false,reason:'untrusted_main_push'};
  } else if(env.GITHUB_EVENT_NAME === 'schedule') {
    if(payload.schedule !== FALLBACK_CRON)
      return {eligible:false,reason:'unexpected_schedule'};
  } else if(env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    if(payload.ref && !['main','refs/heads/main'].includes(payload.ref))
      return {eligible:false,reason:'dispatch_not_main'};
  } else return {eligible:false,reason:'unapproved_event'};
  return {eligible:true,reason:'reviewed_main_event'};
}

export function decideRecovery(runs, now=Date.now(), minIdleMs=MIN_IDLE_MS) {
  if(!Array.isArray(runs) || !Number.isFinite(now) || minIdleMs < 60*60*1000)
    throw Error('Invalid bounded DFL watchdog inputs');
  // GitHub can create a workflow run whose guarded jobs are all skipped on
  // an unmarked main push. That is not a collector attempt: counting it as
  // fresh suppresses a needed recovery after missed scheduled runs.
  const checked = runs.filter(run => run.conclusion !== 'skipped').map(run => {
    const time = Date.parse(run.created_at ?? '');
    if(!Number.isFinite(time) || time > now + 60_000 || !run.status)
      throw Error('Unknown GitHub DFL workflow run timestamp or status');
    return {id:run.id,status:run.status,event:run.event,createdAt:time,ageMs:Math.max(0,now-time)};
  });
  const active = checked.filter(r => ACTIVE.has(r.status)).sort((a,b)=>b.createdAt-a.createdAt)[0];
  if(active) return {dispatch:false,reason:active.ageMs > 180*60*1000
    ? 'existing_collection_stuck' : 'existing_collection_active',
    latestId:active.id,ageMinutes:Math.floor(active.ageMs/60_000)};
  const latest = checked.sort((a,b)=>b.createdAt-a.createdAt)[0];
  if(latest && latest.ageMs < minIdleMs)
    return {dispatch:false,reason:'recent_collection_exists',latestId:latest.id,
      ageMinutes:Math.floor(latest.ageMs/60_000)};
  return {dispatch:true,reason:latest?'collection_overdue':'no_collection_runs',
    latestId:latest?.id ?? null,ageMinutes:latest?Math.floor(latest.ageMs/60_000):null};
}

function report(object) {
  const message = 'SENATE_DFL_RECOVERY_WATCHDOG='+JSON.stringify(object);
  console.log(message);
  if(process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### Minnesota Senate DFL recovery watchdog\n\n'+
      '- Decision: '+object.status+'\n'+
      '- Reason: '+object.reason+'\n'+
      '- Existing run: '+(object.latestId ?? 'none')+'\n'+
      '- Recovery run: '+(object.dispatchedRunId ?? 'not yet visible / not requested')+'\n\n');
}

async function github(method, path, body) {
  const token = process.env.GH_TOKEN;
  if(!token) throw Error('GitHub Actions token not configured for guarded watchdog');
  const response = await fetch('https://api.github.com/repos/'+REPO+path,{
    method,
    headers:{
      'Authorization':'Bearer '+token,
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'votepredict-senate-dfl-guarded-watchdog',
      ...(body ? {'Content-Type':'application/json'} : {}),
    },
    body:body ? JSON.stringify(body) : undefined,
    signal:AbortSignal.timeout(20_000),
  });
  if(!response.ok) {
    // Never print request headers, bearer token, or API body.
    throw Error('GitHub DFL watchdog API request failed: '+method+' '+path.split('?')[0]+
      ' HTTP '+response.status);
  }
  return response.status === 204 ? null : response.json();
}

async function latestDFLRuns() {
  const data = await github('GET','/actions/workflows/'+DFL_WORKFLOW_ID+'/runs?per_page=30');
  if(!Array.isArray(data?.workflow_runs)) throw Error('GitHub did not return DFL run records');
  return data.workflow_runs;
}

async function main() {
  const env=process.env;
  if(!env.GITHUB_EVENT_PATH) throw Error('Missing GitHub Actions event payload path');
  const payload=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const trust=validateGitHubEvent(env,payload);
  if(!trust.eligible) {
    report({status:'ignored_untrusted_event',reason:trust.reason});
    return;
  }
  const details=await github('GET','/actions/workflows/'+DFL_WORKFLOW_ID);
  if(details?.id!==DFL_WORKFLOW_ID || details?.path !== '.github/workflows/senate-dfl-sitemap-production.yml')
    throw Error('Unexpected protected DFL workflow identity');
  if(details?.state!=='active') {
    report({status:'blocked',reason:'target_workflow_not_active',state:details?.state});
    throw Error('Protected DFL workflow is not active; do not re-enable an intentionally disabled workflow');
  }
  const existing=await latestDFLRuns();
  const decision=decideRecovery(existing);
  if(!decision.dispatch) {
    report({status:decision.reason==='existing_collection_stuck'?'stalled':'healthy',
      reason:decision.reason,latestId:decision.latestId,ageMinutes:decision.ageMinutes});
    return;
  }
  await github('POST','/actions/workflows/'+DFL_WORKFLOW_ID+'/dispatches',{ref:'main'});
  const afterDispatch=Date.now();
  let dispatchedRunId=null;
  for(let i=0;i<4;i++){
    await sleep(3_000);
    const latest=await latestDFLRuns();
    const found=latest.find(r=>r.event==='workflow_dispatch' &&
      Date.parse(r.created_at ?? '') >= afterDispatch-30_000);
    if(found){dispatchedRunId=found.id;break;}
  }
  report({status:dispatchedRunId?'dispatch_run_verified':'dispatch_accepted_awaiting_visibility',
    reason:decision.reason,latestId:decision.latestId,
    ageMinutes:decision.ageMinutes,dispatchedRunId});
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(e=>{
    console.error('SENATE_DFL_RECOVERY_WATCHDOG_ERROR='+JSON.stringify({
      kind:e instanceof Error?e.name:'non_error',category:'guarded_dispatch_failed',
      // Do not print secrets or untrusted response bodies.
    }));
    process.exitCode=1;
  });
}

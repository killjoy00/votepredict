import test from 'node:test';
import assert from 'node:assert/strict';
import {decideRecovery,validateGitHubEvent,MIN_IDLE_MS,REPO} from '../scripts/senate-dfl-sitemap-watchdog.mjs';

const NOW=Date.parse('2026-10-16T22:00:00Z');
const run=(minutes,status='completed',event='push',id=100) => ({
  id,created_at:new Date(NOW-minutes*60_000).toISOString(),status,event,
});
const env={
  GITHUB_REPOSITORY:REPO,
  GITHUB_REF:'refs/heads/main',
  GITHUB_SHA:'a'.repeat(40),
  GITHUB_RUN_ATTEMPT:'1',
  GITHUB_EVENT_NAME:'push',
};
const payload={ref:'refs/heads/main',after:env.GITHUB_SHA,repository:{full_name:REPO}};

test('refuse arbitrary repos and unreviewed refs',()=>{
  assert.equal(validateGitHubEvent({...env,GITHUB_REPOSITORY:'other/repo'},payload).eligible,false);
  assert.equal(validateGitHubEvent({...env,GITHUB_REF:'refs/heads/feature'},payload).eligible,false);
  assert.equal(validateGitHubEvent(env,{...payload,after:'b'.repeat(40)}).eligible,false);
  assert.equal(validateGitHubEvent(env,{...payload,forced:true}).eligible,false);
});
test('accept only expected push, schedule and main dispatch',()=>{
  assert.equal(validateGitHubEvent(env,payload).eligible,true);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'schedule'},
    {repository:{full_name:REPO},schedule:'23 * * * *'}).eligible,true);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'schedule'},
    {repository:{full_name:REPO},schedule:'47 * * * *'}).eligible,false);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'workflow_dispatch'},
    {repository:{full_name:REPO},ref:'main'}).eligible,true);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'pull_request'},payload).eligible,false);
});
test('skip recently created collectors, including failed ones',()=>{
  assert.deepEqual(decideRecovery([run(30)],NOW).dispatch,false);
  assert.equal(decideRecovery([run(74.9,'completed')],NOW).reason,'recent_collection_exists');
  assert.equal(decideRecovery([run(74.9,'completed'),run(120,'completed','push',101)],NOW).dispatch,false);
});
test('dispatch after 75 minutes idle, never when one is active',()=>{
  assert.deepEqual(decideRecovery([run(76)],NOW).dispatch,true);
  assert.equal(decideRecovery([run(201,'in_progress')],NOW).reason,'existing_collection_stuck');
  assert.equal(decideRecovery([run(96,'queued')],NOW).reason,'existing_collection_active');
  assert.equal(decideRecovery([run(90,'completed'),run(5,'waiting','workflow_dispatch',101)],NOW).dispatch,false);
});
test('dispatch if no collector runs, reject bad timestamps',()=>{
  assert.equal(decideRecovery([],NOW).reason,'no_collection_runs');
  assert.throws(()=>decideRecovery([{...run(5),created_at:'not a date'}],NOW));
  assert.throws(()=>decideRecovery([run(5)],NOW,30*60_000));
});
test('active collector prevents repeated dispatch, even with an older failed run',()=>{
  const decision=decideRecovery([run(100,'failure'),run(180,'in_progress','workflow_dispatch',105)],NOW,MIN_IDLE_MS);
  assert.equal(decision.dispatch,false);
  assert.equal(decision.latestId,105);
});

test('skipped workflow runs never suppress overdue DFL recovery',()=>{
  const skipped={...run(1,'completed','push',201),conclusion:'skipped'};
  const stale={...run(100,'completed','schedule',200),conclusion:'success'};
  assert.equal(decideRecovery([skipped,stale],NOW).reason,'collection_overdue');
  assert.equal(decideRecovery([skipped,stale],NOW).dispatch,true);
  assert.equal(decideRecovery([skipped],NOW).reason,'no_collection_runs');
  const recentlyFailed={...run(40,'completed','workflow_dispatch',202),conclusion:'failure'};
  assert.equal(decideRecovery([skipped,recentlyFailed],NOW).reason,'recent_collection_exists');
});

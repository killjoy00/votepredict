import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPO,TEXT_WORKFLOW_ID,TEXT_WORKFLOW_PATH,WATCHDOG_CRON,
  validateGitHubEvent,eligibleCollectorRuns,decideBillTextRecovery,
  parseProtectedReadback,applyReceiptGuard,
} from '../scripts/senate-official-bill-text-watchdog.mjs';

const NOW=Date.parse('2026-10-17T02:00:00Z');
const env={
  GITHUB_REPOSITORY:REPO,GITHUB_REF:'refs/heads/main',
  GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'push',
};
const push={
  ref:'refs/heads/main',after:env.GITHUB_SHA,
  repository:{full_name:REPO},head_commit:{id:env.GITHUB_SHA},
};
const run=(minutes,status='completed',event='workflow_dispatch',id=100)=>({
  id,created_at:new Date(NOW-minutes*60_000).toISOString(),
  status,event,head_branch:'main',conclusion:status==='completed'?'success':null,
});
const receipt=(changes={})=>({
  status:'bounded_batch_committed',throttled:false,
  baselineUnchanged:true,servingInputsUntouched:true,
  counts:{versionsRecovered:21,discovered:15,failedDiscovery:0},
  families:[{family:'numbered_version',captures:21,bills_with_text:15}],
  eligible:[{unstaged_bills:2400}],
  rawDocuments:[{unscanned_documents:470}],
  outstanding:{pending_discovery:0,pending_versions:0,failed_versions:0,failed_discovery:0},
  ...changes,
});
const log=(value)=>'Other protected messages\nSENATE_OFFICIAL_TEXT_RAW_READBACK='+
  JSON.stringify(value)+'\nOther log messages\n';

test('watchdog pins expected repo and approved GitHub workflow',()=>{
  assert.equal(TEXT_WORKFLOW_ID,387035882);
  assert.equal(TEXT_WORKFLOW_PATH,'.github/workflows/senate-official-bill-text-production.yml');
  assert.equal(WATCHDOG_CRON,'13 * * * *');
});
test('only verified main events can inspect/dispatch protected collector',()=>{
  assert.equal(validateGitHubEvent(env,push).eligible,true);
  assert.equal(validateGitHubEvent({...env,GITHUB_REPOSITORY:'other/repo'},push).eligible,false);
  assert.equal(validateGitHubEvent({...env,GITHUB_REF:'refs/heads/test'},push).eligible,false);
  assert.equal(validateGitHubEvent({...env,GITHUB_RUN_ATTEMPT:'2'},push).eligible,false);
  assert.equal(validateGitHubEvent(env,{...push,after:'b'.repeat(40)}).eligible,false);
  assert.equal(validateGitHubEvent(env,{...push,head_commit:{id:'b'.repeat(40)}}).eligible,false);
  assert.equal(validateGitHubEvent(env,{...push,forced:true}).eligible,false);
  assert.equal(validateGitHubEvent(env,{...push,deleted:true}).eligible,false);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'pull_request'},push).eligible,false);
});
test('watchdog accepts only its cron and default-branch dispatch',()=>{
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'schedule'},
    {repository:{full_name:REPO},schedule:WATCHDOG_CRON}).eligible,true);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'schedule'},
    {repository:{full_name:REPO},schedule:'27 */6 * * *'}).eligible,false);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'workflow_dispatch'},
    {repository:{full_name:REPO},ref:'main'}).eligible,true);
  assert.equal(validateGitHubEvent({...env,GITHUB_EVENT_NAME:'workflow_dispatch'},
    {repository:{full_name:REPO},ref:'feature'}).eligible,false);
});
test('PR checks and skipped main triggers cannot mask a missed collector',()=>{
  const pr={...run(10),event:'pull_request'};
  const skipped={...run(3),event:'push',conclusion:'skipped'};
  const wrongBranch={...run(1),head_branch:'feature'};
  assert.deepEqual(eligibleCollectorRuns([pr,skipped,wrongBranch]),[]);
  const decision=decideBillTextRecovery([pr,skipped,wrongBranch,run(90)],NOW);
  assert.equal(decision.dispatch,true);
  assert.equal(decision.reason,'collection_overdue');
});
test('reuses DFL stale-run decision and respects active collector exclusion',()=>{
  assert.equal(decideBillTextRecovery([run(5)],NOW).dispatch,false);
  assert.equal(decideBillTextRecovery([run(76)],NOW).dispatch,true);
  assert.equal(decideBillTextRecovery([],NOW).reason,'no_collection_runs');
  assert.equal(decideBillTextRecovery([run(110,'in_progress')],NOW).reason,
    'existing_collection_active');
  assert.equal(decideBillTextRecovery([run(181,'in_progress')],NOW).reason,
    'existing_collection_stuck');
  assert.throws(()=>decideBillTextRecovery([{...run(50),created_at:'broken'}],NOW));
});
test('reads actual protected database receipts, not GitHub workflow green status',()=>{
  const parsed=parseProtectedReadback(log(receipt()));
  assert.deepEqual({
    totalCaptures:parsed.totalCaptures,billsWithText:parsed.billsWithText,
    versionsRecovered:parsed.versionsRecovered,backlogBills:parsed.backlogBills,
    backlogJournals:parsed.backlogJournals,complete:parsed.complete,
  },{
    totalCaptures:21,billsWithText:15,versionsRecovered:21,backlogBills:2400,
    backlogJournals:470,complete:false,
  });
  assert.equal(parseProtectedReadback('green workflow without Neon receipt'),null);
  assert.equal(parseProtectedReadback(log(receipt({baselineUnchanged:false}))),null);
  assert.equal(parseProtectedReadback(log(receipt({servingInputsUntouched:false}))),null);
  assert.equal(parseProtectedReadback(log(receipt({counts:{discovered:1,versionsRecovered:-1,failedDiscovery:0}}))),null);
});
test('skip dispatch on completed backlog and cool down when source throttled',()=>{
  const completed=parseProtectedReadback(log(receipt({
    eligible:[{unstaged_bills:0}],rawDocuments:[{unscanned_documents:0}],
  })));
  const due=decideBillTextRecovery([run(90)],NOW);
  assert.deepEqual(applyReceiptGuard(due,completed,NOW,run(90)).dispatch,false);
  assert.equal(applyReceiptGuard(due,completed,NOW,run(90)).reason,
    'collection_backfill_exhausted');
  const throttled=parseProtectedReadback(log(receipt({
    status:'stopped_on_official_throttle',throttled:true,
  })));
  assert.equal(applyReceiptGuard(due,throttled,NOW,run(90)).reason,
    'official_source_throttle_cooldown');
  assert.equal(applyReceiptGuard(due,throttled,NOW,run(370)).dispatch,true);
  assert.equal(applyReceiptGuard(due,null,NOW,run(90)).dispatch,true);
});

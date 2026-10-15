// @ts-nocheck -- JS runtime entrypoints are .mjs with no TypeScript declaration file; this is an execution test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  READONLY_COMMENT,assertOwnerEvent,assertAllThirteenSafeToApply,
  assertAllThirteenVerifiedAfterApply,verifyConnectionIdentity,
} from '../scripts/run-senate-864-2026-protected-neon-13.mjs';
import {APPLY_COMMENT} from '../src/evidence/senate-864-2026-verified-positions.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {verifiedSenate864} from '../src/evidence/senate-864-2026-verified-positions.mjs';

const env={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),GITHUB_ACTOR:'killjoy00',
  VOTEPREDICT_864_13_INDEPENDENT_CI:'true',
};
const makeEvent=(body:string)=>({
  repository:{full_name:'killjoy00/votepredict'},
  issue:{number:864},
  comment:{user:{login:'killjoy00'},body},
});
const districts=verifiedSenate864.claims.map(x=>x.district);
const preview=(status:string,held=0)=>({
  claims:13,verifiedOriginalPages:13,blockedOriginalUrlsExcluded:15,
  unmatchedQuoteUrlsExcluded:1,noQuoteSenatorsExcluded:3,
  perPublicDistrict:districts.map(district=>({district,status})),
  plannedOrApplied:{
    inserted:status==='INSERT_VERIFIED_QUOTE'?13:0,
    repaired:status==='REPAIR_EXISTING_VERIFIED_TIMESTAMP'?13:0,
    already:status.startsWith('EXISTING_')?13:0,
    held,
  },
});

test('only the exact owner GitHub issue comment with same immutable main and CI may read or write',()=>{
  assert.equal(assertOwnerEvent(env,makeEvent(READONLY_COMMENT),'--dry-run'),true);
  assert.equal(assertOwnerEvent(env,makeEvent(APPLY_COMMENT),'--apply'),true);
  for(const changed of [
    {GITHUB_ACTOR:'another-person'},{GITHUB_REF:'refs/pull/5/merge'},
    {GITHUB_REPOSITORY:'other/project'},{GITHUB_EVENT_NAME:'push'},
    {GITHUB_SHA:'short'},{GITHUB_RUN_ATTEMPT:'2'},
    {VOTEPREDICT_864_13_INDEPENDENT_CI:'false'},
  ])assert.throws(()=>assertOwnerEvent({...env,...changed},makeEvent(APPLY_COMMENT),'--apply'));
  for(const event of [
    makeEvent('ignore me'),{...makeEvent(APPLY_COMMENT),issue:{number:865}},
    {...makeEvent(APPLY_COMMENT),comment:{user:{login:'attacker'},body:APPLY_COMMENT}},
    {...makeEvent(APPLY_COMMENT),issue:{number:864,pull_request:{url:'fake'}}},
  ])assert.throws(()=>assertOwnerEvent(env,event,'--apply'));
  assert.throws(()=>assertOwnerEvent(env,makeEvent(APPLY_COMMENT),'--dry-run'));
});

test('all thirteen public districts must reconcile without holds before an atomic apply',()=>{
  assert.doesNotThrow(()=>assertAllThirteenSafeToApply(preview('INSERT_VERIFIED_QUOTE')));
  assert.doesNotThrow(()=>assertAllThirteenSafeToApply(preview('EXISTING_QUOTE')));
  assert.throws(()=>assertAllThirteenSafeToApply({
    ...preview('INSERT_VERIFIED_QUOTE'),
    plannedOrApplied:{inserted:12,repaired:0,already:0,held:1},
  }));
});
test('post-commit SELECT must confirm 13 existing statements, no pending insert or repair',()=>{
  assert.doesNotThrow(()=>assertAllThirteenVerifiedAfterApply(preview('EXISTING_QUOTE')));
  assert.throws(()=>assertAllThirteenVerifiedAfterApply(preview('INSERT_VERIFIED_QUOTE')));
  assert.throws(()=>assertAllThirteenVerifiedAfterApply(preview('REPAIR_EXISTING_VERIFIED_TIMESTAMP')));
});

test('Neon identity and table read/write permissions are independently verified without logging',async()=>{
  const target={database:'neondb',role:'neondb_owner'};
  const fake=(other:Record<string,unknown>={})=>({
    query:async()=>({rows:[{db:'neondb',role:'neondb_owner',
      source_read:true,evidence_read:true,source_write:true,evidence_write:true,...other}]}),
  });
  assert.equal(await verifyConnectionIdentity(fake() as never,target,{write:true}),true);
  await assert.rejects(()=>verifyConnectionIdentity(fake({db:'packone'}) as never,target));
  await assert.rejects(()=>verifyConnectionIdentity(fake({source_write:false}) as never,target,{write:true}));
  assert.equal(await verifyConnectionIdentity(fake({source_write:false}) as never,target,{write:false}),true);
});

test('requirePrimary pins the EXISTING Neon write primary rather than available read replica',async()=>{
  const p='blue-fog-12345',b='br-one-123',host='ep-writer-234.us-east-2.aws.neon.tech';
  const root='https://console.neon.tech/api/v2/projects/'+p;
  const replies=[
    [root,{project:{id:p,name:'VotePredict existing'}}],
    [root+'/branches?limit=100',{branches:[{id:b,project_id:p,default:true}],pagination:{next:null}}],
    [root+'/branches/'+b+'/databases',{databases:[{name:'neondb',owner_name:'neondb_owner',branch_id:b}]}],
    [root+'/endpoints',{endpoints:[
      {id:'ep-replica-123',host:'ep-replica-123.us-east-2.aws.neon.tech',branch_id:b,project_id:p,type:'read_only'},
      {id:'ep-writer-234',host,branch_id:b,project_id:p,type:'read_write'},
    ]}],
  ] as const;
  let requestedPrimary=false;
  const api=async(url:string)=>{
    if(url.startsWith(root+'/connection_uri?')){
      const q=new URL(url).searchParams;
      requestedPrimary=q.get('endpoint_id')==='ep-writer-234'&&q.get('pooled')==='false';
      return new Response(JSON.stringify({
        uri:'postgresql://neondb_owner:test-secret@'+host+'/neondb?sslmode=require',
      }));
    }
    const found=replies.find(x=>x[0]===url);
    if(!found)throw Error('unexpected Neon API operation');
    return new Response(JSON.stringify(found[1]));
  };
  const target=await discoverExistingVotePredictNeonConnection({
    apiKey:'test-key',projectId:p,requirePrimary:true,
  },api as typeof fetch);
  assert.equal(target.host,host);
  assert.equal(requestedPrimary,true);
  const noPrimary=async(url:string)=>{
    if(url===root+'/endpoints')return new Response(JSON.stringify({endpoints:[
      {id:'ep-replica-123',host:'ep-replica-123.us-east-2.aws.neon.tech',branch_id:b,project_id:p,type:'read_only'},
    ]}));
    return api(url);
  };
  await assert.rejects(()=>discoverExistingVotePredictNeonConnection({
    apiKey:'test-key',projectId:p,requirePrimary:true,
  },noPrimary as typeof fetch),/unambiguous/);
});

test('one-shot workflow has secret isolation, owner-only comment, fresh full CI and no other triggers',()=>{
  const yml=readFileSync('.github/workflows/senate-864-2026-protected-neon-13-reconciliation.yml','utf8');
  assert.match(yml,/^  issue_comment:\n    types: \[created\]/m);
  assert.doesNotMatch(yml,/^  (?:push|pull_request|schedule|workflow_dispatch):/m);
  assert.match(yml,/github\.event\.comment\.user\.login == 'killjoy00'/);
  assert.match(yml,/github\.event\.issue\.number == 864/);
  assert.match(yml,/github\.run_attempt == 1/);
  assert.match(yml,/cancel-in-progress: false/);
  assert.match(yml,/name: Verify exact original source ledger and guarded reconciler in full CI\n        run: npm run check/);
  const pre=yml.split('  independent-ci:\n')[1]?.split('  protected-neon:\n')[0]??'';
  assert.doesNotMatch(pre,/NEON_API_KEY:|secrets\.NEON_API_KEY|environment:/);
  const protectedJob=yml.split('  protected-neon:\n')[1]??'';
  assert.match(protectedJob,/needs\.independent-ci\.result == 'success'/);
  assert.match(protectedJob,/environment: evidence-readonly-sandbox/);
  assert.match(protectedJob,/NEON_API_KEY: \$\{\{ secrets\.NEON_API_KEY \}\}/);
  assert.match(protectedJob,/persist-credentials: false/);
  assert.doesNotMatch(yml,/upload-artifact|CREATE ROLE|neon branch create|vercel env|curl .*secret/i);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { classify2027CollectionUrl,assert2027InitialTextUrl,collectionSourceFetch,with2027ArchivedSources,COLLECTION_LIMITS } from '../src/sources/minnesota/2027-collection-source.js';
import { DAILY_COLLECTION_PLAN,assertDailyCollectionRun,assertDailyRunAvailable,collectionAlerts,archive2027Source,type CollectionHealth } from '../src/operations/2027-daily-collection.js';
import { databaseTargetFingerprint } from '../src/operations/release-readiness.js';
import { buildRevisorBillSearchUrl } from '../src/sources/minnesota/revisor-bill-search.js';

const status='https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/1/';
const text='https://www.revisor.mn.gov/bills/95/2027/0/HF/1/versions/0/';
const catalog=buildRevisorBillSearchUrl({sessionKey:'2027-2028',body:'House',firstBill:1,lastBill:500});
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
test('collection admits only exact bounded 2027 source scope',()=>{
  assert.equal(classify2027CollectionUrl(catalog),'catalog');
  assert.equal(classify2027CollectionUrl(status),'status');
  assert.equal(classify2027CollectionUrl(text),'initial_text');
  for(const value of [status.replace('/95/2027/','/94/2025/'),status+'?x=1',status.replace('api.revisor.mn.gov','example.com'),
    status.replace('/0/HF/','/1/HF/'),text.replace('/versions/0/','/versions/latest/'),catalog.replace('0952027','0942025'),catalog+'&session=0952027',
    catalog.replace('1-500','1-501')])assert.throws(()=>classify2027CollectionUrl(value),/scope|URL/);
  assert.doesNotThrow(()=>assert2027InitialTextUrl('HF1','2027.0-HF0001-0',text));
  assert.throws(()=>assert2027InitialTextUrl('HF2','2027.0-HF0002-0',text),/identity/);
  assert.throws(()=>assert2027InitialTextUrl('HF1','2027.0-HF0001-1',text),/identity/);
});
test('source response bytes are archived before parser receives them; refusal and limits are visible',async()=>{
  const bytes=Buffer.from([0xef,0xbb,0xbf,60,66,73,76,76,47,62]);
  let archived=false;
  await with2027ArchivedSources('123:1',async(receipt,body)=>{
    assert.deepEqual(body,bytes);assert.equal(receipt.responseBodySha256,sha(bytes));
    assert.equal(receipt.sourceUrl,status);assert.equal(receipt.responseBodyBytes,bytes.length);
    assert.equal(receipt.runId,'123:1');assert.equal(receipt.httpStatus,200);archived=true;return 'a'.repeat(64);
  },async counters=>{
    const response=await collectionSourceFetch(status);
    assert.ok(archived);assert.equal(response.url,status);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
    assert.equal(counters.archived,1);assert.equal(counters.requests,1);assert.equal(counters.bytes,bytes.length);
    await assert.rejects(collectionSourceFetch('https://example.com'),/scope/);
    assert.equal(counters.failed,1);
  },async(_url,init)=>{assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');return new Response(new Uint8Array(bytes),{status:200});});
  await with2027ArchivedSources('124:1',async()=>{throw Error('archive not available');},async counters=>{
    await assert.rejects(collectionSourceFetch(status),/archive not available/);assert.equal(counters.archived,0);assert.equal(counters.failed,1);
  },async()=>new Response('<BILL/>'));
  await with2027ArchivedSources('125:1',async()=> 'b'.repeat(64),async counters=>{
    for(let i=0;i<COLLECTION_LIMITS.statusRequests;i++)await collectionSourceFetch(status);
    await assert.rejects(collectionSourceFetch(status),/budget exhausted/);
    assert.equal(counters.requests,COLLECTION_LIMITS.statusRequests);assert.equal(counters.archived,counters.requests);
  },async()=>new Response('<BILL/>'));
  await with2027ArchivedSources('126:1',async()=>{throw Error('must not archive');},async counters=>{
    await assert.rejects(collectionSourceFetch(status),/oversize/);assert.equal(counters.archived,0);
  },async()=>new Response('large',{headers:{'content-length':String(COLLECTION_LIMITS.maxResponseBytes+1)}}));
});
test('live collection is dormant and rejects wrong dates, repo, attempts, targets and roles',()=>{
  const url='postgresql://collector:fixture@ep-fixture.c-2.us-east-2.aws.neon.tech/votepredict?sslmode=verify-full';
  const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/2027-daily-collection.yml@refs/heads/main',
    VOTEPREDICT_2027_COLLECTION_AUTHORIZED:'true',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',VOTEPREDICT_2027_COLLECTOR_DATABASE_URL:url,
    VOTEPREDICT_2027_COLLECTOR_ROLE:'collector',VOTEPREDICT_2027_COLLECTOR_DATABASE_FINGERPRINT:databaseTargetFingerprint(url)!};
  assert.equal(DAILY_COLLECTION_PLAN.productionScheduleEnabled,false);
  const now=new Date('2027-01-12T18:00:00Z');
  assert.equal(assertDailyCollectionRun(env,now).day,'2027-01-12');
  assert.throws(()=>assertDailyCollectionRun(env,new Date('2027-01-12T05:59:59Z')));
  for(const patch of [{VERCEL:'1'},{GITHUB_REF:'refs/heads/topic'},{GITHUB_RUN_ATTEMPT:'2'},{VOTEPREDICT_2027_COLLECTION_AUTHORIZED:'false'},
    {VOTEPREDICT_2027_COLLECTOR_ROLE:'owner'},{VOTEPREDICT_2027_COLLECTOR_DATABASE_FINGERPRINT:'f'.repeat(64)}])assert.throws(()=>assertDailyCollectionRun({...env,...patch},now));
  const day='2027-01-12';
  assert.doesNotThrow(()=>assertDailyRunAvailable([{day,runId:'122:1',state:'started'}],day,'123:1'));
  assert.throws(()=>assertDailyRunAvailable([{day,runId:'122:1',state:'completed_batch'}],day,'123:1'));
  assert.throws(()=>assertDailyRunAvailable([{day,runId:'122:1',state:'started'},{day,runId:'121:1',state:'started'}],day,'123:1'));
});
test('health distinguishes bounded work from incomplete data coverage',()=>{
  const before:CollectionHealth={knownBills:200,houseBills:120,senateBills:80,neverObserved:0,staleStatus:0,failedStatus:0,missingInitialText:0};
  const counters={requests:2,bytes:100,archived:1,failed:1,byKind:{catalog:1,status:1,initial_text:0},receiptSha256s:[]};
  const alerts=collectionAlerts(before,{...before,staleStatus:80,missingInitialText:4},199,counters,true);
  for(const item of ['SOURCE_OR_COLLECTION_FAILURE','UNARCHIVED_SOURCE_ATTEMPTS','CATALOG_COVERAGE_REGRESSION','STATUS_BACKLOG_OR_STALE','INITIAL_TEXT_BACKLOG'])assert.ok(alerts.includes(item));
});

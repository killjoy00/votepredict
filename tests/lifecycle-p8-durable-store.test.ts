import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {
  buildOfflineP8DailyCapture,type P8DailyBillInput,
} from '../src/evaluation/lifecycle-p8-daily-capture.js';
import {
  sealP8SuppliedUniverseIndex,P8_UNIVERSE_AUDIT_SCHEMA,P8_UNIVERSE_PROOF,
} from '../src/evaluation/lifecycle-p8-universe-coverage.js';
import {
  auditP8DailyCaptureHealth,auditP8CaptureHeartbeat,
  formatP8CaptureActionAnnotations,
} from '../src/evaluation/lifecycle-p8-capture-health.js';
import {
  appendP8DurableDailyCapture,readP8DurableDailyCapture,
  inspectP8DurableHeartbeat,
} from '../src/evaluation/lifecycle-p8-durable-store.js';
import {LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256}
  from '../src/evaluation/lifecycle-p8-prospective.js';

const official='https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/42/';
const SHA='a'.repeat(64);
const makeBill=(billId:string,identifier:string,firstObservedAt:string,
 parsed=true):P8DailyBillInput=>({
  billId,identifier,firstObservedAt,session:'2027-2028',
  chamber:identifier.startsWith('HF')?'house':'senate',
  introducedOn:'2027-01-04',adjournmentOn:'2028-05-20',
  sourceUrl:official,sourceSha256:SHA,
  process:parsed?
    {status:'parsed',observedAt:firstObservedAt,
      parserVersion:'revisor-process-v2',events:[]}:
    {status:'source_deferred',observedAt:null,
      parserVersion:null,events:[]},
  billVersions:[],
});
const hf42=makeBill('durable-hf42','HF42','2027-01-05T16:00:00.000Z');
const sf7=makeBill('durable-sf7','SF7','2027-01-06T16:00:00.000Z',false);
const hf99=makeBill('durable-hf99','HF99','2027-01-08T16:00:00.000Z');
function day(
 cutoff:string,
 capturedBills:P8DailyBillInput[],
 universeBills:P8DailyBillInput[]=[hf42,sf7,hf99],
 timestamp=cutoff+'T16:00:00.000Z',
){
 const batch=buildOfflineP8DailyCapture({
  cutoffDateExclusive:cutoff,capturedAt:timestamp,
  bills:capturedBills,source:'offline_supplied_asof_fixtures',
 });
 // Day immediately preceding the cutoff is the independent caller's
 // supplied-universe inventory observation; it is NOT government verified.
 const before=new Date(Date.parse(cutoff+'T00:00:00.000Z')-86400000)
  .toISOString().slice(0,10);
 const manifest=sealP8SuppliedUniverseIndex({
  schemaVersion:P8_UNIVERSE_AUDIT_SCHEMA,session:'2027-2028',
  cutoffDateExclusive:cutoff,
  source:{sourceUrl:'https://www.revisor.mn.gov',
    sourceSha256:'b'.repeat(64),
    observedAt:before+'T19:00:00.000Z',proofLevel:P8_UNIVERSE_PROOF},
  bills:universeBills.map(x=>({
   billId:x.billId,identifier:x.identifier,firstObservedAt:x.firstObservedAt,
  })),
 });
 return {batch,manifest};
}

test('health reports supplied-list gaps, deferred sources and no official proof',()=>{
 const {batch,manifest}=day('2027-01-10',[hf42]);
 const h=auditP8DailyCaptureHealth({currentBatch:batch,currentManifest:manifest});
 assert.equal(h.metrics.missingSuppliedBills,2);
 assert.equal(h.metrics.capturedBillCount,1);
 assert.equal(h.metrics.parsedProcessBillCount,1);
 assert.equal(h.independentlyVerifiedOfficialBillUniverse,false);
 assert.equal(h.predictionAndOutcomeDataRead,false);
 assert.equal(h.productionCollectionActive,false);
 assert.equal(h.status,'critical');
 assert.ok(h.alerts.some(a=>a.code==='UNVERIFIED_OFFICIAL_UNIVERSE'));
 assert.ok(h.alerts.some(a=>a.code==='SUPPLIED_BILL_MISSING'&&a.count===2));
 assert.equal(formatP8CaptureActionAnnotations(h.alerts)
  .some(a=>a.startsWith('::error title=P8 SUPPLIED_BILL_MISSING::')),true);
 const empty=auditP8DailyCaptureHealth({
  currentBatch:day('2027-01-11',[],[hf42]).batch,
  currentManifest:day('2027-01-11',[],[hf42]).manifest,
 });
 assert.equal(empty.metrics.missingSuppliedBills,1);
});
test('continuity reports disappeared bill, changed first-observation and missing days',()=>{
 const a=day('2027-01-10',[hf42,sf7],[hf42,sf7]);
 const changed=makeBill('durable-hf42','HF42','2027-01-07T16:00:00.000Z');
 const b=day('2027-01-12',[changed],[changed,sf7]);
 const h=auditP8DailyCaptureHealth({
  previousBatch:a.batch,previousManifest:a.manifest,
  currentBatch:b.batch,currentManifest:b.manifest,
 });
 assert.equal(h.metrics.skippedCalendarDays,1);
 assert.equal(h.metrics.previouslyCapturedBillsDisappeared,1);
 assert.equal(h.metrics.alteredFirstObservationClocks,1);
 for(const code of ['CAPTURE_CALENDAR_DAYS_MISSED',
  'PRIOR_CAPTURE_BILL_DISAPPEARED','FIRST_OBSERVATION_CHANGED']){
   assert.ok(h.alerts.some(a=>a.code===code&&a.severity==='critical'));
 }
});
test('heartbeat distinguishes disabled, expected missing, stale and current',()=>{
 assert.equal(auditP8CaptureHeartbeat({checkedAt:'2027-01-10T20:00:00.000Z',
  latestStoredCutoff:null,collectionExpected:false}).status,'disabled');
 const none=auditP8CaptureHeartbeat({checkedAt:'2027-01-10T20:00:00.000Z',
  latestStoredCutoff:null,collectionExpected:true});
 assert.equal(none.status,'critical');
 assert.equal(none.alerts[0]?.code,'CAPTURE_HEARTBEAT_NEVER_STARTED');
 const late=auditP8CaptureHeartbeat({checkedAt:'2027-01-14T20:00:00.000Z',
  latestStoredCutoff:'2027-01-12',collectionExpected:true});
 assert.equal(late.lateDays,2);
 assert.equal(late.alerts[0]?.code,'CAPTURE_HEARTBEAT_STALE');
 assert.equal(auditP8CaptureHeartbeat({checkedAt:'2027-01-14T20:00:00.000Z',
  latestStoredCutoff:'2027-01-14',collectionExpected:true}).status,'current');
 assert.equal(auditP8CaptureHeartbeat({checkedAt:'2026-10-19T15:00:00.000Z',
  latestStoredCutoff:null,collectionExpected:true}).status,'not_yet_due');
 assert.throws(()=>auditP8CaptureHeartbeat({checkedAt:'2027-01-10T20:00:00.000Z',
  latestStoredCutoff:'2027-01-11',collectionExpected:true}),/after monitoring/);
});
test('original model and scoring policy unchanged in the persisted capture shape',()=>{
 const {batch}=day('2027-01-10',[hf42]);
 assert.equal(batch.frozenModelContentSha256Reference,
  LIFECYCLE_P8_FROZEN_MODEL_CONTENT_SHA256);
 assert.equal(batch.productionCaptureActivated,false);
 assert.equal(batch.outcomeRead,false);
 assert.equal(batch.predictionsComputed,false);
 assert.equal(batch.rows.every(r=>r.memberVoteLabel===null),true);
});

const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!url&&['localhost','127.0.0.1'].includes(new URL(url).hostname);
test('PostgreSQL: durable receipts, concurrency, immutable history, chained continuity, live alert fields',
  {skip:!local,timeout:70_000},async()=>{
   // Unlike a fixture-only in-memory store, this exercises real PostgreSQL
   // advisory locks, unique constraints, triggers, transactions and DB clock.
   // An isolated throwaway schema is dropped on exit: never touch production.
   const admin=new Pool({connectionString:url!,max:2});
   const schema='p8_proof_'+randomUUID().replaceAll('-','').slice(0,16);
   let pool:Pool|null=null;
   try{
     await admin.query('CREATE SCHEMA "'+schema+'"');
     pool=new Pool({connectionString:url!,max:6,
       options:'-c search_path='+schema});
     const ddl=await readFile('migrations/0036_lifecycle_p8_durable_daily_capture.sql','utf8');
     await pool.query(ddl);
     const a=day('2027-01-10',[hf42],[hf42,sf7]);
     const jobs=await Promise.all(Array.from({length:5},(_,i)=>{
       const copy=day('2027-01-10',[hf42],[hf42,sf7],
         '2027-01-10T'+(16+i)+':00:00.000Z');
       return appendP8DurableDailyCapture({
         pool:pool!,batch:copy.batch,suppliedUniverse:copy.manifest,
       });
     }));
     assert.equal(jobs.filter(x=>x.disposition==='created').length,1);
     assert.equal(jobs.filter(x=>x.disposition==='already_present').length,4);
     assert.equal(new Set(jobs.map(x=>x.firstRecordedAt)).size,1);
     assert.equal(new Set(jobs.map(x=>x.firstCallerCapturedAt)).size,1);
     assert.equal(jobs[0]!.health.metrics.missingSuppliedBills,1);
     assert.equal(jobs[0]!.health.status,'critical');
     assert.equal(jobs[0]!.health.independentlyVerifiedOfficialBillUniverse,false);
     const original=await readP8DurableDailyCapture(pool,'2027-01-10');
     assert.equal(original?.batch.rows.length,1);
     assert.equal(original?.chainSealSha256,jobs[0]!.chainSealSha256);
     assert.equal(original?.batch.contentSha256,a.batch.contentSha256);
     assert.equal(original?.firstRecordedAt,jobs[0]!.firstRecordedAt);
     const divergent=day('2027-01-10',[sf7],[hf42,sf7]);
     await assert.rejects(()=>appendP8DurableDailyCapture({
       pool:pool!,batch:divergent.batch,suppliedUniverse:divergent.manifest,
     }),/Immutable|conflicts|source bytes/);
     // The previous rejection must not poison another connection/replay.
     const b=day('2027-01-11',[hf42,sf7],[hf42,sf7]);
     const second=await appendP8DurableDailyCapture({
       pool,batch:b.batch,suppliedUniverse:b.manifest,
     });
     assert.equal(second.disposition,'created');
     const reloaded=await readP8DurableDailyCapture(pool,'2027-01-11');
     assert.equal(reloaded?.priorCutoffDateExclusive,'2027-01-10');
     assert.equal(reloaded?.priorChainSealSha256,original?.chainSealSha256);
     assert.equal(reloaded?.health.metrics.previouslyCapturedBillsDisappeared,0);
     assert.equal(reloaded?.health.metrics.missingSuppliedBills,0);
     assert.equal(reloaded?.health.metrics.deferredOrUnobservableProcessBillCount,1);
     assert.equal(reloaded?.health.status,'warning');
     const next=day('2027-01-13',[sf7],[hf42,sf7]);
     const third=await appendP8DurableDailyCapture({
       pool,batch:next.batch,suppliedUniverse:next.manifest,
     });
     assert.equal(third.health.metrics.skippedCalendarDays,1);
     assert.equal(third.health.metrics.previouslyCapturedBillsDisappeared,1);
     assert.equal(third.health.status,'critical');
     // A skipped date cannot be silently backfilled after a newer seal.
     const missed=day('2027-01-12',[hf42,sf7],[hf42,sf7]);
     await assert.rejects(()=>appendP8DurableDailyCapture({
       pool:pool!,batch:missed.batch,suppliedUniverse:missed.manifest,
     }),/Refusing retrospective/);
     const replay=await appendP8DurableDailyCapture({
       pool,batch:a.batch,suppliedUniverse:a.manifest,
     });
     assert.equal(replay.disposition,'already_present');
     assert.equal(replay.firstRecordedAt,original?.firstRecordedAt);
     const probe=await inspectP8DurableHeartbeat({
       pool,checkedAt:'2027-01-14T20:00:00.000Z',collectionExpected:true,
     });
     assert.equal(probe.lateDays,1);
     assert.equal(probe.alerts[0]?.code,'CAPTURE_HEARTBEAT_STALE');
     assert.equal((await inspectP8DurableHeartbeat({
       pool,checkedAt:'2027-01-14T20:00:00.000Z',collectionExpected:false,
     })).status,'disabled');
     for(const statement of [
       "UPDATE lifecycle_p8_daily_capture_ledger SET row_count=0 WHERE cutoff_date='2027-01-10'",
       "DELETE FROM lifecycle_p8_daily_capture_ledger WHERE cutoff_date='2027-01-10'",
       'TRUNCATE lifecycle_p8_daily_capture_ledger',
     ])await assert.rejects(()=>pool!.query(statement),/append-only/);
     const remaining=(await pool.query<{count:string}>(
       'SELECT count(*)::text AS count FROM lifecycle_p8_daily_capture_ledger')).rows[0];
     assert.equal(remaining?.count,'3');
   }finally{
     if(pool)await pool.end();
     await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
     await admin.end();
   }
});

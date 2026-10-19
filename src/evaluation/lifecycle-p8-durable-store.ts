/**
 * #310 durable outcome-blind P8 daily research ledger. Uses a dedicated
 * append-only PostgreSQL table (migration 0036), not app forecast tables.
 *
 * Caller supplies already source-lineaged, hash-sealed P8 batch and supplied
 * universe. This module neither collects real 2027 bills nor claims official
 * enumeration; it does not schedule production ingestion or calculate scores.
 */
import {createHash} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {P8DailyCaptureBatch} from './lifecycle-p8-daily-capture.js';
import {verifyOfflineP8BatchIntegrity} from './lifecycle-p8-offline-store.js';
import {
  type P8SuppliedUniverseIndex,verifyP8SuppliedUniverseIndex,
} from './lifecycle-p8-universe-coverage.js';
import {
  type P8CaptureHealth, type P8CaptureHeartbeat,
  auditP8DailyCaptureHealth,auditP8CaptureHeartbeat,
  formatP8CaptureActionAnnotations,
} from './lifecycle-p8-capture-health.js';

export const P8_DURABLE_LEDGER_SCHEMA='lifecycle-p8-durable-ledger-v1' as const;
const LEDGER='lifecycle_p8_daily_capture_ledger';
const MAX_CAPTURE_BYTES=80_000_000;
const MAX_HEALTH_BYTES=50_000;
const HEX=/^[a-f0-9]{64}$/;
function sha(value:unknown):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function safeParse<T>(value:string,label:string):T {
  if(value.length>MAX_CAPTURE_BYTES)throw Error('Unbounded P8 stored '+label);
  const parsed:unknown=JSON.parse(value);
  if(!parsed || typeof parsed!=='object'||Array.isArray(parsed))
    throw Error('Malformed P8 stored '+label);
  return parsed as T;
}
function assertBounds(value:string,max:number,label:string):void{
  if(Buffer.byteLength(value)>max)throw Error('Unbounded P8 '+label+' for durable storage');
}
export interface P8DurableStoredCapture {
  schemaVersion:typeof P8_DURABLE_LEDGER_SCHEMA;
  cutoffDateExclusive:string;
  firstRecordedAt:string;
  firstCallerCapturedAt:string;
  batchContentSha256:string;
  suppliedUniverseSha256:string;
  healthContentSha256:string;
  chainSealSha256:string;
  priorCutoffDateExclusive:string|null;
  priorChainSealSha256:string|null;
  batch:P8DailyCaptureBatch;
  suppliedUniverse:P8SuppliedUniverseIndex;
  health:P8CaptureHealth;
}
export interface P8DurableWriteResult {
  disposition:'created'|'already_present';
  cutoffDateExclusive:string;
  firstRecordedAt:string;
  firstCallerCapturedAt:string;
  rowCount:number;
  batchContentSha256:string;
  chainSealSha256:string;
  health:P8CaptureHealth;
}
interface StoredRow {
  cutoff_date:string;
  recorded_at:Date;
  original_captured_at:Date;
  batch_sha256:string;
  universe_sha256:string;
  health_sha256:string;
  seal_sha256:string;
  prior_cutoff_date:string|null;
  prior_seal_sha256:string|null;
  batch_source:string;
  batch_json:string;
  universe_json:string;
  health_json:string;
  row_count:number;
  missing_supplied_bills:number;
  health_status:string;
  independently_verified_official_universe:boolean;
  production_capture_activated:boolean;
  predictions_computed:boolean;
  outcome_data_read:boolean;
  serving_changed:boolean;
}
function deriveSeal(input:{
  cutoff:string;batchSha:string;universeSha:string;healthSha:string;priorSeal:string|null;
}):string {
  return sha([P8_DURABLE_LEDGER_SCHEMA,'2027-2028',
    input.cutoff,input.batchSha,input.universeSha,input.healthSha,input.priorSeal]);
}
function verifyStoredRow(row:StoredRow):P8DurableStoredCapture {
  const batch=safeParse<P8DailyCaptureBatch>(row.batch_json,'batch');
  const universe=safeParse<P8SuppliedUniverseIndex>(row.universe_json,'universe');
  const health=safeParse<P8CaptureHealth>(row.health_json,'health');
  verifyOfflineP8BatchIntegrity(batch);
  verifyP8SuppliedUniverseIndex(universe);
  const expected=auditP8DailyCaptureHealth({
    currentBatch:batch,currentManifest:universe,
    // Continuity metrics were sealed at initial write and cannot be rederived
    // without fetching previous historical snapshots too.
  });
  if(row.cutoff_date!==batch.cutoffDateExclusive||
    batch.cutoffDateExclusive!==universe.cutoffDateExclusive||
    row.batch_sha256!==batch.contentSha256||
    row.universe_sha256!==universe.contentSha256||
    row.batch_source!==batch.source||
    row.health_sha256!==sha(health)||
    health.schemaVersion!==expected.schemaVersion||
    health.session!==expected.session||
    health.cutoffDateExclusive!==expected.cutoffDateExclusive||
    health.currentManifestSha256!==expected.currentManifestSha256||
    health.currentCaptureSha256!==expected.currentCaptureSha256||
    health.independentlyVerifiedOfficialBillUniverse!==false||
    health.productionCollectionActive!==false||
    health.predictionAndOutcomeDataRead!==false||
    !Array.isArray(health.alerts) ||
    health.alerts.some(a=>!['notice','warning','critical'].includes(a.severity)||
      !/^[A-Z_]+$/.test(a.code)||!Number.isSafeInteger(a.count)||a.count<1)||
    row.health_status!==health.status||
    row.row_count!==batch.rows.length||
    row.missing_supplied_bills!==health.metrics.missingSuppliedBills||
    row.independently_verified_official_universe!==false||
    row.production_capture_activated!==false||
    row.predictions_computed!==false||
    row.outcome_data_read!==false||
    row.serving_changed!==false||
    row.original_captured_at.toISOString()!==new Date(batch.capturedAt).toISOString()||
    row.prior_cutoff_date!==health.previousCutoffDateExclusive||
    (row.prior_cutoff_date===null)!==(row.prior_seal_sha256===null)||
    (row.prior_seal_sha256!==null&&!HEX.test(row.prior_seal_sha256))||
    row.seal_sha256!==deriveSeal({
      cutoff:row.cutoff_date,batchSha:row.batch_sha256,
      universeSha:row.universe_sha256,healthSha:row.health_sha256,
      priorSeal:row.prior_seal_sha256,
    }))throw Error('Immutable stored P8 daily ledger receipt integrity mismatch');
  return {
    schemaVersion:P8_DURABLE_LEDGER_SCHEMA,cutoffDateExclusive:row.cutoff_date,
    firstRecordedAt:row.recorded_at.toISOString(),
    firstCallerCapturedAt:row.original_captured_at.toISOString(),
    batchContentSha256:row.batch_sha256,
    suppliedUniverseSha256:row.universe_sha256,
    healthContentSha256:row.health_sha256,
    chainSealSha256:row.seal_sha256,
    priorCutoffDateExclusive:row.prior_cutoff_date,
    priorChainSealSha256:row.prior_seal_sha256,
    batch,suppliedUniverse:universe,health,
  };
}
const columns='cutoff_date::text AS cutoff_date,recorded_at,original_captured_at,'+
 'batch_sha256,universe_sha256,health_sha256,seal_sha256,'+
 'prior_cutoff_date::text AS prior_cutoff_date,prior_seal_sha256,'+
 'batch_source,batch_json,universe_json,health_json,row_count,missing_supplied_bills,'+
 'health_status,independently_verified_official_universe,'+
 'production_capture_activated,predictions_computed,outcome_data_read,serving_changed';
async function findDay(client:PoolClient,cutoff:string):Promise<P8DurableStoredCapture|null>{
  const r=await client.query<StoredRow>(
    'SELECT '+columns+' FROM '+LEDGER+' WHERE session=$1 AND cutoff_date=$2::date',
    ['2027-2028',cutoff]);
  if(r.rows.length>1)throw Error('Multiple immutable P8 daily captures');
  return r.rows[0]?verifyStoredRow(r.rows[0]):null;
}
export async function readP8DurableDailyCapture(
  pool:Pool,cutoffDateExclusive:string,
):Promise<P8DurableStoredCapture|null>{
  if(!/^(2027|2028)-\d{2}-\d{2}$/.test(cutoffDateExclusive))
    throw Error('Invalid P8 daily lookup date');
  const client=await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const value=await findDay(client,cutoffDateExclusive);
    await client.query('ROLLBACK');
    return value;
  }catch(err){await client.query('ROLLBACK').catch(()=>undefined);throw err}
  finally{client.release()}
}
/** Fixed session-scoped xact lock serializes first writes across workers.
 * No late replay rewrites, gap backfills or conflicting same-day revisions.
 */
export async function appendP8DurableDailyCapture(input:{
  pool:Pool;batch:P8DailyCaptureBatch;suppliedUniverse:P8SuppliedUniverseIndex;
}):Promise<P8DurableWriteResult>{
  verifyOfflineP8BatchIntegrity(input.batch);
  verifyP8SuppliedUniverseIndex(input.suppliedUniverse);
  if(input.batch.cutoffDateExclusive!==input.suppliedUniverse.cutoffDateExclusive)
    throw Error('Cannot store a P8 batch with the wrong universe day');
  if(input.batch.source!=='offline_supplied_asof_fixtures' &&
    input.batch.source!=='offline_observed_revisor_receipts')
    throw Error('Invalid P8 source contract');
  const batchJson=JSON.stringify(input.batch);
  const universeJson=JSON.stringify(input.suppliedUniverse);
  assertBounds(batchJson,MAX_CAPTURE_BYTES,'capture');
  assertBounds(universeJson,MAX_CAPTURE_BYTES,'universe');
  const client=await input.pool.connect();
  try{
    await client.query('BEGIN');
    // Single fixed, process-independent advisory lock serializes 2027-28
    // first writes and prevents a future-day race/skip over missing dates.
    await client.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',[310,2027]);
    const existing=await findDay(client,input.batch.cutoffDateExclusive);
    if(existing){
      if(existing.batchContentSha256!==input.batch.contentSha256||
        existing.suppliedUniverseSha256!==input.suppliedUniverse.contentSha256)
        throw Error('Immutable P8 day conflicts with previously accepted source bytes');
      await client.query('COMMIT');
      return {
        disposition:'already_present',
        cutoffDateExclusive:existing.cutoffDateExclusive,
        firstRecordedAt:existing.firstRecordedAt,
        firstCallerCapturedAt:existing.firstCallerCapturedAt,
        rowCount:existing.batch.rows.length,
        batchContentSha256:existing.batchContentSha256,
        chainSealSha256:existing.chainSealSha256,health:existing.health,
      };
    }
    // The only test bypass is a uniquely named throwaway integration schema
    // on a localhost PostgreSQL runner. A real public-schema first write
    // cannot predate, postdate, or inject fixture-labelled future captures.
    const gate=await client.query<{schema_name:string;chicago_day:string}>(
      "SELECT current_schema() AS schema_name, "+
      "to_char(clock_timestamp() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') "+
      "AS chicago_day");
    const scope=gate.rows[0];
    if(!scope)throw Error('P8 database clock/schema unavailable');
    const isolatedLocalFixture=/^p8_proof_[0-9a-f]{16}$/.test(scope.schema_name) &&
      Boolean(process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL&&
      ['localhost','127.0.0.1'].includes(
        new URL(process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL).hostname));
    if(!isolatedLocalFixture &&
      (scope.schema_name!=='public' ||
       input.batch.source!=='offline_observed_revisor_receipts' ||
       input.batch.cutoffDateExclusive!==scope.chicago_day))
      throw Error('Real P8 capture requires source receipts and today Chicago database cutoff');
    const last=await client.query<StoredRow>(
      'SELECT '+columns+' FROM '+LEDGER+' WHERE session=$1 ORDER BY cutoff_date DESC LIMIT 1',
      ['2027-2028']);
    const previous=last.rows[0]?verifyStoredRow(last.rows[0]):null;
    if(previous && previous.cutoffDateExclusive>=input.batch.cutoffDateExclusive)
      throw Error('Refusing retrospective P8 day creation after a newer immutable capture');
    const health=auditP8DailyCaptureHealth({
      currentBatch:input.batch,currentManifest:input.suppliedUniverse,
      ...(previous?{previousBatch:previous.batch,
        previousManifest:previous.suppliedUniverse}:{})
    });
    const healthJson=JSON.stringify(health);
    assertBounds(healthJson,MAX_HEALTH_BYTES,'health');
    const healthSha=sha(health);
    const sealSha=deriveSeal({
      cutoff:input.batch.cutoffDateExclusive,
      batchSha:input.batch.contentSha256,
      universeSha:input.suppliedUniverse.contentSha256,
      healthSha,priorSeal:previous?.chainSealSha256??null,
    });
    const saved=await client.query<{recorded_at:Date}>(
      'INSERT INTO '+LEDGER+'(session,cutoff_date,original_captured_at,'+
      'batch_sha256,universe_sha256,health_sha256,seal_sha256,'+
      'prior_cutoff_date,prior_seal_sha256,batch_source,batch_json,'+
      'universe_json,health_json,row_count,missing_supplied_bills,health_status) '+
      'VALUES($1,$2::date,$3::timestamptz,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14,$15,$16) '+
      'RETURNING recorded_at',
      [
        '2027-2028',input.batch.cutoffDateExclusive,input.batch.capturedAt,
        input.batch.contentSha256,input.suppliedUniverse.contentSha256,
        healthSha,sealSha,previous?.cutoffDateExclusive??null,
        previous?.chainSealSha256??null,input.batch.source,
        batchJson,universeJson,healthJson,input.batch.rows.length,
        health.metrics.missingSuppliedBills,health.status,
      ]);
    const firstRecordedAt=saved.rows[0]?.recorded_at;
    if(!(firstRecordedAt instanceof Date)||!Number.isFinite(firstRecordedAt.getTime()))
      throw Error('Database did not return a verified first acceptance clock');
    await client.query('COMMIT');
    return {
      disposition:'created',cutoffDateExclusive:input.batch.cutoffDateExclusive,
      firstRecordedAt:firstRecordedAt.toISOString(),
      firstCallerCapturedAt:new Date(input.batch.capturedAt).toISOString(),
      rowCount:input.batch.rows.length,
      batchContentSha256:input.batch.contentSha256,
      chainSealSha256:sealSha,health,
    };
  }catch(err){
    await client.query('ROLLBACK').catch(()=>undefined);
    throw err;
  }finally{client.release()}
}
/** Read-only current health, meant for an explicitly invoked operator job. */
export async function inspectP8DurableHeartbeat(input:{
  pool:Pool;checkedAt:string;collectionExpected:boolean;
}):Promise<P8CaptureHeartbeat>{
  const client=await input.pool.connect();
  try{
    await client.query('BEGIN READ ONLY');
    const latest=await client.query<{cutoff_date:string}>(
      'SELECT cutoff_date::text AS cutoff_date FROM '+LEDGER+
      ' WHERE session=$1 ORDER BY cutoff_date DESC LIMIT 1',['2027-2028']);
    const heartbeat=auditP8CaptureHeartbeat({
      checkedAt:input.checkedAt,
      latestStoredCutoff:latest.rows[0]?.cutoff_date??null,
      collectionExpected:input.collectionExpected,
    });
    await client.query('ROLLBACK');
    return heartbeat;
  }catch(err){await client.query('ROLLBACK').catch(()=>undefined);throw err}
  finally{client.release()}
}
/** GitHub Action compatible notices. Requires an actual caller/job, no cron. */
export function printP8CaptureHealthSummary(result:P8DurableWriteResult):void{
  const report={disposition:result.disposition,cutoff:result.cutoffDateExclusive,
    firstAcceptedAt:result.firstRecordedAt,rows:result.rowCount,
    digest:result.chainSealSha256,healthStatus:result.health.status,
    missingSuppliedBills:result.health.metrics.missingSuppliedBills,
    alerts:result.health.alerts.map(a=>({code:a.code,severity:a.severity,count:a.count})),
    officialUniverseVerified:false,productionCollectionActive:false,
    outcomesRead:false,predictionsComputed:false};
  process.stdout.write('P8_DURABLE_CAPTURE_HEALTH='+JSON.stringify(report)+'\n');
  for(const line of formatP8CaptureActionAnnotations(result.health.alerts))
    process.stdout.write(line+'\n');
}

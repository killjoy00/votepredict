import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {pool as appPool} from '../src/lib/db/index.js';
import {listSafeOutcomeCandidates,resolveSafeForecastOutcome} from '../src/operations/safe-resolution.js';
import {CLAIM_DUE_SCHEDULES_SQL} from '../src/operations/scheduled-forecasts.js';
const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
test('concurrent workers cannot double-claim an overdue forecast; resolved and running forecasts are excluded',{skip:!url},async t=>{
 if(!['localhost','127.0.0.1'].includes(new URL(url!).hostname))throw new Error('Integration fixtures require local disposable PostgreSQL');
 const db=new Pool({connectionString:url,max:2});const a=await db.connect();const b=await db.connect();
 const schema=`scheduler_test_${process.pid}`;
 try{
  await a.query(`CREATE SCHEMA ${schema}`);for(const c of [a,b])await c.query(`SET search_path TO ${schema}`);
  await a.query(`CREATE TABLE forecasts(id text PRIMARY KEY,owner_user_id text,archived_at timestamptz,bill_id text DEFAULT 'bill',target_chamber_id text DEFAULT 'house',target_type text DEFAULT 'bill',target_kind text DEFAULT 'house_floor_passage',created_at timestamptz DEFAULT '2026-01-01');
   CREATE TABLE forecast_schedules(forecast_id text PRIMARY KEY,enabled boolean,next_run_at timestamptz,cadence_hours int,research_mode text,updated_at timestamptz);
   CREATE TABLE forecast_resolutions(forecast_id text UNIQUE,vote_event_id text,metadata jsonb DEFAULT '{}',resolved_at timestamptz);
   CREATE TABLE chambers(id text,slug text);
   INSERT INTO chambers VALUES('house','house');
   CREATE TABLE vote_events(id text,bill_id text,chamber_id text,is_passage boolean,passed boolean,occurred_on date,yea_count int,nay_count int,motion_text text,external_key text);
   INSERT INTO vote_events VALUES('vote','bill','house',true,true,'2026-02-01',70,64,'Passage','official'),('unknown','bill','house',true,null,'2026-02-02',70,64,'Passage','official');
   CREATE TABLE forecast_snapshot_runs(id uuid DEFAULT gen_random_uuid(),forecast_id text,scheduled_for timestamptz,status text,UNIQUE(forecast_id,scheduled_for));
   INSERT INTO forecasts(id,owner_user_id,archived_at) VALUES('due','owner',null),('resolved','owner',null),('running','owner',null);
   INSERT INTO forecast_schedules SELECT id,true,now()-interval '10 days',24,'quick',now() FROM forecasts;
   INSERT INTO forecast_resolutions(forecast_id) VALUES('resolved');
   INSERT INTO forecast_snapshot_runs(forecast_id,scheduled_for,status) VALUES('running',now()-interval '1 day','running');`);
  await a.query('BEGIN');const first=await a.query(CLAIM_DUE_SCHEDULES_SQL,[1,null]);assert.equal(first.rows.length,1);assert.equal(first.rows[0].forecast_id,'due');
  const overlapping=await b.query(CLAIM_DUE_SCHEDULES_SQL,[1,null]);assert.equal(overlapping.rows.length,0);
  await a.query('COMMIT');assert.equal((await b.query(CLAIM_DUE_SCHEDULES_SQL,[1,null])).rows.length,0);
  assert.equal((await a.query("SELECT next_run_at>now() as advanced FROM forecast_schedules WHERE forecast_id='due'")).rows[0].advanced,true);
  assert.equal((await a.query("SELECT count(*)::int as count FROM forecast_snapshot_runs WHERE forecast_id='due'")).rows[0].count,1);
  t.mock.method(appPool,'query',a.query.bind(a));
  assert.equal((await listSafeOutcomeCandidates('due','owner')).length,1);
  await assert.rejects(resolveSafeForecastOutcome({forecastId:'due',ownerUserId:'owner',voteEventId:'unknown'}));
  await a.query("UPDATE forecasts SET target_kind='enactment' WHERE id='due'");
  assert.equal((await listSafeOutcomeCandidates('due','owner')).length,0);
  await assert.rejects(resolveSafeForecastOutcome({forecastId:'due',ownerUserId:'owner',voteEventId:'vote'}));
  await a.query("UPDATE forecasts SET target_kind='house_floor_passage' WHERE id='due'");
  await resolveSafeForecastOutcome({forecastId:'due',ownerUserId:'owner',voteEventId:'vote'});
  assert.equal((await a.query("SELECT enabled FROM forecast_schedules WHERE forecast_id='due'")).rows[0].enabled,false);
  assert.equal((await a.query("SELECT vote_event_id FROM forecast_resolutions WHERE forecast_id='due'")).rows[0].vote_event_id,'vote');

 }finally{await a.query('ROLLBACK');await a.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);a.release();b.release();await db.end();}
});

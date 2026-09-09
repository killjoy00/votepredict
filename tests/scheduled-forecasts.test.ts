import test from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../src/lib/db/index.js';
import {runScheduledForecasts} from '../src/operations/scheduled-forecasts.js';

test('scheduler resolves known outcomes without generating a post-outcome forecast',async t=>{
 const writes:string[]=[];
 t.mock.method(pool,'query',async (sql:string)=>{writes.push(sql);if(sql.includes('WITH due'))return {rows:[{forecast_id:'f',owner_user_id:'o',research_mode:'quick',scheduled_for:'2026-01-01',run_id:'r'}]};if(sql.startsWith('SELECT id'))return {rows:[{id:'resolution'}]};return {rows:[]};});
 let resolved=false;
 const result=await runScheduledForecasts(1,{
  updateForecast:async()=>{throw new Error('Must not generate a forecast after a known outcome');},
  listSafeOutcomeCandidates:async()=>[{id:'v',occurredOn:'2026-02-01',yeaCount:70,nayCount:64,passed:true,motionText:'Passage',externalKey:'official'}],
  resolveSafeForecastOutcome:async()=>{resolved=true;},
 });
 assert.equal(resolved,true);assert.deepEqual(result,{claimed:1,completed:1,failed:0,resolved:1});
 assert.ok(writes.some(s=>s.includes("enabled=CASE WHEN")));
});
test('invalid batch sizes cannot claim schedules',async t=>{
 const query=t.mock.method(pool,'query',async()=>{throw new Error('Unexpected database call');});
 for(const limit of [0,-1,NaN,Infinity,1.5,101]) await assert.rejects(runScheduledForecasts(limit),/batch size/);
 assert.equal(query.mock.callCount(),0);
});
test('failed forecast work is recorded and counted',async t=>{
 const writes:string[]=[];
 t.mock.method(pool,'query',async(sql:string)=>{writes.push(sql);return {rows:sql.includes('WITH due')?[{forecast_id:'f',owner_user_id:'o',research_mode:'quick',run_id:'r'}]:[]};});
 const result=await runScheduledForecasts(1,{listSafeOutcomeCandidates:async()=>[],resolveSafeForecastOutcome:async()=>{},updateForecast:async()=>{throw new Error('Source unavailable');}});
 assert.equal(result.failed,1);assert.ok(writes.some(s=>s.includes("status='failed'")));
});

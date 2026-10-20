import test from 'node:test';
import assert from 'node:assert/strict';
import type {Pool,PoolClient} from 'pg';
import {appendHf100OriginalPrattProof,identifyPrattSourceAction,
 readCommittedHf100PrattShadow} from '../src/operations/senate-hf100-original-shadow.js';

test('no source receipt never authorizes an HF100 supplemental write',async()=>{
 const statements:string[]=[];
 let released=false;
 const db={
  query:async(sql:string)=>{
   statements.push(sql);
   return {rows:[]};
  },
  release:()=>{released=true;}
 } as unknown as PoolClient;
 const pool={connect:async()=>db} as unknown as Pool;
 await assert.rejects(()=>appendHf100OriginalPrattProof(pool),
  /original PDF provenance or source identity/);
 assert.match(statements[0]??'',/^BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE$/);
 assert.ok(statements.some(s=>s==='ROLLBACK'));
 assert.ok(!statements.some(s=>/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(s)));
 assert.equal(released,true);
});

test('read-only committed shadow verification fails if a link or current view is contaminated',async()=>{
 for(const bad of [
  {shadowRows:0,namedBallots:0,acceptedLinks:0,currentRows:0},
  {shadowRows:2,namedBallots:2,acceptedLinks:0,currentRows:0},
  {shadowRows:1,namedBallots:1,acceptedLinks:1,currentRows:0},
  {shadowRows:1,namedBallots:1,acceptedLinks:0,currentRows:1},
  {shadowRows:1,namedBallots:0,acceptedLinks:0,currentRows:0},
 ]){
  const db={query:async()=>({rows:[bad]})} as unknown as PoolClient;
  await assert.rejects(()=>readCommittedHf100PrattShadow(db),
   /failed independent read-only verification/);
 }
});

test('source-only Pratt identity rejects synthetic/missing original journal material',()=>{
 assert.throws(()=>identifyPrattSourceAction('The roll was called, and there were yeas 33 and nays 34.',
  ['Abeler','Boldon']),/outside verified bounds/);
 assert.throws(()=>identifyPrattSourceAction('irrelevant '.repeat(250),Array.from({length:75},(_,i)=>'Name '+i)),
  /full original source order or ballots diverged/);
});

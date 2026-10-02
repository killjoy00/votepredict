import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeLinearBatch, planLinearBatch } from '../src/evidence/linear-batch-cursor.js';

test('linear batch cursor finishes a non-divisible committee corpus at a terminal cursor',()=>{
  assert.deepEqual(planLinearBatch({total:1452,priorOffset:1440,batchSize:30}),{
    offset:1440,end:1452,batchLength:12,nextOffset:1452,completesPass:true,
  });
});

test('linear batch cursor finishes a non-divisible issue-position corpus at a terminal cursor',()=>{
  assert.deepEqual(planLinearBatch({total:274,priorOffset:264,batchSize:12}),{
    offset:264,end:274,batchLength:10,nextOffset:274,completesPass:true,
  });
});

test('linear batch cursor keeps an already-complete pass terminal',()=>{
  assert.deepEqual(planLinearBatch({total:1452,priorOffset:1452,batchSize:30}),{
    offset:1452,end:1452,batchLength:0,nextOffset:1452,completesPass:true,
  });
});

test('linear batch cursor advances full batches normally',()=>{
  assert.deepEqual(planLinearBatch({total:1452,priorOffset:30,batchSize:30}),{
    offset:30,end:60,batchLength:30,nextOffset:60,completesPass:false,
  });
});

test('linear batch cursor resets offsets beyond the current corpus to zero',()=>{
  assert.deepEqual(planLinearBatch({total:100,priorOffset:101,batchSize:30}),{
    offset:0,end:30,batchLength:30,nextOffset:30,completesPass:false,
  });
});

test('linear batch progress retains the current cursor when retry is required',()=>{
  const plan=planLinearBatch({total:274,priorOffset:96,batchSize:12});
  assert.deepEqual(finalizeLinearBatch(plan,true),{
    nextOffset:96,complete:false,
  });
});

test('snapshot-level rejects can finish a successfully discovered final batch',()=>{
  const plan=planLinearBatch({total:274,priorOffset:264,batchSize:12});
  assert.deepEqual(finalizeLinearBatch(plan,false),{
    nextOffset:274,complete:true,
  });
});

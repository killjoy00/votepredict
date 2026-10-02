import test from 'node:test';
import assert from 'node:assert/strict';
import { planLinearBatch } from '../src/evidence/linear-batch-cursor.js';

test('linear batch cursor finishes a non-divisible committee corpus without wraparound',()=>{
  assert.deepEqual(planLinearBatch({total:1452,priorOffset:1440,batchSize:30}),{
    offset:1440,end:1452,batchLength:12,nextOffset:0,completesPass:true,
  });
});

test('linear batch cursor finishes a non-divisible issue-position corpus without wraparound',()=>{
  assert.deepEqual(planLinearBatch({total:274,priorOffset:264,batchSize:12}),{
    offset:264,end:274,batchLength:10,nextOffset:0,completesPass:true,
  });
});

test('linear batch cursor advances full batches normally',()=>{
  assert.deepEqual(planLinearBatch({total:1452,priorOffset:30,batchSize:30}),{
    offset:30,end:60,batchLength:30,nextOffset:60,completesPass:false,
  });
});

test('linear batch cursor resets invalid stale offsets to zero',()=>{
  assert.deepEqual(planLinearBatch({total:100,priorOffset:100,batchSize:30}),{
    offset:0,end:30,batchLength:30,nextOffset:30,completesPass:false,
  });
});

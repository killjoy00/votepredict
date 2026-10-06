import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dir=resolve('data/evaluation/evidence-quality/historical-density-2025-house-semantic-decisions-v1');
const manifest=JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));
const decisions=manifest.parts.flatMap((name:string)=>JSON.parse(readFileSync(resolve(dir,name),'utf8')).decisions);
test('2025 House semantic gate covers exactly 50 frozen rows',()=>{
  assert.equal(manifest.schemaVersion,'historical-density-2025-house-semantic-decisions-v1');
  assert.equal(manifest.batchId,'EQV1-HISTORICAL-DENSITY-2025-HOUSE-001');
  assert.deepEqual(decisions.map((x:any)=>x.row),Array.from({length:50},(_,i)=>i+1));
});
test('2025 House semantic gate keeps conservative accounting',()=>{
  const directional=decisions.filter((x:any)=>x.decision==='directional');
  const non=decisions.filter((x:any)=>x.decision==='non_directional');
  assert.equal(directional.length,46);assert.equal(non.length,4);assert.equal(new Set(directional.map((x:any)=>x.semanticKey)).size,46);
  assert.deepEqual(non.map((x:any)=>x.row),[16,28,29,31]);assert.equal(directional.some((x:any)=>(x.crossBatchDuplicateOf?.length??0)>0),false);
});
test('2025 House semantic gate stays outcome-blind, bill-free, and identity-conservative',()=>{
  assert.deepEqual(manifest.policy.candidateBillIdentifiers,[]);assert.equal(manifest.policy.outcomeUse,'none');
  assert.equal(manifest.policy.billInference,false);assert.equal(manifest.policy.targetBillApplicabilityInferred,false);
  assert.equal(manifest.policy.internalMembershipIdentityResolved,false);assert.equal(manifest.policy.vercelUsed,false);
});

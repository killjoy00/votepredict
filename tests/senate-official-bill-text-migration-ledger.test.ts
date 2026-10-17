import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  OFFICIAL_TEXT_MIGRATION,validateBillTextMigrationLedger,
} from '../src/operations/senate-official-bill-text-migration-ledger.js';

const reviewed=Array.from({length:32},(_,index)=>({
  filename:index===26?OFFICIAL_TEXT_MIGRATION:
    String(index+1).padStart(4,'0')+'_independent_migration.sql',
  checksum:'sha256_'+String(index+1).padStart(4,'0'),
}));

test('already deployed 0027 permits unrelated later migrations still awaiting deployment',()=>{
  assert.equal(validateBillTextMigrationLedger(reviewed.slice(0,30),reviewed),true);
  assert.equal(validateBillTextMigrationLedger(reviewed.slice(0,27),reviewed),true);
  assert.equal(validateBillTextMigrationLedger(reviewed,reviewed),true);
});

test('unapplied own 0027 remains a single permitted missing migration and needs all 0026 prerequisites',()=>{
  assert.equal(validateBillTextMigrationLedger(reviewed.slice(0,26),reviewed),false);
  const newerWithoutOwn=reviewed.filter((row,i)=>i!==26);
  assert.equal(validateBillTextMigrationLedger(newerWithoutOwn,reviewed),false);
});

test('reject missing or checksum-mismatched pre-0027 dependencies',()=>{
  assert.throws(()=>validateBillTextMigrationLedger(reviewed.filter((row,i)=>i!==25),reviewed),
    /prerequisite_missing/);
  const damaged=reviewed.slice(0,30).map((row,i)=>i===20?{...row,checksum:'tampered'}:row);
  assert.throws(()=>validateBillTextMigrationLedger(damaged,reviewed),
    /prerequisite_missing/);
});

test('reject unknown, nonconsecutive, edited or out-of-order newer applied migrations',()=>{
  const skipped0031=reviewed.filter((row,i)=>i!==30);
  assert.throws(()=>validateBillTextMigrationLedger(skipped0031,reviewed),
    /out_of_order/);
  assert.throws(()=>validateBillTextMigrationLedger(
    [...reviewed.slice(0,30),{...reviewed[30],checksum:'tampered'}],reviewed),
    /out_of_order/);
  assert.throws(()=>validateBillTextMigrationLedger(
    [...reviewed,{filename:'0033_unknown.sql',checksum:'unknown'}],reviewed),
    /out_of_order/);
  assert.throws(()=>validateBillTextMigrationLedger(
    [...reviewed,reviewed[31]],reviewed),
    /unsorted_or_duplicate/);
});

test('reject changes to official 0027 migration fingerprint and own filename position',()=>{
  const damaged=reviewed.slice(0,30).map((row,i)=>i===26?{...row,checksum:'wrong'}:row);
  assert.throws(()=>validateBillTextMigrationLedger(damaged,reviewed),
    /prerequisite_missing/);
  const moved=reviewed.map((row,i)=>i===26?{...row,filename:'0027_other.sql'}:row);
  assert.throws(()=>validateBillTextMigrationLedger(reviewed.slice(0,30),moved),
    /inventory_moved/);
});

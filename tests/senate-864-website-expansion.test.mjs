import test from 'node:test';
import assert from 'node:assert/strict';
import {expansionInputs,verifyAddedLiterals} from '../src/evidence/senate-864-website-expansion.mjs';
import {prepareWebsiteCohort} from '../src/evidence/senate-864-website-cohort-v2.mjs';
const hash='a'.repeat(64),features=Array.from({length:668},(_,i)=>({legislatorId:'person',literal:'earlier literal',observedAt:'2020-01-01T00:00:00.000Z',sourceSha:hash,key:String(i)}));
const row=(bill,day='2021-01-05')=>({bill,membership:'member',person:'person',event:'event-'+bill,day,party:'DFL',service:true,cutoff:day+'T06:00:00Z',hashes:[hash]});
test('fixed source expansion preserves every v1 row and adds exactly 52 from three known people',()=>{
 const p=expansionInputs();assert.equal(p.added.length,52);assert.equal(p.current.ready.length,668);assert.equal(p.current.holdCounts.unresolved_official_person,undefined);
});
test('visible excerpt containment ignores markup/entities but rejects absent words and hidden script',()=>{
 const b=Buffer.from('<p>Tax &amp; <b>health</b> care.</p><script>hidden text</script>');
 assert.equal(verifyAddedLiterals(b,[{literal:'Tax & health care.'}]),true);
 assert.equal(verifyAddedLiterals(b,[{literal:'hidden text'}]),false);
 assert.equal(verifyAddedLiterals(b,[{literal:'Tax & better health care.'}]),false);
});
test('strict cutoff, service proof, duplicate literal collapse and deterministic cap',()=>{
 const p=prepareWebsiteCohort([row('b')],features);assert.equal(p.summary.included,1);assert.equal(p.privateTexts.size,1);assert.equal([...p.privateTexts.values()][0],'earlier literal');
 const same=features.map(p=>({...p,observedAt:'2021-01-05T06:00:00.000Z'}));
 assert.equal(prepareWebsiteCohort([row('b')],same).summary.exclusions.noPriorText,1);
 assert.equal(prepareWebsiteCohort([{...row('b'),service:false}],features).summary.exclusions.unknownService,1);
 assert.throws(()=>prepareWebsiteCohort([row('b'),row('b')],features),/Repeated/);
});
test('missing bill hashes and identical versions across chronological partitions hold',()=>{
 const p=prepareWebsiteCohort([row('a'),row('b','2024-01-05'),{...row('c'),hashes:[]}],features);
 assert.equal(p.summary.included,0);assert.equal(p.summary.exclusions.crossPartitionBillHash,2);assert.equal(p.summary.exclusions.missingBillHashes,1);
 assert.equal(p.summary.crossPartitionHashes,1);
});

test('actual PostgreSQL cohort contract runs read-only and explicitly rolls back',{skip:!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL},async()=>{
 const {Pool}=await import('pg');const {COHORT_TARGETS_V2_SQL}=await import('../src/evidence/senate-864-website-cohort-v2.mjs');
 const pool=new Pool({connectionString:process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,max:1}),c=await pool.connect();
 try{await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');try{
  const r=await c.query(COHORT_TARGETS_V2_SQL);assert.ok(r.rows.length<200001);
  const state=(await c.query("SELECT current_setting('transaction_read_only') AS ro")).rows[0];assert.equal(state.ro,'on');
 }finally{await c.query('ROLLBACK')}}finally{c.release();await pool.end()}
});

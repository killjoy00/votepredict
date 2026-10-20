import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool,type PoolClient} from 'pg';
import {HF100_TEXT_CHAIN_READINESS_SQL,summarizeHf100TextChain,readHf100TextChainReadiness,
 type Hf100ChainEvidenceRow} from '../src/operations/senate-hf100-text-chain-readiness.js';

function fixture():Hf100ChainEvidenceRow[]{
 const entries:Array<[number,string,string]>=[
  [2,'amendment','adopted'],[3,'amendment','adopted'],
  [4,'amendment','rejected'],[5,'procedural','unknown'],
  [6,'amendment','adopted'],[7,'amendment','adopted'],
  [8,'procedural','unknown'],[9,'passage','unknown']
 ];
 return entries.map(([sequence,kind,outcome])=>({
  sequence,actionKey:'printed-source-action-'+sequence,kind,outcome,
  proposedText:kind==='amendment'?'Page 1, line 4, delete "old" and insert "new".':null,
  explicitBaseLocator:kind==='amendment'?'versions/ue/1/':null,
  priorAdoptedKeys:sequence===9?['printed-source-action-2','printed-source-action-3',
   'printed-source-action-6','printed-source-action-7']:[],
  originalSourceVerified:true,
  captureVerified:kind==='amendment'&&sequence!==7,
  baseComponents:kind==='amendment'&&sequence!==4?1:0
 }));
}

test('HF100 original at-vote source chain is verifiable but never an assembled or publication-proven text',()=>{
 const report=summarizeHf100TextChain(fixture());
 assert.equal(report.originalPaperActions,8);
 assert.equal(report.proposedAmendments,5);
 assert.equal(report.adoptedAmendments,4);
 assert.equal(report.rejectedAmendments,1);
 assert.equal(report.verifiedLiteralProposalCaptures,4);
 assert.equal(report.proposalsWithOneUnambiguousBaseCapture,4);
 assert.equal(report.proposalsWithoutVerifiedCapture,1);
 assert.equal(report.proposalsWithoutUnambiguousBase,1);
 assert.equal(report.proposalsWithAmbiguousBase,0);
 assert.equal(report.passageCarriesFourSourceAdoptions,true);
 assert.equal(report.rejectedAmendmentExcludedFromPassage,true);
 assert.equal(report.completeAssembledBillText,false);
 assert.equal(report.preVotePublicationProven,false);
 assert.equal(report.addedEventLinks,0);
 assert.ok(!('actionKey' in report),'Source action identifiers never leave bounded audit');
});

test('rejected proposal, reordered adoption and duplicate action key all fail passage proof',()=>{
 const included=fixture();
 included[7]!.priorAdoptedKeys[2]='printed-source-action-4';
 assert.throws(()=>summarizeHf100TextChain(included),/rejected or out-of-order/);
 const reordered=fixture();
 reordered[7]!.priorAdoptedKeys.reverse();
 assert.throws(()=>summarizeHf100TextChain(reordered),/rejected or out-of-order/);
 const duplicate=fixture();
 duplicate[5]!.actionKey=duplicate[4]!.actionKey;
 assert.throws(()=>summarizeHf100TextChain(duplicate),/rejected or out-of-order/);
});

test('unverified original, missing base locator or ambiguous base text stay held',()=>{
 const unverified=fixture();unverified[0]!.originalSourceVerified=false;
 assert.throws(()=>summarizeHf100TextChain(unverified),/provenance changed/);
 const otherVersion=fixture();otherVersion[1]!.explicitBaseLocator='versions/ue/2/';
 assert.throws(()=>summarizeHf100TextChain(otherVersion),/contract drift/);
 const repeatedBase=fixture();repeatedBase[1]!.baseComponents=2;
 // Sequence 3 had one distinct base component; making it ambiguous must
 // increase the number of proposals without a uniquely authenticated base.
 const held=summarizeHf100TextChain(repeatedBase);
 assert.equal(held.proposalsWithAmbiguousBase,1);
 assert.equal(held.proposalsWithoutUnambiguousBase,2);
 const missing=fixture().slice(0,7);
 assert.throws(()=>summarizeHf100TextChain(missing),/count, sequence or provenance/);
});

test('empty production source chain fails in a protected read-only audit without writes',async()=>{
 const statements:string[]=[];
 const db={query:async(sql:string)=>{statements.push(sql);return {rows:[]};}} as unknown as PoolClient;
 await assert.rejects(()=>readHf100TextChainReadiness(db),/chain count/);
 assert.equal(statements.length,1);
 assert.match(statements[0]??'',/^SELECT /);
 assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/i.test(statements[0]??''));
});


test('isolated Postgres validates bounded HF100 chain read-only SQL against migrated schema',
 {skip:!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,timeout:30000},async()=>{
 const pool=new Pool({connectionString:process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,max:1});
 const db=await pool.connect();
 try{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const plan=await db.query('EXPLAIN '+HF100_TEXT_CHAIN_READINESS_SQL,[
   'https://www.senate.mn/journals/2023-2024/20230428059.pdf'
  ]);
  assert.ok(plan.rows.length>0&&plan.rows.some((r:{'QUERY PLAN'?:string})=>typeof r['QUERY PLAN']==='string'),
   'PostgreSQL EXPLAIN must return an actual parsed query plan');
 }finally{
  await db.query('ROLLBACK');
  db.release();
  await pool.end();
 }
});

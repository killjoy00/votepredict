import test from 'node:test';
import assert from 'node:assert/strict';
import type {Pool,PoolClient} from 'pg';
import {hash,ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {bindOrphanSourceProofs,attachStrictPrintedBill,
 repairOrphanJournalOriginalQuestions,officialOrphanJournalPopulationCertified}
 from '../src/operations/senate-orphan-journal-exact-repair.js';
import type {OrphanProof,OrphanVote} from '../src/operations/senate-orphan-journal-original-audit.js';
import type {OriginalJournal} from '../src/operations/senate-no-tally-original-census.js';
const url='https://www.senate.mn/journals/2023-2024/20230426062.pdf';
const q1='The question was taken on adoption of the first amendment to H.F. No. 3.';
const q2='The question was taken on adoption of the second amendment to S.F. No. 5.';
const sourceId='aaaaaaab-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const billId='cccccccd-cccc-4ccc-8ccc-cccccccccccc';
const otherBillId='eeeeeeef-eeee-4eee-8eee-eeeeeeeeeeee';
const names=[{name:'Abeler',choice:'yea'},{name:'Boldon',choice:'nay'}];
const inverted=[{name:'Abeler',choice:'nay'},{name:'Boldon',choice:'yea'}];
function roll(bill:string,q:string,yea:string,nay:string){
 return [bill+': a bill for an act relating to official voting.',q,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:',yea,
  'Those who voted in the negative were:',nay,
  'So the amendment was adopted.'].join('\n');
}
const body=['The roll was called, and the following Senators were present:',
 'Abeler','Boldon',...Array.from({length:58},(_,i)=>
  'Example'+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26)),
 'The President declared a quorum present.','GENERAL ORDERS',
 roll('H.F. No. 3',q1,'Abeler','Boldon'),
 roll('S.F. No. 5',q2,'Boldon','Abeler'),
 'Original journal proceedings. '.repeat(80)].join('\n');
const original:OriginalJournal={id:sourceId,source_url:url,
 source_type:'mn_senate_journal',original_verified:true,body};
const vote:OrphanVote={
 id:'bbbbbbbc-bbbb-4bbb-8bbb-bbbbbbbbbbbb',source_id:sourceId,source_url:url,
 bill_id:billId,bill:'HF3',session:'2023-2024',day:'2023-04-26',
 vote_kind:'amendment',motion_text:q1,yea_count:1,nay_count:1,
 votes:names,exact_linked:false,stored_link:false
};
const unresolved:OrphanVote={...vote,
 id:'ddddddde-dddd-4ddd-8ddd-dddddddddddd',
 bill_id:null,bill:null,motion_text:q2,votes:inverted
};
function proof(v:OrphanVote,q:string,bill:string,resolved:string,
 resolution:OrphanProof['resolution']):OrphanProof{
 const questionStart=body.indexOf(q);
 const rollStart=body.indexOf('The roll was called, and there were yeas',questionStart);
 return {vote:v,source:original,resolvedBillId:resolved,printedBill:bill,
  printedQuestion:q,questionStart,rollStart,
  rollOrdinal:q===q1?1:2,
  ballot:ballotSignature(v.votes,v.yea_count,v.nay_count)!,
  originalTextSha:hash(body),resolution};
}
test('known paperless bill and unresolved source-explicit bill independently bind original roll/header and exact complete ballot',()=>{
 const results=bindOrphanSourceProofs([
  proof(vote,q1,'HF3',billId,'existing_bill'),
  proof(unresolved,q2,'SF5',otherBillId,'printed_bill')
 ]);
 assert.equal(results.length,2);
 assert.equal(results[0]!.link.bill,'HF3');
 assert.equal(results[1]!.link.bill,'SF5');
 assert.equal(results[1]!.link.billId,otherBillId);
 assert.equal(results[1]!.link.acceptedId,unresolved.id);
 assert.equal(results[1]!.link.ballot,ballotSignature(inverted,1,1));
 assert.notEqual(results[0]!.link.actionKey,results[1]!.link.actionKey);
});
test('a bill ID borrowed from a prior heading cannot supply missing bill association',()=>{
 const unsafe=proof({...unresolved,motion_text:'The question was taken on the motion.'},
  'The question was taken on the motion.','SF5',otherBillId,'printed_bill');
 assert.throws(()=>bindOrphanSourceProofs([unsafe]),/INSIDE same printed question/);
});
test('a known bill mismatch cannot silently rewrite a previously associated accepted event',()=>{
 const p=proof(vote,q1,'HF3',otherBillId,'existing_bill');
 assert.throws(()=>bindOrphanSourceProofs([p]),/contradicted retained bill/);
});
test('different original source body or forged printed question offsets invalidate source link',()=>{
 const p=proof(vote,q1,'HF3',billId,'existing_bill');
 assert.throws(()=>bindOrphanSourceProofs([{...p,originalTextSha:'0'.repeat(64)}]),/source question/);
 assert.throws(()=>bindOrphanSourceProofs([{...p,questionStart:p.questionStart+1}]),/source question/);
});
test('certified 99-link writer never treats a mocked pool as a production transaction',async()=>{
 let connected=false;
 const pool={connect:async()=>{connected=true;throw Error('MOCK_NEON_REFUSED')}} as unknown as Pool;
 await assert.rejects(repairOrphanJournalOriginalQuestions(pool),/MOCK_NEON_REFUSED/);
 assert.equal(connected,true);
});
test('correcting a uniquely proven null-bill event changes exactly bill_id, and only inside the guarded original match',async()=>{
 const [p]=bindOrphanSourceProofs([
  proof(unresolved,q2,'SF5',otherBillId,'printed_bill')]);
 const calls:Array<{query:string;args:unknown[]}>=[];
 const db={query:async(sql:string,args:unknown[])=>{
  calls.push({query:sql,args});
  if(sql.startsWith('SELECT senate_vote_paper_event_fingerprint'))
   return {rows:[{fingerprint:'a'.repeat(64),votes:inverted}],rowCount:1};
  if(sql.startsWith('UPDATE vote_events v SET bill_id=b.id'))
   return {rows:[{id:unresolved.id}],rowCount:1};
  throw Error('Unknown SQL sent during proof');
 }} as unknown as PoolClient;
 await attachStrictPrintedBill(db,p!);
 assert.equal(calls.length,2);
 assert.match(calls[1]!.query,/v\.bill_id IS NULL/);
 assert.match(calls[1]!.query,/b\.identifier=\$4/);
 assert.match(calls[1]!.query,/b\.session_id=v\.session_id/);
 assert.match(calls[1]!.query,/NOT EXISTS/);
 assert.equal(calls[1]!.args[2],otherBillId);
 assert.equal(calls[1]!.args[3],'SF5');
});

test('whole-population denominator can grow only outside independently pinned 2135-Journal source family',()=>{
 const current=(extra:number,journal=2135):import('../src/operations/senate-vote-text-gap-audit.js').VoteTextGapAudit=>({
  auditedEvents:journal+183+extra,
  groups:[
   {session:'2023-2024',vote_kind:'amendment',
    source_family:'senate_journal',evidence_stage:'exact_question',event_count:journal,exact_proposed_text:0,exact_explicit_base:0,exact_captured_base:0,exact_in_journal_prior_adoptions:0,exact_verified_original:0},
   {session:'2023-2024',vote_kind:'amendment',
    source_family:'other_source',evidence_stage:'no_resolved_bill',event_count:183+extra,exact_proposed_text:0,exact_explicit_base:0,exact_captured_base:0,exact_in_journal_prior_adoptions:0,exact_verified_original:0}
  ],
  examples:[],hf100Pilot:[],schemaVersion:'senate-vote-text-gap-v1'
 });
 assert.equal(officialOrphanJournalPopulationCertified(current(0)),true);
 assert.equal(officialOrphanJournalPopulationCertified(current(14)),true);
 assert.equal(officialOrphanJournalPopulationCertified(current(15)),true);
 assert.equal(officialOrphanJournalPopulationCertified(current(30)),true);
 assert.equal(officialOrphanJournalPopulationCertified(current(15,2136)),false);
 assert.equal(officialOrphanJournalPopulationCertified(current(15,2134)),false);
 assert.equal(officialOrphanJournalPopulationCertified({...current(15),auditedEvents:2332}),false);
 assert.equal(officialOrphanJournalPopulationCertified({...current(0),auditedEvents:2200}),false);
});

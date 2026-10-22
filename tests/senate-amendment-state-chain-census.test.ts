import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSourceStateChain,type SourceChainAction}
 from '../src/operations/senate-amendment-state-chain-census.js';

const source='11111111-1111-4111-8111-111111111111';
const bill='22222222-2222-4222-8222-222222222222';
const action=(seq:number,outcome:SourceChainAction['outcome'],kind='amendment'):SourceChainAction=>({
 id:(seq.toString().padStart(8,'0'))+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 session:'2023-2024',sourceDocumentId:source,billId:bill,day:'2023-04-28',
 sequence:seq,actionKey:seq.toString(16).padStart(64,'0'),
 kind,outcome,originalSourceVerified:true,
 hasProposedText:kind==='amendment',
 proposalCapturedExactly:kind==='amendment',
 explicitBaseLocator:kind==='amendment'?'versions/ue/1/':null,
 baseComponentCount:kind==='amendment'?1:0,priorAdoptedKeys:[]
});
function hf100():SourceChainAction[]{
 const rows=[action(1,'adopted'),action(2,'adopted'),action(3,'rejected'),
  action(4,'rejected','procedural'),action(5,'adopted'),
  action(6,'adopted'),action(7,'rejected','procedural'),
  action(8,'adopted','passage')];
 const prior:string[]=[];
 for(const a of rows){
  a.priorAdoptedKeys=[...prior];
  if(a.kind==='amendment'&&a.outcome==='adopted')prior.push(a.actionKey);
 }
 return rows;
}
test('HF100-like original source day: 4 adopted, 1 rejected, all five proposals and exact bases ready to inspect, no assembled text',()=>{
 const rows=hf100(),s=summarizeSourceStateChain(rows,8);
 assert.equal(s.allSourceLocalPaperActions,8);
 assert.equal(s.amendmentActions,5);
 assert.equal(s.originalVerifiedAmendments,5);
 assert.equal(s.exactLiteralProposalCaptures,5);
 assert.equal(s.proposalWithOneExplicitBase,5);
 assert.equal(s.adoptedSourceOnlyReplayCandidates,4);
 assert.equal(s.rejectedAmendmentsExcluded,1);
 assert.equal(s.priorSourceActionChainsChecked,5);
 assert.equal(s.stages.adopted_ready_for_instruction_replay,4);
 assert.equal(s.stages.rejected_excluded_from_current_state,1);
 assert.equal(s.completeAssembledStatesCertified,0);
 assert.equal(s.earlierThanVotePublicationCertified,0);
 assert.equal(s.acceptedOfficialVotesChanged,false);
 assert.equal(s.addedEventLinks,0);
 const json=JSON.stringify(s);
 for(const secret of [source,bill,'versions/ue/1/',rows[0]!.actionKey])
  assert.equal(json.includes(secret),false);
});
test('changed literal capture, original attestation and unavailable explicit base independently hold',()=>{
 const rows=hf100();
 rows[0]!.originalSourceVerified=false;
 rows[1]!.proposalCapturedExactly=false;
 rows[2]!.explicitBaseLocator=null;
 const s=summarizeSourceStateChain(rows,8);
 assert.equal(s.stages.original_journal_not_verified,1);
 assert.equal(s.stages.proposal_capture_not_source_attested,1);
 assert.equal(s.stages.explicit_base_edition_absent,1);
 assert.equal(s.adoptedSourceOnlyReplayCandidates,0);
 assert.equal(s.stages.source_local_predecessor_chain_unproved,2);
});
test('an adopted prior action without verified text blocks every subsequent source-local cumulative state',()=>{
 const rows=hf100();
 rows[0]!.baseComponentCount=0;
 const s=summarizeSourceStateChain(rows,8);
 assert.equal(s.stages.base_capture_absent,1);
 assert.equal(s.stages.source_local_predecessor_chain_unproved,4);
 assert.equal(s.adoptedSourceOnlyReplayCandidates,0);
 assert.equal(s.rejectedAmendmentsExcluded,0);
});
test('one rejected amendment never enters the carried prior-adopted state and cannot block a later good edit',()=>{
 const rows=hf100();
 assert.equal(rows[7]!.priorAdoptedKeys.includes(rows[2]!.actionKey),false);
 const s=summarizeSourceStateChain(rows,rows.length);
 assert.equal(s.adoptedSourceOnlyReplayCandidates,4);
 assert.equal(s.rejectedAmendmentsExcluded,1);
});
test('invented adoption key or unordered predecessor blocks certification without inventing a bill state',()=>{
 const rows=hf100();
 rows[5]!.priorAdoptedKeys=[rows[1]!.actionKey,rows[0]!.actionKey,rows[4]!.actionKey];
 const s=summarizeSourceStateChain(rows,8);
 assert.equal(s.stages.source_local_predecessor_chain_unproved,1);
 assert.equal(s.adoptedSourceOnlyReplayCandidates,3);
 assert.equal(s.completeAssembledStatesCertified,0);
});
test('unknown amendment disposition never becomes an adopted edit and holds later states',()=>{
 const rows=hf100();
 rows[0]!.outcome='unknown';
 const prior=[...rows];
 for(let i=1;i<prior.length;i++)
  prior[i]!.priorAdoptedKeys=prior[i]!.priorAdoptedKeys.filter(x=>x!==rows[0]!.actionKey);
 const s=summarizeSourceStateChain(rows,8);
 assert.equal(s.stages.adoption_outcome_unknown,1);
 assert.equal(s.adoptedSourceOnlyReplayCandidates,0);
 assert.equal(s.rejectedAmendmentsExcluded,0);
});
test('missing, ambiguous and unverified base/proposal cases remain disjoint first failures',()=>{
 const rows=hf100();
 rows[0]!.baseComponentCount=2;
 rows[1]!.hasProposedText=false;
 rows[2]!.proposalCapturedExactly=false;
 const s=summarizeSourceStateChain(rows,8);
 assert.equal(s.stages.base_capture_ambiguous,1);
 assert.equal(s.stages.proposal_literal_absent,1);
 assert.equal(s.stages.proposal_capture_not_source_attested,1);
 assert.equal(s.completeAssembledStatesCertified,0);
});
test('original current-view population count, duplicate action identity, sequence and key integrity fail closed',()=>{
 const rows=hf100();
 assert.throws(()=>summarizeSourceStateChain(rows,7),/denominator/);
 assert.throws(()=>summarizeSourceStateChain([rows[0]!,rows[0]!],2),/denominator/);
 assert.throws(()=>summarizeSourceStateChain([{...rows[0]!,actionKey:'bad'},...rows.slice(1)],8),/invalid source/);
 assert.throws(()=>summarizeSourceStateChain([{...rows[0]!,sequence:2},...rows.slice(1)],8),/reused/);
 assert.throws(()=>summarizeSourceStateChain([{...rows[0]!,priorAdoptedKeys:['notSHA']},...rows.slice(1)],8),/invalid source/);
});

test('conference substitution is not a literal adopted page edit and holds subsequent source-local readiness',()=>{
 const rows=hf100();
 rows[3]!.kind='conference';
 const s=summarizeSourceStateChain(rows,8);
 assert.equal(s.stages.adopted_ready_for_instruction_replay,2);
 assert.equal(s.stages.source_local_predecessor_chain_unproved,2);
 assert.equal(s.completeAssembledStatesCertified,0);
});

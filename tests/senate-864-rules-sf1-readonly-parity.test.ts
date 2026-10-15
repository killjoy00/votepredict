import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 compareRulesOriginalToStored,validateOriginalRulesSF1,
 type RulesSourceDoc,type RulesStoredEvent,type RulesStoredChoice,
 type OriginalRulesSource,type RulesSnapshot
} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
import {assertProtectedRulesSF1Environment,READ_ONLY_QUERIES,ONE_SHOT_MARKER}
 from '../scripts/audit-senate-864-rules-sf1-protected-neon-readonly.js';

const docUrl='https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf';
const pdfSha='a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379';
const ids=Array.from({length:10},(_,i)=>'11111111-2222-3333-4444-'+(i+1).toString().padStart(12,'0'));
const roster=ids.map((id,i)=>({membershipId:id,legislatorId:
 'aaaaaaaa-bbbb-cccc-dddd-'+(i+1).toString().padStart(12,'0'),
 name:'FictionalMember'+i,normalizedName:'fictionalmember'+i,
 startsOn:'2023-01-01',endsOn:'2024-12-31',aliases:[]}));
const individual=(index:number)=>ids.map((_,i)=>({
 sourceName:'FictionalMember'+i,normalizedName:'fictionalmember'+i,
 choice:((index===0?i<4:i>=4)?'yea':'nay') as 'yea'|'nay'
}));
const source:OriginalRulesSource={
 verifiedRawPdfSha:true,verifiedSourceTextSha:true,rolls:[0,1].map(index=>({
  billIdentifier:'SF1',voteKind:index===0?'amendment':'motion',
  motionText:'Fictional original committee motion '+index,
  yeaCount:index===0?4:6,nayCount:index===0?6:4,passed:index===1,
  memberVotes:individual(index),individualVotesAvailable:true
 }))
};
const doc:RulesSourceDoc={id:'doc-1',source_url:docUrl,content_sha256:pdfSha,
 meeting_date:'2023-01-24',committee_name:'Rules and Administration'};
function event(index:number):RulesStoredEvent{
 return {id:'event-'+index,source_document_id:doc.id,
  external_key:'senate-committee:legacy:'+index,occurred_on:'2023-01-24',
  bill_identifier:'SF1',vote_kind:index===0?'amendment':'motion',amendment_ref:null,
  motion_text:'Old positional motion '+index,yea_count:index===0?4:6,
  nay_count:index===0?6:4,passed:index===1,
  committee_name:'Rules and Administration',committee_vote:true};
}
function choices(index:number):RulesStoredChoice[]{
 return ids.map((id,i)=>({vote_event_id:'event-'+index,
  normalized_member_name:'fictionalmember'+i,
  membership_id:id,choice:individual(index)[i]!.choice}));
}
function db(events:RulesStoredEvent[]=[]):RulesSnapshot{
 return {readOnlyTransactionProven:true,databaseIdentityVerified:true,
  completeBoundedSourceEventsFetched:true,explicitRollbackCompleted:true,
  documents:[doc],events,choices:events.flatMap(e=>choices(Number(e.id.at(-1)))),
  historicalRoster:roster};
}
test('Two independently recorded SF1 choices match distinct old positional events without rekey or inserts',()=>{
 assert.equal(validateOriginalRulesSF1(source),true);
 const report=compareRulesOriginalToStored(source,db([event(0),event(1)]));
 assert.equal(report.alreadyStoredExactly,2);
 assert.equal(report.addOnlyCandidatesAwaitingSeparateApproval,0);
 assert.equal(report.holds,0);
 assert.deepEqual(report.statuses.map(x=>x.status),['already_stored_exact','already_stored_exact']);
 assert.equal(report.serviceDayResolvedOriginalMemberChoices,20);
 assert.equal(report.noProductionWriteOrModelRetraining,true);
 assert.ok(!JSON.stringify(report).includes('FictionalMember'));
 assert.ok(!JSON.stringify(report).includes(ids[0]));
});
test('One direct original source with zero stored events can only produce two add-only candidates, not writes',()=>{
 const report=compareRulesOriginalToStored(source,db());
 assert.equal(report.alreadyStoredExactly,0);
 assert.equal(report.addOnlyCandidatesAwaitingSeparateApproval,2);
 assert.ok(report.statuses.every(x=>x.status==='candidate_add_only_after_separate_approval'));
 assert.equal(report.noLegacyPositionalRekeyOrReplay,true);
});
test('one old stored SF1 event leaves the other ambiguous, never assumes absent identical-bill motion',()=>{
 const report=compareRulesOriginalToStored(source,db([event(0)]));
 assert.equal(report.alreadyStoredExactly,1);
 assert.equal(report.holds,1);
 assert.equal(report.addOnlyCandidatesAwaitingSeparateApproval,0);
});
test('any historic membership ambiguity, missing source document, changed byte identity or no rollback holds',()=>{
 const missingRoster=compareRulesOriginalToStored(source,{
  ...db(),historicalRoster:roster.slice(0,-1)});
 assert.equal(missingRoster.holds,2);
 const missingDoc=compareRulesOriginalToStored(source,{...db(),documents:[]});
 assert.equal(missingDoc.holds,2);
 const changedSha=compareRulesOriginalToStored(source,{...db(),documents:[
  {...doc,content_sha256:'b'.repeat(64)}]});
 assert.equal(changedSha.holds,2);
 const noRollback=compareRulesOriginalToStored(source,{
  ...db(),explicitRollbackCompleted:false});
 assert.equal(noRollback.holds,2);
 assert.equal(compareRulesOriginalToStored(source,{
  ...db([event(0)]),choices:choices(0).map(c=>
   c.membership_id===ids[0]?{...c,choice:'nay'}:c)
 }).holds,2);
});
test('invalid original sides and unbounded stored rows refuse source-to-database declaration',()=>{
 assert.equal(validateOriginalRulesSF1({
  ...source,rolls:source.rolls.map((r,i)=>i===0?{...r,memberVotes:r.memberVotes.slice(1)}:r)
 }),false);
 assert.throws(()=>compareRulesOriginalToStored(source,{
  ...db(),events:Array.from({length:301},(_,i)=>({...event(0),id:String(i)}))
 }));
});
test('protected SQL has five bounded SELECTs only and gate requires reviewed main SHA',()=>{
 assert.equal(READ_ONLY_QUERIES.length,5);
 for(const s of READ_ONLY_QUERIES){
  assert.ok(s.startsWith('SELECT '));
  assert.match(s,/LIMIT [0-9]+/);
  assert.doesNotMatch(s,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i);
 }
 const env={
  GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',
  VOTEPREDICT_864_SF1_APPROVAL:'HISTORIC_SF1_TWO_ROLL_READ_ONLY',
  VOTEPREDICT_864_SF1_MARKER_PRESENT:'true',
  VOTEPREDICT_864_MAIN_CI_VERIFIED:'true',
  NEON_API_KEY:'synthetic-only',VOTEPREDICT_NEON_PROJECT_ID:'synthetic-project'
 };
 assert.equal(assertProtectedRulesSF1Environment(env),true);
 for(const key of ['GITHUB_REF','GITHUB_EVENT_NAME',
  'VOTEPREDICT_864_SF1_MARKER_PRESENT','VOTEPREDICT_864_MAIN_CI_VERIFIED']){
  assert.throws(()=>assertProtectedRulesSF1Environment({...env,[key]:'false'}));
 }
 assert.match(ONE_SHOT_MARKER,/SENATE_864_2023_RULES_SF1_PROTECTED_PARITY_ONESHOT/);
 const script=readFileSync('scripts/audit-senate-864-rules-sf1-protected-neon-readonly.ts','utf8');
 assert.match(script,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(script,/default_transaction_read_only=on/);
 assert.match(script,/await client\.query\('ROLLBACK'\)/);
 assert.doesNotMatch(script,/\bINSERT INTO|\bUPDATE vote_events|\bON CONFLICT\s+DO UPDATE/i);
});

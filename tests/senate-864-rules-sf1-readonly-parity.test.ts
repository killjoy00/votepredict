import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 compareRulesOriginalToStored,validateOriginalRulesSF1,normalize2023RulesSf1OfficePrintedName,
 type RulesSourceDoc,type RulesStoredEvent,type RulesStoredChoice,
 type OriginalRulesSource,type RulesSnapshot
} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
import {assertProtectedRulesSF1Environment,assertSafeRulesSF1AggregateReceipt,
 READ_ONLY_QUERIES,ONE_SHOT_MARKER}
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
  motion_text:source.rolls[index]!.motionText,yea_count:index===0?4:6,
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
  documents:[doc],events,choices:events.flatMap(e=>choices(Number(e.id.at(-1)))
   .map(c=>({...c,vote_event_id:e.id}))),
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
test('ten-for-ten exact senator YEA/NAY choices confirm stored SF1 even when old motion text differs',()=>{
 const changedText=[0,1].map(index=>({
  ...event(index),motion_text:'Legacy imported differently formatted source motion '+index
 }));
 const report=compareRulesOriginalToStored(source,db(changedText));
 assert.equal(report.alreadyStoredExactly,2);
 assert.equal(report.holds,0);
 assert.equal(report.addOnlyCandidatesAwaitingSeparateApproval,0);
 assert.deepEqual(report.statuses.map(x=>x.status),
  ['already_stored_exact','already_stored_exact']);
 assert.ok(!JSON.stringify(report).includes('FictionalMember'));
});
test('full ten-voter agreement can distinguish two same-day same-tally candidate motions',()=>{
 const extra={...event(0),id:'event-00',
  motion_text:'Another prior amendment with identical numeric result'};
 const snapshot=db([event(0),extra,event(1)]);
 // Both stored 4-6 motions exist, but only event-0 has the true ten YEA/NAY sides.
 const rival=snapshot.choices.find(x=>x.vote_event_id==='event-00'&&
  x.membership_id===ids[0]);
 assert.ok(rival);
 rival.choice='nay';
 const report=compareRulesOriginalToStored(source,snapshot);
 assert.equal(report.alreadyStoredExactly,2);
 assert.equal(report.holds,0);
 assert.equal(report.addOnlyCandidatesAwaitingSeparateApproval,0);
});
test('two indistinguishable stored events both matching all ten votes must remain ambiguous',()=>{
 const duplicate={...event(0),id:'event-00',motion_text:'Different legacy text'};
 const report=compareRulesOriginalToStored(source,db([event(0),duplicate,event(1)]));
 assert.equal(report.alreadyStoredExactly,1);
 assert.equal(report.holds,1);
 assert.equal(report.statuses[0]!.status,'hold_ambiguous_existing_event');
});
test('conflicting explicit amendment labels or wrong named sides never count as full matches',()=>{
 const withSourceAmendment:OriginalRulesSource={...source,rolls:source.rolls.map(
  (x,i)=>i===0?{...x,amendmentRef:'A12'}:x)};
 const wrongRef={...event(0),amendment_ref:'A13'};
 const conflict=compareRulesOriginalToStored(withSourceAmendment,db([wrongRef,event(1)]));
 assert.equal(conflict.alreadyStoredExactly,1);
 assert.equal(conflict.statuses[0]!.status,'hold_conflicting_existing_event');
 const wrongSide=db([event(0),event(1)]);
 wrongSide.choices=wrongSide.choices.map(x=>x.vote_event_id==='event-0'&&
  x.membership_id===ids[0]?{...x,choice:'nay'}:x);
 const sideMismatch=compareRulesOriginalToStored(source,wrongSide);
 assert.equal(sideMismatch.alreadyStoredExactly,1);
 assert.equal(sideMismatch.statuses[0]!.status,'hold_conflicting_existing_event');
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
test('per-choice private roster resolution distinguishes nine matched from an all-or-none hold',()=>{
 const report=compareRulesOriginalToStored(source,{
  ...db(),historicalRoster:roster.slice(0,9)
 });
 assert.equal(report.holds,2);
 assert.equal(report.serviceDayResolvedOriginalMemberChoices,0);
 assert.equal(report.historicalRosterRows,9);
 assert.equal(report.historicalRosterActiveOnHearingDate,9);
 assert.deepEqual(report.perMotionHistoricalNameResolution.map(x=>({
  matched:x.matched,ambiguous:x.ambiguous,unmatched:x.unmatched,
  invalid:x.matchedWithInvalidMembershipId,unresolved:x.unresolvedSourcePositions,
  duplicates:x.duplicateResolvedMemberships
 })),Array(2).fill(null).map(()=>({
  matched:9,ambiguous:0,unmatched:1,invalid:0,unresolved:[9],duplicates:0
 })));
 const serial=JSON.stringify(report);
 assert.equal(assertSafeRulesSF1AggregateReceipt(serial),true);
 assert.ok(!serial.includes('FictionalMember'));
 assert.ok(!serial.includes(ids[0]));
});
test('true source-name word-order and omitted-middle-initial hints never silently promote to stored vote identity',()=>{
 const custom=db();
 custom.historicalRoster=custom.historicalRoster.map((m,i)=>i===0?
  {...m,name:'Doe, Jane Q.',normalizedName:'doe jane q'}:m);
 const reversed:OriginalRulesSource={...source,rolls:source.rolls.map(r=>({
  ...r,memberVotes:r.memberVotes.map((v,i)=>i===0?
   {...v,sourceName:'Jane Q. Doe',normalizedName:'jane q doe'}:v)
 }))};
 const receipt=compareRulesOriginalToStored(reversed,custom);
 assert.equal(receipt.holds,2);
 assert.equal(receipt.alreadyStoredExactly,0);
 assert.ok(receipt.perMotionHistoricalAliasHypotheses.every(row=>
  row.sourceUnmatchedNameHypotheses.length===1&&
  row.sourceUnmatchedNameHypotheses[0]!.sourcePosition===0&&
  row.sourceUnmatchedNameHypotheses[0]!.exactTokenBagCandidatesCapped2===1&&
  row.sourceUnmatchedNameHypotheses[0]!.hypothesisOnly===true));
 assert.ok(!JSON.stringify(receipt).includes('Doe'));
 assert.ok(!JSON.stringify(receipt).includes(ids[0]));
 assert.equal(assertSafeRulesSF1AggregateReceipt(JSON.stringify(receipt)),true);
 const withoutInitial:OriginalRulesSource={...reversed,rolls:reversed.rolls.map(r=>({
  ...r,memberVotes:r.memberVotes.map((v,i)=>i===0?
   {...v,sourceName:'Jane Doe',normalizedName:'jane doe'}:v)
 }))};
 const lessExact=compareRulesOriginalToStored(withoutInitial,custom);
 assert.equal(lessExact.holds,2);
 assert.ok(lessExact.perMotionHistoricalAliasHypotheses.every(row=>
  row.sourceUnmatchedNameHypotheses[0]!.exactTokenBagCandidatesCapped2===0&&
  row.sourceUnmatchedNameHypotheses[0]!.withoutInitialsCandidatesCapped2===1));
});
test('unmatched abbreviated given initials conservatively match only unique historical surname/given and either roster order',()=>{
 const custom=db();
 custom.historicalRoster=custom.historicalRoster.map((x,i)=>i===0?
  {...x,name:'Doe, Jane Q.',normalizedName:'doe jane q'}:x);
 const printed=(v:string):OriginalRulesSource=>({...source,rolls:source.rolls.map(r=>({
  ...r,memberVotes:r.memberVotes.map((x,i)=>i===0?
   {...x,sourceName:v,normalizedName:v.toLowerCase()}:x)
 }))});
 const hint=compareRulesOriginalToStored(printed('Doe, J'),custom);
 assert.equal(hint.holds,2);
 assert.equal(hint.alreadyStoredExactly,0);
 assert.ok(hint.perMotionHistoricalAliasHypotheses.every(x=>
  x.sourceUnmatchedNameHypotheses.length===1&&
  x.sourceUnmatchedNameHypotheses[0]!.dualOrderSurnameGivenCandidatesCapped2===1));
 assert.equal(assertSafeRulesSF1AggregateReceipt(JSON.stringify(hint)),true);
 // A contradictory fully printed first name must NEVER match on just its initial.
 const wrong=compareRulesOriginalToStored(printed('Doe, John'),custom);
 assert.equal(wrong.holds,2);
 assert.ok(wrong.perMotionHistoricalAliasHypotheses.every(x=>
  x.sourceUnmatchedNameHypotheses[0]!.dualOrderSurnameGivenCandidatesCapped2===0));
 const ambiguous=db();
 ambiguous.historicalRoster=ambiguous.historicalRoster.map((x,i)=>i===0?
  {...x,name:'Doe, Jane Q.',normalizedName:'doe jane q'}:
  i===1?{...x,name:'Doe, John F.',normalizedName:'doe john f'}:x);
 const two=compareRulesOriginalToStored(printed('Doe, J'),ambiguous);
 assert.equal(two.holds,2);
 assert.ok(two.perMotionHistoricalAliasHypotheses.every(x=>
  x.sourceUnmatchedNameHypotheses[0]!.dualOrderSurnameGivenCandidatesCapped2===2));
 assert.equal(two.alreadyStoredExactly,0);
 assert.ok(!JSON.stringify(two).includes('Doe'));
 assert.ok(!JSON.stringify(two).includes(ids[0]));
});
test('six unresolved original senator instances fit in existing strict 4KB private-receipt gate',()=>{
 const receipt=compareRulesOriginalToStored(source,{
  ...db(),historicalRoster:roster.slice(0,7)
 });
 assert.equal(receipt.holds,2);
 assert.ok(receipt.perMotionHistoricalAliasHypotheses.every(x=>
  x.sourceUnmatchedNameHypotheses.length===3));
 const json=JSON.stringify(receipt);
 assert.ok(json.length<4000,'Do not weaken the existing 4KB private-output boundary');
 assert.equal(assertSafeRulesSF1AggregateReceipt(json),true);
 assert.ok(!json.includes('FictionalMember'));
 assert.ok(!json.includes(ids[0]));
});
test('an inactive roster identity is diagnostic only and still cannot create member-specific votes',()=>{
 const original=db();
 original.historicalRoster=original.historicalRoster.map((m,i)=>i===0?
  {...m,startsOn:'2023-02-01'}:m);
 const receipt=compareRulesOriginalToStored(source,original);
 assert.equal(receipt.holds,2);
 assert.equal(receipt.alreadyStoredExactly,0);
 assert.ok(receipt.perMotionHistoricalAliasHypotheses.every(row=>
  row.sourceUnmatchedNameHypotheses[0]!.inactiveStrictMatch===true));
 assert.equal(assertSafeRulesSF1AggregateReceipt(JSON.stringify(receipt)),true);
});

test('adopted 2023 Senate SR7 officer titles are not member given names; both SF1 rolls resolve all 10 without inference',()=>{
 const officeRoster=[
  ['Kari Dziedzic','Dziedzic, Chair'],
  ['Ann H. Rest','Rest, Vice Chair'],
  ['Mark T. Johnson','Johnson, Lead'],
  ['Bobby Joe Champion','Champion'],
  ['Justin D. Eichorn','Eichorn'],
  ['Nick A. Frentz','Frentz'],
  ['Warren Limmer','Limmer'],
  ['John Marty','Marty'],
  ['Jeremy R. Miller','Miller'],
  ['Erin P. Murphy','Murphy']
 ];
 const expected=['Dziedzic','Rest','Johnson','Champion','Eichorn','Frentz',
  'Limmer','Marty','Miller','Murphy'];
 const alternate=db();
 alternate.historicalRoster=officeRoster.map(([name],i)=>({
  ...roster[i]!,name,normalizedName:name.toLowerCase(),
  aliases:[]
 }));
 const actual:OriginalRulesSource={...source,rolls:source.rolls.map(r=>({
  ...r,memberVotes:r.memberVotes.map((v,i)=>({
   ...v,sourceName:officeRoster[i]![1],
   normalizedName:officeRoster[i]![1].toLowerCase()
  }))
 }))};
 assert.equal(validateOriginalRulesSF1(actual),true);
 assert.deepEqual(officeRoster.map(x=>normalize2023RulesSf1OfficePrintedName(x[1])),expected);
 const receipt=compareRulesOriginalToStored(actual,alternate);
 assert.equal(receipt.holds,0);
 assert.equal(receipt.serviceDayResolvedOriginalMemberChoices,20);
 assert.equal(receipt.addOnlyCandidatesAwaitingSeparateApproval,2);
 assert.ok(receipt.perMotionHistoricalNameResolution.every(x=>
  x.matched===10&&x.unmatched===0&&x.ambiguous===0&&
  x.duplicateResolvedMemberships===0));
 assert.equal(assertSafeRulesSF1AggregateReceipt(JSON.stringify(receipt)),true);
 assert.ok(!JSON.stringify(receipt).includes('Champion'));
 assert.ok(!JSON.stringify(receipt).includes(ids[0]));
});

test('SF1 office-role corrections reject wrong senator, wrong office, different committee and duplicated same-name identity',()=>{
 for(const bad of ['Johnson, Chair','Rest, Lead','Dziedzic, Vice Chair',
  'Someone, Chair','Johnson, Lead, Senator','Champion, Chair','Johnson, Mayor']){
  assert.equal(normalize2023RulesSf1OfficePrintedName(bad),bad);
 }
 assert.equal(normalize2023RulesSf1OfficePrintedName('  Rest,  Vice Chair '),'Rest');
 const rosterWithOffices=roster.map((x,i)=>i===0?{
  ...x,name:'Kari Dziedzic',normalizedName:'kari dziedzic'
 }:x);
 const rolls={...source,rolls:source.rolls.map(r=>({
  ...r,memberVotes:r.memberVotes.map((v,i)=>i===0?
   {...v,sourceName:'Dziedzic, Chair',normalizedName:'dziedzic chair'}:v)
 }))};
 const copy={...rosterWithOffices[0]!,
  membershipId:'dddddddd-cccc-bbbb-aaaa-000000000011',
  legislatorId:'eeeeeeee-dddd-cccc-bbbb-000000000011'};
 const rs=compareRulesOriginalToStored(rolls,{
  ...db(),historicalRoster:[...rosterWithOffices,copy]});
 assert.equal(rs.holds,2);
 assert.ok(rs.perMotionHistoricalNameResolution.every(x=>
  x.matched===9&&x.ambiguous===1));
});
test('invalid original sides and unbounded stored rows refuse source-to-database declaration',()=>{
 assert.equal(validateOriginalRulesSF1({
  ...source,rolls:source.rolls.map((r,i)=>i===0?{...r,memberVotes:r.memberVotes.slice(1)}:r)
 }),false);
 assert.throws(()=>compareRulesOriginalToStored(source,{
  ...db(),events:Array.from({length:301},(_,i)=>({...event(0),id:String(i)}))
 }));
});
test('safe SF1 aggregate receipt is not rejected by sourceNamedMotions field substring',()=>{
 const safe=JSON.stringify(compareRulesOriginalToStored(source,db([event(0),event(1)])));
 assert.match(safe,/"sourceNamedMotions":2/);
 assert.equal(assertSafeRulesSF1AggregateReceipt(safe),true);
 for(const key of ['sourceName','memberVotes','source_url','external_key',
  'normalized_member_name','membership_id']){
  assert.throws(()=>assertSafeRulesSF1AggregateReceipt(
   JSON.stringify({safe:true,[key]:'private-value'})),/private identity gate/);
 }
 for(const url of ['https://www.lrl.mn.gov/minutes/original.pdf',
  'postgresql://redacted@example.com/votepredict']){
  assert.throws(()=>assertSafeRulesSF1AggregateReceipt(
   JSON.stringify({unexpected:url})),/private identity gate/);
 }
 assert.throws(()=>assertSafeRulesSF1AggregateReceipt(
  JSON.stringify({large:'x'.repeat(4100)})),/private identity gate/);
 assert.equal(ONE_SHOT_MARKER,
  'SENATE_864_2023_RULES_SF1_PROTECTED_PARITY_ONESHOT_20261015_V7');
});
test('protected SQL has five bounded SELECTs only and gate requires reviewed main SHA',()=>{
 assert.equal(READ_ONLY_QUERIES.length,5);
 // Reject an accidental full-day Senate-floor choice scan: choice rows must
 // have the same exact bounded committee-event predicate as EVENT_SQL.
 assert.match(READ_ONLY_QUERIES[1]!,/committeeVote/);
 assert.match(READ_ONLY_QUERIES[2]!,/committeeVote/);
 assert.match(READ_ONLY_QUERIES[2]!,/sd\.source_url=\$2 OR sd\.content_sha256=\$3/);
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
 assert.match(script,/client\.query\(CHOICE_SQL,\[DAY,SOURCE,PDF_SHA\]\)/);
 assert.match(script,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(script,/default_transaction_read_only=on/);
 assert.match(script,/await client\.query\('ROLLBACK'\)/);
 assert.doesNotMatch(script,/\bINSERT INTO|\bUPDATE vote_events|\bON CONFLICT\s+DO UPDATE/i);
});

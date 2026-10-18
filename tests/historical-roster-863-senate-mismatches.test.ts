import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SENATE863_MISMATCH_SQL,checkSenate863SQL,senate863OfficialSource,
 senate863MismatchType,summarizeSenate863Mismatches,
 type Mismatch863SourceRow,
} from '../src/evaluation/historical-roster-863-senate-mismatches.js';
import {runSenate863MismatchQuery,assertSenate863Protected} from
 '../scripts/audit-historical-roster-863-senate-mismatches-readonly.js';
function fixture():Mismatch863SourceRow{
 return {session:'2023-2024',chamber:'senate',
  event_id:'test-event-1',occurred_on:'2023-03-09',bill:'SF123',
  vote_kind:'amendment',is_passage:false,
  declared_yeas:7,declared_nays:2,declared_other:0,
  named_yeas:5,named_nays:2,named_other:0,total_named:7,unresolved:0,
  source_kind:'senate_committee_minutes',
  source_url:'https://www.lrl.mn.gov/archive/minutes/senate/test.pdf',
  stored_source_sha256:'f'.repeat(64),
  stored_source_fetched_at:'2026-10-15T00:00:00Z',committee_vote:true};
}
test('bounded fixed SELECT census has no mutation or untrusted SQL input',()=>{
 assert.equal(checkSenate863SQL(),true);
 assert.ok(SENATE863_MISMATCH_SQL.includes('LIMIT 101'));
 assert.ok(SENATE863_MISMATCH_SQL.includes("q.declared_yeas<>q.named_yeas"));
});
test('categories do not assert official lost votes',()=>{
 const first=fixture(),second={...first,event_id:'test-event-2',
  vote_kind:'passage',named_yeas:0,named_nays:0,total_named:0},
 third={...first,event_id:'test-event-3',
  declared_yeas:4,named_yeas:5};
 assert.equal(senate863MismatchType(first),'declared_exceeds_named_choices');
 assert.equal(senate863MismatchType(second),'declared_tally_without_named_roll');
 assert.equal(senate863MismatchType(third),'named_choices_exceed_declared');
 const report=summarizeSenate863Mismatches([first,second,third]);
 assert.equal(report.storedEventMismatches,3);
 assert.equal(report.matchesPreviousAggregateOf50,false);
 assert.equal(report.originalOfficialBytesAuthenticated,0);
 assert.equal(report.missingVotesProvenByThisAudit,false);
 assert.equal(report.events[0].committeeVote,true);
 assert.equal(report.events[0].officialSourceHostVerified,true);
 const safe=JSON.stringify(report);
 for(const term of ['event_id','source_member_name','membership_id','motion_text','stored_source_sha256'])
   assert.equal(safe.includes('"'+term+'"'),false);
});
test('source URL only permitted for official HTTPS strict allow-list',()=>{
 assert.equal(senate863OfficialSource('https://www.lrl.mn.gov/test.pdf').official,true);
 for(const url of ['http://www.lrl.mn.gov/x',
   'https://www.lrl.mn.gov.evil.test/x','https://example.com',
   'https://user:pass@www.lrl.mn.gov/x','bad']){
   assert.equal(senate863OfficialSource(url).official,false);
 }
});
test('duplicate and non-mismatch rows and truncation fail closed',()=>{
 const a=fixture();
 assert.throws(()=>summarizeSenate863Mismatches([a,a]),/Duplicate/);
 assert.throws(()=>summarizeSenate863Mismatches([{...a,named_yeas:7}]),
  /non-mismatch/);
 assert.throws(()=>summarizeSenate863Mismatches(
  Array.from({length:101},(_,i)=>({...a,event_id:String(i)}))),/cap/);
});
test('read-only transaction verifies identity, rolls back, publishes public receipt only',async()=>{
 const calls:string[]=[];
 const client={query:async(sql:string)=>{
  calls.push(sql);
  if(sql.startsWith('SELECT current_database()'))
    return {rows:[{db:'verified',role:'readonly',ro:'on'}]};
  if(sql===SENATE863_MISMATCH_SQL)return{rows:[fixture()]};
  return{rows:[]};
 }};
 const out=await runSenate863MismatchQuery(
  client as Parameters<typeof runSenate863MismatchQuery>[0],
  {database:'verified',role:'readonly'});
 assert.equal(out.storedEventMismatches,1);
 assert.deepEqual(calls.slice(0,2),[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"]);
 assert.equal(calls.at(-1),'ROLLBACK');
});
test('identity mismatch rolls back and refuses private connection',async()=>{
 const calls:string[]=[];
 const client={query:async(sql:string)=>{
  calls.push(sql);
  return sql.startsWith('SELECT current_database()')?
    {rows:[{db:'wrong',role:'readonly',ro:'on'}]}:{rows:[]};
 }};
 await assert.rejects(()=>runSenate863MismatchQuery(
  client as Parameters<typeof runSenate863MismatchQuery>[0],
  {database:'verified',role:'readonly'}),/identity/);
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.throws(()=>assertSenate863Protected({NODE_ENV:'test'}),/protected/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {judiciaryYeaPlan,INSERT_JUDICIARY_YEA,YEA_DAY,YEA_URL,YEA_SHA,type JudiciaryYeaSource} from '../src/evidence/senate-864-judiciary-yea-repair.js';
import type {RulesSnapshot} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
const id=(i:number)=>'11111111-2222-4333-8444-'+String(i).padStart(12,'0');
function fixture(){
 const source=JSON.parse(readFileSync('tests/fixtures/senate-864-judiciary-20240221-roll.json','utf8')) as JudiciaryYeaSource;
 const snapshot:RulesSnapshot={readOnlyTransactionProven:true,databaseIdentityVerified:true,completeBoundedSourceEventsFetched:true,
 explicitRollbackCompleted:true,documents:[{id:id(50),source_url:YEA_URL,content_sha256:YEA_SHA,meeting_date:YEA_DAY,committee_name:'Judiciary and Public Safety'}],
 events:[{id:id(51),source_document_id:id(50),external_key:'existing-legacy-key-kept',occurred_on:YEA_DAY,bill_identifier:'SF3534',vote_kind:'amendment',
 amendment_ref:null,motion_text:source.roll.motionText,yea_count:6,nay_count:4,passed:true,committee_name:'Judiciary and Public Safety',committee_vote:true,is_passage:false} as RulesSnapshot['events'][number]],
 choices:source.roll.memberVotes.filter(v=>v.normalizedName!=='latz chair').map((v,i)=>({vote_event_id:id(51),membership_id:id(i+1),normalized_member_name:v.normalizedName,choice:v.choice})),
 historicalRoster:[{membershipId:id(70),legislatorId:id(71),name:'Ronald Steven Latz',startsOn:'2023-01-03',endsOn:'2024-12-31',aliases:['Ron Latz']}]};
 return {source,snapshot};
}
test('exact original role-labelled YEA uses independent full alias and one existing question',()=>{
 const {source,snapshot}=fixture(),p=judiciaryYeaPlan(source,snapshot);
 assert.equal(p.insert,true);assert.equal(p.choice.choice,'yea');assert.equal(p.choice.sourceName,'Latz - Chair');
 snapshot.historicalRoster[0].name='Other Latz';snapshot.historicalRoster[0].aliases=['Latz'];
 assert.throws(()=>judiciaryYeaPlan(source,snapshot),/Full alias/);
});
test('no missing source, wrong side, unknown date bounds, ambiguous person or competing event can write',()=>{
 for(const mutate of [
  (s:RulesSnapshot)=>{s.historicalRoster[0].endsOn=null},
  (s:RulesSnapshot)=>{s.historicalRoster.push({...s.historicalRoster[0],membershipId:id(80)})},
  (s:RulesSnapshot)=>{s.events.push({...s.events[0],id:id(90)})},
  (s:RulesSnapshot)=>{s.choices[0].choice='nay'},
  (s:RulesSnapshot)=>{s.documents[0].content_sha256='0'.repeat(64)},
 ]){const {source,snapshot}=fixture();mutate(snapshot);assert.throws(()=>judiciaryYeaPlan(source,snapshot));}
 const {source,snapshot}=fixture();source.independentOfficeAndFullAliasVerified=false as true;
 assert.throws(()=>judiciaryYeaPlan(source,snapshot));
});
test('exact readback is idempotent; a conflicting linked person cannot pass',()=>{
 const {source,snapshot}=fixture(),p=judiciaryYeaPlan(source,snapshot);
 snapshot.choices.push({vote_event_id:p.eventId,membership_id:p.membershipId,normalized_member_name:p.choice.normalizedName,choice:'yea'});
 assert.equal(judiciaryYeaPlan(source,snapshot).insert,false);
 snapshot.choices.at(-1)!.membership_id=id(99);assert.throws(()=>judiciaryYeaPlan(source,snapshot),/Conflicting/);
});
test('real PostgreSQL add-only choice SQL cannot overwrite a conflicting row',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url){t.skip('Disposable CI PostgreSQL required');return;}
 const pool=new Pool({connectionString:url,max:1}),db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query('CREATE TEMP TABLE member_votes (LIKE public.member_votes INCLUDING ALL) ON COMMIT DROP');
  const {source,snapshot}=fixture(),p=judiciaryYeaPlan(source,snapshot),args=[p.eventId,p.membershipId,p.choice.sourceName,p.choice.normalizedName,JSON.stringify({modelWeight:0,sameDayEligible:false})];
  assert.equal((await db.query(INSERT_JUDICIARY_YEA,args)).rows.length,1);
  assert.equal((await db.query(INSERT_JUDICIARY_YEA,[...args.slice(0,1),id(99),...args.slice(2)])).rows.length,0);
  const rows=(await db.query('SELECT membership_id::text,choice,source_ordinal,metadata FROM member_votes')).rows;
  assert.deepEqual(rows,[{membership_id:p.membershipId,choice:'yea',source_ordinal:null,metadata:{modelWeight:0,sameDayEligible:false}}]);
 }finally{await db.query('ROLLBACK');db.release();await pool.end()}
});

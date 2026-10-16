import assert from 'node:assert/strict';
import test from 'node:test';
import type {Pool} from 'pg';
import {
 SESSION_YEAR_SQL,CALENDAR_YEAR_SQL,DUPLICATE_PERSON_YEAR_SQL,
 ROSTER_DIAGNOSTIC_QUERIES,V5_ROSTER_COUNTS,
 HISTORICAL_SENATE_SESSION_SQL_PROOF_VERSION,
} from '../../scripts/senate-864-roster-session-diagnostic-sql.js';
import {
 BY_SESSION,BY_YEAR,BY_PERSON_YEAR,
 SENATE_ROSTER_SESSION_ONESHOT_MARKER,
 validateIndependentV5RosterReceipt,auditProtectedRosterSessionMultiplicity,
} from '../scripts/audit-senate-864-roster-sessions-readonly.js';

const ID='blue-owl-12345',BR='br-quiet-moon-111',EP='ep-brisk-stream-123';
const HOST=EP+'.us-east-2.aws.neon.tech',KEY='SYNTHETIC_PRIVATE_KEY',PW='SYNTHETIC_DB_PASSWORD';
const BASE='https://console.neon.tech/api/v2/projects/'+ID;
const URI='postgresql://neondb_owner:'+PW+'@'+HOST+'/neondb?sslmode=require&channel_binding=require';
const config={apiKey:KEY,projectId:ID};
async function fakeNeon(url:string,init:RequestInit){
 assert.equal(init.method,'GET');
 assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+KEY);
 let body:unknown;
 if(url===BASE)body={project:{id:ID,name:'VotePredict'}};
 else if(url===BASE+'/branches?limit=100')body={
  branches:[{id:BR,project_id:ID,default:true}],pagination:{next:null}};
 else if(url===BASE+'/branches/'+BR+'/databases')body={
  databases:[{name:'neondb',branch_id:BR,owner_name:'neondb_owner'}]};
 else if(url===BASE+'/endpoints')body={
  endpoints:[{id:EP,project_id:ID,branch_id:BR,type:'read_write',host:HOST}]};
 else if(url.startsWith(BASE+'/connection_uri?'))body={uri:URI};
 else throw Error('Unexpected Neon API action');
 return new Response(JSON.stringify(body),{status:200});
}
const yearParts:Record<string,Array<{session:string,rows:number,clamped:number}>>={
 '2021':[{session:'2021-2022',rows:67,clamped:67}],
 '2022':[{session:'2021-2022',rows:67,clamped:67}],
 '2023':[
  {session:'2021-2022',rows:66,clamped:0},
  {session:'2023-2024',rows:66,clamped:66},
  {session:'2025-2026',rows:66,clamped:0},
 ],
 '2024':[
  {session:'2023-2024',rows:67,clamped:67},
  {session:'2025-2026',rows:67,clamped:0},
 ],
 '2025':[
  {session:'2023-2024',rows:66,clamped:0},
  {session:'2025-2026',rows:70,clamped:70},
 ],
};
const toPg=(o:Record<string,string|number>)=>Object.fromEntries(
 Object.entries(o).map(([k,v])=>[k,String(v)]));
function valid(){
 const sessions:Record<string,string>[]=[];
 const years:Record<string,string>[]=[];
 const duplicate:Record<string,string>[]=[];
 for(const pinned of V5_ROSTER_COUNTS){
  const parts=yearParts[pinned.year]!;
  const sum=parts.reduce((n,p)=>n+p.rows,0);
  const clamped=parts.reduce((n,p)=>n+p.clamped,0);
  assert.equal(sum,pinned.memberships);
  for(const item of parts){
   sessions.push(toPg({
    year:pinned.year,session_slug:item.session,v5_membership_rows:item.rows,
    v5_people_in_session:Math.min(item.rows,pinned.people),
    rows_from_session_not_intersecting_calendar_year:item.clamped===0?item.rows:0,
    rows_from_session_year_but_not_active_within_both_bounds:0,
    session_clamped_active_membership_rows:item.clamped,
    session_clamped_active_people_in_session:item.clamped,
    membership_starts_before_session:0,membership_ends_after_session:0,
    missing_session_dates:0,
   }));
  }
  years.push(toPg({
   year:pinned.year,v5_memberships:pinned.memberships,v5_people:pinned.people,
   session_clamped_active_membership_rows:clamped,session_clamped_active_people:clamped,
   rows_outside_session_calendar_year:pinned.memberships-clamped,
   people_with_outside_session_membership_rows:pinned.memberships===clamped?0:pinned.people,
   records_missing_session_date_boundary:0,
  }));
  const delta=pinned.memberships-pinned.people;
  duplicate.push(toPg({
   year:pinned.year,people_with_multiple_v5_membership_rows:delta?50:0,
   people_with_multiple_v5_session_slugs:delta?50:0,
   v5_extra_rows_from_duplicate_people:delta,
   multi_v5_row_people_with_at_most_one_session_clamped_row:delta?50:0,
   people_with_multi_session_clamped_rows:0,
   highest_membership_rows_for_one_person:delta?3:1,
   highest_sessions_for_one_person:delta?3:1,
  }));
 }
 return{sessions,years,duplicate};
}
function fakePool(rows=valid(),opt?:{badSql?:number,badRow?:boolean,badIdentity?:boolean}){
 const queries:string[]=[];let released=0,ended=0;
 const factory=(o:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(o?.host,HOST);
  assert.equal(o?.user,'neondb_owner');
  assert.equal(o?.password,PW);
  assert.match(String(o?.options),/default_transaction_read_only=on/);
  return{
   connect:async()=>({
    query:async(sql:string)=>{
     queries.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return{rows:[]};
     if(sql.includes('current_database()'))return{rows:[{
      db:'neondb',role:'neondb_owner',ro:opt?.badIdentity?'off':'on',
     }]};
     const index=ROSTER_DIAGNOSTIC_QUERIES.indexOf(
      sql as typeof ROSTER_DIAGNOSTIC_QUERIES[number]);
     if(index<0)throw Error('Unexpected query attempt');
     if(opt?.badSql===index)throw Error('PRIVATE SQL ERROR WITH SECRET');
     const source=index===0?rows.sessions:index===1?rows.years:rows.duplicate;
     if(opt?.badRow&&index===0)return{rows:[{...source[0],row_id:'PRIVATE_ID'}]};
     return{rows:source};
    },
    release:()=>{released++},
   }),
   end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 return{factory,queries,releases:()=>released,ends:()=>ended};
}

test('V5 pinned roster receipt and allowed calendar year counts are source-linked, not computed by guess',()=>{
 assert.equal(validateIndependentV5RosterReceipt(),true);
 assert.deepEqual(V5_ROSTER_COUNTS.map(x=>[x.year,x.people,x.memberships]),[
  ['2021',67,67],['2022',67,67],['2023',90,198],['2024',68,134],['2025',70,136],
 ]);
 assert.equal(HISTORICAL_SENATE_SESSION_SQL_PROOF_VERSION,
  'mn-864-senate-calendar-year-vs-session-member-bounds-v1');
 assert.equal(SENATE_ROSTER_SESSION_ONESHOT_MARKER,
  'SENATE_864_SENATE_ROSTER_SESSION_READONLY_ONESHOT_20261012_V1');
});
test('three fixed SQL statements examine session overlap, group by year, and return counts only',()=>{
 assert.deepEqual([...ROSTER_DIAGNOSTIC_QUERIES],[
  SESSION_YEAR_SQL,CALENDAR_YEAR_SQL,DUPLICATE_PERSON_YEAR_SQL,
 ]);
 for(const q of ROSTER_DIAGNOSTIC_QUERIES){
  assert.match(q,/^WITH year_memberships AS MATERIALIZED/);
  assert.match(q,/generate_series\(2021,2025\)/);
  assert.match(q,/WHERE c\.slug='senate'/);
  assert.match(q,/s\.slug IN \('2021-2022','2023-2024','2025-2026'\)/);
  assert.match(q,/JOIN legislators l ON l\.id=m\.legislator_id/);
  assert.match(q,/\bGROUP BY\b/);
  assert.match(q,/\bLIMIT (6|16)$/);
  assert.doesNotMatch(q,/;|\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|COPY|GRANT|REVOKE|CALL)\b/i);
 }
 assert.match(SESSION_YEAR_SQL,/session_calendar_year_intersects/);
 assert.match(CALENDAR_YEAR_SQL,/COUNT\(DISTINCT legislator_id\)::text AS v5_people/);
 assert.match(DUPLICATE_PERSON_YEAR_SQL,/COUNT\(DISTINCT session_slug\)/);
 assert.equal(BY_SESSION.length,9);
 assert.equal(BY_YEAR.length,7);
 assert.equal(BY_PERSON_YEAR.length,7);
});
test('protected existing Neon session query is bounded, repeated-read READ ONLY, and ROLLBACK only',async()=>{
 const p=fakePool();const phases:string[]=[];
 const outcome=await auditProtectedRosterSessionMultiplicity(config,fakeNeon,p.factory,
  phase=>phases.push(phase));
 assert.equal(outcome.issue,864);
 assert.equal(outcome.verifiedPriorAuditRun,38196817626);
 assert.equal(outcome.allFiveCalendarYearsIncluded,true);
 assert.equal(outcome.queryCount,3);
 assert.equal(outcome.selectedVotePredictNeonDefaultBranchAuthenticated,true);
 assert.equal(outcome.deployedProductionBindingIndependentlyVerified,false);
 assert.equal(outcome.restrictedTransactionReadOnly,true);
 assert.equal(outcome.transactionExplicitRollbackCompleted,true);
 assert.equal(outcome.noDatabaseWrites,true);
 assert.equal(outcome.individualSenatorIdentityMatchedToGovernment95Source,false);
 assert.equal(outcome.correctHistoricalTermAndEvidenceAsOfJoinsNotCertified,true);
 assert.equal(outcome.years.length,5);
 assert.equal(outcome.multiplicity.length,5);
 assert.equal(outcome.sessionRows.length,9);
 assert.equal(outcome.driftComparedToPinnedV5.every(x=>x.differentFromPinnedV5Snapshot===false),true);
 assert.deepEqual(p.queries,[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
  ...ROSTER_DIAGNOSTIC_QUERIES,'ROLLBACK',
 ]);
 assert.equal(p.releases(),1);assert.equal(p.ends(),1);
 assert.equal(phases.at(-1),'explicit_readonly_transaction_rolled_back');
 const safe=JSON.stringify(outcome);
 assert.doesNotMatch(safe,/SYNTHETIC_DB_PASSWORD|PRIVATE|brisk-stream|legislator_id|membership_id|source_url|district|Taylor Swift/);
});
test('malformed or oversized per-session aggregates fail closed with ROLLBACK (no mistaken zero)',async()=>{
 const bad=fakePool(undefined,{badRow:true});
 await assert.rejects(
  ()=>auditProtectedRosterSessionMultiplicity(config,fakeNeon,bad.factory),
  /Unexpected aggregate field/);
 assert.equal(bad.queries.at(-1),'ROLLBACK');
 assert.equal(bad.releases(),1);assert.equal(bad.ends(),1);
 const invalid=valid();
 invalid.sessions[0]={...invalid.sessions[0]!,v5_membership_rows:'PRIVATE NAME'};
 const malformed=fakePool(invalid);
 await assert.rejects(
  ()=>auditProtectedRosterSessionMultiplicity(config,fakeNeon,malformed.factory),
  /Invalid or unsafe annual roster aggregate/);
 assert.equal(malformed.queries.at(-1),'ROLLBACK');
 const oversized=valid();
 oversized.sessions.push(...oversized.sessions,...oversized.sessions);
 const other=fakePool(oversized);
 await assert.rejects(()=>auditProtectedRosterSessionMultiplicity(config,fakeNeon,other.factory),
  /row count/);
 assert.equal(other.queries.at(-1),'ROLLBACK');
});
test('any query error or read-write session is rejected without exporting sensitive errors',async()=>{
 for(const option of [{badSql:0},{badSql:1},{badSql:2},{badIdentity:true}]){
  const p=fakePool(undefined,option);
  await assert.rejects(()=>auditProtectedRosterSessionMultiplicity(config,fakeNeon,p.factory));
  assert.equal(p.queries.at(-1),'ROLLBACK');
  assert.equal(p.releases(),1);assert.equal(p.ends(),1);
 }
});
test('difference from verified V5 counts is reported, never overwritten as historic Senate proof',async()=>{
 const m=valid();m.years[2]={...m.years[2]!,v5_people:'91'};
 m.duplicate[2]={...m.duplicate[2]!,v5_extra_rows_from_duplicate_people:'107'};
 const p=fakePool(m);
 const r=await auditProtectedRosterSessionMultiplicity(config,fakeNeon,p.factory);
 const year=r.driftComparedToPinnedV5.find(y=>y.year==='2023')!;
 assert.equal(year.differentFromPinnedV5Snapshot,true);
 assert.equal(year.peopleFromV5,90);
 assert.equal(year.observedPeople,91);
 assert.equal(year.membershipRowsFromV5,198);
});

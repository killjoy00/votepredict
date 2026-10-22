import test from 'node:test';
import assert from 'node:assert/strict';
import {
 EXPOSURE_SQL, VERSION, MARKER, METRICS, aggregateOnly
} from '../src/evidence/cfb-864-finance-asof-exposure.mjs';
import {
 assertProtectedScope,runFinanceExposureAudit
} from '../scripts/audit-cfb-864-finance-asof-exposure-readonly.mjs';

function sample(overrides={}){
 const v={year:'2024',family:'candidate_contribution',scope:'senate_member'};
 for(const field of METRICS)v[field]='0';
 Object.assign(v,{copies:'5',canonical_transactions:'3',eligible_copies:'4',
  eligible_canonical_transactions:'2',eligible_dated_copies:'4',
  eligible_missing_exact_publicby:'4',possible_pre_vote_copies:'2',
  possible_pre_vote_canonical:'2',possible_pre_vote_without_certification:'2'},overrides);
 return v;
}
test('strict bounded numeric aggregate allows recognized families, not donor/row/money cells',()=>{
 const rows=aggregateOnly([sample(),sample({family:'candidate_expenditure'}),
  sample({family:'independent_expenditure'})]);
 assert.equal(rows.length,3);
 assert.equal(rows[0].possible_pre_vote_without_certification,2);
 assert.throws(()=>aggregateOnly([sample({donor:'secret'})]),/aggregate/);
 assert.throws(()=>aggregateOnly([sample({copies:'1000001'})]),/count/);
 assert.throws(()=>aggregateOnly([sample({canonical_transactions:'6'})]),/exceeds/);
 assert.throws(()=>aggregateOnly([sample(),sample()]),/Duplicate/);
 assert.throws(()=>aggregateOnly([sample({family:'party_spending'})]),/column or group/);
});
test('audit labels stored evidence as risk, separately checks actual passage vote cutoff and source family',()=>{
 for(const part of [
  "c.slug='senate'", "ve.is_passage=true", "mv.choice IN ('yea','nay')",
  "ve.occurred_on < DATE '2026-01-01'",
  "sd.source_kind='campaign_finance_independent_expenditure_bulk'",
  "ei.metadata->>'spenderRegistrationNumber'",
  "ei.metadata->>'filerRegistrationNumber'",
  "cfb_official_senate_pdf_versions",
  "historicalFinanceIndependentVerification",
  "published_at AT TIME ZONE 'America/Chicago'",
  "count(DISTINCT (reg,row_key))",
  "possible_pre_vote_without_certification",
  "pre_vote_candidate_year_earliest_floor_conflicts",
 ])assert.ok(EXPOSURE_SQL.includes(part),part);
 assert.doesNotMatch(EXPOSURE_SQL,/\b(UPDATE|INSERT|DELETE|TRUNCATE|ALTER|DROP|COPY|GRANT|REVOKE)\b/i);
 assert.match(EXPOSURE_SQL,/GROUP BY year,family,scope/);
});
test('protected runner enforces exact main first attempt marker with validated preflight',()=>{
 const good={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),
  VOTEPREDICT_864_FINANCE_EXPOSURE_PREFLIGHT:'true',
  VOTEPREDICT_864_FINANCE_EXPOSURE_MARKER:MARKER};
 assert.doesNotThrow(()=>assertProtectedScope(good));
 for(const [k,v] of Object.entries({GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_REF:'refs/heads/other',GITHUB_RUN_ATTEMPT:'2',GITHUB_SHA:'not-a-commit',
  VOTEPREDICT_864_FINANCE_EXPOSURE_PREFLIGHT:'false',
  VOTEPREDICT_864_FINANCE_EXPOSURE_MARKER:'wrong'}))
  assert.throws(()=>assertProtectedScope({...good,[k]:v}));
});
test('protected audit uses repeatable-read read-only transaction, aggregate-only SQL and explicit rollback',async()=>{
 const queries=[];
 let released=false,ended=false;
 const client={
  async query(sql){
   queries.push(sql);
   if(sql.startsWith('SELECT current_database'))return {rows:[{db:'votepredict',role:'safe_reader',ro:'on'}]};
   if(sql===EXPOSURE_SQL)return {rows:[sample()]};
   return {rows:[]};
  },release(){released=true;}
 };
 const result=await runFinanceExposureAudit({apiKey:'dummy',projectId:'dummy'},{
  discover:async()=>({host:'safe.neon.tech',port:5432,role:'safe_reader',
   password:'do-not-print',database:'votepredict'}),
  connect:()=>({connect:async()=>client,end:async()=>{ended=true;}})
 });
 assert.equal(result.schema,VERSION);
 assert.equal(result.explicitRollback,true);
 assert.equal(result.groups[0].eligible_missing_exact_publicby,4);
 assert.deepEqual(queries.slice(0,2),[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
 ]);
 assert.equal(queries.at(-1),'ROLLBACK');
 assert.equal(released,true);assert.equal(ended,true);
 assert.equal(JSON.stringify(result).includes('do-not-print'),false);
});
test('invalid private query output fails closed and rolls back',async()=>{
 const queries=[];let released=false;
 await assert.rejects(runFinanceExposureAudit({},{
  discover:async()=>({host:'safe.neon.tech',port:5432,role:'safe_reader',password:'redact',
   database:'votepredict'}),
  connect:()=>({connect:async()=>({query:async sql=>{
   queries.push(sql);
   if(sql.startsWith('SELECT current_database'))return {rows:[{db:'votepredict',role:'safe_reader',ro:'on'}]};
   if(sql===EXPOSURE_SQL)return {rows:[sample({amount:'999'})]};
   return {rows:[]};
  },release:()=>{released=true;}}),end:async()=>{}})
 }),/aggregate/);
 assert.equal(queries.at(-1),'ROLLBACK');
 assert.equal(released,true);
});

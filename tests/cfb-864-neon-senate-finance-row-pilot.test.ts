import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Pool} from 'pg';
import {
 CFB_864_ROW_PILOT_MARKER,FINANCE_FAMILIES,FIXED_FINANCE_SAMPLE_SQL,
 assertCfbPilotProtectedEnv,validateCfbPilotAggregateRows,
 auditCfbNeonHistoricalFinanceRowPilot,
} from '../scripts/audit-cfb-864-neon-senate-finance-row-pilot.js';

const KEY='DUMMY_PRIVATE_NEON_TEST_KEY';
const PW='DUMMY_SQL_PASSWORD';
const PROJECT='blue-owl-12345',BR='br-quiet-moon-111',EP='ep-brisk-stream-123';
const HOST=EP+'.us-east-2.aws.neon.tech';
const ROOT='https://console.neon.tech/api/v2/projects/'+PROJECT;
const URI='postgresql://neondb_owner:'+PW+'@'+HOST+'/neondb?sslmode=require&channel_binding=require';
const settings={apiKey:KEY,projectId:PROJECT};
async function fakeNeon(url:string,init:RequestInit){
 assert.equal(init.method,'GET');
 assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+KEY);
 let response:unknown;
 if(url===ROOT)response={project:{id:PROJECT,name:'VotePredict'}};
 else if(url===ROOT+'/branches?limit=100')
  response={branches:[{id:BR,project_id:PROJECT,default:true}],pagination:{next:null}};
 else if(url===ROOT+'/branches/'+BR+'/databases')
  response={databases:[{name:'neondb',branch_id:BR,owner_name:'neondb_owner'}]};
 else if(url===ROOT+'/endpoints')
  response={endpoints:[{id:EP,project_id:PROJECT,branch_id:BR,type:'read_write',host:HOST}]};
 else if(url.startsWith(ROOT+'/connection_uri?'))response={uri:URI};
 else throw Error('Not a previously reviewed Neon management GET');
 return new Response(JSON.stringify(response),{status:200});
}
const sampleRow={
 year:'2024',family:'campaign_finance_candidate_contribution_bulk',
 sampled_evidence_rows:'64',sampled_source_documents_with_rows:'1',
 senate_linked_rows:'12',senate_metadata_only_rows:'2',
 senate_eligible_claims:'8',senate_eligible_missing_due_on:'6',
 senate_eligible_missing_disclosed_on:'7',senate_eligible_filing_derived_flag:'3',
};

test('SQL is a fixed, bounded, source-document-indexed SELECT with no raw rows or dynamic queries',()=>{
 const sql=FIXED_FINANCE_SAMPLE_SQL;
 assert.match(sql,/^SELECT /);
 assert.match(sql,/FROM source_documents/);
 assert.match(sql,/WHERE ei.source_document_id=sd.id/);
 assert.match(sql,/LIMIT 500/);
 assert.match(sql,/LIMIT 64/);
 assert.match(sql,/count\(\*\) FILTER/);
 assert.match(sql,/GROUP BY 1,2 ORDER BY 1,2/);
 assert.doesNotMatch(sql,/,\s+FROM/,'Never allow dangling SELECT projection comma');
 assert.match(sql,/LEFT JOIN memberships/);
 assert.match(sql,/c.slug='senate'/);
 assert.doesNotMatch(sql,/;\s*|\b(?:RETURNING|INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|COPY|GRANT|REVOKE|CREATE|pg_sleep)\b|SELECT \*/i);
 assert.equal(FINANCE_FAMILIES.length,4);
 assert.equal(CFB_864_ROW_PILOT_MARKER,'SENATE_864_CFB_ROWS_READONLY_20261011_V1');
});
test('safe private-metadata count validator denies source rows, donor names, private URLs, unbounded counts',()=>{
 assert.deepEqual(validateCfbPilotAggregateRows([sampleRow]),[sampleRow]);
 for(const item of [
  {...sampleRow,year:'2026'},
  {...sampleRow,family:'unknown'},
  {...sampleRow,senate_eligible_claims:'65'},
  {...sampleRow,sampled_evidence_rows:'32001'},
  {...sampleRow,sampled_source_documents_with_rows:'501'},
  {...sampleRow,senate_linked_rows:12},
  {...sampleRow,recipient_name:'Private Donor'},
  {...sampleRow,privateUrl:'https://private.invalid/abc'},
  {...sampleRow,sampled_source_documents_with_rows:'65'},
 ]){
  assert.throws(()=>validateCfbPilotAggregateRows([item]));
 }
 assert.throws(()=>validateCfbPilotAggregateRows([sampleRow,sampleRow]));
});
test('protected pilot requires reviewed exact-main push first attempt and fixed approval',()=>{
 const pass={
  GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),
  VOTEPREDICT_864_CFB_ROW_PILOT_APPROVAL:'METADATA_AGGREGATE_PREFIX_SAMPLE_ONLY',
  VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED:'true',
  VOTEPREDICT_864_CFB_ROW_PILOT_MARKER_PRESENT:'true',
 };
 assert.doesNotThrow(()=>assertCfbPilotProtectedEnv(pass));
 for(const [key,value] of [
  ['GITHUB_REPOSITORY','attacker/other'],
  ['GITHUB_EVENT_NAME','pull_request'],
  ['GITHUB_REF','refs/heads/other'],
  ['GITHUB_RUN_ATTEMPT','2'],
  ['GITHUB_SHA','not-a-sha'],
  ['VOTEPREDICT_864_CFB_ROW_PILOT_APPROVAL',''],
  ['VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED','false'],
  ['VOTEPREDICT_864_CFB_ROW_PILOT_MARKER_PRESENT','false'],
 ])assert.throws(()=>assertCfbPilotProtectedEnv({...pass,[key]:value}));
});
test('fake existing VotePredict key stays private: one read-only transaction, bounded aggregated SELECT, mandatory rollback',async()=>{
 let released=0,ended=0;const statements:string[]=[];
 const pool=(opts:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(opts?.host,HOST);
  assert.equal(opts?.user,'neondb_owner');
  assert.equal(opts?.password,PW);
  assert.deepEqual(opts?.ssl,{rejectUnauthorized:true});
  assert.match(String(opts?.options),/default_transaction_read_only=on/);
  return {
   connect:async()=>({
    query:async(sql:string)=>{
     statements.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
     if(sql.includes('current_database()'))
      return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
     if(sql===FIXED_FINANCE_SAMPLE_SQL)return {rows:[sampleRow]};
     throw Error('Unexpected SQL: never query raw private stored rows');
    },
    release:()=>{released++},
   }),
   end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const result=await auditCfbNeonHistoricalFinanceRowPilot(settings,fakeNeon,pool);
 assert.equal(result.rows.length,1);
 assert.deepEqual(result.rows[0],sampleRow);
 assert.equal(result.sampledOnlyNotCensus,true);
 assert.equal(result.sampleMayOmitLaterEvidenceRows,true);
 assert.equal(result.fullSourceToPersistedRowReconciliationCompleted,false);
 assert.equal(result.candidateTransactionVersionContainmentAudited,false);
 assert.equal(result.privateRowsNamesDonorsAndAmountsExported,false);
 assert.equal(result.mandatoryRollbackComplete,true);
 assert.equal(result.productionMutations,0);
 assert.equal(statements.length,4);
 assert.equal(statements[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(statements.at(-1),'ROLLBACK');
 assert.equal(released,1);
 assert.equal(ended,1);
 assert.doesNotMatch(JSON.stringify(result),/DUMMY_PRIVATE|neondb_owner|brisk-stream/);
});
test('private SQL role identity mismatch blocks all finance SELECTs, still rolls back',async()=>{
 let calls:string[]=[];
 const pool=()=>({
  connect:async()=>({query:async(sql:string)=>{
   calls.push(sql);
   if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('current_database()'))return {rows:[{db:'wrong',role:'neondb_owner',ro:'on'}]};
   throw Error('Finance evidence SELECT must not run after identity failure');
  },release:()=>{}}),end:async()=>{},
 }) as unknown as Pick<Pool,'connect'|'end'>;
 await assert.rejects(()=>auditCfbNeonHistoricalFinanceRowPilot(settings,fakeNeon,pool));
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.equal(calls.includes(FIXED_FINANCE_SAMPLE_SQL),false);
});
test('dedicated pilot CI never exposes protected Neon key on PR and never persists details',()=>{
 const wf=readFileSync('.github/workflows/senate-864-finance-row-readonly-pilot.yml','utf8');
 assert.match(wf,/environment: evidence-readonly-sandbox/);
 assert.match(wf,/one-shot-verify:/);
 assert.match(wf,/one-shot-readonly:/);
 assert.match(wf,/github\.run_attempt == 1/);
 assert.match(wf,/SENATE_864_CFB_ROWS_READONLY_20261011_V1/);
 assert.match(wf,/node --import tsx scripts\/verify-cfb-864-neon-finance-row-pilot-local\.ts/);
 assert.match(wf,/npm run check/);
 assert.match(wf,/actions\/github-script@v8/);
 const nonSecret=wf.split('  one-shot-readonly:\n')[0];
 assert.doesNotMatch(nonSecret,/secrets\.NEON_API_KEY/);
 const withSecret=wf.split('  one-shot-readonly:\n')[1]?.split('  publish-sanitized-pilot:\n')[0]??'';
 assert.match(withSecret,/secrets\.NEON_API_KEY/);
 assert.doesNotMatch(withSecret,/issues: write/);
 const publisher=wf.split('  publish-sanitized-pilot:\n')[1]??'';
 assert.match(publisher,/issues: write/);
 assert.doesNotMatch(publisher,/secrets\.NEON_API_KEY|NEON_API_KEY:/);
 assert.doesNotMatch(wf,/^\s*schedule:/m);
 assert.doesNotMatch(wf,/actions\/upload-artifact/);
});

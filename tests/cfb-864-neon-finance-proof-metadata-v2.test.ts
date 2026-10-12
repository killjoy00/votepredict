import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Pool} from 'pg';
import {
 CFB_864_KEYS_V2_MARKER,FINANCE_FAMILIES,POLICY_BUCKETS,COUNT_KEYS,
 FIXED_FINANCE_V2_SQL,validateFinanceV2Rows,assertFinanceV2ProtectedEnv,
 auditCfbNeonFinanceMetadataV2,
} from '../scripts/audit-cfb-864-neon-finance-proof-metadata-v2.js';
import type {SafeFinanceV2Row} from
 '../scripts/audit-cfb-864-neon-finance-proof-metadata-v2.js';

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
 else throw Error('Unexpected management request');
 return new Response(JSON.stringify(response),{status:200});
}
const sampleRow={
 year:'2024',family:'campaign_finance_candidate_contribution_bulk',
 version_bucket:'v7',
 ...Object.fromEntries(COUNT_KEYS.map(k=>[k,'0'])),
 senate_rows:'20',eligible_claims:'12',
 eligible_published_at:'11',eligible_metadata_available_on:'10',
 eligible_published_and_available_on:'9',eligible_date_disagreement:'1',
 eligible_neither_timing_field:'0',
 eligible_report_due_on:'0',eligible_legacy_due_on:'3',
 eligible_filed_on:'5',eligible_disclosed_on:'0',
 eligible_filing_derived:'7',eligible_source_label_direct_disclosure:'0',
 eligible_any_report_locator:'8',eligible_any_proof_url:'1',
 eligible_any_proof_digest:'1',eligible_row_key:'12',
} as SafeFinanceV2Row;

test('fixed V2 query preserves the V1 source prefix, counts only Senate, pivots only approved metadata',()=>{
 const sql=FIXED_FINANCE_V2_SQL;
 assert.match(sql,/^SELECT year, family, version_bucket/);
 assert.match(sql,/FROM source_documents/);
 assert.match(sql,/WHERE ei.source_document_id=sd.id/);
 assert.match(sql,/ORDER BY source_kind,id LIMIT 500/);
 assert.match(sql,/ORDER BY ei.created_at,ei.id LIMIT 64/);
 assert.match(sql,/LEFT JOIN memberships/);
 assert.match(sql,/WHERE chamber='senate'/);
 assert.match(sql,/GROUP BY 1,2,3 ORDER BY 1,2,3/);
 assert.match(sql,/published_at/);
 assert.match(sql,/availabilityPolicyVersion/);
 assert.match(sql,/unknown_or_outside/);
 assert.match(sql,/other_or_unrecognized/);
 assert.match(sql,/count\(\*\) FILTER/);
 assert.equal(FINANCE_FAMILIES.length,4);
 assert.equal(POLICY_BUCKETS.length,5);
 assert.equal(COUNT_KEYS.length,17);
 assert.equal(CFB_864_KEYS_V2_MARKER,'SENATE_864_CFB_KEYS_READONLY_20261012_V2');
 assert.doesNotMatch(sql,/;\s*|\b(?:RETURNING|INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|COPY|GRANT|REVOKE|CREATE|pg_sleep)\b|SELECT \*/i);
});
test('aggregate results reject any private label, version string, keys, URLs or out-of-bound counts',()=>{
 assert.deepEqual(validateFinanceV2Rows([sampleRow]),[sampleRow]);
 for(const invalid of [
  {...sampleRow,year:'2026'},
  {...sampleRow,family:'other'},
  {...sampleRow,version_bucket:'mn-cfb-report-availability-v9'},
  {...sampleRow,version_bucket:'unknown real value'},
  {...sampleRow,eligible_claims:'21'},
  {...sampleRow,eligible_filed_on:'13'},
  {...sampleRow,eligible_date_disagreement:'10'},
  {...sampleRow,senate_rows:'32001'},
  {...sampleRow,eligible_row_key:12},
  {...sampleRow,source_url:'https://private.example/abc'},
  {...sampleRow,person_name:'Synthetic Private Name'},
  {...sampleRow,senate_rows:'-1'},
 ]){
  assert.throws(()=>validateFinanceV2Rows([invalid]));
 }
 assert.throws(()=>validateFinanceV2Rows([sampleRow,sampleRow]));
});
test('protected first-attempt exact-main push requires dedicated fixed second-run authorization',()=>{
 const pass={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),
  VOTEPREDICT_864_CFB_KEYS_V2_APPROVAL:'METADATA_KEY_PRESENCE_AGGREGATE_ONLY',
  VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED:'true',
  VOTEPREDICT_864_CFB_KEYS_V2_MARKER_PRESENT:'true',
 };
 assert.doesNotThrow(()=>assertFinanceV2ProtectedEnv(pass));
 const verifiedOwnerComment={...pass,
  GITHUB_EVENT_NAME:'issue_comment',
  VOTEPREDICT_864_CFB_KEYS_V2_OWNER_COMMENT_VERIFIED:'true',
 };
 assert.doesNotThrow(()=>assertFinanceV2ProtectedEnv(verifiedOwnerComment));
 assert.throws(()=>assertFinanceV2ProtectedEnv({
  ...verifiedOwnerComment,VOTEPREDICT_864_CFB_KEYS_V2_OWNER_COMMENT_VERIFIED:'false',
 }));
 assert.throws(()=>assertFinanceV2ProtectedEnv({
  ...pass,GITHUB_EVENT_NAME:'issue_comment',
 }));

 for(const [key,value] of [
  ['GITHUB_REPOSITORY','attacker/other'],
  ['GITHUB_EVENT_NAME','pull_request'],
  ['GITHUB_REF','refs/heads/other'],
  ['GITHUB_RUN_ATTEMPT','2'],
  ['GITHUB_SHA','not-a-sha'],
  ['VOTEPREDICT_864_CFB_KEYS_V2_APPROVAL',''],
  ['VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED','false'],
  ['VOTEPREDICT_864_CFB_KEYS_V2_MARKER_PRESENT','false'],
 ])
  assert.throws(()=>assertFinanceV2ProtectedEnv({...pass,[key]:value}));
});
test('fake existing default Neon branch: one fixed aggregate SQL, read-only transaction, rollback',async()=>{
 const statements:string[]=[];let released=0,ended=0;
 const pool=(opts:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(opts?.host,HOST);assert.equal(opts?.user,'neondb_owner');
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
     if(sql===FIXED_FINANCE_V2_SQL)return {rows:[sampleRow]};
     throw Error('Private SELECT not approved');
    },release:()=>{released++},
   }),end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const outcome=await auditCfbNeonFinanceMetadataV2(settings,fakeNeon,pool);
 assert.deepEqual(outcome.rows,[sampleRow]);
 assert.equal(outcome.sourcePrefixSampleNotCensus,true);
 assert.equal(outcome.sampleMembershipLinksNotIndependentRoster,true);
 assert.equal(outcome.noReportVersionPublicationProven,true);
 assert.equal(outcome.noTransactionRowContainmentProven,true);
 assert.equal(outcome.noFilingDutyDenominatorEstablished,true);
 assert.equal(outcome.storedEligibilityNotRepaired,true);
 assert.equal(outcome.productionWrites,0);
 assert.equal(outcome.rollbackComplete,true);
 assert.equal(statements.length,4);
 assert.equal(statements[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(statements.at(-1),'ROLLBACK');
 assert.equal(released,1);assert.equal(ended,1);
 assert.doesNotMatch(JSON.stringify(outcome),/DUMMY_PRIVATE|neondb_owner|brisk-stream|SECRET/);
});
test('private SQL failure and mismatched DB identity roll back without leaking private error',async()=>{
 const calls:string[]=[];
 const pool=()=>({
  connect:async()=>({query:async(sql:string)=>{
   calls.push(sql);
   if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('current_database()'))return {rows:[{db:'wrong',role:'neondb_owner',ro:'on'}]};
   throw Error('Private query prohibited');
  },release:()=>{}}),end:async()=>{},
 }) as unknown as Pick<Pool,'connect'|'end'>;
 await assert.rejects(()=>auditCfbNeonFinanceMetadataV2(settings,fakeNeon,pool));
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.equal(calls.includes(FIXED_FINANCE_V2_SQL),false);
});
test('V2 Actions gate: PR keyless, exact SHA verified, one-shot protected, keyless issue reporter',()=>{
 const wf=readFileSync('.github/workflows/senate-864-finance-proof-metadata-v2.yml','utf8');
 assert.match(wf,/environment: evidence-readonly-sandbox/);
 assert.match(wf,/issue_comment:\n    types: \[created\]/);
 assert.match(wf,/github\.event\.issue\.number == 864/);
 assert.match(wf,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(wf,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(wf,/SENATE_864_CFB_KEYS_V2_OWNER_ONE_SHOT_20261012/);
 assert.match(wf,/git log -1 --format=%B \| grep -Fq/);
 assert.match(wf,/VOTEPREDICT_864_CFB_KEYS_V2_OWNER_COMMENT_VERIFIED:/);

 assert.match(wf,/one-shot-verify:/);
 assert.match(wf,/one-shot-readonly:/);
 assert.match(wf,/github\.run_attempt == 1/);
 assert.match(wf,/SENATE_864_CFB_KEYS_READONLY_20261012_V2/);
 assert.match(wf,/node --import tsx scripts\/verify-cfb-864-neon-finance-proof-metadata-v2-local\.ts/);
 assert.match(wf,/npm run check/);
 assert.match(wf,/actions\/github-script@v8/);
 const pre=wf.split('  one-shot-readonly:\n')[0];
 assert.doesNotMatch(pre,/secrets\.NEON_API_KEY/);
 const protectedSection=wf.split('  one-shot-readonly:\n')[1]?.split('  publish-sanitized-v2:\n')[0]??'';
 assert.match(protectedSection,/secrets\.NEON_API_KEY/);
 assert.doesNotMatch(protectedSection,/issues: write/);
 const report=wf.split('  publish-sanitized-v2:\n')[1]??'';
 assert.match(report,/issues: write/);
 assert.match(report,/Unexpected private top-level field/);
 assert.match(report,/Object\.keys\(data\)\.some\(k=>!topKeys\.has\(k\)\)/);
 assert.doesNotMatch(report,/secrets\.NEON_API_KEY|NEON_API_KEY:/);
 assert.doesNotMatch(wf,/^\s*schedule:/m);
 assert.doesNotMatch(wf,/actions\/upload-artifact/);
});

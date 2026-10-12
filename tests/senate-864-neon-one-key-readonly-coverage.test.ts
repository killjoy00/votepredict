import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Pool} from 'pg';
import {
 GROUPS,QUERIES,REQUIRED_864_TABLES,ONE_SHOT_MARKER,
 validateCountRows,assertProtectedOneShot,auditNeonExistingKey2021To25,
 safeSqlFailureReason,
} from '../scripts/audit-senate-864-neon-one-key-readonly-coverage.js';

const ID='blue-owl-12345',BR='br-quiet-moon-111',EP='ep-brisk-stream-123';
const HOST=EP+'.us-east-2.aws.neon.tech';
const KEY='DUMMY_PRIVATE_NEON_TEST_KEY',PW='DUMMY_PRIVATE_SQL_PASSWORD';
const BASE='https://console.neon.tech/api/v2/projects/'+ID;
const URI='postgresql://neondb_owner:'+PW+'@'+HOST+'/neondb?sslmode=require&channel_binding=require';
const conf={apiKey:KEY,projectId:ID};
async function fakeNeon(url:string,init:RequestInit){
 assert.equal(init.method,'GET');
 assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+KEY);
 let body:unknown;
 if(url===BASE)body={project:{id:ID,name:'VotePredict'}};
 else if(url===BASE+'/branches?limit=100')body={branches:[{id:BR,project_id:ID,default:true}],pagination:{next:null}};
 else if(url===BASE+'/branches/'+BR+'/databases')body={databases:[{name:'neondb',branch_id:BR,owner_name:'neondb_owner'}]};
 else if(url===BASE+'/endpoints')body={endpoints:[{id:EP,project_id:ID,branch_id:BR,type:'read_write',host:HOST}]};
 else if(url.startsWith(BASE+'/connection_uri?'))body={uri:URI};
 else throw Error('Unexpected Neon API action');
 return new Response(JSON.stringify(body),{status:200});
}
const protectedEnv={
 GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',
 GITHUB_REF:'refs/heads/main',GITHUB_SHA:'f'.repeat(40),GITHUB_RUN_ATTEMPT:'1',
 VOTEPREDICT_864_APPROVAL:'BOUNDED_COUNTS_ONLY',
 VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED:'true',
 VOTEPREDICT_864_ONE_SHOT_MARKER_PRESENT:'true',
};
test('protected one-shot can use existing GitHub Neon key only after immutable reviewed main CI',()=>{
 assert.doesNotThrow(()=>assertProtectedOneShot(protectedEnv));
 for(const [key,val] of [
  ['GITHUB_REPOSITORY','attacker/other'],
  ['GITHUB_EVENT_NAME','pull_request'],
  ['GITHUB_REF','refs/heads/research'],
  ['GITHUB_SHA','not-a-revision'],
  ['GITHUB_RUN_ATTEMPT','2'],
  ['VOTEPREDICT_864_APPROVAL',''],
  ['VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED','false'],
  ['VOTEPREDICT_864_ONE_SHOT_MARKER_PRESENT','false'],
 ]){
  assert.throws(()=>assertProtectedOneShot({...protectedEnv,[key]:val}));
 }
 assert.equal(ONE_SHOT_MARKER,'SENATE_864_EXISTING_NEON_KEY_COUNTS_ONESHOT_20261011_V3');
});
test('only seven precisely fixed bounded aggregate SELECTs; no live updates/export/free-form SQL',()=>{
 assert.deepEqual([...GROUPS],[
  'roster','finance','committeeSources','committeeVotes','committeeChoices','campaign','media',
 ]);
 assert.equal(REQUIRED_864_TABLES.length,8);
 for(const [name,sql] of Object.entries(QUERIES)){
  assert.match(sql,/^SELECT\s/i,name);
  assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|SET|CALL|DO)\b/i,name);
  assert.doesNotMatch(sql,/;/,name);
  assert.match(sql,/\bGROUP BY\b/i,name);
 }
 const f=QUERIES.finance;
 assert.match(f,/metadata->>'asOfEligible'/);
 assert.match(f,/claim.*eligible/i);
 assert.match(QUERIES.media,/wayback_local_trade_news/);
 assert.match(QUERIES.committeeVotes,/committeeVote/);
 assert.match(QUERIES.committeeChoices,/normalized_member_name/);
 assert.match(QUERIES.roster,/generate_series\(2021,2025\)/);
});
test('aggregate-only result validator rejects row bodies, source URLs, identity values, malformed years, bad counts and duplicates',()=>{
 assert.deepEqual(validateCountRows('roster',[
  {year:'2023',people:'67',memberships:'67',memberships_missing_date_boundary:'12'},
 ]),[{year:'2023',people:'67',memberships:'67',memberships_missing_date_boundary:'12'}]);
 assert.deepEqual(validateCountRows('finance',[
  {year:'2024',family:'campaign_finance_bulk',evidence_rows:'8'},
 ]),[{year:'2024',family:'campaign_finance_bulk',evidence_rows:'8'}]);
 for(const bad of [
  [{year:'2023',people:'1',name:'Senator Named'}],
  [{year:'2023',people:12}],
  [{year:'2023',people:'-1'}],
  [{year:'2023',private_source_url:'https://example.org'}],
  [{year:'2023',source_sha:'a'.repeat(64)}],
  [{year:'2023',people:'1.0'}],
  [{year:'2023',people:'100000001'}],
  [{year:'2023',people:'2'},{year:'2023',people:'3'}],
  [{year:'bad',people:'1'}],
 ]){
  assert.throws(()=>validateCountRows('roster',bad));
 }
 assert.throws(()=>validateCountRows('finance',[{year:'2023',family:'unverified',evidence_rows:'2'}]));
});
test('same established management key: five API GETs and one read-only rolled-back SQL transaction, all seven source groups',async()=>{
 const queries:string[]=[];const stages:string[]=[];
 let release=0,end=0,seen=0;
 const fakePool=(options:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(options?.user,'neondb_owner');
  assert.equal(options?.password,PW);
  assert.equal(options?.host,HOST);
  assert.deepEqual(options?.ssl,{rejectUnauthorized:true});
  assert.match(String(options?.options),/default_transaction_read_only=on/);
  return {
   connect:async()=>({
    query:async(sql:string,params?:unknown[])=>{
     queries.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
     if(sql.includes('current_database()'))
      return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
     if(sql.includes('to_regclass')){
      assert.deepEqual(params?.[0],REQUIRED_864_TABLES);
      return {rows:[...REQUIRED_864_TABLES].map(name=>({table_name:name,present:true,readable:true}))};
     }
     const slot=Object.entries(QUERIES).find(([,v])=>v===sql);
     if(slot){seen++;return {rows:slot[0]==='finance'
       ?[{year:'2023',family:'campaign_finance_bulk',evidence_rows:'13'}]
       :[{year:'2023',context_rows:'22',source_rows:'3'}]};}
     throw Error('Unexpected attempted SQL statement');
    },
    release:()=>{release++},
   }),
   end:async()=>{end++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const report=await auditNeonExistingKey2021To25(conf,fakeNeon,fakePool,p=>stages.push(p));
 assert.equal(report.issue,864);
 assert.equal(report.currentTransactionReadOnly,true);
 assert.equal(report.originalSqlRoleMayHaveWriteGrantsOutsideReadOnlyTransaction,true);
 assert.equal(report.transactionRollbackCompleted,true);
 assert.equal(report.fullPerSourceRowReconciliationCompleted,false);
 assert.equal(report.historicalCompletenessCertified,false);
 assert.equal(report.privateOriginalRowsAndNamesExported,false);
 assert.equal(report.groups.finance[0].evidence_rows,'13');
 assert.equal(Object.values(report.groups).length,7);
 assert.equal(queries[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(queries.at(-1),'ROLLBACK');
 assert.equal(seen,7);assert.equal(release,1);assert.equal(end,1);
 assert.ok(stages.includes('verified_existing_neon_project_branch_and_database'));
 assert.equal(stages.at(-1),'rolled_back');
 assert.doesNotMatch(JSON.stringify(report),new RegExp(KEY+'|'+PW+'|'+HOST));
});
test('unsafe identity or missing VotePredict relations means NO evidence SELECT and always rollback',async()=>{
 for(const scenario of ['wrongDB','missingTable']){
  const calls:string[]=[];let close=0;
  const pool=()=>({
   connect:async()=>({
    query:async(sql:string)=>{
     calls.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
     if(sql.includes('current_database()'))return {rows:[{
      db:scenario==='wrongDB'?'anotherdb':'neondb',role:'neondb_owner',ro:'on'}]};
     if(sql.includes('to_regclass'))return {rows:REQUIRED_864_TABLES.slice(0,7)
      .map(name=>({table_name:name,present:true,readable:true}))};
     throw Error('No evidence SELECT should execute after failed preflight');
    },
    release:()=>{},
   }),
   end:async()=>{close++},
  }) as unknown as Pick<Pool,'connect'|'end'>;
  await assert.rejects(()=>auditNeonExistingKey2021To25(conf,fakeNeon,pool));
  assert.equal(calls.at(-1),'ROLLBACK');
  assert.equal(close,1);
  assert.ok(calls.length<=4);
 }
});
test('workflow cannot use existing key on PR, unmarked main push or failed independent CI',()=>{
 const yml=readFileSync('.github/workflows/senate-864-existing-neon-key-cross-track-counts.yml','utf8');
 assert.match(yml,/evidence-readonly-sandbox/);
 assert.match(yml,/secrets\.NEON_API_KEY/);
 assert.match(yml,/vars\.VOTEPREDICT_NEON_PROJECT_ID/);
 assert.match(yml,/github\.ref == 'refs\/heads\/main'/);
 assert.match(yml,/github\.run_attempt == 1/);
 assert.match(yml,/one-shot-verify/);
 assert.match(yml,/one-shot-readonly/);
 assert.match(yml,/cancel-in-progress: false/);
 assert.match(yml,/persist-credentials: false/);
 assert.match(yml,/SENATE_864_EXISTING_NEON_KEY_COUNTS_ONESHOT_20261011_V3/);
 assert.doesNotMatch(yml,/github\.event_name == 'pull_request' && needs/);
 assert.doesNotMatch(yml,/^\s+schedule:/m);
 assert.doesNotMatch(yml,/actions\/upload-artifact/);
 assert.doesNotMatch(yml,/DATABASE_URL_UNPOOLED: \${{ secrets/);
});


test('safe aggregate receipt: keyless issue-write job only, fail-closed status and decoded integer-only fields',()=>{
 const yaml=readFileSync('.github/workflows/senate-864-existing-neon-key-cross-track-counts.yml','utf8');
 assert.match(yaml,/publish-sanitized-counts:/);
 const parts=yaml.split('  publish-sanitized-counts:\n');
 assert.equal(parts.length,2);
 const [keyed,report]=parts;
 assert.match(keyed,/environment: evidence-readonly-sandbox/);
 assert.match(keyed,/public_counts_b64: \$\{\{ steps\.audit\.outputs\.public_counts_b64 \}\}/);
 assert.match(keyed,/id: audit/);
 assert.match(report,/needs: \[one-shot-verify, one-shot-readonly\]/);
 assert.match(report,/needs\.one-shot-verify\.result == 'success'/);
 assert.match(report,/needs\.one-shot-readonly\.result == 'failure'/);
 assert.match(report,/issues: write/);
 assert.match(report,/actions\/github-script@v8/);
 assert.match(report,/JSON\.parse\(Buffer\.from\(encoded,'base64'\)\.toString\('utf8'\)\)/);
 assert.match(report,/currentTransactionReadOnly!==true/);
 assert.match(report,/transactionRollbackCompleted!==true/);
 assert.match(report,/privateOriginalRowsAndNamesExported!==false/);
 assert.match(report,/productionMutations!==0/);
 assert.match(report,/SANITIZED_AGGREGATE_B64|SAFE_COUNTS_B64/);
 assert.doesNotMatch(report,/secrets\.NEON_API_KEY|VOTEPREDICT_NEON_PROJECT_ID/);
 assert.doesNotMatch(report,/environment: evidence-readonly-sandbox/);
 assert.doesNotMatch(report,/DATABASE_URL_UNPOOLED|pg\.Pool|psql|NEON_API_KEY:/);
 assert.doesNotMatch(keyed,/issues: write/);
 const audit=readFileSync('scripts/audit-senate-864-neon-one-key-readonly-coverage.ts','utf8');
 assert.match(audit,/GITHUB_OUTPUT/);
 assert.match(audit,/public_counts_b64/);
 assert.match(audit,/failure_phase/);
 assert.match(audit,/JSON\.stringify\(audit\)/);
 assert.doesNotMatch(audit,/github\.rest\.issues\.createComment/);
});


test('known finance expensive cross-chamber OR scan is replaced by a bounded indexed actual Senate membership subset',()=>{
 const sql=QUERIES.finance;
 assert.match(sql,/FROM memberships m JOIN chambers c ON c\.id=m\.chamber_id/);
 assert.match(sql,/JOIN evidence_items ei ON ei\.membership_id=m\.id/);
 assert.match(sql,/JOIN source_documents sd ON sd\.id=ei\.source_document_id/);
 assert.match(sql,/WHERE c\.slug='senate'/);
 assert.match(sql,/s\.slug IN \('2021-2022','2023-2024','2025-2026'\)/);
 assert.match(sql,/GROUP BY 1,2 ORDER BY 1,2/);
 assert.doesNotMatch(sql,/OR ei\.metadata->>'chamber'='senate'/);
 assert.match(sql,/metadata->>'availabilityProofContentSha256'/);
});
test('only fixed non-sensitive SQLSTATE error classifications are permitted to escape failed query path',()=>{
 assert.equal(safeSqlFailureReason({code:'57014',message:'private.example.com'}),'statement_timeout');
 assert.equal(safeSqlFailureReason({code:'42703',message:'postgres://secret'}),'undefined_column');
 assert.equal(safeSqlFailureReason({code:'42803'}),'aggregate_grouping');
 assert.equal(safeSqlFailureReason({code:'42601'}),'sql_syntax');
 assert.equal(safeSqlFailureReason({code:'22P02'}),'invalid_input');
 assert.equal(safeSqlFailureReason(new Error('private data')),'unknown_query_or_validation');
});
test('safe issue receipt requires finance to declare its limited membership-linked scope',()=>{
 const workflow=readFileSync('.github/workflows/senate-864-existing-neon-key-cross-track-counts.yml','utf8');
 assert.match(workflow,/financeQueryOnlyExplicitHistoricSenateMembershipLinkedEvidence!==true/);
 assert.match(workflow,/unlinkedAndMetadataOnlyFinanceEvidenceNotAuditedInThisSnapshot!==true/);
 assert.match(workflow,/unlinked finance metadata rows were not audited/);
 const source=readFileSync('scripts/audit-senate-864-neon-one-key-readonly-coverage.ts','utf8');
 assert.match(source,/financeQueryOnlyExplicitHistoricSenateMembershipLinkedEvidence:true/);
 assert.match(source,/fullStatewideFinanceDatabaseCompletenessNotEstablished:true/);
 assert.match(source,/failed_.*safeSqlFailureReason\(error\)/s);
});

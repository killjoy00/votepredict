import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Pool} from 'pg';
import {
 CFB_864_ARCHIVE_V3_MARKER,FAMILIES,POLICIES,METRICS,
 FIXED_ARCHIVE_V3_SQL,validateArchiveV3Aggregates,assertArchiveV3MainOnly,
 auditCfbFinanceArchiveV3,
} from '../scripts/audit-cfb-864-neon-finance-archive-upperbound-v3.js';
import type {ArchiveV3Row} from
 '../scripts/audit-cfb-864-neon-finance-archive-upperbound-v3.js';
const KEY='SYNTHETIC_NEON_TOKEN',PW='SYNTHETIC_SQL_PASSWORD';
const PROJECT='blue-owl-12345',BR='br-quiet-moon-111',EP='ep-brisk-stream-123';
const HOST=EP+'.us-east-2.aws.neon.tech';
const ROOT='https://console.neon.tech/api/v2/projects/'+PROJECT;
const URI='postgresql://neondb_owner:'+PW+'@'+HOST+'/neondb?sslmode=require&channel_binding=require';
const connection={apiKey:KEY,projectId:PROJECT};
async function fakeNeon(url:string,init:RequestInit){
 assert.equal(init.method,'GET');
 assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+KEY);
 let answer:unknown;
 if(url===ROOT)answer={project:{id:PROJECT,name:'VotePredict'}};
 else if(url===ROOT+'/branches?limit=100')
  answer={branches:[{id:BR,project_id:PROJECT,default:true}],pagination:{next:null}};
 else if(url===ROOT+'/branches/'+BR+'/databases')
  answer={databases:[{name:'neondb',branch_id:BR,owner_name:'neondb_owner'}]};
 else if(url===ROOT+'/endpoints')
  answer={endpoints:[{id:EP,project_id:PROJECT,branch_id:BR,type:'read_write',host:HOST}]};
 else if(url.startsWith(ROOT+'/connection_uri?'))answer={uri:URI};
 else throw Error('Unexpected Neon GET');
 return new Response(JSON.stringify(answer),{status:200});
}
const sample={
 year:'2021',family:'campaign_finance_candidate_contribution_bulk',
 policy_bucket:'missing',
 ...Object.fromEntries(METRICS.map(x=>[x,'0'])),
 senate_rows:'26',eligible_claims:'20',
 archive_exact_row_claim:'18',candidate_archive_status:'18',
 candidate_upperbound_marker:'18',archive_captured_at:'18',archive_digest:'18',
 available_at:'18',archive_proof_url:'20',archived_source_url:'18',
 upper_bound_flag:'18',first_publication_not_known:'18',
 complete_archive_keyset:'18',archive_day_agrees_with_stored:'18',
} as ArchiveV3Row;

test('static SQL is exactly bounded 500x64, archived metadata presence counts only',()=>{
 const sql=FIXED_ARCHIVE_V3_SQL;
 assert.match(sql,/^SELECT year, family, policy_bucket,/);
 assert.match(sql,/FROM source_documents/);
 assert.match(sql,/ORDER BY source_kind,id LIMIT 500/);
 assert.match(sql,/WHERE ei.source_document_id=sd.id/);
 assert.match(sql,/ORDER BY ei.created_at,ei.id LIMIT 64/);
 assert.match(sql,/WHERE chamber='senate'/);
 assert.match(sql,/GROUP BY 1,2,3 ORDER BY 1,2,3/);
 assert.match(sql,/archiveDigest/);
 assert.match(sql,/archiveCapturedAt/);
 assert.match(sql,/cfbCandidateBulkUpperBoundVersion/);
 assert.match(sql,/cfbIeLegacyBulkUpperBoundVersion/);
 assert.match(sql,/transactionDate/);
 assert.match(sql,/availabilityPolicyVersion/);
 assert.match(sql,/count\(\*\) FILTER/);
 assert.doesNotMatch(sql,/;\s*|\b(?:SELECT \*|RETURNING|INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|COPY|GRANT|REVOKE|CREATE|pg_sleep)\b/i);
 assert.equal(FAMILIES.length,4);
 assert.equal(POLICIES.length,5);
 assert.equal(METRICS.length,19);
 assert.equal(CFB_864_ARCHIVE_V3_MARKER,'SENATE_864_CFB_ARCHIVE_READONLY_20261012_V3');
});
test('public aggregate validator rejects private row fields, dates, malformed counts and invalid subsets',()=>{
 assert.deepEqual(validateArchiveV3Aggregates([sample]),[sample]);
 for(const invalid of [
  {...sample,year:'2026'},
  {...sample,policy_bucket:'mn-cfb-report-availability-v8'},
  {...sample,family:'synthetic_other'},
  {...sample,senate_rows:'32001'},
  {...sample,eligible_claims:'27'},
  {...sample,archive_digest:'21'},
  {...sample,complete_archive_keyset:'19'},
  {...sample,archive_day_agrees_with_stored:'19'},
  {...sample,archive_captured_at:18},
  {...sample,archive_original_url:'https://private.invalid/abc'},
  {...sample,row_key:'secret-synthetic-id'},
  {...sample,candidate_upperbound_marker:'-1'},
 ]){
  assert.throws(()=>validateArchiveV3Aggregates([invalid]));
 }
 assert.throws(()=>validateArchiveV3Aggregates([sample,sample]));
});
test('only reviewed exact-main first-run push or exact owner-confirmed comment is admitted',()=>{
 const pass={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),
  GITHUB_EVENT_NAME:'push',
  VOTEPREDICT_864_CFB_ARCHIVE_V3_APPROVAL:'ARCHIVE_METADATA_KEY_PRESENCE_COUNTS_ONLY',
  VOTEPREDICT_864_CFB_ARCHIVE_V3_CI_GREEN:'true',
  VOTEPREDICT_864_CFB_ARCHIVE_V3_MARKER_PRESENT:'true',
 };
 assert.doesNotThrow(()=>assertArchiveV3MainOnly(pass));
 assert.throws(()=>assertArchiveV3MainOnly({...pass,GITHUB_EVENT_NAME:'issue_comment'}));
 assert.doesNotThrow(()=>assertArchiveV3MainOnly({
  ...pass,GITHUB_EVENT_NAME:'issue_comment',
  VOTEPREDICT_864_CFB_ARCHIVE_V3_OWNER_COMMENT_VERIFIED:'true',
 }));
 for(const [key,v] of [
  ['GITHUB_REPOSITORY','wrong/repo'],['GITHUB_REF','refs/heads/dev'],
  ['GITHUB_RUN_ATTEMPT','2'],['GITHUB_SHA','bad'],
  ['GITHUB_EVENT_NAME','pull_request'],
  ['VOTEPREDICT_864_CFB_ARCHIVE_V3_APPROVAL',''],
  ['VOTEPREDICT_864_CFB_ARCHIVE_V3_CI_GREEN','false'],
  ['VOTEPREDICT_864_CFB_ARCHIVE_V3_MARKER_PRESENT','false'],
 ])assert.throws(()=>assertArchiveV3MainOnly({...pass,[key]:v}));
});
test('synthetic existing Neon default branch: exact aggregate-only SELECT and READ ONLY ROLLBACK',async()=>{
 let released=0,ended=0;const statements:string[]=[];
 const pool=(options:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(options?.host,HOST);assert.equal(options?.user,'neondb_owner');
  assert.equal(options?.password,PW);
  assert.deepEqual(options?.ssl,{rejectUnauthorized:true});
  assert.match(String(options?.options),/default_transaction_read_only=on/);
  return {
   connect:async()=>({query:async(sql:string)=>{
    statements.push(sql);
    if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('current_database()'))return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
    if(sql===FIXED_ARCHIVE_V3_SQL)return {rows:[sample]};
    throw Error('Unexpected private SQL');
   },release:()=>{released++}}),
   end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const result=await auditCfbFinanceArchiveV3(connection,fakeNeon,pool);
 assert.deepEqual(result.rows,[sample]);
 assert.equal(result.productionWrites,0);
 assert.equal(result.mandatoryRollbackComplete,true);
 assert.equal(result.archiveOriginalBytesIndependentlyAuthenticated,false);
 assert.equal(result.archiveExactRowContentIndependentlyReconciled,false);
 assert.equal(result.officialFilingDutyDenominatorEstablished,false);
 assert.equal(result.samePrefixSelectionRuleAsV2NotFrozenIdentities,true);
 assert.equal(result.issue864Open,true);
 assert.deepEqual(statements,[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
  FIXED_ARCHIVE_V3_SQL,'ROLLBACK',
 ]);
 assert.equal(released,1);assert.equal(ended,1);
 assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_NEON|neondb_owner|brisk-stream/);
});
test('session identity mismatch fails closed before archive SQL and rolls back',async()=>{
 const statements:string[]=[];
 const pool=()=>({
  connect:async()=>({query:async(sql:string)=>{
   statements.push(sql);
   if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('current_database()'))return {rows:[{db:'other',role:'neondb_owner',ro:'on'}]};
   throw Error('No unapproved SQL');
  },release:()=>{}}),end:async()=>{},
 }) as unknown as Pick<Pool,'connect'|'end'>;
 await assert.rejects(()=>auditCfbFinanceArchiveV3(connection,fakeNeon,pool));
 assert.equal(statements.at(-1),'ROLLBACK');
 assert.equal(statements.includes(FIXED_ARCHIVE_V3_SQL),false);
});
test('Actions workflow has owner/issue/cmd gate, exact main SHA, keyless PR, strict keyless receipt',()=>{
 const wf=readFileSync('.github/workflows/senate-864-finance-archive-upperbound-v3.yml','utf8');
 assert.match(wf,/environment: evidence-readonly-sandbox/);
 assert.match(wf,/issue_comment:\n    types: \[created\]/);
 assert.match(wf,/github\.event\.issue\.number == 864/);
 assert.match(wf,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(wf,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(wf,/SENATE_864_CFB_ARCHIVE_V3_OWNER_ONE_SHOT_20261012/);
 assert.match(wf,/SENATE_864_CFB_ARCHIVE_READONLY_20261012_V3/);
 assert.match(wf,/git log -1 --format=%B \| grep -Fq/);
 assert.match(wf,/npm run check/);
 assert.match(wf,/npm audit --omit=dev --audit-level=high/);
 const pre=wf.split('  one-shot-readonly:\n')[0];
 assert.doesNotMatch(pre,/secrets\.NEON_API_KEY/);
 const protectedSection=wf.split('  one-shot-readonly:\n')[1]?.split('  publish-sanitized-v3:\n')[0]??'';
 assert.match(protectedSection,/secrets\.NEON_API_KEY/);
 assert.doesNotMatch(protectedSection,/issues: write/);
 const report=wf.split('  publish-sanitized-v3:\n')[1]??'';
 assert.match(report,/issues: write/);
 assert.match(report,/Unexpected private top-level field/);
 assert.doesNotMatch(report,/secrets\.NEON_API_KEY|NEON_API_KEY:/);
 assert.doesNotMatch(wf,/^\s*schedule:/m);
 assert.doesNotMatch(wf,/actions\/upload-artifact/);
 const script=wf.slice(wf.indexOf('          script: |\n')+'          script: |\n'.length);
 const lines=script.split('\n').filter(Boolean);
 assert.ok(lines.length>20);
 const source=lines.map(s=>s.startsWith('            ')?s.slice(12):s).join('\n');
 assert.doesNotThrow(()=>new Function('return (async()=>{\n'+source+'\n})'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 assertProtectedSourceParityApproval,ORIGINAL_CLERK_QUERIES,CLERK_PARITY_MARKER
} from '../scripts/audit-senate-864-all-clerk-original-stored-readonly.js';
test('two bounded COUNT/doc SQL queries cannot write to existing Neon or extract named people',()=>{
 assert.equal(ORIGINAL_CLERK_QUERIES.length,2);
 for(const sql of ORIGINAL_CLERK_QUERIES){
  assert.match(sql,/^SELECT\s/);
  assert.match(sql,/LIMIT 1001$/);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY|GRANT|REVOKE|TRUNCATE|CALL|ANALYZE)\b/i);
  assert.doesNotMatch(sql,/\b(?:source_member_name|normalized_member_name|legislator_id)\b/i);
  assert.doesNotMatch(sql,/;/);
 }
 assert.match(ORIGINAL_CLERK_QUERIES[1],/count\(DISTINCT ve\.id\)/i);
 assert.match(ORIGINAL_CLERK_QUERIES[1],/count\(mv\.membership_id\)/i);
});
test('exact original main-only one-shot marker, all correct approvals and no replay',()=>{
 assert.equal(CLERK_PARITY_MARKER,'SENATE_864_ALL_CLERK_STORED_PARITY_ONESHOT_20261014_V1');
 const ok={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  VOTEPREDICT_864_APPROVAL:'BOUNDED_CLERK_COUNTS_READ_ONLY',
  VOTEPREDICT_864_MAIN_CI_VERIFIED:'true',
  VOTEPREDICT_864_CLERK_MARKER_PRESENT:'true',
  NEON_API_KEY:'placeholder-private-key',VOTEPREDICT_NEON_PROJECT_ID:'project-id'
 };
 assert.equal(assertProtectedSourceParityApproval(ok),true);
 for(const [k,v] of Object.entries({
  GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/heads/feature',
  GITHUB_REPOSITORY:'other/repository',GITHUB_RUN_ATTEMPT:'2',
  VOTEPREDICT_864_APPROVAL:'unapproved',
  VOTEPREDICT_864_MAIN_CI_VERIFIED:'false',
  VOTEPREDICT_864_CLERK_MARKER_PRESENT:'false',
  NEON_API_KEY:'',VOTEPREDICT_NEON_PROJECT_ID:''
 }))assert.throws(()=>assertProtectedSourceParityApproval({...ok,[k]:v}),/safe-gate/);
});
test('workflow never gives secrets to PR and protected source audit only runs after main full CI and original SHA preflight',()=>{
 const y=readFileSync('.github/workflows/senate-864-all-clerk-stored-readonly.yml','utf8');
 assert.match(y,/environment: evidence-readonly-sandbox/);
 assert.match(y,/github\.event_name == 'push'/);
 assert.match(y,/github\.ref == 'refs\/heads\/main'/);
 assert.match(y,/github\.run_attempt == 1/);
 assert.match(y,/needs\.main_presecret_verify\.result == 'success'/);
 assert.match(y,/VOTEPREDICT_864_MAIN_CI_VERIFIED:/);
 assert.match(y,/VOTEPREDICT_864_CLERK_MARKER_PRESENT:/);
 assert.match(y,/SENATE_864_ALL_CLERK_STORED_PARITY_ONESHOT_20261014_V1/);
 assert.match(y,/node --import tsx scripts\/audit-senate-864-all-clerk-original-stored-readonly\.ts --protected/);
 assert.doesNotMatch(y,/evidence[-_]write|workflow_dispatch|DATABASE_URL_UNPOOLED: \$\{\{ secrets\./);
});
test('protected private runner must open transaction READ ONLY, explicitly roll back and never mutate evidence tables',()=>{
 const c=readFileSync('scripts/audit-senate-864-all-clerk-original-stored-readonly.ts','utf8');
 assert.match(c,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(c,/default_transaction_read_only=on/);
 assert.match(c,/client\.query\('ROLLBACK'\)/);
 assert.doesNotMatch(c,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/);
 assert.match(c,/discoverExistingVotePredictNeonConnection/);
 assert.match(c,/deployedProductionNeonBranchBindingNotAsserted/);
});

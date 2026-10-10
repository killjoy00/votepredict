import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SENATE_MEDIA_NEON_APPROVAL,
  assertMediaReadinessManualApproval,
  assertProjectEndpointBelongsToApprovedBranch,
  mediaNeonReadinessReport,
  parseMediaSqlDestination,
  validateApprovedMediaBranchId,
} from '../src/operations/senate-media-neon-credential-gate.js';

const HOST='ep-example-123.us-east-2.aws.neon.tech';
const KEY='SECRET_VALUE_UNDER_TEST_NEVER_PRINT';
const PROJECT='blue-sea-123';
const BRANCH='br-sharp-hill-123';
const URL='postgresql://senate_media_readonly:sample_secret@'+HOST+':5432/votepredict?sslmode=require';

function approved() {
  return {
    GITHUB_REPOSITORY:'killjoy00/votepredict',
    GITHUB_REF:'refs/heads/main',
    GITHUB_EVENT_NAME:'workflow_dispatch',
    VOTEPREDICT_MEDIA_APPROVAL:SENATE_MEDIA_NEON_APPROVAL,
  };
}
function fakeApi(endpoints: unknown) {
  return (async (path: string, options: RequestInit) => {
    assert.equal(path, 'https://console.neon.tech/api/v2/projects/'+PROJECT+'/endpoints');
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal((options.headers as Record<string,string>).Authorization,'Bearer '+KEY);
    return new Response(JSON.stringify({endpoints}),{
      status:200,headers:{'content-type':'application/json'},
    });
  }) as typeof fetch;
}
function endpoint(overrides: Record<string,unknown> = {}) {
  return {host:HOST, branch_id:BRANCH, project_id:PROJECT, type:'read_write',...overrides};
}

test('requires explicit named owner dispatch on exact repository and main',()=>{
  assert.doesNotThrow(()=>assertMediaReadinessManualApproval(approved()));
  for(const [key,value] of Object.entries({
    GITHUB_REPOSITORY:'attacker/votepredict',
    GITHUB_REF:'refs/heads/feature',
    GITHUB_EVENT_NAME:'pull_request',
    VOTEPREDICT_MEDIA_APPROVAL:'not-approved',
  })){
    const bad={...approved(),[key]:value};
    assert.throws(()=>assertMediaReadinessManualApproval(bad),/manual/i);
  }
  assert.throws(()=>assertMediaReadinessManualApproval({}),/mandatory/);
});

test('restricted direct Neon connection URI accepted, and no password ever goes in an error',()=>{
  const d=parseMediaSqlDestination(URL);
  assert.equal(d.host,HOST);
  assert.equal(d.username,'senate_media_readonly');
  assert.equal(d.database,'votepredict');
  assert.equal(d.connectionString,URL);
  const untrusted=[
    URL.replace('postgresql:', 'https:'),
    URL.replace(HOST,'example.com'),
    URL.replace('sample_secret',''),
    URL.replace('senate_media_readonly','neondb_owner'),
    URL.replace('senate_media_readonly','superuser'),
    URL.replace(HOST, 'ep-example-123-pooler.us-east-2.aws.neon.tech'),
    URL.replace('sslmode=require','sslmode=disable'),
    URL+'&options=-c%20log_statement%3Dall',
  ];
  for(const value of untrusted) {
    assert.throws(()=>parseMediaSqlDestination(value),e=>{
      assert.ok(e instanceof Error);
      assert.ok(!e.message.includes('sample_secret'));
      return true;
    });
  }
});

test('approved branch IDs are strict, no names guessed as IDs',()=>{
  assert.equal(validateApprovedMediaBranchId(BRANCH),BRANCH);
  for(const v of ['main','production','br-', '', 'ep-some-endpoint']){
    assert.throws(()=>validateApprovedMediaBranchId(v));
  }
});

test('independent verified Neon project endpoint AND branch must match the SQL hostname',async()=>{
  const input={apiKey:KEY,projectId:PROJECT,branchId:BRANCH,databaseHost:HOST};
  await assert.doesNotReject(()=>assertProjectEndpointBelongsToApprovedBranch(input,fakeApi([endpoint()])));
  for(const wrong of [
    [endpoint({host:'ep-other.us-east-2.aws.neon.tech'})],
    [endpoint({branch_id:'br-other-123'})],
    [endpoint({project_id:'another-project'})],
    [endpoint({type:'not_a_compute'})],
    [],
  ]){
    await assert.rejects(()=>assertProjectEndpointBelongsToApprovedBranch(input,fakeApi(wrong)),
      /not independently bound/);
  }
});

test('HTTP failures, malformed responses and network failures fail closed without spilling secrets',async()=>{
  const input={apiKey:KEY,projectId:PROJECT,branchId:BRANCH,databaseHost:HOST};
  const invalid=[
    (async()=>new Response('not available',{status:403})) as typeof fetch,
    (async()=>new Response('{bad json',{status:200})) as typeof fetch,
    (async()=>{throw Error(KEY);}) as typeof fetch,
  ];
  for(const client of invalid) {
    await assert.rejects(
      ()=>assertProjectEndpointBelongsToApprovedBranch(input,client),
      error=>{
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes(KEY));
        return true;
      },
    );
  }
  await assert.rejects(()=>assertProjectEndpointBelongsToApprovedBranch(
    {...input,databaseHost:'127.0.0.1'},fakeApi([endpoint()])),
  ),/Invalid Neon database host/);
  await assert.rejects(()=>assertProjectEndpointBelongsToApprovedBranch(
    {...input,apiKey:''},fakeApi([endpoint()])),
  ),/required/);
});

test('project verified does NOT imply an eligible SQL export until the read-only role is checked',()=>{
  const missing=mediaNeonReadinessReport('project_verified_readonly_database_url_required');
  const branch=mediaNeonReadinessReport('project_verified_approved_branch_required');
  const checked=mediaNeonReadinessReport('project_verified_role_preflight_ready');
  assert.equal(missing.projectIdentityVerified,true);
  assert.equal(missing.sqlRoleSelectOnlyVerified,false);
  assert.equal(branch.projectEndpointAndBranchVerified,false);
  assert.equal(checked.sqlRoleSelectOnlyVerified,true);
  for(const r of [missing,branch,checked]){
    assert.equal(r.mediaExportPerformed,false);
    assert.equal(r.databaseRowsRead,false);
    assert.equal(r.productionDatabaseWritten,false);
    assert.equal(r.sandboxOrProductionBranchCreated,false);
    assert.equal(r.originalArticleBytesAccessed,false);
  }
});

test('GitHub manual workflow never triggers on PR/push, publishes raw export or uses Vercel',()=>{
  const yml=readFileSync('.github/workflows/senate-media-neon-readonly-preflight.yml','utf8');
  assert.match(yml,/workflow_dispatch:/);
  assert.match(yml,/default: false/);
  assert.match(yml,/environment: evidence-readonly-sandbox/);
  assert.match(yml,/ref: \$\{\{ github\.sha \}\}/);
  assert.match(yml,/github\.ref == 'refs\/heads\/main'/);
  assert.match(yml,/inputs\.approval_phrase == 'VERIFY_SENATE_MEDIA_READONLY'/);
  assert.match(yml,/secrets\.NEON_API_KEY/);
  assert.match(yml,/secrets\.VOTEPREDICT_MEDIA_READONLY_DATABASE_URL/);
  assert.match(yml,/vars\.VOTEPREDICT_MEDIA_APPROVED_BRANCH_ID/);
  assert.doesNotMatch(yml,/^\s+(?:push|pull_request|schedule):/m);
  assert.doesNotMatch(yml,/upload-artifact|vercel env|EXPORT.*ARTICLE|psql .*(?:delete|update)/i);
  const script=readFileSync('scripts/check-senate-media-gh-neon-readiness.ts','utf8');
  assert.match(script,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(script,/assertSenateMediaReadOnlyPreflight/);
  assert.doesNotMatch(script,/export-senate-media-context-readonly\.sql|export-senate-media-roster-readonly\.sql/);
});

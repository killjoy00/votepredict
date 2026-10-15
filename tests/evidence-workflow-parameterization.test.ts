import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  planEvidenceAcquire, planEvidenceAudit, assertEvidencePlan, REVISOR_SOURCE_SNAPSHOT_PATH,
} from '../src/operations/evidence-workflow-catalog';
import {
  getReadonlyQuery, executeNamedReadOnlyEvidenceQuery, type QueryClient,
} from '../src/operations/evidence-named-readonly-query';

test('acquisition accepts only reviewed sources, session and batch selectors', () => {
  const smoke=planEvidenceAcquire({sourceType:'official-source-smoke',session:'302',memberOrBatch:'all',dryRun:true});
  assert.deepEqual(smoke, {commands:[{path:'scripts/smoke-official-sources.ts',args:['302']}],artifactPath:null});
  const all=planEvidenceAcquire({sourceType:'revisor-source-passage',session:'all',memberOrBatch:'all',dryRun:false});
  assert.deepEqual(all.commands.map(x=>x.path),[
    'scripts/audit-revisor-source-passage-search.ts','scripts/export-revisor-source-passage-snapshot.ts',
  ]);
  assert.equal(all.artifactPath,REVISOR_SOURCE_SNAPSHOT_PATH);
  const preview=planEvidenceAcquire({sourceType:'revisor-source-passage',session:'all',memberOrBatch:'all',dryRun:true});
  assert.equal(preview.commands.length,1);
  assert.equal(preview.artifactPath,null);
  for(const operation of [smoke,all,preview]) assertEvidencePlan(operation);
  for(const sourceType of ['../../scripts/anything.ts','curl https://example.com','nonexistent']){
    assert.throws(()=>planEvidenceAcquire({sourceType,session:'302',memberOrBatch:'all',dryRun:true}),/Unknown evidence source type/);
  }
  assert.throws(()=>planEvidenceAcquire({sourceType:'official-source-smoke',session:'other',memberOrBatch:'all',dryRun:true}),/session/);
  assert.throws(()=>planEvidenceAcquire({sourceType:'official-source-smoke',session:'302',memberOrBatch:'Senator name',dryRun:true}),/member_or_batch/);
  assert.throws(()=>planEvidenceAcquire({sourceType:'revisor-source-passage',session:'2025-2026',memberOrBatch:'all',dryRun:false}),/session=all/);
});
test('audit names are from a fixed allow-list, no arbitrary script, SQL or shell', () => {
  assert.deepEqual(planEvidenceAudit({auditName:'revisor-source-passage',scope:'all'}).commands.map(x=>x.path),[
    'scripts/audit-revisor-source-passage-search.ts',
  ]);
  assert.equal(planEvidenceAudit({auditName:'quick-evidence-extractor',scope:'all'}).commands.length,4);
  assert.deepEqual(planEvidenceAudit({auditName:'official-source-smoke',scope:'257'}).commands[0].args,['257']);
  assert.throws(()=>planEvidenceAudit({auditName:'revisor-source-passage',scope:'2025-2026'}),/scope=all/);
  assert.throws(()=>planEvidenceAudit({auditName:'node scripts/audit-anything.ts',scope:'all'}),/Unknown audit/);
  assert.throws(()=>assertEvidencePlan({commands:[{path:'../../ops/secret.ts',args:[]}],artifactPath:null}),/not in checked-in allow-list/);
});
test('named SQL catalog is static, only SELECT, scoped and bounded', () => {
  for(const name of ['connection-health','session-membership-counts','evidence-item-count']){
    const query=getReadonlyQuery(name,'all');
    assert.match(query.sql,/^SELECT /);
    assert.doesNotMatch(query.sql,/;|--|\/\*|\b(UPDATE|DELETE|INSERT|CREATE|DROP)\b/i);
    assert.ok(query.maxRows<=3);
  }
  assert.ok(getReadonlyQuery('session-membership-counts','2023-2024').sql.includes('$1::text'));
  assert.throws(()=>getReadonlyQuery('DELETE FROM evidence_items','all'),/Unknown named/);
  assert.throws(()=>getReadonlyQuery('connection-health','2021-2022'),/scope=all/);
  assert.throws(()=>getReadonlyQuery('session-membership-counts',"all';DROP TABLE members;--"),/Scope not allow-listed/);
});
test('protected query opens REPEATABLE READ READ ONLY, verifies role/database and always ROLLBACKs', async () => {
  const statements:{sql:string;params?:readonly unknown[]}[]=[];
  const client:QueryClient={async query(sql,params){
    statements.push({sql,params});
    if(sql.startsWith('SELECT current_database()'))return {rows:[{db:'votepredict',role:'existing_role',ro:'on'}]};
    if(sql.startsWith('SELECT s.slug')) return {rows:[{session_slug:'2023-2024',membership_count:3}]};
    return {rows:[]};
  }};
  const result=await executeNamedReadOnlyEvidenceQuery(client,'session-membership-counts','2023-2024',{database:'votepredict',role:'existing_role'});
  assert.deepEqual(result.rows,[{session_slug:'2023-2024',membership_count:3}]);
  assert.deepEqual(statements.map(x=>x.sql.startsWith('SELECT')?'SELECT':x.sql),
    ['BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY','SELECT','SELECT','ROLLBACK']);
  assert.deepEqual(statements[2].params,['2023-2024']);
});
test('failed identity or unsafe result never emits source rows and rolls back', async () => {
  for(const kind of ['identity','extra-column','error']){
    const log:string[]=[];
    const client:QueryClient={async query(sql){
      log.push(sql);
      if(sql.startsWith('SELECT current_database()'))
        return {rows:[{db:'votepredict',role:'existing_role',ro:kind==='identity'?'off':'on'}]};
      if(kind==='error' && sql.startsWith('SELECT 1::'))throw new Error('query failed');
      return {rows:[{check_count:1,source_url:'DO_NOT_EXPORT'}]};
    }};
    await assert.rejects(executeNamedReadOnlyEvidenceQuery(client,'connection-health','all',{database:'votepredict',role:'existing_role'}));
    assert.equal(log[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.equal(log.at(-1),'ROLLBACK');
    assert.equal(log.filter(x=>x==='ROLLBACK').length,1);
  }
});
test('the new manual actions preserve branch restrictions and isolated protected secrets', () => {
  for(const workflow of ['evidence-acquire','evidence-audit','evidence-readonly-query']){
    const src=readFileSync('.github/workflows/'+workflow+'.yml','utf8');
    assert.match(src,/^  workflow_dispatch:/m);
    assert.doesNotMatch(src,/^  (push|pull_request|schedule):/m);
    assert.match(src,/github\.ref == 'refs\/heads\/main'/);
    assert.match(src,/^permissions:\n  contents: read/m);
    assert.match(src,/cancel-in-progress: false/);
    assert.match(src,/persist-credentials: false/);
  }
  const readonly=readFileSync('.github/workflows/evidence-readonly-query.yml','utf8');
  assert.match(readonly,/environment: evidence-readonly-sandbox/);
  assert.match(readonly,/secrets\.NEON_API_KEY/);
  assert.match(readonly,/inputs\.approval_phrase == 'READ_ONLY_SANDBOX_AUDIT'/);
  assert.match(readonly,/scripts\/run-evidence-readonly-query\.ts/);
  const archive=['source-smoke.yml','revisor-source-passage-audit.yml'];
  for(const filename of archive){
    assert.equal(existsSync('.github/workflows/'+filename),false,'archived workflow must be inactive');
    assert.equal(existsSync('research/workflows-archive/'+filename),true,'archived YAML preserved');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {buildPreseasonTargets,PRESEASON_LIMITS} from '../src/operations/2027-preseason-evidence-archive.js';
import {addRonnenbergTarget,assertExistingArchiveRun,assertArchiveConnection,withRestrictedArchiveTransaction,ARCHIVE_MARKER} from '../src/operations/2027-preseason-existing-neon-archive.js';
const read=(n:string)=>readFileSync('docs/evaluation/source-proof/'+n,'utf8');
const roster=read('2027-preseason-roster-20261126.json'),pilot=JSON.parse(read('2027-incoming-evidence-pilot-20261126-part1.json'));
const targets=buildPreseasonTargets(roster,JSON.parse(read('2027-incoming-evidence-manual-leads-20261126.json')),JSON.parse(read('2027-incoming-evidence-depth-review-20261126.json')),pilot);
test('Ronnenberg is first, exactly 29 scoped sources; tracking query excluded',()=>{
  const r=addRonnenbergTarget(targets,roster,pilot);assert.equal(r.length,29);assert.equal(PRESEASON_LIMITS.sources,29);
  assert.equal(r[0].lrlId,'15669');assert.equal(r[0].url,'https://www.ronnenbergformn.com/');
  const tampered=structuredClone(pilot);tampered.results.find((r:{lrlId:string})=>r.lrlId==='15669').evidence=[];
  assert.throws(()=>addRonnenbergTarget(targets,roster,tampered));
});
test('protected gate accepts only exact marked main push or approved manual dispatch',()=>{
  const sha='a'.repeat(40),now=new Date('2026-11-27T12:00:00Z');
  const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/2027-preseason-evidence-archive.yml@refs/heads/main',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,GITHUB_RUN_ID:'123',VOTEPREDICT_2027_PRESEASON_CI_VERIFIED:'true'};
  const event={repository:{full_name:'killjoy00/votepredict',default_branch:'main'},after:sha,head_commit:{id:sha,message:ARCHIVE_MARKER},forced:false,deleted:false};
  assert.equal(assertExistingArchiveRun(env,event,now).runId,'123:1');
  for(const patch of [{GITHUB_REF:'refs/heads/topic'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'pull_request'},{VOTEPREDICT_2027_PRESEASON_CI_VERIFIED:'false'},{VERCEL:'1'}])assert.throws(()=>assertExistingArchiveRun({...env,...patch},event,now));
  assert.throws(()=>assertExistingArchiveRun(env,{...event,head_commit:{id:sha,message:'normal'}},now));
  assert.throws(()=>assertExistingArchiveRun(env,{...event,forced:true},now));
  assert.throws(()=>assertExistingArchiveRun(env,event,new Date('2027-01-12T06:00:00Z')));
  assert.throws(()=>assertExistingArchiveRun({...env,GITHUB_EVENT_NAME:'workflow_dispatch'},{...event,inputs:{archive:'false'}},now));
  assert.equal(assertExistingArchiveRun({...env,GITHUB_EVENT_NAME:'workflow_dispatch'},{...event,inputs:{archive:'true'}},now).runId,'123:1');
});
test('database target is pinned and cannot silently switch to another project or role',()=>{
  const t={projectId:'long-sunset-19921337',branchId:'br-billowing-wave-aecfbwky',endpointId:'ep-odd-haze-aebm7w42',host:'ep-odd-haze-aebm7w42.c-2.us-east-2.aws.neon.tech',port:5432,database:'votepredict',role:'votepredict_owner',password:'fixture-only'};
  assert.match(assertArchiveConnection(t)!,/^[a-f0-9]{64}$/);
  for(const patch of [{projectId:'other'},{branchId:'other'},{host:'other.neon.tech'},{role:'other'},{database:'other'}])assert.throws(()=>assertArchiveConnection({...t,...patch}));
});
test('disposable PostgreSQL effective-role transaction restricts writes and restores grant on success and failure',async t=>{
  const uri=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!uri){t.skip('disposable PostgreSQL not configured');return;}
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname));
  const db=new Pool({connectionString:uri,max:1}),role='votepredict_2027_preseason_archive_'+randomUUID().replaceAll('-','').slice(0,12);
  const owner=(await db.query<{name:string}>('SELECT current_user::text AS name')).rows[0].name;
  await db.query('CREATE ROLE '+role+' NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  try{
    await db.query('GRANT USAGE ON SCHEMA public TO '+role);
    await db.query('GRANT SELECT ON public.votepredict_schema_migrations TO '+role);
    await db.query('GRANT SELECT,INSERT ON public.evidence_content_blobs TO '+role);
    const grantCount=async()=>Number((await db.query<{n:string}>("SELECT count(*)::text AS n FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid WHERE r.rolname=$1 AND a.set_option",[role])).rows[0].n);
    const before=await grantCount();
    await withRestrictedArchiveTransaction(db,owner,role,async c=>{
      const q=(await c.query<{name:string;canInsert:boolean;canDelete:boolean}>("SELECT current_user::text AS name,has_table_privilege(current_user,'public.evidence_content_blobs','INSERT') AS \"canInsert\",has_table_privilege(current_user,'public.evidence_content_blobs','DELETE') AS \"canDelete\"")).rows[0];
      assert.deepEqual(q,{name:role,canInsert:true,canDelete:false});
    });
    assert.equal(await grantCount(),before);
    await assert.rejects(withRestrictedArchiveTransaction(db,owner,role,async()=>{throw Error('fixture rollback');}),/fixture rollback/);
    assert.equal(await grantCount(),before);
  }finally{await db.query('DROP OWNED BY '+role);await db.query('DROP ROLE '+role);await db.end();}
});

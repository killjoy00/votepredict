import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {buildPreseasonTargets,assertPreseasonArchiveRun,retainPreseasonSource,PRESEASON_RECEIPT_TYPE,type PreseasonReceipt} from '../src/operations/2027-preseason-evidence-archive.js';
import {databaseTargetFingerprint} from '../src/operations/release-readiness.js';
const root='docs/evaluation/source-proof/';
const roster=readFileSync(root+'2027-preseason-roster-20261126.json','utf8');
const manual=JSON.parse(readFileSync(root+'2027-incoming-evidence-manual-leads-20261126.json','utf8'));
const depth=JSON.parse(readFileSync(root+'2027-incoming-evidence-depth-review-20261126.json','utf8'));
const cohort=JSON.parse(readFileSync(root+'2027-incoming-evidence-pilot-20261126-part1.json','utf8'));
const targets=buildPreseasonTargets(roster,manual,depth,cohort);
test('exact frozen incoming roster and reviewed original source inventory',()=>{
  assert.equal(targets.length,28);
  assert.equal(new Set(targets.map(x=>x.lrlId)).size,21);
  assert.throws(()=>buildPreseasonTargets(roster+' ',manual,depth,cohort),/binding/);
  const altered=structuredClone(manual);altered.members[0].seat='house:1A';
  assert.throws(()=>buildPreseasonTargets(roster,altered,depth,cohort),/identity/);
  const unsafe=structuredClone(manual);unsafe.members[0].sources[0].url='http://localhost/';
  assert.throws(()=>buildPreseasonTargets(roster,unsafe,depth,cohort),/shape/);
});
test('protected archive requires separate approved role, exact main and pre-session window',()=>{
  const url='postgresql://archive_reader:fixture@ep-fixture.c-2.us-east-2.aws.neon.tech/votepredict?sslmode=verify-full';
  const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/2027-preseason-evidence-archive.yml@refs/heads/main',
    GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',VOTEPREDICT_2027_PRESEASON_ARCHIVE_AUTHORIZED:'true',VOTEPREDICT_2027_PRESEASON_ARCHIVE_DATABASE_URL:url,
    VOTEPREDICT_2027_PRESEASON_ARCHIVE_ROLE:'archive_reader',VOTEPREDICT_2027_PRESEASON_ARCHIVE_DATABASE_FINGERPRINT:databaseTargetFingerprint(url)!};
  const now=new Date('2026-11-27T12:00:00Z');
  assert.equal(assertPreseasonArchiveRun(env,now).runId,'123:1');
  assert.throws(()=>assertPreseasonArchiveRun(env,new Date('2027-01-12T06:00:00Z')));
  for(const patch of [{VERCEL:'1'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REF:'refs/heads/topic'},{VOTEPREDICT_2027_PRESEASON_ARCHIVE_AUTHORIZED:'false'},{VOTEPREDICT_2027_PRESEASON_ARCHIVE_ROLE:'owner'},{VOTEPREDICT_2027_PRESEASON_ARCHIVE_DATABASE_FINGERPRINT:'a'.repeat(64)}])
    assert.throws(()=>assertPreseasonArchiveRun({...env,...patch},now));
});
test('exact original bytes and non-serving receipt survive disposable PostgreSQL archive readback',async t=>{
  const uri=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!uri){t.skip('disposable PostgreSQL not configured');return;}
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname));
  const schema='preseason_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:uri,max:1});let db:Pool|undefined;
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:uri,max:2,options:'-c search_path='+schema});
    const migration=readFileSync('migrations/0037_forecast_evidence_contract.sql','utf8');
    const start=migration.indexOf('CREATE TABLE evidence_content_blobs (');const end=migration.indexOf('CREATE TABLE forecast_bill_text_observations',start);
    assert.ok(start>=0&&end>start);await db.query(migration.slice(start,end));
    const raw=Buffer.from([0xef,0xbb,0xbf,60,104,116,109,108,62]),target=targets[0];
    const receipt:PreseasonReceipt={schemaVersion:'2027-preseason-source-review-v1',session:'2027-2028',runId:'123:1',rosterSha256:target.rosterSha256,lrlId:target.lrlId,seat:target.seat,
      sourceUrl:target.url,sourceKind:target.kind,publisher:target.publisher,observedAt:new Date().toISOString(),bodySha256:createHash('sha256').update(raw).digest('hex'),bodyBytes:raw.length,
      claimedPublicationAt:null,identityNameMentioned:false,rawBodyRetained:false,reviewRequired:true,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0};
    const digest=await retainPreseasonSource(db,target,receipt,raw);
    assert.equal(await retainPreseasonSource(db,target,receipt,raw),digest);
    const stored=(await db.query<{body:Buffer;media_type:string}>('SELECT body,media_type FROM evidence_content_blobs WHERE sha256=$1',[digest])).rows[0];
    assert.equal(stored.media_type,PRESEASON_RECEIPT_TYPE);assert.deepEqual(JSON.parse(stored.body.toString()),{...receipt,rawBodyRetained:true});
    const original=(await db.query<{body:Buffer}>('SELECT body FROM evidence_content_blobs WHERE sha256=$1',[receipt.bodySha256])).rows[0];
    assert.deepEqual(original.body,raw);
    await assert.rejects(retainPreseasonSource(db,target,{...receipt,sourceUrl:'https://example.com/'},raw));
    await assert.rejects(retainPreseasonSource(db,target,{...receipt,bodyBytes:raw.length+1},raw));
    await assert.rejects(retainPreseasonSource(db,target,{...receipt,observedAt:'2020-01-01T00:00:00Z'},raw),/clock/);
    assert.equal((await db.query('SELECT * FROM evidence_content_blobs')).rowCount,2);
    await assert.rejects(db.query('DELETE FROM evidence_content_blobs WHERE sha256=$1',[digest]),/append-only/);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});

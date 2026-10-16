import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {validateMinuteRecoveryCorpus,minuteRawPayload,importRecoveredMinutes,
  type MinuteRecoveryCorpus} from '../src/operations/senate-minute-gap-recovery.js';
import {CORPUS_PATH,assertMinuteRecoveryEnvironment,RECOVERY_MARKER} from '../scripts/recover-senate-minute-gaps.js';

const corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8')) as MinuteRecoveryCorpus;
test('eight full-text government Minutes recover dates from the original fourteen-date gap queue',()=>{
  validateMinuteRecoveryCorpus(corpus);
  assert.equal(corpus.documents.length,8);
  assert.equal(corpus.remainingGaps.length,6);
  assert.deepEqual(corpus.documents.filter(r=>r.extractionMethod==='ocr_tesseract').map(r=>r.hearingDate).sort(),
    ['2023-04-27','2024-04-03','2024-05-01']);
  assert.ok(corpus.documents.reduce((n,r)=>n+r.rawText.length,0)>25000);
  const dated=minuteRawPayload(corpus.documents.find(r=>r.hearingDate==='2025-04-09')!);
  assert.equal(dated.publicationDate,null);
  assert.equal(dated.sourceDate,'2025-04-09');
  assert.match(dated.text,/Passes via 6-5 roll call vote/);
  // This source prints aggregate rolls, not individual choices.
  assert.ok(dated.records.every(r=>r.memberVotes.length===0));
});
test('changed source text, offsite sources and previous-meeting attachments cannot enter the bounded import',()=>{
  for(const change of [
    {rawText:corpus.documents[0]!.rawText+' changed'},
    {sourceUrl:corpus.documents[0]!.sourceUrl.replace('www.lrl.mn.gov','example.com')},
    {sourceUrl:corpus.documents[0]!.sourceUrl.replace('Minutes-and-Attendance','Previous-Meeting-Minutes')},
  ]){
    const bad=structuredClone(corpus);Object.assign(bad.documents[0]!,change);
    assert.throws(()=>validateMinuteRecoveryCorpus(bad));
  }
});
test('production import requires the exact reviewed main event and independent CI',()=>{
  const sha='a'.repeat(40);
  const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',
    GITHUB_SHA:sha,GITHUB_RUN_ATTEMPT:'1',VOTEPREDICT_MINUTES_INDEPENDENT_CI:'true',NEON_API_KEY:'fixture',
    VOTEPREDICT_NEON_PROJECT_ID:'fixture'};
  const event={ref:env.GITHUB_REF,after:sha,repository:{full_name:env.GITHUB_REPOSITORY},
    head_commit:{id:sha,message:RECOVERY_MARKER}};
  assert.doesNotThrow(()=>assertMinuteRecoveryEnvironment(env,event));
  for(const change of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_RUN_ATTEMPT:'2'},
    {VOTEPREDICT_MINUTES_INDEPENDENT_CI:'false'},{GITHUB_REF:'refs/heads/branch'}])
    assert.throws(()=>assertMinuteRecoveryEnvironment({...env,...change},event));
  assert.throws(()=>assertMinuteRecoveryEnvironment(env,{...event,after:'b'.repeat(40)}));
  assert.throws(()=>assertMinuteRecoveryEnvironment(env,{...event,head_commit:{id:sha,message:'unmarked'}}));
});

const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
test('Postgres raw import preserves source metadata and text, is replay-safe, and retains a changed PDF as a new version',
  {skip:!url},async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(url!).hostname))throw Error('Disposable local PostgreSQL only');
    const db=new Client({connectionString:url});await db.connect();
    const schema='minute_recovery_'+process.pid;
    try{
      await db.query('CREATE SCHEMA '+schema);
      await db.query('SET search_path TO '+schema+',public');
      for(const table of ['jurisdictions','legislative_sessions','chambers','source_documents'])
        await db.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
      await db.query("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US')");
      await db.query("INSERT INTO chambers(jurisdiction_id,slug,name,kind) SELECT id,'senate','Senate','upper' FROM jurisdictions");
      for(const slug of ['2023-2024','2025-2026'])await db.query(
        'INSERT INTO legislative_sessions(jurisdiction_id,slug,name) SELECT id,$1,$1 FROM jurisdictions',[slug]);
      const first=corpus.documents[0]!;
      await db.query(`INSERT INTO source_documents(jurisdiction_id,source_kind,source_url,content_sha256,metadata)
        SELECT id,'prior_source',$1,$2,'{"originalMetadata":"preserved"}'::jsonb FROM jurisdictions`,
        [first.sourceUrl,first.contentSha256]);
      const imported=await importRecoveredMinutes(db,corpus);
      assert.equal(imported.changed,8);assert.equal(imported.matching,8);
      assert.equal((await importRecoveredMinutes(db,corpus)).changed,0);
      const prior=await db.query('SELECT source_kind,metadata FROM source_documents WHERE source_url=$1',[first.sourceUrl]);
      assert.equal(prior.rows[0].source_kind,'prior_source');
      assert.equal(prior.rows[0].metadata.originalMetadata,'preserved');
      assert.equal(prior.rows[0].metadata.rawPrepassageVotes.text,first.rawText);
      const variant=structuredClone(corpus);variant.documents[0]!.contentSha256='f'.repeat(64);
      assert.equal((await importRecoveredMinutes(db,variant)).changed,1);
      assert.equal((await db.query('SELECT count(*)::int n FROM source_documents')).rows[0].n,9);
    }finally{
      await db.query('SET search_path TO public');await db.query('DROP SCHEMA '+schema+' CASCADE');await db.end();
    }
  });

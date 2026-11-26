import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { classify2027CollectionUrl,assert2027InitialTextUrl,collectionSourceFetch,with2027ArchivedSources,COLLECTION_LIMITS } from '../src/sources/minnesota/2027-collection-source.js';
import { DAILY_COLLECTION_PLAN,assertDailyCollectionRun,assertDailyRunAvailable,collectionAlerts,archive2027Source,inspectCollectionHeartbeat,previousCollectionDay,storeCollectionEvent,readCollectionEvents,DAILY_COLLECTION_SOURCE_RECEIPT_TYPE,type CollectionHealth } from '../src/operations/2027-daily-collection.js';
import { databaseTargetFingerprint } from '../src/operations/release-readiness.js';
import { buildRevisorBillSearchUrl } from '../src/sources/minnesota/revisor-bill-search.js';

const status='https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/1/';
const text='https://www.revisor.mn.gov/bills/95/2027/0/HF/1/versions/0/';
const catalog=buildRevisorBillSearchUrl({sessionKey:'2027-2028',body:'House',firstBill:1,lastBill:500});
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
test('collection admits only exact bounded 2027 source scope',()=>{
  assert.equal(classify2027CollectionUrl(catalog),'catalog');
  assert.equal(classify2027CollectionUrl(status),'status');
  assert.equal(classify2027CollectionUrl(text),'initial_text');
  for(const value of [status.replace('/95/2027/','/94/2025/'),status+'?x=1',status.replace('api.revisor.mn.gov','example.com'),
    status.replace('/0/HF/','/1/HF/'),text.replace('/versions/0/','/versions/latest/'),catalog.replace('0952027','0942025'),catalog+'&session=0952027',
    catalog.replace('1-500','1-501')])assert.throws(()=>classify2027CollectionUrl(value),/scope|URL/);
  assert.doesNotThrow(()=>assert2027InitialTextUrl('HF1','2027.0-HF0001-0',text));
  assert.throws(()=>assert2027InitialTextUrl('HF2','2027.0-HF0002-0',text),/identity/);
  assert.throws(()=>assert2027InitialTextUrl('HF1','2027.0-HF0001-1',text),/identity/);
});
test('source response bytes are archived before parser receives them; refusal and limits are visible',async()=>{
  const bytes=Buffer.from([0xef,0xbb,0xbf,60,66,73,76,76,47,62]);
  let archived=false;
  await with2027ArchivedSources('123:1',async(receipt,body)=>{
    assert.deepEqual(body,bytes);assert.equal(receipt.responseBodySha256,sha(bytes));
    assert.equal(receipt.sourceUrl,status);assert.equal(receipt.responseBodyBytes,bytes.length);
    assert.equal(receipt.runId,'123:1');assert.equal(receipt.httpStatus,200);archived=true;return 'a'.repeat(64);
  },async counters=>{
    const response=await collectionSourceFetch(status);
    assert.ok(archived);assert.equal(response.url,status);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
    assert.equal(counters.archived,1);assert.equal(counters.requests,1);assert.equal(counters.bytes,bytes.length);
    await assert.rejects(collectionSourceFetch('https://example.com'),/scope/);
    assert.equal(counters.failed,1);
  },async(_url,init)=>{assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');return new Response(new Uint8Array(bytes),{status:200});});
  await with2027ArchivedSources('124:1',async()=>{throw Error('archive not available');},async counters=>{
    await assert.rejects(collectionSourceFetch(status),/archive not available/);assert.equal(counters.archived,0);assert.equal(counters.failed,1);
  },async()=>new Response('<BILL/>'));
  await with2027ArchivedSources('125:1',async()=> 'b'.repeat(64),async counters=>{
    for(let i=0;i<COLLECTION_LIMITS.statusRequests;i++)await collectionSourceFetch(status);
    await assert.rejects(collectionSourceFetch(status),/budget exhausted/);
    assert.equal(counters.requests,COLLECTION_LIMITS.statusRequests);assert.equal(counters.archived,counters.requests);
  },async()=>new Response('<BILL/>'));
  await with2027ArchivedSources('126:1',async()=>{throw Error('must not archive');},async counters=>{
    await assert.rejects(collectionSourceFetch(status),/oversize/);assert.equal(counters.archived,0);
  },async()=>new Response('large',{headers:{'content-length':String(COLLECTION_LIMITS.maxResponseBytes+1)}}));
});
test('live collection is dormant and rejects wrong dates, repo, attempts, targets and roles',()=>{
  const url='postgresql://collector:fixture@ep-fixture.c-2.us-east-2.aws.neon.tech/votepredict?sslmode=verify-full';
  const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/2027-daily-collection.yml@refs/heads/main',
    VOTEPREDICT_2027_COLLECTION_AUTHORIZED:'true',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',VOTEPREDICT_2027_COLLECTOR_DATABASE_URL:url,
    VOTEPREDICT_2027_COLLECTOR_ROLE:'collector',VOTEPREDICT_2027_COLLECTOR_DATABASE_FINGERPRINT:databaseTargetFingerprint(url)!};
  assert.equal(DAILY_COLLECTION_PLAN.productionScheduleEnabled,false);
  const now=new Date('2027-01-12T18:00:00Z');
  assert.equal(assertDailyCollectionRun(env,now).day,'2027-01-12');
  assert.throws(()=>assertDailyCollectionRun(env,new Date('2027-01-12T05:59:59Z')));
  for(const patch of [{VERCEL:'1'},{GITHUB_REF:'refs/heads/topic'},{GITHUB_RUN_ATTEMPT:'2'},{VOTEPREDICT_2027_COLLECTION_AUTHORIZED:'false'},
    {VOTEPREDICT_2027_COLLECTOR_ROLE:'owner'},{VOTEPREDICT_2027_COLLECTOR_DATABASE_FINGERPRINT:'f'.repeat(64)}])assert.throws(()=>assertDailyCollectionRun({...env,...patch},now));
  const day='2027-01-12';
  assert.doesNotThrow(()=>assertDailyRunAvailable([{day,runId:'122:1',state:'started'}],day,'123:1'));
  assert.throws(()=>assertDailyRunAvailable([{day,runId:'122:1',state:'completed_batch'}],day,'123:1'));
  assert.throws(()=>assertDailyRunAvailable([{day,runId:'122:1',state:'started'},{day,runId:'121:1',state:'started'}],day,'123:1'));
});
test('health distinguishes bounded work from incomplete data coverage',()=>{
  const before:CollectionHealth={knownBills:200,houseBills:120,senateBills:80,neverObserved:0,staleStatus:0,failedStatus:0,missingInitialText:0,missingCurrentText:0};
  const counters={requests:2,bytes:100,archived:1,failed:1,byKind:{catalog:1,status:1,initial_text:0,current_text:0},receiptSha256s:[]};
  const alerts=collectionAlerts(before,{...before,staleStatus:80,missingInitialText:4,missingCurrentText:2},199,counters,true);
  for(const item of ['SOURCE_OR_COLLECTION_FAILURE','UNARCHIVED_SOURCE_ATTEMPTS','CATALOG_COVERAGE_REGRESSION','STATUS_BACKLOG_OR_STALE','INITIAL_TEXT_BACKLOG','CURRENT_TEXT_BACKLOG'])assert.ok(alerts.includes(item));
});

test('heartbeat distinguishes missing, partial, interrupted and recovered collection days',()=>{
  assert.equal(previousCollectionDay('2028-03-01'),'2028-02-29');
  assert.equal(inspectCollectionHeartbeat([],'2027-01-11').state,'not_due');
  const day='2027-01-12';
  assert.equal(inspectCollectionHeartbeat([],day).state,'missing');
  const start={day,runId:'1:1',state:'started'};
  assert.equal(inspectCollectionHeartbeat([start],day).state,'interrupted');
  assert.equal(inspectCollectionHeartbeat([start,{...start,state:'partial_failure'}],day).state,'partial_failure');
  const retry={day,runId:'2:1',state:'started'};
  const result=inspectCollectionHeartbeat([start,retry,{...retry,state:'completed_batch'}],day);
  assert.equal(result.state,'completed_batch');assert.equal(result.unclosedStarts,1);
  assert.ok(result.alerts.includes('PREVIOUS_COLLECTION_INTERRUPTED_ATTEMPT'));
});

import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
test('disposable PostgreSQL stores original entity bytes and distinct observation receipts immutably',async t=>{
  const uri=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!uri){t.skip('disposable PostgreSQL not configured');return;}
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname),'test must use localhost PostgreSQL');
  const schema='collection_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:uri,max:1});
  let db:Pool|undefined;
  try{
    await admin.query('CREATE SCHEMA '+schema);
    db=new Pool({connectionString:uri,max:2,options:'-c search_path='+schema});
    // Exercise exactly the already-deployed content-store DDL, not a
    // production migration or simplified test-only mock.
    const migration=readFileSync('migrations/0037_forecast_evidence_contract.sql','utf8');
    const start=migration.indexOf('CREATE TABLE evidence_content_blobs (');
    const end=migration.indexOf('CREATE TABLE forecast_bill_text_observations',start);
    assert.ok(start>=0&&end>start);
    await db.query(migration.slice(start,end));
    const raw=Buffer.from([0xef,0xbb,0xbf,60,66,73,76,76,47,62]);
    const observedAt=new Date().toISOString();
    const first={schemaVersion:'2027-source-observation-v1' as const,session:'2027-2028' as const,runId:'123:1',
      sourceKind:'status' as const,sourceUrl:status,httpStatus:200,mediaType:'application/xml',
      observedAt,responseBodySha256:sha(raw),responseBodyBytes:raw.length};
    const firstHash=await archive2027Source(db,first,raw);
    assert.equal(await archive2027Source(db,first,raw),firstHash);
    const secondHash=await archive2027Source(db,{...first,runId:'124:1'},raw);
    assert.notEqual(secondHash,firstHash);
    const stored=(await db.query<{body:Buffer;media_type:string}>('SELECT body,media_type FROM evidence_content_blobs WHERE sha256=$1',[sha(raw)])).rows[0];
    assert.deepEqual(stored.body,raw);assert.equal(stored.media_type,'application/octet-stream');
    const receipts=(await db.query<{body:Buffer}>('SELECT body FROM evidence_content_blobs WHERE media_type=$1 ORDER BY accepted_at',[DAILY_COLLECTION_SOURCE_RECEIPT_TYPE])).rows;
    assert.equal(receipts.length,2);
    assert.deepEqual(JSON.parse(receipts[0].body.toString()),first);
    await assert.rejects(archive2027Source(db,{...first,responseBodyBytes:raw.length+1},raw),/does not match/);
    await assert.rejects(archive2027Source(db,{...first,observedAt:'2020-01-01T00:00:00.000Z'},raw),/clocks disagree/);
    assert.equal((await db.query('SELECT * FROM evidence_content_blobs')).rowCount,3);
    await assert.rejects(db.query('UPDATE evidence_content_blobs SET media_type=$1 WHERE sha256=$2',['bad',sha(raw)]),/append-only/);
    await assert.rejects(db.query('DELETE FROM evidence_content_blobs WHERE sha256=$1',[sha(raw)]),/append-only/);
    await assert.rejects(db.query('TRUNCATE evidence_content_blobs'),/append-only/);
    const actualDay=(await db.query<{day:string}>("SELECT (clock_timestamp() AT TIME ZONE 'America/Chicago')::date::text AS day")).rows[0].day;
    const event={day:actualDay,runId:'123:1',state:'started'};
    await storeCollectionEvent(db,event);
    assert.deepEqual(await readCollectionEvents(db,actualDay),[event]);
    assert.throws(()=>assertDailyRunAvailable([event],actualDay,'123:1'));
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});

import { assert2027CurrentTextUrl,fetch2027CurrentText,collect2027CurrentTextBatch,CURRENT_TEXT_BINDING_TYPE } from '../src/operations/2027-current-text-collection.js';
test('numbered official current text is bound to the archived original and rejects other versions',async()=>{
  const target={identifier:'HF1',version_key:'2027.0-HF0001-2',text_url:'https://www.revisor.mn.gov/bills/95/2027/0/HF/1/versions/2/'};
  const html='<main><div id="document"><p>'+('HF 1 synthetic official engrossment 2; test legislation. '.repeat(8))+'</p></div></main>';
  assert.equal(classify2027CollectionUrl(target.text_url),'current_text');
  await assert.rejects(fetch2027CurrentText(target),/collection scope required/);
  for(const patch of [{version_key:'2027.0-HF0001-1'},{identifier:'HF2'},{text_url:target.text_url.replace('/versions/2/','/versions/latest/')},{text_url:target.text_url.replace('/2027/','/2028/')}])
    assert.throws(()=>{const row={...target,...patch};assert2027CurrentTextUrl(row.identifier,row.version_key,row.text_url);});
  await with2027ArchivedSources('127:1',async(receipt,body)=>{
    assert.equal(receipt.sourceKind,'current_text');
    assert.equal(receipt.responseBodySha256,sha(Buffer.from(html)));
    assert.deepEqual(body,Buffer.from(html));
    return 'c'.repeat(64);
  },async counters=>{
    const result=await fetch2027CurrentText(target);
    assert.equal(result.receiptSha256,'c'.repeat(64));
    assert.equal(result.textSha256,sha(Buffer.from(result.text)));
    assert.equal(result.receipt.responseBodySha256,sha(Buffer.from(html)));
    assert.equal(counters.byKind.current_text,1);
  },async()=>new Response(html,{headers:{'content-type':'text/html'}}));
  await with2027ArchivedSources('128:1',async()=>{throw Error('archive unavailable');},async()=>{
    await assert.rejects(fetch2027CurrentText(target),/archive unavailable/);
  },async()=>new Response(html));
});

test('disposable DB captures numbered current versions and never overwrites earlier text or conflicting text',async t=>{
  const uri=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!uri){t.skip('disposable PostgreSQL not configured');return;}
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname));
  const schema='current_text_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:uri,max:1});
  let db:Pool|undefined;
  try{
    await admin.query('CREATE SCHEMA '+schema);
    db=new Pool({connectionString:uri,max:3,options:'-c search_path='+schema});
    await db.query(readFileSync('migrations/0001_v2_foundation.sql','utf8'));
    const migration=readFileSync('migrations/0037_forecast_evidence_contract.sql','utf8');
    const start=migration.indexOf('CREATE TABLE evidence_content_blobs (');
    const end=migration.indexOf('CREATE TABLE forecast_input_manifests',start);
    assert.ok(start>=0&&end>start);
    await db.query(migration.slice(start,end));
    const jurisdiction=(await db.query<{id:string}>("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Fixture Minnesota','US') RETURNING id")).rows[0].id;
    const session=(await db.query<{id:string}>(`INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on,is_current)
      VALUES($1,'2027-2028','Synthetic session','2027-01-01','2028-12-31',true) RETURNING id`,[jurisdiction])).rows[0].id;
    const chamber=(await db.query<{id:string}>("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'house','House','lower') RETURNING id",[jurisdiction])).rows[0].id;
    const bill=(await db.query<{id:string}>(`INSERT INTO bills(session_id,originating_chamber_id,identifier,title,metadata)
      VALUES($1,$2,'HF1','Synthetic test bill','{"revisorUniverse":{"liveSync":true}}') RETURNING id`,[session,chamber])).rows[0].id;
    const html=(ordinal:number)=>'<main><div id="document"><p>'+('HF 1 fixture engrossment '+ordinal+' official synthetic test text. ').repeat(8)+'</p></div></main>';
    const markCurrent=async(ordinal:number,existingText?:string)=>{
      const key='2027.0-HF0001-'+ordinal,url='https://www.revisor.mn.gov/bills/95/2027/0/HF/1/versions/'+ordinal+'/';
      const statusAt=new Date().toISOString();
      // Calendar is synthetic; acquisition and DB acceptance use the real
      // test clock. The production runner's January 2027 gate is not bypassed.
      const version=(await db!.query<{id:string}>(`INSERT INTO bill_versions(bill_id,version_key,published_at,text_url,raw_text,text_hash)
        VALUES($1,$2,now()-interval '1 day',$3,$4,$5) RETURNING id`,[bill,key,url,existingText??null,existingText?sha(Buffer.from(existingText)):null])).rows[0].id;
      await db!.query(`UPDATE bills SET metadata=metadata||$2::jsonb WHERE id=$1`,[bill,JSON.stringify({
        revisorLiveStatus:{fetchedAt:statusAt,currentVersionKind:'engrossment',currentVersion:{documentName:key,htmlUrl:url}},
        revisorLiveStatusAttempt:{attemptedAt:statusAt,state:'succeeded'},
      })]);
      return {version,key,url};
    };
    const collect=async(ordinal:number,runId:string)=>{
      return with2027ArchivedSources(runId,(receipt,bytes)=>archive2027Source(db!,receipt,bytes),
        ()=>collect2027CurrentTextBatch(db!,1),async url=>{
          assert.equal(String(url),'https://www.revisor.mn.gov/bills/95/2027/0/HF/1/versions/'+ordinal+'/');
          return new Response(html(ordinal),{headers:{'content-type':'text/html'}});
        });
    };
    const first=await markCurrent(1);
    assert.deepEqual(await collect(1,'301:1'),{selected:1,captured:1,failed:0,failedIdentifiers:[]});
    const observations=async()=> (await db!.query('SELECT * FROM forecast_bill_text_observations ORDER BY observed_at,id')).rows;
    const original=(await observations())[0];
    assert.equal(original.bill_version_id,first.version);
    assert.equal(original.version_key,first.key);
    assert.deepEqual(await collect(1,'302:1'),{selected:0,captured:0,failed:0,failedIdentifiers:[]});
    const second=await markCurrent(2);
    assert.deepEqual(await collect(2,'303:1'),{selected:1,captured:1,failed:0,failedIdentifiers:[]});
    const rows=await observations();
    assert.equal(rows.length,2);
    assert.deepEqual(rows.find(row=>row.id===original.id),original);
    const latest=rows.find(row=>row.bill_version_id===second.version);
    assert.ok(latest);assert.notEqual(latest.text_sha256,original.text_sha256);
    const bindings=(await db.query<{body:Buffer}>('SELECT body FROM evidence_content_blobs WHERE media_type=$1',[CURRENT_TEXT_BINDING_TYPE])).rows.map(row=>JSON.parse(row.body.toString()));
    assert.equal(bindings.length,2);
    const binding=bindings.find(row=>row.versionKey===second.key);
    assert.equal(binding.observationId,'observation:'+latest.id);
    assert.equal(binding.rawSha256,sha(Buffer.from(html(2))));
    assert.equal(binding.textSha256,latest.text_sha256);
    const conflicting='Existing incompatible retained version content. '.repeat(6);
    const third=await markCurrent(3,conflicting);
    assert.deepEqual(await collect(3,'304:1'),{selected:1,captured:0,failed:1,failedIdentifiers:['HF1']});
    assert.deepEqual(await observations(),rows);
    const retained=(await db.query<{raw_text:string}>('SELECT raw_text FROM bill_versions WHERE id=$1',[third.version])).rows[0];
    assert.equal(retained.raw_text,conflicting);
    const state=(await db.query<{capture:string;attempt:string}>(`SELECT metadata #>> '{revisorCurrentTextCapture,versionKey}' AS capture,
      metadata #>> '{revisorCurrentTextAttempt,state}' AS attempt FROM bills WHERE id=$1`,[bill])).rows[0];
    assert.deepEqual(state,{capture:second.key,attempt:'failed'});
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});

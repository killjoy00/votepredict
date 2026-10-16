import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {statementSessionEvidence} from '../src/operations/senate-identity-bill-backfill.js';
import {RevisorPacer} from '../src/operations/senate-revisor-pacer.js';
import {importOfficialMinnesotaBillUniverse} from '../src/operations/senate-bill-universe.js';
import {reconcileMissingSenateCompanionTargets} from '../src/operations/senate-bill-companions.js';

test('publication date takes precedence; archived observation is an explicitly labeled upper bound',()=>{
  const url='https://www.senate.mn/caucus/press/undated-release';
  assert.deepEqual(statementSessionEvidence(null,url,'2024-04-01 11:45:00+00'),{
    slug:'2023-2024',method:'archive_capture_upper_bound',
  });
  assert.deepEqual(statementSessionEvidence('2021-04-01',url,'2025-08-01 10:00:00+00'),{
    slug:'2021-2022',method:'published_on',
  });
  assert.deepEqual(statementSessionEvidence(null,'https://www.senate.mn/news/2023/example',
    '2025-08-01 10:00:00+00'),{slug:'2023-2024',method:'url_year'});
  assert.deepEqual(statementSessionEvidence(null,url,null),{slug:null,method:'unresolved'});
  assert.deepEqual(statementSessionEvidence(null,url,'2027-02-02 10:00:00+00'),
    {slug:null,method:'unresolved'});
});

test('Revisor courtesy pacer spaces every request and rejects sub-second budgets',async()=>{
  let now=5000;
  const sleeps:number[]=[];
  const pacer=new RevisorPacer({
    now:()=>now,sleep:async ms=>{sleeps.push(ms);now+=ms;},
  });
  await pacer.wait();await pacer.wait();await pacer.wait();
  assert.deepEqual(sleeps,[1150,1150]);
  assert.throws(()=>new RevisorPacer({intervalMs:100}),/at least one second/);
});

test('protected repair runner is scheduled, main-verified, and migration 0023 only adds raw metadata',()=>{
  const sql=readFileSync('migrations/0023_senate_statement_session_provenance.sql','utf8');
  const script=readFileSync('scripts/deploy-senate-identity-bill-repair-neon.ts','utf8');
  const workflow=readFileSync('.github/workflows/senate-identity-bill-repair-production.yml','utf8');
  assert.match(sql,/ADD COLUMN IF NOT EXISTS session_match_method/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS senate_revisor_bill_catalog_ranges/);
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  assert.match(script,/SENATE_IDENTITY_BILL_REPAIR_PRODUCTION/);
  assert.match(script,/filenames.length!==23/);
  assert.ok(workflow.includes("cron: '17 * * * *'"));
  assert.match(workflow,/needs.independent-main.result == 'success'/);
  assert.match(workflow,/environment: evidence-readonly-sandbox/);
});

const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!url&&['localhost','127.0.0.1'].includes(new URL(url).hostname);

test('Postgres: official SF/HF range import is bounded, resumable, additive; missing companion heals without refetch',
  {skip:!local,timeout:90_000},async()=>{
  const pool=new Pool({connectionString:url!,max:2});
  const root=await pool.connect();
  let billId:string;
  let sessionId:string;
  try{
    const juris=(await root.query<{id:string}>(
      "INSERT INTO jurisdictions(slug,name,country_code) VALUES ('us-mn','Minnesota','US') "+
      "ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
    )).rows[0].id;
    const chamberIds:Record<string,string>={};
    for(const slug of ['senate','house']){
      chamberIds[slug]=(await root.query<{id:string}>(
        "INSERT INTO chambers(jurisdiction_id,slug,name,kind) "+
        "VALUES($1,$2,$3,$4) ON CONFLICT(jurisdiction_id,slug) "+
        "DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [juris,slug,slug==='senate'?'Minnesota Senate':'Minnesota House',
          slug==='senate'?'upper':'lower'],
      )).rows[0].id;
    }
    for(const slug of ['2021-2022','2023-2024','2025-2026']){
      const id=(await root.query<{id:string}>(
        "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) "+
        "VALUES($1,$2,$3,$4::date,$5::date) ON CONFLICT(jurisdiction_id,slug) "+
        "DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [juris,slug,slug,slug.slice(0,4)+'-01-01',slug.slice(5)+'-12-31'],
      )).rows[0].id;
      if(slug==='2025-2026')sessionId=id;
    }
    billId=(await root.query<{id:string}>(
      "INSERT INTO bills(session_id,originating_chamber_id,identifier,title) "+
      "VALUES($1,$2,'SF7821','Preexisting source bill') "+
      "ON CONFLICT(session_id,identifier) DO UPDATE SET title=EXCLUDED.title RETURNING id",
      [sessionId!,chamberIds.senate],
    )).rows[0].id;
    await root.query(
      "INSERT INTO senate_bill_companion_scans "+
      "(senate_bill_id,session_id,source_url,fetched_at,printed_companion_identifier,result) "+
      "VALUES($1,$2,$3,now(),'HF7822','target_missing') "+
      "ON CONFLICT(senate_bill_id) DO UPDATE SET result='target_missing',printed_companion_identifier='HF7822'",
      [billId!,sessionId!,'https://api.revisor.mn.gov/bills/v1/94/2025/0/SF/7821/'],
    );
  }finally{root.release();}
  const originalFetch=globalThis.fetch;
  let calls=0;
  const now={value:1000};
  try{
    assert.equal(await reconcileMissingSenateCompanionTargets(pool),0);
    globalThis.fetch=(async(input:RequestInfo|URL)=>{
      calls++;
      const request=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
      assert.equal(request.hostname,'www.revisor.mn.gov');
      const body=request.searchParams.get('body');
      const [first]=String(request.searchParams.get('bill')).split('-').map(Number);
      const session=String(request.searchParams.get('session'));
      const year=Number(session.slice(3));
      const legislature=Number(session.slice(0,3));
      const type=body==='House'?'HF':'SF';
      const number=body==='House'?7822:7821;
      const item=first===7501
        ? '<BILL_RESULT><FILE_TYPE>'+type+'</FILE_TYPE><FILE_NUMBER>'+number+
          '</FILE_NUMBER><DESCRIPTION>Official test bill</DESCRIPTION><STATUS_XML_URI>'+
          'api.revisor.mn.gov/bills/v1/'+legislature+'/'+year+'/0/'+type+'/'+number+
          '/</STATUS_XML_URI></BILL_RESULT>' : '';
      return new Response('<SEARCH_RESULTS>'+item+'</SEARCH_RESULTS>',{
        status:200,headers:{'content-type':'application/xml'},
      });
    }) as typeof fetch;
    const pacer=new RevisorPacer({
      now:()=>now.value,sleep:async ms=>{now.value+=ms;},
    });
    const first=await importOfficialMinnesotaBillUniverse(pool,pacer);
    assert.equal(first.completed,true);
    assert.equal(first.rangesFetched,144);
    assert.equal(first.inserted,5);
    assert.equal(calls,144);
    assert.equal(await reconcileMissingSenateCompanionTargets(pool),1);
    assert.equal(await reconcileMissingSenateCompanionTargets(pool),0);
    const link=(await pool.query<{n:number;status:string}>(
      "SELECT count(bc.id)::int AS n,max(s.result) AS status "+
      "FROM senate_bill_companion_scans s LEFT JOIN bill_companions bc "+
      "ON bc.senate_bill_id=s.senate_bill_id WHERE s.senate_bill_id=$1",
      [billId!],
    )).rows[0];
    assert.equal(link.n,1);
    assert.equal(link.status,'linked');
    const second=await importOfficialMinnesotaBillUniverse(pool,pacer);
    assert.equal(second.rangesAlreadyRecorded,144);
    assert.equal(second.rangesFetched,0);
    assert.equal(calls,144);
  }finally{globalThis.fetch=originalFetch;await pool.end();}
});

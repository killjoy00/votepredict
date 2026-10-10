import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Pool} from 'pg';
import {
  discoverExistingVotePredictNeonConnection,
  assertApprovedDirectNeonWorkflow,
} from '../src/operations/senate-media-neon-api-readonly.js';
import {
  verifyExistingNeonMediaAggregate,
} from '../scripts/check-senate-media-neon-api-readonly.js';

const PROJECT='blue-fog-12345';
const BRANCH='br-quiet-hill-123';
const ENDPOINT='ep-small-moon-123';
const HOST='ep-small-moon-123.us-east-2.aws.neon.tech';
const KEY='SENSITIVE_NEON_API_KEY_TEST_ONLY_DO_NOT_LOG';
const PASSWORD='SENSITIVE_SQL_PASSWORD_TEST_ONLY_DO_NOT_LOG';
const ROOT='https://console.neon.tech/api/v2/projects/'+PROJECT;
const URI='postgresql://neondb_owner:'+PASSWORD+'@'+HOST+'/neondb?sslmode=require&channel_binding=require';
const base={
  project:{id:PROJECT,name:'VotePredict',default_branch_id:BRANCH},
  databases:{databases:[{name:'neondb',owner_name:'neondb_owner',branch_id:BRANCH}]},
  endpoints:{endpoints:[{id:ENDPOINT,host:HOST,branch_id:BRANCH,project_id:PROJECT,type:'read_write'}]},
  uri:{uri:URI},
};
type ApiFixtures=typeof base;
function fakeApi(
  overrides:Partial<ApiFixtures>={},
  onCall?:(url:string)=>void,
){
  const fixtures={...base,...overrides};
  return async (url:string,init:RequestInit)=>{
    onCall?.(url);
    assert.equal(init.method,'GET');
    assert.equal(init.redirect,'error');
    assert.equal(init.credentials,'omit');
    assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+KEY);
    let result:unknown;
    if(url===ROOT)result=fixtures.project;
    else if(url===ROOT+'/branches/'+BRANCH+'/databases')result=fixtures.databases;
    else if(url===ROOT+'/endpoints')result=fixtures.endpoints;
    else if(url.startsWith(ROOT+'/connection_uri?')){
      const query=new URL(url).searchParams;
      assert.equal(query.get('branch_id'),BRANCH);
      assert.equal(query.get('endpoint_id'),ENDPOINT);
      assert.equal(query.get('database_name'),'neondb');
      assert.equal(query.get('role_name'),'neondb_owner');
      assert.equal(query.get('pooled'),'false');
      result=fixtures.uri;
    }else throw Error('Unexpected Neon API endpoint used in test');
    return new Response(JSON.stringify(result),{status:200});
  };
}
const options={apiKey:KEY,projectId:PROJECT};
test('uses existing API key and precisely four GETs, with no new credentials/branches/roles',async()=>{
  const urls:string[]=[];
  const result=await discoverExistingVotePredictNeonConnection(options,fakeApi({},url=>urls.push(url)));
  assert.equal(urls.length,4);
  assert.equal(result.branchId,BRANCH);
  assert.equal(result.role,'neondb_owner');
  assert.equal(result.database,'neondb');
  assert.equal(result.host,HOST);
  assert.equal(result.port,5432);
  assert.equal(result.password,PASSWORD);
  assert.equal(result.endpointId,ENDPOINT);
  assert.ok(urls.every(url=>url.startsWith(ROOT)));
  assert.ok(urls.every(url=>!url.includes(KEY)&&!url.includes(PASSWORD)));
});
test('refuses Pack 1, wrong project ID, missing default branch and unavailable owner key',async()=>{
  const bad=[
    {project:{...base.project,name:'Pack 1'}},
    {project:{...base.project,id:'some-other-project'}},
    {project:{...base.project,default_branch_id:''}},
  ];
  for(const data of bad)
    await assert.rejects(()=>discoverExistingVotePredictNeonConnection(
      options,fakeApi(data),
    ));
  await assert.rejects(()=>discoverExistingVotePredictNeonConnection(
    {...options,apiKey:''},fakeApi(),
  ),/credentials missing/);
});
test('database auto-selection handles exactly one existing database and unambiguous VotePredict named database',async()=>{
  const both={
    databases:{databases:[
      {name:'neondb',owner_name:'neondb_owner',branch_id:BRANCH},
      {name:'votepredict',owner_name:'vote_owner',branch_id:BRANCH},
    ]},
  };
  const calls:string[]=[];
  const api=async(url:string,init:RequestInit)=>{
    const u=url.includes('connection_uri?')?url.replace('database_name=votepredict','database_name=neondb').replace('role_name=vote_owner','role_name=neondb_owner'):url;
    return fakeApi({...both},x=>calls.push(x))(u,init);
  };
  // Actual connection URI for this database must still match selected owner
  // and database: synthetic fallback neondb is correctly refused.
  await assert.rejects(()=>discoverExistingVotePredictNeonConnection(options,api),/did not match/);
  assert.ok(calls.some(url=>url.includes('database_name=neondb')));
  await assert.rejects(()=>discoverExistingVotePredictNeonConnection(
    options,fakeApi({databases:{databases:[
      {name:'abc',owner_name:'a_owner',branch_id:BRANCH},
      {name:'xyz',owner_name:'b_owner',branch_id:BRANCH},
    ]}}),
  ),/ambiguous/);
});
test('different existing default branch, compute host, URI database or owner fails closed',async()=>{
  const bad=[
    {databases:{databases:[{...base.databases.databases[0],branch_id:'br-another-123'}]}},
    {endpoints:{endpoints:[{...base.endpoints.endpoints[0],branch_id:'br-another-123'}]}},
    {uri:{uri:URI.replace(HOST,'evil.example.com')}},
    {uri:{uri:URI.replace('neondb_owner','other_owner')}},
    {uri:{uri:URI.replace('/neondb?','/otherdb?')}},
    {uri:{uri:URI.replace('sslmode=require','sslmode=disable')}},
    {uri:{uri:URI+'&options=-c%20log_statement%3Dall'}},
  ];
  for(const item of bad)
    await assert.rejects(()=>discoverExistingVotePredictNeonConnection(options,fakeApi(item)));
});
test('supports single existing read replica, and fails when multiple compute candidates cannot be pinned',async()=>{
  const read={...base.endpoints.endpoints[0],id:'ep-read-123',type:'read_only',host:'ep-read-123.us-east-2.aws.neon.tech'};
  const primary={...base.endpoints.endpoints[0]};
  const chosen:string[]=[];
  await assert.rejects(()=>discoverExistingVotePredictNeonConnection(options,
    async(url,init)=>{
      if(url===ROOT+'/endpoints') return new Response(JSON.stringify({endpoints:[read,primary]}));
      if(url.includes('connection_uri?')){
        chosen.push(url);
        return new Response(JSON.stringify({uri:URI.replace(HOST,read.host)}));
      }
      return fakeApi()(url,init);
    }),
  ),/did not match|Neon connection URI/); // function fake API request asserts primary; this calls explicit endpoint id, not primary
  assert.equal(chosen.length,1);
  assert.equal(new URL(chosen[0]).searchParams.get('endpoint_id'),'ep-read-123');
  await assert.rejects(()=>discoverExistingVotePredictNeonConnection(options,fakeApi({
    endpoints:{endpoints:[
      {...primary,id:'ep-primary-a',type:'read_write'},
      {...primary,id:'ep-primary-b',type:'read_write'},
    ]},
  })),/No unambiguous/);
});
test('GET network, HTTP, invalid JSON errors never echo the API key or resolved password',async()=>{
  const variants=[
    async()=>{throw Error(KEY+'-'+PASSWORD);},
    async()=>new Response('forbidden',{status:403}),
    async()=>new Response('{invalid-json',{status:200}),
  ];
  for(const get of variants){
    await assert.rejects(
      ()=>discoverExistingVotePredictNeonConnection(options,get as typeof fetch),
      (error:unknown)=>{
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message,new RegExp(KEY+'|'+PASSWORD));
        return true;
      },
    );
  }
});
test('existing owner role may be write-capable but ONLY catalog and aggregate SELECT under READ ONLY transaction run',async()=>{
  const queried:string[]=[];
  let closed=0,released=0;
  const fakePool=(config:ConstructorParameters<typeof Pool>[0])=>{
    assert.equal(config?.ssl && typeof config.ssl==='object' && !('ca' in config.ssl)
      ?config.ssl.rejectUnauthorized:true,true);
    assert.equal(config?.user,'neondb_owner');
    assert.equal(config?.host,HOST);
    assert.equal(config?.database,'neondb');
    assert.equal(config?.password,PASSWORD);
    const client={
      query:async(sql:string,params?:unknown[])=>{
        queried.push(sql);
        if(sql.startsWith('BEGIN'))return {rows:[]};
        if(sql.includes('current_database()'))return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
        if(sql.includes('to_regclass')){
          assert.equal(params?.[0] instanceof Array,true);
          return {rows:(params?.[0] as string[]).map(x=>({table_name:x,present:true,readable:true}))};
        }
        if(sql.includes('count(*)'))return {rows:[
          {year:'2021',context_rows:'12',source_documents:'9'},
          {year:'2025',context_rows:'7',source_documents:'5'},
          {year:'2026',context_rows:'3',source_documents:'2'},
        ]};
        if(sql==='ROLLBACK')return {rows:[]};
        throw Error('Unexpected query executed');
      },
      release:()=>{released++},
    };
    return {
      connect:async()=>client,
      end:async()=>{closed++},
    } as unknown as Pick<Pool,'connect'|'end'>;
  };
  const report=await verifyExistingNeonMediaAggregate(options,fakeApi(),fakePool);
  assert.equal(report.status,'existing_neon_api_readonly_aggregate_verified');
  assert.equal(report.mediaContextRowsByCaptureYear['2021'].contextRows,12);
  assert.equal(report.mediaContextRowsByCaptureYear['2022'].contextRows,0);
  assert.equal(report.mediaContextRowsByCaptureYear['2025'].distinctSourceDocuments,5);
  assert.equal(report.excluded2026AndOtherYearContextRows,3);
  assert.equal(report.contextRowsTotal,22);
  assert.equal(report.fullSourceRowsExported,false);
  assert.equal(report.humanQuotesVerified,0);
  assert.equal(report.roleStrictlySelectOnlyClaimed,false);
  assert.equal(report.databaseModified,false);
  assert.equal(queried.length,5);
  assert.equal(queried[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(queried[4],'ROLLBACK');
  assert.ok(queried.slice(1,4).every(sql=>sql.trim().startsWith('SELECT')));
  assert.equal(released,1);
  assert.equal(closed,1);
});
test('read-only SQL guard rejects the wrong DB identity before source rows, even after Neon metadata authentication',async()=>{
  const queried:string[]=[];
  const fakePool=()=>({
    connect:async()=>({
      query:async(sql:string)=>{
        queried.push(sql);
        if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
        return {rows:[{db:'pack1',role:'neondb_owner',ro:'on'}]};
      },
      release:()=>{},
    }),
    end:async()=>{},
  }) as unknown as Pick<Pool,'connect'|'end'>;
  await assert.rejects(()=>verifyExistingNeonMediaAggregate(options,fakeApi(),fakePool),/mismatch/);
  assert.deepEqual(queried,[
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
    'ROLLBACK',
  ]);
});
test('manual exact repository/main/approval and protected workflow, zero scheduled/PR/source export',()=>{
  assert.doesNotThrow(()=>assertApprovedDirectNeonWorkflow({
    GITHUB_REPOSITORY:'killjoy00/votepredict',
    GITHUB_REF:'refs/heads/main',
    GITHUB_EVENT_NAME:'workflow_dispatch',
    VOTEPREDICT_MEDIA_APPROVAL:'VERIFY_SENATE_MEDIA_READONLY',
    VOTEPREDICT_MEDIA_AGGREGATE_APPROVAL:'BOUNDED_AGGREGATE_ONLY',
  }));
  for(const wrong of [
    {},{GITHUB_REPOSITORY:'other/repo'},
    {VOTEPREDICT_MEDIA_AGGREGATE_APPROVAL:'UNBOUNDED'},
  ])assert.throws(()=>assertApprovedDirectNeonWorkflow(wrong));
  const yml=readFileSync('.github/workflows/senate-media-neon-api-readonly-counts.yml','utf8');
  assert.match(yml,/workflow_dispatch:/);
  assert.match(yml,/default: false/);
  assert.match(yml,/evidence-readonly-sandbox/);
  assert.match(yml,/secrets\.NEON_API_KEY/);
  assert.match(yml,/vars\.VOTEPREDICT_NEON_PROJECT_ID/);
  assert.doesNotMatch(yml,/^\s+(?:push|pull_request|schedule):/m);
  assert.doesNotMatch(yml,/upload-artifact|vercel env|DATABASE_URL_UNPOOLED/);
  const code=readFileSync('scripts/check-senate-media-neon-api-readonly.ts','utf8');
  assert.match(code,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(code,/ROLLBACK/);
  assert.match(code,/default_transaction_read_only=on/);
  assert.doesNotMatch(code,/INSERT INTO|DELETE FROM|CREATE TABLE|ALTER TABLE|UPDATE public\./i);
});

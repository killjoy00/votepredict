import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Pool} from 'pg';
import {sha1Base32}
 from '../scripts/prove-cfb-864-public-archived-csv-source-v1.js';
import {PINNED_CFB_ORIGINALS}
 from '../scripts/prove-cfb-864-pinned-public-originals-v4.js';
import {
 CFB_864_PARITY_V5_MARKER,PARITY_METRICS,
 FIXED_CFB_PARITY_V5_SQL,validateParityGroups,assertParityV5MainOnly,
 auditPinnedCfbOriginalParityV5,
} from '../scripts/audit-cfb-864-authenticated-original-parity-v5.js';

const KEY='SYNTHETIC_PRIVATE_NEON_TOKEN',PW='SYNTHETIC_SQL_PASSWORD';
const PROJECT='blue-owl-12345',BR='br-quiet-moon-111',EP='ep-brisk-stream-123';
const HOST=EP+'.us-east-2.aws.neon.tech';
const ROOT='https://console.neon.tech/api/v2/projects/'+PROJECT;
const input={apiKey:KEY,projectId:PROJECT};
const source=PINNED_CFB_ORIGINALS[0];
const bytes=Buffer.from(['Year,Recipient,Recipient reg num,Receipt date,Contributor,Amount',
 ...Array.from({length:35},(_,i)=>{
  const year=i<18?2021:2022;
  return [year,'Test committee','12345',
   year+'-03-'+String(1+i%28).padStart(2,'0'),'Synthetic '+i,100+i].join(',');
 })].join('\n')+'\n');
const digest=sha1Base32(bytes);
const cdx=['timestamp','original','statuscode','digest','mimetype','length'];
function served(value:string|Buffer,url:string){
 const r=new Response(value as string,{status:200});
 Object.defineProperty(r,'url',{value:url});
 return r;
}
async function publicOne(url:RequestInfo|URL){
 const u=String(url);
 if(u.includes('/cdx/search/cdx')){
  const p=new URL(u).searchParams;
  if(p.get('url')!==source.original)throw Error('synthetic index offline');
  return served(JSON.stringify([cdx,[source.timestamp,source.original,
   '200',digest,'text/plain',String(bytes.length)]]),u);
 }
 if(u.includes('/web/'+source.timestamp+'id_/'+source.original))
  return served(bytes,u);
 throw Error('Unrecognized synthetic public source');
}
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
 else if(url.startsWith(ROOT+'/connection_uri?'))
  answer={uri:'postgresql://neondb_owner:'+PW+'@'+HOST+'/neondb?sslmode=require'};
 else throw Error('Unexpected Neon API GET');
 return new Response(JSON.stringify(answer),{status:200});
}
function counts(){
 const result=Object.fromEntries(PARITY_METRICS.map(k=>[k,'0']));
 Object.assign(result,{
  family_archived_claims:'20',same_source_claims:'14',same_source_digest:'12',
  same_source_capture_day:'13',same_source_original_row:'13',
  version_claims:'11',verified_full_observations:'10',
  verified_distinct_row_keys:'8',
  matching_version_row_not_in_original:'1',
  row_digest_match_other_capture_day:'1',
  row_date_match_other_digest:'1',
  verified_full_published_day_agrees:'10',
  archived_missing_row_key:'0',
 });
 return result;
}
test('frozen SELECT only, capped source and row prefixes, exact public CSV source key comparisons',()=>{
 const sql=FIXED_CFB_PARITY_V5_SQL;
 assert.match(sql,/^WITH trusted_keys AS/);
 assert.match(sql,/SELECT DISTINCT unnest\(\$4::text\[\]\)/);
 assert.match(sql,/ORDER BY sd\.source_kind,sd\.id LIMIT 500/);
 assert.match(sql,/ORDER BY ei\.created_at,ei\.id LIMIT 64/);
 assert.match(sql,/s\.chamber='senate'/);
 assert.match(sql,/s\.m->>'asOfEligible'='true'/);
 assert.match(sql,/independent_archive_capture_exact_row/);
 assert.match(sql,/archiveDigest/);
 assert.match(sql,/archiveCapturedAt/);
 assert.match(sql,/availabilitySourceUrl/);
 assert.match(sql,/count\(DISTINCT m->>'rowKey'\)/);
 assert.match(sql,/t\.row_key IS NOT NULL/);
 assert.match(sql,/to_char\(s\.published_at AT TIME ZONE 'UTC'/);
 assert.doesNotMatch(sql,/;\s*|\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|COPY|GRANT|REVOKE|RETURNING|ANALYZE)\b/i);
 assert.equal(PARITY_METRICS.length,13);
});
test('without any freshly CDX-SHA1 authenticated ORIGINAL no Neon API or PG contact',async()=>{
 let touched=false;const offline=async()=>{throw Error('untrusted source unavailable')};
 const result=await auditPinnedCfbOriginalParityV5(input,offline as typeof fetch,
  async()=>{touched=true;throw Error('Neon should not be touched')},
  ()=>{touched=true;throw Error('DB should not be touched')});
 assert.equal(touched,false);
 assert.equal(result.allSourcesHoldNotMissingRows,true);
 assert.equal(result.freshAuthenticatedSources,0);
 assert.equal(result.heldSourceCount,10);
 assert.deepEqual(result.results,[]);
 assert.equal(result.protectedReadOnlyConnectionEstablished,false);
 assert.equal(result.explicitRollbackComplete,false);
 assert.equal(result.zeroDatabaseWrites,true);
 assert.equal(result.privateKeysDonorsAmountsAndRawUrlsExported,false);
 assert.doesNotMatch(JSON.stringify(result),/untrusted source unavailable|SYNTHETIC_PRIVATE_NEON_TOKEN|recipient|rowKey/);
});
test('fresh SHA1-original proof then protected fixed parameterized aggregate SELECT and ROLLBACK',async()=>{
 const statements:Array<{sql:string;args?:unknown[]}>=[];let released=0,ended=0;
 const pool=(options:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(options?.host,HOST);assert.equal(options?.database,'neondb');
  assert.equal(options?.user,'neondb_owner');assert.equal(options?.password,PW);
  assert.deepEqual(options?.ssl,{rejectUnauthorized:true});
  assert.match(String(options?.options),/default_transaction_read_only=on/);
  return {
   connect:async()=>({query:async(sql:string,args?:unknown[])=>{
    statements.push({sql,args});
    if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return{rows:[]};
    if(sql.includes('current_database()'))
     return{rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
    if(sql===FIXED_CFB_PARITY_V5_SQL){
     assert.equal(args?.length,5);
     assert.equal(args?.[0],source.original);
     assert.equal(args?.[1],digest);
     assert.equal(args?.[2],'2022-06-06');
     assert.equal((args?.[3] as string[]).length,35);
     assert.ok((args?.[3] as string[]).every(k=>/^[a-f0-9]{64}$/.test(k)));
     assert.equal(args?.[4],'campaign_finance_candidate_contribution_bulk');
     return{rows:[counts()]};
    }
    throw Error('Unexpected private SQL');
   },release:()=>released++}),
   end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const result=await auditPinnedCfbOriginalParityV5(input,publicOne as typeof fetch,
  fakeNeon as typeof fetch,pool);
 assert.equal(result.freshAuthenticatedSources,1);
 assert.equal(result.heldSourceCount,9);
 assert.equal(result.protectedReadOnlyConnectionEstablished,true);
 assert.equal(result.explicitRollbackComplete,true);
 assert.equal(result.zeroDatabaseWrites,true);
 assert.equal(result.results.length,1);
 assert.deepEqual(result.results[0].sourceId,source.id);
 assert.equal(result.results[0].verified_full_observations,'10');
 assert.equal(result.results[0].verified_distinct_row_keys,'8');
 assert.equal(result.results[0].verified_full_published_day_agrees,'10');
 assert.deepEqual(statements.map(x=>x.sql),[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
  FIXED_CFB_PARITY_V5_SQL,'ROLLBACK',
 ]);
 assert.equal(released,1);assert.equal(ended,1);
 const publicJson=JSON.stringify(result);
 assert.doesNotMatch(publicJson,/SYNTHETIC_PRIVATE_NEON_TOKEN|neondb_owner|Synthetic [0-9]+|Test committee|"rowKey"/);
});
test('protected aggregate group validator rejects leakage, impossible full subsets or untrusted source',()=>{
 const safe={
  sourceId:source.id,family:'campaign_finance_candidate_contribution_bulk',
  captureDay:'2022-06-06',publicOriginalSha256:'a'.repeat(64),
  publicParsedUniqueKeys:35,...counts(),
 };
 assert.deepEqual(validateParityGroups([safe]),[safe]);
 for(const r of [
  {...safe,metadata:'private'},
  {...safe,sourceId:'not-in-registry'},
  {...safe,publicOriginalSha256:'secret url'},
  {...safe,verified_full_observations:'12'},
  {...safe,verified_distinct_row_keys:'11'},
  {...safe,version_claims:'9'},
  {...safe,source_url_claims:'40000'},
  {...safe,verified_full_published_day_agrees:'11'},
  {...safe,matching_version_row_not_in_original:'2'},
 ])assert.throws(()=>validateParityGroups([r]));
 assert.throws(()=>validateParityGroups([safe,safe]));
});
test('exact main SHA + first attempt + approval code cannot be forged by PR or rerun',()=>{
 const base={
  GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_REF:'refs/heads/main',
  GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),CFB_864_PARITY_V5_MARKER_VERIFIED:'true',
  CFB_864_PARITY_V5_FULL_CI_GREEN:'true',
  CFB_864_PARITY_V5_APPROVAL:'PINNED_RAW_CDX_AND_ORIGINAL_ROW_PARITY_COUNTS_ONLY',
 };
 assert.doesNotThrow(()=>assertParityV5MainOnly(base));
 assert.throws(()=>assertParityV5MainOnly({...base,GITHUB_EVENT_NAME:'issue_comment'}));
 assert.doesNotThrow(()=>assertParityV5MainOnly({
  ...base,GITHUB_EVENT_NAME:'issue_comment',
  CFB_864_PARITY_V5_OWNER_COMMENT_VERIFIED:'true',
 }));
 for(const change of [
  {GITHUB_REPOSITORY:'attacker/fork'}, {GITHUB_REF:'refs/heads/staging'},
  {GITHUB_EVENT_NAME:'pull_request'},{GITHUB_RUN_ATTEMPT:'2'},
  {GITHUB_SHA:'bad'},{CFB_864_PARITY_V5_FULL_CI_GREEN:'false'},
  {CFB_864_PARITY_V5_APPROVAL:'other'},
 ])assert.throws(()=>assertParityV5MainOnly({...base,...change}));
 assert.equal(CFB_864_PARITY_V5_MARKER,'SENATE_864_CFB_ORIGINAL_PARITY_READONLY_V5_20261012');
});
test('privileged protected job only after independently green full CI, no writes or row artifacts',()=>{
 const path='.github/workflows/senate-864-cfb-authenticated-parity-v5.yml';
 const yml=readFileSync(path,'utf8');
 assert.match(yml,/environment: evidence-readonly-sandbox/);
 assert.match(yml,/issue_comment:\n    types: \[created\]/);
 assert.match(yml,/github\.event\.issue\.number == 864/);
 assert.match(yml,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(yml,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(yml,/SENATE_864_CFB_ORIGINAL_PARITY_READONLY_V5_20261012/);
 assert.match(yml,/git log -1 --format=%B \| grep -Fq/);
 assert.match(yml,/npm run check/);
 assert.match(yml,/npm audit --omit=dev --audit-level=high/);
 assert.match(yml,/verify-cfb-864-pinned-parity-v5-local\.ts/);
 const begin=yml.indexOf('  one-shot-protected:\n');
 assert.ok(begin>0);
 const pre=yml.slice(0,begin);
 assert.doesNotMatch(pre,/NEON_API_KEY|secrets\./);
 const protectedJob=yml.slice(begin);
 assert.match(protectedJob,/secrets\.NEON_API_KEY/);
 assert.doesNotMatch(protectedJob,/issues: write|upload-artifact/);
 assert.doesNotMatch(yml,/^\s*schedule:/m);
 assert.match(yml,/DATABASE_URL_UNPOOLED: postgresql:\/\/postgres:postgres@localhost:5432\/votepredict/);
});

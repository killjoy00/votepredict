import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {Pool} from 'pg';
import {sha1Base32}
 from '../scripts/prove-cfb-864-public-archived-csv-source-v1.js';
import {PARITY_METRICS,FIXED_CFB_PARITY_V5_SQL}
 from '../scripts/audit-cfb-864-authenticated-original-parity-v5.js';
import {
 V6_CANDIDATE_SOURCES,V4_EXPENDITURE_CHECKPOINT,
 matchesWholePriorOriginal,authenticatePriorProvenExpenditureV6,
 collectCandidateOriginalsV6,CFB_864_CANDIDATE_V6_MARKER,
} from '../scripts/prove-cfb-864-candidate-originals-v6.js';
import {
 assertCandidateV6MainOnly,auditCandidateOriginalParityV6,
 CFB_864_CANDIDATE_V6_APPROVAL,
} from '../scripts/audit-cfb-864-candidate-parity-v6.js';

const contribution=V6_CANDIDATE_SOURCES[0];
const expenditure=V6_CANDIDATE_SOURCES[2];
const bytes=Buffer.from(['Year,Recipient,Recipient reg num,Receipt date,Contributor,Amount',
 ...Array.from({length:35},(_,i)=>{
  const year=i<18?2021:2022;
  return [year,'Synthetic political committee','12345',
   year+'-03-'+String(1+i%28).padStart(2,'0'),'Synthetic '+i,100+i].join(',');
 })].join('\n')+'\n');
const digest=sha1Base32(bytes);
function served(value:string|Buffer,url:string,init:ResponseInit={status:200}){
 const r=new Response(value as string,init);
 Object.defineProperty(r,'url',{value:url});
 return r;
}
async function publicOne(url:RequestInfo|URL){
 const u=String(url);
 if(u.includes('/cdx/search/cdx')){
  const p=new URL(u).searchParams;
  if(p.get('url')!==contribution.original)throw Error('Synthetic source temporarily unavailable');
  return served(JSON.stringify([['timestamp','original','statuscode','digest','mimetype','length'],
   [contribution.timestamp,contribution.original,'200',digest,'text/plain',String(bytes.length)]]),u);
 }
 if(u.includes('/web/'+contribution.timestamp+'id_/'+contribution.original))
  return served(bytes,u);
 throw Error('Synthetic source temporarily unavailable');
}
const KEY='SYNTHETIC_READONLY_NEON_KEY',PW='SYNTHETIC_PASSWORD';
const PROJECT='blue-owl-12345',BR='br-quiet-moon-111',EP='ep-brisk-stream-123';
const HOST=EP+'.us-east-2.aws.neon.tech';
const ROOT='https://console.neon.tech/api/v2/projects/'+PROJECT;
const input={apiKey:KEY,projectId:PROJECT};
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
 else throw Error('Unexpected private API request');
 return new Response(JSON.stringify(answer),{status:200});
}
const counts=()=>{
 const row=Object.fromEntries(PARITY_METRICS.map(k=>[k,'0']));
 Object.assign(row,{
  family_archived_claims:'20',same_source_claims:'14',
  same_source_digest:'12',same_source_capture_day:'13',
  same_source_original_row:'13',version_claims:'11',
  verified_full_observations:'10',verified_distinct_row_keys:'8',
  matching_version_row_not_in_original:'1',
  row_digest_match_other_capture_day:'1',
  row_date_match_other_digest:'1',
  verified_full_published_day_agrees:'10',archived_missing_row_key:'0',
 });
 return row;
};
test('2022 expenditure fingerprint is exact immutable public V4 checkpoint',()=>{
 assert.deepEqual(V6_CANDIDATE_SOURCES.map(s=>s.id),[
  'cand_contrib_2022','cand_contrib_2023','cand_expend_2022']);
 assert.equal(V4_EXPENDITURE_CHECKPOINT.sourceId,expenditure.id);
 assert.equal(V4_EXPENDITURE_CHECKPOINT.originalBytes,41138871);
 assert.equal(V4_EXPENDITURE_CHECKPOINT.cdxSha1Base32,
  'GMF33XY3X4LNADGCPU52JWEDWRHXE23V');
 assert.equal(V4_EXPENDITURE_CHECKPOINT.originalSha256,
  '6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b');
 assert.equal(V4_EXPENDITURE_CHECKPOINT.rows2021,18497);
 assert.equal(V4_EXPENDITURE_CHECKPOINT.rows2022,3241);
 assert.equal(V4_EXPENDITURE_CHECKPOINT.distinctRowKeys,21495);
 assert.equal(Object.isFrozen(V4_EXPENDITURE_CHECKPOINT),true);
});
test('complete-body double hashing accepts synthetic exact bytes, rejects any tamper, truncation and swapped digest',()=>{
 const fixture=Buffer.from('Synthetic archived CSV full body\n'.repeat(60));
 const expectation={
  originalBytes:fixture.length,cdxSha1Base32:sha1Base32(fixture),
  originalSha256:createHash('sha256').update(fixture).digest('hex'),
 };
 assert.equal(matchesWholePriorOriginal(fixture,expectation),true);
 assert.equal(matchesWholePriorOriginal(Buffer.concat([fixture,Buffer.from('x')]),expectation),false);
 const changed=Buffer.from(fixture);changed[5]^=1;
 assert.equal(matchesWholePriorOriginal(changed,expectation),false);
 assert.equal(matchesWholePriorOriginal(fixture,{...expectation,
  originalSha256:'f'.repeat(64)}),false);
 assert.equal(matchesWholePriorOriginal(fixture,{...expectation,
  cdxSha1Base32:'A'.repeat(32)}),false);
});
test('expenditure retry never requests CDX; disallows different timestamps and wrong bytes',async()=>{
 const requested='https://web.archive.org/web/'+expenditure.timestamp+'id_/'+expenditure.original;
 const seen:string[]=[];
 const invalid=await authenticatePriorProvenExpenditureV6((async(url)=>{
  seen.push(String(url));return served('Not original CSV',String(url));
 }) as typeof fetch);
 assert.deepEqual(seen,[requested]);
 assert.equal(invalid.result.status,'replay_digest_mismatch');
 assert.equal(invalid.result.cdxRowsChecked,0);
 assert.equal(invalid.authenticated,null);
 const changed=await authenticatePriorProvenExpenditureV6((async(url)=>
  served('',String(url),{status:302,headers:{
   location:'https://web.archive.org/web/20220607103037id_/'+expenditure.original,
  }})) as typeof fetch);
 assert.equal(changed.result.status,'replay_redirect_hold');
 assert.equal(changed.result.replayRequests,1);
 const offsite=await authenticatePriorProvenExpenditureV6((async(url)=>
  served('',String(url),{status:302,headers:{location:'https://cfb.mn.gov/'}})) as typeof fetch);
 assert.equal(offsite.result.status,'replay_redirect_hold');
 const inaccessible=await authenticatePriorProvenExpenditureV6((async()=>{throw Error('timeout')})
  as typeof fetch);
 assert.equal(inaccessible.result.status,'replay_network_hold');
});
test('all three candidate originals held means no Neon discovery or private SQL and NO zero-row claim',async()=>{
 let touched=false;
 const result=await auditCandidateOriginalParityV6(input,
  (async()=>{throw Error('Synthetic Wayback unavailable')}) as typeof fetch,
  (async()=>{touched=true;throw Error('Neon must not be called')}) as typeof fetch,
  ()=>{touched=true;throw Error('Postgres must not be called')});
 assert.equal(touched,false);
 assert.equal(result.allSourcesHoldNotMissingRows,true);
 assert.equal(result.freshAuthenticatedSources,0);
 assert.equal(result.heldSourceCount,3);
 assert.equal(result.protectedReadOnlyConnectionEstablished,false);
 assert.equal(result.explicitRollbackComplete,false);
 assert.deepEqual(result.results,[]);
 assert.equal(result.zeroDatabaseWrites,true);
 assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_READONLY_NEON_KEY|Synthetic political committee|"rowKey"/);
});
test('two contributions remain independent CDX checks and expenditure checkpoint is separate',async()=>{
 const result=await collectCandidateOriginalsV6(publicOne as typeof fetch);
 assert.deepEqual(result.results.map(r=>r.id),V6_CANDIDATE_SOURCES.map(s=>s.id));
 assert.equal(result.results[0].status,'verified');
 assert.equal(result.results[1].status,'cdx_network_hold');
 assert.equal(result.results[2].status,'replay_network_hold');
 assert.equal(result.results[0].verified?.distinctRowKeys,35);
});
test('authenticated fresh-CDX candidate original reaches only fixed SELECT, bound keys, rollback',async()=>{
 const queries:Array<{sql:string;args?:unknown[]}>=[];let ended=0,released=0;
 const pool=(options:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(options?.host,HOST);assert.equal(options?.database,'neondb');
  assert.equal(options?.user,'neondb_owner');assert.equal(options?.password,PW);
  assert.deepEqual(options?.ssl,{rejectUnauthorized:true});
  assert.match(String(options?.options),/default_transaction_read_only=on/);
  return{
   connect:async()=>({query:async(sql:string,args?:unknown[])=>{
    queries.push({sql,args});
    if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return{rows:[]};
    if(sql.includes('current_database()'))
     return{rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
    if(sql===FIXED_CFB_PARITY_V5_SQL){
     assert.equal(args?.[0],contribution.original);
     assert.equal(args?.[1],digest);
     assert.equal(args?.[2],'2022-06-06');
     assert.equal((args?.[3] as string[]).length,35);
     assert.ok((args?.[3] as string[]).every(k=>/^[a-f0-9]{64}$/.test(k)));
     assert.equal(args?.[4],'campaign_finance_candidate_contribution_bulk');
     return{rows:[counts()]};
    }
    throw Error('Unexpected query');
   },release:()=>{released++}}),
   end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const receipt=await auditCandidateOriginalParityV6(input,
  publicOne as typeof fetch,fakeNeon as typeof fetch,pool);
 assert.equal(receipt.freshAuthenticatedSources,1);
 assert.equal(receipt.heldSourceCount,2);
 assert.equal(receipt.protectedReadOnlyConnectionEstablished,true);
 assert.equal(receipt.explicitRollbackComplete,true);
 assert.deepEqual(receipt.results.map(x=>x.sourceId),[contribution.id]);
 assert.equal(receipt.results[0].verified_full_observations,'10');
 assert.equal(receipt.results[0].verified_distinct_row_keys,'8');
 assert.equal(receipt.results[0].verified_full_published_day_agrees,'10');
 assert.deepEqual(queries.map(x=>x.sql),[
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
  FIXED_CFB_PARITY_V5_SQL,'ROLLBACK',
 ]);
 assert.equal(released,1);assert.equal(ended,1);
 assert.doesNotMatch(JSON.stringify(receipt),/SYNTHETIC_READONLY_NEON_KEY|neondb_owner|Synthetic [0-9]+|"rowKey"/);
});
test('V6 exact reviewed main marker, first attempt and full CI are mandatory',()=>{
 const good={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),
  GITHUB_EVENT_NAME:'push',CFB_864_CANDIDATE_V6_MARKER_VERIFIED:'true',
  CFB_864_CANDIDATE_V6_FULL_CI_GREEN:'true',
  CFB_864_CANDIDATE_V6_APPROVAL,
 };
 assert.doesNotThrow(()=>assertCandidateV6MainOnly(good));
 for(const patch of [
  {GITHUB_REPOSITORY:'attacker/repo'},{GITHUB_REF:'refs/heads/dev'},
  {GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_SHA:'bad'},{CFB_864_CANDIDATE_V6_MARKER_VERIFIED:'false'},
  {CFB_864_CANDIDATE_V6_FULL_CI_GREEN:'false'},
  {CFB_864_CANDIDATE_V6_APPROVAL:'WRONG'},
  {GITHUB_EVENT_NAME:'issue_comment'},
 ])assert.throws(()=>assertCandidateV6MainOnly({...good,...patch}));
 assert.doesNotThrow(()=>assertCandidateV6MainOnly({
  ...good,GITHUB_EVENT_NAME:'issue_comment',
  CFB_864_CANDIDATE_V6_OWNER_COMMENT_VERIFIED:'true',
 }));
 assert.equal(CFB_864_CANDIDATE_V6_MARKER,
  'SENATE_864_CFB_CANDIDATE_PARITY_READONLY_V6_20261012');
});
test('new workflow keeps all production credentials behind exact main CI and protected environment',()=>{
 const yml=readFileSync('.github/workflows/senate-864-cfb-candidate-parity-v6.yml','utf8');
 assert.match(yml,/environment: evidence-readonly-sandbox/);
 assert.match(yml,/github\.event\.issue\.number == 864/);
 assert.match(yml,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(yml,/npm run check/);
 assert.match(yml,/npm audit --omit=dev --audit-level=high/);
 assert.match(yml,/verify-cfb-864-pinned-parity-v5-local\.ts/);
 assert.match(yml,/SENATE_864_CFB_CANDIDATE_PARITY_READONLY_V6_20261012/);
 const begin=yml.indexOf('  one-shot-protected:\n');
 assert.ok(begin>0);
 assert.doesNotMatch(yml.slice(0,begin),/NEON_API_KEY|secrets\./);
 assert.match(yml.slice(begin),/secrets\.NEON_API_KEY/);
 assert.doesNotMatch(yml.slice(begin),/issues: write|upload-artifact/);
 assert.doesNotMatch(yml,/^\s*schedule:/m);
 assert.match(yml,/postgresql:\/\/postgres:postgres@localhost:5432\/votepredict/);
});

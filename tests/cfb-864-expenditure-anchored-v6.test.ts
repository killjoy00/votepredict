import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
 ANCHOR_ID,ANCHOR_TIMESTAMP,ANCHOR_ORIGINAL_BYTES,
 ANCHOR_ORIGINAL_CDX_SHA1,ANCHOR_ORIGINAL_SHA256,
 ANCHOR_ROWS_2021,ANCHOR_ROWS_2022,ANCHOR_DISTINCT_ROW_KEYS,
 CFB_864_EXP_V6_SCHEMA,CFB_864_EXP_V6_MARKER,
 reauthenticateFrozen2022CandidateExpenditure,auditAnchoredExpenditureV6,
 assertExpenditureV6Main,
} from '../scripts/audit-cfb-864-expenditure-anchored-v6.js';
import {PINNED_CFB_ORIGINALS}
 from '../scripts/prove-cfb-864-pinned-public-originals-v4.js';
import {FIXED_CFB_PARITY_V5_SQL}
 from '../scripts/audit-cfb-864-authenticated-original-parity-v5.js';

const source=PINNED_CFB_ORIGINALS.find(x=>x.id===ANCHOR_ID)!;
const replay='https://web.archive.org/web/'+source.timestamp+'id_/'+source.original;
function served(body:string,url:string,status=200,headers:Record<string,string>={}){
 const r=new Response(body,{status,headers});
 Object.defineProperty(r,'url',{value:url});
 return r;
}
test('V6 fixed whole-file proof is exactly public first-attempt authenticated candidate expenditures',()=>{
 assert.equal(CFB_864_EXP_V6_SCHEMA,'cfb-864-candidate-expenditure-frozen-original-v6');
 assert.equal(CFB_864_EXP_V6_MARKER,'SENATE_864_CFB_EXPENDITURE_ANCHORED_V6_20261012');
 assert.equal(source.timestamp,ANCHOR_TIMESTAMP);
 assert.equal(source.stream,'candidate_expenditures');
 assert.equal(new URL(source.original).searchParams.get('download'),'-1890073264');
 assert.equal(ANCHOR_ORIGINAL_CDX_SHA1,'GMF33XY3X4LNADGCPU52JWEDWRHXE23V');
 assert.equal(ANCHOR_ORIGINAL_SHA256,'6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b');
 assert.equal(ANCHOR_ORIGINAL_BYTES,41138871);
 assert.equal(ANCHOR_ROWS_2021,18497);assert.equal(ANCHOR_ROWS_2022,3241);
 assert.equal(ANCHOR_DISTINCT_ROW_KEYS,21495);
 assert.equal(ANCHOR_ORIGINAL_SHA256.length,64);
 assert.equal(ANCHOR_ORIGINAL_CDX_SHA1.length,32);
});
test('CDX index unavailable is irrelevant to immutable rehash; only same exact replay requested',async()=>{
 const calls:string[]=[];
 const testFetch=async(url:RequestInfo|URL,init?:RequestInit)=>{
  calls.push(String(url));
  assert.equal(init?.redirect,'manual');
  assert.equal(String(url),replay);
  return served('missing',replay,503);
 };
 const result=await reauthenticateFrozen2022CandidateExpenditure(testFetch as typeof fetch);
 assert.deepEqual(result,{status:'replay_http_hold'});
 assert.equal(calls.length,1);
 assert.ok(calls.every(x=>!x.includes('/cdx/search/cdx?')));
});
test('HTTP 302 may not change archive capture time, original selector or host',async()=>{
 for(const changed of [
  replay.replace('20220606103037','20220607103037'),
  replay.replace('download=-1890073264','download=-2113865252'),
  replay.replace('web.archive.org','evil.invalid'),
 ]){
  const f=async(url:RequestInfo|URL)=>served('',String(url),302,{location:changed});
  assert.deepEqual(await reauthenticateFrozen2022CandidateExpenditure(f as typeof fetch),
   {status:'replay_redirect_hold'});
 }
});
test('safe same capture HTTP protocol variant can follow once but cannot claim forged body',async()=>{
 const redirected=replay.replace('/https://cfb.mn.gov','/http://cfb.mn.gov');
 const calls:string[]=[];
 const f=async(url:RequestInfo|URL)=>{
  const value=String(url);calls.push(value);
  if(value===replay)return served('',value,302,{location:redirected});
  assert.equal(value,redirected);
  return served('X'.repeat(530),value,200,{'content-type':'text/plain'});
 };
 assert.deepEqual(await reauthenticateFrozen2022CandidateExpenditure(f as typeof fetch),
  {status:'replay_original_hash_hold'});
 assert.deepEqual(calls,[replay,redirected]);
});
test('raw file byte/digest mismatch, HTML interstitial and streamed length cap all fail',async()=>{
 for(const [response,status] of [
  [served('X'.repeat(1000),replay,200), 'replay_original_hash_hold'],
  [served('<html>'+('Y'.repeat(500))+'</html>',replay,200,
   {'content-type':'text/html'}), 'parser_identity_hold'],
  [served('X',replay,200,{'content-length':'120000001'}), 'replay_over_cap'],
 ] as const){
  const f=async()=>response;
  assert.equal((await reauthenticateFrozen2022CandidateExpenditure(f as typeof fetch)).status,
   status);
 }
});
test('network error has no Neon contact, no private data and is HOLD not zero stored rows',async()=>{
 let neonCalled=0,poolCalled=0;
 const f=async()=>{throw Error('Private external diagnostic — never print');};
 const neon=async()=>{neonCalled++;throw Error('Neon should not be called')};
 const pool=()=>{poolCalled++;throw Error('Protected DB should not be called')};
 const response=await auditAnchoredExpenditureV6({
  apiKey:'synthetic',projectId:'synthetic',
 },f as typeof fetch,neon as never,pool as never);
 assert.equal(response.result,'held_at_original');
 assert.equal(response.heldReason,'replay_network_hold');
 assert.equal(response.freshFullOriginalSha1AndSha256Match,false);
 assert.equal(response.protectedReadOnlyConnectionEstablished,false);
 assert.equal(response.explicitRollbackComplete,false);
 assert.equal(response.storedCandidateEvidenceChanged,false);
 assert.equal(response.productionWrites,0);
 assert.equal(response.parity,null);
 assert.equal(response.liveCdxIndexQueried,false);
 assert.equal(neonCalled,0);assert.equal(poolCalled,0);
 assert.doesNotMatch(JSON.stringify(response),/synthetic|Private external diagnostic/);
});
test('approved reviewed main first attempt only, never PR or unverified owner comment',()=>{
 const pass={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',
  GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),CFB_864_EXP_V6_MAIN_MARKER_VERIFIED:'true',
  CFB_864_EXP_V6_FULL_CI_GREEN:'true',
  CFB_864_EXP_V6_APPROVAL:'FROZEN_PUBLIC_CDX_AND_FULL_RAW_SHA256_COUNT_ONLY',
 };
 assert.doesNotThrow(()=>assertExpenditureV6Main(pass));
 assert.throws(()=>assertExpenditureV6Main({...pass,GITHUB_EVENT_NAME:'issue_comment'}));
 assert.doesNotThrow(()=>assertExpenditureV6Main({...pass,GITHUB_EVENT_NAME:'issue_comment',
  CFB_864_EXP_V6_OWNER_COMMENT_VERIFIED:'true'}));
 for(const fail of [
  {GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REF:'refs/heads/feature'},
  {CFB_864_EXP_V6_MAIN_MARKER_VERIFIED:'false'},
  {CFB_864_EXP_V6_FULL_CI_GREEN:'false'},
  {GITHUB_REPOSITORY:'wrong/repo'},{GITHUB_SHA:'wrong'},
  {GITHUB_EVENT_NAME:'pull_request'},
 ])assert.throws(()=>assertExpenditureV6Main({...pass,...fail}));
});
test('strict reusable V5 private bound SQL is only count aggregates over exact sampled Senate membership',()=>{
 assert.match(FIXED_CFB_PARITY_V5_SQL,/SELECT DISTINCT unnest\(\$4::text\[\]\) AS row_key/);
 assert.match(FIXED_CFB_PARITY_V5_SQL,/ORDER BY sd\.source_kind,sd\.id LIMIT 500/);
 assert.match(FIXED_CFB_PARITY_V5_SQL,/ORDER BY ei\.created_at,ei\.id LIMIT 64/);
 assert.match(FIXED_CFB_PARITY_V5_SQL,/WHERE s\.chamber='senate'/);
 assert.match(FIXED_CFB_PARITY_V5_SQL,/same_source AND same_digest AND same_day AND has_original_row/);
 assert.match(FIXED_CFB_PARITY_V5_SQL,/COUNT|count/);
 assert.doesNotMatch(FIXED_CFB_PARITY_V5_SQL,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b/i);
});
test('protected V6 workflow grants no issue writer/artifact and uses explicit sandbox only after presecret',()=>{
 const file='.github/workflows/senate-864-cfb-expenditure-anchored-v6.yml';
 const yaml=readFileSync(file,'utf8');
 assert.match(yaml,/SENATE_864_CFB_EXPENDITURE_ANCHORED_V6_20261012/);
 assert.match(yaml,/environment: evidence-readonly-sandbox/);
 assert.match(yaml,/github\.event\.issue\.number == 864/);
 assert.match(yaml,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(yaml,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(yaml,/npm run check/);
 assert.match(yaml,/npm audit --omit=dev --audit-level=high/);
 assert.match(yaml,/git log -1 --format=%B \| grep -Fq/);
 assert.match(yaml,/DATABASE_URL_UNPOOLED: postgresql:\/\/postgres:postgres@localhost:5432\/votepredict/);
 const pre=yaml.split('  one-shot-readonly:\n')[0];
 assert.doesNotMatch(pre,/secrets\.NEON_API_KEY/);
 const protectedJob=yaml.split('  one-shot-readonly:\n')[1]??'';
 assert.match(protectedJob,/secrets\.NEON_API_KEY/);
 assert.doesNotMatch(yaml,/issues: write|upload-artifact|^\s*schedule:/m);
});

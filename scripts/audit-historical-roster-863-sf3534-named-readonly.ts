/**
 * #863 exact original PDF (pinned 210882-byte SHA) before connecting to existing
 * verified default-branch Neon. Protected SELECT only, explicit ROLLBACK.
 * No DB member IDs or raw stored identities leave this protected runner.
 */
import {Pool,type PoolClient} from 'pg';
import {fetchSenateCommitteeMinutePdf} from
 '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {
 SF3534_863_MARKER,SF3534_863_SOURCE_URL,SF3534_863_SOURCE_PDF_SHA256,
 SF3534_863_SQL,validateSF3534_863Static,classifySF3534_863NamedOriginal,
 type StoredSF3534Named,
} from '../src/evaluation/historical-roster-863-sf3534-named-proof.js';

export function assertProtectedSF3534(e:NodeJS.ProcessEnv){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
   e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
   e.GITHUB_RUN_ATTEMPT!=='1'||
   e.SF3534_863_MAIN_CI_PASSED!=='true'||
   e.SF3534_863_MARKER_PRESENT!=='true'||
   e.SF3534_863_APPROVAL!=='READ_ONLY_PUBLIC_NAMED_20240221'||
   !e.NEON_API_KEY?.trim()||!e.VOTEPREDICT_NEON_PROJECT_ID?.trim())
  throw Error('Reviewed protected main permission absent');
 return true;
}
export async function readProtectedSF3534(client:Pick<PoolClient,'query'>,
 expected:{database:string;role:string},official:ReturnType<typeof parseSenateCommitteeMinuteVotes>){
 let began=false;
 try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  began=true;
  const ro=await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(ro.rows.length!==1||ro.rows[0].ro!=='on'||
    ro.rows[0].db!==expected.database||ro.rows[0].role!==expected.role)
    throw Error('Unexpected identity or write privilege in protected readback');
  const result=await client.query(SF3534_863_SQL);
  if(result.rows.length>=101)throw Error('Unexpected >100 SF3534 scope rows');
  await client.query('ROLLBACK');began=false;
  return classifySF3534_863NamedOriginal(official,result.rows as StoredSF3534Named[]);
 }finally{
  if(began)await client.query('ROLLBACK');
 }
}
async function retrievePinnedOriginal(){
 const safeFetch:typeof fetch=async(url,init)=>{
  if(String(url)!==SF3534_863_SOURCE_URL)
   throw Error('Original Senate PDF URL drifted');
  const response=await fetch(SF3534_863_SOURCE_URL,{
   ...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000),
  });
  if(!response.ok)throw Error('Official 2024 Senate source unavailable');
  if(Number(response.headers.get('content-length')??0)>1100000)
   throw Error('Official Senate PDF over byte limit');
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>1100000)throw Error('Official Senate PDF over byte limit');
  return new Response(buffer,{status:200,headers:{'content-type':'application/pdf'}});
 };
 const source=await fetchSenateCommitteeMinutePdf({
  url:SF3534_863_SOURCE_URL,fetchImpl:safeFetch});
 if(source.contentSha256!==SF3534_863_SOURCE_PDF_SHA256||
   source.bytes!==210882)
  throw Error('Original Senate PDF changed from independent original-source audit');
 return parseSenateCommitteeMinuteVotes(source.text);
}
async function main(){
 let stage='static';
 try{
  if(process.argv.length!==3||!['--preflight','--protected'].includes(process.argv[2]))
    throw Error('Invalid #863 SF3534 run mode');
  validateSF3534_863Static();
  if(process.argv[2]==='--preflight'){
   console.log('SF3534_863_EXACT_ORIGINAL_PUBLIC_SOURCE_PREFLIGHT_OK');return;
  }
  assertProtectedSF3534(process.env);
  stage='official-original-sha';
  const original=await retrievePinnedOriginal();
  stage='protected-existing-neon';
  const target=await discoverExistingVotePredictNeonConnection({
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  });
  const pool=new Pool({host:target.host,port:target.port,
   database:target.database,user:target.role,password:target.password,
   ssl:{rejectUnauthorized:true},max:1,
   connectionTimeoutMillis:10000,statement_timeout:80000,query_timeout:85000,
   options:'-c default_transaction_read_only=on -c statement_timeout=80000 -c lock_timeout=3000',
   application_name:'votepredict-863-sf3534-source-identity',
  });
  try{
   stage='readonly-senate-named-reconciliation';
   const c=await pool.connect();
   try{
    const report=await readProtectedSF3534(c,{
     database:target.database,role:target.role},original);
    stage='safe-public-report';
    const safe=JSON.stringify(report);
    if(safe.length>5500||/postgres(?:ql)?:\/\/|"(?:member_vote_id|event_id|source_member_name|legislator_name|membership_id|password|api_key)"\s*:/i.test(safe))
     throw Error('Public source identity output not sanitized');
    console.log('SF3534_863_ORIGINAL_NAMED_RECONCILIATION='+safe);
   }finally{c.release(true)}
  }finally{await pool.end()}
 }catch{
  console.error('SF3534_863_ORIGINAL_NAMED_HOLD='+stage);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-historical-roster-863-sf3534-named-readonly.ts'))
 void main();

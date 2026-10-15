/**
 * #864: one-shot exact-source two-SF1 named roll vs existing VotePredict Neon.
 * Original official PDF is re-downloaded/SHA authenticated; twenty member
 * choices compared only inside a protected REPEATABLE READ READ ONLY
 * transaction. Explicit ROLLBACK, never SQL updates or legacy key replay.
 *
 * Neither secret values nor private identities/raw rows are ever exported.
 */
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.js';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {compareRulesOriginalToStored,validateOriginalRulesSF1,
 type RulesSourceDoc,type RulesStoredEvent,type RulesStoredChoice} from
 '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
import type {MembershipCandidate} from '../src/sources/minnesota/member-reconciliation.js';

const SOURCE='https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf';
const PDF_SHA='a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379';
const TEXT_SHA='2a6eb9aced550ed193b4329fd33cc0fa8c59fd447c9be170ccc34ac36ead3544';
const PDF_BYTES=189421,DAY='2023-01-24';
export const ONE_SHOT_MARKER='SENATE_864_2023_RULES_SF1_PROTECTED_PARITY_ONESHOT_20261015_V5';
export const DOC_SQL=[
 'SELECT sd.id::text AS id,sd.source_url,sd.content_sha256,',
 "sd.metadata->>'meetingDate' AS meeting_date,",
 "sd.metadata->>'committeeName' AS committee_name",
 'FROM source_documents sd WHERE sd.source_url=$1 OR sd.content_sha256=$2 OR',
 "(sd.metadata->>'meetingDate'=$3 AND",
 "lower(coalesce(sd.metadata->>'committeeName','')) LIKE '%rules%')",
 'ORDER BY sd.id LIMIT 101'
].join(' ');
export const EVENT_SQL=[
 'SELECT ve.id::text AS id,ve.source_document_id::text AS source_document_id,',
 've.external_key,ve.occurred_on::text AS occurred_on,',
 'b.identifier AS bill_identifier,ve.vote_kind,ve.amendment_ref,',
 've.motion_text,ve.yea_count,ve.nay_count,ve.passed,',
 "ve.metadata->>'committeeName' AS committee_name,",
 "(ve.metadata->>'committeeVote'='true') AS committee_vote",
 'FROM vote_events ve JOIN chambers c ON c.id=ve.chamber_id',
 'LEFT JOIN bills b ON b.id=ve.bill_id',
 "WHERE ve.occurred_on=$1::date AND c.slug='senate'",
 "AND (ve.metadata->>'committeeVote'='true' OR ve.source_document_id IN",
 '(SELECT sd.id FROM source_documents sd WHERE sd.source_url=$2 OR sd.content_sha256=$3))',
 'ORDER BY ve.id LIMIT 301'
].join(' ');
export const CHOICE_SQL=[
 'SELECT mv.vote_event_id::text AS vote_event_id,mv.normalized_member_name,',
 'mv.choice,mv.membership_id::text AS membership_id',
 'FROM member_votes mv JOIN vote_events ve ON ve.id=mv.vote_event_id',
 'JOIN chambers c ON c.id=ve.chamber_id',
 "WHERE ve.occurred_on=$1::date AND c.slug='senate'",
 "AND (ve.metadata->>'committeeVote'='true' OR ve.source_document_id IN",
 '(SELECT sd.id FROM source_documents sd WHERE sd.source_url=$2 OR sd.content_sha256=$3))',
 'ORDER BY mv.vote_event_id,mv.normalized_member_name,mv.choice LIMIT 3001'
].join(' ');
export const ROSTER_SQL=[
 'SELECT m.id::text AS membership_id,l.id::text AS legislator_id,',
 'l.name,l.normalized_name,m.starts_on::text,m.ends_on::text',
 'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 "WHERE s.slug='2023-2024' AND c.slug='senate'",
 'ORDER BY m.id LIMIT 151'
].join(' ');
export const ALIAS_SQL=[
 'SELECT a.membership_id::text,a.source_name',
 'FROM membership_source_aliases a',
 'JOIN memberships m ON m.id=a.membership_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 "WHERE s.slug='2023-2024' AND c.slug='senate'",
 'ORDER BY a.membership_id,a.source_name LIMIT 801'
].join(' ');
export const READ_ONLY_QUERIES=[DOC_SQL,EVENT_SQL,CHOICE_SQL,ROSTER_SQL,ALIAS_SQL] as const;

/** Verify the sanitized result, not substrings within approved aggregate
 * field names. The original gate accidentally treated "sourceNamedMotions"
 * as a leaked "sourceName", suppressing a complete rolled-back Neon audit.
 * Exact sensitive JSON keys and any URL/connection data still hard-fail.
 */
export function assertSafeRulesSF1AggregateReceipt(body:string):true{
 if(body.length>4000||
  /(?:postgres(?:ql)?:\/\/|https?:\/\/)/i.test(body)||
  /"(?:normalized_member_name|membership_id|external_key|source_url|sourceName|memberVotes)"\s*:/i.test(body))
  throw Error('Sanitized original/store output violated private identity gate');
 return true;
}
export function assertProtectedRulesSF1Environment(e:Record<string,string|undefined>){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||
  e.VOTEPREDICT_864_SF1_APPROVAL!=='HISTORIC_SF1_TWO_ROLL_READ_ONLY'||
  e.VOTEPREDICT_864_SF1_MARKER_PRESENT!=='true'||
  e.VOTEPREDICT_864_MAIN_CI_VERIFIED!=='true'||
  !e.NEON_API_KEY||!e.VOTEPREDICT_NEON_PROJECT_ID)
  throw Error('Protected exact-SF1 read-only one-shot not authorized');
 return true;
}
const bounded=<T>(v:unknown,max:number,label:string):T[]=>{
 if(!Array.isArray(v)||v.length>=max)throw Error(label+' bounded snapshot HOLD');
 return v as T[];
};
const sha=(x:Uint8Array|string)=>createHash('sha256').update(x).digest('hex');
async function verifiedOriginal(){
 const response=await fetch(SOURCE,{redirect:'manual',signal:AbortSignal.timeout(45000),
  headers:{accept:'application/pdf'}});
 if(response.status!==200||!response.body||Number(response.headers.get('content-length')??0)>1000000)
  throw Error('Official Senate source transport HOLD');
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let total=0;
 try{for(;;){const r=await reader.read();if(r.done)break;
  total+=r.value.length;if(total>1000000)throw Error('Official source byte bound HOLD');
  parts.push(r.value);
 }}finally{reader.releaseLock()}
 const original=new Uint8Array(total);let at=0;
 for(const p of parts){original.set(p,at);at+=p.length}
 if(total!==PDF_BYTES||sha(original)!==PDF_SHA||
  new TextDecoder('latin1').decode(original.subarray(0,5))!=='%PDF-')
  throw Error('Official original raw PDF SHA and byte count HOLD');
 const parsed=await fetchSenateCommitteeMinutePdf({url:SOURCE,
  fetchImpl:(async()=>new Response(original,{status:200,
   headers:{'content-type':'application/pdf'}})) as typeof fetch});
 if(parsed.contentSha256!==PDF_SHA||sha(parsed.text)!==TEXT_SHA)
  throw Error('Official PDF text integrity HOLD');
 const rolls=parseSenateCommitteeMinuteVotes(parsed.text);
 const source={verifiedRawPdfSha:true,verifiedSourceTextSha:true,rolls};
 if(!validateOriginalRulesSF1(source))
  throw Error('Original has not exactly two independent 4-6 and 6-4 SF1 named rolls');
 return source;
}
export async function runProtectedRulesSF1Parity(input:{
 apiKey:string;projectId:string;database?:string;
},phase:(s:string)=>void=()=>{}){
 phase('official_original_lrl_pdf_reauthentication');
 const source=await verifiedOriginal();
 phase('existing_project_default_branch_database_identity');
 const selected=await discoverExistingVotePredictNeonConnection({
  apiKey:input.apiKey,projectId:input.projectId,preferredDatabase:input.database
 });
 const pool=new Pool({host:selected.host,port:selected.port,user:selected.role,
  password:selected.password,database:selected.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:8000,statement_timeout:17000,query_timeout:17000,
  application_name:'senate-864-rules-sf1-exact-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=17000 -c lock_timeout=2500'});
 let client:PoolClient|null=null,open=false;
 try{
  client=await pool.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  open=true;
  const ident=await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(ident.rows.length!==1||ident.rows[0].db!==selected.database||
   ident.rows[0].role!==selected.role||ident.rows[0].ro!=='on')
   throw Error('Read-only transaction identity HOLD');
  phase('verified_readonly_transaction_identity');
  const docs=bounded<RulesSourceDoc>((await client.query(DOC_SQL,[SOURCE,PDF_SHA,DAY])).rows,101,'docs');
  const events=bounded<RulesStoredEvent>((await client.query(EVENT_SQL,[DAY,SOURCE,PDF_SHA])).rows,301,'events');
  const choices=bounded<RulesStoredChoice>((await client.query(CHOICE_SQL,[DAY,SOURCE,PDF_SHA])).rows,3001,'choices');
  const roster=bounded<Array<{membership_id:string;legislator_id:string;name:string;
   normalized_name:string;starts_on:string|null;ends_on:string|null}>[number]>(
    (await client.query(ROSTER_SQL)).rows,151,'roster');
  const aliases=bounded<{membership_id:string;source_name:string}>(
    (await client.query(ALIAS_SQL)).rows,801,'aliases');
  phase('all_five_sql_selects_completed_and_bounded');
  const aliasMap=new Map<string,string[]>();
  for(const a of aliases)aliasMap.set(a.membership_id,[...(aliasMap.get(a.membership_id)??[]),a.source_name]);
  const historicalRoster:MembershipCandidate[]=roster.map(r=>({
   membershipId:r.membership_id,legislatorId:r.legislator_id,name:r.name,
   normalizedName:r.normalized_name,startsOn:r.starts_on,endsOn:r.ends_on,
   aliases:aliasMap.get(r.membership_id)??[]
  }));
  await client.query('ROLLBACK');open=false;
  phase('explicit_readonly_rollback_done');
  return compareRulesOriginalToStored(source,{
   readOnlyTransactionProven:true,databaseIdentityVerified:true,
   completeBoundedSourceEventsFetched:true,explicitRollbackCompleted:true,
   documents:docs,events,choices,historicalRoster
  });
 }finally{
  if(open&&client)try{await client.query('ROLLBACK')}catch{/* Fail closed */}
  if(client)client.release(true);
  await pool.end();
 }
}
async function main(){
 const mode=process.argv[2];
 if(process.argv.length!==3||!['--preflight','--protected'].includes(mode))
  throw Error('Only --preflight or --protected');
 let phase='source_only_static_sql_preflight';
 try{
  if(READ_ONLY_QUERIES.length!==5||READ_ONLY_QUERIES.some(sql=>
   !sql.startsWith('SELECT ')||/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|MERGE|TRUNCATE|GRANT)\b/i.test(sql)))
   throw Error('Unexpected SQL shape');
  if(mode==='--preflight'){
   console.log('SENATE864_RULES_SF1_FIVE_BOUNDED_SELECTS_PRECHECK_VERIFIED');
   return;
  }
  assertProtectedRulesSF1Environment(process.env);
  phase='protected_exact_two_motion_source_to_existing_neon';
  const report=await runProtectedRulesSF1Parity({
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   database:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },v=>{phase=v});
  const body=JSON.stringify(report);
  assertSafeRulesSF1AggregateReceipt(body);
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'safe_rules_sf1_parity_b64='+Buffer.from(body).toString('base64')+'\n');
  console.log('SENATE864_RULES_SF1_EXACT_STORED_PARITY='+body);
 }catch{
  console.error('SENATE864_RULES_SF1_EXACT_PARITY_HOLD='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-rules-sf1-protected-neon-readonly.ts'))
 void main();

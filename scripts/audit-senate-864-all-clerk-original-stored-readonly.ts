/**
 * #864 original 2022-25 Clerk/archived-LRL document-to-existing Neon parity.
 * Main-only one-shot, protected read-only transaction; emits ONLY counters.
 * Never writes source_documents, vote_events, member_votes or evidence_items.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {compareSenate864OriginalClerkDocumentsToStored,
 type OriginalWrittenMeeting,type StoredDocument,type StoredAggregate} from
 '../src/evidence/senate-864-clerk-written-source-db-audit.js';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';

export const CLERK_PARITY_MARKER='SENATE_864_ALL_CLERK_STORED_PARITY_ONESHOT_20261014_V1';
export const ORIGINAL_CLERK_SQL=[
 "SELECT sd.id::text AS id, sd.source_url, sd.content_sha256,",
 "sd.metadata->>'meetingDate' AS meeting_date,sd.metadata->>'committeeName' AS committee_name",
 "FROM source_documents sd WHERE",
 "(sd.source_url LIKE 'https://www.senate.mn/schedule/hearing_minutes.html%'",
 "OR sd.source_url LIKE 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Finhousing/20220324/%')",
 "ORDER BY sd.id LIMIT 1001",
].join(' ');
export const ORIGINAL_CLERK_EVENTS_SQL=[
 "SELECT ve.source_document_id::text AS source_document_id,",
 "count(DISTINCT ve.id)::int AS recorded_events,",
 "count(mv.id)::int AS recorded_member_choices,",
 "count(mv.membership_id)::int AS choices_with_membership",
 "FROM vote_events ve JOIN source_documents sd ON sd.id=ve.source_document_id",
 "LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id",
 "WHERE ve.occurred_on>=DATE '2022-01-01'",
 "AND ve.occurred_on<DATE '2026-01-01' AND",
 "(sd.source_url LIKE 'https://www.senate.mn/schedule/hearing_minutes.html%'",
 "OR sd.source_url LIKE 'https://www.lrl.mn.gov/archive/minutes/senate/2022/Finhousing/20220324/%')",
 "GROUP BY ve.source_document_id ORDER BY ve.source_document_id LIMIT 1001",
].join(' ');
export const ORIGINAL_CLERK_QUERIES=[ORIGINAL_CLERK_SQL,ORIGINAL_CLERK_EVENTS_SQL] as const;
const RECEIPT='docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json';
function pinnedRows():OriginalWrittenMeeting[]{
 const bytes=readFileSync(RECEIPT,'utf8');
 if(bytes.length<4000||bytes.length>500000)throw Error('Unbounded original source receipt');
 const j=JSON.parse(bytes);
 if(j.schemaVersion!=='senate-864-2022-25-141-official-unlinked-meeting-to-authenticated-written-minutes-v3'||
  j.originalLrlIndexSourceSha256!=='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0'||
  !Array.isArray(j.perOriginallyIndexedNoPdfMeeting)||j.perOriginallyIndexedNoPdfMeeting.length!==141||
  j.independentlyAuthenticatedOriginalClerkHtmlMeetings!==111||
  j.combinedIndexedMeetingsWithAuthenticatedWrittenMinutes!==1563||
  j.stillWithoutAuthenticatedWrittenMinutes!==29)
  throw Error('Original indexed committee-minute crosswalk not the source-verified version');
 const rows=j.perOriginallyIndexedNoPdfMeeting as OriginalWrittenMeeting[];
 compareSenate864OriginalClerkDocumentsToStored(rows,[],[]);
 return rows;
}
export function assertProtectedSourceParityApproval(e:Record<string,string|undefined>){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||
  e.VOTEPREDICT_864_APPROVAL!=='BOUNDED_CLERK_COUNTS_READ_ONLY'||
  e.VOTEPREDICT_864_MAIN_CI_VERIFIED!=='true'||
  e.VOTEPREDICT_864_CLERK_MARKER_PRESENT!=='true'||
  !e.NEON_API_KEY||!e.VOTEPREDICT_NEON_PROJECT_ID)
  throw Error('Protected original minute/store parity missing independent safe-gate');
 return true;
}
const bounded=<T>(v:unknown,n:number):T[]=>{
 if(!Array.isArray(v)||v.length>=n)throw Error('Original SQL result unsafe/truncated');
 return v as T[];
};
export async function protectedSenateClerkStoredCoverage(
 originals:readonly OriginalWrittenMeeting[],
 input:{apiKey:string;projectId:string;database?:string},
 phase:(s:string)=>void=()=>{}
){
 const originalOnly=compareSenate864OriginalClerkDocumentsToStored(originals,[],[]);
 if(originalOnly.originalSourceNotFound!==112)
  throw Error('Presecret original source baseline changed unexpectedly');
 phase('existing_vote_predict_neon_connection');
 const selected=await discoverExistingVotePredictNeonConnection({
  apiKey:input.apiKey,projectId:input.projectId,
  preferredDatabase:input.database
 });
 const pool=new Pool({host:selected.host,port:selected.port,user:selected.role,
  password:selected.password,database:selected.database,
  ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:7000,
  query_timeout:16000,statement_timeout:15000,
  application_name:'votepredict-864-original-clerk-minutes-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=2500'});
 let open=false;
 try{
  const client=await pool.connect();
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   open=true;
   const ident=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
   if(ident.rows.length!==1||ident.rows[0].db!==selected.database||
    ident.rows[0].role!==selected.role||ident.rows[0].ro!=='on')
    throw Error('Protected source-only transaction role or DB mismatch');
   phase('verified_readonly_transaction');
   const docs=bounded<StoredDocument>((await client.query(ORIGINAL_CLERK_SQL)).rows,1001);
   phase('bounded_stored_originals_obtained');
   const aggs=bounded<StoredAggregate>((await client.query(ORIGINAL_CLERK_EVENTS_SQL)).rows,1001);
   phase('bounded_original_attached_event_counts_obtained');
   const result=compareSenate864OriginalClerkDocumentsToStored(originals,docs,aggs);
   await client.query('ROLLBACK');open=false;
   phase('read_only_transaction_explicit_rollback');
   return result;
  }finally{
   if(open)try{await client.query('ROLLBACK')}catch{/* fail closed on damaged tx */}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==3||!['--source-preflight','--protected'].includes(process.argv[2]))
  throw Error('Only source preflight or protected read-only mode');
 let phase='source_preflight';
 try{
  const docs=pinnedRows();
  if(process.argv[2]==='--source-preflight'){
   console.log('SENATE864_ALL_ORIGINAL_CLERK_111_PLUS_ORPHAN_1_PREFLIGHT_VERIFIED');
   return;
  }
  assertProtectedSourceParityApproval(process.env);
  phase='protected_original_clerk_neon_query';
  const result=await protectedSenateClerkStoredCoverage(docs,{
   apiKey:process.env.NEON_API_KEY!,
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
   database:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },p=>{phase=p});
  const body=JSON.stringify(result);
  if(body.length>5500||/https?:|postgresql:|@.*\.neon|normalized_member_name|source_url|membership_id/i.test(body))
   throw Error('Original source private result not strictly sanitized');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'safe_clerk_parity_b64='+Buffer.from(body,'utf8').toString('base64')+'\n');
  console.log('SENATE864_ORIGINAL_CLERK_STORED_PARITY_SANITIZED='+body);
 }catch{
  console.error('SENATE864_ORIGINAL_CLERK_STORED_PARITY_HOLD='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_clerk_parity_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-all-clerk-original-stored-readonly.ts'))
 void main();

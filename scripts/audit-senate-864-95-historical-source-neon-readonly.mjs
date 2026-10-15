/** #864: ONE SHOT protected 95 actual-serving senator historical source audit.
 * Existing GitHub NEON_API_KEY only. Three immutable SELECTs in one READ ONLY
 * REPEATABLE READ transaction. Never export DB names, URLs, IDs, hashes, excerpts.
 */
import {Pool} from 'pg';
import {readFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 OWNER_MARKER,SOURCE_LEDGER_FILES,assertManifest,extractAuthenticatedPageLeads,
 compareHistoric95,validatePublicReport
} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';

export const PUBLIC95='data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json';
export const ROSTER_SQL=[
 'SELECT l.id::text AS "legislatorId",l.name::text AS name,',
 'm.id::text AS "membershipId",',
 's.slug::text AS "sessionSlug",m.district::text AS district',
 'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 "WHERE c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
 'ORDER BY l.name,m.id LIMIT 1001'
].join(' ');
export const CAMPAIGN_SQL=[
 'SELECT ei.membership_id::text AS "membershipId",',
 'sd.id::text AS "sourceDocumentId",',
 'sd.source_url::text AS "sourceUrl",',
 'sd.content_sha256::text AS "contentSha256",',
 'ei.published_at::text AS "publishedAt"',
 'FROM evidence_items ei',
 'JOIN source_documents sd ON sd.id=ei.source_document_id',
 'JOIN memberships m ON m.id=ei.membership_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 "WHERE c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
 "AND ei.metadata->>'contextType'='issue_position'",
 "AND ei.metadata->>'sourceSubtype'='campaign_site_page'",
 'ORDER BY ei.id LIMIT 8501'
].join(' ');
export const PRIMARY_SQL=[
 'SELECT ei.membership_id::text AS "membershipId",',
 'count(*)::integer AS rows',
 'FROM evidence_items ei',
 'JOIN source_documents sd ON sd.id=ei.source_document_id',
 'JOIN memberships m ON m.id=ei.membership_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 "WHERE c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
 "AND sd.source_kind='member_primary_article'",
 'GROUP BY ei.membership_id ORDER BY ei.membership_id LIMIT 1001'
].join(' ');
export const CATALOG_SQL=[
 'SELECT name AS table_name,',
 "to_regclass('public.'||name) IS NOT NULL AS present,",
 "COALESCE(has_table_privilege(current_user,to_regclass('public.'||name),'SELECT'),false) AS readable",
 'FROM unnest($1::text[]) AS names(name) ORDER BY name'
].join(' ');
const REQUIRED=['memberships','legislators','chambers','legislative_sessions','source_documents','evidence_items'];
export function validateOwnerEvent(env,raw){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_EVENT_NAME!=='issue_comment'
  ||env.GITHUB_REF!=='refs/heads/main'
  ||env.GITHUB_RUN_ATTEMPT!=='1'
  ||! /^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')
  ||env.VOTEPREDICT_864_95_APPROVAL!==OWNER_MARKER
  ||env.VOTEPREDICT_864_95_PRECI!=='true'
  ||raw?.issue?.number!==864
  ||raw?.comment?.user?.login!=='killjoy00'
  ||raw?.comment?.body!==OWNER_MARKER)
  throw Error('Not an independently CI-approved owner-only 95-person source audit');
}
export function readPublicInputs(read=readFileSync){
 const manifest=assertManifest(JSON.parse(read(PUBLIC95,'utf8')));
 const files=new Map(SOURCE_LEDGER_FILES.map(p=>[p,JSON.parse(read(p,'utf8'))]));
 const research=extractAuthenticatedPageLeads(manifest,files);
 return {manifest,research};
}
export async function auditHistorical95(
 input,publicInputs=readPublicInputs(),
 discover=discoverExistingVotePredictNeonConnection,
 poolFactory=options=>new Pool(options),onPhase=()=>{}
){
 const target=await discover(input);
 onPhase('verified_existing_votepredict_project_default_branch');
 const pool=poolFactory({
  host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,
  ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:30000,statement_timeout:29000,
  application_name:'votepredict-864-95-historical-original-source-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=29000 -c lock_timeout=1500'
 });
 try{
  const client=await pool.connect();let begun=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   begun=true;
   const id=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
   if(id.rows.length!==1||id.rows[0].db!==target.database||id.rows[0].role!==target.role
    ||id.rows[0].ro!=='on')throw Error('Verified existing VotePredict connection not READ ONLY');
   const tables=await client.query(CATALOG_SQL,[REQUIRED]);
   if(tables.rows.length!==REQUIRED.length
    ||tables.rows.some(r=>!REQUIRED.includes(r.table_name)||!r.present||!r.readable))
    throw Error('Missing expected existing VotePredict source relations');
   onPhase('readonly_transaction_and_existing_tables_verified');
   const roster=await client.query(ROSTER_SQL);
   if(roster.rows.length<95||roster.rows.length>=1001)throw Error('Bounded historic roster truncated or absent');
   onPhase('historical_senate_memberships_read_in_memory');
   const campaign=await client.query(CAMPAIGN_SQL);
   if(campaign.rows.length>=8501)throw Error('Bounded historical campaign rows truncated');
   onPhase('historical_campaign_sources_read_in_memory');
   const primary=await client.query(PRIMARY_SQL);
   if(primary.rows.length>=1001)throw Error('Bounded member-original rows truncated');
   onPhase('member_primary_article_counts_read_in_memory');
   const report=compareHistoric95(publicInputs.manifest,publicInputs.research,
     roster.rows,campaign.rows,primary.rows);
   await client.query('ROLLBACK');begun=false;
   onPhase('explicit_readonly_transaction_rollback_complete');
   return validatePublicReport(report,publicInputs.manifest);
  }finally{
   if(begun){try{await client.query('ROLLBACK')}catch{/*do not disclose SQL*/}}
   client.release(true);
  }
 }finally{await pool.end();}
}
export async function main(){
 let phase='public_95_and_29_source_ledgers';
 try{
  if(process.argv.length!==2)throw Error('No arbitrary inputs allowed');
  const inputs=readPublicInputs();
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH||'','utf8'));
  validateOwnerEvent(process.env,event);
  phase='protected_existing_neon_sql';
  const report=await auditHistorical95({
   apiKey:process.env.NEON_API_KEY?.trim()||'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()||'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined
  },inputs,discoverExistingVotePredictNeonConnection,options=>new Pool(options),p=>{phase=p});
  const payload=Buffer.from(JSON.stringify(report),'utf8').toString('base64');
  if(payload.length>115000)throw Error('Aggregate report exceeded safe output size');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_95_b64='+payload+'\n');
  console.log('SENATE_864_95_PROTECTED_READONLY_AUDIT_ROLLBACK_SUCCESS; 95 ordinal aggregate rows only; no private details output');
 }catch{
  console.error('SENATE_864_95_PROTECTED_HOLD phase='+(/^[a-z_]{1,90}$/.test(phase)?phase:'safe_gate'));
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,90}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
 void main();

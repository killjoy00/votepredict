/** #864: import 72 cryptographically proven historic candidate pages into existing VotePredict Neon.
 * No forecast fields, no asserted publication dates, no raw source HTML bodies.
 * Credential/password, DB rows and source URLs remain inside protected Actions memory.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
import {ROSTER_SQL,PUBLIC95} from './audit-senate-864-95-historical-source-neon-readonly.mjs';
import {buildRecoveryPlan} from './build-senate-864-95-missing-original-recovery-plan.mjs';
import {verify72ArtifactProvenance} from './verify-senate-864-72-original-artifact-bytes.mjs';
import {assertVerified72Proof} from './check-senate-864-72-neon-import-proof.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {sourcePlan} from '../src/evidence/senate-864-72-historical-source-ingest-plan.mjs';
import {historicalOriginalDraft} from '../src/evidence/senate-864-72-original-neon-draft.mjs';
import {RECEIPT_SQL,assertStoredOriginalReceipts} from '../src/evidence/senate-864-72-neon-readback.mjs';

function verifiedDbUrl(target){
 const u=new URL('postgresql://placeholder/na');
 u.hostname=target.host;u.port=String(target.port);
 u.username=target.role;u.password=target.password;
 u.pathname='/'+target.database;u.searchParams.set('sslmode','verify-full');
 return u.toString();
}
async function stored(client,plan,complete){
 const rows=await client.query(RECEIPT_SQL,[plan.map(x=>x.key)]);
 return assertStoredOriginalReceipts(rows.rows,plan,{complete});
}
async function preflight(client,target,manifest,witnesses){
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const check=await client.query([
   'SELECT current_database() AS db,current_user AS role,',
   "has_table_privilege(current_user,'public.source_documents','INSERT') AS source_write,",
   "has_table_privilege(current_user,'public.evidence_items','INSERT') AS evidence_write"
  ].join(' '));
  if(check.rows.length!==1||check.rows[0].db!==target.database
   ||check.rows[0].role!==target.role||check.rows[0].source_write!==true
   ||check.rows[0].evidence_write!==true)
   throw Error('Existing primary must have bounded source and evidence write permissions');
  const official=await client.query(ROSTER_SQL);
  if(official.rows.length<95||official.rows.length>=1001)
   throw Error('Bounded historical Senate roster incomplete');
  const plan=sourcePlan(manifest,witnesses,official.rows);
  const present=await stored(client,plan,false);
  return {plan,present};
 }finally{await client.query('ROLLBACK')}
}
export async function main(){
 let phase='main_commit_gate',direct,appPool;
 try{
  if(process.argv.length!==2)throw Error('No CLI selectors');
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH||'','utf8'));
  assertHistoricalMainPush(process.env,event);
  phase='independent_original_html_and_cdx_proof';
  const originalPlan=buildRecoveryPlan();
  const proof=await verify72ArtifactProvenance({
   token:process.env.GH_TOKEN,repository:process.env.GITHUB_REPOSITORY,output:false
  });
  const witnesses=assertVerified72Proof(proof,originalPlan);
  const manifest=JSON.parse(readFileSync(PUBLIC95,'utf8'));
  phase='existing_neon_project_default_primary_discovery';
  const target=await discoverExistingVotePredictNeonConnection({
   apiKey:process.env.NEON_API_KEY||'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID||'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
   requirePrimary:true
  });
  direct=new Pool({
   host:target.host,port:target.port,user:target.role,password:target.password,
   database:target.database,ssl:{rejectUnauthorized:true},max:1,
   connectionTimeoutMillis:10000,query_timeout:120000,statement_timeout:115000,
   application_name:'votepredict-864-72-original-html-protected-import'
  });
  phase='read_only_full_roster_and_existing_receipt_preflight';
  const client=await direct.connect();
  let pre;
  try{pre=await preflight(client,target,manifest,witnesses)}
  finally{client.release()}
  phase='idempotent_historical_context_ingestion';
  const url=verifiedDbUrl(target);
  process.env.DATABASE_URL=url;
  process.env.DATABASE_URL_UNPOOLED=url;
  process.env.POSTGRES_URL=url;
  process.env.POSTGRES_URL_NON_POOLING=url;
  const {persistDurableEvidence}=await import('../src/evidence/durable-ingestion.ts');
  ({pool:appPool}=await import('../src/lib/db/index.ts'));
  let inserted=0,reused=0;
  for(const item of pre.plan){
   const draft=historicalOriginalDraft(item);
   const result=await persistDurableEvidence(draft.source,draft.drafts);
   if(result.evidenceItemIds.length!==1||result.unresolvedTargets.length
    ||result.inserted+result.reused!==1||result.supersessionRelationships!==0)
    throw Error('Unresolved historic research receipt - stop before any further imports');
   inserted+=result.inserted;reused+=result.reused;
  }
  phase='neon_exact_72_page_readback_and_model_exclusion';
  const verifyClient=await direct.connect();
  let verified;
  try{
   await verifyClient.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   try{verified=await stored(verifyClient,pre.plan,true)}
   finally{await verifyClient.query('ROLLBACK')}
  }finally{verifyClient.release()}
  phase='complete';
  console.log('SENATE_864_72_NEON_IMPORT='+JSON.stringify({
   status:'all_72_verified_after_persistence',
   sameExistingVotePredictDefaultBranch:true,
   verifiedOriginalHtmlAndIndependentCdx:72,
   servingSenators:34,sourceReceiptsReadBack:verified,
   alreadyPresentBefore:pre.present,inserted,reused,
   contextOnly:true,publishedAtNotInferred:true,asOfEligible:false,
   noModelOrForecastUpdates:true
  }));
 }catch{
  console.error('SENATE_864_72_NEON_IMPORT_FAILED_AT='+phase);
  process.exitCode=1;
 }finally{
  if(appPool){try{await appPool.end()}catch{process.exitCode=1}}
  if(direct){try{await direct.end()}catch{process.exitCode=1}}
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/ingest-senate-864-72-original-pages-neon.mjs'))
 main();

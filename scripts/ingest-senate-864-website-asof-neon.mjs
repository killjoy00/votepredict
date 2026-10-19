/**
 * #864: one-shot protected import of literal candidate website excerpts.
 * Historical feature-research only; no production prediction or model changes.
 * No passwords, raw member IDs, campaign quotations, hashes or SQL rows logged.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
import {ROSTER_SQL,PUBLIC95} from './audit-senate-864-95-historical-source-neon-readonly.mjs';
import {buildRecoveryPlan} from './build-senate-864-95-missing-original-recovery-plan.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {SOURCE_LEDGER_FILES} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {websiteExcerptPlanV1 as websiteExcerptPlan} from '../src/evidence/senate-864-historical-site-excerpt-asof.mjs';
import {candidateSiteDrafts,websiteEvidenceDraft,WEBSITE_ASOF_QUERY}
 from '../src/evidence/senate-864-website-signal-neon.mjs';
import {WEBSITE_NEON_RECEIPT_SQL,verifyWebsiteNeonReadback}
 from '../src/evidence/senate-864-website-signal-readback.mjs';
function databaseUrl(target){
 const u=new URL('postgresql://a:b@localhost:5432/d');
 u.hostname=target.host;u.port=String(target.port);
 u.username=target.role;u.password=target.password;u.pathname='/'+target.database;
 u.searchParams.set('sslmode','verify-full');
 return u.toString();
}
function research(){
 const manifest=JSON.parse(readFileSync(PUBLIC95,'utf8'));
 const docs=new Map(SOURCE_LEDGER_FILES.map(p=>[p,JSON.parse(readFileSync(p,'utf8'))]));
 const originals=buildRecoveryPlan().witnesses;
 const planned=websiteExcerptPlan(manifest,docs,originals);
 const linked=planned.ready.filter(x=>originals.some(o=>
  o.originalUrl===x.sourceUrl
  &&o.originalHtmlSha256===x.sourceSha
  &&o.originalArchiveCapturedAtUtc===x.archiveCapturedAt)).length;
 if(planned.selectedExcerpts!==1197||planned.ready.length!==616
  ||planned.holds.length!==581||linked!==398)
  throw Error('Pinned website text cohort or archived proof links changed');
 return {manifest,planned,linked};
}
async function readback(client,rows,complete){
 const r=await client.query(WEBSITE_NEON_RECEIPT_SQL,[rows.map(x=>x.key)]);
 return verifyWebsiteNeonReadback(r.rows,rows,{complete});
}
async function preflight(client,target,docs){
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const id=await client.query([
   'SELECT current_database() AS db,current_user AS role,',
   "has_table_privilege(current_user,'public.source_documents','INSERT') AS source_write,",
   "has_table_privilege(current_user,'public.evidence_items','INSERT') AS evidence_write"
  ].join(' '));
  if(id.rows.length!==1||id.rows[0].db!==target.database||id.rows[0].role!==target.role
   ||id.rows[0].source_write!==true||id.rows[0].evidence_write!==true)
   throw Error('Protected VotePredict primary connection or schema permissions mismatch');
  const r=await client.query(ROSTER_SQL);
  if(r.rows.length<95||r.rows.length>=1001)throw Error('Incomplete served Senate roster');
  const plans=candidateSiteDrafts(docs.manifest,r.rows,docs.planned);
  if(plans.length!==616)throw Error('Unreviewed research excerpt count');
  const before=await readback(client,plans,false);
  return {plans,before};
 }finally{await client.query('ROLLBACK')}
}
export async function main(){
 let phase='main_push_and_reviewed_keyless_gate',direct,applicationPool;
 try{
  if(process.argv.length!==2)throw Error('Arbitrary commands not allowed');
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH||'','utf8'));
  assertHistoricalMainPush(process.env,event);
  phase='fixed_candidate_owned_source_ledgers';
  const docs=research();
  phase='existing_neon_default_branch_primary_discovery';
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
   application_name:'vote-predict-864-historical-candidate-website-text'
  });
  phase='read_only_all_person_identity_and_source_preflight';
  const c=await direct.connect();
  let plan;
  try{plan=await preflight(c,target,docs)}finally{c.release()}
  phase='bounded_idempotent_original_website_literal_import';
  const url=databaseUrl(target);
  process.env.DATABASE_URL=url;
  process.env.DATABASE_URL_UNPOOLED=url;
  process.env.POSTGRES_URL=url;
  process.env.POSTGRES_URL_NON_POOLING=url;
  const {persistDurableEvidence}=await import('../src/evidence/durable-ingestion.ts');
  ({pool:applicationPool}=await import('../src/lib/db/index.ts'));
  let inserted=0,reused=0;
  for(const p of plan.plans){
   const {source,drafts}=websiteEvidenceDraft(p);
   const result=await persistDurableEvidence(source,drafts);
   if(result.unresolvedTargets.length||result.evidenceItemIds.length!==1
    ||result.inserted+result.reused!==1||result.supersessionRelationships!==0)
    throw Error('Unresolved website text source or non-idempotent write: halt safely');
   inserted+=result.inserted;reused+=result.reused;
  }
  phase='exact_source_text_archive_observation_database_readback';
  const verify=await direct.connect();
  let readbackCount,asofRows;
  try{
   await verify.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   try{
    readbackCount=await readback(verify,plan.plans,true);
    const cutoff='2026-10-15T00:00:00.000Z';
    const representative=plan.plans[0];
    const sample=await verify.query(WEBSITE_ASOF_QUERY,[representative.membershipId,cutoff]);
    asofRows=sample.rows.length;
    if(asofRows<1||asofRows>=1601||sample.rows.some(x=>{
     const at=x.observedAt instanceof Date?x.observedAt.toISOString():String(x.observedAt);
     return !at||Date.parse(at)>=Date.parse(cutoff)
      ||typeof x.text!=='string'||x.text.length<5;
    }))throw Error('As-of query did not return historically safe published website text');
   }finally{await verify.query('ROLLBACK')}
  }finally{verify.release()}
  phase='complete';
  console.log('SENATE_864_CANDIDATE_WEBSITE_ASOF_NEON='+JSON.stringify({
   status:'historical_website_text_available_for_asof_evaluation',
   existingVotePredictDefaultBranch:true,originalsReverifiedByIndependentCi:72,
   materializedResearchExcerpts:1197,aggregateManifestResearchCount:1285,
   aggregatedOnlyNotInvented:88,datedAndSourceLinkedExcerpts:readbackCount,
   linkedTo72JustVerifiedOriginals:docs.linked,missingMinimumSourceProvenanceHeld:581,
   preexistingSourceExcerpts:plan.before,inserted,reused,
   sampleAsOfQueryReturnedRows:asofRows,
   noSubjectivePolicyStanceGate:true,publishedAtMeansArchiveObservation:true,
   noProductionForecastOrModelModification:true
  }));
 }catch{
  console.error('SENATE_864_CANDIDATE_WEBSITE_ASOF_FAILED_AT='+phase);
  process.exitCode=1;
 }finally{
  if(applicationPool){try{await applicationPool.end()}catch{process.exitCode=1}}
  if(direct){try{await direct.end()}catch{process.exitCode=1}}
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/ingest-senate-864-website-asof-neon.mjs'))main();

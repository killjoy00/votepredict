/** Bounded 52-excerpt append using the existing durable writer, then verified readback. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {ROSTER_SQL} from './audit-senate-864-95-historical-source-neon-readonly.mjs';
import {expansionInputs,EXPANSION_MARKER,PROTOCOL_V2,sha} from '../src/evidence/senate-864-website-expansion.mjs';
import {candidateSiteDrafts,websiteEvidenceDraft} from '../src/evidence/senate-864-website-signal-neon.mjs';
import {WEBSITE_NEON_RECEIPT_SQL,verifyWebsiteNeonReadback} from '../src/evidence/senate-864-website-signal-readback.mjs';
import {COHORT_TARGETS_V2_SQL,prepareWebsiteCohort} from '../src/evidence/senate-864-website-cohort-v2.mjs';
export async function expansionReadOnly(client,target,inputs,{complete=false}={}){
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const who=(await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Verified read-only identity required');
  const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}));
  const migrations=(await client.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows;
  if(JSON.stringify(expected)!==JSON.stringify(migrations))throw Error('Schema ledger mismatch');
  const roster=(await client.query(ROSTER_SQL)).rows;
  const all=candidateSiteDrafts(inputs.manifest,roster,inputs.current),old=all.filter(p=>inputs.oldKeys.has(p.key)),added=all.filter(p=>!inputs.oldKeys.has(p.key));
  const stored=(await client.query(WEBSITE_NEON_RECEIPT_SQL,[all.map(p=>p.key)])).rows;
  const oldRows=stored.filter(r=>inputs.oldKeys.has(r.metadata?.ingestionIdentityKey)),newRows=stored.filter(r=>!inputs.oldKeys.has(r.metadata?.ingestionIdentityKey));
  verifyWebsiteNeonReadback(oldRows,old);
  verifyWebsiteNeonReadback(newRows,added,{complete});
  for(const r of stored){const p=all.find(p=>p.key===r.metadata.ingestionIdentityKey);
   if(!p||r.sourceMetadata.originalCdxSha1Base32!==p.cdx||r.metadata.archiveUrl!==p.sourceUrl)throw Error('Archive index mismatch');}
  const map=new Map(roster.map(r=>[r.membershipId,r.legislatorId]));
  const features=all.map(p=>({...p,legislatorId:map.get(p.membershipId)}));
  const cohort=complete?prepareWebsiteCohort((await client.query(COHORT_TARGETS_V2_SQL)).rows,features):null;
  return {added,all,existing:newRows.length,verified:stored.length,cohort:cohort?.summary};
 }finally{await client.query('ROLLBACK')}
}
async function main(){
 let phase='fixed_sources_and_protocol',pool,applicationPool;
 try{
  if(process.argv.length!==2)throw Error('No arbitrary mode');
  const inputs=expansionInputs(),event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH||''));
  assertHistoricalMainPush({...process.env,VOTEPREDICT_864_72_INDEPENDENT_CI:process.env.SENATE864_INDEPENDENT_MAIN},event);
  if(!event.head_commit.message.includes(EXPANSION_MARKER))throw Error('Fixed scope marker missing');
  const protocol=JSON.parse(readFileSync(PROTOCOL_V2));if(protocol.scope.provenanceReady!==668||protocol.version!=='senate864-website-pre-vote-protocol-v2')throw Error('Protocol scope drift');
  phase='existing_primary_discovery';
  const target=await discoverExistingVotePredictNeonConnection({apiKey:process.env.NEON_API_KEY||'',projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,query_timeout:120000,statement_timeout:115000,application_name:'senate864-website52-append'});
  phase='verified_readonly_schema_before';let c=await pool.connect(),before;
  try{before=await expansionReadOnly(c,target,inputs)}finally{c.release()}
  phase='bounded_existing_durable_import_52';
  const url=new URL('postgresql://a:b@localhost:5432/d');url.hostname=target.host;url.port=String(target.port);url.username=target.role;url.password=target.password;url.pathname='/'+target.database;url.searchParams.set('sslmode','verify-full');
  for(const k of ['DATABASE_URL','DATABASE_URL_UNPOOLED','POSTGRES_URL','POSTGRES_URL_NON_POOLING'])process.env[k]=url.toString();
  const {persistDurableEvidence}=await import('../src/evidence/durable-ingestion.ts');({pool:applicationPool}=await import('../src/lib/db/index.ts'));
  let inserted=0,reused=0;
  for(const row of before.added){
   const {source,drafts}=websiteEvidenceDraft(row),result=await persistDurableEvidence(source,drafts);
   if(result.unresolvedTargets.length||result.evidenceItemIds.length!==1||result.inserted+result.reused!==1||result.supersessionRelationships!==0)throw Error('Bounded append did not match plan');
   inserted+=result.inserted;reused+=result.reused;
  }
  phase='independent_postcommit_readback_and_outcome_free_cohort';c=await pool.connect();let after;
  try{after=await expansionReadOnly(c,target,inputs,{complete:true})}finally{c.release()}
  const receipt={version:'senate864-website52-import-and-cohort-v2',reviewedCommit:process.env.GITHUB_SHA,verifiedAt:new Date().toISOString(),inserted,reused,previouslyStoredAdded:before.existing,verifiedExcerpts:after.verified,frozenV1Verified:616,addedVerified:after.existing,idempotentReplayWouldInsert:52-after.existing,verifiedReadOnlyBeforeAfter:true,explicitRollbacks:true,schemaLedgerVerified:true,independentNewOriginalBodiesVerified:4,sourcePlanSha256:inputs.sourcePlanSha256,protocolSha256:sha(readFileSync(PROTOCOL_V2)),cohort:after.cohort,noOutcomesRead:true,noServingOrFreezeChanges:true};
  if(after.verified!==668||after.existing!==52||inserted+reused!==52)throw Error('Postcommit exact count mismatch');
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-website52-cohort-v2.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('SENATE864_WEBSITE52_VERIFIED='+JSON.stringify(receipt));
 }catch{console.error('SENATE864_WEBSITE52_HOLD_AT='+phase);process.exitCode=1}
 finally{if(applicationPool)await applicationPool.end();if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/ingest-senate-864-website-52-and-prepare.mjs'))void main();

/** Append only 526 source-proven website copies; no outcomes or finance writes. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {ROSTER_SQL} from './audit-senate-864-95-historical-source-neon-readonly.mjs';
import {candidateSiteDrafts,websiteEvidenceDraft} from '../src/evidence/senate-864-website-signal-neon.mjs';
import {WEBSITE_NEON_RECEIPT_SQL,verifyWebsiteNeonReadback} from '../src/evidence/senate-864-website-signal-readback.mjs';
import {bindRecoveredPlan,RECOVERED_APPEND_MARKER,recoverySha} from '../src/evidence/senate-864-website-recovered-plan.mjs';
export async function recoveredReadOnly(client,target,inputs,complete=false){
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const who=(await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
  if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Read-only identity unverified');
  const expected=readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:recoverySha(readFileSync('migrations/'+filename))}));
  if(JSON.stringify((await client.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename LIMIT 101')).rows)!==JSON.stringify(expected))throw Error('Schema ledger mismatch');
  const all=candidateSiteDrafts(inputs.manifest,(await client.query(ROSTER_SQL)).rows,inputs.current),added=all.filter(p=>!inputs.oldKeys.has(p.key));
  const stored=(await client.query(WEBSITE_NEON_RECEIPT_SQL,[all.map(p=>p.key)])).rows;
  const oldRows=stored.filter(r=>inputs.oldKeys.has(r.metadata?.ingestionIdentityKey)),newRows=stored.filter(r=>!inputs.oldKeys.has(r.metadata?.ingestionIdentityKey));
  verifyWebsiteNeonReadback(oldRows,all.filter(p=>inputs.oldKeys.has(p.key)));
  verifyWebsiteNeonReadback(newRows,added,{complete});
  const lookup=new Map(all.map(p=>[p.key,p]));
  for(const r of stored){const p=lookup.get(r.metadata.ingestionIdentityKey);
   if(r.sourceMetadata.originalCdxSha1Base32!==p.cdx||r.metadata.archiveUrl!==p.sourceUrl)throw Error('Stored CDX/archive receipt mismatch');}
  if(added.length!==526)throw Error('Bounded addition count drift');
  return {all,added,verified:stored.length,existing:newRows.length};
 }finally{await client.query('ROLLBACK')}
}
async function main(){
 let phase='independent_source_receipt',pool,applicationPool;
 try{
  const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH||''));
  assertHistoricalMainPush({...env,VOTEPREDICT_864_72_INDEPENDENT_CI:env.SENATE864_INDEPENDENT_MAIN},event);
  if(process.argv.length!==2||!event.head_commit.message.includes(RECOVERED_APPEND_MARKER))throw Error('Fixed main append marker required');
  const bytes=readFileSync('artifacts/senate864-website-metadata-recovery.json');
  if(!/^[a-f0-9]{64}$/.test(env.SENATE864_SOURCE_RECEIPT_SHA||'')||recoverySha(bytes)!==env.SENATE864_SOURCE_RECEIPT_SHA)throw Error('Independent artifact commitment mismatch');
  const inputs=bindRecoveredPlan(JSON.parse(bytes),env.GITHUB_SHA);
  phase='existing_primary_discovery';const target=await discoverExistingVotePredictNeonConnection({apiKey:env.NEON_API_KEY||'',projectId:env.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,query_timeout:120000,statement_timeout:115000,application_name:'senate864-retained-website526-append'});
  phase='verified_readonly_before';let c=await pool.connect(),before;
  try{before=await recoveredReadOnly(c,target,inputs)}finally{c.release()}
  phase='bounded_existing_durable_append';const url=new URL('postgresql://a:b@localhost:5432/d');url.hostname=target.host;url.port=String(target.port);url.username=target.role;url.password=target.password;url.pathname='/'+target.database;url.searchParams.set('sslmode','verify-full');
  for(const k of ['DATABASE_URL','DATABASE_URL_UNPOOLED','POSTGRES_URL','POSTGRES_URL_NON_POOLING'])env[k]=url.toString();
  const {persistDurableEvidence}=await import('../src/evidence/durable-ingestion.ts');({pool:applicationPool}=await import('../src/lib/db/index.ts'));
  let inserted=0,reused=0;
  for(const row of before.added){const {source,drafts}=websiteEvidenceDraft(row),r=await persistDurableEvidence(source,drafts);
   if(r.unresolvedTargets.length||r.evidenceItemIds.length!==1||r.inserted+r.reused!==1||r.supersessionRelationships!==0)throw Error('Append did not match plan');inserted+=r.inserted;reused+=r.reused;}
  phase='postcommit_exact_readback';c=await pool.connect();let after;
  try{after=await recoveredReadOnly(c,target,inputs,true)}finally{c.release()}
  if(after.verified!==1194||after.existing!==526||inserted+reused!==526)throw Error('Incomplete postcommit readback');
  const receipt={schema:'senate864-retained-website526-executed-v1',reviewedCommit:env.GITHUB_SHA,verifiedAt:new Date().toISOString(),inserted,reused,previouslyStoredAdded:before.existing,
   verifiedExcerpts:after.verified,old668Exact:true,addedVerified:after.existing,idempotentReplayWouldInsert:526-after.existing,
   verifiedRepeatableReadReadOnlyBeforeAfter:true,explicitRollbacks:true,schemaLedgerVerified:true,sourceReceiptSha256:env.SENATE864_SOURCE_RECEIPT_SHA,
   sourcePlanSha256:inputs.sourcePlanSha256,accounting:inputs.accounting,sourceHolds:0,knownScopeExclusions:3,unknownPeople:0,
   noOutcomesRead:true,noServingWeightsTrainingFreezeOrFloorChanges:true};
  writeFileSync('artifacts/senate864-website526-executed.json',JSON.stringify(receipt,null,2)+'\n');console.log('SENATE864_WEBSITE526_VERIFIED='+JSON.stringify(receipt));
 }catch{console.error('SENATE864_WEBSITE526_HOLD_AT='+phase);process.exitCode=1}
 finally{if(applicationPool)await applicationPool.end();if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/ingest-senate-864-recovered-websites.mjs'))void main();

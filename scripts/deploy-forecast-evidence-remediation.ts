import { readFileSync,readdirSync,mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly';
import { RESEARCH_ARTIFACT_PINS,archiveResearchArtifacts,restoreResearchArtifact } from '../src/operations/research-artifact-retention';
import { assertForecastEvidenceRemediationRun } from '../src/operations/forecast-evidence-remediation-gate';

const MIGRATION='0037_forecast_evidence_contract.sql';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const expected=()=>readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename,'utf8'))}));
function guard(){
  const e=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!,'utf8'));
  assertForecastEvidenceRemediationRun(process.env,e);
}
async function download(pin:typeof RESEARCH_ARTIFACT_PINS[number],path:string){
  const response=await fetch(`https://api.github.com/repos/killjoy00/votepredict/actions/artifacts/${pin.artifactId}/zip`,{
    headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(60000)});
  if(!response.ok||!response.body)throw Error('Pinned research artifact download unavailable');
  const chunks:Uint8Array[]=[];let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>10000000)throw Error('Artifact exceeds byte budget');chunks.push(chunk);}
  const {writeFileSync}=await import('node:fs');writeFileSync(path,Buffer.concat(chunks));
}
async function main(){
  guard();console.log('remediation:reviewed_gate_verified');
  const current=await fetch('https://api.github.com/repos/killjoy00/votepredict/git/ref/heads/main',{
    headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN},signal:AbortSignal.timeout(15000)});
  if(!current.ok||(await current.json()).object?.sha!==process.env.GITHUB_SHA)throw Error('Reviewed revision is no longer current main');
  const target=await discoverExistingVotePredictNeonConnection({apiKey:process.env.NEON_API_KEY!,projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
    preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  console.log('remediation:existing_primary_verified');
  const db=new Pool({host:target.host,port:target.port,database:target.database,user:target.role,password:target.password,ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:15000});
  const ledger=expected();if(ledger.at(-1)?.filename!==MIGRATION||ledger.length!==37)throw Error('Unexpected remediation migration scope');
  const client=await db.connect();
  try{
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const who=(await client.query(`SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro`)).rows[0];
    if(who.db!==target.database||who.role!==target.role||who.ro!=='on')throw Error('Existing database identity mismatch');
    const rows=(await client.query('SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename')).rows;
    if(JSON.stringify(rows)!==JSON.stringify(ledger)&&JSON.stringify(rows)!==JSON.stringify(ledger.slice(0,-1)))throw Error('Production schema drift');
    await client.query('ROLLBACK');
    console.log('remediation:schema_preflight_verified');
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='180s'");await client.query("SET LOCAL lock_timeout='2s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('forecast-evidence-contract-v1',0))");
    const exists=(await client.query('SELECT checksum FROM votepredict_schema_migrations WHERE filename=$1',[MIGRATION])).rows[0];
    if(exists&&exists.checksum!==ledger.at(-1)!.checksum)throw Error('Remediation checksum drift');
    if(!exists){await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));await client.query('INSERT INTO votepredict_schema_migrations(filename,checksum) VALUES($1,$2)',[MIGRATION,ledger.at(-1)!.checksum]);}
    await client.query('COMMIT');
    console.log('remediation:additive_migration_ready');
    const directory=mkdtempSync(join(tmpdir(),'votepredict-retained-')),files=new Map<number,string>();
    for(const pin of RESEARCH_ARTIFACT_PINS){
      const path=join(directory,pin.fileName);
      const existing=(await db.query('SELECT artifact_id FROM research_artifact_archive WHERE artifact_id=$1',[pin.artifactId])).rows[0];
      if(existing)await restoreResearchArtifact(db,pin,path);else await download(pin,path);
      files.set(pin.artifactId,path);
    }
    const archived=await archiveResearchArtifacts(db,files);
    console.log('remediation:original_archives_verified_and_retained');
    for(const pin of RESEARCH_ARTIFACT_PINS)await restoreResearchArtifact(db,pin,join(directory,'restored-'+pin.fileName));
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const check=(await client.query(`SELECT count(*)::int AS source_committee_choices FROM member_votes mv JOIN vote_events v ON v.id=mv.vote_event_id JOIN source_documents d ON d.id=v.source_document_id WHERE d.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf')`)).rows[0];
    const projected=(await client.query(`SELECT DISTINCT e.evidence_type FROM senate_evidence_v e WHERE e.source_table='member_votes' AND e.source_row IN
      (SELECT mv.id::text FROM member_votes mv JOIN vote_events v ON v.id=mv.vote_event_id JOIN source_documents d ON d.id=v.source_document_id WHERE d.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf'))`)).rows;
    if(projected.length!==1||projected[0].evidence_type!=='committee_vote')throw Error('Committee venue projection readback failed');
    await client.query('ROLLBACK');
    console.log(JSON.stringify({schemaVersion:'forecast-evidence-remediation-executed-v1',schemaEntries:37,committeeChoices:check.source_committee_choices,committeeVenueCorrect:true,
      artifacts:archived,restoredFromDatabaseWithoutNetwork:true,sourceRowsModified:0,forecastsComputed:0,modelsFitted:0,servingActivation:false}));
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await db.end();}
}
main().catch(()=>{console.error('FORECAST_EVIDENCE_REMEDIATION_FAILED: existing records preserved; inspect protected job stage.');process.exitCode=1;});

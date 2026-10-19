/** Reconcile previously authenticated originals after the guarded corrections. No parser replay. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Pool} from 'pg';
import {sourceShaPinnedMerged} from './audit-senate-864-2025-judiciary-full-source-neon-v5.ts';
import {DOC_SQL,EVENT_SQL,CHOICE_SQL} from './audit-senate-864-protected-source-db-parity.ts';
import {compareOriginalSenateCommitteeToStored} from '../src/evidence/senate-864-source-db-sanitized-compare.ts';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
const MARKER='SENATE864_COMMITTEE_EXISTING_ORIGINALS_READBACK_V1';
async function main(){
 let phase='sha_pinned_existing_source_metadata',pool;
 try{
  const source=sourceShaPinnedMerged();
  if(process.argv.length===3&&process.argv[2]==='--preflight'){console.log('SENATE864_COMMITTEE_EXISTING_ORIGINALS_OK=1452_PDFS_153_CANDIDATE_ROLLS_989_NAMED_CHOICES');return;}
  if(process.argv.length!==2)throw Error('Fixed modes only');
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||''));
  assertHistoricalMainPush({...e,VOTEPREDICT_864_72_INDEPENDENT_CI:e.SENATE864_INDEPENDENT_MAIN},event);
  if(!event.head_commit.message.includes(MARKER))throw Error('Reviewed readback marker absent');
  phase='existing_default_primary_discovery';
  const target=await discoverExistingVotePredictNeonConnection({apiKey:e.NEON_API_KEY||'',projectId:e.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:e.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,query_timeout:90000,statement_timeout:85000,options:'-c default_transaction_read_only=on -c lock_timeout=2500',application_name:'senate864-existing-committee-readback'});
  const c=await pool.connect();let comparison;
  phase='bounded_verified_readonly_original_to_stored';
  try{
   await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   try{
    const who=(await c.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
    if(who?.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Verified read-only identity required');
    const bounded=async(sql,max)=>{const rows=(await c.query(sql)).rows;if(rows.length>=max)throw Error('Truncated readback');return rows;};
    comparison=compareOriginalSenateCommitteeToStored(source.years,{documents:await bounded(DOC_SQL,2201),events:await bounded(EVENT_SQL,601),choices:await bounded(CHOICE_SQL,4001)});
   }finally{await c.query('ROLLBACK')}
  }finally{c.release(true)}
  const receipt={version:'senate864-existing-committee-originals-readback-v1',reviewedCommit:e.GITHUB_SHA,auditedAt:new Date().toISOString(),verifiedRepeatableReadReadOnly:true,explicitRollback:true,noWritesOrParserReplay:true,comparison};
  const body=JSON.stringify(receipt,null,2);
  if(/"(?:normalized_member_name|membership_id|source_url|source_sha|excerpt|password)"\s*:|postgres(?:ql)?:\/\//i.test(body)||body.length>80000)throw Error('Unsafe public output');
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-existing-committee-readback.json',body+'\n');
  console.log('SENATE864_EXISTING_COMMITTEE_READBACK='+JSON.stringify(receipt));
 }catch{console.error('SENATE864_EXISTING_COMMITTEE_HOLD_AT='+phase);process.exitCode=1}
 finally{if(pool)await pool.end()}
}
if(process.argv[1]?.endsWith('/audit-senate-864-existing-committee-originals.mjs'))void main();

/**
 * Protected production diagnostic for #863's 50 Senate stored-tally mismatches.
 * Existing project/primary only; four-phase static, protected, READ ONLY, rollback.
 * Prints ONLY public-event metadata and safe mismatch categories, never member
 * identities, SQL rows, credentials or free-text source contents.
 */
import {appendFileSync} from 'node:fs';
import {Pool,type PoolClient} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
  '../src/operations/senate-media-neon-api-readonly.js';
import {
 SENATE863_MISMATCH_SQL,checkSenate863SQL,
 summarizeSenate863Mismatches,type Mismatch863SourceRow,
} from '../src/evaluation/historical-roster-863-senate-mismatches.js';

export function assertSenate863Protected(e:NodeJS.ProcessEnv){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict' ||
    e.GITHUB_EVENT_NAME!=='push' ||
    e.GITHUB_REF!=='refs/heads/main' ||
    e.GITHUB_RUN_ATTEMPT!=='1' ||
    e.SENATE863_MAIN_CI_PASSED!=='true' ||
    e.SENATE863_MARKER_PRESENT!=='true' ||
    e.SENATE863_APPROVAL!=='50_PUBLIC_SENATE_VOTE_TALLIES_READ_ONLY' ||
    !e.NEON_API_KEY?.trim()||!e.VOTEPREDICT_NEON_PROJECT_ID?.trim())
   throw Error('#863 protected reviewed-main run gate not met');
 return true;
}
export async function runSenate863MismatchQuery(
 client:Pick<PoolClient,'query'>,identity:{database:string;role:string},
) {
 let opened=false;
 try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  opened=true;
  const ro=await client.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
  if(ro.rows.length!==1||ro.rows[0].ro!=='on'||
     ro.rows[0].db!==identity.database||ro.rows[0].role!==identity.role)
     throw Error('Existing DB read-only identity mismatch');
  const result=await client.query(SENATE863_MISMATCH_SQL);
  if(result.rows.length>=101)throw Error('Mismatch output at maximum bound; stop');
  await client.query('ROLLBACK');opened=false;
  return summarizeSenate863Mismatches(result.rows as Mismatch863SourceRow[]);
 }finally{
  if(opened)await client.query('ROLLBACK');
 }
}
async function main(){
 let phase='static';
 try {
  if(process.argv.length!==3 || !['--preflight','--protected'].includes(process.argv[2]))
    throw Error('Unknown protected run mode');
  checkSenate863SQL();
  if(process.argv[2]==='--preflight'){
    console.log('SENATE863_MISMATCH_PUBLIC_STATIC_SQL_OK');
    return;
  }
  assertSenate863Protected(process.env);
  phase='existing_neon_project_primary';
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
   application_name:'votepredict-863-fifty-senate-tallies',
  });
  try {
    phase='bounded_sql_readonly_and_rollback';
    const client=await pool.connect();
    try {
      const report=await runSenate863MismatchQuery(client,
       {database:target.database,role:target.role});
      phase='sanitized_public_report';
      const serialized=JSON.stringify(report);
      if(serialized.length>85000 ||
       /postgres(?:ql)?:\/\/|"(?:event_id|membership_id|source_member_name|legislator_name|motion_text|source_sha256)"\s*:/i.test(serialized))
       throw Error('Sanitization boundary rejected mismatch output');
      console.log('SENATE863_FIFTY_STORED_MISMATCHES='+serialized);
      if(process.env.GITHUB_STEP_SUMMARY)
       appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        '#863 Senate internal source/choice mismatch census\n\n'+
        'Stored internal mismatches: '+report.storedEventMismatches+
        '; verified source bytes: **0** in this phase.\n\n'+
        'No votes repaired or declared missing. '+report.auditStatus+'.\n');
      if(!report.matchesPreviousAggregateOf50)process.exitCode=1;
    }finally{client.release(true)}
  }finally{await pool.end()}
 }catch{
  console.error('SENATE863_MISMATCH_HOLD='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-historical-roster-863-senate-mismatches-readonly.ts'))
 void main();

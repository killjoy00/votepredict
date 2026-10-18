/**
 * #863 protected read-only original-vote-roster parity. No database writes,
 * credential output, source-person export, model fitting or serving changes.
 */
import { appendFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { discoverExistingVotePredictNeonConnection } from
  '../src/operations/senate-media-neon-api-readonly.js';
import {
  ROSTER_863_QUERIES,assertRoster863StaticQueries,
  reconcileRoster863,
  type Roster863Event,type Roster863Choice,type Roster863Membership,
  type Roster863Universe,
} from '../src/evaluation/historical-roster-863-audit.js';

export function assertRoster863Environment(e:NodeJS.ProcessEnv):true {
  if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict' ||
    e.GITHUB_REF!=='refs/heads/main' ||
    e.GITHUB_EVENT_NAME!=='push' ||
    e.GITHUB_RUN_ATTEMPT!=='1' ||
    e.ROSTER_863_MAIN_CI_PASSED!=='true' ||
    e.ROSTER_863_MARKER_PRESENT!=='true' ||
    e.ROSTER_863_APPROVAL!=='2025_OATH_DAY_READ_ONLY' ||
    !e.NEON_API_KEY?.trim() || !e.VOTEPREDICT_NEON_PROJECT_ID?.trim())
    throw Error('Protected #863 reviewed-main read-only workflow required');
  return true;
}

function bounded<T>(rows:unknown,max:number):T[] {
  if(!Array.isArray(rows)||rows.length>=max)throw Error('#863 bounded select HOLD');
  return rows as T[];
}
export async function readRoster863(client:PoolClient,identity:{database:string;role:string}) {
  let open=false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    open=true;
    const verified=await client.query(
      "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
    if(verified.rows.length!==1 ||
      verified.rows[0].db!==identity.database ||
      verified.rows[0].role!==identity.role || verified.rows[0].ro!=='on')
      throw Error('#863 existing database identity or transaction read-only HOLD');
    const events=bounded<Roster863Event>((await client.query(ROSTER_863_QUERIES[0])).rows,34);
    const choices=bounded<Roster863Choice>((await client.query(ROSTER_863_QUERIES[1])).rows,2001);
    const memberships=bounded<Roster863Membership>(
      (await client.query(ROSTER_863_QUERIES[2])).rows,401);
    const universe=bounded<Roster863Universe>(
      (await client.query(ROSTER_863_QUERIES[3])).rows,9);
    await client.query('ROLLBACK');open=false;
    return reconcileRoster863({events,choices,memberships,universe});
  } finally {
    if(open)await client.query('ROLLBACK');
  }
}
async function main() {
  let phase='static';
  try {
    if(process.argv.length!==3 || !['--preflight','--protected'].includes(process.argv[2]))
      throw Error('Only --preflight or --protected permitted');
    assertRoster863StaticQueries();
    if(process.argv[2]==='--preflight') {
      console.log('ROSTER_863_KEYLESS_STATIC_SELECT_REVIEW_OK');
      return;
    }
    assertRoster863Environment(process.env);
    phase='existing_neon_project_primary_identity';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY!,
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
    });
    const pool=new Pool({host:target.host,port:target.port,
      database:target.database,user:target.role,password:target.password,
      ssl:{rejectUnauthorized:true},max:1,
      connectionTimeoutMillis:10000,query_timeout:75000,statement_timeout:70000,
      options:'-c default_transaction_read_only=on -c statement_timeout=70000 -c lock_timeout=3000',
      application_name:'votepredict-863-2025-oath-readonly',
    });
    try {
      phase='four_bounded_read_only_queries';
      const client=await pool.connect();
      try {
        const report=await readRoster863(client,
          {database:target.database,role:target.role});
        phase='explicit_rollback_completed';
        const safe=JSON.stringify(report);
        if(safe.length>9000 ||
          /(?:postgres(?:ql)?:\/\/|https?:\/\/|"(?:membership_id|source_member_name|source_url|legislator_name|source_sha256)"\s*:)/i.test(safe))
          throw Error('Sanitized roster aggregate receipt privacy HOLD');
        console.log('ROSTER_863_READONLY_RECONCILIATION='+safe);
        if(process.env.GITHUB_STEP_SUMMARY) {
          appendFileSync(process.env.GITHUB_STEP_SUMMARY,
            '#863 vote-day roster diagnostic (READ ONLY, rolled back)\n\n'+
            'Reviewed witness events: '+report.reconciledCount+'/'+report.targetCount+
            '\n\nResult: '+report.status+
            '\n\nInternal stored-tally coverage is not an official external denominator.\n');
        }
      } finally {client.release(true)}
    } finally {await pool.end()}
  } catch {
    console.error('ROSTER_863_READONLY_HOLD='+phase);
    process.exitCode=1;
  }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-historical-roster-863-readonly.ts'))
  void main();

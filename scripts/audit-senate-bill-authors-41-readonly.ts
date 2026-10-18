/**
 * Owner-requested manual inventory of 41 unresolved raw bill-author source scans.
 * Protected GitHub one-shot only: existing Neon default branch, READ ONLY,
 * repeatable-read SQL, bounded public bill IDs/HTTP receipt metadata.
 * No Revisor requests, writes, migrations or credentials in output.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';

const REPO='killjoy00/votepredict';
const MARKER='SENATE_BILL_AUTHORS_MANUAL_41_READONLY_AUDIT';
const SESSIONS=['2021-2022','2023-2024','2025-2026'];
type PublicRow={
  session:string; identifier:string; chamber:string;
  result:string|null; http_status:number|null;
  attempts:number|null; checked_at:string|null;
};
type GitHubEvent={
  repository?:{full_name?:string;default_branch?:string};
  ref?:string;after?:string;deleted?:boolean;forced?:boolean;
  head_commit?:{id?:string;message?:string};
};
function assertLaunch():void {
  const env=process.env;
  if(env.GITHUB_ACTIONS!=='true' || env.GITHUB_REPOSITORY!==REPO ||
     env.GITHUB_EVENT_NAME!=='push' || env.GITHUB_REF!=='refs/heads/main' ||
     env.GITHUB_RUN_ATTEMPT!=='1' ||
     env.VOTEPREDICT_AUTHORS_41_READONLY_CI!=='true' ||
     !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'') ||
     !env.GITHUB_EVENT_PATH) throw Error('Reviewed exact-main one-shot read-only gate required');
  const ev=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as GitHubEvent;
  if(ev.repository?.full_name!==REPO || ev.repository.default_branch!=='main' ||
     ev.ref!=='refs/heads/main' || ev.after!==env.GITHUB_SHA ||
     ev.head_commit?.id!==env.GITHUB_SHA ||
     !ev.head_commit?.message?.includes(MARKER) ||
     ev.deleted===true || ev.forced===true)
    throw Error('Unrecognized reviewed main marker or repository event');
}
export const EXCEPTIONS_SQL=[
  'SELECT s.slug AS session,b.identifier,',
  "CASE WHEN b.identifier ~* '^SF' THEN 'senate' ELSE 'house' END AS chamber,",
  'scan.result,scan.http_status,scan.attempts,scan.checked_at::text AS checked_at',
  'FROM bills b',
  'JOIN legislative_sessions s ON s.id=b.session_id',
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
  'LEFT JOIN senate_bill_author_scans scan ON scan.bill_id=b.id',
  "WHERE s.slug=ANY($1::text[]) AND",
  "(b.identifier ~* '^SF[0-9]{1,6}$' OR",
  "(b.identifier ~* '^HF[0-9]{1,6}$' AND EXISTS (",
  'SELECT 1 FROM bill_companions cp WHERE cp.house_bill_id=b.id AND cp.session_id=s.id)))',
  "AND (scan.bill_id IS NULL OR scan.result='source_error')",
  'ORDER BY s.slug,b.identifier LIMIT 101',
].join(' ');
function validatePublicRow(row:PublicRow):PublicRow {
  if(!SESSIONS.includes(row.session) ||
    !/^(?:SF|HF)[1-9][0-9]{0,5}$/.test(row.identifier) ||
    !['senate','house'].includes(row.chamber) ||
    row.chamber!==(row.identifier.startsWith('SF')?'senate':'house') ||
    ![null,'source_error'].includes(row.result) ||
    (row.http_status!==null && (!Number.isInteger(row.http_status) ||
      row.http_status<100 || row.http_status>599)) ||
    (row.attempts!==null && (!Number.isInteger(row.attempts) || row.attempts<1)) ||
    (row.checked_at!==null &&
      (typeof row.checked_at!=='string'||row.checked_at.length>50)))
    throw Error('Non-public or unexpected scan receipt shape');
  return row;
}
async function main():Promise<void>{
  assertLaunch();
  const apiKey=process.env.NEON_API_KEY?.trim();
  const projectId=process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim();
  if(!apiKey || !projectId)throw Error('Protected Neon credentials unavailable');
  const target=await discoverExistingVotePredictNeonConnection({
    apiKey,projectId,
    preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim() || undefined,
    requirePrimary:true,
  });
  const pool=new Pool({
    host:target.host,port:target.port,database:target.database,
    user:target.role,password:target.password,ssl:{rejectUnauthorized:true},
    max:1,connectionTimeoutMillis:8000,query_timeout:15000,
    statement_timeout:15000,application_name:'votepredict-authors-41-manual-readonly',
    options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=4000',
  });
  try {
    const client=await pool.connect();
    let opened=false;
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      opened=true;
      const identity=(await client.query<{
        db:string;role:string;ro:string;scans:string|null;catalog:string|null;
      }>(
        "SELECT current_database() AS db,current_user AS role,"+
        "current_setting('transaction_read_only') AS ro,"+
        "to_regclass('public.senate_bill_author_scans')::text AS scans,"+
        "to_regclass('public.bills')::text AS catalog"
      )).rows[0];
      if(!identity || identity.db!==target.database ||
        identity.role!==target.role || identity.ro!=='on' ||
        !identity.scans || !identity.catalog)
        throw Error('Existing marked database READ ONLY identity check failed');
      const rows=(await client.query<PublicRow>(EXCEPTIONS_SQL,[SESSIONS])).rows;
      if(rows.length>100)throw Error('Exception query exceeded approved 100-bill bound');
      const safe=rows.map(validatePublicRow);
      const bySession=Object.fromEntries(SESSIONS.map(x=>
        [x,safe.filter(v=>v.session===x).length]));
      // Public identifiers, dates and status counts only; no author names or source bytes.
      console.log('SENATE_BILL_AUTHORS_MANUAL_EXCEPTION_READBACK='+JSON.stringify({
        status:'read_only_rolled_back',remaining:safe.length,bySession,
        rows:safe,databaseModified:false,
      }));
    } finally {
      if(opened)await client.query('ROLLBACK');
      client.release();
    }
  }finally{await pool.end();}
}
main().catch(()=>{
  // Never print thrown Neon HTTP/client errors: may contain URI/password.
  console.error('Read-only 41-bill authorship exception inventory failed at a protected gate');
  process.exitCode=1;
});

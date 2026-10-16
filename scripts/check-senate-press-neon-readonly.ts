/**
 * Read-only production status for raw first-party Minnesota Senate statements.
 * Exact reviewed main commit + independent keyless CI + existing protected
 * Neon credential boundary. No source text or credentials in logs.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { discoverExistingVotePredictNeonConnection } from '../src/operations/senate-media-neon-api-readonly.js';

const MARKER='SENATE_PRESS_COUNTS_READONLY_20261015';
const MIGRATION='0016_senate_raw_statements.sql';
const SOURCES=new Set(['senate_dfl','senate_republicans']);

function assertMain():void {
  const env=process.env;
  if(process.argv.length!==2 || env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
    || env.GITHUB_EVENT_NAME!=='push' || env.GITHUB_REF!=='refs/heads/main'
    || env.GITHUB_RUN_ATTEMPT!=='1' || env.VOTEPREDICT_SENATE_PRESS_COUNTS_CI!=='true'
    || !/^[0-9a-f]{40}$/.test(env.GITHUB_SHA??'') || !env.GITHUB_EVENT_PATH)
    throw Error('Protected read-only reviewed main prerequisite missing');
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')) as {
    ref?:string;after?:string;deleted?:boolean;forced?:boolean;
    repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
  };
  if(event.ref!=='refs/heads/main'||event.after!==env.GITHUB_SHA
    ||event.deleted===true||event.forced===true
    ||event.repository?.full_name!==env.GITHUB_REPOSITORY
    ||event.head_commit?.id!==env.GITHUB_SHA
    ||!event.head_commit?.message?.includes(MARKER))
    throw Error('Protected read-only commit marker missing');
}

async function main():Promise<void>{
  let phase='reviewed_main_gate';
  let pool:Pool|undefined;
  try {
    assertMain();
    phase='discover_existing_neon_default_primary';
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey:process.env.NEON_API_KEY?.trim()??'',
      projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
      preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    });
    pool=new Pool({
      host:target.host,port:target.port,user:target.role,
      password:target.password,database:target.database,
      ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,
      statement_timeout:25000,query_timeout:30000,
      application_name:'votepredict-senate-press-counts-readonly',
      options:'-c statement_timeout=25000 -c lock_timeout=3000',
    });
    const client=await pool.connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try{
        phase='verify_identity_migration_and_table';
        const identity=await client.query<{
          db:string;role:string;readonly:string;table_name:string|null;
        }>(
          "SELECT current_database() AS db,current_user AS role,"+
          "current_setting('transaction_read_only') AS readonly,"+
          "to_regclass('public.senate_raw_statements')::text AS table_name",
        );
        const row=identity.rows[0];
        if(!row || row.db!==target.database || row.role!==target.role
          || row.readonly!=='on' || row.table_name!=='senate_raw_statements')
          throw Error('Production primary identity or raw statement table missing');
        const ledger=await client.query<{checksum:string}>(
          'SELECT checksum FROM votepredict_schema_migrations WHERE filename=$1',
          [MIGRATION],
        );
        const expected=createHash('sha256')
          .update(readFileSync('migrations/'+MIGRATION,'utf8')).digest('hex');
        if(ledger.rows.length!==1 || ledger.rows[0].checksum!==expected)
          throw Error('Production raw statements migration checksum does not match reviewed file');
        phase='readonly_aggregated_statement_counts';
        const groups=await client.query<{
          source_id:string;year:string;total:string;with_date:string;with_text:string;
        }>(
          "SELECT source_id,COALESCE(to_char(published_on,'YYYY'),'undated') AS year,"+
          "COUNT(*)::text AS total,COUNT(published_on)::text AS with_date,"+
          "COUNT(*) FILTER(WHERE length(raw_text)>0)::text AS with_text "+
          "FROM senate_raw_statements GROUP BY source_id,year ORDER BY source_id,year",
        );
        const bySourceYear=groups.rows.map(r=>{
          if(!SOURCES.has(r.source_id) || !/^(20[0-9]{2}|undated)$/.test(r.year))
            throw Error('Unexpected unreviewed raw statement source/date');
          const count=Number(r.total),withDate=Number(r.with_date),withText=Number(r.with_text);
          if(![count,withDate,withText].every(n=>Number.isSafeInteger(n)&&n>=0)
            || withDate>count || withText!==count)
            throw Error('Raw statement aggregate failed safe bounds');
          return {source:r.source_id,year:r.year,count,withDate};
        });
        const total=bySourceYear.reduce((sum,r)=>sum+r.count,0);
        const status={migration:MIGRATION,checksumVerified:true,
          storage:'existing_VotePredict_Neon_default_primary',
          rawTablePresent:true,total,bySourceYear,readOnly:true};
        phase='complete';
        console.log('SENATE_PRESS_PRODUCTION_READONLY='+JSON.stringify(status));
        if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          '## Senate press raw production read-only counts\n\n'+
          'Migration '+MIGRATION+' checksum verified. Total: '+total+'\n\n'+
          bySourceYear.map(x=>'- '+x.source+' '+x.year+': '+x.count).join('\n')+
          '\n\nRead-only transaction explicitly rolled back. No original text exported.\n');
      }finally{await client.query('ROLLBACK');}
    }finally{client.release();}
  }catch{
    console.error('SENATE_PRESS_PRODUCTION_READONLY_HELD_AT='+phase);
    process.exitCode=1;
  }finally{
    if(pool)try{await pool.end();}catch{process.exitCode=1;}
  }
}
void main();

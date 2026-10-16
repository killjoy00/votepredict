/**
 * Exact protected collector read-only SQL against ephemeral local CI Postgres.
 * Never opens a connection outside the loopback test database.
 */
import {Pool} from 'pg';
const url=process.env.DATABASE_URL_UNPOOLED??'';
if(!url||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/votepredict')
  throw Error('Only ephemeral GitHub CI PostgreSQL is permitted');
const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000});
async function run():Promise<void>{
  const client=await pool.connect();
  try{
    const original='https://senatedfl.mn/senator-sql-readback-fixture/';
    await client.query(
      'INSERT INTO senate_raw_statements '+
      '(source_id,source_type,source_url,fetched_at,published_on,title,named_senators,bill_identifiers,raw_text) '+
      "VALUES ('senate_dfl','senate_dfl_caucus_and_members',$1,now(),'2024-06-01','SQL readback fixture',ARRAY[]::text[],ARRAY[]::text[],'A full original publication fixture for testing grouped year counts') "+
      'ON CONFLICT(source_url) DO NOTHING',[original]);
    await client.query(
      'INSERT INTO senate_raw_statement_archive_captures '+
      '(source_url,archive_provider,archive_snapshot_url,captured_at,archive_digest,body_sha256) '+
      "VALUES ($1,'internet_archive',$2,'2026-01-28T00:00:00Z',$3,$4) "+
      'ON CONFLICT(source_url) DO NOTHING',
      [original,'https://web.archive.org/web/20260128000000id_/'+original,'A'.repeat(32),'b'.repeat(64)]);
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{
      const a=await client.query<{year:string;total:string}>(
        "SELECT COALESCE(to_char(published_on,'YYYY'),'undated') AS year,COUNT(*)::text AS total "+
        "FROM senate_raw_statements WHERE source_id='senate_dfl' GROUP BY year ORDER BY year");
      const b=await client.query<{year:string;total:string}>(
        "SELECT COALESCE(to_char(s.published_on,'YYYY'),'undated') AS year,COUNT(*)::text AS total "+
        "FROM senate_raw_statement_archive_captures a JOIN senate_raw_statements s ON s.source_url=a.source_url "+
        "WHERE s.source_id='senate_dfl' GROUP BY year ORDER BY year");
      const c=await client.query<{source_url:string}>(
        'SELECT source_url FROM senate_raw_statements WHERE source_url = ANY($1::text[])',[[original]]);
      if(a.rows.find(x=>x.year==='2024')?.total!=='1'||
        b.rows.find(x=>x.year==='2024')?.total!=='1'||
        c.rows[0]?.source_url!==original)
        throw Error('Protected historical DFL year counts or original URL deduplication differ');
      console.log('SENATE_DFL_SITEMAP_SQL_LOCAL='+JSON.stringify({
        passed:true,sourceRows:a.rows.length,archiveRows:b.rows.length,found:c.rows.length,
      }));
    }finally{await client.query('ROLLBACK');}
  }finally{client.release();await pool.end();}
}
void run().catch((e:unknown)=>{
  console.error('SENATE_DFL_SITEMAP_SQL_LOCAL_FAILED='+
    (e instanceof Error?e.name+': '+e.message.slice(0,180):'unknown'));
  process.exitCode=1;
});

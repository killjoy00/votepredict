/**
 * Compile all exact production read-only SQL shapes against ephemeral local
 * Postgres migrations. NEVER connect to protected Neon in this script.
 */
import {Pool} from 'pg';
import {QUERIES,source830} from '../src/evidence/cfb-864-finance-db-reconciliation-v47.mjs';
function assertLocalConnection(){
 const str=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
 if(!str)throw Error('Disposable PostgreSQL connection required');
 const u=new URL(str);
 if(!['localhost','127.0.0.1'].includes(u.hostname)
    ||u.pathname!=='/votepredict'
    ||!['postgres:','postgresql:'].includes(u.protocol)
    ||!['pull_request','push'].includes(process.env.GITHUB_EVENT_NAME??''))
  throw Error('Never compile CFB audit SQL against a remote or production database');
 return str;
}
async function main(){
 const pool=new Pool({connectionString:assertLocalConnection(),max:1,
  connectionTimeoutMillis:4000,statement_timeout:12000,query_timeout:14000,
  options:'-c default_transaction_read_only=on'});
 const source=source830();let open=false;
 try{
  const client=await pool.connect();
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   open=true;
   for(const [name,sql] of Object.entries(QUERIES)){
    const params=sql.includes('$1::jsonb')?[JSON.stringify(source)]:[];
    const result=await client.query('EXPLAIN (FORMAT JSON) '+sql,params);
    if(result.rows.length!==1)throw Error('SQL EXPLAIN failed for bounded '+name);
    console.log('CFB_864_V47_LOCAL_SQL_COMPILED='+name);
   }
   await client.query('ROLLBACK');open=false;
  }finally{
   if(open)try{await client.query('ROLLBACK')}catch{}
   client.release(true);
  }
 }finally{await pool.end()}
}
main().catch(()=>{console.error('CFB_864_V47_LOCAL_SQL_COMPILATION_FAILED');process.exitCode=1});

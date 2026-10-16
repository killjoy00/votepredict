/** #864 ONLY migrated localhost PostgreSQL 18, EXPLAIN without ANALYZE. */
import {Pool} from 'pg';
import {ROSTER_DIAGNOSTIC_QUERIES} from '../../scripts/senate-864-roster-session-diagnostic-sql.js';
let url:URL;
try{url=new URL(process.env.DATABASE_URL_UNPOOLED??'')}
catch{throw Error('Local disposable PostgreSQL connection required')}
const pr=process.env.GITHUB_EVENT_NAME==='pull_request'&&
 /^refs\/pull\/[0-9]+\/merge$/.test(process.env.GITHUB_REF??'');
const main=process.env.GITHUB_EVENT_NAME==='push'&&
 process.env.GITHUB_REF==='refs/heads/main';
if(process.argv.length!==2||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
 ||!pr&&!main ||url.hostname!=='localhost'||url.port!=='5432'
 ||url.pathname!=='/votepredict'||!['postgres:','postgresql:'].includes(url.protocol)
 ||process.env.NEON_API_KEY ||(process.env.DATABASE_URL_UNPOOLED??'').includes('neon.tech'))
 throw Error('Local disposable SQL plan, not Neon or private database, required');
async function execute(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED,max:1,
  query_timeout:6000,statement_timeout:5000,
  options:'-c default_transaction_read_only=on -c statement_timeout=5000'});
 try{
  const conn=await pool.connect();let begun=false;
  try{
   await conn.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   begun=true;
   const id=await conn.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
   if(id.rows.length!==1||id.rows[0].db!=='votepredict'
     ||id.rows[0].role!=='postgres'||id.rows[0].ro!=='on')
    throw Error('Local PostgreSQL role is not the disposable test identity');
   for(const stmt of ROSTER_DIAGNOSTIC_QUERIES){
    if(!/^WITH year_memberships AS MATERIALIZED \(/.test(stmt)
      ||stmt.includes(';')||!/\bLIMIT (6|16)$/.test(stmt)
      ||/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|COPY|GRANT|REVOKE|CALL)\b/i.test(stmt))
     throw Error('Roster diagnostic query must be a fixed immutable bounded SELECT');
    if(!(await conn.query('EXPLAIN '+stmt)).rows.length)
     throw Error('One original roster diagnostic SQL plan cannot compile');
   }
   await conn.query('ROLLBACK');begun=false;
   console.log('VOTEPREDICT_864_THREE_FIXED_YEAR_SESSION_ROSTER_SQL_PLANS_COMPILE=3');
  }finally{
   if(begun)try{await conn.query('ROLLBACK')}catch{/* close */}
   conn.release(true);
  }
 }finally{await pool.end()}
}
void execute().catch(()=>{
 console.error('VOTEPREDICT_864_ROSTER_SQL_LOCAL_ONLY_EXPLAIN_FAILED');
 process.exitCode=1;
});

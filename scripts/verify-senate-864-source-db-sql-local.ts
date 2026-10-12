/** #864: SQL-plan compilation ONLY on migrated disposable CI Postgres. */
import {Pool} from 'pg';
import {COMMITTEE_PARITY_QUERIES} from './audit-senate-864-protected-source-db-parity.js';
const url=process.env.DATABASE_URL_UNPOOLED??'';
let parsed:URL;
try{parsed=new URL(url)}catch{throw Error('Disposable SQL-plan Postgres required')}
const approvedMain=process.env.GITHUB_EVENT_NAME==='push'
 &&process.env.GITHUB_REF==='refs/heads/main';
const approvedPr=process.env.GITHUB_EVENT_NAME==='pull_request'
 &&/^refs\/pull\/[0-9]+\/merge$/.test(process.env.GITHUB_REF??'');
if(process.argv.length!==2||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
 ||(!approvedMain&&!approvedPr)||!['postgres:','postgresql:'].includes(parsed.protocol)
 ||parsed.hostname!=='localhost'||parsed.port!=='5432'
 ||parsed.pathname!=='/votepredict'||url.includes('neon.tech')
 ||process.env.NEON_API_KEY)
 throw Error('No Neon credentials or external SQL endpoints permitted during EXPLAIN');
async function run(){
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:4000,
  query_timeout:6000,statement_timeout:5000,
  options:'-c default_transaction_read_only=on -c statement_timeout=5000'});
 try{
  const c=await pool.connect();let open=false;
  try{
   await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');open=true;
   const r=await c.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
   if(r.rows.length!==1||r.rows[0].db!=='votepredict'||r.rows[0].role!=='postgres'
    ||r.rows[0].ro!=='on')throw Error('Disposable read only PostgreSQL identity invalid');
   for(const sql of COMMITTEE_PARITY_QUERIES){
    if(!/^SELECT\s/i.test(sql)||sql.includes(';')||!/\bLIMIT [0-9]+\b/.test(sql)
      ||/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|COPY|GRANT|REVOKE|CALL)\b/i.test(sql))
     throw Error('Unsafe SQL in source parity query');
    const plan=await c.query('EXPLAIN '+sql);
    if(!plan.rows.length)throw Error('Fixed SELECT cannot be compiled');
   }
   await c.query('ROLLBACK');open=false;
   console.log('VOTEPREDICT_864_THREE_SOURCE_PARITY_SELECT_PLANS_COMPILE_DISPOSABLE_PG=3');
  }finally{
   if(open)try{await c.query('ROLLBACK')}catch{/* close */}
   c.release(true);
  }
 }finally{await pool.end()}
}
void run().catch(()=>{
 console.error('VOTEPREDICT_864_DISPOSABLE_SOURCE_PARITY_SQL_PLANS_FAILED_CLOSED');
 process.exitCode=1;
});

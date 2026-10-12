/** Compile the fixed CFB archived upper-bound V3 SELECT against *disposable* local CI PostgreSQL only.
 * This script must never see Neon credentials or connect to a remote host. */
import {Pool} from 'pg';
import {FIXED_ARCHIVE_V3_SQL} from './audit-cfb-864-neon-finance-archive-upperbound-v3.js';

const raw=process.env.DATABASE_URL_UNPOOLED??'';
let uri:URL;
try{uri=new URL(raw)}catch{throw Error('Local disposable PostgreSQL required')}
const pr=process.env.GITHUB_EVENT_NAME==='pull_request'
 &&/^refs\/pull\/[0-9]+\/merge$/.test(process.env.GITHUB_REF??'');
const main=(process.env.GITHUB_EVENT_NAME==='push'
 ||(process.env.GITHUB_EVENT_NAME==='issue_comment'
   &&process.env.VOTEPREDICT_864_CFB_ARCHIVE_V3_OWNER_COMMENT_VERIFIED==='true'))
 &&process.env.GITHUB_REF==='refs/heads/main';
if(process.argv.length!==2
 ||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
 ||(!pr&&!main)||uri.hostname!=='localhost'||uri.port!=='5432'
 ||uri.pathname!=='/votepredict'
 ||!['postgres:','postgresql:'].includes(uri.protocol)
 ||raw.includes('neon.tech')||process.env.NEON_API_KEY)
 throw Error('Only verified local, keyless, disposable GitHub CI PostgreSQL permitted');
const sql=FIXED_ARCHIVE_V3_SQL;
if(!/^SELECT\s/i.test(sql)||sql.includes(';')
 ||/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|COPY|GRANT|REVOKE|CREATE|CALL)\b/i.test(sql)
 ||!/LIMIT 500/.test(sql)||!/LIMIT 64/.test(sql)
 ||!/WHERE chamber='senate'/.test(sql)||!/GROUP BY 1,2,3 ORDER BY 1,2,3/.test(sql))
 throw Error('Unsafe or unbounded V3 archived metadata SELECT');
async function mainFn(){
 const pool=new Pool({connectionString:raw,max:1,connectionTimeoutMillis:4000,
  query_timeout:6000,statement_timeout:5000,
  options:'-c default_transaction_read_only=on -c statement_timeout=5000'});
 try{
  const c=await pool.connect();let open=false;
  try{
   await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   open=true;
   const res=await c.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(res.rows.length!==1||res.rows[0].db!=='votepredict'
     ||res.rows[0].role!=='postgres'||res.rows[0].ro!=='on')
    throw Error('Not disposable local read-only PostgreSQL');
   const plan=await c.query('EXPLAIN '+sql);
   if(!plan.rows.length)throw Error('SQL schema/plan not confirmed');
   await c.query('ROLLBACK');open=false;
   console.log('CFB_864_FINANCE_ARCHIVE_V3_LOCAL_EXPLAIN_PASSED');
  }finally{
   if(open){try{await c.query('ROLLBACK')}catch{/* close */}}
   c.release(true);
  }
 }finally{await pool.end()}
}
mainFn().catch(()=>{console.error('CFB_864_FINANCE_ARCHIVE_V3_LOCAL_EXPLAIN_FAILED');process.exitCode=1});

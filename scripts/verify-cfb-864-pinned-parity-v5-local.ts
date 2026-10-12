/**
 * EXPLAIN fixed V5 protected original-row join ONLY on disposable local CI PG.
 * No production keys, no row contents, no arbitrary database or SQL.
 */
import {Pool} from 'pg';
import {FIXED_CFB_PARITY_V5_SQL}
 from './audit-cfb-864-authenticated-original-parity-v5.js';

const raw=process.env.DATABASE_URL_UNPOOLED??'';
let uri:URL;
try{uri=new URL(raw)}catch{throw Error('Expected disposable local PostgreSQL')}
const pr=process.env.GITHUB_EVENT_NAME==='pull_request'
 &&/^refs\/pull\/[0-9]+\/merge$/.test(process.env.GITHUB_REF??'');
const mainEvent=(process.env.GITHUB_EVENT_NAME==='push'
 ||(process.env.GITHUB_EVENT_NAME==='issue_comment'
 &&process.env.CFB_864_PARITY_V5_OWNER_COMMENT_VERIFIED==='true'))
 &&process.env.GITHUB_REF==='refs/heads/main';
if(process.argv.length!==2
 ||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
 ||(!pr&&!mainEvent)
 ||uri.hostname!=='localhost'||uri.port!=='5432'
 ||uri.pathname!=='/votepredict'
 ||!['postgres:','postgresql:'].includes(uri.protocol)
 ||raw.includes('neon.tech')||process.env.NEON_API_KEY)
 throw Error('Only approved keyless local postgres:5432 migrations allowed');
const sql=FIXED_CFB_PARITY_V5_SQL;
if(!/^WITH trusted_keys AS /i.test(sql)||sql.includes(';')
 ||/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|COPY|GRANT|REVOKE|CREATE|CALL|DO)\b/i.test(sql)
 ||!/LIMIT 500/.test(sql)||!/LIMIT 64/.test(sql)
 ||!/s.chamber='senate'/.test(sql)
 ||!/s.m->>'availabilityProof'='independent_archive_capture_exact_row'/.test(sql)
 ||!/\$4::text\[\]/.test(sql)
 ||!/count\(DISTINCT/.test(sql))
 throw Error('Unsafe original-to-stored parity SQL contract');
async function main(){
 const pool=new Pool({connectionString:raw,max:1,connectionTimeoutMillis:4000,
  query_timeout:8000,statement_timeout:7000,
  options:'-c default_transaction_read_only=on -c statement_timeout=7000'});
 try{
  const client=await pool.connect();let active=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   active=true;
   const id=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro");
   if(id.rows.length!==1||id.rows[0].db!=='votepredict'
     ||id.rows[0].role!=='postgres'||id.rows[0].ro!=='on')
    throw Error('Local disposable DB identity did not match');
   const plan=await client.query('EXPLAIN '+sql,[
    'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2113865252',
    'A'.repeat(32),'2022-06-06',['a'.repeat(64)],
    'campaign_finance_candidate_contribution_bulk',
   ]);
   if(!plan.rows.length)throw Error('No fixed V5 SQL plan');
   await client.query('ROLLBACK');active=false;
   console.log('CFB_864_PINNED_SOURCE_PARITY_V5_LOCAL_SQL_EXPLAIN_PASSED');
  }finally{
   if(active){try{await client.query('ROLLBACK')}catch{}}
   client.release(true);
  }
 }finally{await pool.end()}
}
main().catch(()=>{console.error('CFB_864_PINNED_SOURCE_PARITY_V5_LOCAL_SQL_EXPLAIN_FAILED');process.exitCode=1});

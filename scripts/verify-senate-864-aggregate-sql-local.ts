/**
 * #864: compile the seven source-coverage SELECT statements using ONLY the
 * disposable CI PostgreSQL with migrations applied. No Neon API, secrets,
 * private evidence, DML, EXPLAIN ANALYZE, migration or report artifact.
 */
import {Pool} from 'pg';
import {GROUPS,QUERIES} from './audit-senate-864-neon-one-key-readonly-coverage.js';
const url=process.env.DATABASE_URL_UNPOOLED??'';
let parsed:URL;
try{parsed=new URL(url);}catch{throw Error('Disposable local CI PostgreSQL URL required')}
if(process.argv.length!==2
 ||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
 ||process.env.GITHUB_EVENT_NAME!=='push'
 ||process.env.GITHUB_REF!=='refs/heads/main'
 ||parsed.hostname!=='localhost'
 ||parsed.port!=='5432'
 ||parsed.pathname!=='/votepredict'
 ||!['postgres:','postgresql:'].includes(parsed.protocol)
 ||url.includes('neon.tech')
 ||process.env.NEON_API_KEY)
 throw Error('Refuse SQL compilation outside exact disposable no-Neon main CI');
const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:4000,
 query_timeout:6000,statement_timeout:5000,
 application_name:'votepredict-864-local-only-sql-plan-validation',
 options:'-c default_transaction_read_only=on -c statement_timeout=5000'});
try{
 const c=await pool.connect();
 let open=false;
 try{
  await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  open=true;
  const id=await c.query(
   "SELECT current_database() AS db,inet_server_addr() AS host,current_setting('transaction_read_only') AS ro",
  );
  if(id.rows.length!==1 ||id.rows[0].db!=='votepredict'||id.rows[0].ro!=='on'
    ||typeof id.rows[0].host!=='string'
    ||!['127.0.0.1','::1'].includes(id.rows[0].host))
   throw Error('Not isolated disposable local PostgreSQL');
  for(const group of GROUPS){
   const sql=QUERIES[group];
   if(!/^SELECT\s/i.test(sql)||sql.includes(';')
    ||/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|COPY|GRANT|REVOKE|CREATE)\b/i.test(sql))
    throw Error('Non-SELECT statement not permitted');
   // EXPLAIN without ANALYZE checks table/column/schema/SQL type references,
   // but never runs the query or reads actual source rows.
   const plan=await c.query('EXPLAIN '+sql);
   if(!plan.rows.length)throw Error('No SQL query plan produced');
  }
  await c.query('ROLLBACK');open=false;
  console.log('VOTEPREDICT_864_SEVEN_SOURCE_QUERIES_COMPILE_ON_DISPOSABLE_PG='+GROUPS.length);
 }finally{
  if(open)try{await c.query('ROLLBACK')}catch{/* always destroy client */}
  c.release(true);
 }
}finally{await pool.end()}

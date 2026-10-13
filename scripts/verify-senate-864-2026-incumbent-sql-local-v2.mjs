/**
 * Compile ONLY the three bounded 2026 URL/source/member SELECTs on disposable
 * localhost PostgreSQL after migrations. EXPLAIN without ANALYZE; never Neon.
 */
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {MEMBERSHIPS_SQL,sourceVariants,REQUIRED,CATALOG_SQL,IDENTITY_SQL}
 from './audit-senate-864-2026-49-incumbent-existing-neon-parity.mjs';
import {SOURCE_SQL_V2,MEMBER_CAMPAIGN_COUNTS_SQL}
 from './audit-senate-864-2026-49-incumbent-existing-neon-parity-v2.mjs';
export async function runLocalExplain(
 input=process.env,
 factory=options=>new Pool(options),
){
 const raw=input.DATABASE_URL_UNPOOLED;
 if(!raw ||input.NEON_API_KEY || input.VOTEPREDICT_NEON_PROJECT_ID)
  throw Error('Disposable localhost migration verification only; no managed Neon keys');
 const u=new URL(raw);
 if(!['postgres:','postgresql:'].includes(u.protocol)
  || !['localhost','127.0.0.1'].includes(u.hostname)
  || u.pathname!=='/votepredict'
  ||decodeURIComponent(u.username)!=='postgres'
  ||u.search||u.hash)
  throw Error('Only disposable localhost PostgreSQL database and role allowed');
 const pool=factory({connectionString:raw,max:1,connectionTimeoutMillis:5000,
  options:'-c default_transaction_read_only=on -c statement_timeout=10000'});
 try{
  const client=await pool.connect();
  let tx=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   tx=true;
   const identity=await client.query(IDENTITY_SQL);
   if(identity.rows.length!==1 ||identity.rows[0].db!=='votepredict'
     ||identity.rows[0].role!=='postgres'||identity.rows[0].ro!=='on')
     throw Error('Disposable Postgres identity fail');
   const relations=await client.query(CATALOG_SQL,[REQUIRED]);
   if(relations.rows.length!==REQUIRED.length
    ||relations.rows.some(r=>!r.present||!r.readable))
    throw Error('Missing disposable migrated evidence table');
   const ids=['1','2','3','57'];
   const variants=sourceVariants();
   for(const [sql,param]of [[MEMBERSHIPS_SQL,ids],[SOURCE_SQL_V2,variants],[MEMBER_CAMPAIGN_COUNTS_SQL,ids]]){
    const plan=await client.query('EXPLAIN '+sql,[param]);
    if(!Array.isArray(plan.rows)||plan.rows.length<1)throw Error('No disposable SQL plan');
   }
   await client.query('ROLLBACK');
   tx=false;
   return {compiledBoundedSelects:3,disposableLocalOnly:true,readOnly:true,explicitRollback:true};
  }finally{if(tx){try{await client.query('ROLLBACK')}catch{}}client.release(true);}
 }finally{await pool.end()}
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/verify-senate-864-2026-incumbent-sql-local-v2.mjs')){
 runLocalExplain().then(r=>{console.log('SAFE_DISPOSABLE_POSTGRES_EXPLAIN_ONLY='+JSON.stringify(r))})
  .catch(()=>{console.error('SAFE_DISPOSABLE_POSTGRES_QUERY_PLAN_HOLD');process.exitCode=1});
}

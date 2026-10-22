/** Compile fixed aggregate SQL against disposable, locally migrated PostgreSQL only. */
import { Pool } from 'pg';
import { EXPOSURE_SQL } from '../src/evidence/cfb-864-finance-asof-exposure.mjs';

async function main(){
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
 if(!url)throw Error('Only disposable local PostgreSQL may compile #864 finance audit');
 const parsed=new URL(url);
 if(!['127.0.0.1','localhost'].includes(parsed.hostname)
  ||parsed.pathname!=='/votepredict'
  ||!['push','pull_request'].includes(process.env.GITHUB_EVENT_NAME??''))
  throw Error('Protected Neon / remote SQL compilation forbidden');
 const db=new Pool({connectionString:url,max:1,connectionTimeoutMillis:4000,statement_timeout:18000,
  options:'-c default_transaction_read_only=on'});
 let client,opened=false;
 try{
  client=await db.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');opened=true;
  const result=await client.query('EXPLAIN (FORMAT JSON) '+EXPOSURE_SQL);
  if(result.rows.length!==1)throw Error('Finance exposure SQL EXPLAIN did not compile');
  await client.query('ROLLBACK');opened=false;
  console.log('SENATE864_FINANCE_EXPOSURE_LOCAL_COMPILE_SUCCESS');
 }finally{
  if(opened&&client)await client.query('ROLLBACK').catch(()=>{});
  if(client)client.release(true);
  await db.end();
 }
}
main().catch(()=>{console.error('SENATE864_FINANCE_EXPOSURE_LOCAL_SQL_HELD');process.exitCode=1});

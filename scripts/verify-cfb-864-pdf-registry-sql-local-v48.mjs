/** #864 V48: SQL execution on disposable localhost PostgreSQL ONLY. */
import {Pool} from 'pg';
import {registry830,INSERT_SQL,VERIFY_SQL,REVALIDATE_SQL,safeRevalidation}
 from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
function localConnection(){
 const value=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
 if(!value)throw Error('Disposable PostgreSQL missing');
 const url=new URL(value);
 if(!['127.0.0.1','localhost'].includes(url.hostname)
  ||url.pathname!=='/votepredict'
  ||!['postgresql:','postgres:'].includes(url.protocol)
  ||!['pull_request','push'].includes(process.env.GITHUB_EVENT_NAME??''))
  throw Error('CFB V48 local verification must never contact protected Neon');
 return value;
}
async function main(){
 const records=registry830(),pool=new Pool({
  connectionString:localConnection(),max:1,connectionTimeoutMillis:5000
 });
 let open=false;
 try{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   open=true;
   await client.query(INSERT_SQL,[JSON.stringify(records)]);
   const check=(await client.query(VERIFY_SQL,[JSON.stringify(records)])).rows[0];
   if(check?.stored!=='830'||check.exact!=='830'||check.missing!=='0'
     ||check.distinct_bodies!=='813')throw Error('Local registry failed exact verification');
   safeRevalidation((await client.query(REVALIDATE_SQL)).rows);
   await client.query('ROLLBACK');open=false;
   console.log('CFB_864_V48_DISPOSABLE_POSTGRES_REGISTRY_AND_SQL_SUCCESS');
  }finally{
   if(open)try{await client.query('ROLLBACK')}catch{}
   client.release(true);
  }
 }finally{await pool.end()}
}
main().catch(()=>{
 console.error('CFB_864_V48_LOCAL_POSTGRES_VERIFICATION_FAILED');
 process.exitCode=1
});

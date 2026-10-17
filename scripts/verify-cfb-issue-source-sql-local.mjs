/**
 * Synthetic disposable local-Postgres migration rehearsal only.
 * It must never use production Neon, CFB original source bodies, or donors.
 * All inserted test fixtures are rolled back.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
if(!url||!/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/votepredict$/.test(url))
 throw Error('Approved disposable local PostgreSQL only');
const pool=new Pool({connectionString:url,max:1});
const client=await pool.connect();
let opened=false;
try{
 await client.query('BEGIN');opened=true;
 const raw=Buffer.from('<!doctype html><html><body>'+
  'Synthetic, non-political, public-source HTML audit fixture. '.repeat(4)+
  '</body></html>');
 const sha=createHash('sha256').update(raw).digest('hex');
 const params=[
  'synthetic-source-ledger','Minnesota Chamber of Commerce',
  'first_party_pac_affiliation',
  'https://www.mnchamber.com/your-voice/elections',
  'https://www.mnchamber.com/your-voice/elections',
  sha,'text/html',raw,'2026-10-17T02:00:00Z',
  'unverified_raw_observation',false,false,0
 ];
 const sql=[
  'INSERT INTO cfb_issue_finance_source_observations',
  '(source_id,organization_group,source_role,source_url,final_url,',
  'html_sha256,content_type,raw_html_bytes,observed_at,claim_status,',
  'historical_asof_eligible,mechanically_actionable,model_weight)',
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
  'ON CONFLICT (source_id,html_sha256) DO NOTHING'
 ].join(' ');
 assert.equal((await client.query(sql,params)).rowCount,1);
 assert.equal((await client.query(sql,params)).rowCount,0);
 const record=(await client.query([
  'SELECT historical_asof_eligible,mechanically_actionable,model_weight,',
  'raw_html_bytes,html_sha256,source_role',
  'FROM cfb_issue_finance_source_observations WHERE source_id=$1'
 ].join(' '),['synthetic-source-ledger'])).rows[0];
 assert.equal(record.historical_asof_eligible,false);
 assert.equal(record.mechanically_actionable,false);
 assert.equal(Number(record.model_weight),0);
 assert.equal(Buffer.compare(record.raw_html_bytes,raw),0);
 assert.equal(record.html_sha256,sha);
 for(const query of [
  "UPDATE cfb_issue_finance_source_observations SET historical_asof_eligible=true WHERE source_id='synthetic-source-ledger'",
  "UPDATE cfb_issue_finance_source_observations SET mechanically_actionable=true WHERE source_id='synthetic-source-ledger'",
  "UPDATE cfb_issue_finance_source_observations SET model_weight=1 WHERE source_id='synthetic-source-ledger'"
 ]){
  await client.query('SAVEPOINT expected_violation');
  await assert.rejects(()=>client.query(query),/check constraint|violates/i);
  await client.query('ROLLBACK TO SAVEPOINT expected_violation');
  await client.query('RELEASE SAVEPOINT expected_violation');
 }
 await client.query('ROLLBACK');opened=false;
 console.log('CFB_ISSUE_SOURCE_LOCAL_SQL_SAFE '+
  JSON.stringify({syntheticRollback:true,duplicateRejected:true,
   byteHashVerified:true,immutableSafetyLabelsVerified:true}));
}finally{
 if(opened)await client.query('ROLLBACK').catch(()=>{});
 client.release(true);await pool.end();
}

/** Unprivileged 95-Senator audit SQL plan compiler. ONLY disposable localhost PG.
 * EXPLAIN without ANALYZE; no protected Neon key or source content.
 */
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {readPublicInputs,ROSTER_SQL,CAMPAIGN_SQL,PRIMARY_SQL,CATALOG_SQL,SOURCE_CLASS_SQL,GLOBAL_SOURCE_CLASS_SQL}
 from './audit-senate-864-95-historical-source-neon-readonly.mjs';
const raw=process.env.DATABASE_URL_UNPOOLED||'';
const u=new URL(raw);
assert.equal(u.protocol,'postgresql:');
assert.equal(u.hostname,'localhost');
assert.equal(u.port,'5432');
assert.equal(u.pathname,'/votepredict');
assert.equal(process.env.NEON_API_KEY,undefined);
assert.equal(process.env.VOTEPREDICT_NEON_PROJECT_ID,undefined);
const {manifest,research}=readPublicInputs();
assert.equal(manifest.people.length,95);
assert.equal(research.ledgersRead,29);
const db=new Pool({connectionString:raw, max:1,connectionTimeoutMillis:5000});
try{
 const sqls=[ROSTER_SQL,CAMPAIGN_SQL,PRIMARY_SQL,CATALOG_SQL,SOURCE_CLASS_SQL,GLOBAL_SOURCE_CLASS_SQL];
 for(const sql of sqls){
  assert.match(sql,/^\s*SELECT /);
  assert.doesNotMatch(sql,/\b(?:insert|update|delete|alter|create|drop|grant|truncate)\b/i);
  const query='EXPLAIN '+sql;
  const vals=sql===CATALOG_SQL?[['legislators','memberships']]:sql===GLOBAL_SOURCE_CLASS_SQL?[['https://test.example/']]:[];
  const res=await db.query(query,vals);
  assert.ok(res.rows.length>=1);
 }
 console.log('SENATE_864_95_LOCAL_ONLY_SQL_EXPLAIN_PASS: 6 SELECT statements, authentic 95/29 public manifests');
}finally{await db.end();}

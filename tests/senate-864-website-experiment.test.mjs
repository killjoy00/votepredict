import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readExperiment,LABELS_SQL} from '../scripts/evaluate-senate-864-website-v2.mjs';
import {expansionInputs,sha,PROTOCOL_V2} from '../src/evidence/senate-864-website-expansion.mjs';
import {ROSTER_SQL} from '../scripts/audit-senate-864-95-historical-source-neon-readonly.mjs';
import {candidateSiteDrafts,websiteEvidenceDraft} from '../src/evidence/senate-864-website-signal-neon.mjs';
import {WEBSITE_NEON_RECEIPT_SQL} from '../src/evidence/senate-864-website-signal-readback.mjs';
import {COHORT_TARGETS_V2_SQL} from '../src/evidence/senate-864-website-cohort-v2.mjs';
const inputs=expansionInputs(),uuid=n=>'11111111-2222-4333-8444-'+String(n).padStart(12,'0');
const roster=inputs.manifest.people.map((p,i)=>({name:p.officialName,legislatorId:uuid(i+1),membershipId:uuid(i+101),sessionSlug:'2021-2022'}));
const plan=candidateSiteDrafts(inputs.manifest,roster,inputs.current);
const stored=plan.map(p=>{const d=websiteEvidenceDraft(p);return {membershipId:p.membershipId,excerpt:p.literal,publishedAt:p.observedAt,kind:'context',stance:'neutral',metadata:{...d.drafts[0].metadata,durableIngestion:true,ingestionKey:'synthetic'},sourceUrl:p.sourceUrl,sourceSha:p.sourceSha,sourceMetadata:d.source.metadata};});
test('changed outcome-free commitment holds before label query, rollback also runs on source failure',async()=>{
 const calls=[];
 const c={query:async(sql,params=[])=>{
  calls.push(sql);const pos=[...sql.matchAll(/\$(\d+)/g)].map(m=>+m[1]);assert.equal(params.length,pos.length?Math.max(...pos):0);
  if(sql.includes("current_setting('transaction_read_only')"))return {rows:[{db:'synthetic',role:'synthetic',ro:'on',isolation:'repeatable read'}]};
  if(sql===ROSTER_SQL)return {rows:roster};if(sql===WEBSITE_NEON_RECEIPT_SQL)return {rows:stored};if(sql===COHORT_TARGETS_V2_SQL)return {rows:[]};
  if(sql===LABELS_SQL)throw Error('Must not read labels');return {rows:[]};
 }};
 const frozen={cohort:{cohortSha256:'different'},protocolSha256:sha(readFileSync(PROTOCOL_V2)),sourcePlanSha256:inputs.sourcePlanSha256};
 await assert.rejects(readExperiment(c,{database:'synthetic',role:'synthetic'},frozen),/Frozen pre-outcome/);
 assert.equal(calls.includes(LABELS_SQL),false);assert.equal(calls.at(-1),'ROLLBACK');
 const bad={query:async(sql,p)=>sql===WEBSITE_NEON_RECEIPT_SQL?{rows:stored.slice(1)}:c.query(sql,p)};
 await assert.rejects(readExperiment(bad,{database:'synthetic',role:'synthetic'},frozen),/Not all/);
 assert.equal(calls.at(-1),'ROLLBACK');
});
test('actual PostgreSQL outcome join is bounded, parameterized and read-only',{skip:!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL},async()=>{
 const {Pool}=await import('pg'),pool=new Pool({connectionString:process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,max:1}),c=await pool.connect();
 try{await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');try{assert.equal((await c.query(LABELS_SQL,['[]'])).rows.length,0);}finally{await c.query('ROLLBACK')}}finally{c.release();await pool.end()}
});
test('pre-outcome receipt commits the exact merged protocol and source plan before execution',()=>{
 const r=JSON.parse(readFileSync('docs/evaluation/source-proof/senate-864-website-cohort-v2-pre-outcome.json'));
 assert.equal(r.noOutcomesRead,true);assert.equal(r.verifiedExcerpts,668);assert.equal(r.addedVerified,52);
 assert.equal(r.protocolSha256,sha(readFileSync(PROTOCOL_V2)));assert.equal(r.sourcePlanSha256,inputs.sourcePlanSha256);
 assert.equal(r.cohort.included,12134);assert.equal(r.cohort.distinctBills,370);
});

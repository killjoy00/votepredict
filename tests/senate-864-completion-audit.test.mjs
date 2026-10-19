import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import {auditWebsiteReadback,mediaAccounting,safeGroupedCounts,COMPLETION_WEBSITE_SQL,COHORT_COUNTS_SQL,
 MEDIA_CONTEXT_SQL,FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,COMMITTEE_YEAR_SQL,DIRECT_STATEMENT_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
import {websiteEvidenceDraft} from '../src/evidence/senate-864-website-signal-neon.mjs';
const id='11111111-2222-4333-8444-555555555555',person='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
function fixtures(){
 const plan=Array.from({length:616},(_,i)=>({key:String(i).padStart(64,'0'),membershipId:id,sourceSha:'a'.repeat(64),
  sourceUrl:'https://web.archive.org/web/20220101000000id_/https://synthetic.test/',observedAt:'2022-01-01T00:00:00.000Z',
  literal:i<2?'Same exact synthetic website words.':'Synthetic literal excerpt number '+i,originalUrl:'https://synthetic.test/',cdx:'A'.repeat(32)}));
 const rows=plan.map(p=>{const {source,drafts}=websiteEvidenceDraft(p);return {membershipId:id,legislatorId:person,excerpt:p.literal,
  publishedAt:p.observedAt,kind:'context',stance:'neutral',metadata:{...drafts[0].metadata,durableIngestion:true,ingestionKey:'synthetic'},
  sourceUrl:p.sourceUrl,sourceSha:p.sourceSha,sourceMetadata:source.metadata};});
 return {plan,rows,people:new Map([[id,person]])};
}
test('fresh website audit separates complete literal evidence, feature duplicates, missing and invalid rows',()=>{
 const {plan,rows,people}=fixtures();
 const good=auditWebsiteReadback(rows,plan,people);
 assert.equal(good.summary.matched,616);assert.equal(good.summary.literalFeatureDuplicateCopies,1);
 assert.equal(good.summary.distinctPeople,1);
 assert.equal(auditWebsiteReadback(rows.slice(1),plan,people).summary.missing,1);
 const duplicate=auditWebsiteReadback([...rows,rows[0]],plan,people);
 assert.equal(duplicate.summary.duplicateKeys,1);assert.equal(duplicate.summary.matched,615);
 rows[0].sourceMetadata={...rows[0].sourceMetadata,originalCdxSha1Base32:'B'.repeat(32)};
 assert.equal(auditWebsiteReadback(rows,plan,people).summary.mismatched,1);
 rows[1].metadata.modelWeight=1;rows[2].legislatorId='different-person';
 const bad=auditWebsiteReadback(rows,plan,people);assert.equal(bad.summary.mismatched,3);
 assert.ok(!JSON.stringify(bad.summary).includes(person));
});
test('media source accounting never converts contextual name mentions into quotations',()=>{
 const people=Array.from({length:95},(_,i)=>({officialName:'Synthetic Person'+String.fromCharCode(65+Math.floor(i/26),65+i%26)}));
 const seeds=Array.from({length:44},(_,i)=>({id:'seed-'+i,publisher:'Synthetic'+i}));
 const m={archiveCapturedAt:'2022-01-01T00:00:00Z',seedId:'seed-0',contextOnly:true,mechanicallyActionable:false,modelWeight:0,sameDayEligible:false,mentionedMembers:['Synthetic PersonAA']};
 const row={sourceId:'private-source',kind:'context',stance:'neutral',metadata:m};
 const r=mediaAccounting([row,{...row,metadata:{...m,archiveCapturedAt:'2026-01-01T00:00:00Z'}}],{people},seeds);
 assert.equal(r.outsideStudyCaptureYear,1);assert.equal(r.years[0].contexts,1);
 assert.equal(r.namedAttributableStatementsCertifiedByThisContextAudit,0);
 assert.equal(r.nonzeroSenatorYearSourceCells[0].personOrdinal,1);
 assert.ok(!JSON.stringify(r).includes('private-source'));
 assert.equal(mediaAccounting([{...row,metadata:{...m,archiveCapturedAt:'2022-01-01T00:00:00'}}],{people},seeds).invalidArchiveClock,1);
});
test('aggregate serializer rejects private keys, unexpected scope and invalid count',()=>{
 assert.throws(()=>safeGroupedCounts([{year:2021,count:1,person:'secret'}],['year'],['count']));
 assert.throws(()=>safeGroupedCounts([{year:2026,count:1}],['year'],['count'],{allowed:{year:[2021]}}));
 assert.throws(()=>safeGroupedCounts([{year:2021,count:-1}],['year'],['count']));
});
test('protocol is explicit before outcomes, preserving clocks, holdouts and non-serving scope',()=>{
 const p=JSON.parse(readFileSync('docs/evaluation/senate-864-website-experiment-protocol-v1.json'));
 assert.equal(p.frozenBeforeOutcomeTesting,true);assert.deepEqual(p.split.untouchedChronologicalTest,[2024,2025]);
 assert.equal(p.clock.sameDayExcluded,true);assert.match(p.clock.targetCutoff,/America\/Chicago/);
 assert.match(p.executionPolicy,/No outcome testing/);
 assert.ok(!COHORT_COUNTS_SQL.includes(' AS outcome'));
 assert.match(COHORT_COUNTS_SQL,/observed_at < .*America\/Chicago/s);
});
test('all new SELECT plans compile on the disposable migrated schema',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url){t.skip('Disposable Postgres required');return;}
 const pool=new Pool({connectionString:url,max:1}),db=await pool.connect();
 try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  for(const sql of [COMPLETION_WEBSITE_SQL,COHORT_COUNTS_SQL,MEDIA_CONTEXT_SQL,FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,COMMITTEE_YEAR_SQL,DIRECT_STATEMENT_SQL]){
   assert.match(sql,/^(SELECT|WITH) /);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/);
   const params=sql===COMPLETION_WEBSITE_SQL?[[]]:sql===COHORT_COUNTS_SQL?['[]']:[];
   await db.query('EXPLAIN '+sql,params);
  }
 }finally{await db.query('ROLLBACK');db.release();await pool.end();}
});

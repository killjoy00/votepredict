import {educationStoredAnchors,EDUCATION_DOC_SQL,EDUCATION_EVENT_SQL} from '../src/evidence/senate-864-completion-audit.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import {auditWebsiteReadback,mediaAccounting,safeGroupedCounts,COMPLETION_WEBSITE_SQL,COHORT_COUNTS_SQL,
 MEDIA_CONTEXT_SQL,FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,COMMITTEE_YEAR_SQL,DIRECT_STATEMENT_SQL,CURRENT_VERIFIED_MEMBER_SQL,safeCohortCounts} from '../src/evidence/senate-864-completion-audit.mjs';
import {VERIFY_SQL,REVALIDATE_SQL} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {registry830} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
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
  for(const sql of [COMPLETION_WEBSITE_SQL,COHORT_COUNTS_SQL,MEDIA_CONTEXT_SQL,FINANCE_CANONICAL_SQL,FINANCE_REGISTRY_SQL,COMMITTEE_YEAR_SQL,DIRECT_STATEMENT_SQL,CURRENT_VERIFIED_MEMBER_SQL,VERIFY_SQL,REVALIDATE_SQL,EDUCATION_DOC_SQL,EDUCATION_EVENT_SQL]){
   assert.match(sql,/^(SELECT|WITH) /);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/);
   const params=sql===COMPLETION_WEBSITE_SQL?[[]]:sql===COHORT_COUNTS_SQL?['[]']:sql===CURRENT_VERIFIED_MEMBER_SQL?[[]]:sql===VERIFY_SQL?[JSON.stringify(registry830())]:[];
   await db.query('EXPLAIN '+sql,params);
  }
 }finally{await db.query('ROLLBACK');db.release();await pool.end();}
});

test('Senate member query safely handles nonnumeric House district data regardless of join order',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url){t.skip('Disposable Postgres required');return;}
 const pool=new Pool({connectionString:url,max:1}),db=await pool.connect();
 try{await db.query('BEGIN');
  await db.query(`CREATE TEMP TABLE memberships(id text,district text,legislator_id int,session_id int,chamber_id int) ON COMMIT DROP`);
  await db.query(`CREATE TEMP TABLE legislators(id int,name text) ON COMMIT DROP`);
  await db.query(`CREATE TEMP TABLE legislative_sessions(id int,slug text) ON COMMIT DROP`);
  await db.query(`CREATE TEMP TABLE chambers(id int,slug text) ON COMMIT DROP`);
  await db.query("INSERT INTO legislators VALUES(1,'Synthetic Senate Person'),(2,'Synthetic House Person')");
  await db.query("INSERT INTO legislative_sessions VALUES(1,'2025-2026')");
  await db.query("INSERT INTO chambers VALUES(1,'senate'),(2,'house')");
  await db.query("INSERT INTO memberships VALUES('senate-1','1',1,1,1),('house-1A','1A',2,1,2)");
  const r=await db.query(CURRENT_VERIFIED_MEMBER_SQL,[[1]]);
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].district,1);
  assert.match(CURRENT_VERIFIED_MEMBER_SQL,/CASE WHEN m.district/);
 }finally{await db.query('ROLLBACK');db.release();await pool.end();}
});

test('prepared target cohort has an aggregate fingerprint and cannot silently drift by count alone',()=>{
 const row={year:2024,target_member_bills:20,unknown_service_targets:0,qualified_member_bills:10,qualified_bills:5,qualified_people:2,cohort_sha256:'a'.repeat(64)};
 assert.equal(safeCohortCounts([row])[0].cohort_sha256,'a'.repeat(64));
 assert.throws(()=>safeCohortCounts([{...row,cohort_sha256:'private-row-id'}]),/fingerprint/);
 assert.match(COHORT_COUNTS_SQL,/sha256/);assert.match(COHORT_COUNTS_SQL,/ORDER BY membership_id,bill_id,event_id/);
});

test('finance copy reconciliation uses the IE spender identity and never borrows a candidate report',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url){t.skip('Disposable Postgres required');return;}
 const pool=new Pool({connectionString:url,max:1}),db=await pool.connect();
 try{await db.query('BEGIN');
  await db.query('CREATE TEMP TABLE source_documents(id int,source_kind text) ON COMMIT DROP');
  await db.query('CREATE TEMP TABLE evidence_items(source_document_id int,membership_id int,metadata jsonb) ON COMMIT DROP');
  await db.query('CREATE TEMP TABLE memberships(id int,chamber_id int) ON COMMIT DROP');
  await db.query('CREATE TEMP TABLE chambers(id int,slug text) ON COMMIT DROP');
  await db.query('CREATE TEMP TABLE cfb_official_senate_pdf_versions(committee_registration text,report_year int) ON COMMIT DROP');
  await db.query("INSERT INTO chambers VALUES(1,'senate')");await db.query('INSERT INTO memberships VALUES(1,1)');
  await db.query("INSERT INTO source_documents VALUES(1,'campaign_finance_candidate_contribution_bulk'),(2,'campaign_finance_independent_expenditure_bulk')");
  await db.query("INSERT INTO cfb_official_senate_pdf_versions VALUES('11111',2022)");
  const candidate={year:2022,subtype:'candidate_contribution_record',filerRegistrationNumber:'11111',rowKey:'a'.repeat(64),contributorType:'PAC'};
  const ie={year:2022,subtype:'independent_expenditure_record',spenderRegistrationNumber:'99999',affectedCommitteeRegistrationNumber:'11111',rowKey:'b'.repeat(64)};
  for(let i=0;i<2;i++)await db.query('INSERT INTO evidence_items VALUES(1,1,$1::jsonb)',[JSON.stringify(candidate)]);
  for(let i=0;i<3;i++)await db.query('INSERT INTO evidence_items VALUES(2,1,$1::jsonb)',[JSON.stringify(ie)]);
  const r=(await db.query(FINANCE_CANONICAL_SQL)).rows;
  const c=r.find(x=>x.family==='candidate_contribution'),s=r.find(x=>x.family==='independent_expenditure');
  assert.equal(c.evidence_copies,2);assert.equal(c.canonical_transactions,1);assert.equal(c.canonical_in_indexed_committee_years,1);
  assert.equal(s.evidence_copies,3);assert.equal(s.canonical_transactions,1);assert.equal(s.copies_missing_canonical_identity,0);
  assert.equal(s.copies_in_indexed_registrations,0);assert.equal(c.copies_in_indexed_registrations,2);
  await db.query('INSERT INTO evidence_items VALUES(1,1,$1::jsonb)',[JSON.stringify({...candidate,year:2023})]);
  const otherYear=(await db.query(FINANCE_CANONICAL_SQL)).rows.find(x=>x.year==='2023');
  assert.equal(otherYear.copies_in_indexed_registrations,1);assert.equal(otherYear.copies_in_indexed_committee_years,0);
  assert.equal(s.copies_in_indexed_committee_years,0);assert.equal(s.canonical_in_indexed_committee_years,0);
 }finally{await db.query('ROLLBACK');db.release();await pool.end();}
});

test('Education six repeated slates require distinct printed question anchors; no ordinal or tally shortcut',()=>{
 const docs=[{id:'synthetic',content_sha256:'6d00d812236d4585ea315da9fdf2da8325fcad512e4089e1422fa4a96e2a7f52'}];
 const e={source_document_id:'synthetic',motion_text:'adopt amendment 10',yea_count:4,nay_count:6,passed:false,choices:10};
 assert.equal(educationStoredAnchors(docs,[e]).uniquelyLabelledStoredAmendments,1);
 assert.equal(educationStoredAnchors(docs,[e,e]).ambiguousRepeatedStoredLabels,1);
 assert.equal(educationStoredAnchors(docs,[{...e,motion_text:'MOTION FAILED'}]).unanchoredStoredCandidateEvents,1);
 assert.equal(educationStoredAnchors([], [e]).uniquelyLabelledStoredAmendments,0);
 assert.equal(educationStoredAnchors(docs,[e]).individualChoiceIdentityParityCertified,false);
});

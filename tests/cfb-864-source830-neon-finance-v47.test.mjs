import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {source830,SCHEMA,QUERIES,FINANCE_FAMILIES,safeCounts}
 from '../src/evidence/cfb-864-finance-db-reconciliation-v47.mjs';
import {assertProtectedReadOnlyScope,auditExistingNeonCfbFinance,MARKER}
 from '../scripts/audit-cfb-864-neon-source830-eligibility-v47.mjs';

test('830 exact version IDs include PDF SHA, viewer URL, and non-earlier-than legal floor',()=>{
 const originals=source830();
 assert.equal(originals.length,830);
 assert.equal(new Set(originals.map(x=>x.id)).size,830);
 assert.equal(new Set(originals.map(x=>x.sha)).size,813);
 assert.ok(originals.every(x=>x.estimated_on>=x.release_floor));
 const a=originals.find(x=>x.id==='16311:22:pcc:YE:0:0');
 assert.equal(a?.release_floor,'2023-02-01');
 assert.equal(a?.estimated_on,'2023-02-01');
 const b=originals.find(x=>x.id==='18430:21:pcc:YE:0:1');
 assert.equal(b?.estimated_on,'2026-10-11');
 assert.equal(b?.method,'first_observed_official_site_copy');
 const meta=JSON.parse(readFileSync('data/cfb-2021-25-nine-five-review-dispositions-v45.json','utf8'));
 assert.equal(meta.handwrittenReportVersionsStillUnresolved,2);
});
test('SQL query family segregation, strict exact PDF equality and no DB mutation',()=>{
 assert.deepEqual(Object.keys(QUERIES),[
  'inventory','committee_years','finance_families','historical_eligibility'
 ]);
 assert.deepEqual(FINANCE_FAMILIES,[
  'candidate_contribution','candidate_expenditure','independent_expenditure','category_mismatch'
 ]);
 for(const [name,sql] of Object.entries(QUERIES)){
  assert.match(sql,/^\s*(?:WITH|SELECT)\b/i);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|COPY|CREATE|DO|GRANT|REVOKE)\b/i);
  assert.doesNotMatch(sql,/\b(?:amount|vendor|donor|contributor|payee)\s+(?:AS|FROM)\b/i);
  assert.ok(sql.length>220,name);
 }
 assert.match(QUERIES.inventory,/sd\.source_url=e\.url OR sd\.content_sha256=e\.sha/);
 assert.match(QUERIES.committee_years,/SELECT DISTINCT reg,year/);
 assert.match(QUERIES.finance_families,/candidate_contribution/);
 assert.match(QUERIES.finance_families,/candidate_expenditure/);
 assert.match(QUERIES.finance_families,/independent_expenditure/);
 assert.match(QUERIES.historical_eligibility,/x\.id=t\.report_id/);
 assert.match(QUERIES.historical_eligibility,/x\.reg=t\.m->>'filerRegistrationNumber'/);
 assert.match(QUERIES.historical_eligibility,/published_before_legal_floor/);
 assert.match(QUERIES.historical_eligibility,/metadata_before_estimate/);
});
test('reject unexpected private data, invalid counters and cross-family grouping',()=>{
 const good={year:'2022',family:'candidate_contribution',scope:'senate_member',
  copies:'11',distinct_row_keys:'8',missing_row_keys:'1',candidate_registrations:'2',
  eligible_copies:'5',eligible_dated:'2'};
 assert.deepEqual(safeCounts('finance_families',[good]),[good]);
 assert.throws(()=>safeCounts('finance_families',[{...good,donor:'Bob'}]));
 assert.throws(()=>safeCounts('finance_families',[{...good,copies:'9999999999999'}]));
 assert.throws(()=>safeCounts('finance_families',[{...good,family:'all_finances'}]));
 assert.throws(()=>safeCounts('finance_families',[{...good,distinct_row_keys:'18'}]));
 assert.throws(()=>safeCounts('finance_families',[good,good]));
 const eligibility={year:'2021',family:'candidate_expenditure',scope:'senate_member',
 eligible_copies:'9',exact_version_matched:'2',no_exact_version_match:'7',
 no_report_id:'5',legacy_or_unversioned:'6',filing_derived_claims:'2',
 archived_bulk_claims:'3',eligible_undated:'1',eligible_no_due_date:'5',
 published_before_legal_floor:'0',published_before_estimate:'0',
 metadata_before_legal_floor:'0',metadata_before_estimate:'0'};
 assert.equal(safeCounts('historical_eligibility',[eligibility]).length,1);
 assert.throws(()=>safeCounts('historical_eligibility',[{...eligibility,exact_version_matched:'8'}]));
});
test('refuse untrusted PR/replay/ref or missing CI consent for protected Neon',()=>{
 const env={GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),VOTEPREDICT_864_CFB_V47_VERIFIED:'true',
  VOTEPREDICT_864_CFB_V47_MARKER:'true'};
 assert.match(MARKER,/CFB_FINANCE_830_NEON_READONLY/);
 assert.doesNotThrow(()=>assertProtectedReadOnlyScope(env));
 for(const change of [{GITHUB_REF:'refs/pull/12/merge'},{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_RUN_ATTEMPT:'2'},{VOTEPREDICT_864_CFB_V47_VERIFIED:'false'},
  {VOTEPREDICT_864_CFB_V47_MARKER:'false'},
  {GITHUB_REPOSITORY:'someone/else'}])
  assert.throws(()=>assertProtectedReadOnlyScope({...env,...change}));
});
test('simulate four SQL census statements inside READ ONLY with ROLLBACK and no mutation',async()=>{
 const expected={
  inventory:[{year:'2021',indexed_versions:'121',matched_pdf_url:'0',
   matched_full_pdf_sha:'0',matched_both:'0',no_pdf_match:'121',matched_url_wrong_sha:'0'}],
  committee_years:[{year:'2021',indexed_committee_years:'97',
   candidate_years_with_stored_bulk:'0',candidate_years_with_contributions:'0',
   candidate_years_with_expenditures:'0',candidate_years_without_stored_bulk:'97'}],
  finance_families:[],
  historical_eligibility:[]
 };
 const seen=[];let released=false,closed=false;
 const fakeClient={
  async query(sql,params){
   seen.push(sql);
   if(sql.startsWith('BEGIN TRANSACTION'))return {rows:[]};
   if(sql.startsWith('SELECT current_database'))return {rows:[{db:'votepredict',role:'owner',ro:'on'}]};
   if(sql==='ROLLBACK')return {rows:[]};
   const key=Object.keys(QUERIES).find(name=>QUERIES[name]===sql);
   assert.ok(key,'Only four fixed queries may enter the database');
   assert.equal(JSON.parse(params?.[0]??'null').length,830);
   return {rows:expected[key]};
  },
  release(force){released=force===true;}
 };
 const out=await auditExistingNeonCfbFinance({apiKey:'secret-never-log',projectId:'votepredict-test'},{
  discover:async()=>({host:'test.neon.tech',port:5432,role:'owner',password:'secret-never-log',database:'votepredict'}),
  connect:()=>({connect:async()=>fakeClient,end:async()=>{closed=true;}})
 });
 assert.equal(out.schema,SCHEMA);
 assert.equal(out.sourceIndexedPdfVersions,830);
 assert.equal(out.sourceOriginalPdfBodies,813);
 assert.equal(out.readOnlyRepeatableReadVerified,true);
 assert.equal(out.rollbackCompleted,true);
 assert.equal(out.actualOfficialStatutoryOwedDenominatorEstablished,false);
 assert.equal(out.pastEligibilityNotChanged,true);
 assert.ok(released&&closed);
 assert.equal(seen.filter(x=>x.startsWith('WITH ')).length,4);
 assert.equal(seen.filter(x=>x==='ROLLBACK').length,1);
 assert.ok(seen.some(x=>x.startsWith('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')));
});

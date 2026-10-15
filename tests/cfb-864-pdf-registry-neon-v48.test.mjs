import test from 'node:test';
import assert from 'node:assert/strict';
import {registry830,INSERT_SQL,VERIFY_SQL,REVALIDATE_SQL,REVALIDATION_METRICS,
 safeRevalidation,SCHEMA}
 from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {MARKER,expectedMigrationLedger,assertPriorMigrationLedger,
 assertProtectedScope,safeRegistryProof,importOfficialCfbRegistryAndAudit}
 from '../scripts/register-cfb-864-pdf-neon-and-audit-v48.mjs';

const row=(overrides={})=>({
 year:'2022',family:'candidate_contribution',scope:'senate_member',
 ...Object.fromEntries(REVALIDATION_METRICS.map(k=>[k,'0'])),
 ...overrides
});
test('830 government PDF identities can be registered without assuming they contain finance rows',()=>{
 const records=registry830();
 assert.equal(records.length,830);
 assert.equal(new Set(records.map(x=>x.id)).size,830);
 assert.equal(new Set(records.map(x=>x.url)).size,830);
 assert.equal(new Set(records.map(x=>x.sha)).size,813);
 assert.ok(records.every(x=>x.estimated_on>=x.release_floor
   &&x.observed_on>=x.estimated_on
   &&x.url.startsWith('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&')));
 assert.equal(records.find(x=>x.id==='18430:21:pcc:YE:0:1')?.method,
  'first_observed_official_site_copy');
});
test('SQL only registers original PDF metadata and never changes financial evidence',()=>{
 assert.match(INSERT_SQL,/INSERT INTO cfb_official_senate_pdf_versions/);
 assert.doesNotMatch(INSERT_SQL,/UPDATE\s+evidence_items|INSERT\s+INTO\s+evidence_items/i);
 assert.match(INSERT_SQL,/ON CONFLICT DO NOTHING/);
 assert.match(VERIFY_SQL,/report_version_id=e.id/);
 assert.match(VERIFY_SQL,/full_original_pdf_sha256=e.sha/);
 assert.match(REVALIDATE_SQL,/committee_registration=t\.m->>'filerRegistrationNumber'/);
 assert.match(REVALIDATE_SQL,/ei\.metadata->>'asOfEligible'='true'/);
 assert.match(REVALIDATE_SQL,/independent_expenditure/);
 assert.match(REVALIDATE_SQL,/t\.family IN \('candidate_contribution','candidate_expenditure'\)/);
 assert.match(REVALIDATE_SQL,/min\(statutory_release_floor_on\)/);
 assert.match(REVALIDATE_SQL,/no_exact_version_reference/);
 assert.doesNotMatch(REVALIDATE_SQL,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b/i);
});
test('v48 migration ledger is immutable and latest only',()=>{
 const expected=expectedMigrationLedger();
 assert.equal(expected.length,14);
 assert.equal(expected.at(-1).filename,'0014_cfb_official_senate_pdf_versions.sql');
 assert.equal(assertPriorMigrationLedger(expected.slice(0,13),expected),false);
 assert.equal(assertPriorMigrationLedger(expected,expected),true);
 assert.throws(()=>assertPriorMigrationLedger(expected.slice(0,12),expected));
 assert.throws(()=>assertPriorMigrationLedger(expected.slice(0,13).map((x,i)=>
  i===0?{...x,checksum:'f'.repeat(64)}:x),expected));
 assert.throws(()=>assertPriorMigrationLedger([...expected,{...expected[0]}],expected));
});
test('reject unreviewed, replayed, PR or wrong repo Neon access',()=>{
 const good={
  GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),
  VOTEPREDICT_864_CFB_V48_VERIFIED:'true',
  VOTEPREDICT_864_CFB_V48_MARKER:'true'
 };
 assert.match(MARKER,/CFB_PDF_LINK_REVALIDATE_V48/);
 assert.doesNotThrow(()=>assertProtectedScope(good));
 for(const change of [
  {GITHUB_REPOSITORY:'somebody/repo'},
  {GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_REF:'refs/heads/feature'},
  {GITHUB_RUN_ATTEMPT:'2'},
  {VOTEPREDICT_864_CFB_V48_VERIFIED:'false'},
  {VOTEPREDICT_864_CFB_V48_MARKER:'false'},
  {GITHUB_SHA:'not-a-commit'}
 ])assert.throws(()=>assertProtectedScope({...good,...change}));
});
test('safe proof and read-only eligibility aggregate reject private row content',()=>{
 const verified={stored:'830',indexed:'830',exact:'830',missing:'0',distinct_bodies:'813'};
 assert.deepEqual(safeRegistryProof([verified]),verified);
 assert.throws(()=>safeRegistryProof([{...verified,stored:'829'}]));
 assert.throws(()=>safeRegistryProof([{...verified,source_url:'private'}]));
 const counts=row({
  eligible_copies:'10',candidate_year_candidates:'6',unique_candidate_pdf:'4',
  ambiguous_candidate_pdfs:'2',no_candidate_pdf:'4',
  exact_version_reference:'0',no_exact_version_reference:'10',
  before_every_candidate_legal_floor:'2',before_every_candidate_estimate:'3'
 });
 assert.deepEqual(safeRevalidation([counts]),[counts]);
 assert.throws(()=>safeRevalidation([{...counts,donorName:'Someone'}]));
 assert.throws(()=>safeRevalidation([counts,counts]));
 assert.throws(()=>safeRevalidation([{...counts,unique_candidate_pdf:'7'}]));
 assert.throws(()=>safeRevalidation([{...counts,exact_version_reference:'1'}]));
 assert.throws(()=>safeRevalidation([{...counts,before_every_candidate_legal_floor:'7'}]));
 assert.throws(()=>safeRevalidation([{...counts,eligible_copies:'9223372036854775807'}]));
});
function dbFixture({badLedger=false,badProof=false}={}){
 const expected=expectedMigrationLedger(),seen=[],flags={released:false,ended:false,primary:false};
 const client={
  async query(sql,params){
   seen.push(sql);
   if(sql.startsWith('BEGIN TRANSACTION'))return {rows:[]};
   if(sql.startsWith('SELECT current_database'))return {
    rows:[{db:'votepredict',role:'owner',ro:'off'}]
   };
   if(sql.startsWith('SELECT filename,checksum FROM votepredict_schema_migrations'))
    return {rows:badLedger?expected.slice(0,13).map((x,i)=>i===0?
      {...x,checksum:'f'.repeat(64)}:x):expected.slice(0,13)};
   if(sql.includes('CREATE TABLE IF NOT EXISTS cfb_official_senate_pdf_versions'))return {rows:[]};
   if(sql.startsWith('INSERT INTO votepredict_schema_migrations')){
    assert.equal(params[0],expected[13].filename);
    assert.equal(params[1],expected[13].checksum);
    return {rows:[]};
   }
   if(sql===INSERT_SQL){
    assert.equal(JSON.parse(params[0]).length,830);
    return {rows:[]};
   }
   if(sql===VERIFY_SQL)return {rows:[{
    stored:badProof?'829':'830',indexed:'830',exact:badProof?'829':'830',
    missing:badProof?'1':'0',distinct_bodies:'813'
   }]};
   if(sql===REVALIDATE_SQL)return {rows:[row({
    eligible_copies:'10',candidate_year_candidates:'6',unique_candidate_pdf:'4',
    ambiguous_candidate_pdfs:'2',no_candidate_pdf:'4',
    exact_version_reference:'0',no_exact_version_reference:'10',
    before_every_candidate_legal_floor:'2',before_every_candidate_estimate:'3'
   })]};
   if(sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
   assert.fail('Unexpected protected SQL: '+sql.slice(0,90));
  },
  release(force){flags.released=force===true;}
 };
 return {
  seen,flags,
  discover:async input=>{
   assert.equal(input.requirePrimary,true);
   flags.primary=true;
   return {host:'test.neon.tech',port:5432,role:'owner',
    password:'secret-do-not-print',database:'votepredict'}
  },
  connect:()=>({connect:async()=>client,end:async()=>{flags.ended=true;}})
 };
}
test('imports exact registry on existing Neon primary, then audits WITHOUT changing eligibility',async()=>{
 const fake=dbFixture();
 const out=await importOfficialCfbRegistryAndAudit({
  apiKey:'key',projectId:'votepredict-test'
 },fake);
 assert.equal(out.schema,SCHEMA);
 assert.equal(out.authenticatedOfficialVersions,830);
 assert.equal(out.authenticatedUniqueBodies,813);
 assert.equal(out.registryExactMatches,830);
 assert.equal(out.registryImportCommitted,true);
 assert.equal(out.existingEvidenceItemsNotModified,true);
 assert.equal(out.eligibilityRevalidatedAsDiagnosticOnly,true);
 assert.equal(out.totals.eligibleCopies,10);
 assert.equal(out.totals.noExactVersionReferences,10);
 assert.equal(out.totals.beforeEveryCandidateLegalFloor,2);
 assert.equal(fake.flags.primary,true);
 assert.equal(fake.flags.released,true);
 assert.equal(fake.flags.ended,true);
 assert.equal(fake.seen.filter(x=>x==='COMMIT').length,1);
 assert.equal(fake.seen.filter(x=>x==='ROLLBACK').length,0);
 assert.equal(fake.seen.filter(x=>x===INSERT_SQL).length,1);
});
test('immutable migration checksum or mismatched existing PDF aborts and ROLLBACKS',async()=>{
 for(const options of [{badLedger:true},{badProof:true}]){
  const fake=dbFixture(options);
  await assert.rejects(()=>importOfficialCfbRegistryAndAudit({
   apiKey:'key',projectId:'votepredict-test'
  },fake));
  assert.equal(fake.seen.filter(x=>x==='ROLLBACK').length,1);
  assert.equal(fake.seen.includes('COMMIT'),false);
  assert.ok(fake.flags.ended&&fake.flags.released);
 }
});

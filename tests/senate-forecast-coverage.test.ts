import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {ISSUE_CROSSWALK,WEBSITE_PROOF_SQL,readSenateCoverage,verifyCoverage,
 type CoverageCell,type CoverageDenominator} from '../src/operations/senate-forecast-coverage';
import {classifyForecastEvidence,type AccessibleEvidence} from '../src/evidence/forecast-evidence-access';
import {readVoteTextGapAudit} from '../src/operations/senate-vote-text-gap-audit';

const sessions=['2021-2022','2023-2024','2025-2026'];
const issues=[...Object.values(ISSUE_CROSSWALK),'unmapped_issue'];
function fixture(){
 const cells:CoverageCell[]=sessions.flatMap(session=>issues.map(issue=>({person_key:'one',senator:'Public Senator',session,district:'1',issue,
  recorded_member_events:1,binary_member_events:1,member_events_with_prevote_website:0,
  retained_website_copies:0,retained_website_literals:0,proof_qualified_website_literals:0,retained_context_literals:0})));
 const denominators:CoverageDenominator[]=sessions.map(session=>({session,source_family:'senate_journal',events:1,
  member_choices:1,unresolved_bill_events:0,roster_memberships:1,unresolved_or_out_of_term_choices:0}));
 return {cells,denominators};
}
test('coverage fails on dropped people/issues, duplicate identities, invalid subsets and missing counts',()=>{
 const f=fixture();verifyCoverage(f.cells,f.denominators);
 assert.throws(()=>verifyCoverage(f.cells.slice(1),f.denominators),/missing issue/);
 assert.throws(()=>verifyCoverage([...f.cells,f.cells[0]!],f.denominators),/duplicate/);
 assert.throws(()=>verifyCoverage(f.cells.map((c,i)=>i?c:{...c,retained_website_literals:1}),f.denominators),/subset/);
 assert.throws(()=>verifyCoverage(f.cells.map((c,i)=>i?c:{...c,binary_member_events:undefined as never}),f.denominators),/count/);
 assert.throws(()=>verifyCoverage(f.cells,f.denominators.map(d=>({...d,roster_memberships:2}))),/roster/);
 assert.throws(()=>verifyCoverage(f.cells.map(c=>({...c,recorded_member_events:0,binary_member_events:0})),f.denominators),/lost floor/);
});

const integration=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
test('PostgreSQL: stage partition, stable person, overlapping issues, duplicate and as-of rules',
 {skip:!integration},async()=>{
 const pool=new Pool({connectionString:integration,max:1}),db=await pool.connect();
 try{
  await db.query('BEGIN');
  // Disposable, session-local fixtures shadow production-shaped names. No
  // existing row is modified, and everything is explicitly rolled back.
  await db.query(`
   CREATE TEMP TABLE jurisdictions(id text,slug text);
   CREATE TEMP TABLE chambers(id text,slug text);
   CREATE TEMP TABLE legislative_sessions(id text,slug text,jurisdiction_id text);
   CREATE TEMP TABLE legislators(id text,external_key text,name text);
   CREATE TEMP TABLE memberships(id text,legislator_id text,session_id text,chamber_id text,district text,starts_on date,ends_on date);
   CREATE TEMP TABLE source_documents(id text,source_kind text,source_url text,content_sha256 text,metadata jsonb);
   CREATE TEMP TABLE vote_events(id text,session_id text,chamber_id text,bill_id text,source_document_id text,occurred_on date);
   CREATE TEMP TABLE member_votes(id text,vote_event_id text,membership_id text,choice text);
   CREATE TEMP TABLE bill_versions(id text,bill_id text);
   CREATE TEMP TABLE bill_feature_sets(bill_version_id text,feature_schema_version text,extractor_kind text,extractor_version text,features jsonb);
   CREATE TEMP TABLE evidence_items(id text,membership_id text,bill_id text,source_document_id text,excerpt text,published_at timestamptz,extraction_version text,metadata jsonb);
   INSERT INTO jurisdictions VALUES('j','us-mn');
   INSERT INTO chambers VALUES('c','senate');
   INSERT INTO legislators VALUES('l','stable-person','Public Senator');
   INSERT INTO legislative_sessions VALUES('s1','2021-2022','j'),('s2','2023-2024','j'),('s3','2025-2026','j');
   INSERT INTO memberships SELECT 'm'||right(id,1),'l',id,'c','1',NULL,NULL FROM legislative_sessions;
   INSERT INTO source_documents VALUES('journal','senate_journal','https://www.senate.mn/journals/fixture.pdf','', '{}'),
    ('committee','senate_committee_minutes','https://www.senate.mn/committees/fixture.pdf','','{}');
   INSERT INTO vote_events VALUES('v1','s1','c','b','journal','2022-02-02'),('v2','s2','c','b','journal','2023-02-02'),
    ('v3','s3','c','b','journal','2025-02-02'),('committee-v','s1','c','b','committee','2022-02-02');
   INSERT INTO member_votes VALUES('mv1','v1','m1','yea'),('mv2','v2','m2','nay'),('mv3','v3','m3','absent'),
    ('committee-mv','committee-v','m1','yea'),('unresolved','v1',NULL,'nay');
   INSERT INTO bill_versions VALUES('bv','b');
   INSERT INTO bill_feature_sets VALUES('bv','bill-features-v2','deterministic','deterministic-v2.1','{"policyAreas":["health","agriculture"]}');
  `);
  const base:AccessibleEvidence={id:'e',sourceHash:'a'.repeat(64),sourceUrl:'https://example.test',sourceKind:'website',
   sourceMembershipId:'m3',targetMembershipId:'m1',legislatorId:'l',billId:null,excerpt:'Literal website text',
   publishedAt:'2022-02-02T00:00:00Z',fetchedAt:'2026-01-01',extractionVersion:'senate-864-literal-website-observed-asof-v1',
   metadata:{experimentalWebsiteTextForHistoricalEvaluation:true,mechanicallyActionable:false,asOfEligible:true,
    issueTag:'health',availabilityProof:'original_site_html_cdx_index_in_existing_research',archiveCapturedAt:'2022-02-02T00:00:00Z'},
   sourceMetadata:{availabilityProof:'archived_original_html_plus_cdx_research_ledger',archiveCapturedAt:'2022-02-02T00:00:00Z',originalCdxSha1Base32:'A'.repeat(32)}};
  await db.query('INSERT INTO source_documents VALUES($1,$2,$3,$4,$5)',['website','website',base.sourceUrl,base.sourceHash,base.sourceMetadata]);
  const put=async(id:string,metadata:Record<string,unknown>,bill:string|null=null)=>db.query(
   'INSERT INTO evidence_items VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,'m3',bill,'website',base.excerpt,base.publishedAt,base.extractionVersion,metadata]);
  await put('e1',base.metadata);await put('e2',base.metadata);
  await put('unmapped',{...base.metadata,issueTag:'narrow_unmapped_topic'});
  await put('wrong-bill',{...base.metadata,issueTag:'agriculture'},'different-bill');
  const {cells,denominators}=await readSenateCoverage(db);
  const health=cells.filter(c=>c.issue==='health');
  assert.deepEqual(health.map(c=>c.retained_website_copies),[2,2,2]);
  assert.deepEqual(health.map(c=>c.retained_website_literals),[1,1,1]);
  assert.deepEqual(health.map(c=>c.member_events_with_prevote_website),[0,1,1]);
  assert.deepEqual(health.map(c=>c.recorded_member_events),[1,1,1]);
  assert.deepEqual(health.map(c=>c.binary_member_events),[1,1,0]);
  assert.ok(cells.filter(c=>c.issue==='agriculture').every(c=>c.member_events_with_prevote_website===0));
  assert.ok(cells.filter(c=>c.issue==='unmapped_issue').every(c=>c.member_events_with_prevote_website===0));
  const committee=denominators.find(d=>d.source_family==='committee_minutes')!;
  assert.equal(committee.events,1);assert.equal(committee.member_choices,1);
  assert.equal(denominators.find(d=>d.session==='2021-2022'&&d.source_family==='senate_journal')!.unresolved_or_out_of_term_choices,1);
  // Cross-check SQL admission against the established reader, including JSON
  // string booleans, malformed digests and a missing literal source excerpt.
  for(const change of [{},{asOfEligible:'true'},{mechanicallyActionable:'false'},
   {experimentalWebsiteTextForHistoricalEvaluation:'true'},{availabilityProof:'url-only'}]){
   const row={...base,metadata:{...base.metadata,...change}};
   const q=await db.query(`SELECT coalesce((${WEBSITE_PROOF_SQL}),false) AS ok
    FROM (SELECT $1::jsonb AS metadata,$2::text AS extraction_version,$3::text AS excerpt,$4::timestamptz AS published_at) e
    CROSS JOIN (SELECT $5::jsonb AS metadata,$6::text AS content_sha256) sd`,
    [row.metadata,row.extractionVersion,row.excerpt,row.publishedAt,row.sourceMetadata,row.sourceHash]);
   assert.equal(q.rows[0].ok,classifyForecastEvidence(row,'2023-02-02').allowedUse==='website_text_research');
  }
 }finally{try{await db.query('ROLLBACK')}finally{db.release();await pool.end()}}
});

test('legacy committee source kinds are included in the paper-gap audit classification',async()=>{
 let captured='';
 await readVoteTextGapAudit({query:async(sql:string)=>{captured=sql;return {rows:[{audited_events:0,gap_groups:[],case_examples:[],hf100_pilot:[]}]}}} as never);
 assert.match(captured,/d\.source_kind IN \('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf'\)/);
});

/**
 * Second-stage finance-only 116-cohort original CFB multi-column layout
 * review. Uses already preserved 2021-25 PDF schedule page text and candidate
 * spans, with ALL receiving committee/year contribution rows as the collision
 * comparator. This is research-only, not exact PDF row or public-by proof.
 * A clean protected read-only scan emits aggregate totals, never donor data.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {validateCfbIssueSourceManifest}
 from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {attestCurrentPacSourcePairs}
 from '../src/evidence/cfb-issue-pac-original-attestations-v2.mjs';
import {assertPac116FinanceReadOnlyGuard}
 from './audit-cfb-pac-116-contribution-provenance-readonly.mjs';
import {auditPac116OriginalMultiColumnShadow}
 from '../src/evidence/cfb-pac116-original-multicolumn-shadow-v2.mjs';

const SOURCES_SQL=[
 'SELECT source_id,organization_group,source_role,source_url,final_url,',
 'html_sha256,raw_html_bytes,observed_at,claim_status,',
 'historical_asof_eligible,mechanically_actionable,model_weight',
 'FROM cfb_issue_finance_source_observations',
 'WHERE source_id = ANY($1::text[]) ORDER BY source_id,observed_at'
].join(' ');
const COHORT_SQL=[
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS reg,",
 "ei.metadata->>'year' AS year",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'",
 "AND ei.metadata->>'contributorRegistrationNumber' = ANY($1::text[])",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 'ORDER BY 2,3,1'
].join(' ');
const COMPARATOR_SQL=[
 'WITH scope AS (SELECT DISTINCT reg,year FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer))',
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS reg,",
 "ei.metadata->>'year' AS year,",
 "ei.metadata->>'transactionDate' AS transaction_date,",
 "ei.metadata->>'amount' AS amount,",
 "ei.metadata->>'contributor' AS contributor",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 'JOIN scope x ON x.reg = ei.metadata->>\'filerRegistrationNumber\'',
 "AND x.year::text=ei.metadata->>'year'",
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))"
].join(' ');
const REPORT_SQL=[
 'WITH scope AS (SELECT DISTINCT reg,year FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer))',
 'SELECT v.report_version_id,v.committee_registration,v.report_year,',
 'v.full_original_pdf_sha256 AS pdf_sha256,s.pdf_sha256 AS captured_pdf_sha,',
 "(c.report_version_id IS NOT NULL) AS v2_extraction_present",
 'FROM cfb_official_senate_pdf_versions v JOIN scope x',
 'ON x.reg=v.committee_registration AND x.year=v.report_year',
 'LEFT JOIN cfb_finance_report_schedule_captures s',
 'ON s.report_version_id=v.report_version_id',
 'LEFT JOIN cfb_finance_report_v2_raw_captures c',
 "ON c.report_version_id=v.report_version_id AND c.extractor_version='cfb-schedule-layout-shadow-v2'",
 'ORDER BY v.report_year,v.report_version_id'
].join(' ');
const SPANS_SQL=[
 'SELECT report_version_id,page_number,first_line_number,',
 'raw_span,printed_transaction_date::text,schedule_family,readiness',
 'FROM cfb_finance_report_v2_raw_spans',
 "WHERE extractor_version='cfb-schedule-layout-shadow-v2'",
 "AND schedule_family='candidate_contribution'",
 'AND report_version_id = ANY($1::text[])',
 'ORDER BY report_version_id,page_number,first_line_number'
].join(' ');
const PAGES_SQL=[
 'SELECT pdf_sha256,page_number,raw_page_text',
 'FROM cfb_finance_report_schedule_pages',
 'WHERE pdf_sha256 = ANY($1::text[])',
 'ORDER BY pdf_sha256,page_number'
].join(' ');
export async function main(){
 assertPac116FinanceReadOnlyGuard(process.env);
 const manifest=validateCfbIssueSourceManifest(JSON.parse(readFileSync(
  'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8')));
 const config=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-pac-attestation-candidates-v2.json','utf8'));
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:15000,query_timeout:180000,
  statement_timeout:180000,application_name:'cfb-pac116-multicolumn-readonly',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'});
 const client=await pool.connect();let open=false;
 try{
  const who=(await client.query('SELECT current_database() AS db,current_user AS role')).rows[0];
  if(who.db!==target.database||who.role!==target.role)
   throw Error('Unexpected production Neon original evidence database');
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  open=true;
  if((await client.query(
   "SELECT current_setting('transaction_read_only') AS ro")).rows[0].ro!=='on')
   throw Error('Protected source layout audit must be READ ONLY');
  const registry=(await client.query([
   'SELECT count(*)::int AS n,count(DISTINCT full_original_pdf_sha256)::int AS shas',
   'FROM cfb_official_senate_pdf_versions'
  ].join(' '))).rows[0];
  if(registry.n!==830||registry.shas!==813)
   throw Error('Canonical original CFB registry missing');

  const originals=(await client.query(SOURCES_SQL,[manifest.map(s=>s.id)])).rows;
  if(originals.length>100)throw Error('Source attestation versions out of bounds');
  const snapshots=originals.map(s=>({
   sourceId:s.source_id,organizationGroup:s.organization_group,
   sourceRole:s.source_role,sourceUrl:s.source_url,finalUrl:s.final_url,
   htmlSha256:s.html_sha256,rawHtmlBytes:s.raw_html_bytes,
   observedAt:new Date(s.observed_at).toISOString(),claimStatus:s.claim_status,
   historicalAsOfEligible:s.historical_asof_eligible,
   mechanicallyActionable:s.mechanically_actionable,modelWeight:s.model_weight
  }));
  const decisions=attestCurrentPacSourcePairs({
   snapshots,manifest,config,cutoffOn:new Date().toISOString().slice(0,10)
  }).statuses;
  const current=decisions.filter(s=>s.status==='current_dual_original_source_attested')
   .map(s=>s.registration);
  if(current.length!==2)throw Error('Two source-attested current PACs required');
  const cohortRaw=(await client.query(COHORT_SQL,[current])).rows;
  if(!cohortRaw.length||cohortRaw.length>2000)
   throw Error('PAC source cohort outside reviewed bounds');
  const cohort=new Map();
  for(const r of cohortRaw){
   const key=[r.reg,r.year,r.row_key].join('|');
   cohort.set(key,{reg:r.reg,year:Number(r.year),rowKey:r.row_key});
  }
  // This versioned candidate matcher cannot assume all rows were found,
  // nor can it backdate today's independent identity evidence.
  const pairs=[...new Map([...cohort.values()].map(x=>[
   x.reg+'|'+x.year,{reg:x.reg,year:x.year}
  ])).values()];
  const comparator=(await client.query(COMPARATOR_SQL,[JSON.stringify(pairs)])).rows;
  if(comparator.length>50000)throw Error('All-committee-year collision comparator too large');
  const allCandidateContributions=comparator.map(r=>({
   family:'candidate_contribution',reg:r.reg,year:Number(r.year),
   rowKey:r.row_key,transactionDate:r.transaction_date,
   amount:r.amount,contributor:r.contributor,vendorName:null
  }));
  const reports=(await client.query(REPORT_SQL,[JSON.stringify(pairs)])).rows;
  if(reports.length>830)throw Error('Original PDF report candidate scope too broad');
  const ids=reports.map(r=>r.report_version_id);
  const shas=[...new Set(reports.map(r=>r.pdf_sha256))];
  const spans=(await client.query(SPANS_SQL,[ids])).rows;
  const pages=(await client.query(PAGES_SQL,[shas])).rows;
  const summary=auditPac116OriginalMultiColumnShadow({
   cohort:[...cohort.values()],allCandidateContributions,
   reports,spans,pages
  });
  await client.query('ROLLBACK');open=false;
  console.log('CFB_864_PAC116_MULTI_COLUMN_SAFE_COUNTS '+JSON.stringify(summary));
 }finally{
  if(open)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/audit-cfb-pac116-original-multicolumn-readonly.mjs'))
 main().catch(()=>{console.error('CFB_864_PAC116_MULTI_COLUMN_HELD');process.exitCode=1;});

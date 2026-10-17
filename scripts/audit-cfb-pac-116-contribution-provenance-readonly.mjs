/**
 * Guarded existing-Neon READ ONLY census of the original CFB finance reports
 * corresponding to the 116 previously counted Senate contribution rows from
 * the two verified CURRENT-only PAC identities. No donor/amount/URLs/row keys
 * are sent to GitHub logs. Original PDF hashes are rechecked before certifying
 * even present-day entry containment; the PDF's historical public date is
 * independent and remains UNPROVEN.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {validateCfbIssueSourceManifest}
 from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {attestCurrentPacSourcePairs}
 from '../src/evidence/cfb-issue-pac-original-attestations-v2.mjs';
import {
 scoreCfbPacContributionProvenance,independentlyRehashCfbPdf
} from '../src/evidence/cfb-pac-contribution-provenance-v1.mjs';

const MARKER='SENATE_864_CFB_PAC_116_FINANCE_READONLY_V1';
const STATIC_SOURCE_SQL=[
 'SELECT source_id,organization_group,source_role,source_url,final_url,',
 'html_sha256,raw_html_bytes,observed_at,claim_status,',
 'historical_asof_eligible,mechanically_actionable,model_weight',
 'FROM cfb_issue_finance_source_observations',
 'WHERE source_id = ANY($1::text[])',
 'ORDER BY source_id,observed_at'
].join(' ');
const ROWS_SQL=[
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS filer_reg,",
 "ei.metadata->>'year' AS year,",
 "ei.metadata->>'contributorRegistrationNumber' AS contributor_reg,",
 "ei.metadata->>'transactionDate' AS transaction_date,",
 "ei.metadata->>'amount' AS amount,",
 "ei.metadata->>'contributor' AS contributor,",
 'ei.membership_id::text AS member_id,',
 'sd.content_sha256 AS source_sha,',
 "ei.metadata->>'availabilityProofContentSha256' AS availability_sha,",
 "ei.metadata->>'availabilityProof' AS availability_proof,",
 'sd.fetched_at AS source_fetched_at,',
 'ei.published_at::date::text AS stored_published_on,',
 "ei.metadata->>'asOfEligible' AS as_of_eligible",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 "AND ei.metadata->>'contributorRegistrationNumber' = ANY($1::text[])",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'",
 'ORDER BY 2,1,3'
].join(' ');
const VERSIONS_SQL=[
 'WITH relevant AS (SELECT DISTINCT reg,year FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer))',
 'SELECT v.report_version_id,v.committee_registration,v.report_year,',
 'v.full_original_pdf_sha256,v.full_original_pdf_bytes,',
 'v.report_due_on::text,v.statutory_release_floor_on::text,',
 'v.website_observed_on::text,v.historical_exact_version_public_by_proven,',
 's.pdf_sha256 AS captured_pdf_sha',
 'FROM cfb_official_senate_pdf_versions v JOIN relevant r',
 'ON r.reg=v.committee_registration AND r.year=v.report_year',
 'LEFT JOIN cfb_finance_report_schedule_captures s',
 'ON s.report_version_id=v.report_version_id',
 'ORDER BY v.report_version_id'
].join(' ');
const LINKS_SQL=[
 'WITH relevant AS (SELECT DISTINCT reg,year,row_key FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer,row_key text))',
 'SELECT l.report_version_id,l.family,l.committee_registration,',
 'l.transaction_year,l.canonical_row_key,l.match_status,',
 'l.possible_entry_count,l.entry_id::text,',
 'e.id::text AS matched_entry_id,',
 'e.schedule_family AS entry_schedule_family,',
 'e.printed_transaction_date::text AS entry_date,',
 'e.printed_amount_cents::text AS entry_cents,',
 'e.raw_schedule_line AS entry_line',
 'FROM cfb_finance_report_transaction_links l JOIN relevant r',
 'ON r.reg=l.committee_registration AND r.year=l.transaction_year',
 'AND r.row_key=l.canonical_row_key',
 'LEFT JOIN cfb_finance_report_schedule_entries e',
 'ON e.id=l.entry_id AND e.report_version_id=l.report_version_id',
 "WHERE l.family='candidate_contribution'",
 'ORDER BY l.report_version_id,l.canonical_row_key'
].join(' ');
const ARCHIVES_SQL=[
 'WITH relevant AS (SELECT DISTINCT reg,year,row_key FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer,row_key text))',
 'SELECT a.family,a.committee_registration,a.transaction_year,',
 'a.canonical_row_key,a.source_sha256,a.independently_observed_at,a.proof_kind',
 'FROM cfb_finance_bulk_archive_row_observations a JOIN relevant r',
 'ON r.reg=a.committee_registration AND r.year=a.transaction_year',
 'AND r.row_key=a.canonical_row_key',
 "WHERE a.family='candidate_contribution'",
 'ORDER BY a.transaction_year,a.canonical_row_key'
].join(' ');

export function assertPac116FinanceReadOnlyGuard(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||
  e.VOTEPREDICT_PAC_116_KEYLESS_PASSED!=='true'||
  e.VOTEPREDICT_PAC_116_COMMIT_MARKER!=='true')
  throw Error('Independently reviewed first-attempt main-only PAC finance audit required');
}
const iso=v=>new Date(v).toISOString();
export async function main(){
 assertPac116FinanceReadOnlyGuard(process.env);
 const manifest=validateCfbIssueSourceManifest(JSON.parse(readFileSync(
  'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8')));
 const pacConfig=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-pac-attestation-candidates-v2.json','utf8'));
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:15000,
  statement_timeout:180000,query_timeout:180000,
  application_name:'votepredict-cfb-pac-116-original-report-readonly',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'});
 const client=await pool.connect();let opened=false;
 try{
  const who=(await client.query(
   'SELECT current_database() AS db,current_user AS role'
  )).rows[0];
  if(who?.db!==target.database||who?.role!==target.role)
   throw Error('Incorrect protected existing Neon primary database');
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  opened=true;
  if((await client.query(
   "SELECT current_setting('transaction_read_only') AS ro"
  )).rows[0]?.ro!=='on')throw Error('CFB finance cohort query must be READ ONLY');
  const census=(await client.query([
   'SELECT count(*)::int AS versions,',
   'count(DISTINCT full_original_pdf_sha256)::int AS distinct_bodies',
   'FROM cfb_official_senate_pdf_versions'
  ].join(' '))).rows[0];
  if(census.versions!==830||census.distinct_bodies!==813)
   throw Error('Canonical 830 verified government PDF versions not present');

  const observations=(await client.query(STATIC_SOURCE_SQL,
   [manifest.map(x=>x.id)])).rows;
  if(observations.length>100)throw Error('Unbounded first-party PAC original captures');
  const snapshots=observations.map(s=>({
   sourceId:s.source_id,organizationGroup:s.organization_group,
   sourceRole:s.source_role,sourceUrl:s.source_url,finalUrl:s.final_url,
   htmlSha256:s.html_sha256,rawHtmlBytes:s.raw_html_bytes,
   observedAt:iso(s.observed_at),claimStatus:s.claim_status,
   historicalAsOfEligible:s.historical_asof_eligible,
   mechanicallyActionable:s.mechanically_actionable,modelWeight:s.model_weight
  }));
  const status=attestCurrentPacSourcePairs({
   snapshots,manifest,config:pacConfig,cutoffOn:new Date().toISOString().slice(0,10)
  }).statuses;
  const currentRegs=status.filter(s=>
   s.status==='current_dual_original_source_attested')
   .map(x=>x.registration);
  if(currentRegs.length!==2)throw Error('No source-attested current PAC finance cohort');

  const canonicalRows=(await client.query(ROWS_SQL,[currentRegs])).rows;
  if(!canonicalRows.length||canonicalRows.length>2000)
   throw Error('Selected historical campaign-finance cohort unexpectedly unavailable');
  const pairs=canonicalRows.filter(x=>/^[0-9]{3,8}$/.test(x.filer_reg??''))
   .map(x=>({reg:x.filer_reg,year:Number(x.year)}));
  const keys=canonicalRows.filter(x=>/^[0-9]{3,8}$/.test(x.filer_reg??''))
   .map(x=>({reg:x.filer_reg,year:Number(x.year),row_key:x.row_key}));
  const reports=(await client.query(VERSIONS_SQL,[JSON.stringify(pairs)])).rows;
  const links=(await client.query(LINKS_SQL,[JSON.stringify(keys)])).rows;
  const archives=(await client.query(ARCHIVES_SQL,[JSON.stringify(keys)])).rows
   .map(a=>({...a,independently_observed_at:iso(a.independently_observed_at)}));
  if(reports.length>830||links.length>20000||archives.length>2000)
   throw Error('Unexpected historical cohort join size');

  // Re-hash the actual stored official PDF body bytes for source-linked
  // exact entries only; a matching database field alone is not proof.
  const versions=new Map(reports.map(x=>[x.report_version_id,x]));
  const relevantHashes=new Set();
  for(const l of links){
   if(l.match_status!=='exact')continue;
   const v=versions.get(l.report_version_id);
   if(v?.captured_pdf_sha===v?.full_original_pdf_sha256)
    relevantHashes.add(v.full_original_pdf_sha256);
  }
  if(relevantHashes.size>30)
   throw Error('Exact PDF body source verification exceeds safe audit batch');
  const verified=[];
  for(const expected of relevantHashes){
   const r=(await client.query([
    'SELECT pdf_sha256,byte_length,original_pdf',
    'FROM cfb_finance_pdf_body_captures',
    'WHERE pdf_sha256=$1 AND byte_length BETWEEN 501 AND 30000000'
   ].join(' '),[expected])).rows;
   if(r.length===1&&
    r[0].byte_length===r[0].original_pdf.length&&
    independentlyRehashCfbPdf(r[0].original_pdf,expected))
    verified.push(expected);
  }
  const result=scoreCfbPacContributionProvenance({
   canonicalRows,reportVersions:reports,reportLinks:links,
   archiveRows:archives,attestationStatuses:status,
   independentlyVerifiedPdfHashes:verified
  });
  await client.query('ROLLBACK');opened=false;
  // Only safe aggregate counts, NEVER contributor names, individual rows,
  // raw source bytes, transaction amounts or database credentials.
  console.log('CFB_864_PAC_116_FINANCE_READONLY_SAFE_COUNTS '+JSON.stringify(result));
 }finally{
  if(opened)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/audit-cfb-pac-116-contribution-provenance-readonly.mjs'))
 main().catch(()=>{console.error('CFB_864_PAC_116_FINANCE_READONLY_HELD');process.exitCode=1;});

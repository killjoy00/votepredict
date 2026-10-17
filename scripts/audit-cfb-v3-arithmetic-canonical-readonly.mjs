/**
 * #864 historical CFB report/transaction candidate comparison (read only).
 *
 * Input: 830 cached official PDF versions, v2 append-only raw spans, original
 * page text, and preexisting canonical Senate finance rows. This emits only
 * bounded integer aggregates. Does NOT write link assertions or change evidence.
 *
 * A unique date, name, amount and arithmetic-consistent printed total is a
 * CANDIDATE, not authenticated proof of historical exact disclosure lineage.
 */
import {Pool} from 'pg';
import {registry830} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {
 ARITHMETIC_SHADOW_VERSION,pageScheduleSignals,shadowMatchReportRows
} from '../src/evidence/cfb-report-schedule-arithmetic-shadow-v3.mjs';

const MARKER='SENATE_864_CFB_ARITHMETIC_SHADOW_V3';
const YEARS=[2021,2022,2023,2024,2025];
const FAMILIES=['candidate_contribution','candidate_expenditure'];
function assertGuard(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||
  e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
  e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||
  e.VOTEPREDICT_CFB_ARITHMETIC_KEYLESS_PASSED!=='true'||
  e.VOTEPREDICT_CFB_ARITHMETIC_MARKER!=='true')
  throw Error('Reviewed protected first-attempt main v3 arithmetic audit required');
}
const RECORDS_SQL=[
 'SELECT v.report_version_id,v.report_year,v.committee_registration,',
 'v.full_original_pdf_sha256 AS pdf_sha256',
 'FROM cfb_official_senate_pdf_versions v',
 'JOIN cfb_finance_report_v2_raw_captures c',
 "ON c.report_version_id=v.report_version_id AND c.extractor_version='cfb-schedule-layout-shadow-v2'",
 'ORDER BY v.report_year,v.report_version_id'
].join(' ');
const EVIDENCE_SQL=[
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS reg,",
 "ei.metadata->>'year' AS year,",
 "ei.metadata->>'transactionDate' AS transaction_date,",
 "ei.metadata->>'amount' AS amount,",
 "ei.metadata->>'contributor' AS contributor,",
 "ei.metadata->>'vendorName' AS vendor_name,",
 'CASE',
 "WHEN ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "THEN 'candidate_contribution'",
 "WHEN ei.metadata->>'subtype'='candidate_expenditure_record'",
 "AND sd.source_kind IN ('campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')",
 "THEN 'candidate_expenditure' ELSE NULL END AS family",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk',",
 "'campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND ei.metadata->>'filerRegistrationNumber'=ANY($1::text[])",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'"
].join(' ');
const empty=()=>({
 report_versions:0,report_row_comparisons:0,
 arithmetic_candidate_spans:0,unsupported_multi_money_spans:0,
 report_rows_with_name_date_amount_candidate:0,
 ambiguous_report_rows:0,unique_report_row_candidates:0
});
const bump=(dst,delta)=>{
 for(const field of Object.keys(dst))dst[field]+=delta[field]??0;
};
const keyed=(family,year,key)=>[family,year,key].join('|');
export function safeAggregate(records,spans,pageSignals,canonicalRows,knownExact){
 const spansByVersion=new Map();
 for(const span of spans){
  if(!spansByVersion.has(span.report_version_id))
   spansByVersion.set(span.report_version_id,[]);
  spansByVersion.get(span.report_version_id).push(span);
 }
 const rowsByRegYear=new Map();
 for(const row of canonicalRows){
  if(!FAMILIES.includes(row.family))continue;
  const key=row.reg+'|'+row.year;
  if(!rowsByRegYear.has(key))rowsByRegYear.set(key,[]);
  rowsByRegYear.get(key).push(row);
 }
 const perYear=Object.fromEntries(YEARS.map(y=>[String(y),empty()]));
 const perFamily=Object.fromEntries(FAMILIES.map(f=>[f,empty()]));
 const total=empty(),foundKeys=new Set();
 const perFamilyKeys=Object.fromEntries(FAMILIES.map(f=>[f,new Set()]));
 for(const report of records){
  const familyYearKey=report.committee_registration+'|'+report.report_year;
  const rows=rowsByRegYear.get(familyYearKey)??[];
  const reportSignals=new Map();
  const src=spansByVersion.get(report.report_version_id)??[];
  for(const span of src){
   const signals=pageSignals.get(report.pdf_sha256+'|'+span.page_number);
   if(signals)reportSignals.set(span.page_number,signals);
  }
  const result=shadowMatchReportRows(rows,src,Number(report.report_year),
   report.committee_registration,reportSignals);
  const delta={
   report_versions:1,
   report_row_comparisons:result.reportVersionCanonicalRows,
   arithmetic_candidate_spans:result.arithmeticallySupportedSpans,
   unsupported_multi_money_spans:result.unsupportedMultiSpans,
   report_rows_with_name_date_amount_candidate:result.rowsWithAnyCandidate,
   ambiguous_report_rows:result.ambiguousCanonicalRows,
   unique_report_row_candidates:result.uniqueCandidateLinks.length
  };
  bump(total,delta);bump(perYear[String(report.report_year)],delta);
  // Count family-specific candidates, not all spans for each family.
  const linksByFamily=Object.fromEntries(FAMILIES.map(f=>[f,[]]));
  for(const link of result.uniqueCandidateLinks){
   foundKeys.add(link.canonicalKey);
   perFamilyKeys[link.family].add(link.canonicalKey);
   linksByFamily[link.family].push(link);
  }
  for(const f of FAMILIES){
   perFamily[f].unique_report_row_candidates+=linksByFamily[f].length;
  }
 }
 const knownExactKeys=new Set(knownExact.map(x=>
  [x.family,x.reg,Number(x.year),x.row_key].join('|')));
 if(total.report_versions!==830)throw Error('Expected exactly 830 verified source versions');
 const newKeys=[...foundKeys].filter(k=>!knownExactKeys.has(k));
 const outputs={
  schema:'cfb-864-v3-provisional-arithmetic-report-match-audit',
  interpretation:'candidate_only_not_exact_version_proof',
  originalReportVersions:830,
  legacyExactUniqueCanonicalTransactions:knownExactKeys.size,
  ...total,
  distinctProvisionalCanonicalTransactions:foundKeys.size,
  distinctProvisionalBeyondLegacyExact:newKeys.length,
  candidateContributionUniqueKeys:perFamilyKeys.candidate_contribution.size,
  candidateExpenditureUniqueKeys:perFamilyKeys.candidate_expenditure.size,
  perYear,perFamily,
  historicalEligibilityUnchanged:true,
  forecastsAndModelsUnchanged:true,
  exactTransactionLinksWritten:0
 };
 // No source record identifiers, names, dates or amounts are returned.
 const walk=(v)=>{
  if(typeof v==='number'&&(!Number.isSafeInteger(v)||v<0||v>5000000))
   throw Error('Unbounded v3 aggregate');
  if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);
 };
 walk(outputs);return outputs;
}
export async function main(){
 assertGuard(process.env);
 if(registry830().length!==830)throw Error('Pinned original official report registry changed');
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},
  max:1,connectionTimeoutMillis:15000,
  query_timeout:180000,statement_timeout:180000,
  application_name:'votepredict-cfb-864-v3-arithmetic-readonly',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'
 });
 const client=await pool.connect();let opened=false;
 try{
  const who=(await client.query(
   "SELECT current_database() AS db,current_user AS role")).rows[0];
  if(who.db!==target.database||who.role!==target.role)
   throw Error('Unexpected existing primary database identity');
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  opened=true;
  const ro=(await client.query("SELECT current_setting('transaction_read_only') AS mode")).rows[0];
  if(ro.mode!=='on')throw Error('Source comparison transaction must be READ ONLY');
  const records=(await client.query(RECORDS_SQL)).rows;
  if(records.length!==830||new Set(records.map(x=>x.pdf_sha256)).size!==813)
   throw Error('830 source versions and 813 body identity gate failed');
  const allSpans=(await client.query([
   'SELECT report_version_id,page_number,first_line_number,',
   'raw_span,printed_transaction_date::text,',
   'schedule_family,readiness',
   'FROM cfb_finance_report_v2_raw_spans',
   "WHERE extractor_version='cfb-schedule-layout-shadow-v2'",
   'ORDER BY report_version_id,page_number,first_line_number'
  ].join(' '))).rows;
  if(allSpans.length<1||allSpans.length>200000)
   throw Error('Unexpected v2 source candidate volume');
  // Private page text is never emitted. It is used only for printed
  // section/header presence checks, not transmitted outside the runner.
  const pages=(await client.query([
   'SELECT pdf_sha256,page_number,raw_page_text',
   'FROM cfb_finance_report_schedule_pages'
  ].join(' '))).rows;
  const pageSignals=new Map();
  for(const p of pages){
   pageSignals.set(p.pdf_sha256+'|'+p.page_number,pageScheduleSignals(p.raw_page_text));
  }
  const regs=[...new Set(records.map(x=>x.committee_registration))];
  const canonical=(await client.query(EVIDENCE_SQL,[regs])).rows.map(r=>({
   family:r.family,reg:r.reg,year:Number(r.year),rowKey:r.row_key,
   transactionDate:r.transaction_date,amount:Number(r.amount),
   contributor:r.contributor,vendorName:r.vendor_name
  }));
  if(canonical.length<1||canonical.length>250000)
   throw Error('Unexpected canonical historical candidate family volume');
  const legacy=(await client.query([
   'SELECT family,committee_registration AS reg,transaction_year AS year,',
   'canonical_row_key AS row_key',
   'FROM cfb_finance_report_transaction_links',
   "WHERE match_status='exact'"
  ].join(' '))).rows;
  const result=safeAggregate(records,allSpans,pageSignals,canonical,legacy);
  await client.query('ROLLBACK');opened=false;
  console.log('CFB_864_ARITHMETIC_SHADOW_SAFE_COUNTS '+JSON.stringify(result));
 }finally{
  if(opened)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/audit-cfb-v3-arithmetic-canonical-readonly.mjs'))
 main().catch(()=>{console.error('CFB_864_ARITHMETIC_SHADOW_HELD');process.exitCode=1;});

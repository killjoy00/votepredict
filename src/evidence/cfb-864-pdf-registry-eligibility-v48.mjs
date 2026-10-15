/**
 * #864 V48: exact current official PDF registry; candidate-year is a possible
 * association, NOT a transaction-to-PDF content proof or model-eligibility grant.
 * All protected outputs are only bounded integer counts by year/family/scope.
 */
import {readFileSync} from 'node:fs';
import {source830,FINANCE_FAMILIES,SCOPES,YEARS,SOURCE_KINDS}
 from './cfb-864-finance-db-reconciliation-v47.mjs';

export const SCHEMA='cfb-864-authenticated-pdf-registry-and-eligibility-triage-v48';
const LEDGER='docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const DATES='data/cfb-2021-25-830-estimated-availability-v46.json';
const DAY=/^20\d\d-\d\d-\d\d$/;
const isDay=x=>typeof x==='string'&&DAY.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;

/** V47 checks both Git blob hashes and every original government PDF identity. */
export function registry830(){
 const originals=source830(), source=new Map(originals.map(x=>[x.id,x]));
 const ledger=readFileSync(LEDGER,'utf8').trimEnd().split('\n').map(line=>line.split('|'));
 const dated=JSON.parse(readFileSync(DATES,'utf8'));
 if(dated.total!==830||dated.records?.length!==830||ledger.length!==830)
  throw Error('PDF registry source census is not exactly 830');
 const byDate=new Map(dated.records.map(x=>[x.id,x]));
 if(byDate.size!==830||source.size!==830)throw Error('Repeated CFB PDF version identity');
 const rows=ledger.map(parts=>{
  const s=source.get(parts[0]),d=byDate.get(parts[0]),bytes=Number(parts[11]);
  if(!s||!d||parts.length!==19||s.reg!==parts[3]||s.year!==Number(parts[2])
    ||s.url!==parts[9]||s.sha!==parts[10]||d.sourceFullPdfSHA256!==s.sha
    ||!Number.isSafeInteger(bytes)||bytes<=500||!isDay(d.websiteObservedByOn)
    ||!isDay(s.release_floor)||!isDay(s.estimated_on)
    ||(d.boardReceivedOnOriginal!==null&&!isDay(d.boardReceivedOnOriginal))
    ||(d.reportDueOn!==null&&!isDay(d.reportDueOn))
    ||!['high','medium','low'].includes(d.confidence)
    ||s.estimated_on>d.websiteObservedByOn)
   throw Error('Unverifiable official PDF version registry record');
  return {id:s.id,reg:s.reg,year:s.year,url:s.url,sha:s.sha,bytes,
   received_on:d.boardReceivedOnOriginal,due_on:d.reportDueOn,
   release_floor:s.release_floor,estimated_on:s.estimated_on,
   observed_on:d.websiteObservedByOn,method:s.method,confidence:d.confidence};
 });
 if(new Set(rows.map(x=>x.url)).size!==830
  ||new Set(rows.map(x=>x.sha)).size!==813)
  throw Error('Exact official PDF URL or body census changed');
 return rows;
}

const INPUT=[
 'SELECT id,reg,year,url,sha,bytes,received_on,due_on,release_floor,',
 'estimated_on,observed_on,method,confidence',
 'FROM jsonb_to_recordset($1::jsonb)',
 'AS x(id text,reg text,year integer,url text,sha text,bytes integer,',
 'received_on date,due_on date,release_floor date,estimated_on date,',
 'observed_on date,method text,confidence text)'
].join(' ');
export const INSERT_SQL=[
 'INSERT INTO cfb_official_senate_pdf_versions',
 '(report_version_id,committee_registration,report_year,official_viewer_url,',
 'full_original_pdf_sha256,full_original_pdf_bytes,board_received_on,',
 'report_due_on,statutory_release_floor_on,estimated_available_on,',
 'website_observed_on,dating_method,dating_confidence)',
 'SELECT id,reg,year,url,sha,bytes,received_on,due_on,release_floor,',
 'estimated_on,observed_on,method,confidence FROM ('+INPUT+') input',
 'ON CONFLICT DO NOTHING'
].join(' ');
/** A mismatched existing row is a hard failure, not silently overwritten. */
export const VERIFY_SQL=[
 'WITH expected AS ('+INPUT+'), compared AS (',
 'SELECT e.id,p.report_version_id IS NOT NULL AS present,',
 '(p.committee_registration=e.reg AND p.report_year=e.year',
 'AND p.official_viewer_url=e.url AND p.full_original_pdf_sha256=e.sha',
 'AND p.full_original_pdf_bytes=e.bytes',
 'AND p.board_received_on IS NOT DISTINCT FROM e.received_on',
 'AND p.report_due_on IS NOT DISTINCT FROM e.due_on',
 'AND p.statutory_release_floor_on=e.release_floor',
 'AND p.estimated_available_on=e.estimated_on',
 'AND p.website_observed_on=e.observed_on',
 'AND p.dating_method=e.method AND p.dating_confidence=e.confidence',
 "AND p.historical_exact_version_public_by_proven=false) AS exact",
 'FROM expected e LEFT JOIN cfb_official_senate_pdf_versions p',
 'ON p.report_version_id=e.id)',
 "SELECT (SELECT count(*)::text FROM cfb_official_senate_pdf_versions) AS stored,",
 "count(*)::text AS indexed,",
 "count(*) FILTER (WHERE present AND exact)::text AS exact,",
 "count(*) FILTER (WHERE NOT present)::text AS missing,",
 "(SELECT count(DISTINCT full_original_pdf_sha256)::text",
 'FROM cfb_official_senate_pdf_versions) AS distinct_bodies',
 'FROM compared'
].join(' ');

const FAMILIES=[
 'CASE',
 "WHEN sd.source_kind='campaign_finance_candidate_contribution_bulk' AND ei.metadata->>'subtype'='candidate_contribution_record' THEN 'candidate_contribution'",
 "WHEN sd.source_kind='campaign_finance_candidate_expenditure_bulk' AND ei.metadata->>'subtype'='candidate_expenditure_record' THEN 'candidate_expenditure'",
 "WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' AND ei.metadata->>'subtype'='independent_expenditure_record' THEN 'independent_expenditure'",
 "WHEN sd.source_kind='campaign_finance_bulk' AND ei.metadata->>'subtype'='candidate_contribution_record' THEN 'candidate_contribution'",
 "WHEN sd.source_kind='campaign_finance_bulk' AND ei.metadata->>'subtype'='candidate_expenditure_record' THEN 'candidate_expenditure'",
 "ELSE 'category_mismatch' END"
].join(' ');
const KIND_SQL="'"+SOURCE_KINDS.join("','")+"'";
const YEAR_SQL="'"+YEARS.join("','")+"'";
const SCOPE_SQL="'"+SCOPES.join("','")+"'";
/**
 * PDF version ID matches prove identity references only; PDF transaction
 * containment still requires independent row-level proof. For ambiguous
 * committee-years only the EARLIEST possible release bound can be compared,
 * and that comparison is explicitly diagnostic, not a reason to auto-rewrite
 * eligibility. Independent expenditures never inherit principal PDFs.
 */
export const REVALIDATE_SQL=[
 'WITH versions AS (',
 'SELECT committee_registration,report_year,count(*) AS possibilities,',
 'min(statutory_release_floor_on) AS earliest_floor,',
 'min(estimated_available_on) AS earliest_estimate',
 'FROM cfb_official_senate_pdf_versions GROUP BY 1,2),',
 'typed AS (',
 'SELECT ei.metadata AS m,ei.published_at,',
 FAMILIES+' AS family,',
 "CASE WHEN c.slug='senate' THEN 'senate_member'",
 "WHEN c.slug IS NULL AND ei.metadata->>'chamber'='senate' THEN 'senate_metadata_only'",
 "ELSE 'outside_senate' END AS scope",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships mem ON mem.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=mem.chamber_id',
 'WHERE sd.source_kind IN ('+KIND_SQL+')',
 "AND ei.metadata->>'year' IN ("+YEAR_SQL+")",
 "AND ei.metadata->>'asOfEligible'='true'",
 '), matched AS (',
 'SELECT t.*,v.possibilities,v.earliest_floor,v.earliest_estimate,',
 'p.report_version_id AS exact_reference',
 'FROM typed t LEFT JOIN versions v',
 "ON t.family IN ('candidate_contribution','candidate_expenditure')",
 "AND v.committee_registration=t.m->>'filerRegistrationNumber'",
 "AND v.report_year::text=t.m->>'year'",
 'LEFT JOIN cfb_official_senate_pdf_versions p',
 "ON t.family IN ('candidate_contribution','candidate_expenditure')",
 "AND p.report_version_id=COALESCE(NULLIF(t.m->>'cfbReportVersionId',''),",
 "NULLIF(t.m->>'reportVersionId',''),NULLIF(t.m->>'sourceReportId',''),",
 "NULLIF(t.m->>'reportId',''))",
 "AND p.committee_registration=t.m->>'filerRegistrationNumber'",
 "AND p.report_year::text=t.m->>'year'",
 'WHERE t.scope IN ('+SCOPE_SQL+')',
 ') SELECT m->>\\'year\\' AS year,family,scope,',
 'count(*)::text AS eligible_copies,',
 'count(*) FILTER (WHERE possibilities IS NOT NULL)::text AS candidate_year_candidates,',
 'count(*) FILTER (WHERE possibilities=1)::text AS unique_candidate_pdf,',
 'count(*) FILTER (WHERE possibilities>1)::text AS ambiguous_candidate_pdfs,',
 "count(*) FILTER (WHERE family IN ('candidate_contribution','candidate_expenditure')",
 'AND possibilities IS NULL)::text AS no_candidate_pdf,',
 'count(*) FILTER (WHERE exact_reference IS NOT NULL)::text AS exact_version_reference,',
 'count(*) FILTER (WHERE exact_reference IS NULL)::text AS no_exact_version_reference,',
 'count(*) FILTER (WHERE possibilities IS NOT NULL AND published_at IS NOT NULL',
 "AND (published_at AT TIME ZONE 'America/Chicago')::date < earliest_floor)",
 '::text AS before_every_candidate_legal_floor,',
 'count(*) FILTER (WHERE possibilities IS NOT NULL AND published_at IS NOT NULL',
 "AND (published_at AT TIME ZONE 'America/Chicago')::date < earliest_estimate)",
 '::text AS before_every_candidate_estimate,',
 'count(*) FILTER (WHERE exact_reference IS NOT NULL AND published_at IS NOT NULL',
 "AND (published_at AT TIME ZONE 'America/Chicago')::date < earliest_floor)",
 '::text AS exact_reference_before_candidate_legal_floor,',
 "count(*) FILTER (WHERE m->>'filingDateDerivedAvailability'='true'",
 "OR m->>'availabilityProofKind'='cfb_report_filing')::text AS filing_derived_claims,",
 "count(*) FILTER (WHERE m->>'availabilityProof'='independent_archive_capture_exact_row')",
 '::text AS archived_disclosure_claims,',
 'count(*) FILTER (WHERE published_at IS NULL)::text AS missing_published_at,',
 "count(*) FILTER (WHERE NULLIF(m->>'reportDueOn','') IS NULL)",
 '::text AS missing_report_due_on',
 'FROM matched GROUP BY 1,2,3 ORDER BY 1,2,3'
].join(' ');
export const REVALIDATION_METRICS=[
 'eligible_copies','candidate_year_candidates','unique_candidate_pdf',
 'ambiguous_candidate_pdfs','no_candidate_pdf','exact_version_reference',
 'no_exact_version_reference','before_every_candidate_legal_floor',
 'before_every_candidate_estimate','exact_reference_before_candidate_legal_floor',
 'filing_derived_claims','archived_disclosure_claims',
 'missing_published_at','missing_report_due_on'
];
/** Prevent private database cell values from entering logs, Actions outputs or issues. */
export function safeRevalidation(rows){
 if(!Array.isArray(rows)||rows.length>45)throw Error('Unbounded eligibility result');
 const cols=['year','family','scope',...REVALIDATION_METRICS],seen=new Set();
 for(const row of rows){
  if(!row||Array.isArray(row)||typeof row!=='object'
   ||Object.keys(row).length!==cols.length
   ||Object.keys(row).some(k=>!cols.includes(k))
   ||!YEARS.includes(row.year)||!FINANCE_FAMILIES.includes(row.family)
   ||!SCOPES.includes(row.scope))throw Error('Unexpected or private eligibility column');
  const identity=[row.year,row.family,row.scope].join('|');
  if(seen.has(identity))throw Error('Duplicate eligibility grouping');
  seen.add(identity);
  for(const key of REVALIDATION_METRICS)
   if(typeof row[key]!=='string'||!/^\d+$/.test(row[key])
     ||!Number.isSafeInteger(Number(row[key]))||Number(row[key])>3_000_000)
    throw Error('Unsafe eligibility aggregate');
  const n=k=>Number(row[k]);
  if(n('exact_version_reference')+n('no_exact_version_reference')!==n('eligible_copies')
    ||n('unique_candidate_pdf')+n('ambiguous_candidate_pdfs')!==n('candidate_year_candidates')
    ||n('candidate_year_candidates')>n('eligible_copies')
    ||n('before_every_candidate_legal_floor')>n('candidate_year_candidates')
    ||n('exact_reference_before_candidate_legal_floor')>n('exact_version_reference'))
   throw Error('Contradictory eligibility count');
 }
 return rows;
}

/**
 * #864 V47 exact government filing inventory vs existing Neon source evidence.
 * All DB outputs are bounded year/family COUNTs; never donor, vendor, money,
 * source-document UUID, rowKey, URL or original private JSON.
 * CFB V46 dates are estimates and must NOT authorize retroactive eligibility.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {auditEveryOfficialCFBDocumentHasPracticalDateV46}
 from '../../scripts/audit-cfb-864-830-dated-availability-v46.mjs';

export const SCHEMA='cfb-864-source830-neon-finance-and-history-census-v47';
export const FINANCE_FAMILIES=['candidate_contribution','candidate_expenditure','independent_expenditure','category_mismatch'];
export const SCOPES=['senate_member','senate_metadata_only'];
export const YEARS=['2021','2022','2023','2024','2025'];
export const SOURCE_KINDS=[
 'campaign_finance_candidate_contribution_bulk',
 'campaign_finance_candidate_expenditure_bulk',
 'campaign_finance_independent_expenditure_bulk','campaign_finance_bulk'
];
const SHA=/^[a-f0-9]{64}$/;
const gitBlob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const isDate=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function source830(){
 const prior=auditEveryOfficialCFBDocumentHasPracticalDateV46();
 if(prior.datedDocuments!==830||prior.statutoryFloorEnforcedOnAll!==830)
  throw Error('CFB 830 original government PDF and date proof missing');
 const ledger=readFileSync('docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv','utf8');
 const raw=readFileSync('data/cfb-2021-25-830-estimated-availability-v46.json','utf8');
 if(gitBlob(ledger)!=='7955971a2b714a981a03ce3d93d4693a97e3ab3e'
   ||gitBlob(raw)!=='cf36b94566c94af4531c0e5ffb2698d761f9d811')
  throw Error('CFB original immutable source-ledger Git blob changed');
 const rows=ledger.trimEnd().split('\n').map(x=>x.split('|'));
 const availability=JSON.parse(raw).records;
 const dated=new Map(availability.map(x=>[x.id,x]));
 if(rows.length!==830||dated.size!==830)throw Error('Indexed PDF count mismatch');
 const seen=new Set(),indexed=[];
 for(const r of rows){
  const date=dated.get(r[0]),id=r[0],year=Number(r[2]);
  if(seen.has(id)||r.length!==19||!date||date.year!==year
    ||!YEARS.includes(String(year))||r[3]!==id.split(':')[0]
    ||!SHA.test(r[10])||r[10]!==date.sourceFullPdfSHA256
    ||!isDate(date.estimatedAvailableOn)||!isDate(date.releaseFloorOn)
    ||date.estimatedAvailableOn<date.releaseFloorOn
    ||date.independentlyProvenHistoricalExactVersionPublicBy!==false
    ||!r[9].startsWith('https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&'))
    throw Error('CFB source PDF identity or date not authenticated: '+id);
  indexed.push({id,reg:r[3],year,url:r[9],sha:r[10],
   release_floor:date.releaseFloorOn,estimated_on:date.estimatedAvailableOn,
   method:date.method});
  seen.add(id);
 }
 return indexed;
}
const KINDS="'"+SOURCE_KINDS.join("','")+"'";
const YEARS_SQL="'"+YEARS.join("','")+"'";
const FAMILY=[
 "CASE",
 " WHEN sd.source_kind='campaign_finance_candidate_contribution_bulk' AND ei.metadata->>'subtype'='candidate_contribution_record' THEN 'candidate_contribution'",
 " WHEN sd.source_kind='campaign_finance_candidate_expenditure_bulk' AND ei.metadata->>'subtype'='candidate_expenditure_record' THEN 'candidate_expenditure'",
 " WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk' AND ei.metadata->>'subtype'='independent_expenditure_record' THEN 'independent_expenditure'",
 " WHEN sd.source_kind='campaign_finance_bulk' AND ei.metadata->>'subtype'='candidate_contribution_record' THEN 'candidate_contribution'",
 " WHEN sd.source_kind='campaign_finance_bulk' AND ei.metadata->>'subtype'='candidate_expenditure_record' THEN 'candidate_expenditure'",
 " ELSE 'category_mismatch' END"
].join(' ');
const SCOPE=[
 "CASE WHEN c.slug='senate' THEN 'senate_member'",
 " WHEN c.slug IS NULL AND ei.metadata->>'chamber'='senate' THEN 'senate_metadata_only'",
 " ELSE 'outside_senate' END"
].join(' ');
const INPUT=[
 'SELECT id,reg,year,url,sha,release_floor,estimated_on',
 'FROM jsonb_to_recordset($1::jsonb)',
 'AS x(id text,reg text,year int,url text,sha text,release_floor text,estimated_on text,method text)'
].join(' ');

/** Exact PDF viewer URL or PDF SHA: not mere candidate-year association. */
export const INVENTORY_SQL=[
 'WITH expected AS ('+INPUT+'), matched AS (',
 'SELECT e.id,e.year,',
 'COALESCE(bool_or(sd.source_url=e.url),false) AS by_url,',
 'COALESCE(bool_or(sd.content_sha256=e.sha),false) AS by_sha,',
 'COALESCE(bool_or(sd.source_url=e.url AND sd.content_sha256=e.sha),false) AS matched_url_sha',
 'FROM expected e LEFT JOIN source_documents sd',
 'ON sd.source_url=e.url OR sd.content_sha256=e.sha GROUP BY e.id,e.year',
 ') SELECT year::text AS year, count(*)::text AS indexed_versions,',
 'count(*) FILTER (WHERE by_url)::text AS matched_pdf_url,',
 'count(*) FILTER (WHERE by_sha)::text AS matched_full_pdf_sha,',
 'count(*) FILTER (WHERE matched_url_sha)::text AS matched_both,',
 'count(*) FILTER (WHERE NOT by_url AND NOT by_sha)::text AS no_pdf_match,',
 'count(*) FILTER (WHERE by_url AND NOT by_sha)::text AS matched_url_wrong_sha',
 'FROM matched GROUP BY year ORDER BY year'
].join(' ');

/** Candidate registration-year evidence is not proof of exact PDF version. */
export const COMMITTEE_YEAR_SQL=[
 'WITH expected AS (SELECT DISTINCT reg,year FROM ('+INPUT+') src), observed AS (',
 "SELECT ei.metadata->>'filerRegistrationNumber' AS reg,",
 "(ei.metadata->>'year')::integer AS year,",
 "bool_or(ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')) AS contributions,",
 "bool_or(ei.metadata->>'subtype'='candidate_expenditure_record'",
 "AND sd.source_kind IN ('campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')) AS expenditures",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'JOIN memberships m ON m.id=ei.membership_id JOIN chambers c ON c.id=m.chamber_id',
 "WHERE c.slug='senate' AND sd.source_kind IN ("+KINDS+")",
 "AND ei.metadata->>'year' IN ("+YEARS_SQL+")",
 "AND NULLIF(ei.metadata->>'filerRegistrationNumber','') IS NOT NULL GROUP BY 1,2",
 ') SELECT e.year::text AS year, count(*)::text AS indexed_committee_years,',
 'count(*) FILTER (WHERE o.reg IS NOT NULL)::text AS candidate_years_with_stored_bulk,',
 'count(*) FILTER (WHERE coalesce(o.contributions,false))::text AS candidate_years_with_contributions,',
 'count(*) FILTER (WHERE coalesce(o.expenditures,false))::text AS candidate_years_with_expenditures,',
 'count(*) FILTER (WHERE o.reg IS NULL)::text AS candidate_years_without_stored_bulk',
 'FROM expected e LEFT JOIN observed o ON o.reg=e.reg AND o.year=e.year',
 'GROUP BY e.year ORDER BY e.year'
].join(' ');

const TYPED=[
 'SELECT ei.metadata AS m,ei.published_at,',
 FAMILY+' AS family, '+SCOPE+' AS scope',
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships mem ON mem.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=mem.chamber_id',
 'WHERE sd.source_kind IN ('+KINDS+')',
 "AND ei.metadata->>'year' IN ("+YEARS_SQL+")"
].join(' ');
const TARGET="'"+SCOPES.join("','")+"'";

/** Family-granular census, never a combined "total contributions" figure. */
export const FAMILY_SQL=[
 'WITH typed AS ('+TYPED+')',
 'SELECT m->>\'year\' AS year,family,scope,',
 'count(*)::text AS copies,',
 "count(DISTINCT NULLIF(m->>'rowKey',''))::text AS distinct_row_keys,",
 "count(*) FILTER (WHERE NULLIF(m->>'rowKey','') IS NULL)::text AS missing_row_keys,",
 "count(DISTINCT NULLIF(m->>'filerRegistrationNumber',''))::text AS candidate_registrations,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true')::text AS eligible_copies,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND published_at IS NOT NULL)::text AS eligible_dated",
 'FROM typed WHERE scope IN ('+TARGET+')',
 'GROUP BY 1,2,3 ORDER BY 1,2,3'
].join(' ');

/** Only explicit stored version IDs join an exact indexed original CFB PDF. */
export const ELIGIBILITY_SQL=[
 'WITH expected AS (SELECT id,reg,year,release_floor,estimated_on FROM ('+INPUT+') src),',
 'typed AS (SELECT base.m,base.published_at,base.family,base.scope,',
 "COALESCE(NULLIF(base.m->>'cfbReportVersionId',''),",
 "NULLIF(base.m->>'reportVersionId',''),NULLIF(base.m->>'sourceReportId',''),",
 "NULLIF(base.m->>'reportId','')) AS report_id FROM ("+TYPED+') base),',
 'scoped AS (SELECT t.m,t.published_at,t.family,t.scope,t.report_id,',
 'x.id AS matched_id,x.release_floor,x.estimated_on',
 'FROM typed t LEFT JOIN expected x ON x.id=t.report_id',
 "AND x.reg=t.m->>'filerRegistrationNumber' AND x.year::text=t.m->>'year'",
 'WHERE t.scope IN ('+TARGET+'))',
 "SELECT m->>'year' AS year,family,scope,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true')::text AS eligible_copies,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND matched_id IS NOT NULL)::text AS exact_version_matched,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND matched_id IS NULL)::text AS no_exact_version_match,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND report_id IS NULL)::text AS no_report_id,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND",
 " (coalesce(m->>'availabilityPolicyVersion','')='' OR m->>'availabilityPolicyVersion' ~ '^mn-cfb-report-availability-v[1-6]$'))::text AS legacy_or_unversioned,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND",
 " (m->>'filingDateDerivedAvailability'='true' OR m->>'availabilityProofKind'='cfb_report_filing'))::text AS filing_derived_claims,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND",
 " m->>'availabilityProof'='independent_archive_capture_exact_row')::text AS archived_bulk_claims,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND",
 " published_at IS NULL AND NULLIF(m->>'availableOn','') IS NULL)::text AS eligible_undated,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND",
 " NULLIF(m->>'reportDueOn','') IS NULL)::text AS eligible_no_due_date,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND matched_id IS NOT NULL",
 " AND published_at IS NOT NULL AND to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD') < release_floor)::text AS published_before_legal_floor,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND matched_id IS NOT NULL",
 " AND published_at IS NOT NULL AND to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD') < estimated_on)::text AS published_before_estimate,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND matched_id IS NOT NULL",
 " AND left(m->>'availableOn',10) ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'",
 " AND left(m->>'availableOn',10) < release_floor)::text AS metadata_before_legal_floor,",
 "count(*) FILTER (WHERE m->>'asOfEligible'='true' AND matched_id IS NOT NULL",
 " AND left(m->>'availableOn',10) ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'",
 " AND left(m->>'availableOn',10) < estimated_on)::text AS metadata_before_estimate",
 'FROM scoped GROUP BY 1,2,3 ORDER BY 1,2,3'
].join(' ');
export const QUERIES={inventory:INVENTORY_SQL,committee_years:COMMITTEE_YEAR_SQL,finance_families:FAMILY_SQL,historical_eligibility:ELIGIBILITY_SQL};
export const METRICS={
 inventory:['indexed_versions','matched_pdf_url','matched_full_pdf_sha','matched_both','no_pdf_match','matched_url_wrong_sha'],
 committee_years:['indexed_committee_years','candidate_years_with_stored_bulk','candidate_years_with_contributions','candidate_years_with_expenditures','candidate_years_without_stored_bulk'],
 finance_families:['copies','distinct_row_keys','missing_row_keys','candidate_registrations','eligible_copies','eligible_dated'],
 historical_eligibility:['eligible_copies','exact_version_matched','no_exact_version_match','no_report_id','legacy_or_unversioned','filing_derived_claims','archived_bulk_claims','eligible_undated','eligible_no_due_date','published_before_legal_floor','published_before_estimate','metadata_before_legal_floor','metadata_before_estimate']
};
/** Strict allowlist enforces that protected Neon logs contain COUNTS ONLY. */
export function safeCounts(key,rows){
 if(!Object.hasOwn(METRICS,key)||!Array.isArray(rows)||rows.length>50)
  throw Error('Unbounded or unknown Neon finance query');
 const grouping=key==='inventory'||key==='committee_years'?['year']:['year','family','scope'];
 const columns=[...grouping,...METRICS[key]],out=[],seen=new Set();
 for(const v of rows){
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==columns.length
   ||Object.keys(v).some(k=>!columns.includes(k))||!YEARS.includes(v.year))
   throw Error('Neon finance result contains unexpected private column/year');
  if(grouping.includes('family')&&!FINANCE_FAMILIES.includes(v.family))
   throw Error('Unknown finance classification in Neon');
  if(grouping.includes('scope')&&!SCOPES.includes(v.scope))
   throw Error('Unknown Senate source-membership scope');
  const identity=grouping.map(k=>v[k]).join('|');
  if(seen.has(identity))throw Error('Duplicate year/family/legislator-scope');
  seen.add(identity);
  for(const m of METRICS[key])
   if(typeof v[m]!=='string'||!/^\d+$/.test(v[m])||!Number.isSafeInteger(Number(v[m]))
     ||Number(v[m])>3_000_000)
    throw Error('Neon result contains sensitive data, out-of-range count or invalid metric');
  if(key==='inventory'&&(Number(v.matched_both)>Number(v.matched_pdf_url)
   ||Number(v.matched_both)>Number(v.matched_full_pdf_sha)
   ||Number(v.matched_url_wrong_sha)>Number(v.matched_pdf_url)
   ||Number(v.matched_pdf_url)+Number(v.no_pdf_match)>Number(v.indexed_versions)))
   throw Error('Source PDF reconciliation counts mathematically invalid');
  if(key==='finance_families'&&Number(v.distinct_row_keys)>Number(v.copies))
   throw Error('Distinct CFB transaction keys exceed stored copies');
  if(key==='historical_eligibility'&&
   Number(v.exact_version_matched)+Number(v.no_exact_version_match)!==Number(v.eligible_copies))
   throw Error('Exact version link accounting incomplete');
  out.push(v);
 }
 return out;
}

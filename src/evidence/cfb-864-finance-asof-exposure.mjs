/**
 * #864 strict historical campaign finance exposure census.
 *
 * Source evidence is not automatically a historical model feature. No rows,
 * amounts, contributor names, filer registrations, private URLs or row keys
 * leave the existing protected read-only runner; output is grouped counts.
 */
import { certifiedHistoricalFinanceAvailableOnSql }
  from '../evaluation/historical-finance-asof-proof.ts';

export const VERSION='senate864-finance-asof-exposure-v1';
export const MARKER='SENATE864_FINANCE_ASOF_EXPOSURE_READONLY_V1';
export const YEARS=['2021','2022','2023','2024','2025'];
export const FAMILIES=['candidate_contribution','candidate_expenditure','independent_expenditure'];
export const SCOPES=['senate_member','senate_metadata_only'];
export const METRICS=[
 'copies','canonical_transactions','eligible_copies','eligible_canonical_transactions',
 'eligible_dated_copies','eligible_missing_exact_publicby',
 'possible_pre_vote_copies','possible_pre_vote_canonical','possible_pre_vote_without_certification',
 'verified_pre_vote_admissible','pre_vote_candidate_year_earliest_floor_conflicts',
 'pre_vote_candidate_year_estimate_conflicts','pre_vote_after_observed_archive_copy',
 'pre_vote_before_transaction','archive_claim_pre_vote','filing_only_claim_pre_vote',
 'candidate_year_version_available','candidate_year_version_ambiguous',
 'with_exact_report_version_id','with_independent_verification_metadata',
 'missing_row_key','missing_entity_type'
];
const certified=certifiedHistoricalFinanceAvailableOnSql('ei');
const conditional=(condition)=>'count(*) FILTER (WHERE '+condition+')::text';
const countDistinct=(condition)=>'count(DISTINCT (reg,row_key)) FILTER (WHERE '+condition+')::text';
const eligible="m->>'asOfEligible'='true'";
const dated="published_at IS NOT NULL";
const beforeVote="published_at IS NOT NULL AND vote_latest IS NOT NULL AND (published_at AT TIME ZONE 'America/Chicago')::date < vote_latest";
const version="family IN ('candidate_contribution','candidate_expenditure') AND num_versions IS NOT NULL";
const financeKind=`CASE
 WHEN sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')
  AND ei.metadata->>'subtype'='candidate_contribution_record' THEN 'candidate_contribution'
 WHEN sd.source_kind IN ('campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')
  AND ei.metadata->>'subtype'='candidate_expenditure_record' THEN 'candidate_expenditure'
 WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk'
  AND ei.metadata->>'subtype'='independent_expenditure_record' THEN 'independent_expenditure'
 ELSE NULL END`;
const allowedKinds=`(
 (sd.source_kind='campaign_finance_candidate_contribution_bulk' AND ei.metadata->>'subtype'='candidate_contribution_record')
 OR (sd.source_kind='campaign_finance_candidate_expenditure_bulk' AND ei.metadata->>'subtype'='candidate_expenditure_record')
 OR (sd.source_kind='campaign_finance_independent_expenditure_bulk' AND ei.metadata->>'subtype'='independent_expenditure_record')
 OR (sd.source_kind='campaign_finance_bulk' AND ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record'))
)`;
export const EXPOSURE_SQL=`
WITH cutoff_memberships AS MATERIALIZED (
 SELECT mv.membership_id, max(ve.occurred_on::date) AS latest_vote
 FROM member_votes mv
 JOIN vote_events ve ON ve.id=mv.vote_event_id
 JOIN chambers c ON c.id=ve.chamber_id
 WHERE c.slug='senate' AND ve.is_passage=true
 AND ve.occurred_on >= DATE '2021-01-01'
 AND ve.occurred_on < DATE '2026-01-01'
 AND mv.choice IN ('yea','nay')
 GROUP BY mv.membership_id
), possible_versions AS MATERIALIZED (
 SELECT committee_registration,report_year,
 count(*)::int AS num_versions,
 min(statutory_release_floor_on) AS earliest_floor,
 min(estimated_available_on) AS earliest_estimate
 FROM cfb_official_senate_pdf_versions GROUP BY 1,2
), raw AS (
 SELECT ei.metadata AS m,ei.published_at,
 ${financeKind} AS family,
 CASE WHEN ch.slug='senate' THEN 'senate_member'
   WHEN ch.slug IS NULL AND ei.metadata->>'chamber'='senate' THEN 'senate_metadata_only'
   ELSE 'out_of_scope' END AS scope,
 CASE WHEN sd.source_kind='campaign_finance_independent_expenditure_bulk'
   THEN ei.metadata->>'spenderRegistrationNumber'
   ELSE ei.metadata->>'filerRegistrationNumber' END AS reg,
 nullif(ei.metadata->>'rowKey','') AS row_key,
 ei.metadata->>'year' AS year,
 vote.latest_vote AS vote_latest,
 version.num_versions,version.earliest_floor,version.earliest_estimate,
 ${certified} AS certified_on
 FROM evidence_items ei
 JOIN source_documents sd ON sd.id=ei.source_document_id
 LEFT JOIN memberships mem ON mem.id=ei.membership_id
 LEFT JOIN chambers ch ON ch.id=mem.chamber_id
 LEFT JOIN cutoff_memberships vote ON vote.membership_id=ei.membership_id
 LEFT JOIN possible_versions version
 ON sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk')
 AND version.committee_registration=ei.metadata->>'filerRegistrationNumber'
 AND version.report_year::text=ei.metadata->>'year'
 WHERE ${allowedKinds} AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')
), scoped AS (
 SELECT * FROM raw WHERE scope IN ('senate_member','senate_metadata_only')
)
SELECT year,family,scope,
 count(*)::text AS copies,
 ${countDistinct("row_key IS NOT NULL AND nullif(reg,'') IS NOT NULL")} AS canonical_transactions,
 ${conditional(eligible)} AS eligible_copies,
 ${countDistinct(eligible+" AND row_key IS NOT NULL AND nullif(reg,'') IS NOT NULL")} AS eligible_canonical_transactions,
 ${conditional(eligible+" AND "+dated)} AS eligible_dated_copies,
 ${conditional(eligible+" AND "+dated+" AND certified_on IS NULL")} AS eligible_missing_exact_publicby,
 ${conditional(eligible+" AND "+beforeVote)} AS possible_pre_vote_copies,
 ${countDistinct(eligible+" AND "+beforeVote+" AND row_key IS NOT NULL AND nullif(reg,'') IS NOT NULL")} AS possible_pre_vote_canonical,
 ${conditional(eligible+" AND "+beforeVote+" AND certified_on IS NULL")} AS possible_pre_vote_without_certification,
 ${conditional(eligible+" AND certified_on IS NOT NULL AND vote_latest IS NOT NULL AND certified_on::date < vote_latest")} AS verified_pre_vote_admissible,
 ${conditional(eligible+" AND "+beforeVote+" AND "+version+" AND (published_at AT TIME ZONE 'America/Chicago')::date < earliest_floor")} AS pre_vote_candidate_year_earliest_floor_conflicts,
 ${conditional(eligible+" AND "+beforeVote+" AND "+version+" AND (published_at AT TIME ZONE 'America/Chicago')::date < earliest_estimate")} AS pre_vote_candidate_year_estimate_conflicts,
 ${conditional(eligible+" AND "+beforeVote+" AND left(m->>'archiveCapturedAt',10) ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' AND to_char((published_at AT TIME ZONE 'America/Chicago')::date,'YYYY-MM-DD') < left(m->>'archiveCapturedAt',10)")} AS pre_vote_after_observed_archive_copy,
 ${conditional(eligible+" AND "+beforeVote+" AND m->>'transactionDate' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' AND to_char((published_at AT TIME ZONE 'America/Chicago')::date,'YYYY-MM-DD') < (m->>'transactionDate')")} AS pre_vote_before_transaction,
 ${conditional(eligible+" AND "+beforeVote+" AND m->>'availabilityProof'='independent_archive_capture_exact_row'")} AS archive_claim_pre_vote,
 ${conditional(eligible+" AND "+beforeVote+" AND (m->>'filingDateDerivedAvailability'='true' OR m->>'availabilityProofKind'='cfb_report_filing' OR m->>'availabilityPolicyVersion' ~ '^mn-cfb-report-availability-v[1-6]$')")} AS filing_only_claim_pre_vote,
 ${conditional(eligible+" AND "+version)} AS candidate_year_version_available,
 ${conditional(eligible+" AND "+version+" AND num_versions>1")} AS candidate_year_version_ambiguous,
 ${conditional(eligible+" AND COALESCE(NULLIF(m->>'cfbReportVersionId',''),NULLIF(m->>'reportVersionId',''),NULLIF(m->>'sourceReportId',''),NULLIF(m->>'reportId','')) IS NOT NULL")} AS with_exact_report_version_id,
 ${conditional(eligible+" AND m->>'historicalFinanceIndependentVerification'='authenticated_source_bytes_exact_row'")} AS with_independent_verification_metadata,
 ${conditional("row_key IS NULL")} AS missing_row_key,
 ${conditional("family='candidate_contribution' AND NULLIF(m->>'contributorType','') IS NULL")} AS missing_entity_type
FROM scoped GROUP BY year,family,scope ORDER BY year,family,scope
`;

export function aggregateOnly(rows) {
 if(!Array.isArray(rows)||rows.length>30)throw Error('Unexpected finance grouping size');
 const seen=new Set();
 return rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Unsafe aggregate');
  const keys=['year','family','scope',...METRICS];
  if(Object.keys(row).length!==keys.length||Object.keys(row).some(k=>!keys.includes(k))
    ||!YEARS.includes(row.year)||!FAMILIES.includes(row.family)||!SCOPES.includes(row.scope))
   throw Error('Unexpected aggregate column or group');
  const identity=[row.year,row.family,row.scope].join('|');
  if(seen.has(identity))throw Error('Duplicate aggregate group');
  seen.add(identity);
  const converted={year:row.year,family:row.family,scope:row.scope};
  for(const key of METRICS){
    const value=String(row[key]);
    if(!/^(0|[1-9][0-9]{0,9})$/.test(value))throw Error('Unsafe integer aggregate');
    converted[key]=Number(value);
    if(converted[key]>1000000)throw Error('Bounded audit count exceeded');
  }
  for(const key of METRICS)if(key!=='copies'&&converted[key]>converted.copies)
   throw Error('Aggregate exceeds source copies');
  return converted;
 });
}

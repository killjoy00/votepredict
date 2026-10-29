/** Descriptive retained-corpus audit. Never a training set or serving permission. */
import type {PoolClient} from 'pg';

export const COVERAGE_VERSION='senate-person-session-issue-coverage-v1';
export const ISSUE_CROSSWALK:Record<string,string>={
 agriculture:'agriculture',commerce:'commerce_consumer',education:'education',
 elections:'elections',environment:'environment_natural_resources',health:'health',
 housing:'housing',human_services:'human_services',judiciary:'judiciary_civil_law',
 labor:'labor_employment',local_government:'local_government',public_safety:'public_safety',
 state_government:'state_government',taxes:'taxes_revenue',transportation:'transportation'
};
const issueValues=Object.entries(ISSUE_CROSSWALK).map(([a,b])=>`('${a}','${b}')`).join(',');

// Mirrors the website research contract, without interpreting stance. Date-only
// votes use midnight UTC: all same-day observations are conservatively excluded.
// Malformed clocks fail the audit rather than silently becoming admissible.
export const WEBSITE_PROOF_SQL=`
 sd.content_sha256 ~ '^[a-f0-9]{64}$'
 AND e.extraction_version='senate-864-literal-website-observed-asof-v1'
 AND e.excerpt IS NOT NULL AND length(e.excerpt)>0
 AND e.metadata->'experimentalWebsiteTextForHistoricalEvaluation'='true'::jsonb
 AND e.metadata->'mechanicallyActionable'='false'::jsonb
 AND e.metadata->'asOfEligible'='true'::jsonb
 AND e.metadata->>'availabilityProof'='original_site_html_cdx_index_in_existing_research'
 AND sd.metadata->>'availabilityProof'='archived_original_html_plus_cdx_research_ledger'
 AND sd.metadata->>'archiveCapturedAt'=e.metadata->>'archiveCapturedAt'
 AND sd.metadata->>'originalCdxSha1Base32' ~ '^[A-Z2-7]{32}$'
 AND e.published_at=(e.metadata->>'archiveCapturedAt')::timestamptz`;

export const SENATE_COVERAGE_SQL=`
WITH crosswalk(tag,issue) AS (VALUES ${issueValues}),
 issues AS (SELECT issue FROM crosswalk UNION SELECT 'unmapped_issue'),
 roster AS MATERIALIZED (
 SELECT m.id,m.legislator_id,m.session_id,s.slug AS session,l.external_key AS person_key,
 l.name AS senator,m.district,m.starts_on,m.ends_on
 FROM memberships m JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
 JOIN legislative_sessions s ON s.id=m.session_id
 JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
 JOIN legislators l ON l.id=m.legislator_id
 WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
), events AS MATERIALIZED (
 SELECT v.* FROM vote_events v JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'
 JOIN legislative_sessions s ON s.id=v.session_id
 JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
 JOIN source_documents d ON d.id=v.source_document_id
 WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
 AND (d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'
 OR d.source_url LIKE 'https://www.senate.mn/journals/%')
), bill_issues AS MATERIALIZED (
 SELECT DISTINCT bv.bill_id,c.issue
 FROM bill_versions bv JOIN bill_feature_sets f ON f.bill_version_id=bv.id
 CROSS JOIN LATERAL jsonb_array_elements_text(f.features->'policyAreas') p(tag)
 JOIN crosswalk c ON c.tag=p.tag
 WHERE f.feature_schema_version='bill-features-v2' AND f.extractor_kind='deterministic'
 AND f.extractor_version='deterministic-v2.1'
), event_issues AS MATERIALIZED (
 SELECT v.id,v.session_id,v.bill_id,v.occurred_on,coalesce(b.issue,'unmapped_issue') AS issue
 FROM events v LEFT JOIN bill_issues b ON b.bill_id=v.bill_id
), website AS MATERIALIZED (
 SELECT m.legislator_id,e.bill_id,coalesce(c.issue,'unmapped_issue') AS issue,
 e.excerpt,e.published_at,coalesce((${WEBSITE_PROOF_SQL}),false) AS proof_ok
 FROM evidence_items e JOIN memberships m ON m.id=e.membership_id
 JOIN source_documents sd ON sd.id=e.source_document_id
 LEFT JOIN crosswalk c ON c.issue=e.metadata->>'issueTag'
 WHERE e.extraction_version='senate-864-literal-website-observed-asof-v1'
 AND EXISTS(SELECT 1 FROM roster r WHERE r.legislator_id=m.legislator_id)
), context AS MATERIALIZED (
 SELECT m.legislator_id,c.issue,e.excerpt
 FROM evidence_items e JOIN memberships m ON m.id=e.membership_id
 JOIN crosswalk c ON c.issue=e.metadata->>'policyFamily'
 WHERE e.extraction_version='issue-position-v1'
 AND EXISTS(SELECT 1 FROM roster r WHERE r.legislator_id=m.legislator_id)
), website_counts AS (
 SELECT legislator_id,issue,count(*)::int AS website_copies,
 count(DISTINCT excerpt)::int AS website_literals,
 count(DISTINCT excerpt) FILTER(WHERE proof_ok)::int AS proof_qualified_literals
 FROM website GROUP BY legislator_id,issue
), context_counts AS (
 SELECT legislator_id,issue,count(DISTINCT excerpt)::int AS context_literals
 FROM context GROUP BY legislator_id,issue
), website_ready AS MATERIALIZED (
 SELECT legislator_id,issue,min(published_at) AS available_at FROM website
 WHERE proof_ok AND bill_id IS NULL AND issue<>'unmapped_issue'
 GROUP BY legislator_id,issue
), website_bill_ready AS MATERIALIZED (
 SELECT legislator_id,issue,bill_id,min(published_at) AS available_at FROM website
 WHERE proof_ok AND bill_id IS NOT NULL AND issue<>'unmapped_issue'
 GROUP BY legislator_id,issue,bill_id
), vote_counts AS (
 SELECT r.id,x.issue,count(*)::int AS recorded_member_events,
 count(*) FILTER(WHERE mv.choice IN ('yea','nay'))::int AS binary_member_events,
 count(*) FILTER(WHERE least(w.available_at,wb.available_at)
  < (x.occurred_on::timestamp AT TIME ZONE 'UTC'))::int AS member_events_with_prevote_website
 FROM roster r JOIN member_votes mv ON mv.membership_id=r.id
 JOIN event_issues x ON x.id=mv.vote_event_id AND x.session_id=r.session_id
 LEFT JOIN website_ready w ON w.legislator_id=r.legislator_id AND w.issue=x.issue
 LEFT JOIN website_bill_ready wb ON wb.legislator_id=r.legislator_id
  AND wb.issue=x.issue AND wb.bill_id=x.bill_id
 WHERE (r.starts_on IS NULL OR x.occurred_on>=r.starts_on)
 AND (r.ends_on IS NULL OR x.occurred_on<=r.ends_on)
 GROUP BY r.id,x.issue
)
SELECT r.person_key,r.senator,r.session,r.district,i.issue,
 coalesce(v.recorded_member_events,0) AS recorded_member_events,
 coalesce(v.binary_member_events,0) AS binary_member_events,
 coalesce(v.member_events_with_prevote_website,0) AS member_events_with_prevote_website,
 coalesce(w.website_copies,0) AS retained_website_copies,
 coalesce(w.website_literals,0) AS retained_website_literals,
 coalesce(w.proof_qualified_literals,0) AS proof_qualified_website_literals,
 coalesce(c.context_literals,0) AS retained_context_literals
FROM roster r CROSS JOIN issues i
LEFT JOIN vote_counts v ON v.id=r.id AND v.issue=i.issue
LEFT JOIN website_counts w ON w.legislator_id=r.legislator_id AND w.issue=i.issue
LEFT JOIN context_counts c ON c.legislator_id=r.legislator_id AND c.issue=i.issue
ORDER BY r.session,r.person_key,i.issue LIMIT 10001`;

/** Independent denominators; multi-issue cell counts intentionally overlap. */
export const COVERAGE_DENOMINATORS_SQL=`
WITH scoped AS MATERIALIZED (
 SELECT v.*,s.slug AS session,d.source_url,d.source_kind,d.metadata AS source_metadata
 FROM vote_events v JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'
 JOIN legislative_sessions s ON s.id=v.session_id
 JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
 JOIN source_documents d ON d.id=v.source_document_id
 WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
), labeled AS (
 SELECT *,CASE WHEN source_url LIKE 'https://www.senate.mn/journals/%'
 OR source_metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'
 THEN 'senate_journal' WHEN source_kind IN
 ('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf')
 OR source_metadata#>>'{rawPrepassageVotes,sourceType}' IN
 ('mn_senate_committee_minutes_html','mn_senate_committee_minutes_pdf')
 THEN 'committee_minutes' ELSE 'other_source' END AS source_family FROM scoped
)
SELECT session,source_family,count(*)::int AS events,
 (SELECT count(*)::int FROM member_votes mv JOIN labeled v2 ON v2.id=mv.vote_event_id
 WHERE v2.session=v.session AND v2.source_family=v.source_family) AS member_choices,
 count(*) FILTER(WHERE bill_id IS NULL)::int AS unresolved_bill_events,
 (SELECT count(*)::int FROM memberships m JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
 JOIN legislative_sessions s ON s.id=m.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id
 AND j.slug='us-mn' WHERE s.slug=v.session) AS roster_memberships,
 (SELECT count(*)::int FROM member_votes mv JOIN labeled v2 ON v2.id=mv.vote_event_id
 LEFT JOIN memberships m ON m.id=mv.membership_id
 WHERE v2.session=v.session AND v2.source_family=v.source_family
 AND (m.id IS NULL OR m.session_id<>v2.session_id OR m.chamber_id<>v2.chamber_id
 OR (m.starts_on IS NOT NULL AND v2.occurred_on<m.starts_on)
 OR (m.ends_on IS NOT NULL AND v2.occurred_on>m.ends_on))) AS unresolved_or_out_of_term_choices
FROM labeled v GROUP BY session,source_family ORDER BY session,source_family`;

export interface CoverageCell {
 person_key:string;senator:string;session:string;district:string;issue:string;
 recorded_member_events:number;binary_member_events:number;member_events_with_prevote_website:number;
 retained_website_copies:number;retained_website_literals:number;
 proof_qualified_website_literals:number;retained_context_literals:number;
}
export interface CoverageDenominator {
 session:string;source_family:string;events:number;member_choices:number;
 unresolved_bill_events:number;roster_memberships:number;unresolved_or_out_of_term_choices:number;
}
export function verifyCoverage(cells:CoverageCell[],denominators:CoverageDenominator[]):void {
 const issues=new Set([...Object.values(ISSUE_CROSSWALK),'unmapped_issue']);
 if(!cells.length||cells.length>=10001||!denominators.length)throw Error('Coverage empty or truncated');
 const seen=new Set<string>(),members=new Map<string,Set<string>>();
 for(const c of cells){
  const key=JSON.stringify([c.person_key,c.session,c.issue]);
  if(seen.has(key)||!issues.has(c.issue)||!['2021-2022','2023-2024','2025-2026'].includes(c.session))
   throw Error('Coverage duplicate identity or invalid dimension');
  seen.add(key);
  for(const field of ['recorded_member_events','binary_member_events','member_events_with_prevote_website',
   'retained_website_copies','retained_website_literals','proof_qualified_website_literals','retained_context_literals'] as const)
   if(!Number.isSafeInteger(c[field])||c[field]<0)throw Error('Invalid coverage count');
  if(c.binary_member_events>c.recorded_member_events||c.member_events_with_prevote_website>c.recorded_member_events
   ||c.proof_qualified_website_literals>c.retained_website_literals||c.retained_website_literals>c.retained_website_copies)
   throw Error('Coverage subset exceeds denominator');
  const group=c.session+'|'+c.person_key,found=members.get(group)??new Set();found.add(c.issue);members.set(group,found);
 }
 for(const found of members.values())if(found.size!==issues.size)throw Error('Coverage missing issue cells');
 for(const session of ['2021-2022','2023-2024','2025-2026']){
  const d=denominators.filter(x=>x.session===session);
  if(!d.length||new Set(d.map(x=>x.source_family)).size!==d.length)throw Error('Coverage missing/duplicate population');
  for(const row of d){
   if(!['senate_journal','committee_minutes','other_source'].includes(row.source_family)
    ||Object.entries(row).some(([k,v])=>!['session','source_family'].includes(k)&&(!Number.isSafeInteger(v)||Number(v)<0))
    ||row.unresolved_bill_events>row.events||row.unresolved_or_out_of_term_choices>row.member_choices)
    throw Error('Invalid independent coverage denominator');
  }
  const roster=new Set(cells.filter(c=>c.session===session).map(c=>c.person_key));
  if(d.some(x=>x.roster_memberships!==roster.size))throw Error('Coverage roster denominator mismatch');
  const floor=d.find(x=>x.source_family==='senate_journal');
  if(!floor)throw Error('Missing original Journal denominator');
  // At least one mapped/unmapped issue cell must account for each valid floor
  // member choice. Multiple policy areas can add assignments, never erase rows.
  const assigned=cells.filter(c=>c.session===session).reduce((n,c)=>n+c.recorded_member_events,0);
  if(assigned<floor.member_choices-floor.unresolved_or_out_of_term_choices)
   throw Error('Coverage lost floor member choices');
 }
}
export async function readSenateCoverage(db:PoolClient) {
 const cells=(await db.query<CoverageCell>(SENATE_COVERAGE_SQL)).rows;
 const denominators=(await db.query<CoverageDenominator>(COVERAGE_DENOMINATORS_SQL)).rows;
 verifyCoverage(cells,denominators);return {cells,denominators};
}

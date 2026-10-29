/** Read-only, population-wide accepted vote -> official paper coverage audit.
 * Source text, member ballots, private UUIDs, SQL parameters and source URLs
 * never leave the protected Neon transaction. No event or model mutations.
 */
import type {Pool,PoolClient} from 'pg';

export const VOTE_TEXT_GAP_AUDIT_VERSION='senate-vote-text-gap-v1' as const;

export interface VoteTextGapGroup {
 session:string;vote_kind:string;source_family:string;evidence_stage:string;event_count:number;
 exact_proposed_text:number;exact_explicit_base:number;exact_captured_base:number;
 exact_in_journal_prior_adoptions:number;exact_verified_original:number;
}
export interface VoteTextGapExample {
 session:string;vote_kind:string;source_family:string;evidence_stage:string;
 bill:string;vote_day:string;event_count:number;
}
export interface VoteTextGapAudit {
 schemaVersion:typeof VOTE_TEXT_GAP_AUDIT_VERSION;
 auditedEvents:number;groups:VoteTextGapGroup[];examples:VoteTextGapExample[];
 hf100Pilot:Array<{vote_kind:string;source_family:string;evidence_stage:string;event_count:number;exact_captured_base:number}>;
}
export interface ExistingCoverageRow {
 session:string;vote_kind:string;official_events:string|number;exact_question_links:string|number;
}
export const VOTE_TEXT_GAP_SQL="\nWITH source_votes AS MATERIALIZED (\n SELECT v.id, v.bill_id, v.vote_kind, v.occurred_on, d.source_url,\n        s.slug AS session,\n        CASE\n         WHEN d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'\n           OR d.source_url LIKE 'https://www.senate.mn/journals/%'\n         THEN 'senate_journal'\n         WHEN d.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf')\n           OR d.metadata#>>'{rawPrepassageVotes,sourceType}' IN\n             ('mn_senate_committee_minutes_html','mn_senate_committee_minutes_pdf')\n         THEN 'committee_minutes'\n         ELSE 'other_source'\n        END AS source_family,\n        CASE WHEN b.identifier ~ '^(HF|SF)[1-9][0-9]{0,5}$'\n          THEN b.identifier ELSE NULL END AS public_bill\n FROM vote_events v\n JOIN chambers ch ON ch.id=v.chamber_id AND ch.slug='senate'\n JOIN legislative_sessions s ON s.id=v.session_id\n JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'\n JOIN source_documents d ON d.id=v.source_document_id\n LEFT JOIN bills b ON b.id=v.bill_id\n WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')\n), current_papers AS MATERIALIZED (\n SELECT id,bill_id,occurred_on,source_url\n FROM senate_vote_paper_current_v\n), bills_with_papers AS MATERIALIZED (\n SELECT DISTINCT bill_id FROM current_papers\n), bill_days_with_papers AS MATERIALIZED (\n SELECT DISTINCT bill_id,occurred_on FROM current_papers\n), bill_source_days_with_papers AS MATERIALIZED (\n SELECT DISTINCT bill_id,occurred_on,source_url FROM current_papers\n), exact AS MATERIALIZED (\n SELECT a.vote_event_id,\n   bool_or(a.proposed_text IS NOT NULL) AS has_proposal,\n   bool_or(a.explicit_base_locator IS NOT NULL) AS has_explicit_base,\n   bool_or(coalesce(jsonb_array_length(a.prior_adopted_action_keys),0)>0) AS has_in_journal_prior_adoptions,\n   bool_or(a.original_source_verified) AS verified_original,\n   bool_or(c.action_id IS NOT NULL) AS has_captured_explicit_base\n FROM senate_vote_paper_exact_event_v a\n LEFT JOIN (\n  SELECT DISTINCT action_id FROM senate_vote_paper_components_current_v\n ) c ON c.action_id=a.id\n GROUP BY a.vote_event_id\n), event_cases AS MATERIALIZED (\n SELECT e.session,e.vote_kind,e.source_family,e.occurred_on,e.public_bill,\n  CASE\n   WHEN x.vote_event_id IS NOT NULL THEN 'exact_question'\n   WHEN e.bill_id IS NULL THEN 'no_resolved_bill'\n   WHEN pd.bill_id IS NOT NULL THEN 'same_source_day_bill_unlinked'\n   WHEN bd.bill_id IS NOT NULL THEN 'same_bill_day_other_source'\n   WHEN pb.bill_id IS NOT NULL THEN 'bill_papers_on_other_dates'\n   ELSE 'no_parsed_paper_for_bill'\n  END AS evidence_stage,\n  coalesce(x.has_proposal,false) AS has_proposal,\n  coalesce(x.has_explicit_base,false) AS has_explicit_base,\n  coalesce(x.has_in_journal_prior_adoptions,false) AS has_in_journal_prior_adoptions,\n  coalesce(x.verified_original,false) AS verified_original,\n  coalesce(x.has_captured_explicit_base,false) AS has_captured_explicit_base\n FROM source_votes e\n LEFT JOIN exact x ON x.vote_event_id=e.id\n LEFT JOIN bill_source_days_with_papers pd\n   ON pd.bill_id=e.bill_id AND pd.occurred_on=e.occurred_on AND pd.source_url=e.source_url\n LEFT JOIN bill_days_with_papers bd\n   ON bd.bill_id=e.bill_id AND bd.occurred_on=e.occurred_on\n LEFT JOIN bills_with_papers pb ON pb.bill_id=e.bill_id\n), grouped AS (\n SELECT session,vote_kind,source_family,evidence_stage,\n   count(*)::int AS event_count,\n   count(*) FILTER (WHERE has_proposal)::int AS exact_proposed_text,\n   count(*) FILTER (WHERE has_explicit_base)::int AS exact_explicit_base,\n   count(*) FILTER (WHERE has_captured_explicit_base)::int AS exact_captured_base,\n   count(*) FILTER (WHERE has_in_journal_prior_adoptions)::int AS exact_in_journal_prior_adoptions,\n   count(*) FILTER (WHERE verified_original)::int AS exact_verified_original\n FROM event_cases\n GROUP BY session,vote_kind,source_family,evidence_stage\n), examples AS (\n SELECT session,vote_kind,source_family,evidence_stage,public_bill AS bill,\n    occurred_on::text AS vote_day,count(*)::int AS event_count\n FROM event_cases\n WHERE evidence_stage<>'exact_question'\n   AND vote_kind IN ('passage','amendment')\n   AND public_bill IS NOT NULL\n GROUP BY session,vote_kind,source_family,evidence_stage,public_bill,occurred_on\n ORDER BY CASE WHEN source_family='senate_journal' THEN 0 ELSE 1 END,\n   count(*) DESC,session,vote_kind,public_bill,occurred_on\n LIMIT 18\n), hf100_pilot AS (\n SELECT vote_kind,source_family,evidence_stage,count(*)::int AS event_count,\n    count(*) FILTER (WHERE has_captured_explicit_base)::int AS exact_captured_base\n FROM event_cases\n WHERE session='2023-2024' AND public_bill='HF100' AND occurred_on='2023-04-28'\n GROUP BY vote_kind,source_family,evidence_stage\n)\nSELECT (SELECT count(*)::int FROM event_cases) AS audited_events,\n coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.session,g.vote_kind,g.source_family,g.evidence_stage)\n           FROM grouped g),'[]'::jsonb) AS gap_groups,\n coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.event_count DESC,e.session,e.vote_kind,e.bill,e.vote_day)\n           FROM examples e),'[]'::jsonb) AS case_examples,\n coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.vote_kind,p.source_family,p.evidence_stage)\n           FROM hf100_pilot p),'[]'::jsonb) AS hf100_pilot\n";

/** Caller MUST hold an independently verified REPEATABLE READ READ ONLY transaction. */
export async function readVoteTextGapAudit(db:PoolClient|Pool):Promise<VoteTextGapAudit> {
 const result=await db.query<{
  audited_events:number;gap_groups:VoteTextGapGroup[];
  case_examples:VoteTextGapExample[];hf100_pilot:VoteTextGapAudit['hf100Pilot'];
 }>(VOTE_TEXT_GAP_SQL);
 const row=result.rows[0];
 if(!row||!Array.isArray(row.gap_groups)||!Array.isArray(row.case_examples)
   ||!Array.isArray(row.hf100_pilot))throw Error('Vote-paper gap audit missing typed readback');
 return {schemaVersion:VOTE_TEXT_GAP_AUDIT_VERSION,
  auditedEvents:row.audited_events,groups:row.gap_groups,
  examples:row.case_examples,hf100Pilot:row.hf100_pilot};
}
/** Fail closed if every official vote isn't counted once, or exact match counts drift. */
export function verifyVoteTextGapAudit(audit:VoteTextGapAudit,baseline:ExistingCoverageRow[]):void {
 const counts=new Map<string,{events:number;exact:number}>();
 for(const g of audit.groups){
  if(!Number.isSafeInteger(g.event_count)||g.event_count<1
    ||![g.exact_proposed_text,g.exact_explicit_base,g.exact_captured_base,
      g.exact_in_journal_prior_adoptions,g.exact_verified_original].every(
       n=>Number.isSafeInteger(n)&&n>=0&&n<=g.event_count))
   throw Error('Invalid vote-paper gap group count');
  if(g.evidence_stage!=='exact_question'
    && (g.exact_proposed_text||g.exact_explicit_base||g.exact_captured_base
      ||g.exact_in_journal_prior_adoptions||g.exact_verified_original))
   throw Error('Non-exact paper evidence incorrectly promoted');
  const key=g.session+'|'+g.vote_kind;
  const previous=counts.get(key)??{events:0,exact:0};
  previous.events+=g.event_count;
  if(g.evidence_stage==='exact_question')previous.exact+=g.event_count;
  counts.set(key,previous);
 }
 if(!Number.isSafeInteger(audit.auditedEvents)||audit.auditedEvents<1
   ||[...counts.values()].reduce((sum,r)=>sum+r.events,0)!==audit.auditedEvents)
  throw Error('Vote-paper audit total does not balance');
 if(counts.size!==baseline.length)throw Error('Vote-paper audit session/kind denominator mismatch');
 for(const row of baseline){
  const got=counts.get(row.session+'|'+row.vote_kind);
  if(!got||got.events!==Number(row.official_events)
    ||got.exact!==Number(row.exact_question_links))
   throw Error('Vote-paper audit failed exact official-event reconciliation');
 }
 if(audit.examples.length>18||audit.examples.some(e=>
   !/^(HF|SF)[1-9][0-9]{0,5}$/.test(e.bill)
   ||!/^(?:2021|2022|2023|2024|2025|2026)-\d{2}-\d{2}$/.test(e.vote_day)
   ||e.evidence_stage==='exact_question'))
  throw Error('Vote-paper audit attempted to emit an unsafe case example');
}

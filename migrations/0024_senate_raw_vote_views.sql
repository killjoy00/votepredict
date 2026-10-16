-- Read-only projection of Senate raw pre-passage votes, using the existing
-- session-scoped member and bill mention crosswalks. No backfill or inference.
-- SQL views do not guarantee output order; callers ORDER BY occurred_on.

CREATE OR REPLACE VIEW public.senate_raw_vote_records_v AS
SELECT
  d.id AS source_document_id,
  ord.record_ordinal,
  raw->>'sourceType' AS source_type,
  raw->>'sessionSlug' AS session_slug,
  rec.item->>'venue' AS venue,
  COALESCE(rec.item->>'committee', raw#>>'{hearing,committeeName}', raw->>'committeeName') AS committee,
  NULLIF(raw->>'sourceDate','')::date AS occurred_on,
  rec.item->>'billIdentifier' AS bill_identifier_raw,
  bm.bill_id,
  rec.item->>'voteKind' AS vote_kind,
  rec.item->>'amendmentRef' AS amendment_ref,
  rec.item->>'mover' AS mover_raw,
  mm.membership_id AS mover_membership_id,
  rec.item->>'method' AS method,
  rec.item->>'outcome' AS outcome,
  NULLIF(rec.item->>'yeaCount','')::integer AS yea_count,
  NULLIF(rec.item->>'nayCount','')::integer AS nay_count,
  (rec.item->>'namesMatchTally')::boolean AS names_match_tally,
  rec.item->>'motionText' AS motion_text,
  d.source_url
FROM public.source_documents AS d
CROSS JOIN LATERAL (SELECT d.metadata->'rawPrepassageVotes' AS raw) AS payload
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(raw->'records') = 'array'
    THEN raw->'records' ELSE '[]'::jsonb END
) WITH ORDINALITY AS rec(item, position)
CROSS JOIN LATERAL (
  SELECT COALESCE(
    CASE WHEN rec.item->>'ordinal' ~ '^[0-9]{1,9}$'
      THEN (rec.item->>'ordinal')::integer END,
    rec.position::integer
  ) AS record_ordinal
) AS ord
LEFT JOIN public.senate_raw_vote_bill_mentions AS bm
  ON bm.source_document_id = d.id AND bm.record_ordinal = ord.record_ordinal
LEFT JOIN public.senate_raw_vote_member_mentions AS mm
  ON mm.source_document_id = d.id AND mm.record_ordinal = ord.record_ordinal
  AND mm.role = 'mover' AND mm.name_ordinal = 0
WHERE raw->>'sourceType' IN ('mn_senate_committee_minutes_html', 'mn_senate_journal');

CREATE OR REPLACE VIEW public.senate_raw_member_votes_v AS
SELECT
  d.id AS source_document_id,
  ord.record_ordinal,
  (voter.position - 1)::integer AS name_ordinal,
  voter.item->>'name' AS name_raw,
  voter.item->>'choice' AS choice,
  vm.membership_id,
  vm.match_method
FROM public.source_documents AS d
CROSS JOIN LATERAL (SELECT d.metadata->'rawPrepassageVotes' AS raw) AS payload
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(raw->'records') = 'array'
    THEN raw->'records' ELSE '[]'::jsonb END
) WITH ORDINALITY AS rec(item, position)
CROSS JOIN LATERAL (
  SELECT COALESCE(
    CASE WHEN rec.item->>'ordinal' ~ '^[0-9]{1,9}$'
      THEN (rec.item->>'ordinal')::integer END,
    rec.position::integer
  ) AS record_ordinal
) AS ord
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(rec.item->'memberVotes') = 'array'
    THEN rec.item->'memberVotes' ELSE '[]'::jsonb END
) WITH ORDINALITY AS voter(item, position)
LEFT JOIN public.senate_raw_vote_member_mentions AS vm
  ON vm.source_document_id = d.id AND vm.record_ordinal = ord.record_ordinal
  AND vm.role = 'voter' AND vm.name_ordinal = (voter.position - 1)::integer
WHERE raw->>'sourceType' IN ('mn_senate_committee_minutes_html', 'mn_senate_journal');

-- bill_id is the requested root bill; matched_bill_id is the bill actually
-- printed on this event. Companion paths are explicit bill_companions rows.
-- Both official and raw events are retained even when they describe one vote.
CREATE OR REPLACE VIEW public.senate_vote_trail_v AS
WITH paths AS (
  SELECT b.id AS bill_id, b.id AS matched_bill_id, false AS via_companion
  FROM public.bills b
  JOIN public.legislative_sessions s ON s.id = b.session_id
  JOIN public.jurisdictions j ON j.id = s.jurisdiction_id
  WHERE j.slug = 'us-mn'
    AND s.slug IN ('2021-2022', '2023-2024', '2025-2026')
  UNION ALL
  SELECT bc.senate_bill_id, bc.house_bill_id, true
  FROM public.bill_companions bc
  UNION ALL
  SELECT bc.house_bill_id, bc.senate_bill_id, true
  FROM public.bill_companions bc
)
SELECT
  p.bill_id, p.matched_bill_id, p.via_companion,
  'raw'::text AS entry_source,
  r.source_document_id,
  r.record_ordinal,
  NULL::uuid AS vote_event_id,
  r.source_type,
  r.occurred_on,
  r.venue,
  r.committee,
  'senate'::text AS chamber,
  r.bill_identifier_raw,
  r.vote_kind,
  r.amendment_ref,
  r.method,
  r.outcome,
  r.yea_count,
  r.nay_count,
  r.motion_text,
  r.source_url
FROM paths p
JOIN public.senate_raw_vote_records_v r ON r.bill_id = p.matched_bill_id
UNION ALL
SELECT
  p.bill_id, p.matched_bill_id, p.via_companion,
  'official'::text AS entry_source,
  v.source_document_id,
  NULL::integer AS record_ordinal,
  v.id AS vote_event_id,
  sd.source_kind AS source_type,
  v.occurred_on,
  NULL::text AS venue,
  NULL::text AS committee,
  c.slug AS chamber,
  b.identifier AS bill_identifier_raw,
  v.vote_kind,
  v.amendment_ref,
  NULL::text AS method,
  CASE WHEN v.passed IS TRUE THEN 'passed'
    WHEN v.passed IS FALSE THEN 'failed' ELSE NULL END AS outcome,
  v.yea_count,
  v.nay_count,
  v.motion_text,
  sd.source_url
FROM paths p
JOIN public.vote_events v ON v.bill_id = p.matched_bill_id
JOIN public.source_documents sd ON sd.id = v.source_document_id
JOIN public.chambers c ON c.id = v.chamber_id
JOIN public.bills b ON b.id = v.bill_id;

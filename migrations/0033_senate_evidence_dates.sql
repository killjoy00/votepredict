-- Earlier, still conservative "public by" dates for evidence senate_evidence_v
-- could only date by this project's fetch date. Additive; source tables unchanged.

-- Authors named on a Senate journal "Senators ... introduced-- S.F. No. N" line,
-- dated to that journal. Parsed from the stored journal text.
CREATE TABLE IF NOT EXISTS senate_bill_introduction_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id),
  session_id uuid NOT NULL REFERENCES legislative_sessions(id),
  author_order integer NOT NULL CHECK (author_order > 0),
  name_raw text NOT NULL,
  membership_id uuid REFERENCES memberships(id),
  match_method text NOT NULL,
  introduced_on date NOT NULL,
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  source_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, author_order)
);
CREATE INDEX IF NOT EXISTS senate_bill_introduction_authors_member_idx
  ON senate_bill_introduction_authors (bill_id, membership_id) WHERE membership_id IS NOT NULL;

-- Earliest Internet Archive capture of each scorecard URL.
CREATE TABLE IF NOT EXISTS senate_scorecard_archive_dates (
  snapshot_id uuid PRIMARY KEY REFERENCES senate_scorecard_snapshots(id),
  url text NOT NULL,
  url_names_year boolean NOT NULL,
  first_captured_at timestamptz,
  capture_url text,
  result text NOT NULL CHECK (result IN ('captured','not_archived','source_error')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((result = 'captured') = (first_captured_at IS NOT NULL))
);

-- A capture dates a scorecard only when its URL names that scorecard's year (so
-- the URL holds one year's scorecard) and the capture is not before that year.
CREATE OR REPLACE VIEW public.senate_scorecard_archive_dates_usable_v AS
SELECT d.snapshot_id, d.first_captured_at::date AS archive_on
FROM public.senate_scorecard_archive_dates d
JOIN public.senate_scorecard_snapshots s ON s.id = d.snapshot_id
WHERE d.result = 'captured' AND d.url_names_year
  AND d.first_captured_at >= make_date(s.year, 1, 1);

-- Revisor posting time of each official text version, read from the bill status
-- XML the authors pipeline already stores (latest successful snapshot per bill).
CREATE OR REPLACE VIEW public.senate_bill_text_version_dates_v AS
WITH latest AS (
  SELECT DISTINCT ON (bill_id) bill_id, raw_xml
  FROM public.senate_bill_author_snapshots
  WHERE raw_xml IS NOT NULL AND http_status = 200
  ORDER BY bill_id, fetched_at DESC
), docs AS (
  SELECT l.bill_id, m[1] AS doc
  FROM latest l
  CROSS JOIN LATERAL regexp_matches(l.raw_xml, '<DOCUMENT>(.*?)</DOCUMENT>', 'g') AS m
)
SELECT
  bill_id,
  substring(doc FROM '/versions/([0-9]{1,3})/')::integer AS engrossment,
  min(to_timestamp(substring(doc FROM '<DATE_INSERT>\s*([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})'),
      'YYYY-MM-DD HH24:MI:SS')) AS date_inserted
FROM docs
WHERE substring(doc FROM '/versions/([0-9]{1,3})/') IS NOT NULL
  AND substring(doc FROM '<DATE_INSERT>\s*([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})') IS NOT NULL
GROUP BY bill_id, substring(doc FROM '/versions/([0-9]{1,3})/')::integer;

CREATE OR REPLACE VIEW public.senate_evidence_v AS
-- Official Senate floor roll calls (also the forecast target for later votes).
SELECT
  'official_floor_vote'::text AS evidence_type,
  mv.membership_id,
  ve.bill_id,
  ve.occurred_on AS observed_on,
  'vote_events.occurred_on'::text AS observed_basis,
  mv.choice AS value_text,
  NULL::numeric AS value_numeric,
  ve.vote_kind AS detail,
  'member_votes'::text AS source_table,
  mv.id::text AS source_row,
  NULL::text AS source_url
FROM public.member_votes mv
JOIN public.vote_events ve ON ve.id = mv.vote_event_id
JOIN public.chambers c ON c.id = ve.chamber_id AND c.slug = 'senate'

UNION ALL
-- Raw committee and floor votes from minutes and journals, one row per voter.
SELECT
  CASE WHEN r.venue = 'committee' THEN 'committee_vote' ELSE 'raw_floor_vote' END,
  v.membership_id,
  r.bill_id,
  r.occurred_on,
  'raw_vote.source_date',
  v.choice,
  NULL::numeric,
  concat_ws(' | ', r.committee, r.vote_kind, r.amendment_ref),
  'senate_raw_member_votes_v',
  r.source_document_id::text || ':' || r.record_ordinal || ':' || v.name_ordinal,
  r.source_url
FROM public.senate_raw_vote_records_v r
JOIN public.senate_raw_member_votes_v v
  ON v.source_document_id = r.source_document_id AND v.record_ordinal = r.record_ordinal

UNION ALL
-- Who moved each raw motion (bill, amendment or procedural).
SELECT
  CASE WHEN r.venue = 'committee' THEN 'committee_motion' ELSE 'raw_floor_motion' END,
  r.mover_membership_id,
  r.bill_id,
  r.occurred_on,
  'raw_vote.source_date',
  r.outcome,
  NULL::numeric,
  concat_ws(' | ', r.committee, r.vote_kind, r.amendment_ref),
  'senate_raw_vote_records_v',
  r.source_document_id::text || ':' || r.record_ordinal,
  r.source_url
FROM public.senate_raw_vote_records_v r
WHERE r.mover_raw IS NOT NULL

UNION ALL
-- Bill authorship. Public on the earliest of: the printed date added, the journal
-- introduction line naming the senator, bill introduction (chief author), and
-- finally the snapshot fetch date.
SELECT
  CASE WHEN a.role = 'chief' THEN 'bill_chief_author' ELSE 'bill_coauthor' END,
  a.membership_id,
  a.bill_id,
  COALESCE(LEAST(a.added_on, intro.introduced_on),
    CASE WHEN a.role = 'chief' THEN b.introduced_at::date END,
    s.fetched_at::date),
  CASE WHEN intro.introduced_on IS NOT NULL AND (a.added_on IS NULL OR intro.introduced_on <= a.added_on)
         THEN 'journal.introduction'
       WHEN a.added_on IS NOT NULL THEN 'senate_bill_authors.added_on'
       WHEN a.role = 'chief' AND b.introduced_at IS NOT NULL THEN 'bills.introduced_at'
       WHEN s.fetched_at IS NOT NULL THEN 'author_snapshot.fetched_at'
       ELSE 'unknown' END,
  CASE WHEN a.removed_on IS NOT NULL THEN a.role || ' (removed ' || a.removed_on || ')' ELSE a.role END,
  a.author_order::numeric,
  a.chamber,
  'senate_bill_authors',
  a.id::text,
  a.source_url
FROM public.senate_bill_authors a
JOIN public.bills b ON b.id = a.bill_id
LEFT JOIN public.senate_bill_author_snapshots s ON s.id = a.snapshot_id
LEFT JOIN LATERAL (
  SELECT min(i.introduced_on) AS introduced_on
  FROM public.senate_bill_introduction_authors i
  WHERE i.bill_id = a.bill_id AND i.membership_id = a.membership_id
) intro ON a.membership_id IS NOT NULL

UNION ALL
-- Committee testimony and handouts, one row per record. A senator link exists
-- only for Senator-labeled witnesses; most rows are bill-level.
SELECT
  'committee_testimony',
  t.membership_id,
  t.bill_id,
  t.hearing_date,
  'testimony.hearing_date',
  t.stated_position,
  NULL::numeric,
  concat_ws(' | ', t.committee, t.organization, t.witness_name, t.document_kind),
  'senate_committee_testimony_raw',
  t.id::text,
  t.source_url
FROM public.senate_committee_testimony_raw t

UNION ALL
-- Press statements: each named senator.
SELECT
  'press_statement_member',
  m.membership_id,
  st.bill_id,
  st.published_on,
  'statement.published_on',
  st.title,
  NULL::numeric,
  st.source_type,
  'senate_statement_member_mentions',
  m.statement_id::text || ':' || m.source_ordinal,
  st.source_url
FROM public.senate_statement_member_mentions m
JOIN public.senate_raw_statements st ON st.id = m.statement_id

UNION ALL
-- Press statements: each bill mentioned.
SELECT
  'press_statement_bill',
  st.membership_id,
  bm.bill_id,
  st.published_on,
  'statement.published_on',
  st.title,
  NULL::numeric,
  st.source_type,
  'senate_statement_bill_mentions',
  bm.statement_id::text || ':' || bm.source_ordinal,
  st.source_url
FROM public.senate_statement_bill_mentions bm
JOIN public.senate_raw_statements st ON st.id = bm.statement_id

UNION ALL
-- Senate election results; value_numeric is the candidate's vote share.
SELECT
  'election_result',
  e.membership_id,
  NULL::uuid,
  e.election_date,
  'election.election_date',
  concat_ws(' ', e.party, CASE WHEN e.winner THEN 'winner' ELSE 'not elected' END),
  e.vote_share_percent,
  'district ' || e.district || ' ' || e.election_type,
  'mn_senate_election_raw_results',
  e.id::text,
  e.source_url
FROM public.mn_senate_election_raw_results e

UNION ALL
-- Published candidate questionnaires.
SELECT
  'candidate_questionnaire',
  q.membership_id,
  NULL::uuid,
  COALESCE(q.displayed_publication_on, q.displayed_submitted_on,
    q.archive_captured_at::date, q.fetched_at::date),
  CASE WHEN q.displayed_publication_on IS NOT NULL THEN 'questionnaire.displayed_publication_on'
       WHEN q.displayed_submitted_on IS NOT NULL THEN 'questionnaire.displayed_submitted_on'
       WHEN q.archive_captured_at IS NOT NULL THEN 'questionnaire.archive_captured_at'
       ELSE 'questionnaire.fetched_at' END,
  q.questionnaire_title,
  NULL::numeric,
  q.publisher,
  'mn_senate_questionnaire_captures',
  q.id::text,
  q.source_url
FROM public.mn_senate_questionnaire_captures q

UNION ALL
-- Interest-group scores, grades, ratings and endorsements of senators.
SELECT
  'scorecard_' || se.kind,
  se.membership_id,
  NULL::uuid,
  COALESCE(sn.published_on, sad.archive_on, sn.fetched_at::date),
  CASE WHEN sn.published_on IS NOT NULL THEN 'scorecard.published_on'
       WHEN sad.archive_on IS NOT NULL THEN 'scorecard.archive_first_capture'
       ELSE 'scorecard.fetched_at' END,
  se.value_raw,
  se.value_numeric,
  se.group_name || ' ' || se.year,
  'senate_scorecard_entries',
  se.id::text,
  se.source_url
FROM public.senate_scorecard_entries se
JOIN public.senate_scorecard_snapshots sn ON sn.id = se.snapshot_id
LEFT JOIN public.senate_scorecard_archive_dates_usable_v sad ON sad.snapshot_id = sn.id

UNION ALL
-- A group's stated position on a scored bill (bill-level).
SELECT
  'scorecard_bill_position',
  NULL::uuid,
  vp.bill_id,
  COALESCE(sn.published_on, sad.archive_on, sn.fetched_at::date),
  CASE WHEN sn.published_on IS NOT NULL THEN 'scorecard.published_on'
       WHEN sad.archive_on IS NOT NULL THEN 'scorecard.archive_first_capture'
       ELSE 'scorecard.fetched_at' END,
  vp.group_position_raw,
  NULL::numeric,
  vp.group_name || ' ' || vp.year,
  'senate_scorecard_vote_positions',
  vp.id::text,
  sn.url
FROM public.senate_scorecard_vote_positions vp
JOIN public.senate_scorecard_snapshots sn ON sn.id = vp.snapshot_id
LEFT JOIN public.senate_scorecard_archive_dates_usable_v sad ON sad.snapshot_id = sn.id

UNION ALL
-- Per-senator votes as printed on a scorecard; public on the vote date.
SELECT
  'scorecard_member_vote',
  smv.membership_id,
  smv.bill_id,
  smv.voted_on,
  'scorecard_vote.voted_on',
  smv.vote_raw,
  NULL::numeric,
  smv.group_name,
  'senate_scorecard_member_votes_raw',
  smv.id::text,
  smv.source_url
FROM public.senate_scorecard_member_votes_raw smv

UNION ALL
-- District partisanship joined to each senator serving that district on the
-- matching plan (2012 plan for 2021-22, 2022 plan for 2023+). value_numeric is
-- the Democratic share of the two-party vote. Public after election day; the
-- conservative observed_on is November 30 of the election year.
SELECT
  'district_partisanship',
  mem.id,
  NULL::uuid,
  make_date(p.election_year, 11, 30),
  'partisanship.election_year_nov30',
  p.office || ' ' || p.election_year,
  CASE WHEN (p.dem_votes + p.rep_votes) > 0
    THEN round(100.0 * p.dem_votes / (p.dem_votes + p.rep_votes), 2) END,
  'district ' || p.district || ' plan ' || p.district_plan,
  'mn_senate_district_partisanship_raw',
  p.id::text || ':' || mem.id::text,
  p.source_url
FROM public.mn_senate_district_partisanship_raw p
JOIN public.memberships mem
  ON regexp_replace(mem.district, '\D', '', 'g') = p.district
JOIN public.chambers c ON c.id = mem.chamber_id AND c.slug = 'senate'
JOIN public.legislative_sessions s ON s.id = mem.session_id
WHERE (p.district_plan = '2012' AND s.slug = '2021-2022')
   OR (p.district_plan = '2022' AND s.slug IN ('2023-2024', '2025-2026'))

UNION ALL
-- Official bill text versions (bill-level).
SELECT
  'bill_text_version',
  NULL::uuid,
  bt.bill_id,
  COALESCE(bt.posted_on, vd.date_inserted::date, bt.archived_observed_at::date, bt.fetched_at::date),
  CASE WHEN bt.posted_on IS NOT NULL THEN 'bill_text.posted_on'
       WHEN vd.date_inserted IS NOT NULL THEN 'revisor_xml.date_insert'
       WHEN bt.archived_observed_at IS NOT NULL THEN 'bill_text.archived_observed_at'
       ELSE 'bill_text.fetched_at' END,
  bt.printed_label,
  length(bt.raw_text)::numeric,
  bt.family,
  'senate_official_bill_text_captures',
  bt.id::text,
  bt.source_url
FROM public.senate_official_bill_text_captures bt
LEFT JOIN public.senate_bill_text_version_dates_v vd
  ON vd.bill_id = bt.bill_id
 AND vd.engrossment = NULLIF(substring(bt.source_url FROM '/versions/([0-9]{1,3})(?:/|$)'), '')::integer

UNION ALL
-- Literal "laid over for possible inclusion" / "incorporated into" mentions.
SELECT
  'omnibus_inclusion_mention',
  NULL::uuid,
  im.source_bill_id,
  COALESCE(im.source_date, im.fetched_at::date),
  CASE WHEN im.source_date IS NOT NULL THEN 'inclusion.source_date' ELSE 'inclusion.fetched_at' END,
  im.mention_type,
  NULL::numeric,
  im.target_bill_identifier,
  'bill_inclusion_mentions',
  im.id::text,
  im.source_url
FROM public.bill_inclusion_mentions im;

COMMENT ON VIEW public.senate_evidence_v IS
  'Raw Minnesota Senate evidence index. Filter observed_on <= cutoff for as-of use; observed_basis names the date source. No inference.';

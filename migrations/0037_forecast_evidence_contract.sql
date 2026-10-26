-- Additive forecasting evidence safety; source records and frozen experiments are unchanged.
CREATE OR REPLACE VIEW public.senate_evidence_v AS
-- Official Senate floor roll calls (also the forecast target for later votes).
SELECT
  CASE WHEN floor_source.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf') THEN 'committee_vote' ELSE 'official_floor_vote' END::text AS evidence_type,
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
JOIN public.source_documents floor_source ON floor_source.id=ve.source_document_id
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
-- Every journal introduction author, including authors not yet scanned in XML.
SELECT CASE WHEN i.author_order=1 THEN 'bill_chief_author' ELSE 'bill_coauthor' END,
 i.membership_id, i.bill_id, i.introduced_on, 'journal.introduction',
 CASE WHEN i.author_order=1 THEN 'chief' ELSE 'coauthor' END,
 i.author_order::numeric, 'senate', 'senate_bill_introduction_authors',
 i.id::text, i.source_url
FROM senate_bill_introduction_authors i

UNION ALL
-- Dated additions/removals are separate observed events, never future suffixes.
SELECT CASE WHEN e.operation='add' THEN 'bill_author_added' ELSE 'bill_author_removed' END,
 e.membership_id,e.bill_id,e.occurred_on,'journal.author_change',
 e.operation,NULL::numeric,e.role,'senate_author_journal_events',
 e.source_document_id::text || ':' || e.event_key,e.source_url
FROM senate_author_journal_events e

UNION ALL
-- A current XML author state is known only at its snapshot, not at first addition.
SELECT 'bill_author_snapshot',a.membership_id,a.bill_id,s.fetched_at::date,
 'author_snapshot.fetched_at',a.role,a.author_order::numeric,a.chamber,
 'senate_bill_authors',a.id::text,a.source_url
FROM senate_bill_authors a
JOIN senate_bill_author_snapshots s ON s.id=a.snapshot_id
WHERE a.chamber='senate'

UNION ALL
-- Committee testimony and handouts, one row per record. A senator link exists
-- only for Senator-labeled witnesses; most rows are bill-level.
SELECT
  'committee_testimony',
  t.membership_id,
  t.bill_id,
  CASE WHEN t.source_type='document' THEN GREATEST(t.fetched_at::date,tx.fetched_at::date)
       ELSE t.hearing_date END,
  CASE WHEN t.source_type='document' THEN 'testimony.content_observed_at' ELSE 'testimony.hearing_date' END,
  CASE WHEN t.source_type='document' THEN COALESCE(NULLIF(t.raw_content,''),tx.raw_text)
       ELSE concat_ws(E'\n',t.stated_position,t.raw_content) END,
  NULL::numeric,
  concat_ws(' | ', t.committee, t.organization, t.witness_name, t.document_kind),
  'senate_committee_testimony_raw', t.id::text,t.source_url
FROM public.senate_committee_testimony_raw t
LEFT JOIN LATERAL (
 SELECT c.raw_text,c.fetched_at FROM senate_committee_attachment_text_captures c
 WHERE c.source_url=t.source_url AND c.extraction_status='extracted'
 ORDER BY c.fetched_at ASC,c.id ASC LIMIT 1
) tx ON t.source_type='document' AND NULLIF(t.raw_content,'') IS NULL

UNION ALL
-- Press statements: each named senator.
SELECT
  'press_statement_member',
  m.membership_id,
  st.bill_id,
  LEAST(st.fetched_at, ac.captured_at)::date,
  CASE WHEN ac.captured_at < st.fetched_at THEN 'statement.verified_archive_capture'
       ELSE 'statement.fetched_at' END,
  st.raw_text,
  NULL::numeric,
  st.source_type,
  'senate_statement_member_mentions',
  m.statement_id::text || ':' || m.source_ordinal,
  st.source_url
FROM public.senate_statement_member_mentions m
JOIN public.senate_raw_statements st ON st.id = m.statement_id
LEFT JOIN public.senate_raw_statement_archive_captures ac ON ac.source_url=st.source_url

UNION ALL
-- Press statements: each bill mentioned.
SELECT
  'press_statement_bill',
  st.membership_id,
  bm.bill_id,
  LEAST(st.fetched_at, ac.captured_at)::date,
  CASE WHEN ac.captured_at < st.fetched_at THEN 'statement.verified_archive_capture'
       ELSE 'statement.fetched_at' END,
  st.raw_text,
  NULL::numeric,
  st.source_type,
  'senate_statement_bill_mentions',
  bm.statement_id::text || ':' || bm.source_ordinal,
  st.source_url
FROM public.senate_statement_bill_mentions bm
JOIN public.senate_raw_statements st ON st.id = bm.statement_id
LEFT JOIN public.senate_raw_statement_archive_captures ac ON ac.source_url=st.source_url

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
  CASE WHEN q.source_kind='archived_response' AND q.archive_captured_at IS NOT NULL
       THEN LEAST(q.archive_captured_at,q.fetched_at)::date ELSE q.fetched_at::date END,
  CASE WHEN q.source_kind='archived_response' AND q.archive_captured_at < q.fetched_at
       THEN 'questionnaire.archive_captured_at' ELSE 'questionnaire.fetched_at' END,
  (SELECT string_agg('Q: ' || qa.question_text || E'\nA: ' || qa.answer_text,E'\n' ORDER BY qa.question_ordinal)
   FROM mn_senate_questionnaire_qa qa WHERE qa.capture_id=q.id),
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
  so.observed_on,
  so.observed_basis,
  se.value_raw,
  se.value_numeric,
  se.group_name || ' ' || se.year,
  'senate_scorecard_entries',
  se.id::text,
  se.source_url
FROM public.senate_scorecard_entries se
JOIN public.senate_scorecard_snapshots sn ON sn.id = se.snapshot_id
JOIN public.senate_scorecard_observed_v so ON so.snapshot_id=sn.id

UNION ALL
-- A group's stated position on a scored bill (bill-level).
SELECT
  'scorecard_bill_position',
  NULL::uuid,
  vp.bill_id,
  so.observed_on,
  so.observed_basis,
  vp.group_position_raw,
  NULL::numeric,
  vp.group_name || ' ' || vp.year,
  'senate_scorecard_vote_positions',
  vp.id::text,
  sn.url
FROM public.senate_scorecard_vote_positions vp
JOIN public.senate_scorecard_snapshots sn ON sn.id = vp.snapshot_id
JOIN public.senate_scorecard_observed_v so ON so.snapshot_id=sn.id

UNION ALL
-- Per-senator votes as printed on a scorecard; public on the vote date.
SELECT
  'scorecard_member_vote',
  smv.membership_id,
  smv.bill_id,
  so.observed_on,
  so.observed_basis,
  smv.vote_raw,
  NULL::numeric,
  smv.group_name,
  'senate_scorecard_member_votes_raw',
  smv.id::text,
  smv.source_url
FROM public.senate_scorecard_member_votes_raw smv
JOIN public.senate_scorecard_observed_v so ON so.snapshot_id=smv.snapshot_id

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
  LEAST(bt.archived_observed_at,bt.fetched_at)::date,
  CASE WHEN bt.archived_observed_at < bt.fetched_at THEN 'bill_text.archived_observed_at'
       ELSE 'bill_text.fetched_at' END,
  bt.raw_text,
  length(bt.raw_text)::numeric,
  bt.family,
  'senate_official_bill_text_captures',
  bt.id::text,
  bt.source_url
FROM public.senate_official_bill_text_captures bt

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
FROM public.bill_inclusion_mentions im

UNION ALL
SELECT CASE WHEN r.committee IS NULL THEN 'leadership_role' ELSE 'committee_role' END,
 r.membership_id,NULL::uuid,r.observed_on,r.observed_basis,
 r.raw_content,NULL::numeric,concat_ws(' | ',r.committee,r.role),
 'senate_role_observations',r.id::text,r.source_url
FROM senate_role_evidence_v r

UNION ALL
-- Literal website words are a deliberately admitted research lane, not vote labels.
SELECT 'candidate_website_text',ei.membership_id,ei.bill_id,ei.published_at::date,
 'website.authenticated_archive_observation',ei.excerpt,NULL::numeric,
 ei.metadata->>'issueTag','evidence_items',ei.id::text,sd.source_url
FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id
JOIN memberships m ON m.id=ei.membership_id
JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
JOIN legislative_sessions s ON s.id=m.session_id
JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
WHERE ei.metadata->>'experimentalWebsiteTextForHistoricalEvaluation'='true'
 AND ei.metadata->>'mechanicallyActionable'='false'
 AND ei.extraction_version='senate-864-literal-website-observed-asof-v1'
 AND ei.metadata->>'availabilityProof'='original_site_html_cdx_index_in_existing_research'
 AND ei.published_at IS NOT NULL

UNION ALL
-- Older public excerpts remain inspectable without trusting legacy eligibility
-- flags or datelines. Their conservative clock is the actual stored observation.
SELECT 'durable_public_text',ei.membership_id,ei.bill_id,
 GREATEST(sd.fetched_at,ei.created_at)::date,'durable.content_observed_at',
 ei.excerpt,NULL::numeric,sd.source_kind,'evidence_items',ei.id::text,sd.source_url
FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id
JOIN memberships m ON m.id=ei.membership_id
JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
JOIN legislative_sessions s ON s.id=m.session_id
JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
WHERE ei.metadata->>'experimentalWebsiteTextForHistoricalEvaluation' IS DISTINCT FROM 'true'
 AND ei.evidence_kind <> 'inference' AND length(ei.excerpt)>0
 AND sd.source_kind NOT ILIKE '%cfb%' AND sd.source_kind NOT ILIKE '%finance%';


COMMENT ON VIEW public.senate_evidence_v IS
 'Research source index. Use senate_evidence_asof(cutoff, membership) for strict date-exclusive, cross-session person access. Raw/official votes may overlap; this is not a deduplicated model matrix.';


-- Content-addressed retained bytes. These are independent of expiring Actions URLs.
CREATE TABLE evidence_content_blobs (
 sha256 text PRIMARY KEY CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 body bytea NOT NULL CHECK(octet_length(body)>0 AND octet_length(body)<=80000000),
 media_type text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(sha256=encode(sha256(body),'hex'))
);
CREATE FUNCTION reject_forecast_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Retained forecasting evidence is append-only'; END $$;
CREATE TRIGGER evidence_blobs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON evidence_content_blobs
 FOR EACH STATEMENT EXECUTE FUNCTION reject_forecast_evidence_mutation();

CREATE TABLE forecast_bill_text_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bill_id uuid NOT NULL REFERENCES bills(id),
 bill_version_id uuid REFERENCES bill_versions(id),
 version_key text NOT NULL,
 source_url text NOT NULL,
 text_sha256 text NOT NULL REFERENCES evidence_content_blobs(sha256),
 title text,
 claimed_published_at timestamptz NOT NULL,
 observed_at timestamptz NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(observed_at BETWEEN accepted_at-interval '5 minutes' AND accepted_at+interval '5 minutes')
);
CREATE INDEX forecast_bill_text_asof_idx ON forecast_bill_text_observations(bill_id,observed_at DESC);
CREATE TRIGGER forecast_bill_text_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON forecast_bill_text_observations
 FOR EACH STATEMENT EXECUTE FUNCTION reject_forecast_evidence_mutation();

CREATE TABLE forecast_input_manifests (
 revision_id uuid PRIMARY KEY REFERENCES forecast_revisions(id),
 schema_version text NOT NULL CHECK(schema_version='forecast-input-manifest-v1'),
 manifest_json text NOT NULL,
 manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(manifest_sha256=encode(sha256(convert_to(manifest_json,'UTF8')),'hex'))
);
CREATE TRIGGER forecast_input_manifest_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON forecast_input_manifests
 FOR EACH STATEMENT EXECUTE FUNCTION reject_forecast_evidence_mutation();

CREATE TABLE forecast_capture_attempts (
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 revision_id uuid NOT NULL REFERENCES forecast_revisions(id),
 capture_kind text NOT NULL CHECK(capture_kind IN ('quick_evidence','member_cap20')),
 status text NOT NULL CHECK(status IN ('started','completed','failed','not_applicable')),
 error_code text CHECK(error_code IS NULL OR error_code='CAPTURE_FAILED'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX forecast_capture_revision_idx ON forecast_capture_attempts(revision_id,capture_kind,sequence);
CREATE TRIGGER forecast_capture_attempt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON forecast_capture_attempts
 FOR EACH STATEMENT EXECUTE FUNCTION reject_forecast_evidence_mutation();

CREATE TABLE research_artifact_archive (
 artifact_id bigint PRIMARY KEY,
 workflow_run_id bigint NOT NULL,
 archive_sha256 text NOT NULL REFERENCES evidence_content_blobs(sha256),
 original_name text NOT NULL,
 original_expires_at timestamptz NOT NULL,
 internal_digests jsonb NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER research_artifact_archive_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON research_artifact_archive
 FOR EACH STATEMENT EXECUTE FUNCTION reject_forecast_evidence_mutation();

-- Access paths used by the actual idempotency and as-of supersession queries.
CREATE INDEX evidence_items_ingestion_key_idx ON evidence_items((metadata->>'ingestionKey'))
 WHERE metadata ? 'ingestionKey';
CREATE INDEX evidence_items_series_key_idx ON evidence_items((metadata->>'evidenceSeriesKey'))
 WHERE metadata ? 'evidenceSeriesKey';
CREATE INDEX evidence_relationships_to_kind_idx ON evidence_relationships(to_evidence_id,relation_kind);

-- One row per actual stored individual choice; raw/source copies are not UNIONed.
CREATE VIEW normalized_senate_vote_evidence_v1 AS
SELECT mv.id AS choice_id,ve.id AS event_id,mv.membership_id,ve.bill_id,
 CASE WHEN d.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html','senate_committee_minutes_pdf') THEN 'committee'
      WHEN d.source_kind='senate_journal_pdf' THEN 'floor' ELSE 'unknown' END AS venue,
 ve.vote_kind AS question_kind,ve.is_passage,ve.occurred_on AS event_on,ve.occurred_on AS available_on,
 mv.choice,ve.amendment_ref,ve.motion_text,d.source_url,d.content_sha256
FROM member_votes mv JOIN vote_events ve ON ve.id=mv.vote_event_id
JOIN source_documents d ON d.id=ve.source_document_id JOIN chambers c ON c.id=ve.chamber_id
JOIN jurisdictions j ON j.id=c.jurisdiction_id
WHERE c.slug='senate' AND j.slug='us-mn';

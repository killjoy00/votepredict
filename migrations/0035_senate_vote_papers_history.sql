-- Append-only source-local identities and historical observations; official votes are unchanged.
CREATE TABLE senate_vote_paper_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
 source_payload_sha256 char(64) NOT NULL,
 parser_version text NOT NULL,
 action_key char(64) NOT NULL,
 sequence integer NOT NULL,
 source_start integer NOT NULL,
 source_end integer NOT NULL CHECK(source_end>source_start),
 bill_id uuid NOT NULL REFERENCES bills(id),
 occurred_on date NOT NULL,
 kind text NOT NULL CHECK(kind IN ('amendment','passage','conference','procedural')),
 motion_text text NOT NULL,
 question_text text NOT NULL,
 proposed_text text,
 proposal_capture_id uuid REFERENCES senate_official_bill_text_captures(id),
 explicit_base_locator text,
 outcome text NOT NULL CHECK(outcome IN ('adopted','rejected','unknown')),
 prior_adopted_action_keys jsonb NOT NULL,
 yea_count integer,
 nay_count integer,
 ballot_sha256 char(64),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_document_id,source_payload_sha256,parser_version,action_key)
);
CREATE INDEX senate_vote_paper_actions_bill_idx ON senate_vote_paper_actions(bill_id);
CREATE TABLE senate_vote_paper_scans (
 source_document_id uuid PRIMARY KEY REFERENCES source_documents(id) ON DELETE CASCADE,
 source_payload_sha256 char(64) NOT NULL,
 parser_version text NOT NULL,
 actions integer NOT NULL,
 failure_kind text,
 scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE senate_vote_paper_raw_links (
 action_id uuid NOT NULL REFERENCES senate_vote_paper_actions(id) ON DELETE CASCADE,
 record_ordinal integer NOT NULL,
 method text NOT NULL CHECK(method='unique_question_full_ballot'),
 PRIMARY KEY(action_id,record_ordinal)
);
CREATE TABLE senate_vote_paper_event_links (
 action_id uuid NOT NULL REFERENCES senate_vote_paper_actions(id) ON DELETE CASCADE,
 vote_event_id uuid NOT NULL REFERENCES vote_events(id) ON DELETE CASCADE,
 vote_identity_sha256 text NOT NULL,
 method text NOT NULL CHECK(method='unique_question_full_ballot'),
 PRIMARY KEY(action_id,vote_event_id)
);
CREATE TABLE senate_vote_paper_components (
 action_id uuid NOT NULL REFERENCES senate_vote_paper_actions(id) ON DELETE CASCADE,
 capture_id uuid NOT NULL REFERENCES senate_official_bill_text_captures(id),
 relation text NOT NULL CHECK(relation='explicit_base_locator'),
 PRIMARY KEY(action_id,capture_id,relation)
);
CREATE TABLE senate_paper_source_verifications (
 source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
 source_url text NOT NULL,
 extracted_text_sha256 char(64) NOT NULL,
 original_body_sha256 char(64) NOT NULL,
 original_byte_length integer NOT NULL CHECK(original_byte_length>1000),
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_document_id,extracted_text_sha256,original_body_sha256)
);
CREATE TABLE senate_paper_source_attempts (
 source_document_id uuid PRIMARY KEY REFERENCES source_documents(id) ON DELETE CASCADE,
 extracted_text_sha256 char(64) NOT NULL,
 result text NOT NULL CHECK(result IN ('matched','mismatch','unavailable')),
 attempts integer NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now()
);

-- Fingerprint all identity-bearing official event/ballot fields. Changing an old
-- accepted row invalidates the derived link instead of silently reusing it.
CREATE FUNCTION senate_vote_paper_event_fingerprint(target uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT encode(sha256(convert_to(jsonb_build_array(v.source_document_id,v.bill_id,v.occurred_on,
  v.motion_text,v.vote_kind,v.yea_count,v.nay_count,v.other_count,v.passed,
  (SELECT jsonb_agg(jsonb_build_array(m.membership_id,m.source_member_name,m.choice)
    ORDER BY m.source_member_name,m.choice,m.membership_id) FROM member_votes m WHERE m.vote_event_id=v.id))::text,'UTF8')),'hex')
 FROM vote_events v WHERE v.id=target
$$;
CREATE VIEW senate_vote_paper_current_v AS
WITH documents AS MATERIALIZED (
 SELECT d.id,d.source_url,d.session_id,encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex') AS payload_sha,
  encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex') AS text_sha
 FROM source_documents d WHERE EXISTS(SELECT 1 FROM senate_vote_paper_actions a WHERE a.source_document_id=d.id)
)
SELECT a.*,d.source_url,s.slug AS session_slug,
 a.occurred_on AS action_on,
 EXISTS(SELECT 1 FROM senate_paper_source_verifications p WHERE p.source_document_id=d.id
  AND p.source_url=d.source_url AND p.extracted_text_sha256=d.text_sha) AS original_source_verified,
 false AS complete_assembled_bill_text,
 'at_vote_identity_not_pre_vote_publication_proof'::text AS availability_relation
FROM senate_vote_paper_actions a JOIN documents d ON d.id=a.source_document_id
JOIN legislative_sessions s ON s.id=d.session_id
WHERE a.source_payload_sha256=d.payload_sha
 AND a.parser_version='senate-journal-paper-v1';
CREATE VIEW senate_vote_paper_exact_event_v AS
SELECT a.*,l.vote_event_id FROM senate_vote_paper_current_v a
JOIN senate_vote_paper_event_links l ON l.action_id=a.id
JOIN vote_events v ON v.id=l.vote_event_id JOIN source_documents d ON d.id=v.source_document_id
WHERE l.vote_identity_sha256=senate_vote_paper_event_fingerprint(l.vote_event_id)
 AND d.source_url=a.source_url AND(v.source_document_id=a.source_document_id OR a.original_source_verified);
CREATE VIEW senate_vote_paper_exact_raw_v AS
SELECT a.*,l.record_ordinal FROM senate_vote_paper_current_v a
JOIN senate_vote_paper_raw_links l ON l.action_id=a.id;
CREATE VIEW senate_vote_paper_components_current_v AS
SELECT c.* FROM senate_vote_paper_components c JOIN senate_vote_paper_current_v a ON a.id=c.action_id
JOIN senate_official_bill_text_captures t ON t.id=c.capture_id AND t.bill_id=a.bill_id AND t.source_locator=a.explicit_base_locator
WHERE NOT EXISTS(SELECT 1 FROM senate_official_bill_text_captures other WHERE other.bill_id=t.bill_id AND other.source_url=t.source_url
 AND other.source_locator=t.source_locator AND other.extracted_text_sha256<>t.extracted_text_sha256);

CREATE TABLE senate_historical_source_jobs (
 job_key char(64) PRIMARY KEY,
 session_id uuid NOT NULL REFERENCES legislative_sessions(id),
 kind text NOT NULL CHECK(kind IN ('bill_text','role_html','role_pdf')),
 bill_id uuid REFERENCES bills(id),
 source_url text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','unavailable','failed')),
 attempts integer NOT NULL DEFAULT 0,
 checked_at timestamptz,
 captures integer NOT NULL DEFAULT 0,
 error_kind text
);
CREATE TABLE senate_historical_archive_attempts (
 job_key char(64) NOT NULL REFERENCES senate_historical_source_jobs(job_key) ON DELETE CASCADE,
 archive_url text NOT NULL,
 observed_at timestamptz NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('captured','unparsed','unavailable')),
 body_sha256 char(64),
 checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_key,archive_url)
);
CREATE TABLE senate_role_history_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 capture_key char(64) NOT NULL UNIQUE,
 session_id uuid NOT NULL REFERENCES legislative_sessions(id),
 source_document_id uuid REFERENCES source_documents(id) ON DELETE CASCADE,
 source_payload_sha256 char(64),
 source_url text NOT NULL,
 archive_url text,
 original_body_sha256 char(64) NOT NULL,
 content_sha256 char(64) NOT NULL,
 raw_content text NOT NULL,
 observed_at timestamptz,
 occurred_on date,
 source_kind text NOT NULL CHECK(source_kind IN ('archived_html','archived_pdf','official_action','official_dated_roster')),
 fetched_at timestamptz NOT NULL DEFAULT now(),
 CHECK((source_kind IN ('official_action','official_dated_roster') AND occurred_on IS NOT NULL AND observed_at IS NULL)
   OR (source_kind IN ('archived_html','archived_pdf') AND observed_at IS NOT NULL AND archive_url LIKE 'https://web.archive.org/web/%'))
);
CREATE TABLE senate_role_dated_roster_checks (
 session_id uuid PRIMARY KEY REFERENCES legislative_sessions(id),
 result text NOT NULL CHECK(result IN ('captured','unparsed','unavailable')),
 attempts integer NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE senate_role_history_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES senate_role_history_sources(id) ON DELETE CASCADE,
 source_ordinal integer NOT NULL,
 membership_id uuid REFERENCES memberships(id),
 senator_name text NOT NULL,
 role text NOT NULL,
 committee text,
 starts_on date,
 ends_on date,
 raw_content text NOT NULL,
 UNIQUE(source_id,source_ordinal)
);
CREATE INDEX senate_role_history_member_idx ON senate_role_history_items(membership_id);
CREATE VIEW senate_role_history_v AS
SELECT i.*,h.session_id,h.source_url,h.archive_url,h.content_sha256,
 CASE WHEN h.source_kind='official_dated_roster' THEN h.fetched_at::date
  ELSE coalesce(h.observed_at::date,h.occurred_on) END AS observed_on,
 CASE WHEN h.source_kind='official_action' THEN 'role.official_action_date'
  WHEN h.source_kind='official_dated_roster' THEN 'role.dated_roster_fetched_at'
  ELSE 'role.authenticated_archive_observation' END::text AS observed_basis,
 CASE WHEN h.source_kind='official_dated_roster' THEN h.fetched_at ELSE h.observed_at END AS content_observed_at,
 h.occurred_on AS role_observed_on,h.fetched_at,
 'point_observation_no_unstated_tenure'::text AS tenure_scope
FROM senate_role_history_items i JOIN senate_role_history_sources h ON h.id=i.source_id
LEFT JOIN source_documents d ON d.id=h.source_document_id
WHERE h.source_document_id IS NULL OR h.source_payload_sha256=encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex');
-- Existing shared consumers automatically receive the newly proved observations.
CREATE OR REPLACE VIEW senate_role_evidence_v AS
SELECT o.id,o.membership_id,o.session_id,o.role,o.committee,
 o.starts_on AS effective_starts_on,o.ends_on AS effective_ends_on,
 LEAST(o.fetched_at,s.fetched_at)::date AS observed_on,
 'role.original_source_fetched_at'::text AS observed_basis,
 o.source_date AS source_stated_date,o.raw_content,s.content_sha256,o.source_url
FROM senate_role_observations o JOIN senate_role_source_snapshots s ON s.id=o.source_snapshot_id
UNION ALL
SELECT h.id,h.membership_id,h.session_id,h.role,h.committee,h.starts_on,h.ends_on,
 h.observed_on,h.observed_basis,h.role_observed_on::text,h.raw_content,h.content_sha256::text,h.source_url
FROM senate_role_history_v h;

CREATE VIEW senate_vote_paper_coverage_v AS
WITH base_dates AS MATERIALIZED (
 SELECT c.action_id,min(t.archived_observed_at)::date AS first_observed
 FROM senate_vote_paper_components_current_v c JOIN senate_official_bill_text_captures t ON t.id=c.capture_id GROUP BY c.action_id
), links AS MATERIALIZED (
 SELECT x.vote_event_id,bool_or(x.proposed_text IS NOT NULL) AS proposal,bool_or(x.original_source_verified) AS verified,
 bool_or(b.first_observed<x.action_on) AS base_before
 FROM senate_vote_paper_exact_event_v x LEFT JOIN base_dates b ON b.action_id=x.id GROUP BY x.vote_event_id
), text_dates AS MATERIALIZED (
 SELECT bill_id,min(archived_observed_at)::date AS first_observed FROM senate_official_bill_text_captures GROUP BY bill_id
)
SELECT s.slug AS session,v.vote_kind,count(*) AS official_events,
 count(l.vote_event_id) AS exact_question_links,
 count(*) FILTER(WHERE l.proposal) AS exact_proposal_text,
 count(*) FILTER(WHERE l.verified) AS source_verified_links,
 count(*) FILTER(WHERE t.first_observed<v.occurred_on) AS bill_text_observed_before_day,
 count(*) FILTER(WHERE l.base_before) AS exact_base_observed_before_day
FROM vote_events v JOIN chambers ch ON ch.id=v.chamber_id AND ch.slug='senate'
JOIN legislative_sessions s ON s.id=v.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
LEFT JOIN links l ON l.vote_event_id=v.id LEFT JOIN text_dates t ON t.bill_id=v.bill_id
WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') GROUP BY s.slug,v.vote_kind;
COMMENT ON VIEW senate_vote_paper_coverage_v IS 'Official event denominator. Same-bill coverage and exact base availability are different; no claim that complete amended state is reconstructed.';

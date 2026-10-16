-- Raw published State Senate candidate questionnaire snapshots only.
-- Never implies historical availability or a position; changed content is immutable.
CREATE TABLE mn_senate_questionnaire_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  publisher text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('publisher_response','candidate_copy','archived_response')),
  source_url text NOT NULL,
  questionnaire_title text NOT NULL,
  election_cycle integer NOT NULL CHECK (election_cycle BETWEEN 2020 AND 2030),
  candidate_name text NOT NULL,
  office text NOT NULL DEFAULT 'Minnesota State Senate',
  district text,
  party text,
  displayed_publication_on date,
  displayed_submitted_on date,
  archive_captured_at timestamptz,
  fetched_at timestamptz NOT NULL,
  content_type text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  raw_content text NOT NULL,
  legislator_id uuid REFERENCES legislators(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mn_senate_questionnaire_nonempty CHECK
    (length(raw_content)>0 AND length(candidate_name)>0 AND length(questionnaire_title)>0),
  CONSTRAINT mn_senate_questionnaire_capture_unique UNIQUE
    (source_url, election_cycle, candidate_name, content_sha256)
);
CREATE TABLE mn_senate_questionnaire_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id uuid NOT NULL REFERENCES mn_senate_questionnaire_captures(id) ON DELETE CASCADE,
  question_ordinal integer NOT NULL CHECK (question_ordinal > 0),
  question_text text NOT NULL CHECK (length(question_text)>0),
  answer_text text NOT NULL CHECK (length(answer_text)>0),
  UNIQUE (capture_id, question_ordinal)
);
CREATE INDEX mn_senate_questionnaire_publisher_cycle_idx
  ON mn_senate_questionnaire_captures (election_cycle, publisher);
CREATE INDEX mn_senate_questionnaire_candidate_idx
  ON mn_senate_questionnaire_captures (election_cycle, candidate_name, district);
CREATE INDEX mn_senate_questionnaire_qa_capture_idx
  ON mn_senate_questionnaire_qa (capture_id);

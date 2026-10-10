-- Issue #864. Pure SELECT-only export for a separately authorized SELECT-only
-- database role/session. NEVER invoke via production env bridge. Never attach
-- private JSONL to GitHub, chat, issues, Actions or public artifacts.
--
-- psql -X -A -t -v ON_ERROR_STOP=1 -f \
--   scripts/export-senate-committee-hearing-legacy-readonly.sql \
--   > private-senate-committee-evidence.jsonl
--
-- This exports even previously dated siblings so the offline repair planner
-- can detect NATURAL-IDENTITY duplicates and refuse ambiguous corrections.
-- No vote text, donor details, claims or private contact information exported.
SELECT jsonb_build_object(
  'recordType', 'senate_committee_evidence',
  'evidenceId', ei.id::text,
  'sourceDocumentId', sd.id::text,
  'sourceKind', sd.source_kind,
  'sourceUrl', sd.source_url,
  'sourceSha256', sd.content_sha256,
  'sourceMeetingDate', sd.metadata->>'meetingDate',
  'sourceOfficialArchive', sd.metadata->>'officialArchive',
  'itemMeetingDate', ei.metadata->>'meetingDate',
  'contextType', ei.metadata->>'contextType',
  'subtype', ei.metadata->>'subtype',
  'sourceVerified', ei.metadata->>'sourceVerified',
  'publishedAt', to_char(
    ei.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ),
  'meetingDateIsAvailability', ei.metadata->>'meetingDateIsAvailability',
  'asOfEligible', ei.metadata->>'asOfEligible',
  'availableOn', ei.metadata->>'availableOn',
  'mechanicallyActionable', ei.metadata->>'mechanicallyActionable',
  'modelWeight', ei.metadata->>'modelWeight',
  'individualVotesAvailable', ei.metadata->>'individualVotesAvailable',
  'evidenceKind', ei.evidence_kind,
  'membershipId', ei.membership_id::text,
  'billId', ei.bill_id::text,
  'ingestionIdentityKey', ei.metadata->>'ingestionIdentityKey',
  'ingestionKey', ei.metadata->>'ingestionKey',
  'associatedVoteEventDates', COALESCE(
    (SELECT jsonb_agg(day)
       FROM (
         SELECT DISTINCT ve.occurred_on::text AS day
           FROM vote_events ve
          WHERE ve.source_document_id = sd.id
          ORDER BY day
       ) dates), '[]'::jsonb
  )
)::text
FROM evidence_items ei
JOIN source_documents sd ON sd.id = ei.source_document_id
WHERE sd.source_kind = 'senate_committee_minutes'
  AND sd.source_url ~ '^https://(www\.)?lrl\.mn\.gov/archive/minutes/senate/202[1-5]/'
ORDER BY sd.source_url, ei.id;

-- Issue #864: privately run ONLY with separately approved SELECT-only DB role.
-- No production access or writes by this repository change or CI workflow.
-- Do not upload this export to GitHub Actions or public issue comments.
-- Source original PDFs must first be verified separately and parsed.
--
-- Private CSV/JSONL: psql -X -A -t -v ON_ERROR_STOP=1 -f \
--   scripts/export-senate-committee-actions-reconciliation-readonly.sql \
--   > private-senate-committee-actions.jsonl
--
-- The only human names exported are public committee vote-member source
-- normalized names needed to hash and compare to the published original PDF's
-- named roll-call list. The offline reconciler discards them from its output.
-- No claims, motion text, speech content, contact details or donors exported.
SELECT jsonb_build_object(
  'sourceDocumentId', sd.id::text,
  'sourceUrl', sd.source_url,
  'sourceSha256', sd.content_sha256,
  'metadataMeetingDate', sd.metadata->>'meetingDate',
  'metadataCommitteeName', sd.metadata->>'committeeName',
  'voteEvents', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'eventId', ve.id::text,
      'externalKey', ve.external_key,
      'occurredOn', ve.occurred_on::text,
      'yeaCount', ve.yea_count,
      'nayCount', ve.nay_count,
      'memberVotes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'normalizedName', mv.normalized_member_name,
          'choice', mv.choice,
          'membershipId', mv.membership_id::text
        ) ORDER BY mv.normalized_member_name, mv.choice)
        FROM member_votes mv
        WHERE mv.vote_event_id = ve.id
      ), '[]'::jsonb)
    ) ORDER BY ve.external_key, ve.id)
    FROM vote_events ve
    WHERE ve.source_document_id = sd.id
      AND ve.metadata->>'committeeVote' = 'true'
  ), '[]'::jsonb),
  'contextActions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'evidenceId', ei.id::text,
      'ingestionIdentityKey', ei.metadata->>'ingestionIdentityKey',
      'subtype', ei.metadata->>'subtype',
      'evidenceKind', ei.evidence_kind,
      'membershipId', ei.membership_id::text,
      'meetingDate', ei.metadata->>'meetingDate',
      'sourceVerified', ei.metadata->>'sourceVerified'
    ) ORDER BY ei.metadata->>'ingestionIdentityKey', ei.id)
    FROM evidence_items ei
    WHERE ei.source_document_id = sd.id
      AND ei.metadata->>'contextType' = 'senate_committee_action'
  ), '[]'::jsonb)
)::text
FROM source_documents sd
WHERE sd.source_kind = 'senate_committee_minutes'
  AND sd.source_url ~ '^https://(www\.)?lrl\.mn\.gov/archive/minutes/senate/202[2-5]/'
ORDER BY sd.source_url, sd.content_sha256, sd.id;

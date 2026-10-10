-- Issue #864 Track D: SELECT-ONLY, run only with separately authorized
-- read-only role. NO GitHub Actions, production writes or automatic exports.
-- Keep JSONL private. Do not post raw articles, source hashes or names to issues.
--
-- psql -X -A -t -v ON_ERROR_STOP=1 -f \
--   scripts/export-senate-media-context-readonly.sql > PRIVATE-context.jsonl
--
-- Original 44-source corpus is NOT a universe of all media remarks. Do not
-- filter to 2021-25 here: offline code explicitly excludes and reports 2026.
SELECT jsonb_build_object(
  'evidenceId', ei.id::text,
  'sourceDocumentId', sd.id::text,
  'sourceKind', sd.source_kind,
  'sourceUrl', sd.source_url,
  'sourceSha256', sd.content_sha256,
  'seedId', ei.metadata->>'seedId',
  'publisher', ei.metadata->>'publisher',
  'originalUrl', ei.metadata->>'originalUrl',
  'archiveUrl', ei.metadata->>'archiveUrl',
  'archiveCapturedAt', ei.metadata->>'archiveCapturedAt',
  'archiveDigest', ei.metadata->>'archiveDigest',
  'publisherPublishedAt', ei.metadata->>'publisherPublishedAt',
  'evidencePublishedAt', CASE WHEN ei.published_at IS NULL THEN NULL
     ELSE to_char(ei.published_at AT TIME ZONE 'UTC',
       'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
  'evidenceKind', ei.evidence_kind,
  'stance', ei.stance,
  'contextOnly', ei.metadata->>'contextOnly' = 'true',
  'sameDayEligible', ei.metadata->>'sameDayEligible' = 'true',
  'modelWeight', CASE WHEN ei.metadata->>'modelWeight' = '0' THEN 0 ELSE -1 END,
  'articleInfersLegislativeStance',
    ei.metadata->>'articleInfersLegislativeStance' IS DISTINCT FROM 'false',
  'mentionedMembers', COALESCE(ei.metadata->'mentionedMembers', '[]'::jsonb)
)::text
FROM evidence_items ei
JOIN source_documents sd ON sd.id = ei.source_document_id
WHERE sd.source_kind = 'wayback_local_trade_news'
  AND ei.metadata->>'contextType' = 'local_trade_news'
ORDER BY sd.source_url, sd.content_sha256, ei.id;

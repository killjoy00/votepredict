-- ISSUE #864: read-only export template for separately authorized operators.
-- Run only using a SELECT-only role/session on the verified correct database.
-- Never invoke a backfill, import, migration or database bridge here.
-- Do not include donor names, employers, addresses, or free-text claim bodies.
-- psql -X -A -t -v ON_ERROR_STOP=1 -f scripts/export-cfb-historical-senate-evidence-readonly.sql > private-evidence.jsonl
SELECT jsonb_build_object(
  'sourceKind', sd.source_kind,
  'sourceUrl', sd.source_url,
  'sourceSha256', sd.content_sha256,
  'membershipChamber', c.slug,
  'publishedAt', ei.published_at,
  'metadata', jsonb_build_object(
    'rowKey', ei.metadata->>'rowKey',
    'subtype', ei.metadata->>'subtype',
    'year', ei.metadata->>'year',
    'chamber', ei.metadata->>'chamber',
    'transactionDate', ei.metadata->>'transactionDate',
    'filerRegistrationNumber', ei.metadata->>'filerRegistrationNumber',
    'spenderRegistrationNumber', ei.metadata->>'spenderRegistrationNumber',
    'reportName', ei.metadata->>'reportName',
    'filedOn', ei.metadata->>'filedOn',
    'reportDueOn', ei.metadata->>'reportDueOn',
    'disclosedOn', ei.metadata->>'disclosedOn',
    'availableOn', ei.metadata->>'availableOn',
    'asOfEligible', ei.metadata->>'asOfEligible',
    'availabilityPolicyVersion', ei.metadata->>'availabilityPolicyVersion',
    'availabilityProofKind', ei.metadata->>'availabilityProofKind',
    'availabilityProofUrl', ei.metadata->>'availabilityProofUrl',
    'availabilityProofContentSha256', ei.metadata->>'availabilityProofContentSha256',
    'filingDateDerivedAvailability', ei.metadata->>'filingDateDerivedAvailability',
    'dueDateAndFilingBoundApplied', ei.metadata->>'dueDateAndFilingBoundApplied'
  )
)::text
FROM evidence_items ei
JOIN source_documents sd ON sd.id = ei.source_document_id
LEFT JOIN memberships m ON m.id = ei.membership_id
LEFT JOIN chambers c ON c.id = m.chamber_id
WHERE sd.source_kind IN (
  'campaign_finance_candidate_contribution_bulk',
  'campaign_finance_candidate_expenditure_bulk',
  'campaign_finance_independent_expenditure_bulk',
  'campaign_finance_bulk'
)
ORDER BY sd.source_kind, ei.metadata->>'rowKey', ei.id;

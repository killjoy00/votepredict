-- #864 C. Proposed bounded Senate winning-candidate/source reconciliation only.
-- DO NOT execute against production by default. An isolated Neon sandbox with
-- dedicated SELECT-only vp_evidence_ro_* role and explicit owner approval is required.
-- No INSERT/UPDATE/DELETE/CREATE/ALTER or production membership assumptions.
-- Intended for one connection with repeatable-read READ ONLY transaction.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5000ms';
SET LOCAL lock_timeout = '750ms';
SET LOCAL idle_in_transaction_session_timeout = '15000ms';

-- Verify current_user, ro state, SELECT permissions and lack of write grants
-- BEFORE running the two source queries. The host-side verifier must also
-- confirm the configured project/branch is the independently approved sandbox.

-- A) Full bounded 2025–26 *target-district* Senate membership roster, not
-- 2026 candidate list. The returned names/districts may be cross-checked
-- with Minnesota SOS 2024/2025 special GENERAL outcomes after elections.
SELECT m.id::text AS "membershipId",
       l.name AS "senatorName",
       s.slug AS "sessionSlug",
       m.district::text AS "district",
       m.starts_on::text AS "startsOn",
       m.ends_on::text AS "endsOn",
       m.party::text AS "party",
       COUNT(ei.id) FILTER(
         WHERE ei.metadata->>'contextType'='issue_position'
           AND ei.metadata->>'sourceSubtype'='campaign_site_page'
           AND ei.published_at < TIMESTAMPTZ '2026-01-01T00:00:00Z'
       )::integer AS "recordedIssuePositionItems"
  FROM memberships m
  JOIN legislators l ON l.id=m.legislator_id
  JOIN legislative_sessions s ON s.id=m.session_id
  JOIN chambers c ON c.id=m.chamber_id
  LEFT JOIN evidence_items ei ON ei.membership_id=m.id
 WHERE c.slug='senate' AND s.slug='2025-2026'
   AND m.district IN ('6','29','45')
 GROUP BY m.id,l.name,s.slug,m.district,m.starts_on,m.ends_on,m.party
 ORDER BY m.district,m.id
 LIMIT 13;  -- the host must reject >=13 rows, not silently truncate

-- B) Only *campaign website issue positions* already held for exactly these
-- bounded session/districts with published_at before Jan 1, 2026.
-- Source body/claim/excerpt text is NOT exported. The host performs exact
-- short-excerpt comparisons in memory or through constant parameter VALUES,
-- and exports ONLY boolean match flags for winner-owned excerpts.
SELECT ei.id::text AS "evidenceItemId",
       ei.membership_id::text AS "membershipId",
       sd.id::text AS "sourceDocumentId",
       sd.source_url::text AS "sourceUrl",
       sd.content_sha256::text AS "sourceContentSha256",
       sd.source_kind::text AS "sourceKind",
       ei.metadata->>'sourceSubtype' AS "sourceSubtype",
       ei.metadata->>'contextType' AS "contextType",
       COALESCE(ei.metadata->>'issueFamily',ei.metadata->>'policyFamily') AS "issueFamily",
       ei.stance::text AS "stance",
       ei.published_at::text AS "publishedAt"
  FROM evidence_items ei
  JOIN source_documents sd ON sd.id=ei.source_document_id
  JOIN memberships m ON m.id=ei.membership_id
  JOIN legislative_sessions s ON s.id=m.session_id
  JOIN chambers c ON c.id=m.chamber_id
 WHERE c.slug='senate' AND s.slug='2025-2026'
   AND m.district IN ('6','29','45')
   AND ei.metadata->>'contextType'='issue_position'
   AND ei.metadata->>'sourceSubtype'='campaign_site_page'
   AND ei.published_at < TIMESTAMPTZ '2026-01-01T00:00:00Z'
 ORDER BY ei.id
 LIMIT 301;  -- the host must reject >=301 rows, not silently truncate

ROLLBACK;

-- Validation report MUST distinguish: no sandbox connection; missing member;
-- mismatched candidate; confirmed zero source rows in bounded sandbox;
-- production evidence still UNREAD. Never treat a missing export as zero.

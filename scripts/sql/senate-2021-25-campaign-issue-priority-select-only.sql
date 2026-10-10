-- #864 C. A PROPOSED SELECT-ONLY EXPORT; NEVER EXECUTED BY THIS CHANGE.
-- Requires separate, explicit owner authorization on a correct read-only database.
-- Restrict 2025-26 membership evidence to calendar year 2025, not 2026.
-- Result column aliases match the offline CLI JSONL reader.
-- This is a snapshot of recorded, timestamped issue_position items, NOT source completeness.
BEGIN TRANSACTION READ ONLY;

SELECT m.id::text AS "membershipId",
       l.name AS "senatorName",
       s.slug AS "sessionSlug",
       m.district::text AS "district",
       COUNT(ei.id) FILTER (
         WHERE ei.metadata->>'contextType'='issue_position'
           AND ei.published_at IS NOT NULL
           AND ei.published_at < CASE s.slug
             WHEN '2021-2022' THEN TIMESTAMPTZ '2023-01-01T00:00:00Z'
             WHEN '2023-2024' THEN TIMESTAMPTZ '2025-01-01T00:00:00Z'
             WHEN '2025-2026' THEN TIMESTAMPTZ '2026-01-01T00:00:00Z'
           END
       )::integer AS "recordedIssuePositionItems"
  FROM memberships m
  JOIN legislators l ON l.id=m.legislator_id
  JOIN legislative_sessions s ON s.id=m.session_id
  JOIN chambers c ON c.id=m.chamber_id
  LEFT JOIN evidence_items ei ON ei.membership_id=m.id
 WHERE c.slug='senate'
   AND s.slug IN ('2021-2022','2023-2024','2025-2026')
 GROUP BY m.id,l.name,s.slug,m.district
 ORDER BY s.slug,l.name,m.id;

ROLLBACK;

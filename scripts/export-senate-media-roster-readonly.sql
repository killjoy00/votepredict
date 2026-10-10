-- Issue #864 Track D: independently approved SELECT-ONLY senator roster.
-- Run privately with a restricted read role, NEVER inside GitHub CI.
--
-- psql -X -A -t -v ON_ERROR_STOP=1 -f \
--   scripts/export-senate-media-roster-readonly.sql > PRIVATE-roster.jsonl
--
-- Membership and session dates bound the senator's active interval. An
-- unknown boundary stays NULL and prevents quote qualification.
SELECT jsonb_build_object(
  'year', yr.y,
  'membershipId', m.id::text,
  'senatorId', l.id::text,
  'senatorName', l.name,
  'activeFrom', CASE WHEN COALESCE(m.starts_on, s.starts_on) IS NULL
    THEN NULL ELSE GREATEST(COALESCE(m.starts_on, s.starts_on),
      make_date(yr.y, 1, 1))::text END,
  'activeThrough', CASE WHEN COALESCE(m.ends_on, s.ends_on) IS NULL
    THEN NULL ELSE LEAST(COALESCE(m.ends_on, s.ends_on),
      make_date(yr.y, 12, 31))::text END
)::text
FROM memberships m
JOIN legislators l ON l.id = m.legislator_id
JOIN chambers c ON c.id = m.chamber_id
JOIN legislative_sessions s ON s.id = m.session_id
CROSS JOIN generate_series(2021, 2025) AS yr(y)
WHERE c.slug = 'senate'
  AND s.slug IN ('2021-2022', '2023-2024', '2025-2026')
  AND (COALESCE(m.starts_on, s.starts_on) IS NULL
    OR COALESCE(m.starts_on, s.starts_on) <= make_date(yr.y, 12, 31))
  AND (COALESCE(m.ends_on, s.ends_on) IS NULL
    OR COALESCE(m.ends_on, s.ends_on) >= make_date(yr.y, 1, 1))
ORDER BY yr.y, l.name, m.id;

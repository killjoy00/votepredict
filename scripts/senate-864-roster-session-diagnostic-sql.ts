/**
 * #864: isolate the reason the V5 per-calendar-year Senate roster counts can
 * have more session-membership rows than distinct active people.
 * Only aggregate counts from three bounded SELECTs may leave Neon.
 */
export const HISTORICAL_SENATE_SESSION_SQL_PROOF_VERSION =
 'mn-864-senate-calendar-year-vs-session-member-bounds-v1' as const;

const SOURCE=[
 'WITH year_memberships AS MATERIALIZED (',
 'SELECT yr.y AS yr,s.slug AS session_slug,m.legislator_id,m.id AS membership_id,',
 'm.starts_on AS m_starts,m.ends_on AS m_ends,',
 's.starts_on AS s_starts,s.ends_on AS s_ends,',
 'COALESCE(m.starts_on,s.starts_on) AS effective_starts,',
 'COALESCE(m.ends_on,s.ends_on) AS effective_ends,',
 '(s.starts_on IS NOT NULL AND s.ends_on IS NOT NULL',
 'AND s.starts_on<=make_date(yr.y,12,31)',
 'AND s.ends_on>=make_date(yr.y,1,1)) AS session_calendar_year_intersects,',
 '(s.starts_on IS NOT NULL AND s.ends_on IS NOT NULL',
 'AND COALESCE(m.starts_on,s.starts_on) IS NOT NULL',
 'AND COALESCE(m.ends_on,s.ends_on) IS NOT NULL',
 'AND GREATEST(COALESCE(m.starts_on,s.starts_on),s.starts_on,make_date(yr.y,1,1))',
 '<=LEAST(COALESCE(m.ends_on,s.ends_on),s.ends_on,make_date(yr.y,12,31)))',
 'AS year_and_membership_and_session_intersect',
 'FROM memberships m JOIN legislative_sessions s ON s.id=m.session_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 'CROSS JOIN generate_series(2021,2025) AS yr(y)',
 "WHERE c.slug='senate'",
 "AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
 'AND (COALESCE(m.starts_on,s.starts_on) IS NULL',
 'OR COALESCE(m.starts_on,s.starts_on)<=make_date(yr.y,12,31))',
 'AND (COALESCE(m.ends_on,s.ends_on) IS NULL',
 'OR COALESCE(m.ends_on,s.ends_on)>=make_date(yr.y,1,1))',
 ')',
].join(' ');

export const SESSION_YEAR_SQL=[
 SOURCE,
 'SELECT yr::text AS year,session_slug,',
 'COUNT(*)::text AS v5_membership_rows,',
 'COUNT(DISTINCT legislator_id)::text AS v5_people_in_session,',
 'COUNT(*) FILTER (WHERE NOT session_calendar_year_intersects)::text',
 'AS rows_from_session_not_intersecting_calendar_year,',
 'COUNT(*) FILTER (WHERE session_calendar_year_intersects',
 'AND NOT year_and_membership_and_session_intersect)::text',
 'AS rows_from_session_year_but_not_active_within_both_bounds,',
 'COUNT(*) FILTER (WHERE year_and_membership_and_session_intersect)::text',
 'AS session_clamped_active_membership_rows,',
 'COUNT(DISTINCT legislator_id) FILTER (WHERE year_and_membership_and_session_intersect)::text',
 'AS session_clamped_active_people_in_session,',
 'COUNT(*) FILTER (WHERE m_starts<s_starts)::text AS membership_starts_before_session,',
 'COUNT(*) FILTER (WHERE m_ends>s_ends)::text AS membership_ends_after_session,',
 'COUNT(*) FILTER (WHERE s_starts IS NULL OR s_ends IS NULL)::text AS missing_session_dates',
 'FROM year_memberships',
 'GROUP BY yr,session_slug ORDER BY yr,session_slug LIMIT 16',
].join(' ');
export const CALENDAR_YEAR_SQL=[
 SOURCE,
 'SELECT yr::text AS year,',
 'COUNT(*)::text AS v5_memberships,',
 'COUNT(DISTINCT legislator_id)::text AS v5_people,',
 'COUNT(*) FILTER (WHERE year_and_membership_and_session_intersect)::text',
 'AS session_clamped_active_membership_rows,',
 'COUNT(DISTINCT legislator_id) FILTER (WHERE year_and_membership_and_session_intersect)::text',
 'AS session_clamped_active_people,',
 'COUNT(*) FILTER (WHERE NOT session_calendar_year_intersects)::text',
 'AS rows_outside_session_calendar_year,',
 'COUNT(DISTINCT legislator_id) FILTER (WHERE NOT session_calendar_year_intersects)::text',
 'AS people_with_outside_session_membership_rows,',
 'COUNT(*) FILTER (WHERE s_starts IS NULL OR s_ends IS NULL)::text',
 'AS records_missing_session_date_boundary',
 'FROM year_memberships GROUP BY yr ORDER BY yr LIMIT 6',
].join(' ');
export const DUPLICATE_PERSON_YEAR_SQL=[
 SOURCE,
 ', person_rows AS (',
 'SELECT yr,legislator_id,COUNT(*) AS membership_rows,',
 'COUNT(DISTINCT session_slug) AS session_count,',
 'COUNT(*) FILTER (WHERE year_and_membership_and_session_intersect) AS clamped_rows',
 'FROM year_memberships GROUP BY yr,legislator_id',
 ') SELECT yr::text AS year,',
 'COUNT(*) FILTER (WHERE membership_rows>1)::text AS people_with_multiple_v5_membership_rows,',
 'COUNT(*) FILTER (WHERE session_count>1)::text AS people_with_multiple_v5_session_slugs,',
 'SUM(GREATEST(membership_rows-1,0))::text AS v5_extra_rows_from_duplicate_people,',
 'COUNT(*) FILTER (WHERE membership_rows>1 AND clamped_rows<=1)::text',
 'AS multi_v5_row_people_with_at_most_one_session_clamped_row,',
 'COUNT(*) FILTER (WHERE clamped_rows>1)::text AS people_with_multi_session_clamped_rows,',
 'COALESCE(MAX(membership_rows),0)::text AS highest_membership_rows_for_one_person,',
 'COALESCE(MAX(session_count),0)::text AS highest_sessions_for_one_person',
 'FROM person_rows GROUP BY yr ORDER BY yr LIMIT 6',
].join(' ');
export const ROSTER_DIAGNOSTIC_QUERIES=[
 SESSION_YEAR_SQL,CALENDAR_YEAR_SQL,DUPLICATE_PERSON_YEAR_SQL,
] as const;
export const V5_ROSTER_COUNTS=[
 {year:'2021',people:67,memberships:67},
 {year:'2022',people:67,memberships:67},
 {year:'2023',people:90,memberships:198},
 {year:'2024',people:68,memberships:134},
 {year:'2025',people:70,memberships:136},
] as const;

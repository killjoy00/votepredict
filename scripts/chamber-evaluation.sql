WITH member_keys AS (SELECT id, dense_rank() over(order by id)::int as key FROM legislators),
event_members AS (
 SELECT ve.id, jsonb_agg(jsonb_build_array(k.key,coalesce(nullif(btrim(m.party),''),'UNKNOWN'),mv.choice) order by m.id) as members
 FROM vote_events ve JOIN memberships m ON m.session_id=ve.session_id AND m.chamber_id=ve.chamber_id
 AND (m.starts_on is null or m.starts_on<=ve.occurred_on) AND (m.ends_on is null or m.ends_on>=ve.occurred_on)
 JOIN member_keys k on k.id=m.legislator_id LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id AND mv.membership_id=m.id
 WHERE ve.is_passage GROUP BY ve.id
)
SELECT ve.id,ve.occurred_on::text as date,s.slug as session,c.slug as chamber,ve.yea_count as yes,ve.nay_count as no,ve.passed,em.members,
 bfs.features->'gambling' as gambling
 FROM vote_events ve JOIN legislative_sessions s ON s.id=ve.session_id JOIN chambers c ON c.id=ve.chamber_id
 JOIN event_members em ON em.id=ve.id
 LEFT JOIN LATERAL (SELECT fs.features FROM bill_versions bv JOIN bill_feature_sets fs ON fs.bill_version_id=bv.id
 WHERE bv.bill_id=ve.bill_id AND bv.published_at<ve.occurred_on AND fs.feature_schema_version='bill-features-v2'
 ORDER BY bv.published_at DESC,fs.generated_at DESC,fs.id LIMIT 1) bfs ON true
 WHERE ve.is_passage ORDER BY ve.occurred_on,ve.id

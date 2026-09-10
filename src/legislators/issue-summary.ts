import { pool } from '@/lib/db';

export interface IssueSummaryPeer {
  legislatorId: string;
  membershipId: string;
  name: string;
  party: string;
  district: string;
  sharedVotes: number;
  agreement: number;
}

export interface LegislatorIssueSummary {
  area: string;
  rollCallVotes: number;
  yesVotes: number;
  noVotes: number;
  yesRate?: number;
  latestVoteOn?: string;
  distinctBills: number;
  partyComparableVotes: number;
  partyAlignedVotes: number;
  partyAlignment?: number;
  partyBreaks: number;
  closestMargin?: number;
  evidenceCount: number;
  strongestCrossParty?: IssueSummaryPeer;
}

type IssueSummaryDbRow = {
  area: string;
  roll_call_votes: number;
  yes_votes: number;
  no_votes: number;
  latest_vote_on: string | null;
  distinct_bills: number;
  party_comparable_votes: number;
  party_aligned_votes: number;
  closest_margin: number | null;
  evidence_count: number;
  peer_legislator_id: string | null;
  peer_membership_id: string | null;
  peer_name: string | null;
  peer_party: string | null;
  peer_district: string | null;
  peer_shared_votes: number | null;
  peer_aligned_votes: number | null;
};

const ISSUE_CASE = `CASE
  WHEN b.title ~* '(education|school|teacher|student|college|university)' THEN 'education'
  WHEN b.title ~* '(health|medical|hospital|patient|pharmacy|medicaid|mncare)' THEN 'health'
  WHEN b.title ~* '(human services|child care|disabilit|foster care|public assistance)' THEN 'human_services'
  WHEN b.title ~* '(tax|revenue|credit|deduction|exemption)' THEN 'taxes_revenue'
  WHEN b.title ~* '(public safety|police|law enforcement|crime|criminal|correction|firearm)' THEN 'public_safety'
  WHEN b.title ~* '(housing|tenant|landlord|rent|residential)' THEN 'housing'
  WHEN b.title ~* '(transportation|highway|road|transit|vehicle|driver)' THEN 'transportation'
  WHEN b.title ~* '(environment|natural resources|water|climate|pollution|wetland)' THEN 'environment_natural_resources'
  WHEN b.title ~* '(labor|employment|employer|employee|wage|workplace)' THEN 'labor_employment'
  WHEN b.title ~* '(election|ballot|voter|campaign)' THEN 'elections'
  WHEN b.title ~* '(agricultur|farm|crop|livestock)' THEN 'agriculture'
  WHEN b.title ~* '(commerce|consumer|business|insurance|licens)' THEN 'commerce_consumer'
  WHEN b.title ~* '(local government|county|municipal|township|city)' THEN 'local_government'
  WHEN b.title ~* '(judiciar|court|judge|civil law|attorney)' THEN 'judiciary_civil_law'
  WHEN b.title ~* '(state government|state agency|department|commission)' THEN 'state_government'
  ELSE 'other'
END`;

export async function loadLegislatorIssueSummaries(legislatorId: string): Promise<LegislatorIssueSummary[]> {
  const result = await pool.query<IssueSummaryDbRow>(`
    WITH current_membership AS (
      SELECT m.id
        FROM legislative_sessions s
        JOIN memberships m ON m.session_id = s.id
       WHERE s.is_current = true
         AND m.legislator_id = $1
         AND (m.starts_on IS NULL OR m.starts_on <= current_date)
         AND (m.ends_on IS NULL OR m.ends_on >= current_date)
       LIMIT 1
    ), target_votes AS (
      SELECT ve.id AS vote_event_id,
             ve.bill_id,
             ve.session_id,
             ve.chamber_id,
             mv.membership_id,
             mv.choice,
             m.party,
             ve.occurred_on,
             abs(ve.yea_count - ve.nay_count)::int AS margin,
             ${ISSUE_CASE} AS area
        FROM member_votes mv
        JOIN memberships m ON m.id = mv.membership_id
        JOIN vote_events ve ON ve.id = mv.vote_event_id
        JOIN bills b ON b.id = ve.bill_id
       WHERE m.legislator_id = $1
         AND mv.choice IN ('yea', 'nay')
    ), party_counts AS (
      SELECT tv.vote_event_id,
             count(*) FILTER (WHERE pmv.choice = 'yea')::int AS yes_count,
             count(*) FILTER (WHERE pmv.choice = 'nay')::int AS no_count
        FROM target_votes tv
        JOIN member_votes pmv ON pmv.vote_event_id = tv.vote_event_id
        JOIN memberships pm ON pm.id = pmv.membership_id
       WHERE pm.party = tv.party
         AND pm.session_id = tv.session_id
         AND pm.chamber_id = tv.chamber_id
         AND pmv.choice IN ('yea', 'nay')
       GROUP BY tv.vote_event_id
    ), issue_base AS (
      SELECT tv.area,
             count(*)::int AS roll_call_votes,
             count(*) FILTER (WHERE tv.choice = 'yea')::int AS yes_votes,
             count(*) FILTER (WHERE tv.choice = 'nay')::int AS no_votes,
             max(tv.occurred_on)::text AS latest_vote_on,
             count(DISTINCT tv.bill_id)::int AS distinct_bills,
             count(*) FILTER (WHERE pc.yes_count <> pc.no_count)::int AS party_comparable_votes,
             count(*) FILTER (
               WHERE (tv.choice = 'yea' AND pc.yes_count > pc.no_count)
                  OR (tv.choice = 'nay' AND pc.no_count > pc.yes_count)
             )::int AS party_aligned_votes,
             min(tv.margin)::int AS closest_margin
        FROM target_votes tv
        LEFT JOIN party_counts pc ON pc.vote_event_id = tv.vote_event_id
       GROUP BY tv.area
    ), target_bills AS (
      SELECT DISTINCT area, bill_id
        FROM target_votes
       WHERE bill_id IS NOT NULL
    ), evidence_counts AS (
      SELECT tb.area,
             count(DISTINCT ei.id)::int AS evidence_count
        FROM target_bills tb
        JOIN evidence_items ei ON ei.bill_id = tb.bill_id
        JOIN memberships em ON em.id = ei.membership_id
       WHERE em.legislator_id = $1
         AND NOT EXISTS (
           SELECT 1
             FROM evidence_relationships er
            WHERE er.to_evidence_id = ei.id
              AND er.relation_kind = 'supersedes'
         )
       GROUP BY tb.area
    ), current_issue_votes AS (
      SELECT tv.*
        FROM target_votes tv
        JOIN current_membership cm ON cm.id = tv.membership_id
    ), peer_aggregate AS (
      SELECT tv.area,
             l.id AS legislator_id,
             pm.id AS membership_id,
             l.name,
             pm.party,
             pm.district,
             count(*)::int AS shared_votes,
             count(*) FILTER (WHERE pmv.choice = tv.choice)::int AS aligned_votes
        FROM current_issue_votes tv
        JOIN member_votes pmv
          ON pmv.vote_event_id = tv.vote_event_id
         AND pmv.choice IN ('yea', 'nay')
        JOIN memberships pm ON pm.id = pmv.membership_id
        JOIN legislators l ON l.id = pm.legislator_id
       WHERE pm.id <> tv.membership_id
         AND pm.session_id = tv.session_id
         AND pm.chamber_id = tv.chamber_id
         AND pm.party <> tv.party
       GROUP BY tv.area, l.id, pm.id, l.name, pm.party, pm.district
      HAVING count(*) >= 8
    ), peer_ranked AS (
      SELECT pa.*,
             row_number() OVER (
               PARTITION BY pa.area
               ORDER BY (pa.aligned_votes::float8 / NULLIF(pa.shared_votes, 0)) DESC,
                        pa.shared_votes DESC,
                        pa.name
             ) AS rank
        FROM peer_aggregate pa
    )
    SELECT ib.area,
           ib.roll_call_votes,
           ib.yes_votes,
           ib.no_votes,
           ib.latest_vote_on,
           ib.distinct_bills,
           ib.party_comparable_votes,
           ib.party_aligned_votes,
           ib.closest_margin,
           COALESCE(ec.evidence_count, 0)::int AS evidence_count,
           pr.legislator_id AS peer_legislator_id,
           pr.membership_id AS peer_membership_id,
           pr.name AS peer_name,
           pr.party AS peer_party,
           pr.district AS peer_district,
           pr.shared_votes AS peer_shared_votes,
           pr.aligned_votes AS peer_aligned_votes
      FROM issue_base ib
      LEFT JOIN evidence_counts ec ON ec.area = ib.area
      LEFT JOIN peer_ranked pr ON pr.area = ib.area AND pr.rank = 1
     WHERE ib.area <> 'other'
     ORDER BY ib.roll_call_votes DESC, ib.area
     LIMIT 12`, [legislatorId]);

  return result.rows.map((row) => {
    const strongestCrossParty = row.peer_legislator_id
      && row.peer_membership_id
      && row.peer_name
      && row.peer_party
      && row.peer_district
      && row.peer_shared_votes
      && row.peer_aligned_votes !== null
      ? {
          legislatorId: row.peer_legislator_id,
          membershipId: row.peer_membership_id,
          name: row.peer_name,
          party: row.peer_party,
          district: row.peer_district,
          sharedVotes: row.peer_shared_votes,
          agreement: row.peer_aligned_votes / row.peer_shared_votes,
        }
      : undefined;

    return {
      area: row.area,
      rollCallVotes: row.roll_call_votes,
      yesVotes: row.yes_votes,
      noVotes: row.no_votes,
      yesRate: row.roll_call_votes > 0 ? row.yes_votes / row.roll_call_votes : undefined,
      latestVoteOn: row.latest_vote_on ?? undefined,
      distinctBills: row.distinct_bills,
      partyComparableVotes: row.party_comparable_votes,
      partyAlignedVotes: row.party_aligned_votes,
      partyAlignment: row.party_comparable_votes > 0
        ? row.party_aligned_votes / row.party_comparable_votes
        : undefined,
      partyBreaks: row.party_comparable_votes - row.party_aligned_votes,
      closestMargin: row.closest_margin ?? undefined,
      evidenceCount: row.evidence_count,
      strongestCrossParty,
    };
  });
}

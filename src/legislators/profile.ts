import { getCampaignFinanceContextForMember, type CampaignFinanceMemberContext } from '@/evidence/campaign-finance-snapshot';
import { pool } from '@/lib/db';

export interface LegislatorDirectoryRow {
  legislatorId: string;
  membershipId: string;
  name: string;
  party: string;
  district: string;
  title: string;
  chamberSlug: string;
  chamberName: string;
  sourceUrl?: string;
}

export interface LegislatorMembershipRow {
  membershipId: string;
  sessionName: string;
  sessionSlug: string;
  chamberSlug: string;
  chamberName: string;
  party: string;
  district: string;
  title: string;
  startsOn?: string;
  endsOn?: string;
  sourceUrl?: string;
  current: boolean;
}

export interface LegislatorVoteSummary {
  recordedVotes: number;
  passageVotes: number;
  yesVotes: number;
  noVotes: number;
  yesRate?: number;
  partyComparableVotes: number;
  partyAlignedVotes: number;
  partyAlignment?: number;
}

export interface LegislatorIssueRow {
  area: string;
  rollCallVotes: number;
  yesVotes: number;
  noVotes: number;
  yesRate?: number;
  latestVoteOn?: string;
}

export interface LegislatorAlignmentRow {
  legislatorId: string;
  membershipId: string;
  name: string;
  party: string;
  district: string;
  sharedVotes: number;
  alignedVotes: number;
  agreement: number;
}

export interface LegislatorNotableVote {
  voteEventId: string;
  occurredOn: string;
  identifier?: string;
  title?: string;
  choice: 'yea' | 'nay';
  yeaCount: number;
  nayCount: number;
  otherCount: number;
  passed?: boolean;
  margin: number;
}

export interface LegislatorEvidenceRow {
  kind: string;
  stance?: string;
  claim: string;
  excerpt?: string;
  publishedAt?: string;
  sourceQuality: string;
  confidence?: number;
  sourceUrl: string;
}

export interface LegislatorProfile {
  legislatorId: string;
  name: string;
  currentMembership?: LegislatorDirectoryRow;
  memberships: LegislatorMembershipRow[];
  voteSummary: LegislatorVoteSummary;
  issues: LegislatorIssueRow[];
  closestAlignments: LegislatorAlignmentRow[];
  crossPartyAlignments: LegislatorAlignmentRow[];
  notableVotes: LegislatorNotableVote[];
  evidence: LegislatorEvidenceRow[];
  campaignFinance?: CampaignFinanceMemberContext;
}

type DirectoryDbRow = {
  legislator_id: string;
  membership_id: string;
  name: string;
  party: string;
  district: string;
  title: string;
  chamber_slug: string;
  chamber_name: string;
  source_url: string | null;
};

type MembershipDbRow = {
  membership_id: string;
  session_name: string;
  session_slug: string;
  chamber_slug: string;
  chamber_name: string;
  party: string;
  district: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  source_url: string | null;
  current: boolean;
};

type VoteSummaryDbRow = {
  recorded_votes: number;
  passage_votes: number;
  yes_votes: number;
  no_votes: number;
  party_comparable_votes: number;
  party_aligned_votes: number;
};

type IssueVoteDbRow = {
  title: string;
  choice: 'yea' | 'nay';
  occurred_on: string;
};

type AlignmentDbRow = {
  legislator_id: string;
  membership_id: string;
  name: string;
  party: string;
  district: string;
  shared_votes: number;
  aligned_votes: number;
  agreement: number;
};

type NotableVoteDbRow = {
  vote_event_id: string;
  occurred_on: string;
  identifier: string | null;
  title: string | null;
  choice: 'yea' | 'nay';
  yea_count: number;
  nay_count: number;
  other_count: number;
  passed: boolean | null;
  margin: number;
};

type EvidenceDbRow = {
  kind: string;
  stance: string | null;
  claim: string;
  excerpt: string | null;
  published_at: string | null;
  source_quality: string;
  confidence: number | null;
  source_url: string;
};

const ISSUE_RULES: Array<{ area: string; patterns: RegExp[] }> = [
  { area: 'education', patterns: [/\beducation\b/i, /\bschool/i, /\bteacher/i, /\bstudent/i, /\bcollege/i, /\buniversity/i] },
  { area: 'health', patterns: [/\bhealth\b/i, /\bmedical\b/i, /\bhospital/i, /\bpatient/i, /\bpharmacy/i, /\bmedicaid\b/i, /\bmncare\b/i] },
  { area: 'human_services', patterns: [/\bhuman services\b/i, /\bchild care\b/i, /\bdisabilit/i, /\bfoster care\b/i, /\bpublic assistance\b/i] },
  { area: 'taxes_revenue', patterns: [/\btax/i, /\brevenue\b/i, /\bcredit\b/i, /\bdeduction\b/i, /\bexemption\b/i] },
  { area: 'public_safety', patterns: [/\bpublic safety\b/i, /\bpolice\b/i, /\blaw enforcement\b/i, /\bcrime\b/i, /\bcriminal\b/i, /\bcorrection/i, /\bfirearm/i] },
  { area: 'housing', patterns: [/\bhousing\b/i, /\btenant/i, /\blandlord/i, /\brent\b/i, /\bresidential\b/i] },
  { area: 'transportation', patterns: [/\btransportation\b/i, /\bhighway\b/i, /\broad\b/i, /\btransit\b/i, /\bvehicle\b/i, /\bdriver/i] },
  { area: 'environment_natural_resources', patterns: [/\benvironment/i, /\bnatural resources\b/i, /\bwater\b/i, /\bclimate\b/i, /\bpollution\b/i, /\bwetland/i] },
  { area: 'labor_employment', patterns: [/\blabor\b/i, /\bemployment\b/i, /\bemployer/i, /\bemployee/i, /\bwage/i, /\bworkplace\b/i] },
  { area: 'elections', patterns: [/\belection/i, /\bballot/i, /\bvoter/i, /\bcampaign\b/i] },
  { area: 'agriculture', patterns: [/\bagricultur/i, /\bfarm/i, /\bcrop\b/i, /\blivestock\b/i] },
  { area: 'commerce_consumer', patterns: [/\bcommerce\b/i, /\bconsumer/i, /\bbusiness\b/i, /\binsurance\b/i, /\blicens/i] },
  { area: 'local_government', patterns: [/\blocal government\b/i, /\bcounty\b/i, /\bmunicipal/i, /\btownship\b/i, /\bcity\b/i] },
  { area: 'judiciary_civil_law', patterns: [/\bjudiciar/i, /\bcourt\b/i, /\bjudge\b/i, /\bcivil law\b/i, /\battorney\b/i] },
  { area: 'state_government', patterns: [/\bstate government\b/i, /\bstate agency\b/i, /\bdepartment\b/i, /\bcommission\b/i] },
];

function directoryRow(row: DirectoryDbRow): LegislatorDirectoryRow {
  return {
    legislatorId: row.legislator_id,
    membershipId: row.membership_id,
    name: row.name,
    party: row.party,
    district: row.district,
    title: row.title,
    chamberSlug: row.chamber_slug,
    chamberName: row.chamber_name,
    sourceUrl: row.source_url ?? undefined,
  };
}

function primaryIssue(title: string): string {
  return ISSUE_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(title)))?.area ?? 'other';
}

export async function loadCurrentLegislators(): Promise<LegislatorDirectoryRow[]> {
  const result = await pool.query<DirectoryDbRow>(`
    SELECT l.id AS legislator_id,
           m.id AS membership_id,
           l.name,
           m.party,
           m.district,
           m.title,
           c.slug AS chamber_slug,
           c.name AS chamber_name,
           m.source_url
      FROM legislative_sessions s
      JOIN memberships m ON m.session_id = s.id
      JOIN legislators l ON l.id = m.legislator_id
      JOIN chambers c ON c.id = m.chamber_id
     WHERE s.is_current = true
       AND (m.starts_on IS NULL OR m.starts_on <= current_date)
       AND (m.ends_on IS NULL OR m.ends_on >= current_date)
     ORDER BY c.kind, c.name, m.district, l.name`);
  return result.rows.map(directoryRow);
}

async function loadCurrentMembership(legislatorId: string): Promise<LegislatorDirectoryRow | undefined> {
  const result = await pool.query<DirectoryDbRow>(`
    SELECT l.id AS legislator_id,
           m.id AS membership_id,
           l.name,
           m.party,
           m.district,
           m.title,
           c.slug AS chamber_slug,
           c.name AS chamber_name,
           m.source_url
      FROM legislative_sessions s
      JOIN memberships m ON m.session_id = s.id
      JOIN legislators l ON l.id = m.legislator_id
      JOIN chambers c ON c.id = m.chamber_id
     WHERE s.is_current = true
       AND l.id = $1
       AND (m.starts_on IS NULL OR m.starts_on <= current_date)
       AND (m.ends_on IS NULL OR m.ends_on >= current_date)
     LIMIT 1`, [legislatorId]);
  return result.rows[0] ? directoryRow(result.rows[0]) : undefined;
}

async function loadMemberships(legislatorId: string): Promise<LegislatorMembershipRow[]> {
  const result = await pool.query<MembershipDbRow>(`
    SELECT m.id AS membership_id,
           s.name AS session_name,
           s.slug AS session_slug,
           c.slug AS chamber_slug,
           c.name AS chamber_name,
           m.party,
           m.district,
           m.title,
           m.starts_on::text,
           m.ends_on::text,
           m.source_url,
           s.is_current
             AND (m.starts_on IS NULL OR m.starts_on <= current_date)
             AND (m.ends_on IS NULL OR m.ends_on >= current_date) AS current
      FROM memberships m
      JOIN legislative_sessions s ON s.id = m.session_id
      JOIN chambers c ON c.id = m.chamber_id
     WHERE m.legislator_id = $1
     ORDER BY s.starts_on DESC NULLS LAST, m.starts_on DESC NULLS LAST`, [legislatorId]);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    sessionName: row.session_name,
    sessionSlug: row.session_slug,
    chamberSlug: row.chamber_slug,
    chamberName: row.chamber_name,
    party: row.party,
    district: row.district,
    title: row.title,
    startsOn: row.starts_on ?? undefined,
    endsOn: row.ends_on ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    current: row.current,
  }));
}

async function loadVoteSummary(legislatorId: string): Promise<LegislatorVoteSummary> {
  const result = await pool.query<VoteSummaryDbRow>(`
    WITH target_votes AS (
      SELECT ve.id AS vote_event_id,
             ve.session_id,
             ve.chamber_id,
             ve.is_passage,
             mv.choice,
             tm.party
        FROM member_votes mv
        JOIN vote_events ve ON ve.id = mv.vote_event_id
        JOIN memberships tm ON tm.id = mv.membership_id
       WHERE tm.legislator_id = $1
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
    )
    SELECT count(*)::int AS recorded_votes,
           count(*) FILTER (WHERE tv.is_passage)::int AS passage_votes,
           count(*) FILTER (WHERE tv.is_passage AND tv.choice = 'yea')::int AS yes_votes,
           count(*) FILTER (WHERE tv.is_passage AND tv.choice = 'nay')::int AS no_votes,
           count(*) FILTER (WHERE pc.yes_count <> pc.no_count)::int AS party_comparable_votes,
           count(*) FILTER (
             WHERE (tv.choice = 'yea' AND pc.yes_count > pc.no_count)
                OR (tv.choice = 'nay' AND pc.no_count > pc.yes_count)
           )::int AS party_aligned_votes
      FROM target_votes tv
      JOIN party_counts pc ON pc.vote_event_id = tv.vote_event_id`, [legislatorId]);
  const row = result.rows[0] ?? {
    recorded_votes: 0,
    passage_votes: 0,
    yes_votes: 0,
    no_votes: 0,
    party_comparable_votes: 0,
    party_aligned_votes: 0,
  };
  return {
    recordedVotes: row.recorded_votes,
    passageVotes: row.passage_votes,
    yesVotes: row.yes_votes,
    noVotes: row.no_votes,
    yesRate: row.passage_votes > 0 ? row.yes_votes / row.passage_votes : undefined,
    partyComparableVotes: row.party_comparable_votes,
    partyAlignedVotes: row.party_aligned_votes,
    partyAlignment: row.party_comparable_votes > 0 ? row.party_aligned_votes / row.party_comparable_votes : undefined,
  };
}

async function loadIssueRows(legislatorId: string): Promise<LegislatorIssueRow[]> {
  const result = await pool.query<IssueVoteDbRow>(`
    SELECT b.title,
           mv.choice,
           ve.occurred_on::text
      FROM member_votes mv
      JOIN memberships m ON m.id = mv.membership_id
      JOIN vote_events ve ON ve.id = mv.vote_event_id
      JOIN bills b ON b.id = ve.bill_id
     WHERE m.legislator_id = $1
       AND mv.choice IN ('yea', 'nay')
     ORDER BY ve.occurred_on DESC`, [legislatorId]);

  const aggregate = new Map<string, { rollCallVotes: number; yesVotes: number; noVotes: number; latestVoteOn?: string }>();
  for (const row of result.rows) {
    const area = primaryIssue(row.title);
    const current = aggregate.get(area) ?? { rollCallVotes: 0, yesVotes: 0, noVotes: 0, latestVoteOn: undefined };
    current.rollCallVotes += 1;
    if (row.choice === 'yea') current.yesVotes += 1;
    if (row.choice === 'nay') current.noVotes += 1;
    if (!current.latestVoteOn || row.occurred_on > current.latestVoteOn) current.latestVoteOn = row.occurred_on;
    aggregate.set(area, current);
  }

  return [...aggregate.entries()]
    .map(([area, row]) => ({
      area,
      rollCallVotes: row.rollCallVotes,
      yesVotes: row.yesVotes,
      noVotes: row.noVotes,
      yesRate: row.rollCallVotes > 0 ? row.yesVotes / row.rollCallVotes : undefined,
      latestVoteOn: row.latestVoteOn,
    }))
    .sort((left, right) => right.rollCallVotes - left.rollCallVotes || left.area.localeCompare(right.area))
    .slice(0, 12);
}

async function loadAlignmentRows(currentMembership: LegislatorDirectoryRow): Promise<LegislatorAlignmentRow[]> {
  const result = await pool.query<AlignmentDbRow>(`
    WITH target_votes AS (
      SELECT mv.vote_event_id, mv.choice
        FROM member_votes mv
       WHERE mv.membership_id = $1
         AND mv.choice IN ('yea', 'nay')
    ), peer_alignment AS (
      SELECT pmv.membership_id,
             count(*)::int AS shared_votes,
             count(*) FILTER (WHERE pmv.choice = tv.choice)::int AS aligned_votes
        FROM target_votes tv
        JOIN member_votes pmv ON pmv.vote_event_id = tv.vote_event_id
       WHERE pmv.membership_id <> $1
         AND pmv.choice IN ('yea', 'nay')
       GROUP BY pmv.membership_id
       HAVING count(*) >= 10
    )
    SELECT l.id AS legislator_id,
           m.id AS membership_id,
           l.name,
           m.party,
           m.district,
           pa.shared_votes,
           pa.aligned_votes,
           (pa.aligned_votes::float8 / NULLIF(pa.shared_votes, 0)) AS agreement
      FROM peer_alignment pa
      JOIN memberships m ON m.id = pa.membership_id
      JOIN legislators l ON l.id = m.legislator_id
     WHERE m.session_id = (SELECT session_id FROM memberships WHERE id = $1)
       AND m.chamber_id = (SELECT chamber_id FROM memberships WHERE id = $1)
     ORDER BY agreement DESC, pa.shared_votes DESC, l.name
     LIMIT 200`, [currentMembership.membershipId]);
  return result.rows.map((row) => ({
    legislatorId: row.legislator_id,
    membershipId: row.membership_id,
    name: row.name,
    party: row.party,
    district: row.district,
    sharedVotes: row.shared_votes,
    alignedVotes: row.aligned_votes,
    agreement: row.agreement,
  }));
}

async function loadNotableVotes(legislatorId: string): Promise<LegislatorNotableVote[]> {
  const result = await pool.query<NotableVoteDbRow>(`
    SELECT ve.id AS vote_event_id,
           ve.occurred_on::text,
           b.identifier,
           b.title,
           mv.choice,
           ve.yea_count,
           ve.nay_count,
           ve.other_count,
           ve.passed,
           abs(ve.yea_count - ve.nay_count)::int AS margin
      FROM member_votes mv
      JOIN memberships m ON m.id = mv.membership_id
      JOIN vote_events ve ON ve.id = mv.vote_event_id
      LEFT JOIN bills b ON b.id = ve.bill_id
     WHERE m.legislator_id = $1
       AND ve.is_passage = true
       AND mv.choice IN ('yea', 'nay')
     ORDER BY abs(ve.yea_count - ve.nay_count), ve.occurred_on DESC
     LIMIT 10`, [legislatorId]);
  return result.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    occurredOn: row.occurred_on,
    identifier: row.identifier ?? undefined,
    title: row.title ?? undefined,
    choice: row.choice,
    yeaCount: row.yea_count,
    nayCount: row.nay_count,
    otherCount: row.other_count,
    passed: row.passed ?? undefined,
    margin: row.margin,
  }));
}

async function loadEvidence(legislatorId: string): Promise<LegislatorEvidenceRow[]> {
  const result = await pool.query<EvidenceDbRow>(`
    SELECT ei.evidence_kind AS kind,
           ei.stance,
           ei.claim,
           ei.excerpt,
           ei.published_at::text,
           ei.source_quality,
           ei.confidence,
           sd.source_url
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id = ei.source_document_id
      JOIN memberships m ON m.id = ei.membership_id
     WHERE m.legislator_id = $1
       AND NOT EXISTS (
         SELECT 1
           FROM evidence_relationships er
          WHERE er.to_evidence_id = ei.id
            AND er.relation_kind = 'supersedes'
       )
     ORDER BY COALESCE(ei.published_at, ei.created_at) DESC
     LIMIT 12`, [legislatorId]);
  return result.rows.map((row) => ({
    kind: row.kind,
    stance: row.stance ?? undefined,
    claim: row.claim,
    excerpt: row.excerpt ?? undefined,
    publishedAt: row.published_at ?? undefined,
    sourceQuality: row.source_quality,
    confidence: row.confidence ?? undefined,
    sourceUrl: row.source_url,
  }));
}

export async function loadLegislatorProfile(legislatorId: string): Promise<LegislatorProfile | undefined> {
  const identityResult = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM legislators WHERE id = $1 LIMIT 1',
    [legislatorId],
  );
  const identity = identityResult.rows[0];
  if (!identity) return undefined;

  const [currentMembership, memberships, voteSummary, issues, notableVotes, evidence] = await Promise.all([
    loadCurrentMembership(legislatorId),
    loadMemberships(legislatorId),
    loadVoteSummary(legislatorId),
    loadIssueRows(legislatorId),
    loadNotableVotes(legislatorId),
    loadEvidence(legislatorId),
  ]);
  const alignments = currentMembership ? await loadAlignmentRows(currentMembership) : [];
  const closestAlignments = alignments.slice(0, 8);
  const crossPartyAlignments = currentMembership
    ? alignments.filter((row) => row.party !== currentMembership.party).slice(0, 6)
    : [];
  const campaignFinance = currentMembership
    ? getCampaignFinanceContextForMember({
        membershipId: currentMembership.membershipId,
        memberName: currentMembership.name,
        chamber: currentMembership.chamberSlug,
      })
    : undefined;

  return {
    legislatorId,
    name: identity.name,
    currentMembership,
    memberships,
    voteSummary,
    issues,
    closestAlignments,
    crossPartyAlignments,
    notableVotes,
    evidence,
    campaignFinance,
  };
}

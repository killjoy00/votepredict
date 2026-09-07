import { pool } from '@/lib/db';
import {
  loadLegislatorProfile,
  type LegislatorAlignmentRow,
  type LegislatorEvidenceRow,
  type LegislatorProfile,
} from './profile';

export interface IssueDossierVote {
  voteEventId: string;
  membershipId: string;
  billId: string;
  identifier: string;
  title: string;
  sourceUrl?: string;
  occurredOn: string;
  voteKind: string;
  isPassage: boolean;
  choice: 'yea' | 'nay';
  yeaCount: number;
  nayCount: number;
  otherCount: number;
  passed?: boolean;
  margin: number;
  partyMajority?: 'yea' | 'nay';
  partyAligned?: boolean;
}

export interface IssueDossierSummary {
  rollCallVotes: number;
  yesVotes: number;
  noVotes: number;
  yesRate?: number;
  passageVotes: number;
  partyComparableVotes: number;
  partyAlignedVotes: number;
  partyAlignment?: number;
  partyBreaks: number;
  distinctBills: number;
}

export interface IssueNewsLead {
  title: string;
  url: string;
  domain?: string;
  publishedAt?: string;
}

export interface LegislatorIssueDossier {
  area: string;
  label: string;
  profile: LegislatorProfile;
  summary: IssueDossierSummary;
  votes: IssueDossierVote[];
  partyBreakVotes: IssueDossierVote[];
  closestVotes: IssueDossierVote[];
  recentVotes: IssueDossierVote[];
  closestAlignments: LegislatorAlignmentRow[];
  crossPartyAlignments: LegislatorAlignmentRow[];
  evidence: LegislatorEvidenceRow[];
  recentNews: IssueNewsLead[];
  newsStatus: 'ok' | 'unavailable' | 'not-applicable';
}

type VoteDbRow = {
  vote_event_id: string;
  membership_id: string;
  bill_id: string;
  identifier: string;
  title: string;
  source_url: string | null;
  occurred_on: string;
  vote_kind: string;
  is_passage: boolean;
  choice: 'yea' | 'nay';
  party: string;
  yea_count: number;
  nay_count: number;
  other_count: number;
  passed: boolean | null;
  party_yes_count: number;
  party_no_count: number;
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

type GdeltArticle = {
  url?: unknown;
  title?: unknown;
  seendate?: unknown;
  domain?: unknown;
};

type GdeltResponse = { articles?: unknown };

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

function primaryIssue(title: string): string {
  return ISSUE_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(title)))?.area ?? 'other';
}

export function issueLabel(area: string): string {
  return area.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function partyMajority(row: VoteDbRow): 'yea' | 'nay' | undefined {
  if (row.party_yes_count > row.party_no_count) return 'yea';
  if (row.party_no_count > row.party_yes_count) return 'nay';
  return undefined;
}

function asVote(row: VoteDbRow): IssueDossierVote {
  const majority = partyMajority(row);
  return {
    voteEventId: row.vote_event_id,
    membershipId: row.membership_id,
    billId: row.bill_id,
    identifier: row.identifier,
    title: row.title,
    sourceUrl: row.source_url ?? undefined,
    occurredOn: row.occurred_on,
    voteKind: row.vote_kind,
    isPassage: row.is_passage,
    choice: row.choice,
    yeaCount: row.yea_count,
    nayCount: row.nay_count,
    otherCount: row.other_count,
    passed: row.passed ?? undefined,
    margin: Math.abs(row.yea_count - row.nay_count),
    partyMajority: majority,
    partyAligned: majority ? row.choice === majority : undefined,
  };
}

async function loadBillLinkedVotes(legislatorId: string): Promise<VoteDbRow[]> {
  const result = await pool.query<VoteDbRow>(`
    WITH target_votes AS (
      SELECT ve.id AS vote_event_id,
             mv.membership_id,
             ve.session_id,
             ve.chamber_id,
             ve.bill_id,
             b.identifier,
             b.title,
             b.source_url,
             ve.occurred_on::text,
             ve.vote_kind,
             ve.is_passage,
             mv.choice,
             m.party,
             ve.yea_count,
             ve.nay_count,
             ve.other_count,
             ve.passed
        FROM member_votes mv
        JOIN memberships m ON m.id = mv.membership_id
        JOIN vote_events ve ON ve.id = mv.vote_event_id
        JOIN bills b ON b.id = ve.bill_id
       WHERE m.legislator_id = $1
         AND mv.choice IN ('yea', 'nay')
    ), party_counts AS (
      SELECT tv.vote_event_id,
             count(*) FILTER (WHERE pmv.choice = 'yea')::int AS party_yes_count,
             count(*) FILTER (WHERE pmv.choice = 'nay')::int AS party_no_count
        FROM target_votes tv
        JOIN member_votes pmv ON pmv.vote_event_id = tv.vote_event_id
        JOIN memberships pm ON pm.id = pmv.membership_id
       WHERE pm.party = tv.party
         AND pm.session_id = tv.session_id
         AND pm.chamber_id = tv.chamber_id
         AND pmv.choice IN ('yea', 'nay')
       GROUP BY tv.vote_event_id
    )
    SELECT tv.*,
           COALESCE(pc.party_yes_count, 0)::int AS party_yes_count,
           COALESCE(pc.party_no_count, 0)::int AS party_no_count
      FROM target_votes tv
      LEFT JOIN party_counts pc ON pc.vote_event_id = tv.vote_event_id
     ORDER BY tv.occurred_on DESC, tv.vote_event_id`, [legislatorId]);
  return result.rows;
}

async function loadIssueAlignments(
  currentMembershipId: string | undefined,
  issueVotes: readonly IssueDossierVote[],
): Promise<LegislatorAlignmentRow[]> {
  if (!currentMembershipId) return [];
  const eventIds = issueVotes
    .filter((vote) => vote.membershipId === currentMembershipId)
    .map((vote) => vote.voteEventId);
  if (eventIds.length === 0) return [];

  const result = await pool.query<AlignmentDbRow>(`
    WITH target_votes AS (
      SELECT mv.vote_event_id, mv.choice
        FROM member_votes mv
       WHERE mv.membership_id = $1
         AND mv.vote_event_id = ANY($2::uuid[])
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
       HAVING count(*) >= 3
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
     LIMIT 40`, [currentMembershipId, eventIds]);

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

async function loadIssueEvidence(legislatorId: string, billIds: readonly string[]): Promise<LegislatorEvidenceRow[]> {
  if (billIds.length === 0) return [];
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
       AND ei.bill_id = ANY($2::uuid[])
     ORDER BY COALESCE(ei.published_at, ei.created_at) DESC
     LIMIT 30`, [legislatorId, billIds]);
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

function compactTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');
  const minute = date.getUTCMinutes().toString().padStart(2, '0');
  const second = date.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function gdeltSeenDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 8) return undefined;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10) || '00';
  const minute = digits.slice(10, 12) || '00';
  const second = digits.slice(12, 14) || '00';
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function loadRecentNews(memberName: string, area: string): Promise<{ items: IssueNewsLead[]; status: LegislatorIssueDossier['newsStatus'] }> {
  if (area === 'other') return { items: [], status: 'not-applicable' };
  const now = new Date();
  const start = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  const query = `\"${memberName}\" ${issueLabel(area)} Minnesota`;
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: '8',
    sort: 'datedesc',
    startdatetime: compactTimestamp(start),
    enddatetime: compactTimestamp(now),
  });

  try {
    const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
      headers: { 'User-Agent': 'VotePredict/2.0 legislator issue dossier' },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) return { items: [], status: 'unavailable' };
    const payload = await response.json() as GdeltResponse;
    const articles = Array.isArray(payload.articles) ? payload.articles as GdeltArticle[] : [];
    const seen = new Set<string>();
    const items = articles.flatMap((article): IssueNewsLead[] => {
      const url = typeof article.url === 'string' ? article.url : undefined;
      const title = typeof article.title === 'string' ? article.title : undefined;
      if (!url || !title || !/^https?:\/\//i.test(url) || seen.has(url)) return [];
      seen.add(url);
      let domain = typeof article.domain === 'string' ? article.domain : undefined;
      if (!domain) {
        try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = undefined; }
      }
      return [{ title, url, domain, publishedAt: gdeltSeenDate(article.seendate) }];
    });
    return { items, status: 'ok' };
  } catch {
    return { items: [], status: 'unavailable' };
  }
}

function summarize(votes: readonly IssueDossierVote[]): IssueDossierSummary {
  const yesVotes = votes.filter((vote) => vote.choice === 'yea').length;
  const noVotes = votes.filter((vote) => vote.choice === 'nay').length;
  const comparable = votes.filter((vote) => vote.partyAligned !== undefined);
  const aligned = comparable.filter((vote) => vote.partyAligned === true).length;
  return {
    rollCallVotes: votes.length,
    yesVotes,
    noVotes,
    yesRate: votes.length > 0 ? yesVotes / votes.length : undefined,
    passageVotes: votes.filter((vote) => vote.isPassage).length,
    partyComparableVotes: comparable.length,
    partyAlignedVotes: aligned,
    partyAlignment: comparable.length > 0 ? aligned / comparable.length : undefined,
    partyBreaks: comparable.length - aligned,
    distinctBills: new Set(votes.map((vote) => vote.billId)).size,
  };
}

export async function loadLegislatorIssueDossier(
  legislatorId: string,
  area: string,
): Promise<LegislatorIssueDossier | undefined> {
  const [profile, rawVotes] = await Promise.all([
    loadLegislatorProfile(legislatorId),
    loadBillLinkedVotes(legislatorId),
  ]);
  if (!profile) return undefined;

  const votes = rawVotes
    .filter((row) => primaryIssue(row.title) === area)
    .map(asVote);
  if (votes.length === 0) return undefined;

  const billIds = [...new Set(votes.map((vote) => vote.billId))];
  const [alignments, evidence, news] = await Promise.all([
    loadIssueAlignments(profile.currentMembership?.membershipId, votes),
    loadIssueEvidence(legislatorId, billIds),
    loadRecentNews(profile.name, area),
  ]);
  const party = profile.currentMembership?.party;
  const closestAlignments = alignments.filter((peer) => !party || peer.party === party).slice(0, 8);
  const crossPartyAlignments = alignments.filter((peer) => party && peer.party !== party).slice(0, 8);
  const partyBreakVotes = votes.filter((vote) => vote.partyAligned === false).slice(0, 16);
  const closestVotes = [...votes]
    .sort((left, right) => left.margin - right.margin || right.occurredOn.localeCompare(left.occurredOn))
    .slice(0, 16);
  const recentVotes = votes.slice(0, 20);

  return {
    area,
    label: issueLabel(area),
    profile,
    summary: summarize(votes),
    votes,
    partyBreakVotes,
    closestVotes,
    recentVotes,
    closestAlignments,
    crossPartyAlignments,
    evidence,
    recentNews: news.items,
    newsStatus: news.status,
  };
}

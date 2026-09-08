import { getCampaignFinanceContextForMember, type CampaignFinanceMemberContext } from '@/evidence/campaign-finance-snapshot';
import { pool } from '@/lib/db';
import {
  classifyGamblingBill,
  gamblingTopicLabel,
  scoreTribalGamingAlignment,
  type GamblingScope,
  type GamblingTopic,
  type TribalAlignmentSignal,
  type TribalGamingAlignment,
} from './policy';

export interface GamblingBillRecord {
  billId: string;
  sessionSlug: string;
  sessionName: string;
  identifier: string;
  title: string;
  sourceUrl?: string;
  scope: GamblingScope;
  topic: GamblingTopic;
  termHits: number;
  voteEvents: number;
  passageVotes: number;
  firstVote?: string;
  lastVote?: string;
}

export interface GamblingVoteRecord {
  voteEventId: string;
  billId: string;
  sessionSlug: string;
  identifier: string;
  title: string;
  sourceUrl?: string;
  scope: GamblingScope;
  topic: GamblingTopic;
  occurredOn: string;
  chamberName: string;
  voteKind: string;
  isPassage: boolean;
  choice: 'yea' | 'nay';
  yeaCount: number;
  nayCount: number;
  otherCount: number;
}

export interface GamblingPublicRecord {
  kind: 'vote' | 'sponsorship' | 'statement';
  topic: GamblingTopic;
  label: string;
  detail: string;
  sourceUrl: string;
  occurredOn?: string;
}

export interface GamblingNewsLead {
  title: string;
  url: string;
  domain?: string;
  publishedAt?: string;
}

export interface GamingFinanceMatch {
  kind: 'contributor' | 'employer' | 'independent_spender';
  name: string;
  amount: number;
  count?: number;
  direction?: string;
  sourceUrl: string;
}

export interface GamblingMemberRow {
  legislatorId: string;
  membershipId: string;
  name: string;
  party: string;
  district: string;
  chamberSlug: string;
  chamberName: string;
  tribalGamingAlignment: TribalGamingAlignment;
}

export interface GamblingBenchmark {
  benchmarkKey: string;
  label: string;
  billIdentifier?: string;
  sessionSlug?: string;
  preferredChoice?: 'yea' | 'nay';
  weight: number;
  sourceOrganization: string;
  sourceUrl: string;
  explanation: string;
}

export interface GamblingDashboardData {
  bills: GamblingBillRecord[];
  members: GamblingMemberRow[];
  benchmarks: GamblingBenchmark[];
  directBillCount: number;
  embeddedBillCount: number;
  mentionBillCount: number;
  recordedVoteEvents: number;
  ratedMemberCount: number;
}

export interface LegislatorGamblingSummary {
  directVotes: number;
  latestVoteOn?: string;
  sportsBettingPosition: string;
  tribalGamingAlignment: TribalGamingAlignment;
}

export interface LegislatorGamblingProfile {
  legislatorId: string;
  name: string;
  party?: string;
  district?: string;
  chamberSlug?: string;
  chamberName?: string;
  votes: GamblingVoteRecord[];
  publicRecord: GamblingPublicRecord[];
  tribalGamingAlignment: TribalGamingAlignment;
  gamingFinance: GamingFinanceMatch[];
  campaignFinance?: CampaignFinanceMemberContext;
  recentNews: GamblingNewsLead[];
  newsStatus: 'ok' | 'unavailable';
  topicSummaries: Array<{ topic: GamblingTopic; label: string; summary: string; signals: number }>;
}

type GamblingBillDbRow = {
  bill_id: string;
  session_slug: string;
  session_name: string;
  identifier: string;
  title: string;
  source_url: string | null;
  raw_text: string | null;
  vote_events: number;
  passage_votes: number;
  first_vote: string | null;
  last_vote: string | null;
};

type CurrentMemberDbRow = {
  legislator_id: string;
  membership_id: string;
  name: string;
  party: string;
  district: string;
  chamber_slug: string;
  chamber_name: string;
};

type BenchmarkVoteDbRow = {
  legislator_id: string;
  benchmark_key: string;
  identifier: string;
  choice: 'yea' | 'nay';
  occurred_on: string;
};

type VoteDbRow = {
  vote_event_id: string;
  bill_id: string;
  session_slug: string;
  identifier: string;
  title: string;
  source_url: string | null;
  occurred_on: string;
  chamber_name: string;
  vote_kind: string;
  is_passage: boolean;
  choice: 'yea' | 'nay';
  yea_count: number;
  nay_count: number;
  other_count: number;
};

type GdeltArticle = { url?: unknown; title?: unknown; seendate?: unknown; domain?: unknown };
type GdeltResponse = { articles?: unknown };

const SEARCH_PATTERNS = [
  '%sports bet%',
  '%sports wager%',
  '%lawful gambling%',
  '%charitable gambling%',
  '%gambling%',
  '%wager%',
  '%lottery%',
  '%casino%',
  '%bingo%',
  '%raffle%',
  '%pull-tab%',
  '%pull tab%',
  '%horse racing%',
  '%historical horse racing%',
  '%pari-mutuel%',
  '%pari mutuel%',
  '%prediction market%',
  '%sweepstakes%',
  '%poker%',
  '%fantasy sports%',
  '%betting on election%',
];

export const TRIBAL_GAMING_BENCHMARKS: GamblingBenchmark[] = [
  {
    benchmarkKey: 'sports-betting-2022',
    label: '2022 tribal-license sports betting framework',
    billIdentifier: 'HF778',
    sessionSlug: '2021-2022',
    preferredChoice: 'yea',
    weight: 2,
    sourceOrganization: 'Minnesota Indian Gaming Association',
    sourceUrl: 'https://www.house.mn.gov/comm/docs/5ZZzt3JCfESBIx3_UQvzFw.pdf',
    explanation: 'MIGA publicly supported HF778, which placed the master mobile sports-betting licenses with tribal entities.',
  },
  {
    benchmarkKey: 'historical-horse-racing-2024',
    label: 'Historical horse racing prohibition',
    billIdentifier: 'SF2219',
    sessionSlug: '2023-2024',
    preferredChoice: 'yea',
    weight: 2.5,
    sourceOrganization: 'Minnesota Indian Gaming Association',
    sourceUrl: 'https://www.house.mn.gov/comm/docs/Gc-B6kBmgkii0LRZ4ymkhg.pdf',
    explanation: 'MIGA opposed historical horse racing expansion at racetracks and supported legislative limits protecting the tribal gaming framework.',
  },
  {
    benchmarkKey: 'sweepstakes-2026',
    label: 'Online sweepstakes casino prohibition',
    billIdentifier: 'SF4474',
    sessionSlug: '2025-2026',
    preferredChoice: 'yea',
    weight: 2,
    sourceOrganization: 'Minnesota Indian Gaming Association',
    sourceUrl: 'https://www.house.mn.gov/comm/docs/w4Mlbjf4ike5s0gq9Ou00A.pdf',
    explanation: 'MIGA supported prohibiting online sweepstakes casino products operating outside Minnesota gaming regulation.',
  },
  {
    benchmarkKey: 'prediction-markets-2026',
    label: 'Prediction-market wagering restrictions',
    billIdentifier: 'SF4511',
    sessionSlug: '2025-2026',
    preferredChoice: 'yea',
    weight: 1.5,
    sourceOrganization: 'Shakopee Mdewakanton Sioux Community',
    sourceUrl: 'https://www.house.mn.gov/comm/docs/X4r5XanzfU6Gs956Dy0uvw.pdf',
    explanation: 'SMSC supported state restrictions on prediction-market sports wagering and described unregulated products as a threat to tribal gaming sovereignty.',
  },
  {
    benchmarkKey: 'sports-betting-2025',
    label: '2025 tribal-led sports betting framework sponsorship',
    weight: 1.25,
    sourceOrganization: 'Minnesota Indian Gaming Association',
    sourceUrl: 'https://www.senate.mn/committees/2025-2026/3134_Committee_on_State_and_Local_Government/20250213_MIGA_Support-Letter.pdf',
    explanation: 'MIGA supported the 2025 framework making tribal nations the exclusive mobile sports-wagering license holders; sponsorship is treated as a lower-weight public-position signal.',
  },
];

const SPONSORSHIP_SIGNALS: Array<{
  benchmarkKey: string;
  names: string[];
  label: string;
  topic: GamblingTopic;
  weight: number;
  sourceUrl: string;
  sourceOrganization: string;
  detail: string;
  occurredOn: string;
}> = [
  {
    benchmarkKey: 'sports-betting-2025',
    names: [
      'Cedrick Rommel Frazier', 'Liish Kozlowski', 'John Huot', 'Brad Tabke', 'Zack Stephenson',
      'Erin Koegel', 'Kari Rehrauer', 'Peter Johnson', 'Matt Norris',
      'Nick A. Frentz', 'Matt D. Klein', 'Eric R. Pratt', 'Mary K. Kunesh', 'Julia E. Coleman',
    ],
    label: 'Sponsored 2025 tribal-led sports betting legislation',
    topic: 'sports_betting',
    weight: 1.25,
    sourceUrl: 'https://www.senate.mn/committees/2025-2026/3134_Committee_on_State_and_Local_Government/20250213_MIGA_Support-Letter.pdf',
    sourceOrganization: 'Minnesota Indian Gaming Association',
    detail: 'Sponsored HF1842/SF757, a sports-wagering framework publicly supported by MIGA and structured around tribal mobile license holders.',
    occurredOn: '2025-02-13',
  },
  {
    benchmarkKey: 'sweepstakes-2026',
    names: [
      'Jordan Rasmusson', 'John J. Marty', 'Erin K. Maye Quade', 'Warren E. Limmer', 'Matt D. Klein',
      'Gregory M. Davids', 'Erin Koegel', 'Ben Bakeberg', 'Ethan Cha', 'Liz Reyer', 'Bianca Ward Virnig', 'Brad Tabke',
    ],
    label: 'Sponsored 2026 sweepstakes prohibition',
    topic: 'sweepstakes',
    weight: 0.75,
    sourceUrl: 'https://www.house.mn.gov/comm/docs/w4Mlbjf4ike5s0gq9Ou00A.pdf',
    sourceOrganization: 'Minnesota Indian Gaming Association',
    detail: 'Sponsored SF4474/HF4410 restricting online sweepstakes casino games; MIGA publicly supported the prohibition.',
    occurredOn: '2026-04-30',
  },
  {
    benchmarkKey: 'prediction-markets-2026',
    names: [
      'John J. Marty', 'Jordan Rasmusson', 'Mary K. Kunesh', 'Erin K. Maye Quade', 'Matt D. Klein',
      'Emma Greenman', 'Peter Fischer', 'Gregory M. Davids', 'Brad Tabke', 'Cedrick Rommel Frazier',
    ],
    label: 'Sponsored 2026 prediction-market restrictions',
    topic: 'prediction_markets',
    weight: 0.75,
    sourceUrl: 'https://www.house.mn.gov/comm/docs/X4r5XanzfU6Gs956Dy0uvw.pdf',
    sourceOrganization: 'Shakopee Mdewakanton Sioux Community',
    detail: 'Sponsored SF4511/HF4437 restricting prediction-market wagering; SMSC publicly supported the legislation on tribal-sovereignty and gaming-regulation grounds.',
    occurredOn: '2026-04-30',
  },
];

const CURATED_STATEMENTS: Record<string, GamblingPublicRecord[]> = {
  'Cedrick Rommel Frazier': [{
    kind: 'statement',
    topic: 'sports_betting',
    label: 'Publicly backed a regulated sports-betting framework',
    detail: 'In a 2025 House release, Frazier described the proposal as a regulated, consumer-protection-focused framework developed with tribal and other stakeholders.',
    sourceUrl: 'https://www.house.mn.gov/members/Profile/News/15548/40260',
    occurredOn: '2025-02-27',
  }],
  'Liish Kozlowski': [{
    kind: 'statement',
    topic: 'sports_betting',
    label: 'Publicly backed the 2025 sports-betting proposal',
    detail: 'A 2025 House release from Kozlowski supported legal sports wagering through the tribal-led legislative framework.',
    sourceUrl: 'https://www.house.mn.gov/members/profile/news/15595/40261',
    occurredOn: '2025-02-27',
  }],
  'Zack Stephenson': [{
    kind: 'statement',
    topic: 'sports_betting',
    label: 'Led the 2022 House sports-betting legalization effort',
    detail: 'During the 2022 House debate, Stephenson argued for moving sports wagering into a legal, regulated marketplace with consumer safeguards.',
    sourceUrl: 'https://www.house.mn.gov/sessiondaily/Story/17445',
    occurredOn: '2022-05-12',
  }],
};

function sponsorshipSignal(memberName: string): TribalAlignmentSignal[] {
  return SPONSORSHIP_SIGNALS.flatMap((entry) => entry.names.includes(memberName) ? [{
    benchmarkKey: entry.benchmarkKey,
    label: entry.label,
    kind: 'sponsorship' as const,
    aligned: true,
    weight: entry.weight,
    occurredOn: entry.occurredOn,
    sourceUrl: entry.sourceUrl,
    sourceOrganization: entry.sourceOrganization,
    detail: entry.detail,
  }] : []);
}

function sponsorshipPublicRecord(memberName: string): GamblingPublicRecord[] {
  return SPONSORSHIP_SIGNALS.flatMap((entry) => entry.names.includes(memberName) ? [{
    kind: 'sponsorship' as const,
    topic: entry.topic,
    label: entry.label,
    detail: entry.detail,
    sourceUrl: entry.sourceUrl,
    occurredOn: entry.occurredOn,
  }] : []);
}

async function loadGamblingBills(): Promise<GamblingBillRecord[]> {
  const result = await pool.query<GamblingBillDbRow>(`
    WITH latest_version AS (
      SELECT DISTINCT ON (bv.bill_id)
             bv.bill_id,
             bv.raw_text
        FROM bill_versions bv
       WHERE bv.raw_text IS NOT NULL
       ORDER BY bv.bill_id, bv.published_at DESC NULLS LAST, bv.created_at DESC
    ), vote_summary AS (
      SELECT ve.bill_id,
             count(*)::int AS vote_events,
             count(*) FILTER (WHERE ve.is_passage)::int AS passage_votes,
             min(ve.occurred_on)::text AS first_vote,
             max(ve.occurred_on)::text AS last_vote
        FROM vote_events ve
       GROUP BY ve.bill_id
    )
    SELECT b.id AS bill_id,
           s.slug AS session_slug,
           s.name AS session_name,
           b.identifier,
           b.title,
           b.source_url,
           lv.raw_text,
           COALESCE(vs.vote_events, 0)::int AS vote_events,
           COALESCE(vs.passage_votes, 0)::int AS passage_votes,
           vs.first_vote,
           vs.last_vote
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      LEFT JOIN latest_version lv ON lv.bill_id = b.id
      LEFT JOIN vote_summary vs ON vs.bill_id = b.id
     WHERE lower(COALESCE(b.title, '')) LIKE ANY($1::text[])
        OR lower(COALESCE(lv.raw_text, '')) LIKE ANY($1::text[])
     ORDER BY s.starts_on, b.identifier`, [SEARCH_PATTERNS]);

  return result.rows.flatMap((row) => {
    const classification = classifyGamblingBill(row.title, row.raw_text ?? '');
    if (!classification) return [];
    return [{
      billId: row.bill_id,
      sessionSlug: row.session_slug,
      sessionName: row.session_name,
      identifier: row.identifier,
      title: row.title,
      sourceUrl: row.source_url ?? undefined,
      scope: classification.scope,
      topic: classification.topic,
      termHits: classification.termHits,
      voteEvents: row.vote_events,
      passageVotes: row.passage_votes,
      firstVote: row.first_vote ?? undefined,
      lastVote: row.last_vote ?? undefined,
    }];
  });
}

async function loadCurrentMembers(): Promise<CurrentMemberDbRow[]> {
  const result = await pool.query<CurrentMemberDbRow>(`
    SELECT l.id AS legislator_id,
           m.id AS membership_id,
           l.name,
           m.party,
           m.district,
           c.slug AS chamber_slug,
           c.name AS chamber_name
      FROM legislative_sessions s
      JOIN memberships m ON m.session_id = s.id
      JOIN legislators l ON l.id = m.legislator_id
      JOIN chambers c ON c.id = m.chamber_id
     WHERE s.is_current = true
       AND (m.starts_on IS NULL OR m.starts_on <= current_date)
       AND (m.ends_on IS NULL OR m.ends_on >= current_date)
     ORDER BY c.kind, m.district, l.name`);
  return result.rows;
}

async function loadBenchmarkVotes(): Promise<BenchmarkVoteDbRow[]> {
  const result = await pool.query<BenchmarkVoteDbRow>(`
    WITH benchmark_def(session_slug, identifier, benchmark_key) AS (
      VALUES
        ('2021-2022', 'HF778', 'sports-betting-2022'),
        ('2023-2024', 'SF2219', 'historical-horse-racing-2024'),
        ('2025-2026', 'SF4474', 'sweepstakes-2026'),
        ('2025-2026', 'SF4511', 'prediction-markets-2026')
    )
    SELECT DISTINCT ON (m.legislator_id, bd.benchmark_key)
           m.legislator_id,
           bd.benchmark_key,
           b.identifier,
           mv.choice,
           ve.occurred_on::text
      FROM benchmark_def bd
      JOIN legislative_sessions s ON s.slug = bd.session_slug
      JOIN bills b ON b.session_id = s.id AND b.identifier = bd.identifier
      JOIN vote_events ve ON ve.bill_id = b.id
      JOIN member_votes mv ON mv.vote_event_id = ve.id
      JOIN memberships m ON m.id = mv.membership_id
     WHERE mv.choice IN ('yea', 'nay')
     ORDER BY m.legislator_id, bd.benchmark_key, ve.occurred_on DESC`);
  return result.rows;
}

function benchmarkVoteSignal(row: BenchmarkVoteDbRow): TribalAlignmentSignal | undefined {
  const benchmark = TRIBAL_GAMING_BENCHMARKS.find((item) => item.benchmarkKey === row.benchmark_key);
  if (!benchmark?.preferredChoice) return undefined;
  return {
    benchmarkKey: benchmark.benchmarkKey,
    label: `${benchmark.label}: ${row.choice.toUpperCase()} vote`,
    kind: 'vote',
    aligned: row.choice === benchmark.preferredChoice,
    weight: benchmark.weight,
    occurredOn: row.occurred_on,
    sourceUrl: benchmark.sourceUrl,
    sourceOrganization: benchmark.sourceOrganization,
    detail: `${row.identifier} recorded vote was ${row.choice.toUpperCase()}; documented benchmark position is ${benchmark.preferredChoice.toUpperCase()}.`,
  };
}

function signalsForMember(member: CurrentMemberDbRow, benchmarkVotes: readonly BenchmarkVoteDbRow[]): TribalAlignmentSignal[] {
  const voteSignals = benchmarkVotes
    .filter((row) => row.legislator_id === member.legislator_id)
    .flatMap((row) => {
      const signal = benchmarkVoteSignal(row);
      return signal ? [signal] : [];
    });
  return [...voteSignals, ...sponsorshipSignal(member.name)];
}

async function loadMemberVotes(legislatorId: string, bills: readonly GamblingBillRecord[]): Promise<GamblingVoteRecord[]> {
  const substantiveBills = bills.filter((bill) => bill.scope !== 'mention');
  const billIds = substantiveBills.map((bill) => bill.billId);
  if (billIds.length === 0) return [];
  const byId = new Map(substantiveBills.map((bill) => [bill.billId, bill]));
  const result = await pool.query<VoteDbRow>(`
    SELECT ve.id AS vote_event_id,
           b.id AS bill_id,
           s.slug AS session_slug,
           b.identifier,
           b.title,
           b.source_url,
           ve.occurred_on::text,
           c.name AS chamber_name,
           ve.vote_kind,
           ve.is_passage,
           mv.choice,
           ve.yea_count,
           ve.nay_count,
           ve.other_count
      FROM member_votes mv
      JOIN memberships m ON m.id = mv.membership_id
      JOIN vote_events ve ON ve.id = mv.vote_event_id
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
     WHERE m.legislator_id = $1
       AND ve.bill_id = ANY($2::uuid[])
       AND mv.choice IN ('yea', 'nay')
     ORDER BY ve.occurred_on DESC, b.identifier`, [legislatorId, billIds]);
  return result.rows.flatMap((row) => {
    const bill = byId.get(row.bill_id);
    if (!bill) return [];
    return [{
      voteEventId: row.vote_event_id,
      billId: row.bill_id,
      sessionSlug: row.session_slug,
      identifier: row.identifier,
      title: row.title,
      sourceUrl: row.source_url ?? undefined,
      scope: bill.scope,
      topic: bill.topic,
      occurredOn: row.occurred_on,
      chamberName: row.chamber_name,
      voteKind: row.vote_kind,
      isPassage: row.is_passage,
      choice: row.choice,
      yeaCount: row.yea_count,
      nayCount: row.nay_count,
      otherCount: row.other_count,
    }];
  });
}

function publicVoteRecords(votes: readonly GamblingVoteRecord[]): GamblingPublicRecord[] {
  const latestByBill = new Map<string, GamblingVoteRecord>();
  for (const vote of votes) {
    if (!latestByBill.has(vote.billId)) latestByBill.set(vote.billId, vote);
  }
  return [...latestByBill.values()].map((vote) => ({
    kind: 'vote' as const,
    topic: vote.topic,
    label: `${vote.choice === 'yea' ? 'Voted Yes' : 'Voted No'} on ${vote.identifier}`,
    detail: `${vote.title} (${vote.chamberName}, ${vote.occurredOn}; chamber tally ${vote.yeaCount}-${vote.nayCount}).`,
    sourceUrl: vote.sourceUrl ?? 'https://www.leg.mn.gov/',
    occurredOn: vote.occurredOn,
  }));
}

function topicSummary(topic: GamblingTopic, records: readonly GamblingPublicRecord[]): string {
  const matching = records.filter((record) => record.topic === topic);
  if (matching.length === 0) return 'No clear public record in the VotePredict corpus yet.';
  const sponsorship = matching.find((record) => record.kind === 'sponsorship');
  const statement = matching.find((record) => record.kind === 'statement');
  const latestVote = matching.find((record) => record.kind === 'vote');
  return statement?.label ?? sponsorship?.label ?? latestVote?.label ?? matching[0].label;
}

function gamingFinanceMatches(context: CampaignFinanceMemberContext | undefined): GamingFinanceMatch[] {
  if (!context) return [];
  const keyword = /(gaming|casino|canterbury|running aces|tribal|tribe|indian|mdewakanton|shakopee|miga|draftkings|fanduel|betmgm|sportsbook|wager)/i;
  const matches: GamingFinanceMatch[] = [];
  const contributionUrl = context.contributions?.sourceUrl;
  if (context.contributions && contributionUrl) {
    for (const item of context.contributions.topContributors) {
      if (keyword.test(`${item.name} ${item.employer ?? ''}`)) {
        matches.push({ kind: 'contributor', name: item.name, amount: item.amount, count: item.count, sourceUrl: contributionUrl });
      }
    }
    for (const item of context.contributions.topEmployers) {
      if (keyword.test(item.name)) {
        matches.push({ kind: 'employer', name: item.name, amount: item.amount, count: item.count, sourceUrl: contributionUrl });
      }
    }
  }
  const independentUrl = context.independentExpenditures?.sourceUrl;
  if (context.independentExpenditures && independentUrl) {
    for (const item of context.independentExpenditures.topSpenders) {
      if (keyword.test(item.name)) {
        matches.push({ kind: 'independent_spender', name: item.name, amount: item.amount, count: item.count, direction: item.direction, sourceUrl: independentUrl });
      }
    }
  }
  return matches.sort((left, right) => right.amount - left.amount).slice(0, 12);
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

async function loadRecentGamblingNews(memberName: string): Promise<{ items: GamblingNewsLead[]; status: 'ok' | 'unavailable' }> {
  const now = new Date();
  const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const query = `\"${memberName}\" (gambling OR \"sports betting\" OR wagering OR casino OR sweepstakes OR \"prediction market\" OR \"horse racing\") Minnesota`;
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: '10',
    sort: 'datedesc',
    startdatetime: compactTimestamp(start),
    enddatetime: compactTimestamp(now),
  });
  try {
    const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
      headers: { 'User-Agent': 'VotePredict/2.0 gambling intelligence' },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) return { items: [], status: 'unavailable' };
    const payload = await response.json() as GdeltResponse;
    const articles = Array.isArray(payload.articles) ? payload.articles as GdeltArticle[] : [];
    const seen = new Set<string>();
    const items = articles.flatMap((article): GamblingNewsLead[] => {
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

function sportsBettingPosition(records: readonly GamblingPublicRecord[]): string {
  const sports = records.filter((record) => record.topic === 'sports_betting');
  const sponsored = sports.find((record) => record.kind === 'sponsorship');
  if (sponsored) return 'Public record supports a tribal-led legal sports-betting framework.';
  const yes = sports.find((record) => record.kind === 'vote' && record.label.startsWith('Voted Yes'));
  if (yes) return 'Recorded vote supports legal sports betting in the tribal-license framework considered by the Legislature.';
  const no = sports.find((record) => record.kind === 'vote' && record.label.startsWith('Voted No'));
  if (no) return 'Recorded vote opposed the 2022 tribal-license sports-betting bill.';
  return 'No clear sports-betting position in the recorded corpus yet.';
}

export async function loadGamblingDashboard(): Promise<GamblingDashboardData> {
  const [bills, members, benchmarkVotes] = await Promise.all([
    loadGamblingBills(),
    loadCurrentMembers(),
    loadBenchmarkVotes(),
  ]);
  const memberRows = members.map((member) => ({
    legislatorId: member.legislator_id,
    membershipId: member.membership_id,
    name: member.name,
    party: member.party,
    district: member.district,
    chamberSlug: member.chamber_slug,
    chamberName: member.chamber_name,
    tribalGamingAlignment: scoreTribalGamingAlignment(signalsForMember(member, benchmarkVotes)),
  })).sort((left, right) => {
    const scoreOrder = (right.tribalGamingAlignment.score ?? -1) - (left.tribalGamingAlignment.score ?? -1);
    return scoreOrder || right.tribalGamingAlignment.observedWeight - left.tribalGamingAlignment.observedWeight || left.name.localeCompare(right.name);
  });

  return {
    bills,
    members: memberRows,
    benchmarks: TRIBAL_GAMING_BENCHMARKS,
    directBillCount: bills.filter((bill) => bill.scope === 'direct').length,
    embeddedBillCount: bills.filter((bill) => bill.scope === 'embedded').length,
    mentionBillCount: bills.filter((bill) => bill.scope === 'mention').length,
    recordedVoteEvents: bills.reduce((sum, bill) => sum + bill.voteEvents, 0),
    ratedMemberCount: memberRows.filter((member) => member.tribalGamingAlignment.score !== undefined).length,
  };
}

export async function loadLegislatorGamblingSummary(legislatorId: string): Promise<LegislatorGamblingSummary | undefined> {
  const [bills, members, benchmarkVotes] = await Promise.all([
    loadGamblingBills(),
    loadCurrentMembers(),
    loadBenchmarkVotes(),
  ]);
  const member = members.find((row) => row.legislator_id === legislatorId);
  if (!member) return undefined;
  const votes = await loadMemberVotes(legislatorId, bills);
  const records = [...publicVoteRecords(votes), ...sponsorshipPublicRecord(member.name), ...(CURATED_STATEMENTS[member.name] ?? [])];
  const directVotes = votes.filter((vote) => vote.scope === 'direct').length;
  return {
    directVotes,
    latestVoteOn: votes[0]?.occurredOn,
    sportsBettingPosition: sportsBettingPosition(records),
    tribalGamingAlignment: scoreTribalGamingAlignment(signalsForMember(member, benchmarkVotes)),
  };
}

export async function loadLegislatorGamblingProfile(legislatorId: string): Promise<LegislatorGamblingProfile | undefined> {
  const [bills, members, benchmarkVotes] = await Promise.all([
    loadGamblingBills(),
    loadCurrentMembers(),
    loadBenchmarkVotes(),
  ]);
  const member = members.find((row) => row.legislator_id === legislatorId);
  const identity = member ?? (await pool.query<{ legislator_id: string; name: string }>(
    'SELECT id AS legislator_id, name FROM legislators WHERE id = $1 LIMIT 1',
    [legislatorId],
  )).rows[0];
  if (!identity) return undefined;

  const votes = await loadMemberVotes(legislatorId, bills);
  const name = member?.name ?? identity.name;
  const publicRecord = [
    ...(CURATED_STATEMENTS[name] ?? []),
    ...sponsorshipPublicRecord(name),
    ...publicVoteRecords(votes),
  ].sort((left, right) => (right.occurredOn ?? '').localeCompare(left.occurredOn ?? ''));
  const tribalGamingAlignment = member
    ? scoreTribalGamingAlignment(signalsForMember(member, benchmarkVotes))
    : scoreTribalGamingAlignment([]);
  const campaignFinance = member
    ? getCampaignFinanceContextForMember({ membershipId: member.membership_id, memberName: member.name, chamber: member.chamber_slug })
    : undefined;
  const [news] = await Promise.all([loadRecentGamblingNews(name)]);
  const topics = [...new Set(publicRecord.map((record) => record.topic))];
  const topicSummaries = topics.map((topic) => ({
    topic,
    label: gamblingTopicLabel(topic),
    summary: topicSummary(topic, publicRecord),
    signals: publicRecord.filter((record) => record.topic === topic).length,
  }));

  return {
    legislatorId,
    name,
    party: member?.party,
    district: member?.district,
    chamberSlug: member?.chamber_slug,
    chamberName: member?.chamber_name,
    votes,
    publicRecord,
    tribalGamingAlignment,
    gamingFinance: gamingFinanceMatches(campaignFinance),
    campaignFinance,
    recentNews: news.items,
    newsStatus: news.status,
    topicSummaries,
  };
}

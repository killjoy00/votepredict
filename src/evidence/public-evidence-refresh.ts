import { pool } from '@/lib/db';
import { persistDurableEvidence, type DurableEvidenceFreshness } from './durable-ingestion';
import { discoverMinnesotaCampaignSites, filingMatchesMember, selectCampaignContentLinks, type CampaignSiteFiling } from './campaign-site-discovery';
import { runLiveCampaignFinanceRefresh } from './live-campaign-finance-refresh';
import {
  discoverMemberPrimarySource,
  fetchSenateMemberPrimaryDirectory,
  memberPrimaryArticleMatches,
  memberPrimaryPublishedAt,
  selectMemberPrimaryArticleCandidates,
  type MemberPrimaryDiscovery,
  type SenateMemberPrimaryDirectories,
} from './member-primary';
import { fetchPublicPage, publicPageMentionsPerson, type PublicPage } from './public-http';
import {
  discoverMemberNewsBatch,
  fetchNewsLeadPage,
  newsDiscoveryProviderLabel,
  newsPublicationDateSource,
  type NewsLead,
} from './public-news';

const PIPELINE_VERSION = 'public-evidence-v2';
const DEFAULT_BATCH = 12;
const MAX_BATCH = 24;
const NEWS_PER_MEMBER = 2;
const NEWS_DISCOVERY_GROUP_SIZE = 6;
const NEWS_FETCH_CONCURRENCY = 4;
const CAMPAIGN_PAGES_PER_MEMBER = 3;
const MEMBER_PRIMARY_ARTICLES_PER_MEMBER = 3;
const MEMBER_PRIMARY_CANDIDATE_LIMIT = 10;
const FINANCE_REFRESH_AFTER_HOURS = 18;
const MAX_DIAGNOSTIC_ROWS = 24;

export interface PublicEvidenceRefreshOptions {
  batchSize?: number;
  forceCampaignFinance?: boolean;
  now?: Date;
}

type MembershipRow = {
  membership_id: string;
  legislator_id: string;
  name: string;
  external_key: string;
  chamber_slug: 'house' | 'senate';
  party: string;
  district: string;
};

type MembershipBatch = {
  memberships: MembershipRow[];
  rotationOffset: number;
  rotationNextOffset: number;
  totalMemberships: number;
};

type StreamResult = {
  attempted: number;
  inserted: number;
  reused: number;
  failures: number;
  unresolved: number;
};

type FailureDetail = {
  member: string;
  stage: string;
  message: string;
};

function emptyStream(): StreamResult {
  return { attempted: 0, inserted: 0, reused: 0, failures: 0, unresolved: 0 };
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 600);
}

function pushDiagnostic<T>(target: T[], value: T): void {
  if (target.length < MAX_DIAGNOSTIC_ROWS) target.push(value);
}

function freshness(value: string | undefined, now: Date): DurableEvidenceFreshness {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  if (ageDays <= 45) return 'current';
  if (ageDays <= 365) return 'recent';
  return 'stale';
}

async function startRun(batchSize: number): Promise<string> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ('public-evidence-pipeline',$1,'running',$2::jsonb)
    RETURNING id::text`, [
    `current-members:batch-${batchSize}`,
    JSON.stringify({ pipelineVersion: PIPELINE_VERSION, execution: 'vercel-runtime' }),
  ]);
  return result.rows[0].id;
}

async function finishRun(id: string, status: 'complete' | 'failed', metadata: Record<string, unknown>, error?: string): Promise<void> {
  await pool.query(`
    UPDATE ingestion_runs
       SET status=$2, finished_at=now(), metadata=metadata || $3::jsonb, error_summary=$4
     WHERE id=$1::uuid`, [id, status, JSON.stringify(metadata), error ?? null]);
}

async function selectMembershipBatch(batchSize: number): Promise<MembershipBatch> {
  const membershipResult = await pool.query<MembershipRow>(`
    SELECT m.id::text AS membership_id,
           m.legislator_id::text AS legislator_id,
           l.name,
           l.external_key,
           c.slug AS chamber_slug,
           m.party,
           m.district
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN chambers c ON c.id=m.chamber_id
     WHERE s.is_current=true
       AND (m.starts_on IS NULL OR m.starts_on<=current_date)
       AND (m.ends_on IS NULL OR m.ends_on>=current_date)
     ORDER BY l.name,m.id`);

  const all = membershipResult.rows;
  if (all.length === 0) {
    return { memberships: [], rotationOffset: 0, rotationNextOffset: 0, totalMemberships: 0 };
  }

  const cursorResult = await pool.query<{ rotation_next_offset: number | null }>(`
    SELECT CASE
             WHEN metadata->>'rotationNextOffset' ~ '^[0-9]+$'
               THEN (metadata->>'rotationNextOffset')::int
             ELSE 0
           END AS rotation_next_offset
      FROM ingestion_runs
     WHERE source_system='public-evidence-pipeline'
       AND status='complete'
     ORDER BY finished_at DESC NULLS LAST
     LIMIT 1`);
  const requestedOffset = cursorResult.rows[0]?.rotation_next_offset ?? 0;
  const rotationOffset = ((requestedOffset % all.length) + all.length) % all.length;
  const memberships = all.slice(rotationOffset, rotationOffset + batchSize);
  if (memberships.length < Math.min(batchSize, all.length)) {
    memberships.push(...all.slice(0, Math.min(batchSize, all.length) - memberships.length));
  }
  const rotationNextOffset = (rotationOffset + memberships.length) % all.length;
  return { memberships, rotationOffset, rotationNextOffset, totalMemberships: all.length };
}

async function campaignFinanceDue(now: Date, force: boolean): Promise<boolean> {
  if (force) return true;
  const result = await pool.query<{ finished_at: string | null }>(`
    SELECT finished_at::text
      FROM ingestion_runs
     WHERE source_system='mn-cfb-live' AND status='complete'
     ORDER BY finished_at DESC NULLS LAST
     LIMIT 1`);
  const latest = result.rows[0]?.finished_at ? new Date(result.rows[0].finished_at) : undefined;
  return !latest || Number.isNaN(latest.getTime()) || now.getTime() - latest.getTime() >= FINANCE_REFRESH_AFTER_HOURS * 3_600_000;
}

function matchingFilings(member: MembershipRow, filings: readonly CampaignSiteFiling[]): CampaignSiteFiling[] {
  return filings.filter((filing) => filingMatchesMember(filing, {
    name: member.name,
    chamber: member.chamber_slug,
    district: member.district,
  }));
}

async function persistCampaignRegistry(member: MembershipRow, filing: CampaignSiteFiling, source: Awaited<ReturnType<typeof discoverMinnesotaCampaignSites>>['filingSource']) {
  return persistDurableEvidence({
    sourceKind: 'campaign_site_registry',
    sourceUrl: source.finalUrl,
    contentSha256: source.contentSha256,
    fetchedAt: source.fetchedAt,
    httpStatus: source.httpStatus,
    metadata: {
      pipelineVersion: PIPELINE_VERSION,
      publisher: 'Minnesota Secretary of State',
      registryKind: 'candidate_filing_campaign_website',
      contentType: source.contentType,
    },
  }, [{
    target: { membershipId: member.membership_id },
    kind: 'context',
    stance: 'neutral',
    claim: `Minnesota Secretary of State candidate filing lists campaign website ${filing.website}.`,
    publishedAt: filing.filingDate ? new Date(`${filing.filingDate} 12:00:00 UTC`).toISOString() : undefined,
    sourceQuality: 'official',
    relevance: 'low',
    freshness: freshness(filing.filingDate ? new Date(`${filing.filingDate} 12:00:00 UTC`).toISOString() : undefined, new Date()),
    extractionMethod: 'deterministic-mn-sos-candidate-filing',
    extractionVersion: PIPELINE_VERSION,
    confidence: 1,
    metadata: {
      contextType: 'public_evidence',
      subtype: 'campaign_site_registry',
      campaignWebsite: filing.website,
      filedCandidateName: filing.candidateName,
      district: filing.district,
      chamber: filing.chamber,
      contextOnly: true,
      mechanicallyActionable: false,
      evidenceSeriesKey: `campaign_site_registry:membership:${member.membership_id}`,
    },
  }]);
}

async function persistCampaignPage(member: MembershipRow, pageUrl: string, now: Date) {
  const page = await fetchPublicPage(pageUrl, {
    timeoutMs: 12_000,
    maxBytes: 1_500_000,
    userAgent: 'VotePredict/2.0 campaign-site-evidence',
  });
  const path = new URL(page.canonicalUrl).pathname.replace(/\/+$/, '') || '/';
  return persistDurableEvidence({
    sourceKind: 'campaign_site',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: PIPELINE_VERSION,
      contentType: page.contentType,
      bytes: page.bytes,
      title: page.title,
    },
  }, [{
    target: { membershipId: member.membership_id },
    kind: 'context',
    stance: 'neutral',
    claim: page.title ? `Campaign-site page: ${page.title}` : `Campaign-site page captured from ${new URL(page.canonicalUrl).hostname}.`,
    excerpt: page.excerpt,
    publishedAt: page.publishedAt,
    sourceQuality: 'member_primary',
    relevance: 'medium',
    freshness: freshness(page.publishedAt ?? page.fetchedAt, now),
    extractionMethod: 'deterministic-public-page-capture',
    extractionVersion: PIPELINE_VERSION,
    confidence: 1,
    metadata: {
      contextType: 'public_evidence',
      subtype: 'campaign_site_page',
      pagePath: path,
      contextOnly: true,
      mechanicallyActionable: false,
      evidenceSeriesKey: `campaign_site_page:membership:${member.membership_id}:path:${path}`,
    },
  }]);
}

async function refreshCampaignMember(
  member: MembershipRow,
  filing: CampaignSiteFiling,
  now: Date,
  failureDetails: FailureDetail[],
): Promise<StreamResult> {
  const result = emptyStream();
  try {
    const home = await fetchPublicPage(filing.website, {
      timeoutMs: 12_000,
      maxBytes: 1_500_000,
      userAgent: 'VotePredict/2.0 campaign-site-evidence',
    });
    const urls = [home.canonicalUrl, ...selectCampaignContentLinks(home, CAMPAIGN_PAGES_PER_MEMBER - 1)];
    for (const url of urls.slice(0, CAMPAIGN_PAGES_PER_MEMBER)) {
      result.attempted += 1;
      try {
        const persisted = await persistCampaignPage(member, url, now);
        result.inserted += persisted.inserted;
        result.reused += persisted.reused;
        result.unresolved += persisted.unresolvedTargets.length;
      } catch (error) {
        result.failures += 1;
        pushDiagnostic(failureDetails, { member: member.name, stage: 'page-fetch-or-persist', message: safeMessage(error) });
      }
    }
  } catch (error) {
    result.attempted += 1;
    result.failures += 1;
    pushDiagnostic(failureDetails, { member: member.name, stage: 'home-fetch', message: safeMessage(error) });
  }
  return result;
}


async function persistMemberPrimaryRegistry(
  member: MembershipRow,
  discovery: MemberPrimaryDiscovery,
  now: Date,
) {
  const page = discovery.registryPage;
  const registryQuality = discovery.hostKind === 'house_official' ? 'official' as const : 'member_primary' as const;
  return persistDurableEvidence({
    sourceKind: 'member_primary_registry',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: PIPELINE_VERSION,
      publisher: discovery.publisher,
      hostKind: discovery.hostKind,
      registryKind: 'member_primary_source',
      contentType: page.contentType,
      bytes: page.bytes,
      title: page.title,
    },
  }, [{
    target: { membershipId: member.membership_id },
    kind: 'context',
    stance: 'neutral',
    claim: `${discovery.publisher} member-primary source registry for ${member.name}.`,
    excerpt: page.excerpt,
    sourceQuality: registryQuality,
    relevance: 'low',
    freshness: freshness(page.fetchedAt, now),
    extractionMethod: 'deterministic-member-primary-registry',
    extractionVersion: PIPELINE_VERSION,
    confidence: 1,
    metadata: {
      contextType: 'public_evidence',
      subtype: 'member_primary_registry',
      publisher: discovery.publisher,
      hostKind: discovery.hostKind,
      sourceVerified: true,
      contextOnly: true,
      mechanicallyActionable: false,
      evidenceSeriesKey: `member_primary_registry:membership:${member.membership_id}:host:${discovery.hostKind}`,
    },
  }]);
}

async function persistMemberPrimaryArticlePage(
  member: MembershipRow,
  discovery: MemberPrimaryDiscovery,
  page: PublicPage,
  now: Date,
) {
  const publishedAt = memberPrimaryPublishedAt(page);
  if (publishedAt && new Date(publishedAt).getTime() > now.getTime() + 86_400_000) {
    throw new Error('Member-primary publication timestamp is implausibly in the future');
  }
  const path = new URL(page.canonicalUrl).pathname.replace(/\/+$/, '') || '/';
  return persistDurableEvidence({
    sourceKind: 'member_primary_article',
    sourceUrl: page.canonicalUrl,
    contentSha256: page.contentSha256,
    fetchedAt: page.fetchedAt,
    httpStatus: page.httpStatus,
    metadata: {
      pipelineVersion: PIPELINE_VERSION,
      publisher: discovery.publisher,
      hostKind: discovery.hostKind,
      contentType: page.contentType,
      bytes: page.bytes,
      title: page.title,
    },
  }, [{
    target: { membershipId: member.membership_id },
    kind: 'context',
    stance: 'neutral',
    claim: page.title
      ? `Member-primary publication: ${page.title}`
      : `Member-primary publication captured from ${new URL(page.canonicalUrl).hostname}.`,
    excerpt: page.excerpt,
    publishedAt,
    sourceQuality: 'member_primary',
    relevance: 'medium',
    freshness: freshness(publishedAt ?? page.fetchedAt, now),
    extractionMethod: 'deterministic-member-primary-page-capture',
    extractionVersion: PIPELINE_VERSION,
    confidence: 1,
    metadata: {
      contextType: 'public_evidence',
      subtype: 'member_primary_article',
      publisher: discovery.publisher,
      hostKind: discovery.hostKind,
      articlePath: path,
      sourceVerified: true,
      contextOnly: true,
      mechanicallyActionable: false,
      evidenceSeriesKey: `member_primary_article:membership:${member.membership_id}:url:${page.canonicalUrl}`,
    },
  }]);
}

async function refreshMemberPrimaryMember(
  member: MembershipRow,
  directories: SenateMemberPrimaryDirectories,
  now: Date,
  failureDetails: FailureDetail[],
  noSourceMembers: string[],
  noArticleMembers: string[],
): Promise<StreamResult> {
  const result = emptyStream();
  let discovery: MemberPrimaryDiscovery;
  result.attempted += 1;
  try {
    discovery = await discoverMemberPrimarySource(member, directories);
  } catch (error) {
    result.failures += 1;
    pushDiagnostic(noSourceMembers, member.name);
    pushDiagnostic(failureDetails, { member: member.name, stage: 'source-discovery', message: safeMessage(error) });
    return result;
  }

  try {
    const registry = await persistMemberPrimaryRegistry(member, discovery, now);
    result.inserted += registry.inserted;
    result.reused += registry.reused;
    result.unresolved += registry.unresolvedTargets.length;
  } catch (error) {
    result.failures += 1;
    pushDiagnostic(failureDetails, { member: member.name, stage: 'registry-persist', message: safeMessage(error) });
  }

  const candidates = selectMemberPrimaryArticleCandidates(discovery, member, MEMBER_PRIMARY_CANDIDATE_LIMIT);
  let accepted = 0;
  for (const url of candidates) {
    if (accepted >= MEMBER_PRIMARY_ARTICLES_PER_MEMBER) break;
    result.attempted += 1;
    try {
      const page = await fetchPublicPage(url, {
        timeoutMs: 12_000,
        maxBytes: 1_500_000,
        userAgent: 'VotePredict/2.0 member-primary-evidence',
      });
      if (!memberPrimaryArticleMatches(page, discovery, member)) continue;
      const persisted = await persistMemberPrimaryArticlePage(member, discovery, page, now);
      result.inserted += persisted.inserted;
      result.reused += persisted.reused;
      result.unresolved += persisted.unresolvedTargets.length;
      accepted += 1;
    } catch (error) {
      result.failures += 1;
      pushDiagnostic(failureDetails, {
        member: member.name,
        stage: 'article-fetch-or-persist',
        message: `${url}: ${safeMessage(error)}`.slice(0, 600),
      });
    }
  }
  if (accepted === 0) pushDiagnostic(noArticleMembers, member.name);
  return result;
}

async function refreshNewsGroup(
  members: MembershipRow[],
  now: Date,
  failureDetails: FailureDetail[],
  noLeadMembers: string[],
  warnings: string[],
): Promise<StreamResult> {
  const result = emptyStream();
  if (members.length === 0) return result;
  let leads: NewsLead[];
  const groupLabel = members.map((member) => member.name).join(', ').slice(0, 240);
  try {
    const discovery = await discoverMemberNewsBatch(members.map((member) => member.name), now);
    leads = discovery.leads;
    for (const warning of discovery.warnings) {
      pushDiagnostic(warnings, `news discovery ${groupLabel}: ${warning}`.slice(0, 600));
    }
  } catch (error) {
    result.attempted += 1;
    result.failures += 1;
    pushDiagnostic(failureDetails, { member: groupLabel, stage: 'news-batch-discovery', message: safeMessage(error) });
    for (const member of members) pushDiagnostic(noLeadMembers, member.name);
    return result;
  }

  const accepted = new Map(members.map((member) => [member.membership_id, 0]));
  for (let offset = 0; offset < leads.length; offset += NEWS_FETCH_CONCURRENCY) {
    if (members.every((member) => (accepted.get(member.membership_id) ?? 0) >= NEWS_PER_MEMBER)) break;
    const chunk = leads.slice(offset, offset + NEWS_FETCH_CONCURRENCY);
    const fetched = await Promise.all(chunk.map(async (lead) => {
      result.attempted += 1;
      try {
        return { lead, pageResult: await fetchNewsLeadPage(lead), error: undefined as unknown };
      } catch (error) {
        return { lead, pageResult: undefined, error };
      }
    }));

    for (const row of fetched) {
      if (row.error || !row.pageResult) {
        result.failures += 1;
        pushDiagnostic(failureDetails, {
          member: groupLabel,
          stage: 'article-fetch',
          message: `${row.lead.url}: ${safeMessage(row.error)}`.slice(0, 600),
        });
        continue;
      }
      const eligible = members.filter((member) => (accepted.get(member.membership_id) ?? 0) < NEWS_PER_MEMBER
        && publicPageMentionsPerson(row.pageResult!.text, member.name));
      if (eligible.length === 0) continue;
      try {
        const publishedAt = row.pageResult.publishedAt ?? row.lead.seenAt;
        if (publishedAt && new Date(publishedAt).getTime() > now.getTime() + 86_400_000) {
          throw new Error('News publication timestamp is implausibly in the future');
        }
        const dateSource = newsPublicationDateSource(row.pageResult.publishedAt, row.lead);
        const persisted = await persistDurableEvidence({
          sourceKind: 'public_news_article',
          sourceUrl: row.pageResult.canonicalUrl,
          contentSha256: row.pageResult.contentSha256,
          fetchedAt: row.pageResult.fetchedAt,
          httpStatus: row.pageResult.httpStatus,
          metadata: {
            pipelineVersion: PIPELINE_VERSION,
            discoveryProvider: newsDiscoveryProviderLabel(row.lead.provider),
            discoveryProviderKey: row.lead.provider,
            discoveryDomain: row.lead.domain,
            discoveryTitle: row.lead.title,
            contentType: row.pageResult.contentType,
            bytes: row.pageResult.bytes,
          },
        }, eligible.map((member) => ({
          target: { membershipId: member.membership_id },
          kind: 'context' as const,
          stance: 'neutral' as const,
          claim: `News coverage: ${row.pageResult!.title ?? row.lead.title}`,
          excerpt: row.pageResult!.excerpt,
          publishedAt,
          sourceQuality: 'other' as const,
          relevance: 'medium' as const,
          freshness: freshness(publishedAt ?? row.pageResult!.fetchedAt, now),
          extractionMethod: 'public-news-discovery-deterministic-page-verification',
          extractionVersion: PIPELINE_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'public_evidence',
            subtype: 'news_article',
            publicationDateSource: dateSource,
            sourceVerified: true,
            contextOnly: true,
            mechanicallyActionable: false,
          },
        })));
        result.inserted += persisted.inserted;
        result.reused += persisted.reused;
        result.unresolved += persisted.unresolvedTargets.length;
        for (const member of eligible) {
          accepted.set(member.membership_id, (accepted.get(member.membership_id) ?? 0) + 1);
        }
      } catch (error) {
        result.failures += 1;
        pushDiagnostic(failureDetails, {
          member: eligible.map((member) => member.name).join(', ').slice(0, 240),
          stage: 'article-verify-or-persist',
          message: safeMessage(error),
        });
      }
    }
  }

  for (const member of members) {
    if ((accepted.get(member.membership_id) ?? 0) === 0) pushDiagnostic(noLeadMembers, member.name);
  }
  return result;
}

function addStream(target: StreamResult, addition: StreamResult): void {
  target.attempted += addition.attempted;
  target.inserted += addition.inserted;
  target.reused += addition.reused;
  target.failures += addition.failures;
  target.unresolved += addition.unresolved;
}

export async function runPublicEvidenceRefresh(options: PublicEvidenceRefreshOptions = {}) {
  const now = options.now ?? new Date();
  const batchSize = Math.min(MAX_BATCH, Math.max(1, Math.trunc(options.batchSize ?? DEFAULT_BATCH)));
  const runId = await startRun(batchSize);
  const warnings: string[] = [];
  const campaign = emptyStream();
  const memberPrimary = emptyStream();
  const news = emptyStream();
  const campaignFailures: FailureDetail[] = [];
  const memberPrimaryFailures: FailureDetail[] = [];
  const memberPrimaryNoSourceMembers: string[] = [];
  const memberPrimaryNoArticleMembers: string[] = [];
  const newsFailures: FailureDetail[] = [];
  const newsNoLeadMembers: string[] = [];

  try {
    const batch = await selectMembershipBatch(batchSize);
    const memberships = batch.memberships;
    let filingDiscovery: Awaited<ReturnType<typeof discoverMinnesotaCampaignSites>> | undefined;
    try {
      filingDiscovery = await discoverMinnesotaCampaignSites();
    } catch (error) {
      warnings.push(`campaign registry: ${safeMessage(error)}`);
    }

    const filingByMembership = new Map<string, CampaignSiteFiling>();
    const campaignRegistryMatches: Array<{ member: string; candidate: string; chamber: string; district: string; website: string }> = [];
    const campaignRegistryUnmatchedMembers: string[] = [];
    const campaignRegistryAmbiguousMembers: Array<{ member: string; matches: number }> = [];

    if (filingDiscovery) {
      for (const member of memberships) {
        const matches = matchingFilings(member, filingDiscovery.filings);
        if (matches.length === 1) {
          const filing = matches[0];
          filingByMembership.set(member.membership_id, filing);
          pushDiagnostic(campaignRegistryMatches, {
            member: member.name,
            candidate: filing.candidateName,
            chamber: filing.chamber,
            district: filing.district,
            website: filing.website,
          });
          try {
            const registry = await persistCampaignRegistry(member, filing, filingDiscovery.filingSource);
            campaign.inserted += registry.inserted;
            campaign.reused += registry.reused;
            campaign.unresolved += registry.unresolvedTargets.length;
          } catch (error) {
            warnings.push(`campaign registry ${member.name}: ${safeMessage(error)}`);
          }
        } else if (matches.length > 1) {
          pushDiagnostic(campaignRegistryAmbiguousMembers, { member: member.name, matches: matches.length });
        } else {
          pushDiagnostic(campaignRegistryUnmatchedMembers, member.name);
        }
      }
    }

    for (let offset = 0; offset < memberships.length; offset += 3) {
      const group = memberships.slice(offset, offset + 3);
      const rows = await Promise.all(group.map(async (member) => {
        const filing = filingByMembership.get(member.membership_id);
        return filing ? refreshCampaignMember(member, filing, now, campaignFailures) : emptyStream();
      }));
      for (const row of rows) addStream(campaign, row);
    }

    const memberPrimaryDirectories: SenateMemberPrimaryDirectories = {};
    if (memberships.some((member) => member.chamber_slug === 'senate' && member.party.toUpperCase() === 'DFL')) {
      try {
        memberPrimaryDirectories.dfl = await fetchSenateMemberPrimaryDirectory('DFL');
      } catch (error) {
        warnings.push(`member-primary DFL directory: ${safeMessage(error)}`);
      }
    }
    if (memberships.some((member) => member.chamber_slug === 'senate' && ['R', 'GOP', 'REPUBLICAN'].includes(member.party.toUpperCase()))) {
      try {
        memberPrimaryDirectories.republican = await fetchSenateMemberPrimaryDirectory('R');
      } catch (error) {
        warnings.push(`member-primary Republican directory: ${safeMessage(error)}`);
      }
    }

    for (let offset = 0; offset < memberships.length; offset += 3) {
      const group = memberships.slice(offset, offset + 3);
      const rows = await Promise.all(group.map((member) => refreshMemberPrimaryMember(
        member,
        memberPrimaryDirectories,
        now,
        memberPrimaryFailures,
        memberPrimaryNoSourceMembers,
        memberPrimaryNoArticleMembers,
      )));
      for (const row of rows) addStream(memberPrimary, row);
    }

    for (let offset = 0; offset < memberships.length; offset += NEWS_DISCOVERY_GROUP_SIZE) {
      const group = memberships.slice(offset, offset + NEWS_DISCOVERY_GROUP_SIZE);
      addStream(news, await refreshNewsGroup(group, now, newsFailures, newsNoLeadMembers, warnings));
    }

    let campaignFinance: Record<string, unknown> | { skipped: true; reason: string };
    if (await campaignFinanceDue(now, options.forceCampaignFinance ?? false)) {
      try {
        campaignFinance = await runLiveCampaignFinanceRefresh();
      } catch (error) {
        campaignFinance = { skipped: true, reason: `refresh failed: ${safeMessage(error)}` };
        warnings.push(`campaign finance: ${safeMessage(error)}`);
      }
    } else {
      campaignFinance = { skipped: true, reason: `latest successful refresh is newer than ${FINANCE_REFRESH_AFTER_HOURS} hours` };
    }

    const result = {
      pipelineVersion: PIPELINE_VERSION,
      generatedAt: now.toISOString(),
      batchSize,
      membershipsProcessed: memberships.length,
      rotationOffset: batch.rotationOffset,
      rotationNextOffset: batch.rotationNextOffset,
      totalMemberships: batch.totalMemberships,
      newsDiscoveryGroupSize: NEWS_DISCOVERY_GROUP_SIZE,
      batchMembers: memberships.map((member) => ({ name: member.name, chamber: member.chamber_slug, district: member.district })),
      campaignRegistryFilings: filingDiscovery?.filings.length ?? 0,
      campaignRegistryFilingSamples: (filingDiscovery?.filings ?? []).slice(0, 12).map((filing) => ({
        candidate: filing.candidateName,
        chamber: filing.chamber,
        district: filing.district,
        website: filing.website,
      })),
      campaignRegistryMatches,
      campaignRegistryUnmatchedMembers,
      campaignRegistryAmbiguousMembers,
      campaign,
      memberPrimary,
      news,
      diagnostics: {
        campaignFailures,
        memberPrimaryFailures,
        memberPrimaryNoSourceMembers,
        memberPrimaryNoArticleMembers,
        newsFailures,
        newsNoLeadMembers,
      },
      campaignFinance,
      warnings,
    };
    await finishRun(runId, 'complete', result);
    return result;
  } catch (error) {
    await finishRun(runId, 'failed', {
      pipelineVersion: PIPELINE_VERSION,
      batchSize,
      campaign,
      memberPrimary,
      news,
      diagnostics: {
        campaignFailures,
        memberPrimaryFailures,
        memberPrimaryNoSourceMembers,
        memberPrimaryNoArticleMembers,
        newsFailures,
        newsNoLeadMembers,
      },
      warnings,
    }, safeMessage(error)).catch(() => undefined);
    throw error;
  }
}

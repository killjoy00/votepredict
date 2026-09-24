import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const HISTORY_VERSION = 'senate-member-primary-history-v1';
const DEFAULT_MEMBER_BATCH = 6;
const DEFAULT_ARTICLES_PER_MEMBER = 12;
let secrets: string[] = [];

type MembershipRow = {
  membership_id: string;
  name: string;
  external_key: string;
  session_slug: string;
  session_starts_on: string | null;
  session_ends_on: string | null;
  membership_starts_on: string | null;
  membership_ends_on: string | null;
  party: string;
  district: string;
};

type MemberGroup = {
  name: string;
  externalKey: string;
  memberships: MembershipRow[];
};

function mask(value: string) {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 900);
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function freshness(publishedAt: string) {
  const age = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
}

function effectiveBounds(row: MembershipRow): { startsOn: string; endsOn: string } | undefined {
  if (!row.session_starts_on || !row.session_ends_on) return undefined;
  const startsOn = row.membership_starts_on && row.membership_starts_on > row.session_starts_on
    ? row.membership_starts_on
    : row.session_starts_on;
  const endsOn = row.membership_ends_on && row.membership_ends_on < row.session_ends_on
    ? row.membership_ends_on
    : row.session_ends_on;
  return { startsOn, endsOn };
}

function membershipForPublishedAt(memberships: readonly MembershipRow[], publishedAt: string): MembershipRow | undefined {
  const publishedOn = publishedAt.slice(0, 10);
  const matches = memberships.filter(row => {
    const bounds = effectiveBounds(row);
    return Boolean(bounds && publishedOn >= bounds.startsOn && publishedOn <= bounds.endsOn);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function groupMembers(rows: readonly MembershipRow[]): MemberGroup[] {
  const groups = new Map<string, MemberGroup>();
  for (const row of rows) {
    const group = groups.get(row.external_key) ?? {
      name: row.name,
      externalKey: row.external_key,
      memberships: [],
    };
    group.memberships.push(row);
    groups.set(row.external_key, group);
  }
  for (const group of groups.values()) {
    group.memberships.sort((a, b) =>
      (a.session_starts_on ?? '').localeCompare(b.session_starts_on ?? '') || a.membership_id.localeCompare(b.membership_id));
  }
  return [...groups.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.externalKey.localeCompare(right.externalKey)
  );
}

async function fetchWithRetry(
  url: string,
  fetchPublicPage: typeof import('../src/evidence/public-http.js').fetchPublicPage,
  userAgent: string,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchPublicPage(url, {
        timeoutMs: 20_000,
        maxBytes: 3_000_000,
        userAgent,
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { fetchPublicPage } = await import('../src/evidence/public-http.js');
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const { extractExplicitBillStatements } = await import('../src/evidence/bill-statement-extractor.js');
  const {
    MN_SENATE_DFL_DIRECTORY_URL,
    MN_SENATE_REPUBLICAN_DIRECTORY_URL,
    discoverMemberPrimarySource,
    memberPrimaryArticleMatches,
    memberPrimaryPublishedAt,
    selectMemberPrimaryArticleCandidates,
  } = await import('../src/evidence/member-primary.js');

  const memberBatchSize = boundedInteger(
    process.env.VOTEPREDICT_SENATE_MEMBER_HISTORY_BATCH,
    DEFAULT_MEMBER_BATCH,
    1,
    12,
  );
  const articlesPerMember = boundedInteger(
    process.env.VOTEPREDICT_SENATE_MEMBER_HISTORY_ARTICLES_PER_MEMBER,
    DEFAULT_ARTICLES_PER_MEMBER,
    1,
    24,
  );

  let runId: string | undefined;
  try {
    const membershipRows = (await pool.query<MembershipRow>(`
      SELECT m.id::text AS membership_id,
             l.name,
             l.external_key,
             s.slug AS session_slug,
             s.starts_on::text AS session_starts_on,
             s.ends_on::text AS session_ends_on,
             m.starts_on::text AS membership_starts_on,
             m.ends_on::text AS membership_ends_on,
             m.party,
             m.district
        FROM memberships m
        JOIN legislators l ON l.id = m.legislator_id
        JOIN legislative_sessions s ON s.id = m.session_id
        JOIN chambers c ON c.id = m.chamber_id
       WHERE c.slug = 'senate'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND l.external_key ~ '^lrl:[0-9]+$'
       ORDER BY l.name,s.starts_on,m.id
    `)).rows;
    const members = groupMembers(membershipRows);
    if (members.length === 0) throw new Error('No 2021-2026 Senate memberships with LRL identities');

    const prior = await pool.query<{ next_offset: number | null }>(`
      SELECT CASE
               WHEN metadata->>'nextOffset' ~ '^[0-9]+$' THEN (metadata->>'nextOffset')::int
               ELSE 0
             END AS next_offset
        FROM ingestion_runs
       WHERE source_system = 'senate-member-primary-history'
         AND status = 'complete'
       ORDER BY finished_at DESC NULLS LAST
       LIMIT 1
    `);
    const offset = (prior.rows[0]?.next_offset ?? 0) % members.length;
    const batch = members.length <= memberBatchSize
      ? members
      : [
          ...members.slice(offset, offset + memberBatchSize),
          ...members.slice(0, Math.max(0, offset + memberBatchSize - members.length)),
        ];
    const nextOffset = (offset + batch.length) % members.length;

    const run = await pool.query<{ id: string }>(`
      INSERT INTO ingestion_runs (source_system,scope,status,metadata)
      VALUES ('senate-member-primary-history',$1,'running',$2::jsonb)
      RETURNING id::text
    `, [
      `members:${batch.length}:articles-per-member:${articlesPerMember}`,
      JSON.stringify({
        version: HISTORY_VERSION,
        totalMembers: members.length,
        offset,
        nextOffset,
        memberBatchSize,
        articlesPerMember,
      }),
    ]);
    runId = run.rows[0].id;

    const [dflDirectoryResult, republicanDirectoryResult] = await Promise.allSettled([
      fetchWithRetry(MN_SENATE_DFL_DIRECTORY_URL, fetchPublicPage, 'VotePredict/2.0 Senate DFL historical member directory'),
      fetchWithRetry(MN_SENATE_REPUBLICAN_DIRECTORY_URL, fetchPublicPage, 'VotePredict/2.0 Senate Republican historical member directory'),
    ]);
    const directories = {
      dfl: dflDirectoryResult.status === 'fulfilled' ? dflDirectoryResult.value : undefined,
      republican: republicanDirectoryResult.status === 'fulfilled' ? republicanDirectoryResult.value : undefined,
    };
    const directoryFailures = [
      ...(dflDirectoryResult.status === 'rejected' ? [{ directory: 'dfl', error: safe(dflDirectoryResult.reason) }] : []),
      ...(republicanDirectoryResult.status === 'rejected' ? [{ directory: 'republican', error: safe(republicanDirectoryResult.reason) }] : []),
    ];

    const billRows = (await pool.query<{ id: string; identifier: string; session_slug: string }>(`
      SELECT b.id::text,b.identifier,s.slug AS session_slug
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
    `)).rows;
    const billsBySession = new Map<string, Array<{ id: string; identifier: string }>>();
    for (const bill of billRows) {
      const rows = billsBySession.get(bill.session_slug) ?? [];
      rows.push({ id: bill.id, identifier: bill.identifier });
      billsBySession.set(bill.session_slug, rows);
    }

    let sourceDiscoveries = 0;
    let candidatesDiscovered = 0;
    let articleAttempts = 0;
    let articlesFetched = 0;
    let accepted = 0;
    let inserted = 0;
    let reused = 0;
    let skippedMissingDate = 0;
    let skippedOutsideMembership = 0;
    let skippedAlreadyPersisted = 0;
    let explicitBillStatements = 0;
    let failures = 0;
    const failureExamples: Array<{ member: string; stage: string; error: string }> = [];

    for (const member of batch) {
      const latestMembership = member.memberships[member.memberships.length - 1];
      const sourceMember = {
        name: member.name,
        chamber_slug: 'senate' as const,
        district: latestMembership.district,
        party: latestMembership.party,
        external_key: member.externalKey,
      };

      let discovery;
      try {
        discovery = await discoverMemberPrimarySource(sourceMember, directories);
        sourceDiscoveries += 1;
      } catch (error) {
        failures += 1;
        if (failureExamples.length < 16) {
          failureExamples.push({ member: member.name, stage: 'source-discovery', error: safe(error) });
        }
        continue;
      }

      const candidates = selectMemberPrimaryArticleCandidates(discovery, sourceMember, articlesPerMember);
      candidatesDiscovered += candidates.length;
      const existingUrls = candidates.length > 0
        ? new Set((await pool.query<{ source_url: string }>(`
            SELECT DISTINCT sd.source_url
              FROM source_documents sd
              JOIN evidence_items ei ON ei.source_document_id = sd.id
             WHERE sd.source_kind = 'senate_member_primary_historical_article'
               AND ei.extraction_version = $2
               AND sd.source_url = ANY($1::text[])
          `, [candidates, HISTORY_VERSION])).rows.map(row => row.source_url))
        : new Set<string>();

      for (const url of candidates) {
        if (existingUrls.has(url)) {
          skippedAlreadyPersisted += 1;
          continue;
        }
        articleAttempts += 1;
        try {
          const page = await fetchWithRetry(
            url,
            fetchPublicPage,
            'VotePredict/2.0 Senate member historical publication backfill',
          );
          if (!memberPrimaryArticleMatches(page, discovery, sourceMember)) {
            throw new Error('Senate historical article failed member identity verification');
          }

          const publishedAt = memberPrimaryPublishedAt(page);
          if (!publishedAt) {
            skippedMissingDate += 1;
            continue;
          }
          const parsedPublished = new Date(publishedAt);
          if (Number.isNaN(parsedPublished.getTime())) {
            skippedMissingDate += 1;
            continue;
          }
          if (parsedPublished.getTime() > Date.now() + 86_400_000) {
            throw new Error('Senate historical article publication timestamp is implausibly in the future');
          }
          if (publishedAt.slice(0, 10) < '2021-01-01' || publishedAt.slice(0, 10) > '2026-12-31') {
            skippedOutsideMembership += 1;
            continue;
          }

          const membership = membershipForPublishedAt(member.memberships, publishedAt);
          if (!membership) {
            skippedOutsideMembership += 1;
            continue;
          }

          const bills = billsBySession.get(membership.session_slug) ?? [];
          const statements = extractExplicitBillStatements({
            membershipId: membership.membership_id,
            memberName: member.name,
            text: page.text,
            publishedAt,
            fetchedAt: page.fetchedAt,
            bills,
            sourceSubtype: 'member_primary_article',
          });
          explicitBillStatements += statements.length;

          const drafts = [
            {
              target: { membershipId: membership.membership_id },
              kind: 'context' as const,
              stance: 'neutral' as const,
              claim: page.title
                ? `Historical Minnesota Senate caucus publication: ${page.title}`
                : `Historical Minnesota Senate caucus publication captured from ${new URL(page.canonicalUrl).hostname}.`,
              excerpt: page.excerpt,
              publishedAt,
              sourceQuality: 'member_primary' as const,
              relevance: 'medium' as const,
              freshness: freshness(publishedAt),
              extractionMethod: 'deterministic-senate-member-historical-publication',
              extractionVersion: HISTORY_VERSION,
              confidence: 1,
              metadata: {
                contextType: 'public_evidence',
                subtype: 'historical_member_primary_article',
                publisher: discovery.publisher,
                hostKind: discovery.hostKind,
                registryPageUrl: discovery.registryPage.canonicalUrl,
                registryPageSha256: discovery.registryPage.contentSha256,
                articleIndexUrl: discovery.articleIndexPage.canonicalUrl,
                articleIndexSha256: discovery.articleIndexPage.contentSha256,
                availabilityProof: 'publisher_page_metadata',
                availableAt: publishedAt,
                publishedAt,
                dateGranularity: page.publishedAt ? 'timestamp_or_publisher_metadata' : 'date',
                sameDayEligible: false,
                sourceVerified: true,
                nativeHistoricalPublisherPage: true,
                contextOnly: true,
                mechanicallyActionable: false,
                modelWeight: 0,
                evidenceSeriesKey: `senate_member_history:${membership.membership_id}:${page.canonicalUrl}`,
              },
            },
            ...statements.map(statement => ({
              ...statement,
              metadata: {
                ...(statement.metadata ?? {}),
                publisher: discovery.publisher,
                hostKind: discovery.hostKind,
                registryPageUrl: discovery.registryPage.canonicalUrl,
                registryPageSha256: discovery.registryPage.contentSha256,
                articleIndexUrl: discovery.articleIndexPage.canonicalUrl,
                articleIndexSha256: discovery.articleIndexPage.contentSha256,
                availabilityProof: 'publisher_page_metadata',
                availableAt: publishedAt,
                publishedAt,
                sameDayEligible: false,
                nativeHistoricalPublisherPage: true,
                mechanicallyActionable: false,
                modelWeight: 0,
              },
            })),
          ];

          const persisted = await persistDurableEvidence({
            sourceKind: 'senate_member_primary_historical_article',
            sourceUrl: page.canonicalUrl,
            contentSha256: page.contentSha256,
            sessionSlug: membership.session_slug,
            chamberSlug: 'senate',
            fetchedAt: page.fetchedAt,
            httpStatus: page.httpStatus,
            metadata: {
              publisher: discovery.publisher,
              historyVersion: HISTORY_VERSION,
              memberName: member.name,
              memberExternalKey: member.externalKey,
              hostKind: discovery.hostKind,
              registryPageUrl: discovery.registryPage.canonicalUrl,
              registryPageSha256: discovery.registryPage.contentSha256,
              registryPageFetchedAt: discovery.registryPage.fetchedAt,
              articleIndexUrl: discovery.articleIndexPage.canonicalUrl,
              articleIndexSha256: discovery.articleIndexPage.contentSha256,
              articleIndexFetchedAt: discovery.articleIndexPage.fetchedAt,
              availabilityProof: 'publisher_page_metadata',
              availableAt: publishedAt,
              publishedAt,
              contentType: page.contentType,
              bytes: page.bytes,
              title: page.title,
            },
          }, drafts);

          articlesFetched += 1;
          accepted += 1;
          inserted += persisted.inserted;
          reused += persisted.reused;
        } catch (error) {
          failures += 1;
          if (failureExamples.length < 16) {
            failureExamples.push({ member: member.name, stage: 'article', error: safe(error) });
          }
        }
      }

      console.log(JSON.stringify({
        senateMemberPrimaryHistoryProgress: {
          member: member.name,
          sourceDiscoveries,
          candidatesDiscovered,
          articleAttempts,
          accepted,
          inserted,
          reused,
          failures,
        },
      }));
    }

    const result = {
      version: HISTORY_VERSION,
      totalMembers: members.length,
      batchMembers: batch.length,
      offset,
      nextOffset,
      memberBatchSize,
      articlesPerMember,
      directoryFailures,
      sourceDiscoveries,
      candidatesDiscovered,
      articleAttempts,
      articlesFetched,
      accepted,
      inserted,
      reused,
      skippedMissingDate,
      skippedOutsideMembership,
      skippedAlreadyPersisted,
      explicitBillStatements,
      failures,
      failureExamples,
      policy: {
        availability: 'verified Senate caucus publisher page timestamp/date carried by the source',
        currentPageWithoutPublisherDateEligible: false,
        eventDateIsAvailability: false,
        sameDayEligible: false,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        servingChanged: false,
        productionAction: 'none',
      },
    };

    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete',
             finished_at=now(),
             source_documents=$2,
             metadata=metadata || $3::jsonb
       WHERE id=$1::uuid
    `, [runId, articlesFetched, JSON.stringify(result)]);
    console.log(JSON.stringify({ senateMemberPrimaryHistoryBackfill: result }, null, 2));
  } catch (error) {
    if (runId) {
      await pool.query(`
        UPDATE ingestion_runs
           SET status='failed',finished_at=now(),error_summary=$2
         WHERE id=$1::uuid
      `, [runId, safe(error)]).catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

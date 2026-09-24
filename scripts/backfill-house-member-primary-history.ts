import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const HISTORY_VERSION = 'house-member-primary-history-v1';
const DEFAULT_MEMBER_BATCH = 8;
const DEFAULT_ARTICLES_PER_MEMBER = 8;
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
    .replace(/https?:\/\/\S+/gi, '[source URL]');
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

function freshness(publishedOn: string) {
  const age = (Date.now() - new Date(publishedOn + 'T12:00:00Z').getTime()) / 86_400_000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
}

function membershipForDate(memberships: readonly MembershipRow[], publishedOn: string): MembershipRow | undefined {
  const matches = memberships.filter(row => {
    if (!row.session_starts_on || !row.session_ends_on) return false;
    const startsOn = row.membership_starts_on && row.membership_starts_on > row.session_starts_on
      ? row.membership_starts_on
      : row.session_starts_on;
    const endsOn = row.membership_ends_on && row.membership_ends_on < row.session_ends_on
      ? row.membership_ends_on
      : row.session_ends_on;
    return publishedOn >= startsOn && publishedOn <= endsOn;
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
  const { houseMemberNewsUrl, parseHouseMemberNewsArchiveEntries } = await import('../src/evidence/member-primary.js');

  const memberBatchSize = boundedInteger(
    process.env.VOTEPREDICT_HOUSE_MEMBER_HISTORY_BATCH,
    DEFAULT_MEMBER_BATCH,
    1,
    16,
  );
  const articlesPerMember = boundedInteger(
    process.env.VOTEPREDICT_HOUSE_MEMBER_HISTORY_ARTICLES_PER_MEMBER,
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
             m.ends_on::text AS membership_ends_on
        FROM memberships m
        JOIN legislators l ON l.id = m.legislator_id
        JOIN legislative_sessions s ON s.id = m.session_id
        JOIN chambers c ON c.id = m.chamber_id
       WHERE c.slug = 'house'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND l.external_key ~ '^lrl:[0-9]+$'
       ORDER BY l.name,s.starts_on,m.id
    `)).rows;
    const members = groupMembers(membershipRows);
    if (members.length === 0) throw new Error('No 2021-2026 House memberships with LRL identities');

    const prior = await pool.query<{ next_offset: number | null }>(`
      SELECT CASE
               WHEN metadata->>'nextOffset' ~ '^[0-9]+$' THEN (metadata->>'nextOffset')::int
               ELSE 0
             END AS next_offset
        FROM ingestion_runs
       WHERE source_system = 'house-member-primary-history'
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
      VALUES ('house-member-primary-history',$1,'running',$2::jsonb)
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

    let archivesFetched = 0;
    let archiveEntries = 0;
    let eligibleEntries = 0;
    let previouslyPersisted = 0;
    let articleAttempts = 0;
    let articlesFetched = 0;
    let inserted = 0;
    let reused = 0;
    let unresolvedMemberships = 0;
    let explicitBillStatements = 0;
    let failures = 0;
    const failureExamples: Array<{ member: string; stage: string; error: string }> = [];

    for (const member of batch) {
      const archiveUrl = houseMemberNewsUrl(member.externalKey);
      if (!archiveUrl) continue;

      let archive;
      try {
        archive = await fetchWithRetry(
          archiveUrl,
          fetchPublicPage,
          'VotePredict/2.0 House member historical archive index',
        );
        archivesFetched += 1;
      } catch (error) {
        failures += 1;
        if (failureExamples.length < 16) {
          failureExamples.push({ member: member.name, stage: 'archive-index', error: safe(error).slice(0, 500) });
        }
        continue;
      }

      const entries = parseHouseMemberNewsArchiveEntries(archive, member.externalKey);
      archiveEntries += entries.length;
      const resolved = entries.flatMap(entry => {
        const membership = membershipForDate(member.memberships, entry.publishedOn);
        if (!membership) {
          const potentiallyInWindow = entry.publishedOn >= '2021-01-01' && entry.publishedOn <= '2026-12-31';
          if (potentiallyInWindow) unresolvedMemberships += 1;
          return [];
        }
        eligibleEntries += 1;
        return [{ entry, membership }];
      });

      const urls = resolved.map(row => row.entry.url);
      const existingUrls = urls.length > 0
        ? new Set((await pool.query<{ source_url: string }>(`
            SELECT DISTINCT sd.source_url
              FROM source_documents sd
              JOIN evidence_items ei ON ei.source_document_id = sd.id
             WHERE sd.source_kind = 'house_member_primary_historical_article'
               AND ei.extraction_version = $2
               AND sd.source_url = ANY($1::text[])
          `, [urls, HISTORY_VERSION])).rows.map(row => row.source_url))
        : new Set<string>();
      previouslyPersisted += existingUrls.size;

      const candidates = resolved
        .filter(row => !existingUrls.has(row.entry.url))
        .slice(0, articlesPerMember);

      for (const { entry, membership } of candidates) {
        articleAttempts += 1;
        try {
          const page = await fetchWithRetry(
            entry.url,
            fetchPublicPage,
            'VotePredict/2.0 House member historical publication backfill',
          );
          const expectedPath = new URL(entry.url).pathname.replace(/\/+$/, '');
          const actualPath = new URL(page.canonicalUrl).pathname.replace(/\/+$/, '');
          if (actualPath !== expectedPath) throw new Error('House historical article redirected outside its member-specific archive path');

          const publishedAt = entry.publishedOn + 'T12:00:00.000Z';
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
              claim: `Historical Minnesota House member publication: ${entry.title}`,
              excerpt: page.excerpt,
              publishedAt,
              sourceQuality: 'official' as const,
              relevance: 'medium' as const,
              freshness: freshness(entry.publishedOn),
              extractionMethod: 'deterministic-house-member-historical-publication',
              extractionVersion: HISTORY_VERSION,
              confidence: 1,
              metadata: {
                contextType: 'public_evidence',
                subtype: 'historical_member_primary_article',
                publisher: 'Minnesota House of Representatives',
                officialArchiveIndexUrl: archive.canonicalUrl,
                officialArchiveIndexSha256: archive.contentSha256,
                officialArchiveIndexFetchedAt: archive.fetchedAt,
                officialArchiveListedOn: entry.publishedOn,
                availabilityProof: 'official_publication_timestamp',
                availableOn: entry.publishedOn,
                dateGranularity: 'date',
                sameDayEligible: false,
                sourceVerified: true,
                nativeHistoricalArchive: true,
                contextOnly: true,
                mechanicallyActionable: false,
                evidenceSeriesKey: `house_member_history:${membership.membership_id}:${entry.url}`,
              },
            },
            ...statements.map(statement => ({
              ...statement,
              metadata: {
                ...(statement.metadata ?? {}),
                officialArchiveIndexUrl: archive.canonicalUrl,
                officialArchiveIndexSha256: archive.contentSha256,
                officialArchiveListedOn: entry.publishedOn,
                availabilityProof: 'official_publication_timestamp',
                availableOn: entry.publishedOn,
                dateGranularity: 'date',
                sameDayEligible: false,
                nativeHistoricalArchive: true,
                mechanicallyActionable: false,
              },
            })),
          ];

          const persisted = await persistDurableEvidence({
            sourceKind: 'house_member_primary_historical_article',
            sourceUrl: page.canonicalUrl,
            contentSha256: page.contentSha256,
            sessionSlug: membership.session_slug,
            chamberSlug: 'house',
            fetchedAt: page.fetchedAt,
            httpStatus: page.httpStatus,
            metadata: {
              publisher: 'Minnesota House of Representatives',
              historyVersion: HISTORY_VERSION,
              memberName: member.name,
              memberExternalKey: member.externalKey,
              officialArchiveIndexUrl: archive.canonicalUrl,
              officialArchiveIndexSha256: archive.contentSha256,
              officialArchiveIndexFetchedAt: archive.fetchedAt,
              officialArchiveListedOn: entry.publishedOn,
              availabilityProof: 'official_publication_timestamp',
              availableOn: entry.publishedOn,
              articleTitle: entry.title,
            },
          }, drafts);

          articlesFetched += 1;
          inserted += persisted.inserted;
          reused += persisted.reused;
        } catch (error) {
          failures += 1;
          if (failureExamples.length < 16) {
            failureExamples.push({ member: member.name, stage: 'article', error: safe(error).slice(0, 500) });
          }
        }
      }

      console.log(JSON.stringify({
        houseMemberPrimaryHistoryProgress: {
          member: member.name,
          externalKey: member.externalKey,
          archiveEntries: entries.length,
          resolvedEntries: resolved.length,
          selectedArticles: candidates.length,
          articlesFetched,
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
      archivesFetched,
      archiveEntries,
      eligibleEntries,
      previouslyPersisted,
      articleAttempts,
      articlesFetched,
      inserted,
      reused,
      unresolvedMemberships,
      explicitBillStatements,
      failures,
      failureExamples,
      policy: {
        availability: 'official Minnesota House member archive publication date',
        currentMutablePageWithoutOfficialArchiveDateEligible: false,
        sameDayEligible: false,
        servingChanged: false,
        productionAction: 'none',
      },
    };

    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete',
             finished_at=now(),
             source_documents=$2,
             unresolved_members=$3,
             metadata=metadata || $4::jsonb
       WHERE id=$1::uuid
    `, [runId, articlesFetched, unresolvedMemberships, JSON.stringify(result)]);
    console.log(JSON.stringify({ houseMemberPrimaryHistoryBackfill: result }, null, 2));
  } catch (error) {
    if (runId) {
      await pool.query(`
        UPDATE ingestion_runs
           SET status='failed',finished_at=now(),error_summary=$2
         WHERE id=$1::uuid
      `, [runId, safe(error).slice(0, 1000)]).catch(() => undefined);
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

import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SESSION_MAP = [
  { slug: '2021-2022', lsYear: 92 },
  { slug: '2023-2024', lsYear: 93 },
  { slug: '2025-2026', lsYear: 94 },
] as const;
let secrets: string[] = [];

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

function freshness(date: string) {
  const age = (Date.now() - new Date(date + 'T00:00:00Z').getTime()) / 86400000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
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
  const {
    parseHouseCommitteeArchiveAttachments,
    parseHouseCommitteeArchiveTotalPages,
    HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION,
  } = await import('../src/evidence/house-committee-archive.js');

  try {
    let pages = 0;
    let pagesSkippedExact = 0;
    let attachments = 0;
    let billTargeted = 0;
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    const byKind: Record<string, number> = {};
    const bySession: Record<string, number> = {};

    for (const session of SESSION_MAP) {
      const firstUrl = `https://www.house.mn.gov/Committees/archives/Page/1/LSYear/${session.lsYear}`;
      const first = await fetchPublicPage(firstUrl, {
        timeoutMs: 20_000,
        maxBytes: 4_000_000,
        userAgent: 'VotePredict/2.0 house-committee-archive-backfill',
      });
      const totalPages = Math.min(100, parseHouseCommitteeArchiveTotalPages(first.text));

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        const page = pageNumber === 1 ? first : await fetchPublicPage(
          `https://www.house.mn.gov/Committees/archives/Page/${pageNumber}/LSYear/${session.lsYear}`,
          {
            timeoutMs: 20_000,
            maxBytes: 4_000_000,
            userAgent: 'VotePredict/2.0 house-committee-archive-backfill',
          },
        );

        pages += 1;
        const rows = parseHouseCommitteeArchiveAttachments(page.rawContent, page.canonicalUrl);
        attachments += rows.length;
        bySession[session.slug] = (bySession[session.slug] ?? 0) + rows.length;

        const drafts = rows.map(row => {
          byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
          const target = row.billIdentifiers.length === 1
            ? { billIdentifier: row.billIdentifiers[0], sessionSlug: session.slug }
            : undefined;
          if (target) billTargeted += 1;

          return {
            target,
            kind: 'context' as const,
            stance: 'neutral' as const,
            claim: `Minnesota House committee archive lists ${row.fileName} as an official committee attachment posted ${row.postedOn}.`,
            publishedAt: row.postedOn + 'T12:00:00.000Z',
            sourceQuality: 'official' as const,
            relevance: target ? 'high' as const : 'low' as const,
            freshness: freshness(row.postedOn),
            extractionMethod: 'deterministic-house-committee-archive-attachment',
            extractionVersion: HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION,
            confidence: 1,
            metadata: {
              contextType: 'structured_public',
              subtype: 'committee_archive_' + row.kind,
              attachmentName: row.fileName,
              attachmentUrl: row.url,
              officialPostedOn: row.postedOn,
              availabilityProof: 'official_publication_timestamp',
              availableOn: row.postedOn,
              dateGranularity: 'date',
              sameDayEligible: false,
              billIdentifiers: row.billIdentifiers,
              contextOnly: true,
              mechanicallyActionable: false,
              attachmentContentFetched: false,
              evidenceSeriesKey: `house_committee_attachment:${session.slug}:${row.url}`,
            },
          };
        });

        const alreadyPersisted = await pool.query<{ id: string; evidence_count: string }>(`
          SELECT sd.id::text,
                 (
                   SELECT count(*)::text
                     FROM evidence_items ei
                    WHERE ei.source_document_id = sd.id
                      AND ei.extraction_version = $3
                 ) AS evidence_count
            FROM source_documents sd
           WHERE sd.source_kind = 'house_committee_archive_page'
             AND sd.source_url = $1
             AND sd.content_sha256 = $2
             AND sd.metadata->>'archiveParserVersion' = $3
           LIMIT 1
        `, [page.canonicalUrl, page.contentSha256, HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION]);

        const exactPageComplete = alreadyPersisted.rows[0]
          && Number(alreadyPersisted.rows[0].evidence_count) === rows.length;
        if (exactPageComplete) {
          pagesSkippedExact += 1;
          console.log(JSON.stringify({
            houseCommitteeArchiveProgress: {
              session: session.slug,
              page: pageNumber,
              totalPages,
              pageAttachments: rows.length,
              exactPageAlreadyPersisted: true,
              pages,
              pagesSkippedExact,
              inserted,
              reused,
              unresolved,
            },
          }));
          continue;
        }

        const persisted = await persistDurableEvidence({
          sourceKind: 'house_committee_archive_page',
          sourceUrl: page.canonicalUrl,
          contentSha256: page.contentSha256,
          sessionSlug: session.slug,
          chamberSlug: 'house',
          fetchedAt: page.fetchedAt,
          httpStatus: page.httpStatus,
          metadata: {
            publisher: 'Minnesota House of Representatives',
            archiveParserVersion: HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION,
            lsYear: session.lsYear,
            page: pageNumber,
            totalPages,
            attachments: rows.length,
          },
        }, drafts);

        inserted += persisted.inserted;
        reused += persisted.reused;
        unresolved += persisted.unresolvedTargets.length;

        console.log(JSON.stringify({
          houseCommitteeArchiveProgress: {
            session: session.slug,
            page: pageNumber,
            totalPages,
            pageAttachments: rows.length,
            exactPageAlreadyPersisted: false,
            pages,
            pagesSkippedExact,
            inserted,
            reused,
            unresolved,
          },
        }));
      }
    }

    console.log(JSON.stringify({
      houseCommitteeArchiveBackfill: {
        pages,
        pagesSkippedExact,
        attachments,
        billTargeted,
        inserted,
        reused,
        unresolved,
        bySession: Object.fromEntries(Object.entries(bySession).sort()),
        byKind: Object.fromEntries(Object.entries(byKind).sort()),
        policy: {
          availability: 'official attachment posted date; same-day excluded',
          attachmentContentFetch: 'separate follow-up',
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const VERSION = 'house-committee-attachment-wayback-v1';
const DEFAULT_BATCH_SIZE = 8;
const MAX_PDF_BYTES = 25_000_000;
const MAX_REDIRECTS = 4;
let secrets: string[] = [];

type Candidate = {
  archive_evidence_id: string;
  bill_id: string;
  bill_identifier: string;
  session_slug: string;
  archive_page_url: string;
  archive_page_sha256: string;
  attachment_url: string;
  attachment_name: string;
  attachment_subtype: string;
  official_posted_on: string;
};

const SESSION_WINDOWS: Record<string, { from: string; to: string }> = {
  '2021-2022': { from: '20210101', to: '20221231' },
  '2023-2024': { from: '20230101', to: '20241231' },
  '2025-2026': { from: '20250101', to: '20261231' },
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

function batchSize(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_HOUSE_ATTACHMENT_WAYBACK_BATCH ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(24, Math.max(1, requested));
}

function freshness(capturedAt: string) {
  const age = (Date.now() - new Date(capturedAt).getTime()) / 86_400_000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
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

async function fetchArchivedPdf(capture: import('../src/evidence/wayback.js').WaybackCapture) {
  let currentUrl = capture.archiveUrl;
  let response: Response | undefined;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const url = new URL(currentUrl);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'web.archive.org') {
      throw new Error('Archived House attachment must remain on web.archive.org');
    }
    response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'user-agent': 'VotePredict/2.0 house-committee-attachment-wayback',
        accept: 'application/pdf,application/octet-stream;q=0.8,*/*;q=0.1',
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location) throw new Error('Wayback PDF redirect missing Location');
    currentUrl = new URL(location, currentUrl).toString();
  }

  if (!response) throw new Error('Wayback PDF returned no response');
  if ([301, 302, 303, 307, 308].includes(response.status)) throw new Error('Wayback PDF exceeded redirect limit');
  if (!response.ok) throw new Error('Wayback PDF HTTP ' + response.status);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 300 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error('Wayback PDF has unexpected byte length: ' + bytes.byteLength);
  }
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(5, bytes.byteLength)));
  if (header !== '%PDF-') throw new Error('Wayback capture is not PDF bytes');

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  let text = '';
  try {
    const parsed = await parser.getText();
    text = (parsed.text ?? '').replace(/\u0000/g, '');
  } finally {
    await parser.destroy();
  }

  return {
    finalUrl: currentUrl,
    text,
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    fetchedAt: new Date().toISOString(),
    httpStatus: response.status,
    bytes: bytes.byteLength,
  };
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
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const { canonicalHouseCommitteeAttachmentPdfUrl, normalizeHouseCommitteeAttachmentExcerpt } =
    await import('../src/evidence/house-committee-attachment-content.js');
  const { HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION } = await import('../src/evidence/house-committee-archive.js');
  const { discoverWaybackPdfCaptures } = await import('../src/evidence/wayback.js');

  const limit = batchSize();
  let runId: string | undefined;
  const failureExamples: Array<{ attachment: string; stage: string; error: string }> = [];

  const remainingSql = `
    SELECT count(*)::int AS remaining
      FROM evidence_items ei
      JOIN source_documents archive_page ON archive_page.id = ei.source_document_id
     WHERE archive_page.source_kind = 'house_committee_archive_page'
       AND ei.extraction_version = $1
       AND ei.bill_id IS NOT NULL
       AND ei.metadata->>'attachmentUrl' IS NOT NULL
       AND lower(split_part(ei.metadata->>'attachmentUrl','?',1)) LIKE '%.pdf'
       AND NOT EXISTS (
         SELECT 1
           FROM source_documents processed
          WHERE processed.metadata->>'archiveEvidenceId' = ei.id::text
            AND (
              (processed.source_kind = 'house_committee_attachment_wayback_pdf'
               AND processed.metadata->>'attachmentWaybackVersion' = $2)
              OR
              (processed.source_kind = 'house_committee_attachment_wayback_scan'
               AND processed.metadata->>'attachmentWaybackVersion' = $2)
            )
       )
  `;

  try {
    const remainingBefore = (await pool.query<{ remaining: number }>(
      remainingSql,
      [HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION, VERSION],
    )).rows[0]?.remaining ?? 0;

    const candidates = (await pool.query<Candidate>(`
      SELECT ei.id::text AS archive_evidence_id,
             ei.bill_id::text AS bill_id,
             b.identifier AS bill_identifier,
             s.slug AS session_slug,
             archive_page.source_url AS archive_page_url,
             archive_page.content_sha256 AS archive_page_sha256,
             ei.metadata->>'attachmentUrl' AS attachment_url,
             coalesce(ei.metadata->>'attachmentName','House committee attachment') AS attachment_name,
             coalesce(ei.metadata->>'subtype','committee_archive_attachment') AS attachment_subtype,
             ei.metadata->>'officialPostedOn' AS official_posted_on
        FROM evidence_items ei
        JOIN source_documents archive_page ON archive_page.id = ei.source_document_id
        JOIN bills b ON b.id = ei.bill_id
        JOIN legislative_sessions s ON s.id = b.session_id
       WHERE archive_page.source_kind = 'house_committee_archive_page'
         AND ei.extraction_version = $1
         AND ei.bill_id IS NOT NULL
         AND ei.metadata->>'attachmentUrl' IS NOT NULL
         AND lower(split_part(ei.metadata->>'attachmentUrl','?',1)) LIKE '%.pdf'
         AND NOT EXISTS (
           SELECT 1
             FROM source_documents processed
            WHERE processed.metadata->>'archiveEvidenceId' = ei.id::text
              AND (
                (processed.source_kind = 'house_committee_attachment_wayback_pdf'
                 AND processed.metadata->>'attachmentWaybackVersion' = $2)
                OR
                (processed.source_kind = 'house_committee_attachment_wayback_scan'
                 AND processed.metadata->>'attachmentWaybackVersion' = $2)
              )
         )
       ORDER BY ei.published_at NULLS LAST, ei.id
       LIMIT $3
    `, [HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION, VERSION, limit])).rows;

    const run = await pool.query<{ id: string }>(`
      INSERT INTO ingestion_runs (source_system,scope,status,metadata)
      VALUES ('house-committee-attachment-wayback',$1,'running',$2::jsonb)
      RETURNING id::text
    `, [
      `pdf-batch:${limit}`,
      JSON.stringify({
        version: VERSION,
        archiveParserVersion: HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION,
        remainingBefore,
        selected: candidates.length,
      }),
    ]);
    runId = run.rows[0].id;

    let scanned = 0;
    let capturesDiscovered = 0;
    let noCapture = 0;
    let fetched = 0;
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    let textExtracted = 0;
    let failures = 0;

    for (const candidate of candidates) {
      try {
        const originalUrl = canonicalHouseCommitteeAttachmentPdfUrl(candidate.attachment_url);
        const window = SESSION_WINDOWS[candidate.session_slug];
        if (!window) throw new Error('Unsupported House attachment session: ' + candidate.session_slug);
        const captures = await discoverWaybackPdfCaptures({
          url: originalUrl,
          from: window.from,
          to: window.to,
          limit: 50,
        });
        scanned += 1;
        capturesDiscovered += captures.length;

        if (captures.length === 0) {
          const scanHash = createHash('sha256')
            .update(VERSION + '|no-capture|' + candidate.archive_evidence_id + '|' + originalUrl)
            .digest('hex');
          await persistDurableEvidence({
            sourceKind: 'house_committee_attachment_wayback_scan',
            sourceUrl: originalUrl,
            contentSha256: scanHash,
            sessionSlug: candidate.session_slug,
            chamberSlug: 'house',
            fetchedAt: new Date().toISOString(),
            metadata: {
              publisher: 'Internet Archive',
              attachmentWaybackVersion: VERSION,
              archiveEvidenceId: candidate.archive_evidence_id,
              archivePageUrl: candidate.archive_page_url,
              archivePageSha256: candidate.archive_page_sha256,
              originalUrl,
              officialPostedOn: candidate.official_posted_on,
              captureCount: 0,
              historicalContentIdentityProven: false,
              asOfEligible: false,
              availabilityStatus: 'no_wayback_pdf_capture_found',
            },
          }, []);
          noCapture += 1;
          continue;
        }

        const capture = captures[0];
        const pdf = await fetchArchivedPdf(capture);
        const excerpt = normalizeHouseCommitteeAttachmentExcerpt(pdf.text);
        if (excerpt) textExtracted += 1;

        const persisted = await persistDurableEvidence({
          sourceKind: 'house_committee_attachment_wayback_pdf',
          sourceUrl: capture.archiveUrl,
          contentSha256: pdf.contentSha256,
          sessionSlug: candidate.session_slug,
          chamberSlug: 'house',
          fetchedAt: pdf.fetchedAt,
          httpStatus: pdf.httpStatus,
          metadata: {
            publisher: 'Internet Archive',
            attachmentWaybackVersion: VERSION,
            archiveEvidenceId: candidate.archive_evidence_id,
            archivePageUrl: candidate.archive_page_url,
            archivePageSha256: candidate.archive_page_sha256,
            originalUrl,
            archiveUrl: capture.archiveUrl,
            finalArchiveUrl: pdf.finalUrl,
            archiveCapturedAt: capture.capturedAt,
            archiveDigest: capture.digest,
            officialPostedOn: candidate.official_posted_on,
            availabilityProof: 'independent_archive_capture',
            availableAt: capture.capturedAt,
            historicalContentIdentityProven: true,
            bytes: pdf.bytes,
            textExtracted: Boolean(excerpt),
          },
        }, [{
          target: {
            billId: candidate.bill_id,
            sessionSlug: candidate.session_slug,
            chamberSlug: 'house',
          },
          kind: 'context',
          stance: 'neutral',
          claim: `Internet Archive captured official Minnesota House committee attachment ${candidate.attachment_name} on ${capture.capturedAt.slice(0, 10)}.`,
          excerpt,
          publishedAt: capture.capturedAt,
          sourceQuality: 'official',
          relevance: 'high',
          freshness: freshness(capture.capturedAt),
          extractionMethod: 'deterministic-house-committee-attachment-wayback-pdf',
          extractionVersion: VERSION,
          confidence: 1,
          metadata: {
            contextType: 'structured_public',
            subtype: candidate.attachment_subtype.replace(/^committee_archive_/, 'committee_attachment_archived_'),
            archiveEvidenceId: candidate.archive_evidence_id,
            archivePageUrl: candidate.archive_page_url,
            archivePageSha256: candidate.archive_page_sha256,
            attachmentName: candidate.attachment_name,
            originalUrl,
            archiveUrl: capture.archiveUrl,
            finalArchiveUrl: pdf.finalUrl,
            archiveCapturedAt: capture.capturedAt,
            archiveDigest: capture.digest,
            availabilityProof: 'independent_archive_capture',
            availableAt: capture.capturedAt,
            historicalContentIdentityProven: true,
            officialPostedOn: candidate.official_posted_on,
            sameDayEligible: false,
            eventDateIsAvailability: false,
            contextOnly: true,
            mechanicallyActionable: false,
            modelWeight: 0,
            attachmentContentSha256: pdf.contentSha256,
            attachmentFetchedAt: pdf.fetchedAt,
            attachmentBytes: pdf.bytes,
            textExtracted: Boolean(excerpt),
            evidenceSeriesKey: `house_committee_attachment_wayback:${candidate.session_slug}:${originalUrl}:${capture.timestamp}`,
          },
        }]);

        fetched += 1;
        inserted += persisted.inserted;
        reused += persisted.reused;
        unresolved += persisted.unresolvedTargets.length;
      } catch (error) {
        failures += 1;
        if (failureExamples.length < 16) {
          failureExamples.push({
            attachment: candidate.attachment_name,
            stage: 'discover-or-fetch',
            error: safe(error),
          });
        }
      }
    }

    const remainingAfter = (await pool.query<{ remaining: number }>(
      remainingSql,
      [HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION, VERSION],
    )).rows[0]?.remaining ?? 0;

    const result = {
      version: VERSION,
      archiveParserVersion: HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION,
      batchSize: limit,
      remainingBefore,
      selected: candidates.length,
      scanned,
      capturesDiscovered,
      noCapture,
      fetched,
      inserted,
      reused,
      unresolved,
      textExtracted,
      failures,
      failureExamples,
      remainingAfter,
      policy: {
        availability: 'exact Wayback capture timestamp for archived PDF bytes',
        currentFetchIsHistoricalAvailability: false,
        archiveListingDateIsContentAvailability: false,
        transactionOrEventDateIsAvailability: false,
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
             unresolved_members=$3,
             metadata=metadata || $4::jsonb
       WHERE id=$1::uuid
    `, [runId, fetched, unresolved, JSON.stringify(result)]);
    console.log(JSON.stringify({ houseCommitteeAttachmentWaybackBackfill: result }, null, 2));
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

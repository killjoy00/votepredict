import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import type { WaybackCapture } from '../src/evidence/wayback.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const YEARS = [2021, 2022] as const;
let secrets: string[] = [];

function wantsWrite(): boolean {
  return process.argv.includes('--write');
}

function mask(value: string) {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

function safe(error: unknown): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1500);
}

async function chooseDb(env: Record<string, string | undefined>): Promise<string> {
  const { Pool } = await import('pg');
  async function works(value: string): Promise<boolean> {
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
  mask(secret);
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

async function fetchArchivedPdf(capture: WaybackCapture) {
  const target = new URL(capture.archiveUrl);
  if (target.protocol !== 'https:' || target.hostname !== 'web.archive.org') {
    throw new Error('Lobbying summary archive URL must stay on web.archive.org');
  }
  const response = await fetch(target, {
    headers: {
      'user-agent': 'VotePredict/2.0 cfb-lobbying-summary-upper-bound',
      accept: 'application/pdf,application/octet-stream;q=0.8,*/*;q=0.1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'web.archive.org') {
    throw new Error('Archived lobbying summary redirected off web.archive.org');
  }
  if (!response.ok) throw new Error('Archived lobbying summary HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1000 || bytes.byteLength > 35_000_000) {
    throw new Error('Archived lobbying summary unexpected byte length: ' + bytes.byteLength);
  }
  if (new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('Archived lobbying summary is not PDF bytes');
  }

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes.slice(), CanvasFactory });
  try {
    const parsed = await parser.getText();
    const text = (parsed.text ?? '').replace(/\u0000/g, '');
    if (text.length < 500) throw new Error('Archived lobbying summary text extraction too small');
    return {
      text,
      bytes: bytes.byteLength,
      contentSha256: createHash('sha256').update(bytes).digest('hex'),
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
    };
  } finally {
    await parser.destroy();
  }
}

type TargetRow = {
  id: string;
  rowKey: string;
  principal: string;
  reportYear: number;
  totalSpent: number;
};

async function main() {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  const databaseUrl = await chooseDb(env);
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const {
    cfbLobbyingDisbursementSummaryUrl,
    lobbyingSummaryDemonstratesPrincipalRow,
    lobbyingSummaryIdentityProven,
    CFB_LOBBYING_SUMMARY_UPPER_BOUND_VERSION,
  } = await import('../src/evidence/cfb-lobbying-summary-upper-bound.js');
  const { discoverWaybackPdfCaptures } = await import('../src/evidence/wayback.js');

  const write = wantsWrite();
  const results: Array<Record<string, unknown>> = [];
  let totalMatched = 0;
  let totalPromoted = 0;

  try {
    for (const reportYear of YEARS) {
      const sourceUrl = cfbLobbyingDisbursementSummaryUrl(reportYear);
      const captures = await discoverWaybackPdfCaptures({
        url: sourceUrl,
        from: String(reportYear + 1) + '0101',
        to: '20261231',
        limit: 100,
      });
      const candidates = captures
        .filter(capture => capture.capturedAt.slice(0, 10) > `${reportYear}-12-31`)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      let selected: WaybackCapture | null = null;
      let archived: Awaited<ReturnType<typeof fetchArchivedPdf>> | null = null;
      const captureFailures: Array<{ capturedAt: string; error: string }> = [];
      for (const capture of candidates.slice(0, 6)) {
        try {
          const fetched = await fetchArchivedPdf(capture);
          if (!lobbyingSummaryIdentityProven(fetched.text, reportYear)) {
            captureFailures.push({ capturedAt: capture.capturedAt, error: 'summary identity not proven' });
            continue;
          }
          selected = capture;
          archived = fetched;
          break;
        } catch (error) {
          captureFailures.push({ capturedAt: capture.capturedAt, error: safe(error) });
        }
      }

      if (!selected || !archived) {
        results.push({
          reportYear,
          sourceUrl,
          capturesDiscovered: captures.length,
          captureFailures,
          matchedRows: 0,
          promotedRows: 0,
          status: 'no_verified_archived_summary',
        });
        continue;
      }

      const targetResult = await pool.query<TargetRow>(`
        SELECT ei.id::text AS id,
               ei.metadata->>'rowKey' AS "rowKey",
               ei.metadata->>'principal' AS principal,
               (ei.metadata->>'reportYear')::int AS "reportYear",
               (ei.metadata->>'totalSpent')::float8 AS "totalSpent"
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE sd.source_kind='campaign_finance_lobbying_principal_bulk'
           AND ei.metadata->>'subtype'='principal_annual_expenditure'
           AND ei.metadata->>'reportYear'=$1
           AND ei.metadata->>'rowKey' IS NOT NULL
           AND (
             ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true'
             OR ei.published_at IS NULL
           )
         ORDER BY ei.metadata->>'rowKey',ei.id
      `, [String(reportYear)]);

      const matched = targetResult.rows.filter(row =>
        lobbyingSummaryDemonstratesPrincipalRow(row, archived!.text));
      totalMatched += matched.length;

      let proofSourceDocumentId: string | null = null;
      let promotedRows = 0;
      if (write && matched.length > 0) {
        const persisted = await persistDurableEvidence({
          sourceKind: 'cfb_lobbying_disbursement_summary_wayback',
          sourceUrl: selected.archiveUrl,
          contentSha256: archived.contentSha256,
          fetchedAt: archived.fetchedAt,
          httpStatus: archived.httpStatus,
          metadata: {
            publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
            originalUrl: sourceUrl,
            reportYear,
            archiveCapturedAt: selected.capturedAt,
            archiveTimestamp: selected.timestamp,
            archiveDigest: selected.digest,
            bytes: archived.bytes,
            extractionVersion: CFB_LOBBYING_SUMMARY_UPPER_BOUND_VERSION,
            availabilityBoundKind: 'conservative_upper_bound',
            exactFirstPublicationKnown: false,
          },
        }, [{
          kind: 'context',
          stance: 'neutral',
          claim:
            `An archived official Minnesota CFB lobbying disbursement summary for ${reportYear} was independently captured by ${selected.capturedAt.slice(0, 10)}.`,
          publishedAt: selected.capturedAt,
          sourceQuality: 'official',
          relevance: 'low',
          freshness: 'stale',
          extractionMethod: 'deterministic-cfb-lobbying-summary-upper-bound',
          extractionVersion: CFB_LOBBYING_SUMMARY_UPPER_BOUND_VERSION,
          confidence: 1,
          metadata: {
            contextType: 'lobbying',
            subtype: 'lobbying_summary_availability_proof',
            reportYear,
            archiveCapturedAt: selected.capturedAt,
            originalUrl: sourceUrl,
            availabilityBoundKind: 'conservative_upper_bound',
            exactFirstPublicationKnown: false,
            asOfEligible: false,
            contextOnly: true,
            mechanicallyActionable: false,
            modelWeight: 0,
            evidenceSeriesKey: `cfb_lobbying_summary_upper_bound:${reportYear}:${selected.timestamp}`,
          },
        }]);
        proofSourceDocumentId = persisted.sourceDocumentId;

        const ids = matched.map(row => row.id);
        const proofMetadata = JSON.stringify({
          asOfEligible: true,
          availabilityStatus: 'proven_by_official_summary_archive_upper_bound',
          availabilityProof: 'independent_archive_capture',
          availableAt: selected.capturedAt,
          availabilityBoundKind: 'conservative_upper_bound',
          exactFirstPublicationKnown: false,
          availabilityProofUrl: selected.archiveUrl,
          availabilitySourceUrl: sourceUrl,
          archiveCapturedAt: selected.capturedAt,
          archiveDigest: selected.digest,
          proofSourceDocumentId,
          reportYearIsAvailability: false,
          sameDayEligible: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
        });
        const update = await pool.query(`
          UPDATE evidence_items
             SET published_at=$1::timestamptz,
                 metadata=metadata || $2::jsonb
           WHERE id=ANY($3::uuid[])
             AND (
               metadata->>'asOfEligible' IS DISTINCT FROM 'true'
               OR published_at IS NULL
             )
        `, [selected.capturedAt, proofMetadata, ids]);
        promotedRows = update.rowCount ?? 0;
        if (promotedRows !== matched.length) {
          throw new Error(
            `Lobbying upper-bound promotion invariant failed for ${reportYear}: expected ${matched.length}, updated ${promotedRows}`,
          );
        }
        totalPromoted += promotedRows;
      }

      results.push({
        reportYear,
        sourceUrl,
        capturesDiscovered: captures.length,
        earliestVerifiedCapture: selected.capturedAt,
        archiveUrl: selected.archiveUrl,
        targetRows: targetResult.rows.length,
        matchedRows: matched.length,
        promotedRows,
        proofSourceDocumentId,
        matchedSample: matched.slice(0, 12).map(row => ({
          rowKey: row.rowKey,
          principal: row.principal,
          totalSpent: row.totalSpent,
        })),
        captureFailures,
        status: matched.length ? 'exact_rows_proven_by_archived_summary' : 'archive_verified_no_exact_row_matches',
      });
    }

    console.log(JSON.stringify({
      cfbLobbyingSummaryUpperBoundSalvage: {
        version: CFB_LOBBYING_SUMMARY_UPPER_BOUND_VERSION,
        write,
        results,
        totalMatched,
        totalPromoted,
        policy: {
          exactFirstPublicationRequired: false,
          exactPrincipalAndAmountContainmentRequired: true,
          independentArchiveCaptureRequired: true,
          reportYearIsAvailability: false,
          dueDateIsAvailability: false,
          activityDateIsAvailability: false,
          availableAtMeans: 'conservative_public_by_upper_bound',
          sameDayEligible: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

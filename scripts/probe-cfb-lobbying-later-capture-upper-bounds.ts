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
const MAX_CAPTURE_VARIANTS = 32;
const SCAN_TO = '20261231';
const REPORT_CUTOFFS = [
  '2024-01-31T23:59:59.999Z',
  '2024-12-31T23:59:59.999Z',
  '2025-12-31T23:59:59.999Z',
] as const;
let secrets: string[] = [];

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
      'user-agent': 'VotePredict/2.0 cfb-lobbying-later-capture-upper-bound',
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

type RowProof = {
  row: TargetRow;
  capture: WaybackCapture;
};

function dateCounts(proofs: readonly RowProof[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const proof of proofs) {
    const date = proof.capture.capturedAt.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function cutoffCounts(proofs: readonly RowProof[]): Record<string, number> {
  return Object.fromEntries(REPORT_CUTOFFS.map(cutoff => [
    cutoff.slice(0, 10),
    proofs.filter(proof => proof.capture.capturedAt <= cutoff).length,
  ]));
}

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
  const {
    cfbLobbyingDisbursementSummaryUrl,
    lobbyingSummaryDemonstratesPrincipalRow,
    lobbyingSummaryIdentityProven,
  } = await import('../src/evidence/cfb-lobbying-summary-upper-bound.js');
  const { discoverWaybackPdfCaptures } = await import('../src/evidence/wayback.js');

  const results: Array<Record<string, unknown>> = [];
  let totalTargets = 0;
  let totalMatched = 0;

  try {
    for (const reportYear of YEARS) {
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

      totalTargets += targetResult.rows.length;
      const sourceUrl = cfbLobbyingDisbursementSummaryUrl(reportYear);
      const captures = await discoverWaybackPdfCaptures({
        url: sourceUrl,
        from: String(reportYear + 1) + '0101',
        to: SCAN_TO,
        limit: 100,
      });
      const candidates = captures
        .filter(capture => capture.capturedAt.slice(0, 10) > `${reportYear}-12-31`)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .slice(0, MAX_CAPTURE_VARIANTS);

      const unmatched = new Map(targetResult.rows.map(row => [row.id, row]));
      const proofs = new Map<string, RowProof>();
      const captureAudits: Array<Record<string, unknown>> = [];
      const captureFailures: Array<{ capturedAt: string; digest: string; error: string }> = [];

      for (const capture of candidates) {
        if (unmatched.size === 0) break;
        try {
          const archived = await fetchArchivedPdf(capture);
          if (!lobbyingSummaryIdentityProven(archived.text, reportYear)) {
            captureAudits.push({
              capturedAt: capture.capturedAt,
              digest: capture.digest,
              verifiedSummaryIdentity: false,
              newlyMatchedRows: 0,
            });
            continue;
          }

          let newlyMatchedRows = 0;
          for (const row of [...unmatched.values()]) {
            if (!lobbyingSummaryDemonstratesPrincipalRow(row, archived.text)) continue;
            proofs.set(row.id, { row, capture });
            unmatched.delete(row.id);
            newlyMatchedRows += 1;
          }
          captureAudits.push({
            capturedAt: capture.capturedAt,
            digest: capture.digest,
            verifiedSummaryIdentity: true,
            contentSha256: archived.contentSha256,
            bytes: archived.bytes,
            newlyMatchedRows,
            cumulativeMatchedRows: proofs.size,
            remainingRows: unmatched.size,
          });
        } catch (error) {
          captureFailures.push({
            capturedAt: capture.capturedAt,
            digest: capture.digest,
            error: safe(error),
          });
        }
      }

      const proven = [...proofs.values()].sort((left, right) =>
        left.capture.timestamp.localeCompare(right.capture.timestamp)
        || left.row.rowKey.localeCompare(right.row.rowKey)
      );
      totalMatched += proven.length;

      results.push({
        reportYear,
        sourceUrl,
        targetTimingUnprovenRows: targetResult.rows.length,
        capturesDiscovered: captures.length,
        captureVariantsScanned: candidates.length,
        verifiedCaptureVariants: captureAudits.filter(row => row.verifiedSummaryIdentity === true).length,
        exactRowsProvenByLaterCaptures: proven.length,
        rowsStillUnproven: targetResult.rows.length - proven.length,
        earliestProofDate: proven[0]?.capture.capturedAt.slice(0, 10) ?? null,
        latestProofDate: proven.at(-1)?.capture.capturedAt.slice(0, 10) ?? null,
        proofDateDistribution: dateCounts(proven),
        rowsProvenOnOrBefore: cutoffCounts(proven),
        sample: proven.slice(0, 20).map(proof => ({
          rowKey: proof.row.rowKey,
          principal: proof.row.principal,
          totalSpent: proof.row.totalSpent,
          earliestProvenAvailableBy: proof.capture.capturedAt,
          archiveDigest: proof.capture.digest,
        })),
        captureAudits,
        captureFailures,
      });
    }

    console.log(JSON.stringify({
      cfbLobbyingLaterCaptureUpperBoundProbe: {
        version: 'cfb-lobbying-later-capture-upper-bound-probe-v1',
        readOnly: true,
        years: YEARS,
        maxCaptureVariantsPerYear: MAX_CAPTURE_VARIANTS,
        scanTo: SCAN_TO,
        totalTimingUnprovenTargets: totalTargets,
        totalExactRowsRecovered: totalMatched,
        results,
        interpretation: {
          exactFirstPublicationKnown: false,
          laterArchiveCaptureMayProveConservativeAvailableBy: true,
          eachRowUsesEarliestMatchingCapture: true,
          arbitraryCalendarDateAssignmentAllowed: false,
          statutoryDueDateIsAvailability: false,
          reportYearIsAvailability: false,
          sameDayEligible: false,
          evidenceWrites: false,
          modelOrServingChanges: false,
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

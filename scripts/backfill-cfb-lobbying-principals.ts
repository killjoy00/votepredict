import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH_SIZE = 100;
const MAX_BYTES = 12_000_000;
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
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 900);
}

function batchSize(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_LOBBYING_BATCH_SIZE ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(500, Math.max(25, requested));
}

function freshness(reportYear: number) {
  const currentYear = new Date().getUTCFullYear();
  if (reportYear >= currentYear) return 'current' as const;
  if (reportYear >= currentYear - 2) return 'recent' as const;
  return 'stale' as const;
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

async function fetchOfficialCsv(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'register.cfb.mn.gov') {
    throw new Error('Unsupported CFB lobbying source host');
  }
  if (!url.pathname.startsWith('/reports-and-data/self-help/data-downloads/lobbying/')) {
    throw new Error('Unsupported CFB lobbying source path');
  }
  const response = await fetch(url.toString(), {
    headers: { 'user-agent': 'VotePredict/2.0 cfb-lobbying-principal-backfill' },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error('CFB lobbying principal CSV HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1000 || bytes.byteLength > MAX_BYTES) {
    throw new Error('CFB lobbying principal CSV has unexpected byte length: ' + bytes.byteLength);
  }
  return {
    text: Buffer.from(bytes).toString('utf8'),
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
  const {
    CFB_LOBBYING_PRINCIPAL_DOWNLOAD_URL,
    CFB_LOBBYING_PRINCIPAL_HISTORY_VERSION,
    cfbLobbyingPrincipalContentSha256,
    parseCfbLobbyingPrincipalCsv,
  } = await import('../src/evidence/cfb-lobbying-principal-history.js');

  try {
    const source = await fetchOfficialCsv(CFB_LOBBYING_PRINCIPAL_DOWNLOAD_URL);
    const rows = parseCfbLobbyingPrincipalCsv(source.text, { fromYear: 2021, toYear: 2026 });
    if (!rows.length) throw new Error('CFB lobbying principal parser returned zero 2021-2026 rows');
    const rowContentSha256 = cfbLobbyingPrincipalContentSha256(rows);

    const drafts = rows.map(row => ({
      kind: 'context' as const,
      stance: 'neutral' as const,
      claim:
        `Minnesota CFB bulk data reports ${row.principal} (${row.entityId}) with $${row.totalSpent.toFixed(2)} in total lobbying spending for report year ${row.reportYear}, including $${row.legislativeLobbyingAmount.toFixed(2)} classified as legislative lobbying.`,
      publishedAt: undefined,
      sourceQuality: 'official' as const,
      relevance: 'low' as const,
      freshness: freshness(row.reportYear),
      extractionMethod: 'deterministic-cfb-lobbying-principal-row',
      extractionVersion: CFB_LOBBYING_PRINCIPAL_HISTORY_VERSION,
      confidence: 1,
      metadata: {
        contextType: 'lobbying',
        subtype: 'principal_annual_expenditure',
        principal: row.principal,
        entityId: row.entityId,
        reportYear: row.reportYear,
        pucLobbyingAmount: row.pucLobbyingAmount,
        legislativeLobbyingAmount: row.legislativeLobbyingAmount,
        administrativeLobbyingAmount: row.administrativeLobbyingAmount,
        mguLobbyingAmount: row.mguLobbyingAmount,
        generalLobbyingAmount: row.generalLobbyingAmount,
        totalSpent: row.totalSpent,
        rowKey: row.rowKey,
        evidenceSeriesKey: `cfb_lobbying_principal:${row.entityId}:${row.reportYear}`,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        asOfEligible: false,
        availabilityStatus: 'awaiting_regulatory_filing_or_publication_proof',
        reportYearIsAvailability: false,
        sourceSnapshotFetchedAt: source.fetchedAt,
      },
    }));

    const size = batchSize();
    const totalBatches = Math.ceil(drafts.length / size);
    let inserted = 0;
    let reused = 0;
    let sourceDocumentId: string | null = null;

    for (let offset = 0, batchNumber = 1; offset < drafts.length; offset += size, batchNumber += 1) {
      const batch = drafts.slice(offset, offset + size);
      const persisted = await persistDurableEvidence({
        sourceKind: 'campaign_finance_lobbying_principal_bulk',
        sourceUrl: CFB_LOBBYING_PRINCIPAL_DOWNLOAD_URL,
        contentSha256: source.contentSha256,
        fetchedAt: source.fetchedAt,
        httpStatus: source.httpStatus,
        metadata: {
          publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
          dataset: 'lobbying_principal_expenditures',
          years: [2021, 2022, 2023, 2024, 2025, 2026],
          rowCount: rows.length,
          rowContentSha256,
          bytes: source.bytes,
          parserVersion: CFB_LOBBYING_PRINCIPAL_HISTORY_VERSION,
          historicalAvailability: 'pending_regulatory_filing_or_publication_proof',
          reportYearIsAvailability: false,
        },
      }, batch);

      sourceDocumentId ??= persisted.sourceDocumentId;
      inserted += persisted.inserted;
      reused += persisted.reused;

      console.log(JSON.stringify({
        cfbLobbyingPrincipalProgress: {
          batch: batchNumber,
          totalBatches,
          batchRows: batch.length,
          processedRows: Math.min(offset + batch.length, drafts.length),
          totalRows: drafts.length,
          inserted,
          reused,
        },
      }));
    }

    console.log(JSON.stringify({
      cfbLobbyingPrincipalBackfill: {
        rows: rows.length,
        rowContentSha256,
        sourceSha256: source.contentSha256,
        sourceDocumentId,
        batchSize: size,
        batches: totalBatches,
        inserted,
        reused,
        asOfEligibleRows: 0,
        policy: {
          reportYearIsAvailability: false,
          filingOrPublicationProofRequiredForHistoricalUse: true,
          contextOnly: true,
          mechanicallyActionable: false,
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

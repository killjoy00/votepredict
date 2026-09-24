import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH_SIZE = 100;
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

function batchSize(): number {
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_IE_BATCH_SIZE ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(500, Math.max(25, requested));
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

function freshness(date: string | null) {
  if (!date) return 'unknown' as const;
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
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const { discoverCampaignFinanceDownloadUrls, fetchCampaignFinanceBulkText } =
    await import('../src/evidence/campaign-finance-live.js');
  const {
    parseCfbIndependentExpenditureCsv,
    sessionForIndependentExpenditureYear,
    independentExpenditureContentSha256,
    CFB_INDEPENDENT_EXPENDITURE_HISTORY_VERSION,
  } = await import('../src/evidence/cfb-independent-expenditure-history.js');

  try {
    const urls = await discoverCampaignFinanceDownloadUrls();
    const text = await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const rows = parseCfbIndependentExpenditureCsv(text, { fromYear: 2021, toYear: 2026 });
    if (!rows.length) throw new Error('CFB historical IE parser returned zero 2021-2026 rows');

    const sourceHash = createHash('sha256').update(text).digest('hex');
    const rowContentSha256 = independentExpenditureContentSha256(rows);
    const fetchedAt = new Date().toISOString();
    const drafts = rows.map(row => {
      const session = sessionForIndependentExpenditureYear(row.year);
      return {
        target: row.candidateName && row.chamber && session ? {
          memberName: row.candidateName,
          sessionSlug: session,
          chamberSlug: row.chamber,
          occurredOn: row.transactionDate ?? undefined,
        } : undefined,
        kind: 'context' as const,
        stance: 'neutral' as const,
        claim: `Minnesota CFB reports ${row.direction === 'for' ? 'supporting' : row.direction === 'against' ? 'opposing' : 'independent'} expenditure of $${row.totalAmount.toFixed(2)} by ${row.spender} affecting ${row.affectedCommitteeName}.`,
        publishedAt: undefined,
        sourceQuality: 'official' as const,
        relevance: 'low' as const,
        freshness: freshness(row.transactionDate),
        extractionMethod: 'deterministic-cfb-independent-expenditure-row',
        extractionVersion: CFB_INDEPENDENT_EXPENDITURE_HISTORY_VERSION,
        confidence: 1,
        metadata: {
          contextType: 'campaign_finance',
          subtype: 'independent_expenditure_record',
          contextOnly: true,
          mechanicallyActionable: false,
          asOfEligible: false,
          availabilityStatus: 'awaiting_regulatory_disclosure_proof',
          transactionDate: row.transactionDate,
          year: row.year,
          spender: row.spender,
          spenderRegistrationNumber: row.spenderRegistrationNumber,
          affectedCommitteeName: row.affectedCommitteeName,
          affectedCommitteeRegistrationNumber: row.affectedCommitteeRegistrationNumber,
          candidateName: row.candidateName,
          chamber: row.chamber,
          direction: row.direction,
          amount: row.amount,
          unpaidAmount: row.unpaidAmount,
          totalAmount: row.totalAmount,
          rowKey: row.rowKey,
          evidenceSeriesKey: `cfb_ie_row:${row.rowKey}`,
        },
      };
    });

    const size = batchSize();
    const totalBatches = Math.ceil(drafts.length / size);
    let inserted = 0;
    let reused = 0;
    let unresolved = 0;
    let sourceDocumentId: string | null = null;

    for (let offset = 0, batchNumber = 1; offset < drafts.length; offset += size, batchNumber += 1) {
      const batch = drafts.slice(offset, offset + size);
      const persisted = await persistDurableEvidence({
        sourceKind: 'campaign_finance_independent_expenditure_bulk',
        sourceUrl: urls.independentExpenditures,
        contentSha256: sourceHash,
        fetchedAt,
        metadata: {
          publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
          dataset: 'independent_expenditures',
          years: [2021, 2022, 2023, 2024, 2025, 2026],
          rowCount: rows.length,
          rowContentSha256,
          historicalAvailability: 'pending_disclosure_proof',
        },
      }, batch);

      sourceDocumentId ??= persisted.sourceDocumentId;
      inserted += persisted.inserted;
      reused += persisted.reused;
      unresolved += persisted.unresolvedTargets.length;

      console.log(JSON.stringify({
        cfbIndependentExpenditureProgress: {
          batch: batchNumber,
          totalBatches,
          batchRows: batch.length,
          processedRows: Math.min(offset + batch.length, drafts.length),
          totalRows: drafts.length,
          inserted,
          reused,
          unresolved,
        },
      }));
    }

    console.log(JSON.stringify({
      cfbIndependentExpenditureBackfill: {
        rows: rows.length,
        rowContentSha256,
        sourceSha256: sourceHash,
        batchSize: size,
        batches: totalBatches,
        inserted,
        reused,
        unresolved,
        sourceDocumentId,
        asOfEligibleRows: 0,
        policy: {
          transactionDateIsAvailability: false,
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

import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH_SIZE = 500;
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
  const requested = Number.parseInt(process.env.VOTEPREDICT_CFB_BULK_REPAIR_BATCH_SIZE ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.min(5000, Math.max(1, requested));
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
  const {
    CFB_BULK_AVAILABILITY_REPAIR_VERSION,
    repairLegacyCfbBulkAvailability,
  } = await import('../src/evidence/cfb-bulk-availability-repair.js');

  try {
    const before = await pool.query<{ total: number; publicationDated: number }>(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE ei.published_at IS NOT NULL)::int AS "publicationDated"
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id = ei.source_document_id
       WHERE sd.source_kind = 'campaign_finance_bulk'`);

    const client = await pool.connect();
    let result;
    try {
      result = await repairLegacyCfbBulkAvailability(client, batchSize());
    } finally {
      client.release();
    }

    const after = await pool.query<{ total: number; publicationDated: number; eligible: number }>(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE ei.published_at IS NOT NULL)::int AS "publicationDated",
             count(*) FILTER (WHERE COALESCE(ei.metadata->>'asOfEligible', 'true') <> 'false')::int AS eligible
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id = ei.source_document_id
       WHERE sd.source_kind = 'campaign_finance_bulk'`);

    const beforeRow = before.rows[0] ?? { total: 0, publicationDated: 0 };
    const afterRow = after.rows[0] ?? { total: 0, publicationDated: 0, eligible: 0 };
    if (afterRow.publicationDated !== 0 || afterRow.eligible !== 0) {
      throw new Error(`CFB bulk availability repair failed closed verification: publicationDated=${afterRow.publicationDated} eligible=${afterRow.eligible}`);
    }

    console.log(JSON.stringify({
      cfbBulkAvailabilityRepair: {
        version: CFB_BULK_AVAILABILITY_REPAIR_VERSION,
        batchSize: batchSize(),
        rowsBefore: beforeRow.total,
        publicationDatedBefore: beforeRow.publicationDated,
        repaired: result.repaired,
        batches: result.batches,
        rowsAfter: afterRow.total,
        publicationDatedAfter: afterRow.publicationDated,
        asOfEligibleAfter: afterRow.eligible,
        policy: {
          transactionDateIsAvailability: false,
          historicalAvailability: 'fail_closed_pending_regulatory_disclosure_proof',
          provenancePreserved: true,
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

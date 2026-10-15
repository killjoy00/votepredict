/**
 * Raw Minnesota Senate committee testimony collection (2023 onward).
 *
 * Examples:
 *   npm run data:senate:testimony -- --session 2025-2026 --from 2026-03-01 --to 2026-04-30 --out /tmp/senate-testimony.jsonl
 *   npm run data:senate:testimony -- --session 2023-2024 --from 2023-01-01 --to 2024-12-31 --committee "Human Services" --out /tmp/senate-2023.jsonl
 *   npm run data:senate:testimony -- --session 2025-2026 --write  # requires migrated database, explicit opt-in
 *
 * By default this is a no-database collection: it emits source records into
 * JSONL if --out is supplied. --write is the only mode making database writes;
 * it only touches senate_committee_testimony_raw (never production forecasts).
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import {
  collectSenateCommitteeTestimony, normalizedBill, type RawSenateTestimonyRecord,
} from '../src/sources/minnesota/senate-committee-testimony.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

function arg(args: string[], name: string): string | undefined {
  const inline = args.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function date(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z'))) {
    throw new Error(`${name} requires a real YYYY-MM-DD date`);
  }
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sessionName = arg(args, '--session');
  if (!sessionName) throw new Error('--session is required, e.g. 2025-2026 or 2023-2024');
  const session = getMinnesotaHouseSession(sessionName);
  if (!['2025-2026', '2023-2024'].includes(session.slug)) {
    throw new Error('Senate testimony collector supports 2025-2026 and 2023-2024');
  }
  const today = new Date().toISOString().slice(0, 10);
  const from = date(arg(args, '--from') ?? session.startsOn, '--from');
  const to = date(arg(args, '--to') ?? (session.endsOn < today ? session.endsOn : today), '--to');
  const limitArg = arg(args, '--limit');
  const delayArg = arg(args, '--delay-ms');
  const limit = limitArg ? Number(limitArg) : undefined;
  const delayMs = delayArg ? Number(delayArg) : 350;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(delayMs) || delayMs < 200) throw new Error('--delay-ms must be at least 200');
  const write = args.includes('--write');
  if (write && args.includes('--dry-run')) throw new Error('--write and --dry-run cannot be combined');
  const out = arg(args, '--out');
  if (out) writeFileSync(out, '');

  // Creating the pool lazily avoids requiring any database key for raw
  // collection, local experiments, or pull-request CI.
  let pool: Pool | undefined;
  let sessionId: string | undefined;
  const billIds = new Map<string, string>();
  if (write) {
    const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Database URL required for --write; use --out to collect without a database');
    pool = new Pool({ connectionString, max: 1 });
    const sessions = await pool.query<{ id: string }>(
      `SELECT ls.id FROM legislative_sessions ls
        JOIN jurisdictions j ON j.id=ls.jurisdiction_id
       WHERE j.slug='us-mn' AND ls.slug=$1`, [session.slug],
    );
    if (sessions.rows.length !== 1) throw new Error('Session missing: apply migrations and seed Minnesota sessions first');
    sessionId = sessions.rows[0].id;
    const bills = await pool.query<{ id: string; identifier: string }>(
      'SELECT id, identifier FROM bills WHERE session_id=$1', [sessionId],
    );
    for (const bill of bills.rows) {
      const identifier = normalizedBill(bill.identifier);
      if (identifier) billIds.set(identifier, bill.id);
    }
  }

  try {
    const summary = await collectSenateCommitteeTestimony({
      session, from, to,
      committee: arg(args, '--committee'),
      limit, delayMs,
      parsePdfLists: !args.includes('--no-pdf-lists'),
      onRecord: async (row: RawSenateTestimonyRecord) => {
        if (out) appendFileSync(out, JSON.stringify(row) + '\n');
        if (!pool || !sessionId) return;
        await pool.query(
          `INSERT INTO senate_committee_testimony_raw
             (session_id, hearing_id, record_key, source_type, source_url, fetched_at, hearing_date,
              source_content_type, raw_content, raw_content_url, committee, bill_identifier, bill_id,
              witness_name, organization, stated_position, document_name, document_kind)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (session_id, record_key) DO UPDATE SET
             fetched_at=EXCLUDED.fetched_at,
             raw_content=EXCLUDED.raw_content,
             raw_content_url=EXCLUDED.raw_content_url,
             bill_id=EXCLUDED.bill_id`,
          [
            sessionId, row.hearingId, row.recordKey, row.sourceType, row.sourceUrl, row.fetchedAt,
            row.hearingDate, row.sourceContentType, row.rawContent, row.rawContentUrl,
            row.committee, row.billIdentifier, row.billIdentifier ? billIds.get(row.billIdentifier) ?? null : null,
            row.witnessName, row.organization, row.statedPosition, row.documentName, row.documentKind,
          ],
        );
      },
    });
    console.log(JSON.stringify({ mode: write ? 'database' : 'raw-jsonl', out: out ?? null, ...summary }));
    if (summary.hearings === 0) process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

main().catch((error) => {
  // Never include credentials or connection strings in collection logs.
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]') : 'Collection failed');
  process.exitCode = 1;
});

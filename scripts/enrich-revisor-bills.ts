import { Pool } from 'pg';
import { fetchRevisorBill } from '../src/sources/minnesota/revisor.js';
import { getMinnesotaHouseSession, MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '../src/sources/minnesota/sessions.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requestedSession = argumentValue(args, '--session');
  const sessions = requestedSession ? [getMinnesotaHouseSession(requestedSession)] : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];
  const limit = parsePositiveInteger(argumentValue(args, '--limit'), '--limit');
  const includeText = args.includes('--include-text');
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 2 });
  let failures = 0;
  try {
    for (const session of sessions) {
      const result = await pool.query<{ id: string; identifier: string }>(
        `SELECT b.id, b.identifier
           FROM bills b
           JOIN legislative_sessions s ON s.id = b.session_id
           JOIN jurisdictions j ON j.id = s.jurisdiction_id
          WHERE j.slug = 'us-mn' AND s.slug = $1
          ORDER BY b.identifier`,
        [session.slug],
      );
      const bills = limit ? result.rows.slice(0, limit) : result.rows;
      console.log(`[${session.slug}] enriching ${bills.length}/${result.rows.length} bills from Revisor`);

      for (const [index, bill] of bills.entries()) {
        try {
          const metadata = await fetchRevisorBill(session.sessionKey, bill.identifier, includeText);
          await pool.query('BEGIN');
          try {
            await pool.query(
              `UPDATE bills SET
                 title = COALESCE($2, title),
                 status = COALESCE($3, status),
                 source_url = $4,
                 metadata = metadata || $5::jsonb,
                 updated_at = now()
               WHERE id = $1`,
              [
                bill.id,
                metadata.description || metadata.title,
                metadata.currentVersion || 'Official Revisor record',
                metadata.sourceUrl,
                JSON.stringify({
                  revisor: {
                    legislature: metadata.legislature,
                    sessionStartYear: metadata.sessionStartYear,
                    currentVersion: metadata.currentVersion,
                    latestTextUrl: metadata.latestTextUrl,
                  },
                }),
              ],
            );

            if (metadata.text && metadata.textSha256) {
              await pool.query(
                `INSERT INTO bill_versions (bill_id, version_key, text_url, text_hash, raw_text, source_url)
                 VALUES ($1, $2, $3, $4, $5, $3)
                 ON CONFLICT (bill_id, version_key) DO UPDATE SET
                   text_url = EXCLUDED.text_url,
                   text_hash = EXCLUDED.text_hash,
                   raw_text = EXCLUDED.raw_text,
                   source_url = EXCLUDED.source_url`,
                [bill.id, metadata.currentVersion || 'latest', metadata.latestTextUrl, metadata.textSha256, metadata.text],
              );
            }
            await pool.query('COMMIT');
          } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
          }
        } catch (error) {
          failures += 1;
          console.error(`[${session.slug}] ${bill.identifier}: ${error instanceof Error ? error.message : error}`);
        }
        if ((index + 1) % 25 === 0 || index === bills.length - 1) console.log(`[${session.slug}] ${index + 1}/${bills.length}`);
      }
    }
  } finally {
    await pool.end();
  }

  if (failures > 0) {
    console.error(`${failures} bill enrichment(s) failed`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

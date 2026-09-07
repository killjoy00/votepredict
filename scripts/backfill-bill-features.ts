import { Pool } from 'pg';
import { BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION, extractDeterministicBillFeatures } from '../src/features/bills.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const session = argumentValue(args, '--session');
  const limitValue = argumentValue(args, '--limit');
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
  if (limitValue && (!Number.isInteger(limit) || (limit ?? 0) <= 0)) throw new Error('--limit must be a positive integer');
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query<{
      id: string;
      bill_id: string;
      identifier: string;
      session_slug: string;
      title: string;
      version_key: string;
      published_at: string;
      text_hash: string | null;
      raw_text: string;
      source_url: string | null;
    }>(`
      SELECT bv.id, bv.bill_id, b.identifier, s.slug AS session_slug, b.title, bv.version_key,
             bv.published_at::text, bv.text_hash, bv.raw_text, bv.source_url
        FROM bill_versions bv
        JOIN bills b ON b.id = bv.bill_id
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE bv.published_at IS NOT NULL
         AND bv.raw_text IS NOT NULL
         AND length(bv.raw_text) >= 100
         AND ($1::text IS NULL OR s.slug = $1)
       ORDER BY bv.published_at, b.identifier, bv.version_key`,
      [session ?? null],
    );
    const rows = limit ? result.rows.slice(0, limit) : result.rows;
    let processed = 0;
    for (const row of rows) {
      const features = extractDeterministicBillFeatures({ title: row.title, text: row.raw_text });
      await pool.query(`
        INSERT INTO bill_feature_sets (
          bill_version_id, feature_schema_version, extractor_kind, extractor_version,
          features, confidence, provenance, generated_at
        ) VALUES ($1,$2,'deterministic',$3,$4::jsonb,'{}'::jsonb,$5::jsonb,now())
        ON CONFLICT (bill_version_id, feature_schema_version, extractor_kind, extractor_version)
        DO UPDATE SET features=EXCLUDED.features, provenance=EXCLUDED.provenance, generated_at=now()`, [
        row.id,
        BILL_FEATURE_SCHEMA_VERSION,
        DETERMINISTIC_EXTRACTOR_VERSION,
        JSON.stringify(features),
        JSON.stringify({
          billId: row.bill_id,
          identifier: row.identifier,
          session: row.session_slug,
          versionKey: row.version_key,
          publishedAt: row.published_at,
          sourceTextHash: row.text_hash,
          sourceUrl: row.source_url,
        }),
      ]);
      processed += 1;
      if (processed % 100 === 0 || processed === rows.length) console.log(`bill features ${processed}/${rows.length}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const migrationSql = readFileSync('migrations/0013_evidence_quality.sql', 'utf8');
  const expectedChecksum = checksum(migrationSql);
  const { Client } = await import('pg');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('SET default_transaction_read_only = on');

    const ledger = await client.query<{ filename: string; checksum: string }>(
      'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename',
    );
    const applied0013 = ledger.rows.find((row) => row.filename === '0013_evidence_quality.sql');

    const objects = await client.query<{
      source_documents: string | null;
      evidence_items: string | null;
      source_document_texts: string | null;
      evidence_quality_annotations: string | null;
    }>(`
      SELECT
        to_regclass('public.source_documents')::text AS source_documents,
        to_regclass('public.evidence_items')::text AS evidence_items,
        to_regclass('public.source_document_texts')::text AS source_document_texts,
        to_regclass('public.evidence_quality_annotations')::text AS evidence_quality_annotations
    `);

    const row = objects.rows[0];
    if (!row?.source_documents || !row.evidence_items) {
      throw new Error('Evidence Quality migration prerequisites are missing');
    }

    const prior = ledger.rows.filter((entry) => entry.filename !== '0013_evidence_quality.sql');
    if (prior.length !== 12) {
      throw new Error(`Expected exactly 12 prior migration ledger entries, found ${prior.length}`);
    }

    if (applied0013 && applied0013.checksum !== expectedChecksum) {
      throw new Error('Applied 0013 checksum does not match repository migration');
    }

    const newTablesPresent = Boolean(row.source_document_texts && row.evidence_quality_annotations);
    if (applied0013 && !newTablesPresent) {
      throw new Error('0013 is recorded in the ledger but its tables are missing');
    }
    if (!applied0013 && (row.source_document_texts || row.evidence_quality_annotations)) {
      throw new Error('Evidence Quality tables exist before 0013 is recorded');
    }

    process.stdout.write(JSON.stringify({
      evidenceQualityMigrationPreflight: {
        priorLedgerEntries: prior.length,
        migration0013Applied: Boolean(applied0013),
        migration0013ChecksumMatches: applied0013 ? applied0013.checksum === expectedChecksum : null,
        prerequisitesPresent: true,
        newTablesPresent,
        safeToApply: !applied0013 && !newTablesPresent,
      },
    }, null, 2) + '\n');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

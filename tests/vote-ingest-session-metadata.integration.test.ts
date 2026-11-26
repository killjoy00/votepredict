import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { ensureVoteIngestSessionMetadata } from '../src/operations/vote-ingest-session-metadata.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

const integrationUrl = process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;

test('historical and future vote ingest cannot alter the active legislature', { skip: !integrationUrl }, async () => {
  if (!['localhost', '127.0.0.1'].includes(new URL(integrationUrl!).hostname)) {
    throw new Error('Vote ingest rehearsal requires disposable local PostgreSQL');
  }
  const pool = new Pool({ connectionString: integrationUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jurisdiction = await client.query<{ id: string }>(
      "INSERT INTO jurisdictions (slug,name,country_code) VALUES ($1,'Synthetic','US') RETURNING id",
      [`vote-ingest-test-${process.pid}-${Date.now()}`],
    );
    const id = jurisdiction.rows[0].id;
    const old = getMinnesotaHouseSession('2025-2026');
    const next = getMinnesotaHouseSession('2027-2028');
    await ensureVoteIngestSessionMetadata(client, id, old);
    await ensureVoteIngestSessionMetadata(client, id, next);
    const state = async () => (await client.query<{ slug: string; is_current: boolean }>(
      'SELECT slug,is_current FROM legislative_sessions WHERE jurisdiction_id=$1 ORDER BY slug', [id],
    )).rows;
    assert.deepEqual(await state(), [{ slug: old.slug, is_current: false }, { slug: next.slug, is_current: false }]);
    // Model a successful roster-owned switch; replay either vote importer.
    await client.query('UPDATE legislative_sessions SET is_current=(slug=$2) WHERE jurisdiction_id=$1', [id, next.slug]);
    await ensureVoteIngestSessionMetadata(client, id, old);
    await ensureVoteIngestSessionMetadata(client, id, next);
    assert.deepEqual(await state(), [{ slug: old.slug, is_current: false }, { slug: next.slug, is_current: true }]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});

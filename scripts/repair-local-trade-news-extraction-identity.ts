import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { evidenceIngestionKey } from '../src/evidence/durable-ingestion.js';
import type { DurableEvidenceDraft } from '../src/evidence/durable-ingestion.js';

const LEGACY_VERSION = 'local-trade-news-history-v4';
const CANONICAL_VERSION = 'local-trade-news-history-v3';
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const MAX_LEGACY_ROWS = 500;
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').replace(/https?:\/\/\S+/gi, '[source URL]').slice(0, 1200);
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
  if (!secret) throw new Error('CRON_SECRET required for database bridge fallback');
  const response = await fetch(DATABASE_BRIDGE_URL, { headers: { authorization: `Bearer ${secret}` } });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

interface LegacyRow {
  id: string;
  source_document_id: string;
  bill_id: string | null;
  membership_id: string | null;
  evidence_kind: DurableEvidenceDraft['kind'];
  stance: DurableEvidenceDraft['stance'] | null;
  claim: string;
  extraction_method: string;
  archive_captured_at: string;
  source_url: string;
  content_sha256: string;
  metadata: Record<string, unknown>;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const apply = process.argv.includes('--apply');
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
  const client = await pool.connect();
  let duplicateRows = 0;
  let canonicalizedRows = 0;
  let rewiredRelationships = 0;
  let sourceDocumentsRelabeled = 0;

  try {
    await client.query('BEGIN');
    const legacy = await client.query<LegacyRow>(`
      SELECT
        ei.id::text,
        ei.source_document_id::text,
        ei.bill_id::text,
        ei.membership_id::text,
        ei.evidence_kind,
        ei.stance,
        ei.claim,
        ei.extraction_method,
        ei.metadata->>'archiveCapturedAt' AS archive_captured_at,
        sd.source_url,
        sd.content_sha256,
        ei.metadata
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id = ei.source_document_id
      WHERE sd.source_kind = 'wayback_local_trade_news'
        AND ei.metadata->>'contextType' = 'local_trade_news'
        AND ei.extraction_version = $1
      ORDER BY ei.id
      FOR UPDATE OF ei
    `, [LEGACY_VERSION]);

    if (legacy.rows.length > MAX_LEGACY_ROWS) {
      throw new Error(`Refusing to repair ${legacy.rows.length} legacy rows; guardrail is ${MAX_LEGACY_ROWS}`);
    }

    for (const row of legacy.rows) {
      if (!row.archive_captured_at) throw new Error(`Legacy row ${row.id} lacks archiveCapturedAt`);
      const draft: DurableEvidenceDraft = {
        kind: row.evidence_kind,
        stance: row.stance ?? undefined,
        claim: row.claim,
        publishedAt: row.archive_captured_at,
        sourceQuality: 'reputable_secondary',
        relevance: 'low',
        freshness: 'stale',
        extractionMethod: row.extraction_method,
        extractionVersion: CANONICAL_VERSION,
        metadata: typeof row.metadata.ingestionIdentityKey === 'string'
          ? { ingestionIdentityKey: row.metadata.ingestionIdentityKey }
          : {},
      };
      const canonicalKey = evidenceIngestionKey({
        sourceUrl: row.source_url,
        contentSha256: row.content_sha256,
        membershipId: row.membership_id ?? undefined,
        billId: row.bill_id ?? undefined,
        draft,
      });
      const existing = await client.query<{ id: string }>(`
        SELECT id::text
        FROM evidence_items
        WHERE metadata->>'ingestionKey' = $1
          AND id <> $2::uuid
        ORDER BY id
        LIMIT 2
      `, [canonicalKey, row.id]);
      if (existing.rows.length > 1) throw new Error(`Multiple canonical rows found for legacy row ${row.id}`);

      if (existing.rows[0]) {
        duplicateRows += 1;
        if (apply) {
          const canonicalId = existing.rows[0].id;
          const outgoing = await client.query(`
            INSERT INTO evidence_relationships (from_evidence_id,to_evidence_id,relation_kind,reason)
            SELECT $1::uuid, er.to_evidence_id, er.relation_kind, er.reason
            FROM evidence_relationships er
            WHERE er.from_evidence_id = $2::uuid
              AND er.to_evidence_id <> $1::uuid
            ON CONFLICT DO NOTHING
          `, [canonicalId, row.id]);
          const incoming = await client.query(`
            INSERT INTO evidence_relationships (from_evidence_id,to_evidence_id,relation_kind,reason)
            SELECT er.from_evidence_id, $1::uuid, er.relation_kind, er.reason
            FROM evidence_relationships er
            WHERE er.to_evidence_id = $2::uuid
              AND er.from_evidence_id <> $1::uuid
            ON CONFLICT DO NOTHING
          `, [canonicalId, row.id]);
          rewiredRelationships += (outgoing.rowCount ?? 0) + (incoming.rowCount ?? 0);
          await client.query('DELETE FROM evidence_items WHERE id = $1::uuid', [row.id]);
        }
        continue;
      }

      canonicalizedRows += 1;
      if (apply) {
        await client.query(`
          UPDATE evidence_items
             SET extraction_version = $2,
                 metadata = metadata || jsonb_build_object('ingestionKey', $3::text)
           WHERE id = $1::uuid
        `, [row.id, CANONICAL_VERSION, canonicalKey]);
      }
    }

    if (apply) {
      const relabeled = await client.query(`
        UPDATE source_documents
           SET metadata = metadata || jsonb_build_object('collectorVersion', $2::text)
         WHERE source_kind = 'wayback_local_trade_news'
           AND metadata->>'collectorVersion' = $1
      `, [LEGACY_VERSION, CANONICAL_VERSION]);
      sourceDocumentsRelabeled = relabeled.rowCount ?? 0;
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    console.log(JSON.stringify({
      localTradeNewsIdentityRepair: {
        apply,
        legacyVersion: LEGACY_VERSION,
        canonicalVersion: CANONICAL_VERSION,
        legacyRows: legacy.rows.length,
        duplicateRows,
        canonicalizedRows,
        rewiredRelationships,
        sourceDocumentsRelabeled,
        productionAction: apply ? 'identity_repair_only' : 'dry_run',
        servingChanged: false,
        evidenceSemanticsChanged: false,
      },
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

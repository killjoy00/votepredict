import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SNAPSHOT_RUN_ID = 37099902152;
const CUTOFF = '2026-10-03T05:29:17Z';
const BATCH_SIZE = 25;
const BATCH_OFFSET = 25;
const BATCH_START_ROW = 26;
const BATCH_END_ROW = 50;
let secrets: string[] = [];

type EvidenceRow = {
  publishedAt?: string | null;
  memberName?: string | null;
  billIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ExportRow = {
  source_document_id: string;
  source_document_text_id: string;
  source_kind: string;
  source_url: string;
  source_fetched_at: string;
  source_metadata: Record<string, unknown> | null;
  source_content_sha256: string;
  text_sha256: string;
  snapshot_created_at: string;
  normalized_text: string;
  priority_rank: number;
  priority_tier: string;
  evidence_rows: EvidenceRow[];
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1400);
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function candidateContext(rows: readonly EvidenceRow[]) {
  const members = new Set<string>();
  const bills = new Set<string>();
  let publishedAt: string | undefined;

  for (const row of rows) {
    if (row.memberName) members.add(row.memberName);
    if (row.billIdentifier) bills.add(row.billIdentifier.toUpperCase());

    const metadata = row.metadata ?? {};
    for (const name of stringArray(metadata.mentionedMembers)) members.add(name);
    for (const identifier of stringArray(metadata.billIdentifiers)) bills.add(identifier.toUpperCase());

    if (typeof metadata.memberName === 'string' && metadata.memberName.trim()) {
      members.add(metadata.memberName.trim());
    }
    if (typeof metadata.exactBillIdentifier === 'string' && metadata.exactBillIdentifier.trim()) {
      bills.add(metadata.exactBillIdentifier.trim().toUpperCase());
    }
    if (row.publishedAt && (!publishedAt || row.publishedAt < publishedAt)) {
      publishedAt = row.publishedAt;
    }
  }

  return {
    memberNames: [...members].sort().slice(0, 24),
    billIdentifiers: [...bills].sort().slice(0, 24),
    publishedAt,
  };
}

function historicalAvailableAt(sourceMetadata: Record<string, unknown> | null, fetchedAt: string): string {
  const metadata = sourceMetadata ?? {};
  for (const key of ['availableAt', 'archiveCapturedAt']) {
    const value = metadata[key];
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  }
  return fetchedAt;
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
    EVIDENCE_QUALITY_SOURCE_KINDS,
    EVIDENCE_QUALITY_TEXT_VERSION,
  } = await import('../src/evidence/evidence-quality.js');

  const client = await pool.connect();
  let rows: ExportRow[] = [];
  let eligibleCount = 0;

  try {
    await client.query('BEGIN READ ONLY');

    const countResult = await client.query<{ count: number }>(`
      WITH document_features AS (
        SELECT
          sd.id,
          bool_or(
            ei.membership_id IS NOT NULL
            OR (
              jsonb_typeof(ei.metadata->'mentionedMembers')='array'
              AND jsonb_array_length(ei.metadata->'mentionedMembers') > 0
            )
            OR nullif(trim(coalesce(ei.metadata->>'memberName','')),'') IS NOT NULL
          ) AS has_member,
          bool_or(
            ei.bill_id IS NOT NULL
            OR (
              jsonb_typeof(ei.metadata->'billIdentifiers')='array'
              AND jsonb_array_length(ei.metadata->'billIdentifiers') > 0
            )
            OR nullif(trim(coalesce(ei.metadata->>'exactBillIdentifier','')),'') IS NOT NULL
          ) AS has_bill,
          bool_or(
            ei.relevance IN ('direct','high')
            OR ei.evidence_kind IN ('direct_statement','related_statement')
          ) AS direct_or_high
        FROM source_documents sd
        JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$1
         AND sdt.created_at <= $2::timestamptz
        JOIN evidence_items ei ON ei.source_document_id=sd.id
        WHERE sd.source_kind = ANY($3::text[])
          AND sd.source_kind <> 'house_session_daily'
        GROUP BY sd.id
      ),
      prioritized AS (
        SELECT CASE
          WHEN has_member AND has_bill THEN 1
          WHEN has_member AND direct_or_high THEN 2
          WHEN has_bill AND direct_or_high THEN 3
          WHEN has_member OR has_bill THEN 4
          ELSE 5
        END AS priority_rank
        FROM document_features
      )
      SELECT count(*)::int AS count
      FROM prioritized
      WHERE priority_rank <= 2
    `, [EVIDENCE_QUALITY_TEXT_VERSION, CUTOFF, [...EVIDENCE_QUALITY_SOURCE_KINDS]]);
    eligibleCount = countResult.rows[0]?.count ?? 0;

    const result = await client.query<ExportRow>(`
      WITH document_features AS (
        SELECT
          sd.id,
          sd.source_kind,
          sd.source_url,
          sd.fetched_at,
          sd.metadata AS source_metadata,
          sdt.id AS source_document_text_id,
          sdt.source_content_sha256,
          sdt.text_sha256,
          sdt.created_at AS snapshot_created_at,
          sdt.normalized_text,
          jsonb_agg(
            jsonb_build_object(
              'publishedAt',ei.published_at,
              'memberName',l.name,
              'billIdentifier',b.identifier,
              'metadata',ei.metadata
            )
            ORDER BY ei.created_at,ei.id
          ) AS evidence_rows,
          bool_or(
            ei.membership_id IS NOT NULL
            OR (
              jsonb_typeof(ei.metadata->'mentionedMembers')='array'
              AND jsonb_array_length(ei.metadata->'mentionedMembers') > 0
            )
            OR nullif(trim(coalesce(ei.metadata->>'memberName','')),'') IS NOT NULL
          ) AS has_member,
          bool_or(
            ei.bill_id IS NOT NULL
            OR (
              jsonb_typeof(ei.metadata->'billIdentifiers')='array'
              AND jsonb_array_length(ei.metadata->'billIdentifiers') > 0
            )
            OR nullif(trim(coalesce(ei.metadata->>'exactBillIdentifier','')),'') IS NOT NULL
          ) AS has_bill,
          bool_or(
            ei.relevance IN ('direct','high')
            OR ei.evidence_kind IN ('direct_statement','related_statement')
          ) AS direct_or_high
        FROM source_documents sd
        JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$1
         AND sdt.created_at <= $2::timestamptz
        JOIN evidence_items ei ON ei.source_document_id=sd.id
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN legislators l ON l.id=m.legislator_id
        LEFT JOIN bills b ON b.id=ei.bill_id
        WHERE sd.source_kind = ANY($3::text[])
          AND sd.source_kind <> 'house_session_daily'
        GROUP BY sd.id,sdt.id
      ),
      prioritized AS (
        SELECT *,
          CASE
            WHEN has_member AND has_bill THEN 1
            WHEN has_member AND direct_or_high THEN 2
            WHEN has_bill AND direct_or_high THEN 3
            WHEN has_member OR has_bill THEN 4
            ELSE 5
          END AS priority_rank
        FROM document_features
      )
      SELECT
        id::text AS source_document_id,
        source_document_text_id::text,
        source_kind,
        source_url,
        fetched_at::text AS source_fetched_at,
        source_metadata,
        source_content_sha256,
        text_sha256,
        snapshot_created_at::text,
        normalized_text,
        priority_rank,
        CASE priority_rank
          WHEN 1 THEN 'P1_exact_member_bill'
          WHEN 2 THEN 'P2_member_strong'
          ELSE 'out_of_scope'
        END AS priority_tier,
        evidence_rows
      FROM prioritized
      WHERE priority_rank <= 2
      ORDER BY priority_rank,fetched_at,id
      LIMIT $4
      OFFSET $5
    `, [EVIDENCE_QUALITY_TEXT_VERSION, CUTOFF, [...EVIDENCE_QUALITY_SOURCE_KINDS], BATCH_SIZE, BATCH_OFFSET]);

    rows = result.rows;
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (rows.length !== BATCH_SIZE) {
    throw new Error(`Frozen Batch 2 export expected ${BATCH_SIZE} rows but selected ${rows.length}`);
  }

  const documents = rows.map((row, index) => {
    if (row.source_kind === 'house_session_daily') throw new Error('house_session_daily entered frozen cohort');
    if (![1, 2].includes(Number(row.priority_rank))) throw new Error('Out-of-scope priority entered frozen cohort');
    if (Date.parse(row.snapshot_created_at) > Date.parse(CUTOFF)) throw new Error('Snapshot newer than cohort cutoff entered frozen cohort');
    if (!row.normalized_text.trim()) throw new Error('Frozen source text is empty');

    const candidates = candidateContext(row.evidence_rows ?? []);
    return {
      batchRow: BATCH_START_ROW + index,
      priorityRank: Number(row.priority_rank),
      priorityTier: row.priority_tier,
      sourceDocumentId: row.source_document_id,
      sourceDocumentTextId: row.source_document_text_id,
      sourceKind: row.source_kind,
      sourceUrl: row.source_url,
      sourceFetchedAt: row.source_fetched_at,
      snapshotCreatedAt: row.snapshot_created_at,
      sourceContentSha256: row.source_content_sha256,
      textSha256: row.text_sha256,
      title: typeof row.source_metadata?.title === 'string' ? row.source_metadata.title : null,
      publishedAt: candidates.publishedAt ?? null,
      availableAt: historicalAvailableAt(row.source_metadata, row.source_fetched_at),
      candidateMemberNames: candidates.memberNames,
      candidateBillIdentifiers: candidates.billIdentifiers,
      normalizedText: row.normalized_text,
    };
  });

  if (documents[0]?.batchRow !== BATCH_START_ROW || documents.at(-1)?.batchRow !== BATCH_END_ROW) {
    throw new Error('Frozen Batch 2 row range mismatch');
  }

  const batch1Path = resolve('data/evaluation/evidence-quality/manual-annotations/batch-01.json');
  const batch1 = JSON.parse(readFileSync(batch1Path, 'utf8')) as { selectedSourceDocumentIds?: string[] };
  const batch1Ids = new Set(batch1.selectedSourceDocumentIds ?? []);
  const overlap = documents.map((document) => document.sourceDocumentId).filter((id) => batch1Ids.has(id));
  if (overlap.length > 0) {
    throw new Error('Frozen Batch 2 overlaps merged Batch 1: ' + overlap.join(','));
  }

  const integritySha256 = createHash('sha256')
    .update(JSON.stringify(documents))
    .digest('hex');

  const artifact = {
    artifactVersion: 'evidence-quality-manual-batch-v1',
    batch: 2,
    rowRange: { start: BATCH_START_ROW, end: BATCH_END_ROW },
    sourceSnapshotRunId: SNAPSHOT_RUN_ID,
    cohortCutoff: CUTOFF,
    textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    eligibleFrozenP1P2Documents: eligibleCount,
    selectedDocuments: documents.length,
    ordering: ['priority rank: P1 before P2', 'source document fetched_at', 'source document ID'],
    exclusions: ['house_session_daily'],
    policy: {
      productionReadOnly: true,
      voteOutcomesQueried: false,
      predictionOrServingWork: false,
      mutableWebContentUsed: false,
    },
    integritySha256,
    documents,
  };

  const output = resolve(process.env.VOTEPREDICT_EVIDENCE_QUALITY_MANUAL_EXPORT_OUTPUT
    ?? 'artifacts/evidence-quality-manual-batch2-frozen.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    evidenceQualityManualExport: {
      batch: 2,
      rowRange: { start: BATCH_START_ROW, end: BATCH_END_ROW },
      sourceSnapshotRunId: SNAPSHOT_RUN_ID,
      cohortCutoff: CUTOFF,
      eligibleFrozenP1P2Documents: eligibleCount,
      selectedDocuments: documents.length,
      firstSourceDocumentId: documents[0]?.sourceDocumentId,
      lastSourceDocumentId: documents.at(-1)?.sourceDocumentId,
      integritySha256,
      output,
      readOnly: true,
      outcomeUse: 'none',
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

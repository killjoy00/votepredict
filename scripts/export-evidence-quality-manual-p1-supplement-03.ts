import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SNAPSHOT_RUN_ID = 37170314795;
const PREVIOUS_CUTOFF = '2026-10-04T00:27:44.362338Z';
const CUTOFF = '2026-10-04T02:13:29.630968Z';
const COHORT_ID = 'P1-SUP-003';
const EXPECTED_DOCUMENTS = 14;
const RECOVERY_SOURCE_IDS = [
  "dc4777d6-db17-49f6-8a0c-68b7b6ee6090",
  "4e5b47c5-ef03-4110-a76c-4b4344e3477c",
  "31f932b7-f041-4dfa-a0bc-6bc2b5e7904a",
  "91443654-4836-49b6-a2e7-1b1d58d7f4c8",
  "815f4f61-dc89-4015-b85d-1970c2d747c9",
  "48c5a044-3fe6-47ac-a70a-f9f65abfcb30",
  "dbf9b4c0-4bac-4e95-a8bf-9dc915c4bcc0",
  "c0dce838-0b38-4cc1-86e7-3b1349b77557",
  "7b150880-2230-47b8-869a-a74c813daf42",
  "0a17ac65-1c00-4dbe-a274-84f57db88842",
  "5c79048c-9495-4b75-b112-27da7f25059b",
  "b77c7cfa-b484-4c94-9068-8f222700bcc7",
  "785a19f6-3703-4bc6-b692-c64d5659dd42",
  "5c39c0ad-987a-48c4-8c16-1f57986b63c0",
  "8b775dea-8edf-4635-9c5e-c107a1828941",
  "2b6d9e05-c6ca-4538-9cc7-86ba9f323b64",
  "54f7719e-ca87-4963-818f-360454450c42",
  "f77e5eb0-ae12-448b-ab0f-42b6946acd54",
  "88d7691f-83b9-40d5-accb-ba0e43cae3a1",
  "eb29f10d-ff7f-4b41-8701-fc4daa389447",
  "d7dfface-1b2f-47aa-84cc-e92987a29855",
  "2d85c31f-f4ca-44b2-b252-bd7fc98c275d",
  "ec0515c4-ba78-4b83-b996-b9a795817638",
  "cd679835-c1bc-408d-8000-79a3ed44c110",
  "163885dc-3f81-4f39-923c-fd17f03ec3bf"
] as const;
const PRIOR_BATCH_PATHS = [
  'data/evaluation/evidence-quality/manual-annotations/batch-01.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-02.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-03.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-04.json',
] as const;
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
    if (typeof metadata.memberName === 'string' && metadata.memberName.trim()) members.add(metadata.memberName.trim());
    if (typeof metadata.exactBillIdentifier === 'string' && metadata.exactBillIdentifier.trim()) {
      bills.add(metadata.exactBillIdentifier.trim().toUpperCase());
    }
    if (row.publishedAt && (!publishedAt || row.publishedAt < publishedAt)) publishedAt = row.publishedAt;
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

function priorManualSourceIds(): string[] {
  const ids = new Set<string>();
  for (const path of PRIOR_BATCH_PATHS) {
    const batch = JSON.parse(readFileSync(resolve(path), 'utf8')) as {
      selectedSourceDocumentIds?: string[];
      documents?: Array<{ sourceDocumentId?: string }>;
    };
    for (const id of batch.selectedSourceDocumentIds ?? []) ids.add(id);
    for (const document of batch.documents ?? []) {
      if (document.sourceDocumentId) ids.add(document.sourceDocumentId);
    }
  }
  if (ids.size !== 101) throw new Error(`Expected 101 prior manual source documents, found ${ids.size}`);
  return [...ids].sort();
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

  const priorIds = priorManualSourceIds();
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
          ) AS has_bill
        FROM source_documents sd
        JOIN source_document_texts sdt
          ON sdt.source_document_id=sd.id
         AND sdt.extraction_version=$1
         AND sdt.created_at <= $2::timestamptz
        JOIN evidence_items ei ON ei.source_document_id=sd.id
        WHERE sd.source_kind = ANY($3::text[])
          AND sd.source_kind <> 'house_session_daily'
          AND sd.id = ANY($5::uuid[])
          AND NOT (sd.id = ANY($4::uuid[]))
        GROUP BY sd.id
      )
      SELECT count(*)::int AS count
        FROM document_features
       WHERE has_member AND has_bill
    `, [EVIDENCE_QUALITY_TEXT_VERSION, CUTOFF, [...EVIDENCE_QUALITY_SOURCE_KINDS], priorIds, [...RECOVERY_SOURCE_IDS]]);
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
          ) AS has_bill
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
          AND sd.id = ANY($5::uuid[])
          AND NOT (sd.id = ANY($4::uuid[]))
        GROUP BY sd.id,sdt.id
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
        evidence_rows
      FROM document_features
      WHERE has_member AND has_bill
      ORDER BY fetched_at,id
    `, [EVIDENCE_QUALITY_TEXT_VERSION, CUTOFF, [...EVIDENCE_QUALITY_SOURCE_KINDS], priorIds, [...RECOVERY_SOURCE_IDS]]);

    rows = result.rows;
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (eligibleCount !== EXPECTED_DOCUMENTS || rows.length !== EXPECTED_DOCUMENTS) {
    throw new Error(`Supplemental P1 export expected ${EXPECTED_DOCUMENTS} rows but count=${eligibleCount} selected=${rows.length}`);
  }

  const documents = rows.map((row, index) => {
    if (row.source_kind === 'house_session_daily') throw new Error('house_session_daily entered supplemental P1 cohort');
    if (Date.parse(row.snapshot_created_at) > Date.parse(CUTOFF)) throw new Error('Snapshot newer than supplemental cohort cutoff entered cohort');
    if (!RECOVERY_SOURCE_IDS.includes(row.source_document_id as (typeof RECOVERY_SOURCE_IDS)[number])) throw new Error('Source outside recovery run attempted-source set entered cohort');
    if (!row.normalized_text.trim()) throw new Error('Frozen source text is empty');
    if (priorIds.includes(row.source_document_id)) throw new Error('Supplemental P1 cohort overlaps prior manual cohort');

    const candidates = candidateContext(row.evidence_rows ?? []);
    if (candidates.memberNames.length === 0 || candidates.billIdentifiers.length === 0) {
      throw new Error(`Supplemental P1 row ${index + 1} lacks deterministic member+bill candidates`);
    }
    return {
      batchRow: index + 1,
      priorityRank: 1,
      priorityTier: 'P1_exact_member_bill',
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

  if (new Set(documents.map((document) => document.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Supplemental P1 cohort contains duplicate source document IDs');
  }
  if (new Set(documents.map((document) => document.sourceDocumentTextId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Supplemental P1 cohort contains duplicate source text IDs');
  }

  const integritySha256 = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
  const artifact = {
    artifactVersion: 'evidence-quality-manual-supplement-v1',
    cohortId: COHORT_ID,
    sourceSnapshotRunId: SNAPSHOT_RUN_ID,
    cohortCutoff: CUTOFF,
    textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    priorManualDocumentsExcluded: priorIds.length,
    eligibleUnannotatedFrozenP1Documents: eligibleCount,
    selectedDocuments: documents.length,
    ordering: ['source document fetched_at', 'source document ID'],
    previousSupplementCutoff: PREVIOUS_CUTOFF,
    recoverySourceDocumentIds: [...RECOVERY_SOURCE_IDS],
    exclusions: [
      'house_session_daily',
      'all 101 source documents from manual batches 1-4',
      'all source documents outside recovery run 37170314795 attempted-source set',
    ],
    policy: {
      productionReadOnly: true,
      voteOutcomesQueried: false,
      predictionOrServingWork: false,
      mutableWebContentUsed: false,
      priorityTier: 'P1_exact_member_bill',
    },
    integritySha256,
    documents,
  };

  const output = resolve(process.env.VOTEPREDICT_EVIDENCE_QUALITY_MANUAL_EXPORT_OUTPUT
    ?? 'artifacts/evidence-quality-manual-p1-supplement-03-frozen.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    evidenceQualityManualSupplementExport: {
      cohortId: COHORT_ID,
      sourceSnapshotRunId: SNAPSHOT_RUN_ID,
      cohortCutoff: CUTOFF,
      priorManualDocumentsExcluded: priorIds.length,
      eligibleUnannotatedFrozenP1Documents: eligibleCount,
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

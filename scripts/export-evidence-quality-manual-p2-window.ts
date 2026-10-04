import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
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
  relevance?: string | null;
  evidenceKind?: string | null;
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
    if (typeof metadata.exactBillIdentifier === 'string' && metadata.exactBillIdentifier.trim()) bills.add(metadata.exactBillIdentifier.trim().toUpperCase());
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
    for (const document of batch.documents ?? []) if (document.sourceDocumentId) ids.add(document.sourceDocumentId);
  }
  if (ids.size !== 101) throw new Error(`Expected 101 prior manual source documents, found ${ids.size}`);
  return [...ids].sort();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const cohortId = required('VOTEPREDICT_EVIDENCE_QUALITY_P2_COHORT_ID');
  const previousCutoff = required('VOTEPREDICT_EVIDENCE_QUALITY_P2_PREVIOUS_CUTOFF');
  const cutoff = required('VOTEPREDICT_EVIDENCE_QUALITY_P2_CUTOFF');
  const sourceSnapshotIngestionRunId = required('VOTEPREDICT_EVIDENCE_QUALITY_SOURCE_SNAPSHOT_INGESTION_RUN_ID');
  const expectedDocuments = Number.parseInt(required('VOTEPREDICT_EVIDENCE_QUALITY_P2_EXPECTED_DOCUMENTS'), 10);
  if (!Number.isFinite(expectedDocuments) || expectedDocuments <= 0) throw new Error('Expected document count must be positive');
  if (!Number.isFinite(Date.parse(previousCutoff)) || !Number.isFinite(Date.parse(cutoff))) throw new Error('Invalid P2 supplement cutoff');
  if (Date.parse(previousCutoff) >= Date.parse(cutoff)) throw new Error('P2 supplement cutoff must be after previous cutoff');

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
  const { EVIDENCE_QUALITY_SOURCE_KINDS, EVIDENCE_QUALITY_TEXT_VERSION } = await import('../src/evidence/evidence-quality.js');

  const client = await pool.connect();
  let rows: ExportRow[] = [];
  try {
    await client.query('BEGIN READ ONLY');
    const params = [
      EVIDENCE_QUALITY_TEXT_VERSION,
      previousCutoff,
      cutoff,
      [...EVIDENCE_QUALITY_SOURCE_KINDS],
      priorIds,
    ];
    const result = await client.query<ExportRow>(`
      SELECT
        sd.id::text AS source_document_id,
        sdt.id::text AS source_document_text_id,
        sd.source_kind,
        sd.source_url,
        sd.fetched_at::text AS source_fetched_at,
        sd.metadata AS source_metadata,
        sdt.source_content_sha256,
        sdt.text_sha256,
        sdt.created_at::text AS snapshot_created_at,
        sdt.normalized_text,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'publishedAt',ei.published_at,
              'memberName',l.name,
              'billIdentifier',b.identifier,
              'relevance',ei.relevance,
              'evidenceKind',ei.evidence_kind,
              'metadata',ei.metadata
            )
            ORDER BY ei.created_at,ei.id
          ) FILTER (WHERE ei.id IS NOT NULL),
          '[]'::jsonb
        ) AS evidence_rows
      FROM source_document_texts sdt
      JOIN source_documents sd ON sd.id=sdt.source_document_id
      LEFT JOIN evidence_items ei
        ON ei.source_document_id=sd.id
       AND ei.created_at <= $3::timestamptz
      LEFT JOIN memberships m ON m.id=ei.membership_id
      LEFT JOIN legislators l ON l.id=m.legislator_id
      LEFT JOIN bills b ON b.id=ei.bill_id
      WHERE sdt.extraction_version=$1
        AND sdt.created_at > $2::timestamptz
        AND sdt.created_at <= $3::timestamptz
        AND sd.source_kind = ANY($4::text[])
        AND sd.source_kind <> 'house_session_daily'
        AND NOT (sd.id = ANY($5::uuid[]))
      GROUP BY sd.id,sdt.id
      ORDER BY sd.fetched_at,sd.id`, params);
    rows = result.rows;
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (rows.length !== expectedDocuments) {
    throw new Error(`${cohortId} expected ${expectedDocuments} snapshot-window documents but selected ${rows.length}`);
  }

  const documents = rows.map((row, index) => {
    if (Date.parse(row.snapshot_created_at) <= Date.parse(previousCutoff) || Date.parse(row.snapshot_created_at) > Date.parse(cutoff)) {
      throw new Error(`${cohortId} row ${index + 1} snapshot is outside frozen window`);
    }
    if (row.source_kind === 'house_session_daily') throw new Error('house_session_daily entered P2 cohort');
    if (!row.normalized_text.trim()) throw new Error(`${cohortId} row ${index + 1} frozen source text is empty`);
    if (priorIds.includes(row.source_document_id)) throw new Error(`${cohortId} overlaps baseline manual cohort`);

    const candidates = candidateContext(row.evidence_rows ?? []);
    if (candidates.memberNames.length === 0) throw new Error(`${cohortId} row ${index + 1} lacks deterministic member candidates`);
    if (candidates.billIdentifiers.length !== 0) throw new Error(`${cohortId} row ${index + 1} unexpectedly has bill candidates at frozen cutoff`);
    const directOrHigh = (row.evidence_rows ?? []).some((evidence) =>
      evidence.relevance === 'direct'
      || evidence.relevance === 'high'
      || evidence.evidenceKind === 'direct_statement'
      || evidence.evidenceKind === 'related_statement');
    if (!directOrHigh) throw new Error(`${cohortId} row ${index + 1} lacks direct/high evidence at frozen cutoff`);

    return {
      batchRow: index + 1,
      priorityRank: 2,
      priorityTier: 'P2_member_strong',
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
      candidateBillIdentifiers: [],
      normalizedText: row.normalized_text,
    };
  });

  if (new Set(documents.map((d) => d.sourceDocumentId)).size !== expectedDocuments) throw new Error(`${cohortId} contains duplicate source document IDs`);
  if (new Set(documents.map((d) => d.sourceDocumentTextId)).size !== expectedDocuments) throw new Error(`${cohortId} contains duplicate source text IDs`);

  const integritySha256 = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
  const artifact = {
    artifactVersion: 'evidence-quality-manual-supplement-v1',
    cohortId,
    sourceSnapshotIngestionRunId,
    previousSupplementCutoff: previousCutoff,
    cohortCutoff: cutoff,
    evidenceCutoff: cutoff,
    textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    priorManualDocumentsExcluded: priorIds.length,
    selectedDocuments: documents.length,
    ordering: ['source document fetched_at', 'source document ID'],
    exclusions: [
      'house_session_daily',
      'all 101 source documents from manual batches 1-4',
      'documents outside the exact source-text snapshot creation window',
      'documents with deterministic bill linkage at the frozen cutoff',
      'documents without member linkage or direct/high evidence at the frozen cutoff',
    ],
    policy: {
      productionReadOnly: true,
      voteOutcomesQueried: false,
      predictionOrServingWork: false,
      mutableWebContentUsed: false,
      priorityTier: 'P2_member_strong',
      billInferenceAllowed: false,
    },
    integritySha256,
    documents,
  };

  const output = resolve(required('VOTEPREDICT_EVIDENCE_QUALITY_MANUAL_EXPORT_OUTPUT'));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    evidenceQualityManualP2WindowExport: {
      cohortId,
      sourceSnapshotIngestionRunId,
      previousSupplementCutoff: previousCutoff,
      cohortCutoff: cutoff,
      priorManualDocumentsExcluded: priorIds.length,
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

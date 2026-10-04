import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
  evidenceQualityExtractionConfidence,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
  type EvidenceQualitySourceKind,
} from '../src/evidence/evidence-quality.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const EXPECTED_DOCUMENTS = 101;
const EXPECTED_CUTOFF = '2026-10-03T05:29:17Z';
const MANUAL_PROVIDER = 'manual-openai';
const REVIEW_VERSION = 'baseline-101-second-pass-v1';
const HUMAN_ADJUDICATION_VERSION = 'baseline-101-human-adjudication-v1';
const SYNC_VERSION = 'baseline-101-reviewed-production-sync-v1';

const BATCH_PATHS = [
  'data/evaluation/evidence-quality/manual-annotations/batch-01.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-02.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-03.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-04.json',
] as const;

const EXPECTED_REPAIR_SOURCE_IDS = [
  'eb2a29a5-029e-425d-81d8-d9536bff5818',
  '1cc98f6a-99af-46e2-b127-bd7c5981694c',
  'c5265947-3184-4151-9f7e-5730c9e9fe06',
  '894a1d79-9bc6-4257-9d74-f62591e2d92c',
  'a91d5e3f-110b-42b5-a829-cca40d9f9ebe',
  'd4731ca8-75af-475d-ae1b-9164bbf4b68a',
  'e76ffed9-ff0f-4ad8-b3dc-d051dd955480',
  '20499c17-6414-4c3a-b832-3ad3eaaff2dc',
  '93ef6f73-4676-4ed0-afa3-86161da7c0c6',
  'e9c0f2d1-ffaf-4c61-b731-b1486771d365',
  'c21414ca-36ad-41c4-ac81-4ef1771b2785',
  '47f6d3e6-701f-460f-bf1c-0912165c0b49',
  '535b888c-8d26-434f-b8df-343b677fd5c9',
  '8ae52cc1-5a4f-4b4f-a9d1-ca0767e0df56',
  'e22e38b5-0038-4b73-84d2-28f576d5e228',
] as const;

const HUMAN_ADJUDICATED_SOURCE_IDS = new Set([
  '894a1d79-9bc6-4257-9d74-f62591e2d92c',
  '69f2839a-1f47-4828-b611-ebbeb45e3edc',
  'b408092a-9261-437d-affb-7bbc3794010b',
  '8ad6d16e-3cc8-4706-9dcb-908bff3806fe',
]);

let secrets: string[] = [];

type ManualDocument = {
  row: number;
  sourceDocumentId: string;
  sourceDocumentTextId: string;
  sourceKind: EvidenceQualitySourceKind;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  annotation: EvidenceQualityAnnotation;
  calculatedExtractionConfidence: number;
  validationFailures: string[];
};

type ManualBatch = {
  batchId: string;
  schemaVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  sourceSnapshotRunId: number;
  sourceTextVersion: string;
  cohortCutoff: string;
  rowRange: { start: number; end: number };
  selectedSourceDocumentIds: string[];
  documents: ManualDocument[];
  validationFailures: string[];
};

type DocumentWithBatch = ManualDocument & {
  batchId: string;
  batchPath: string;
  provider: string;
  model: string;
  sourceSnapshotRunId: number;
};

type SourceRow = {
  source_document_id: string;
  source_document_text_id: string;
  source_kind: string;
  source_url: string;
  normalized_text: string;
  extraction_version: string;
};

type EvidenceRow = {
  source_document_id: string;
  created_at: string;
  member_name: string | null;
  bill_identifier: string | null;
  metadata: Record<string, unknown> | null;
};

type ExistingRow = {
  id: string;
  source_document_id: string;
  source_document_text_id: string | null;
  classifier_model: string;
  annotation: EvidenceQualityAnnotation;
  extraction_confidence: number;
  outcome_blind: boolean;
  context_only: boolean;
  mechanically_actionable: boolean;
  model_weight: number;
  metadata: Record<string, unknown>;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1600);
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
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: 'Bearer ' + secret } });
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

function normalizedMembers(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizedBills(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function candidateContext(rows: readonly EvidenceRow[]) {
  const members = new Set<string>();
  const bills = new Set<string>();
  for (const row of rows) {
    if (row.member_name) members.add(row.member_name.trim());
    if (row.bill_identifier) bills.add(row.bill_identifier.trim().toUpperCase());
    const metadata = row.metadata ?? {};
    for (const name of stringArray(metadata.mentionedMembers)) members.add(name);
    for (const identifier of stringArray(metadata.billIdentifiers)) bills.add(identifier.toUpperCase());
    if (typeof metadata.memberName === 'string' && metadata.memberName.trim()) members.add(metadata.memberName.trim());
    if (typeof metadata.exactBillIdentifier === 'string' && metadata.exactBillIdentifier.trim()) {
      bills.add(metadata.exactBillIdentifier.trim().toUpperCase());
    }
  }
  return {
    memberNames: normalizedMembers([...members]).slice(0, 24),
    billIdentifiers: normalizedBills([...bills]).slice(0, 24),
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function semanticFingerprint(document: ManualDocument): string {
  const claims = document.annotation.claims.map((claim) => ({
    memberNames: normalizedMembers(claim.memberNames),
    billIdentifiers: normalizedBills(claim.billIdentifiers),
    linkage: claim.linkage,
    claimType: claim.claimType,
    stance: claim.stance,
    specificity: claim.specificity,
    explicitness: claim.explicitness,
    attributionType: claim.attributionType,
    attributedActor: claim.attributedActor?.trim() ?? null,
    normalizedClaim: normalizeText(claim.normalizedClaim),
    supportingExcerpt: normalizeText(claim.supportingExcerpt),
  }));
  return createHash('sha256').update(JSON.stringify({
    sourceKind: document.sourceKind,
    candidateMemberNames: normalizedMembers(document.candidateMemberNames),
    candidateBillIdentifiers: normalizedBills(document.candidateBillIdentifiers),
    claims,
  })).digest('hex');
}

function loadDocuments(): DocumentWithBatch[] {
  const documents: DocumentWithBatch[] = [];
  for (const path of BATCH_PATHS) {
    const batch = JSON.parse(readFileSync(resolve(path), 'utf8')) as ManualBatch;
    if (batch.schemaVersion !== EVIDENCE_QUALITY_SCHEMA_VERSION) throw new Error(path + ': schema mismatch');
    if (batch.promptVersion !== EVIDENCE_QUALITY_PROMPT_VERSION) throw new Error(path + ': prompt mismatch');
    if (batch.sourceTextVersion !== EVIDENCE_QUALITY_TEXT_VERSION) throw new Error(path + ': source text version mismatch');
    if (batch.cohortCutoff !== EXPECTED_CUTOFF) throw new Error(path + ': cutoff mismatch');
    if (batch.validationFailures.length) throw new Error(path + ': batch validation failures present');
    if (batch.documents.length !== batch.rowRange.end - batch.rowRange.start + 1) throw new Error(path + ': row range mismatch');
    if (batch.selectedSourceDocumentIds.length !== batch.documents.length) throw new Error(path + ': selected source count mismatch');
    const selected = new Set(batch.selectedSourceDocumentIds);
    for (const document of batch.documents) {
      if (!selected.has(document.sourceDocumentId)) throw new Error(path + ': selected source identity mismatch');
      if (document.validationFailures.length) throw new Error(path + ': row ' + document.row + ' validation failures present');
      const minimum = evidenceQualityExtractionConfidence(document.annotation);
      if (Math.abs(minimum - document.calculatedExtractionConfidence) > 1e-12) throw new Error(path + ': extraction confidence mismatch');
      documents.push({ ...document, batchId: batch.batchId, batchPath: path, provider: batch.provider, model: batch.model, sourceSnapshotRunId: batch.sourceSnapshotRunId });
    }
  }
  if (documents.length !== EXPECTED_DOCUMENTS) throw new Error('Expected 101 documents');
  if (new Set(documents.map((d) => d.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) throw new Error('Duplicate source IDs');
  if (new Set(documents.map((d) => d.sourceDocumentTextId)).size !== EXPECTED_DOCUMENTS) throw new Error('Duplicate source text IDs');
  const rows = documents.map((d) => d.row).sort((a, b) => a - b);
  for (let row = 1; row <= EXPECTED_DOCUMENTS; row += 1) if (rows[row - 1] !== row) throw new Error('Row coverage mismatch');
  return documents.sort((a, b) => a.row - b.row);
}

function exactSet(values: readonly string[], expected: readonly string[]): boolean {
  const a = [...new Set(values)].sort();
  const b = [...new Set(expected)].sort();
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const apply = process.argv.includes('--apply');
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

  const documents = loadDocuments();
  const { pool } = await import('../src/lib/db/index.js');

  const textIds = documents.map((d) => d.sourceDocumentTextId);
  const sourceRows = await pool.query<SourceRow>(`
    SELECT sd.id::text AS source_document_id,
           sdt.id::text AS source_document_text_id,
           sd.source_kind,
           sd.source_url,
           sdt.normalized_text,
           sdt.extraction_version
      FROM source_document_texts sdt
      JOIN source_documents sd ON sd.id=sdt.source_document_id
     WHERE sdt.id = ANY($1::uuid[])`, [textIds]);
  if (sourceRows.rows.length !== EXPECTED_DOCUMENTS) throw new Error('Frozen source text coverage mismatch');
  const sourcesByTextId = new Map(sourceRows.rows.map((row) => [row.source_document_text_id, row]));

  const sourceIds = documents.map((d) => d.sourceDocumentId);
  const evidence = await pool.query<EvidenceRow>(`
    SELECT ei.source_document_id::text,
           ei.created_at::text,
           l.name AS member_name,
           b.identifier AS bill_identifier,
           ei.metadata
      FROM evidence_items ei
      LEFT JOIN memberships m ON m.id=ei.membership_id
      LEFT JOIN legislators l ON l.id=m.legislator_id
      LEFT JOIN bills b ON b.id=ei.bill_id
     WHERE ei.source_document_id = ANY($1::uuid[])
     ORDER BY ei.source_document_id,ei.created_at,ei.id`, [sourceIds]);
  const evidenceBySource = new Map<string, EvidenceRow[]>();
  for (const row of evidence.rows) {
    const list = evidenceBySource.get(row.source_document_id) ?? [];
    list.push(row);
    evidenceBySource.set(row.source_document_id, list);
  }

  const fingerprints = new Map<string, number[]>();
  for (const document of documents) {
    const source = sourcesByTextId.get(document.sourceDocumentTextId);
    if (!source) throw new Error('Missing source text row');
    if (source.source_document_id !== document.sourceDocumentId) throw new Error('Source/text identity mismatch at row ' + document.row);
    if (source.source_kind !== document.sourceKind) throw new Error('Source kind mismatch at row ' + document.row);
    if (source.extraction_version !== EVIDENCE_QUALITY_TEXT_VERSION) throw new Error('Text version mismatch at row ' + document.row);

    const frozenEvidence = (evidenceBySource.get(document.sourceDocumentId) ?? [])
      .filter((row) => Date.parse(row.created_at) <= Date.parse(EXPECTED_CUTOFF));
    const candidates = candidateContext(frozenEvidence);
    if (JSON.stringify(candidates.memberNames) !== JSON.stringify(normalizedMembers(document.candidateMemberNames))) {
      throw new Error('Candidate member mismatch at row ' + document.row);
    }
    if (JSON.stringify(candidates.billIdentifiers) !== JSON.stringify(normalizedBills(document.candidateBillIdentifiers))) {
      throw new Error('Candidate bill mismatch at row ' + document.row);
    }
    validateEvidenceQualityAnnotation(document.annotation, {
      sourceKind: document.sourceKind,
      sourceUrl: source.source_url,
      contentMode: 'verified_full_text',
      text: source.normalized_text,
      candidateMemberNames: document.candidateMemberNames,
      candidateBillIdentifiers: document.candidateBillIdentifiers,
    });
    const fingerprint = semanticFingerprint(document);
    const rows = fingerprints.get(fingerprint) ?? [];
    rows.push(document.row);
    fingerprints.set(fingerprint, rows);
  }

  const existing = await pool.query<ExistingRow>(`
    SELECT id::text,
           source_document_id::text,
           source_document_text_id::text,
           classifier_model,
           annotation,
           extraction_confidence,
           outcome_blind,
           context_only,
           mechanically_actionable,
           model_weight,
           metadata
      FROM evidence_quality_annotations
     WHERE source_document_id = ANY($1::uuid[])
       AND schema_version=$2
       AND prompt_version=$3
       AND classifier_provider=$4
       AND content_mode='verified_full_text'`, [
    sourceIds, EVIDENCE_QUALITY_SCHEMA_VERSION, EVIDENCE_QUALITY_PROMPT_VERSION, MANUAL_PROVIDER,
  ]);
  if (existing.rows.length !== EXPECTED_DOCUMENTS) throw new Error('Expected all 101 baseline production annotations');
  const existingBySource = new Map(existing.rows.map((row) => [row.source_document_id, row]));

  const mismatches: string[] = [];
  let metadataCurrent = true;
  for (const document of documents) {
    const row = existingBySource.get(document.sourceDocumentId);
    if (!row) throw new Error('Missing production annotation for row ' + document.row);
    if (row.source_document_text_id !== document.sourceDocumentTextId) throw new Error('Production text identity mismatch at row ' + document.row);
    if (row.classifier_model !== document.model) throw new Error('Production model metadata mismatch at row ' + document.row);
    if (!row.outcome_blind || !row.context_only || row.mechanically_actionable || row.model_weight !== 0) {
      throw new Error('Production policy invariant mismatch at row ' + document.row);
    }
    if (canonicalJson(row.annotation) !== canonicalJson(document.annotation)
      || Math.abs(row.extraction_confidence - document.calculatedExtractionConfidence) > 1e-12) {
      mismatches.push(document.sourceDocumentId);
    }
    const fingerprint = semanticFingerprint(document);
    const duplicateRows = fingerprints.get(fingerprint) ?? [document.row];
    if (row.metadata?.semanticFingerprint !== fingerprint
      || row.metadata?.semanticDuplicateGroupSize !== duplicateRows.length
      || canonicalJson(row.metadata?.semanticDuplicateRows ?? []) !== canonicalJson(duplicateRows)
      || row.metadata?.baselineProductionSyncVersion !== SYNC_VERSION) {
      metadataCurrent = false;
    }
  }

  const uniqueSemanticSignatures = fingerprints.size;
  const duplicateGroups = [...fingerprints.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([fingerprint, rows]) => ({ fingerprint, rows }))
    .sort((a, b) => a.rows[0] - b.rows[0]);

  if (mismatches.length === 0 && metadataCurrent) {
    console.log(JSON.stringify({ baselineReviewedProductionSync: {
      documents: EXPECTED_DOCUMENTS,
      annotationMismatches: 0,
      alreadyApplied: true,
      applied: false,
      uniqueSemanticSignatures,
      duplicateSemanticGroups: duplicateGroups,
      humanJudgmentCasesResolved: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      servingChanged: false,
    } }, null, 2));
    await pool.end();
    return;
  }

  if (!exactSet(mismatches, EXPECTED_REPAIR_SOURCE_IDS)) {
    throw new Error('Production annotation mismatch set is not exactly the 15 reviewed repair source IDs: ' + JSON.stringify([...new Set(mismatches)].sort()));
  }

  if (!apply) {
    console.log(JSON.stringify({ baselineReviewedProductionSync: {
      documents: EXPECTED_DOCUMENTS,
      annotationMismatches: mismatches.length,
      expectedRepairSourceIdsMatchedExactly: true,
      alreadyApplied: false,
      applied: false,
      safeToApply: true,
      uniqueSemanticSignatures,
      duplicateSemanticGroups: duplicateGroups,
      humanJudgmentCasesResolved: true,
      humanAdjudicatedSourceIds: [...HUMAN_ADJUDICATED_SOURCE_IDS].sort(),
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      servingChanged: false,
    } }, null, 2));
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const document of documents) {
      const row = existingBySource.get(document.sourceDocumentId)!;
      const fingerprint = semanticFingerprint(document);
      const duplicateRows = fingerprints.get(fingerprint) ?? [document.row];
      const metadata = {
        ...(row.metadata ?? {}),
        semanticFingerprint: fingerprint,
        semanticDuplicateGroupSize: duplicateRows.length,
        semanticDuplicateRows: duplicateRows,
        baselineReviewVersion: REVIEW_VERSION,
        baselineProductionSyncVersion: SYNC_VERSION,
        humanAdjudicationVersion: HUMAN_ADJUDICATED_SOURCE_IDS.has(document.sourceDocumentId) ? HUMAN_ADJUDICATION_VERSION : (row.metadata?.humanAdjudicationVersion ?? null),
        humanAdjudicationDecision: HUMAN_ADJUDICATED_SOURCE_IDS.has(document.sourceDocumentId) ? 'retain_directional_support' : (row.metadata?.humanAdjudicationDecision ?? null),
        baselineSecondPassRepairApplied: (EXPECTED_REPAIR_SOURCE_IDS as readonly string[]).includes(document.sourceDocumentId),
        noVoteOutcomeUse: true,
      };
      await client.query(`
        UPDATE evidence_quality_annotations
           SET annotation=$1::jsonb,
               extraction_confidence=$2,
               metadata=$3::jsonb
         WHERE id=$4::uuid`, [
        JSON.stringify(document.annotation),
        document.calculatedExtractionConfidence,
        JSON.stringify(metadata),
        row.id,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  console.log(JSON.stringify({ baselineReviewedProductionSync: {
    documents: EXPECTED_DOCUMENTS,
    annotationMismatches: mismatches.length,
    expectedRepairSourceIdsMatchedExactly: true,
    alreadyApplied: false,
    applied: true,
    updatedAnnotationRows: mismatches.length,
    refreshedMetadataRows: EXPECTED_DOCUMENTS,
    uniqueSemanticSignatures,
    duplicateSemanticGroups: duplicateGroups,
    humanJudgmentCasesResolved: true,
    contextOnly: true,
    mechanicallyActionable: false,
    modelWeight: 0,
    servingChanged: false,
  } }, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

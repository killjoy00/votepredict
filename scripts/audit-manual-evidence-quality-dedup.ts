import { writeFileSync, readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
} from '../src/evidence/evidence-quality.js';

const EXPECTED_DOCUMENTS = 226;
const EXPECTED_ORIGINAL = 101;
const EXPECTED_SUPPLEMENTAL = 125;
const MANUAL_PROVIDER = 'manual-openai';
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';

type Row = {
  annotation_id: string;
  source_document_id: string;
  source_document_text_id: string | null;
  source_kind: string;
  fetched_at: string;
  extraction_confidence: number;
  outcome_blind: boolean;
  context_only: boolean;
  mechanically_actionable: boolean;
  model_weight: number;
  metadata: Record<string, unknown> | null;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
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
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function stringMeta(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string')
    .forEach(mask);

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query<Row>(`
      SELECT eqa.id::text AS annotation_id,
             eqa.source_document_id::text,
             eqa.source_document_text_id::text,
             sd.source_kind,
             sd.fetched_at::text,
             eqa.extraction_confidence,
             eqa.outcome_blind,
             eqa.context_only,
             eqa.mechanically_actionable,
             eqa.model_weight,
             eqa.metadata
        FROM evidence_quality_annotations eqa
        JOIN source_documents sd ON sd.id=eqa.source_document_id
       WHERE eqa.schema_version=$1
         AND eqa.prompt_version=$2
         AND eqa.classifier_provider=$3
         AND eqa.content_mode='verified_full_text'
       ORDER BY eqa.source_document_id,eqa.id
    `, [EVIDENCE_QUALITY_SCHEMA_VERSION, EVIDENCE_QUALITY_PROMPT_VERSION, MANUAL_PROVIDER]);

    if (result.rows.length !== EXPECTED_DOCUMENTS) {
      throw new Error(`Expected ${EXPECTED_DOCUMENTS} manual annotations, found ${result.rows.length}`);
    }
    if (new Set(result.rows.map((row) => row.source_document_id)).size !== EXPECTED_DOCUMENTS) {
      throw new Error('Manual annotations contain duplicate source-document IDs');
    }
    if (new Set(result.rows.map((row) => row.source_document_text_id)).size !== EXPECTED_DOCUMENTS) {
      throw new Error('Manual annotations contain duplicate or null source-document-text IDs');
    }

    const groups = new Map<string, Array<Record<string, unknown>>>();
    let original = 0;
    let supplemental = 0;

    for (const row of result.rows) {
      if (!row.outcome_blind || !row.context_only || row.mechanically_actionable || Number(row.model_weight) !== 0) {
        throw new Error(`Manual annotation policy invariant failed for source ${row.source_document_id}`);
      }
      const metadata = row.metadata ?? {};
      const fingerprint = stringMeta(metadata, 'semanticFingerprint');
      if (!fingerprint || !/^[0-9a-f]{64}$/i.test(fingerprint)) {
        throw new Error(`Missing/invalid semantic fingerprint for source ${row.source_document_id}`);
      }
      const importVersion = stringMeta(metadata, 'importVersion');
      const program = importVersion === 'manual-evidence-quality-import-v1'
        ? 'original'
        : importVersion === 'manual-evidence-quality-supplemental-import-v1'
          ? 'supplemental'
          : null;
      if (!program) throw new Error(`Unknown manual import version for source ${row.source_document_id}: ${importVersion ?? 'null'}`);
      if (program === 'original') original += 1;
      else supplemental += 1;

      const members = groups.get(fingerprint) ?? [];
      members.push({
        annotationId: row.annotation_id,
        sourceDocumentId: row.source_document_id,
        sourceDocumentTextId: row.source_document_text_id,
        sourceKind: row.source_kind,
        fetchedAt: row.fetched_at,
        extractionConfidence: Number(row.extraction_confidence),
        program,
        batchId: stringMeta(metadata, 'manualBatchId'),
        manualRow: typeof metadata.manualRow === 'number' ? metadata.manualRow : null,
      });
      groups.set(fingerprint, members);
    }

    if (original !== EXPECTED_ORIGINAL || supplemental !== EXPECTED_SUPPLEMENTAL) {
      throw new Error(`Expected original/supplemental ${EXPECTED_ORIGINAL}/${EXPECTED_SUPPLEMENTAL}, found ${original}/${supplemental}`);
    }

    const duplicateGroups = [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([fingerprint, members]) => ({
        fingerprint,
        size: members.length,
        programs: [...new Set(members.map((member) => String(member.program)))].sort(),
        members: members.sort((a, b) => String(a.sourceDocumentId).localeCompare(String(b.sourceDocumentId))),
      }))
      .sort((a, b) => b.size - a.size || a.fingerprint.localeCompare(b.fingerprint));

    const crossProgramDuplicateGroups = duplicateGroups.filter((group) => group.programs.length > 1);
    const documentsInDuplicateGroups = duplicateGroups.reduce((sum, group) => sum + group.size, 0);
    const output = {
      auditVersion: 'evidence-quality-manual-dedup-v1',
      generatedAt: new Date().toISOString(),
      schemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
      promptVersion: EVIDENCE_QUALITY_PROMPT_VERSION,
      provider: MANUAL_PROVIDER,
      summary: {
        documents: result.rows.length,
        originalDocuments: original,
        supplementalDocuments: supplemental,
        uniqueSemanticSignatures: groups.size,
        singletonSignatures: [...groups.values()].filter((members) => members.length === 1).length,
        duplicateSemanticGroups: duplicateGroups.length,
        documentsInDuplicateGroups,
        crossProgramDuplicateGroups: crossProgramDuplicateGroups.length,
        maxDuplicateGroupSize: duplicateGroups.reduce((max, group) => Math.max(max, group.size), 1),
      },
      policy: {
        readOnly: true,
        outcomeBlindRequired: true,
        contextOnlyRequired: true,
        mechanicallyActionableRequired: false,
        modelWeightRequired: 0,
        legacyQuickEvidenceV2Included: false,
        modelingUse: 'deduplicate_by_semantic_fingerprint_before_feature_construction',
        representativeSelection: 'not_selected_by_this_audit; preserve chronology and choose as-of-safe evidence during matrix construction',
      },
      duplicateGroups,
    };

    const outputPath = process.env.VOTEPREDICT_EVIDENCE_QUALITY_DEDUP_OUTPUT;
    if (!outputPath) throw new Error('VOTEPREDICT_EVIDENCE_QUALITY_DEDUP_OUTPUT required');
    writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output.summary, null, 2));
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  EVIDENCE_QUALITY_SPONSORSHIP_POLICY_VERSION,
  EVIDENCE_QUALITY_TEXT_VERSION,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
  type EvidenceQualitySourceKind,
} from '../src/evidence/evidence-quality.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const MANUAL_PROVIDER = 'manual-openai';
const EXPECTED_DOCUMENTS = 226;
const EXPECTED_AFFECTED_DOCUMENTS = 24;
const EXPECTED_SPONSORSHIP_CLAIMS = 24;
const PURSELL_SOURCE_ID = '3fccb9f4-ed6f-4b7c-8a8d-79a299de3c1f';

const BATCH_PATHS = [
  'data/evaluation/evidence-quality/manual-annotations/batch-01.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-02.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-03.json',
  'data/evaluation/evidence-quality/manual-annotations/batch-04.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-01.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-02.json',
  'data/evaluation/evidence-quality/manual-annotations/p1-supplement-03.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-01.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-02.json',
  'data/evaluation/evidence-quality/manual-annotations/p2-supplement-03.json',
] as const;

type ManualDocument = {
  row: number;
  sourceDocumentId: string;
  sourceDocumentTextId: string;
  sourceKind: EvidenceQualitySourceKind;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  annotation: EvidenceQualityAnnotation;
  calculatedExtractionConfidence: number;
};

type ProductionRow = {
  id: string;
  source_document_id: string;
  source_document_text_id: string | null;
  annotation: EvidenceQualityAnnotation;
  extraction_confidence: number;
  metadata: Record<string, unknown> | null;
  source_kind: EvidenceQualitySourceKind;
  source_url: string;
  normalized_text: string | null;
  extraction_version: string | null;
};

let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1800);
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function loadDocuments(): ManualDocument[] {
  const documents = BATCH_PATHS.flatMap((path) => {
    const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as { documents: ManualDocument[] };
    return parsed.documents;
  });

  if (documents.length !== EXPECTED_DOCUMENTS) {
    throw new Error('Expected ' + EXPECTED_DOCUMENTS + ' reviewed documents, found ' + documents.length);
  }
  if (new Set(documents.map((document) => document.sourceDocumentId)).size !== EXPECTED_DOCUMENTS) {
    throw new Error('Reviewed corpus contains duplicate source document IDs');
  }

  const sponsorshipClaims = documents.flatMap((document) =>
    document.annotation.claims
      .filter((claim) => claim.claimType === 'sponsorship')
      .map((claim) => ({ document, claim })));

  if (sponsorshipClaims.length !== EXPECTED_SPONSORSHIP_CLAIMS) {
    throw new Error('Expected ' + EXPECTED_SPONSORSHIP_CLAIMS + ' sponsorship claims, found ' + sponsorshipClaims.length);
  }
  for (const { claim } of sponsorshipClaims) {
    if (
      claim.stance !== 'supports'
      || claim.linkage !== 'exact_member_bill'
      || claim.specificity !== 'exact_bill'
      || claim.memberNames.length === 0
      || claim.billIdentifiers.length === 0
    ) {
      throw new Error('Reviewed sponsorship claim does not satisfy sponsorship-support-v1');
    }
  }

  const pursell = documents.find((document) => document.sourceDocumentId === PURSELL_SOURCE_ID);
  if (!pursell) throw new Error('Pursell HF3793 review document missing');
  const pursellClaim = pursell.annotation.claims.find((claim) =>
    claim.billIdentifiers.some((identifier) => identifier.replace(/\s+/g, '').toUpperCase() === 'HF3793'));
  if (!pursellClaim || pursellClaim.claimType !== 'procedural_action' || pursellClaim.stance !== 'none') {
    throw new Error('Pursell HF3793 procedural correction missing');
  }

  const affected = documents.filter((document) =>
    document.sourceDocumentId === PURSELL_SOURCE_ID
    || document.annotation.claims.some((claim) => claim.claimType === 'sponsorship'));

  if (affected.length !== EXPECTED_AFFECTED_DOCUMENTS) {
    throw new Error('Expected ' + EXPECTED_AFFECTED_DOCUMENTS + ' affected documents, found ' + affected.length);
  }
  return affected.sort((a, b) => a.sourceDocumentId.localeCompare(b.sourceDocumentId));
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
  const sourceIds = documents.map((document) => document.sourceDocumentId);
  const { pool } = await import('../src/lib/db/index.js');

  async function fetchRows(): Promise<ProductionRow[]> {
    const result = await pool.query<ProductionRow>(`
      SELECT eqa.id::text,
             eqa.source_document_id::text,
             eqa.source_document_text_id::text,
             eqa.annotation,
             eqa.extraction_confidence::float8,
             eqa.metadata,
             sd.source_kind,
             sd.source_url,
             sdt.normalized_text,
             sdt.extraction_version
        FROM evidence_quality_annotations eqa
        JOIN source_documents sd ON sd.id=eqa.source_document_id
        LEFT JOIN source_document_texts sdt ON sdt.id=eqa.source_document_text_id
       WHERE eqa.source_document_id = ANY($1::uuid[])
         AND eqa.schema_version=$2
         AND eqa.prompt_version=$3
         AND eqa.classifier_provider=$4
         AND eqa.content_mode='verified_full_text'
       ORDER BY eqa.source_document_id`, [
      sourceIds,
      EVIDENCE_QUALITY_SCHEMA_VERSION,
      EVIDENCE_QUALITY_PROMPT_VERSION,
      MANUAL_PROVIDER,
    ]);
    return result.rows;
  }

  let rows = await fetchRows();
  if (rows.length !== EXPECTED_AFFECTED_DOCUMENTS) {
    throw new Error('Expected ' + EXPECTED_AFFECTED_DOCUMENTS + ' production annotations, found ' + rows.length);
  }

  const bySource = new Map(rows.map((row) => [row.source_document_id, row]));
  const mismatches: ManualDocument[] = [];

  for (const document of documents) {
    const row = bySource.get(document.sourceDocumentId);
    if (!row) throw new Error('Missing production annotation for ' + document.sourceDocumentId);
    if (row.source_document_text_id !== document.sourceDocumentTextId) {
      throw new Error('Source text ID drift for ' + document.sourceDocumentId);
    }
    if (!row.normalized_text || row.extraction_version !== EVIDENCE_QUALITY_TEXT_VERSION) {
      throw new Error('Verified source text missing or wrong version for ' + document.sourceDocumentId);
    }
    if (row.source_kind !== document.sourceKind) {
      throw new Error('Source kind drift for ' + document.sourceDocumentId);
    }

    validateEvidenceQualityAnnotation(document.annotation, {
      sourceKind: document.sourceKind,
      sourceUrl: row.source_url,
      contentMode: 'verified_full_text',
      text: row.normalized_text,
      candidateMemberNames: document.candidateMemberNames,
      candidateBillIdentifiers: document.candidateBillIdentifiers,
    });

    if (Math.abs(row.extraction_confidence - document.calculatedExtractionConfidence) > 1e-12) {
      throw new Error('Extraction confidence drift for ' + document.sourceDocumentId);
    }
    if (canonicalJson(row.annotation) !== canonicalJson(document.annotation)) {
      mismatches.push(document);
    }
  }

  if (mismatches.length !== 0 && mismatches.length !== EXPECTED_AFFECTED_DOCUMENTS) {
    throw new Error('Expected either 0 or ' + EXPECTED_AFFECTED_DOCUMENTS + ' annotation mismatches, found ' + mismatches.length);
  }

  if (!apply || mismatches.length === 0) {
    console.log(JSON.stringify({
      evidenceQualitySponsorshipSupportSync: {
        policyVersion: EVIDENCE_QUALITY_SPONSORSHIP_POLICY_VERSION,
        affectedDocuments: EXPECTED_AFFECTED_DOCUMENTS,
        sponsorshipClaims: EXPECTED_SPONSORSHIP_CLAIMS,
        annotationMismatches: mismatches.length,
        mismatchSourceIds: mismatches.map((document) => document.sourceDocumentId),
        alreadyApplied: mismatches.length === 0,
        applied: false,
        safeToApply: mismatches.length === EXPECTED_AFFECTED_DOCUMENTS,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        servingChanged: false,
      },
    }, null, 2));
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const document of mismatches) {
      const row = bySource.get(document.sourceDocumentId)!;
      const sponsorshipClaims = document.annotation.claims.filter((claim) => claim.claimType === 'sponsorship').length;
      const metadata = {
        ...(row.metadata ?? {}),
        sponsorshipPolicyVersion: EVIDENCE_QUALITY_SPONSORSHIP_POLICY_VERSION,
        sponsorshipSupportPolicyApplied: true,
        sponsorshipSupportClaims: sponsorshipClaims,
        sponsorshipMisclassificationRepaired: document.sourceDocumentId === PURSELL_SOURCE_ID,
        noVoteOutcomeUse: true,
      };
      await client.query(`
        UPDATE evidence_quality_annotations
           SET annotation=$1::jsonb,
               metadata=$2::jsonb
         WHERE id=$3::uuid`, [
        JSON.stringify(document.annotation),
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

  rows = await fetchRows();
  const verified = new Map(rows.map((row) => [row.source_document_id, row]));
  for (const document of documents) {
    const row = verified.get(document.sourceDocumentId);
    if (!row || canonicalJson(row.annotation) !== canonicalJson(document.annotation)) {
      throw new Error('Post-apply verification failed for ' + document.sourceDocumentId);
    }
  }

  console.log(JSON.stringify({
    evidenceQualitySponsorshipSupportSync: {
      policyVersion: EVIDENCE_QUALITY_SPONSORSHIP_POLICY_VERSION,
      affectedDocuments: EXPECTED_AFFECTED_DOCUMENTS,
      sponsorshipClaims: EXPECTED_SPONSORSHIP_CLAIMS,
      annotationMismatches: EXPECTED_AFFECTED_DOCUMENTS,
      alreadyApplied: false,
      applied: true,
      updatedAnnotationRows: EXPECTED_AFFECTED_DOCUMENTS,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      servingChanged: false,
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

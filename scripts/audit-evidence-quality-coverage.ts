import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1000);
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
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_SOURCE_KINDS,
    EVIDENCE_QUALITY_TEXT_VERSION,
  } = await import('../src/evidence/evidence-quality.js');

  const coverage = await pool.query<{
    source_kind: string;
    source_documents: number;
    evidence_items: number;
    with_text_snapshot: number;
    with_annotation: number;
    verified_full_text_annotations: number;
    excerpt_only_annotations: number;
    total_snapshot_chars: string;
    average_snapshot_chars: number | null;
  }>(`
    SELECT sd.source_kind,
           count(DISTINCT sd.id)::int AS source_documents,
           count(DISTINCT ei.id)::int AS evidence_items,
           count(DISTINCT sd.id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM source_document_texts sdt
                WHERE sdt.source_document_id=sd.id
                  AND sdt.extraction_version=$2
             )
           )::int AS with_text_snapshot,
           count(DISTINCT sd.id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM evidence_quality_annotations eqa
                WHERE eqa.source_document_id=sd.id
                  AND eqa.schema_version=$3
             )
           )::int AS with_annotation,
           count(DISTINCT sd.id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM evidence_quality_annotations eqa
                WHERE eqa.source_document_id=sd.id
                  AND eqa.schema_version=$3
                  AND eqa.content_mode='verified_full_text'
             )
           )::int AS verified_full_text_annotations,
           count(DISTINCT sd.id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM evidence_quality_annotations eqa
                WHERE eqa.source_document_id=sd.id
                  AND eqa.schema_version=$3
                  AND eqa.content_mode='excerpt_only'
             )
           )::int AS excerpt_only_annotations,
           coalesce((
             SELECT sum(length(sdt.normalized_text))::text
               FROM source_document_texts sdt
               JOIN source_documents sd2 ON sd2.id=sdt.source_document_id
              WHERE sd2.source_kind=sd.source_kind
                AND sdt.extraction_version=$2
           ),'0') AS total_snapshot_chars,
           (
             SELECT avg(length(sdt.normalized_text))::float8
               FROM source_document_texts sdt
               JOIN source_documents sd2 ON sd2.id=sdt.source_document_id
              WHERE sd2.source_kind=sd.source_kind
                AND sdt.extraction_version=$2
           ) AS average_snapshot_chars
      FROM source_documents sd
      JOIN evidence_items ei ON ei.source_document_id=sd.id
     WHERE sd.source_kind = ANY($1::text[])
     GROUP BY sd.source_kind
     ORDER BY sd.source_kind`, [
    [...EVIDENCE_QUALITY_SOURCE_KINDS],
    EVIDENCE_QUALITY_TEXT_VERSION,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
  ]);

  const latestRuns = await pool.query<{
    id: string;
    source_system: string;
    scope: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    source_documents: number | null;
    error_summary: string | null;
  }>(`
    SELECT id::text,source_system,scope,status,started_at::text,finished_at::text,
           source_documents,error_summary
      FROM ingestion_runs
     WHERE source_system IN ('evidence-quality-v1','evidence-quality-source-snapshot-v1')
     ORDER BY started_at DESC
     LIMIT 20`);

  const totals = coverage.rows.reduce((acc, row) => {
    acc.sourceDocuments += row.source_documents;
    acc.evidenceItems += row.evidence_items;
    acc.withTextSnapshot += row.with_text_snapshot;
    acc.withAnnotation += row.with_annotation;
    acc.verifiedFullTextAnnotations += row.verified_full_text_annotations;
    acc.excerptOnlyAnnotations += row.excerpt_only_annotations;
    return acc;
  }, {
    sourceDocuments: 0,
    evidenceItems: 0,
    withTextSnapshot: 0,
    withAnnotation: 0,
    verifiedFullTextAnnotations: 0,
    excerptOnlyAnnotations: 0,
  });

  console.log(JSON.stringify({
    evidenceQualityCoverage: {
      schemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
      textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
      totals,
      bySourceKind: coverage.rows,
      latestRuns: latestRuns.rows,
      policy: {
        readOnly: true,
        servingChanged: false,
        modelWeight: 0,
      },
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

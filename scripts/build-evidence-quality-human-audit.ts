import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const AUDIT_VERSION = 'evidence-quality-human-audit-v1';
const DEFAULT_SAMPLE_LIMIT = 120;
const MAX_SAMPLE_LIMIT = 200;
const MAX_SOURCE_TEXT_CHARS = 20_000;
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

type AuditRow = {
  annotation_id: string;
  source_document_id: string;
  source_kind: string;
  source_url: string;
  session_slug: string | null;
  content_mode: string;
  extraction_confidence: number;
  annotation: Record<string, unknown>;
  normalized_text: string | null;
  evidence_context: unknown[];
  annotation_created_at: string;
};

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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function directional(annotation: Record<string, unknown>): boolean {
  const claims = Array.isArray(annotation.claims) ? annotation.claims : [];
  return claims.some((raw) => {
    const claim = objectValue(raw);
    return ['supports', 'opposes', 'mixed'].includes(String(claim.stance ?? ''));
  });
}

function stratum(row: AuditRow): string {
  const document = objectValue(row.annotation.document);
  return [
    row.source_kind,
    row.content_mode,
    stringValue(document.legislativeRelevance, 'unknown'),
    stringValue(document.centrality, 'unknown'),
    directional(row.annotation) ? 'directional' : 'non_directional',
  ].join('|');
}

function deterministicKey(id: string): string {
  return createHash('sha256').update(AUDIT_VERSION + ':' + id).digest('hex');
}

function stratifiedSample(rows: AuditRow[], limit: number): AuditRow[] {
  const groups = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const key = stratum(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => deterministicKey(a.annotation_id).localeCompare(deterministicKey(b.annotation_id)));
  }

  const keys = [...groups.keys()].sort();
  const selected: AuditRow[] = [];
  let depth = 0;
  while (selected.length < limit) {
    let added = false;
    for (const key of keys) {
      const row = groups.get(key)?.[depth];
      if (!row) continue;
      selected.push(row);
      added = true;
      if (selected.length >= limit) break;
    }
    if (!added) break;
    depth += 1;
  }
  return selected;
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
  const { EVIDENCE_QUALITY_SCHEMA_VERSION } = await import('../src/evidence/evidence-quality.js');

  const requestedLimit = Number.parseInt(process.env.VOTEPREDICT_EVIDENCE_QUALITY_HUMAN_AUDIT_LIMIT ?? '', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_SAMPLE_LIMIT, Math.max(1, requestedLimit))
    : DEFAULT_SAMPLE_LIMIT;

  const result = await pool.query<AuditRow>(`
    SELECT eqa.id::text AS annotation_id,
           sd.id::text AS source_document_id,
           sd.source_kind,
           sd.source_url,
           ls.slug AS session_slug,
           eqa.content_mode,
           eqa.extraction_confidence,
           eqa.annotation,
           sdt.normalized_text,
           eqa.created_at::text AS annotation_created_at,
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'evidenceKind',ei.evidence_kind,
                 'stance',ei.stance,
                 'claim',ei.claim,
                 'excerpt',ei.excerpt,
                 'publishedAt',ei.published_at,
                 'sourceQuality',ei.source_quality,
                 'relevance',ei.relevance,
                 'memberName',l.name,
                 'billIdentifier',b.identifier
               )
               ORDER BY ei.created_at,ei.id
             ) FILTER (WHERE ei.id IS NOT NULL),
             '[]'::jsonb
           ) AS evidence_context
      FROM evidence_quality_annotations eqa
      JOIN source_documents sd ON sd.id=eqa.source_document_id
      LEFT JOIN legislative_sessions ls ON ls.id=sd.session_id
      LEFT JOIN source_document_texts sdt ON sdt.id=eqa.source_document_text_id
      LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id
      LEFT JOIN memberships m ON m.id=ei.membership_id
      LEFT JOIN legislators l ON l.id=m.legislator_id
      LEFT JOIN bills b ON b.id=ei.bill_id
     WHERE eqa.schema_version=$1
     GROUP BY eqa.id,sd.id,ls.slug,sdt.id
     ORDER BY eqa.created_at,eqa.id`, [EVIDENCE_QUALITY_SCHEMA_VERSION]);

  const sampled = stratifiedSample(result.rows, limit);
  const stratumCounts = new Map<string, number>();
  for (const row of result.rows) {
    const key = stratum(row);
    stratumCounts.set(key, (stratumCounts.get(key) ?? 0) + 1);
  }

  const artifact = {
    auditVersion: AUDIT_VERSION,
    schemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    eligibleAnnotations: result.rows.length,
    requestedSampleLimit: limit,
    sampledAnnotations: sampled.length,
    strata: Object.fromEntries([...stratumCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    instructions: {
      purpose: 'Human validation of Evidence Quality v1 extraction before any predictive modeling use.',
      reviewAgainst: 'Only the supplied durable source text/evidence context and the structured annotation.',
      doNotAssess: 'Do not judge whether a claim predicts a vote; review extraction fidelity only.',
      requiredChecks: [
        'member/bill linkage',
        'claim type',
        'attribution',
        'directional stance only when explicit',
        'specificity',
        'centrality/relevance',
        'supporting excerpt grounding',
      ],
    },
    items: sampled.map((row) => {
      const sourceText = row.normalized_text ?? '';
      return {
        annotationId: row.annotation_id,
        sourceDocumentId: row.source_document_id,
        sourceKind: row.source_kind,
        sourceUrl: row.source_url,
        sessionSlug: row.session_slug,
        contentMode: row.content_mode,
        extractionConfidence: row.extraction_confidence,
        stratum: stratum(row),
        annotationCreatedAt: row.annotation_created_at,
        annotation: row.annotation,
        evidenceContext: row.evidence_context,
        sourceText: sourceText.slice(0, MAX_SOURCE_TEXT_CHARS),
        sourceTextTruncated: sourceText.length > MAX_SOURCE_TEXT_CHARS,
        review: {
          linkageCorrect: null,
          claimTypeCorrect: null,
          attributionCorrect: null,
          stanceCorrect: null,
          specificityCorrect: null,
          centralityCorrect: null,
          excerptsGrounded: null,
          overallAccept: null,
          notes: '',
        },
      };
    }),
  };

  const output = process.env.VOTEPREDICT_EVIDENCE_QUALITY_AUDIT_OUTPUT
    ?? 'evidence-quality-human-audit-v1.json';
  writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    evidenceQualityHumanAudit: {
      auditVersion: AUDIT_VERSION,
      eligibleAnnotations: artifact.eligibleAnnotations,
      sampledAnnotations: artifact.sampledAnnotations,
      stratumCount: Object.keys(artifact.strata).length,
      output,
      readOnly: true,
      outcomeUse: 'none',
      servingChanged: false,
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

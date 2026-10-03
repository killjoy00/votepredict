import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_CLASSIFIER_TEXT_CHARS = 60_000;
let secrets: string[] = [];

type EvidenceRow = {
  excerpt?: string | null;
  publishedAt?: string | null;
  memberName?: string | null;
  billIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

type SourceRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  fetched_at: string;
  source_metadata: Record<string, unknown> | null;
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
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1200);
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
  let excerpt = '';
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
    if ((row.excerpt?.length ?? 0) > excerpt.length) excerpt = row.excerpt ?? '';
    if (row.publishedAt && (!publishedAt || row.publishedAt < publishedAt)) publishedAt = row.publishedAt;
  }

  return {
    memberNames: [...members].sort().slice(0, 24),
    billIdentifiers: [...bills].sort().slice(0, 24),
    excerpt: excerpt.trim(),
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

function classifierText(text: string): { text: string; truncated: boolean } {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_CLASSIFIER_TEXT_CHARS) return { text: normalized, truncated: false };
  return { text: normalized.slice(0, MAX_CLASSIFIER_TEXT_CHARS), truncated: true };
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

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { fetchPublicPage } = await import('../src/evidence/public-http.js');
  const {
    EVIDENCE_QUALITY_PROMPT_VERSION,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_SOURCE_KINDS,
    EVIDENCE_QUALITY_TEXT_VERSION,
    evidenceQualityExtractionConfidence,
    isEvidenceQualitySourceKind,
    sourceContentIdentityMatches,
  } = await import('../src/evidence/evidence-quality.js');
  const {
    EVIDENCE_QUALITY_CLASSIFIER_PROVIDER,
    EvidenceQualityClassifier,
  } = await import('../src/evidence/evidence-quality-classifier.js');
  const {
    persistEvidenceQualityAnnotation,
    persistVerifiedSourceText,
  } = await import('../src/evidence/evidence-quality-store.js');

  const requestedLimit = Number.parseInt(process.env.VOTEPREDICT_EVIDENCE_QUALITY_LIMIT ?? '', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, requestedLimit))
    : DEFAULT_LIMIT;
  const requestedMaxPriority = Number.parseInt(
    process.env.VOTEPREDICT_EVIDENCE_QUALITY_MAX_PRIORITY ?? '',
    10,
  );
  const maxPriority = Number.isFinite(requestedMaxPriority)
    ? Math.min(5, Math.max(1, requestedMaxPriority))
    : 2;
  const classifier = new EvidenceQualityClassifier();
  const requestedKinds = (process.env.VOTEPREDICT_EVIDENCE_QUALITY_SOURCE_KINDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const semanticFirstPassKinds = EVIDENCE_QUALITY_SOURCE_KINDS
    .filter((sourceKind) => sourceKind !== 'house_session_daily');
  const sourceKinds = requestedKinds.length > 0
    ? requestedKinds.filter(isEvidenceQualitySourceKind)
    : semanticFirstPassKinds;
  if (sourceKinds.length === 0) throw new Error('No valid Evidence Quality v1 source kinds requested');

  const runRow = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs(source_system,scope,status,metadata)
    VALUES('evidence-quality-v1',$1,'running',$2::jsonb)
    RETURNING id::text`, [
    'sources:' + sourceKinds.join(',') + ':priority<=' + maxPriority + ':limit:' + limit,
    JSON.stringify({
      schemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
      promptVersion: EVIDENCE_QUALITY_PROMPT_VERSION,
      provider: EVIDENCE_QUALITY_CLASSIFIER_PROVIDER,
      model: classifier.model,
      sourceKinds,
      maxPriority,
      limit,
      outcomeUse: 'none',
      servingChanged: false,
    }),
  ]);
  const runId = runRow.rows[0].id;

  const sourceResult = await pool.query<SourceRow>(`
    WITH document_features AS (
      SELECT sd.id,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256,
             sd.fetched_at,
             sd.metadata AS source_metadata,
             jsonb_agg(
               jsonb_build_object(
                 'excerpt',ei.excerpt,
                 'publishedAt',ei.published_at,
                 'memberName',l.name,
                 'billIdentifier',b.identifier,
                 'metadata',ei.metadata
               )
               ORDER BY ei.created_at,ei.id
             ) AS evidence_rows,
             bool_or(
               ei.membership_id IS NOT NULL
               OR CASE
                    WHEN jsonb_typeof(ei.metadata->'mentionedMembers')='array'
                    THEN jsonb_array_length(ei.metadata->'mentionedMembers') > 0
                    ELSE false
                  END
               OR nullif(trim(coalesce(ei.metadata->>'memberName','')),'') IS NOT NULL
             ) AS has_member,
             bool_or(
               ei.bill_id IS NOT NULL
               OR CASE
                    WHEN jsonb_typeof(ei.metadata->'billIdentifiers')='array'
                    THEN jsonb_array_length(ei.metadata->'billIdentifiers') > 0
                    ELSE false
                  END
               OR nullif(trim(coalesce(ei.metadata->>'exactBillIdentifier','')),'') IS NOT NULL
             ) AS has_bill,
             bool_or(
               ei.relevance IN ('direct','high')
               OR ei.evidence_kind IN ('direct_statement','related_statement')
             ) AS direct_or_high
        FROM source_documents sd
        JOIN evidence_items ei ON ei.source_document_id=sd.id
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN legislators l ON l.id=m.legislator_id
        LEFT JOIN bills b ON b.id=ei.bill_id
       WHERE sd.source_kind = ANY($1::text[])
         AND NOT EXISTS (
           SELECT 1
             FROM evidence_quality_annotations eqa
            WHERE eqa.source_document_id=sd.id
              AND eqa.schema_version=$2
              AND eqa.prompt_version=$3
              AND eqa.classifier_provider=$4
              AND eqa.classifier_model=$5
         )
       GROUP BY sd.id
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
    SELECT id::text AS source_document_id,
           source_kind,
           source_url,
           content_sha256,
           fetched_at::text,
           source_metadata,
           evidence_rows
      FROM prioritized
     WHERE priority_rank <= $6
     ORDER BY priority_rank,fetched_at,id
     LIMIT $7`, [
    sourceKinds,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_PROMPT_VERSION,
    EVIDENCE_QUALITY_CLASSIFIER_PROVIDER,
    classifier.model,
    maxPriority,
    limit,
  ]);

  const result = {
    schemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
    promptVersion: EVIDENCE_QUALITY_PROMPT_VERSION,
    textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    provider: EVIDENCE_QUALITY_CLASSIFIER_PROVIDER,
    model: classifier.model,
    selected: sourceResult.rows.length,
    annotated: 0,
    annotationsInserted: 0,
    annotationsReused: 0,
    verifiedFullText: 0,
    excerptOnly: 0,
    sourceTextsInserted: 0,
    sourceTextsReused: 0,
    failures: 0,
    bySourceKind: {} as Record<string, { selected: number; annotated: number; failures: number }>,
    failureSamples: [] as string[],
    policy: {
      outcomeUse: 'none',
      servingChanged: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      fullTextRequiresStoredContentHashMatch: true,
      mutableCurrentPageSubstitution: false,
    },
  };

  for (const source of sourceResult.rows) {
    const byKind = result.bySourceKind[source.source_kind] ?? { selected: 0, annotated: 0, failures: 0 };
    byKind.selected += 1;
    result.bySourceKind[source.source_kind] = byKind;

    try {
      if (!isEvidenceQualitySourceKind(source.source_kind)) {
        throw new Error('Unexpected source kind selected for Evidence Quality v1');
      }

      const candidates = candidateContext(source.evidence_rows ?? []);
      let contentMode: 'verified_full_text' | 'excerpt_only' = 'excerpt_only';
      let sourceDocumentTextId: string | undefined;
      let text = candidates.excerpt;
      let textTruncated = false;

      const existingText = await pool.query<{ id: string; normalized_text: string }>(`
        SELECT id::text,normalized_text
          FROM source_document_texts
         WHERE source_document_id=$1::uuid
           AND extraction_version=$2
         LIMIT 1`, [source.source_document_id, EVIDENCE_QUALITY_TEXT_VERSION]);

      if (existingText.rows[0]) {
        contentMode = 'verified_full_text';
        sourceDocumentTextId = existingText.rows[0].id;
        const bounded = classifierText(existingText.rows[0].normalized_text);
        text = bounded.text;
        textTruncated = bounded.truncated;
        result.sourceTextsReused += 1;
      } else {
        try {
          const page = await fetchPublicPage(source.source_url, {
            timeoutMs: 20_000,
            maxBytes: 2_500_000,
            userAgent: 'VotePredict/2.0 evidence-quality-v1',
          });
          if (sourceContentIdentityMatches(source.content_sha256, page.contentSha256)) {
            const persistedText = await persistVerifiedSourceText(pool, {
              sourceDocumentId: source.source_document_id,
              sourceContentSha256: source.content_sha256,
              normalizedText: page.text,
              extractionMethod: 'verified-refetch-content-hash-match',
              metadata: {
                sourceKind: source.source_kind,
                fetchedForEvidenceQualityAt: page.fetchedAt,
                originalFetchedAt: source.fetched_at,
              },
            });
            sourceDocumentTextId = persistedText.id;
            if (persistedText.inserted) result.sourceTextsInserted += 1;
            else result.sourceTextsReused += 1;
            contentMode = 'verified_full_text';
            const bounded = classifierText(page.text);
            text = bounded.text;
            textTruncated = bounded.truncated;
          }
        } catch {
          // Historical/live URLs can disappear. Excerpt-only annotation is the fail-closed fallback.
        }
      }

      if (text.trim().length < 40) {
        throw new Error('No verified source text or sufficiently long stored excerpt is available');
      }
      if (contentMode === 'verified_full_text') result.verifiedFullText += 1;
      else result.excerptOnly += 1;

      const classification = await classifier.classify({
        sourceKind: source.source_kind,
        sourceUrl: source.source_url,
        contentMode,
        text,
        title: typeof source.source_metadata?.title === 'string' ? source.source_metadata.title : undefined,
        publishedAt: candidates.publishedAt,
        availableAt: historicalAvailableAt(source.source_metadata, source.fetched_at),
        candidateMemberNames: candidates.memberNames,
        candidateBillIdentifiers: candidates.billIdentifiers,
      });

      const persisted = await persistEvidenceQualityAnnotation(pool, {
        sourceDocumentId: source.source_document_id,
        sourceDocumentTextId,
        promptVersion: EVIDENCE_QUALITY_PROMPT_VERSION,
        classifierProvider: classification.provider,
        classifierModel: classification.model,
        contentMode,
        annotation: classification.annotation,
        extractionConfidence: evidenceQualityExtractionConfidence(classification.annotation),
        metadata: {
          sourceKind: source.source_kind,
          textTruncated,
          classifierInputChars: text.length,
          candidateMemberCount: candidates.memberNames.length,
          candidateBillCount: candidates.billIdentifiers.length,
          usage: classification.usage,
          noVoteOutcomeQuery: true,
        },
      });

      result.annotated += 1;
      byKind.annotated += 1;
      if (persisted.inserted) result.annotationsInserted += 1;
      else result.annotationsReused += 1;
    } catch (error) {
      result.failures += 1;
      byKind.failures += 1;
      if (result.failureSamples.length < 12) {
        result.failureSamples.push(source.source_kind + ':' + source.source_document_id + ': ' + safe(error));
      }
    }
  }

  const finalStatus = result.failures > 0 && result.annotated === 0 ? 'failed' : 'complete';
  await pool.query(`
    UPDATE ingestion_runs
       SET status=$2,
           finished_at=now(),
           source_documents=$3,
           error_summary=$4,
           metadata=metadata || $5::jsonb
     WHERE id=$1::uuid`, [
    runId,
    finalStatus,
    result.annotated,
    finalStatus === 'failed' ? 'Evidence Quality v1 batch produced no annotations' : null,
    JSON.stringify(result),
  ]);

  console.log(JSON.stringify({ evidenceQualityBackfill: result }, null, 2));
  await pool.end();
  if (finalStatus === 'failed') process.exitCode = 1;
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

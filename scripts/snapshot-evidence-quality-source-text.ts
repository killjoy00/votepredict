import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
let secrets: string[] = [];

type SourceRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  fetched_at: string;
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
    .slice(0, 1000);
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
  const { fetchPublicPage } = await import('../src/evidence/public-http.js');
  const {
    EVIDENCE_QUALITY_SOURCE_KINDS,
    EVIDENCE_QUALITY_TEXT_VERSION,
    isEvidenceQualitySourceKind,
    sourceContentIdentityMatches,
  } = await import('../src/evidence/evidence-quality.js');
  const { persistVerifiedSourceText } = await import('../src/evidence/evidence-quality-store.js');

  const requestedLimit = Number.parseInt(process.env.VOTEPREDICT_EVIDENCE_QUALITY_SNAPSHOT_LIMIT ?? '', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, requestedLimit))
    : DEFAULT_LIMIT;

  const requestedKinds = (process.env.VOTEPREDICT_EVIDENCE_QUALITY_SOURCE_KINDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const sourceKinds = requestedKinds.length > 0
    ? requestedKinds.filter(isEvidenceQualitySourceKind)
    : [...EVIDENCE_QUALITY_SOURCE_KINDS];
  if (sourceKinds.length === 0) throw new Error('No valid Evidence Quality v1 source kinds requested');

  const runRow = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs(source_system,scope,status,metadata)
    VALUES('evidence-quality-source-snapshot-v1',$1,'running',$2::jsonb)
    RETURNING id::text`, [
    'sources:' + sourceKinds.join(',') + ':limit:' + limit,
    JSON.stringify({
      textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
      sourceKinds,
      limit,
      classifierCalls: 0,
      servingChanged: false,
    }),
  ]);
  const runId = runRow.rows[0].id;

  const selected = await pool.query<SourceRow>(`
    SELECT sd.id::text AS source_document_id,
           sd.source_kind,
           sd.source_url,
           sd.content_sha256,
           sd.fetched_at::text
      FROM source_documents sd
     WHERE sd.source_kind = ANY($1::text[])
       AND EXISTS (
         SELECT 1
           FROM evidence_items ei
          WHERE ei.source_document_id=sd.id
       )
       AND NOT EXISTS (
         SELECT 1
           FROM source_document_texts sdt
          WHERE sdt.source_document_id=sd.id
            AND sdt.extraction_version=$2
       )
     ORDER BY sd.fetched_at,sd.id
     LIMIT $3`, [sourceKinds, EVIDENCE_QUALITY_TEXT_VERSION, limit]);

  const result = {
    textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
    selected: selected.rows.length,
    inserted: 0,
    reused: 0,
    fetchFailures: 0,
    hashMismatches: 0,
    shortText: 0,
    bySourceKind: {} as Record<string, {
      selected: number;
      inserted: number;
      reused: number;
      fetchFailures: number;
      hashMismatches: number;
      shortText: number;
    }>,
    failureSamples: [] as string[],
    policy: {
      classifierCalls: 0,
      exactContentHashRequired: true,
      mutableCurrentPageSubstitution: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      servingChanged: false,
    },
  };

  for (const source of selected.rows) {
    const kind = result.bySourceKind[source.source_kind] ?? {
      selected: 0,
      inserted: 0,
      reused: 0,
      fetchFailures: 0,
      hashMismatches: 0,
      shortText: 0,
    };
    kind.selected += 1;
    result.bySourceKind[source.source_kind] = kind;

    try {
      const page = await fetchPublicPage(source.source_url, {
        timeoutMs: 20_000,
        maxBytes: 2_500_000,
        userAgent: 'VotePredict/2.0 evidence-quality-source-snapshot-v1',
      });

      if (!sourceContentIdentityMatches(source.content_sha256, page.contentSha256)) {
        result.hashMismatches += 1;
        kind.hashMismatches += 1;
        continue;
      }

      if (page.text.replace(/\s+/g, ' ').trim().length < 40) {
        result.shortText += 1;
        kind.shortText += 1;
        continue;
      }

      const persisted = await persistVerifiedSourceText(pool, {
        sourceDocumentId: source.source_document_id,
        sourceContentSha256: source.content_sha256,
        normalizedText: page.text,
        extractionMethod: 'verified-refetch-content-hash-match',
        metadata: {
          sourceKind: source.source_kind,
          fetchedForEvidenceQualityAt: page.fetchedAt,
          originalFetchedAt: source.fetched_at,
          classifierCalls: 0,
        },
      });
      if (persisted.inserted) {
        result.inserted += 1;
        kind.inserted += 1;
      } else {
        result.reused += 1;
        kind.reused += 1;
      }
    } catch (error) {
      result.fetchFailures += 1;
      kind.fetchFailures += 1;
      if (result.failureSamples.length < 12) {
        result.failureSamples.push(source.source_kind + ':' + source.source_document_id + ': ' + safe(error));
      }
    }
  }

  await pool.query(`
    UPDATE ingestion_runs
       SET status='complete',
           finished_at=now(),
           source_documents=$2,
           metadata=metadata || $3::jsonb
     WHERE id=$1::uuid`, [
    runId,
    result.inserted + result.reused,
    JSON.stringify(result),
  ]);

  console.log(JSON.stringify({ evidenceQualitySourceSnapshot: result }, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

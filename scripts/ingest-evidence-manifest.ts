import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import type {
  DurableEvidenceDraft,
  DurableEvidenceFreshness,
  DurableEvidenceKind,
  DurableEvidenceRelevance,
  DurableEvidenceSourceQuality,
  DurableEvidenceStance,
} from '../src/evidence/durable-ingestion.js';

type ManifestSource = {
  sourceKind: string;
  sourceUrl: string;
  sessionSlug?: string;
  chamberSlug?: string;
  publisher?: string;
};
type ManifestTarget = {
  memberName?: string;
  memberNames?: string[];
  legislatorExternalKey?: string;
  billIdentifier?: string;
  sessionSlug?: string;
  chamberSlug?: string;
  occurredOn?: string;
};
type ManifestRecord = {
  source: ManifestSource;
  target?: ManifestTarget;
  kind: DurableEvidenceKind;
  stance?: DurableEvidenceStance;
  claim: string;
  excerpt?: string;
  publishedAt?: string;
  sourceQuality: DurableEvidenceSourceQuality;
  relevance: DurableEvidenceRelevance;
  freshness?: DurableEvidenceFreshness;
  confidence?: number;
  metadata?: Record<string, unknown>;
};
type EvidenceManifest = {
  sourceSystem: string;
  version: string;
  jurisdictionSlug?: string;
  records: ManifestRecord[];
};

type FetchedSource = { url: string; contentSha256: string; fetchedAt: string; httpStatus: number; bytes: number; contentType?: string };

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function configureProductionEnvironment(): void {
  const path = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!path) return;
  const parsed = parseRuntimeEnvironment(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) if (value !== undefined) process.env[key] = value;
}

function safeErrorText(error: unknown): string {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 4 || !/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key)) continue;
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function computedFreshness(publishedAt: string | undefined): DurableEvidenceFreshness {
  if (!publishedAt) return 'unknown';
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageDays <= 365) return 'current';
  if (ageDays <= 1095) return 'recent';
  return 'stale';
}

function sourceGroupKey(source: ManifestSource): string {
  return [source.sourceKind, source.sourceUrl, source.sessionSlug ?? '', source.chamberSlug ?? ''].join('|');
}

async function fetchSource(url: string): Promise<FetchedSource> {
  if (!/^https:\/\//i.test(url)) throw new Error(`Curated evidence source must use HTTPS: ${url}`);
  const response = await fetch(url, {
    headers: { 'user-agent': 'VotePredict/2.0 durable-evidence-ingestion' },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Evidence source returned ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`Evidence source was empty: ${url}`);
  return {
    url,
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    fetchedAt: new Date().toISOString(),
    httpStatus: response.status,
    bytes: bytes.length,
    contentType: response.headers.get('content-type') ?? undefined,
  };
}

function validateManifest(manifest: EvidenceManifest): void {
  if (!manifest.sourceSystem || !manifest.version || !Array.isArray(manifest.records) || manifest.records.length === 0) throw new Error('Invalid evidence manifest');
  for (const record of manifest.records) {
    if (!record.source?.sourceKind || !record.source?.sourceUrl || !record.claim || !record.kind || !record.sourceQuality || !record.relevance) throw new Error('Evidence manifest record is incomplete');
    if (record.target?.memberName && record.target.memberNames?.length) throw new Error('Use memberName or memberNames, not both');
    if (record.target?.legislatorExternalKey && (record.target.memberName || record.target.memberNames?.length)) throw new Error('Use legislatorExternalKey or member-name targeting, not both');
    if (record.confidence !== undefined && (record.confidence < 0 || record.confidence > 1)) throw new Error('Evidence confidence must be between 0 and 1');
  }
}

function draftsForRecord(record: ManifestRecord, manifest: EvidenceManifest): DurableEvidenceDraft[] {
  const memberNames = record.target?.memberNames?.length ? record.target.memberNames : [record.target?.memberName].filter((value): value is string => Boolean(value));
  const membershipTargets: Array<{ memberName?: string; legislatorExternalKey?: string }> = memberNames.length > 0
    ? memberNames.map((memberName) => ({ memberName }))
    : record.target?.legislatorExternalKey
      ? [{ legislatorExternalKey: record.target.legislatorExternalKey }]
      : [{}];
  return membershipTargets.map((membershipTarget) => ({
    target: record.target ? {
      ...membershipTarget,
      billIdentifier: record.target.billIdentifier,
      sessionSlug: record.target.sessionSlug ?? record.source.sessionSlug,
      chamberSlug: record.target.chamberSlug,
      occurredOn: record.target.occurredOn ?? record.publishedAt,
    } : undefined,
    kind: record.kind,
    stance: record.stance,
    claim: record.claim,
    excerpt: record.excerpt,
    publishedAt: record.publishedAt,
    sourceQuality: record.sourceQuality,
    relevance: record.relevance,
    freshness: record.freshness ?? computedFreshness(record.publishedAt),
    extractionMethod: 'curated-source-manifest',
    extractionVersion: manifest.version,
    confidence: record.confidence,
    metadata: {
      ...(record.metadata ?? {}),
      manifestVersion: manifest.version,
      publisher: record.source.publisher,
      mechanicallyActionable: record.metadata?.mechanicallyActionable === true,
    },
  }));
}

async function main(): Promise<void> {
  configureProductionEnvironment();
  const manifestPath = resolve(argumentValue('--manifest') ?? 'data/evidence/gambling-curated-v1.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as EvidenceManifest;
  validateManifest(manifest);

  const groups = new Map<string, { source: ManifestSource; records: ManifestRecord[] }>();
  for (const record of manifest.records) {
    const key = sourceGroupKey(record.source);
    const group = groups.get(key) ?? { source: record.source, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }

  const uniqueSourceUrls = [...new Set([...groups.values()].map(({ source }) => source.sourceUrl))];
  const fetchedPairs = await Promise.all(uniqueSourceUrls.map(async (url) => [url, await fetchSource(url)] as const));
  const fetched = new Map<string, FetchedSource>(fetchedPairs);

  const [{ pool }, { persistDurableEvidence }] = await Promise.all([
    import('../src/lib/db/index.js'),
    import('../src/evidence/durable-ingestion.js'),
  ]);
  const run = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ($1, $2, 'running', $3::jsonb)
    RETURNING id::text`, [
    manifest.sourceSystem,
    `manifest:${manifest.version}`,
    JSON.stringify({ manifestVersion: manifest.version, manifestPath, records: manifest.records.length, uniqueSources: fetched.size }),
  ]);
  const runId = run.rows[0].id;

  try {
    let inserted = 0;
    let reused = 0;
    const unresolved: Array<{ claim: string; reason: string }> = [];
    for (const { source, records } of groups.values()) {
      const fetchedSource = fetched.get(source.sourceUrl);
      if (!fetchedSource) throw new Error(`Source fetch missing for ${source.sourceUrl}`);
      const drafts = records.flatMap((record) => draftsForRecord(record, manifest));
      const result = await persistDurableEvidence({
        sourceKind: source.sourceKind,
        sourceUrl: source.sourceUrl,
        contentSha256: fetchedSource.contentSha256,
        jurisdictionSlug: manifest.jurisdictionSlug ?? 'us-mn',
        sessionSlug: source.sessionSlug,
        chamberSlug: source.chamberSlug,
        fetchedAt: fetchedSource.fetchedAt,
        httpStatus: fetchedSource.httpStatus,
        metadata: {
          publisher: source.publisher,
          manifestVersion: manifest.version,
          bytes: fetchedSource.bytes,
          contentType: fetchedSource.contentType,
        },
      }, drafts);
      inserted += result.inserted;
      reused += result.reused;
      unresolved.push(...result.unresolvedTargets);
    }

    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete', finished_at=now(), source_documents=$2, unresolved_members=$3,
             metadata=metadata || $4::jsonb
       WHERE id=$1::uuid`, [
      runId,
      fetched.size,
      unresolved.filter((item) => item.reason.startsWith('membership:')).length,
      JSON.stringify({ evidenceInserted: inserted, evidenceReused: reused, unresolvedTargets: unresolved }),
    ]);
    console.log(JSON.stringify({ runId, sources: fetched.size, records: manifest.records.length, inserted, reused, unresolved }));
  } catch (error) {
    const message = safeErrorText(error);
    await pool.query(`UPDATE ingestion_runs SET status='failed', finished_at=now(), error_summary=$2 WHERE id=$1::uuid`, [runId, message.slice(0, 2000)]).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeErrorText(error));
  process.exitCode = 1;
});

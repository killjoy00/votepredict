import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH = 2;
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').replace(/https?:\/\/\S+/gi, '[source URL]').slice(0, 900);
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

function freshness(capturedAt: string) {
  const age = (Date.now() - new Date(capturedAt).getTime()) / 86_400_000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
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
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const { discoverWaybackCaptures, fetchWaybackSnapshot } = await import('../src/evidence/wayback.js');
  const { selectWaybackEvidenceCaptures } = await import('../src/evidence/wayback-public-evidence-backfill.js');
  const {
    ORGANIZATION_PUBLICATION_HISTORY_VERSION,
    ORGANIZATION_PUBLICATION_SEEDS,
    validateOrganizationPublicationSeeds,
  } = await import('../src/evidence/organization-publication-history.js');

  try {
    validateOrganizationPublicationSeeds();
    const prior = await pool.query<{ next_offset: number | null }>(`
      SELECT CASE WHEN metadata->>'nextOffset' ~ '^[0-9]+$' THEN (metadata->>'nextOffset')::int ELSE 0 END AS next_offset
        FROM ingestion_runs
       WHERE source_system='organization-publication-archive' AND status='complete'
       ORDER BY finished_at DESC NULLS LAST LIMIT 1`);
    const requested = Number.parseInt(process.env.VOTEPREDICT_ORGANIZATION_PUBLICATION_BATCH ?? '', 10);
    const batchSize = Number.isFinite(requested) ? Math.min(4, Math.max(1, requested)) : DEFAULT_BATCH;
    const seeds = [...ORGANIZATION_PUBLICATION_SEEDS];
    const offset = seeds.length ? ((prior.rows[0]?.next_offset ?? 0) % seeds.length) : 0;
    const batch = seeds.length <= batchSize
      ? seeds
      : [...seeds.slice(offset, offset + batchSize), ...seeds.slice(0, Math.max(0, offset + batchSize - seeds.length))];
    const nextOffset = seeds.length ? (offset + batch.length) % seeds.length : 0;
    const run = await pool.query<{ id: string }>(`
      INSERT INTO ingestion_runs(source_system,scope,status,metadata)
      VALUES('organization-publication-archive',$1,'running',$2::jsonb) RETURNING id::text`, [
      `batch:${batchSize}`,
      JSON.stringify({ version: ORGANIZATION_PUBLICATION_HISTORY_VERSION, offset, nextOffset, totalSeeds: seeds.length }),
    ]);
    const runId = run.rows[0].id;

    let capturesDiscovered = 0;
    let capturesSelected = 0;
    let fetched = 0;
    let inserted = 0;
    let reused = 0;
    let failures = 0;
    const failureSamples: string[] = [];

    for (const seed of batch) {
      try {
        const captures = await discoverWaybackCaptures({ url: seed.url, from: seed.from, to: seed.to, limit: 500 });
        capturesDiscovered += captures.length;
        const selected = selectWaybackEvidenceCaptures(captures, { maxCaptures: 12 });
        capturesSelected += selected.length;
        for (const capture of selected) {
          try {
            const page = await fetchWaybackSnapshot(capture);
            fetched += 1;
            const persisted = await persistDurableEvidence({
              sourceKind: 'wayback_organization_publication',
              sourceUrl: capture.archiveUrl,
              contentSha256: page.contentSha256,
              fetchedAt: page.fetchedAt,
              httpStatus: page.httpStatus,
              metadata: {
                publisher: 'Internet Archive',
                organization: seed.organization,
                seedId: seed.id,
                publicationKind: seed.publicationKind,
                originalUrl: capture.original,
                archiveCapturedAt: capture.capturedAt,
                archiveDigest: capture.digest,
                availabilityProof: 'independent_archive_capture',
                availableAt: capture.capturedAt,
                collectorVersion: ORGANIZATION_PUBLICATION_HISTORY_VERSION,
              },
            }, [{
              kind: 'context',
              stance: 'neutral',
              claim: `Internet Archive captured ${seed.organization} ${seed.publicationKind.replaceAll('_', ' ')} material on ${capture.capturedAt.slice(0, 10)}.`,
              excerpt: page.excerpt,
              publishedAt: capture.capturedAt,
              sourceQuality: 'other',
              relevance: 'low',
              freshness: freshness(capture.capturedAt),
              extractionMethod: 'deterministic-wayback-organization-publication-capture',
              extractionVersion: ORGANIZATION_PUBLICATION_HISTORY_VERSION,
              confidence: 1,
              metadata: {
                contextType: 'organization_publication',
                subtype: seed.publicationKind,
                organization: seed.organization,
                seedId: seed.id,
                originalUrl: capture.original,
                archiveUrl: capture.archiveUrl,
                archiveCapturedAt: capture.capturedAt,
                archiveDigest: capture.digest,
                availabilityProof: 'independent_archive_capture',
                availableAt: capture.capturedAt,
                sameDayEligible: false,
                contextOnly: true,
                mechanicallyActionable: false,
                modelWeight: 0,
                scorecardOrEndorsementIsLegislativeStance: false,
                evidenceSeriesKey: `organization_publication:${seed.id}:${capture.original}:${capture.timestamp}`,
              },
            }]);
            inserted += persisted.inserted;
            reused += persisted.reused;
          } catch (error) {
            failures += 1;
            if (failureSamples.length < 12) failureSamples.push(`${seed.id}: snapshot: ${safe(error)}`);
          }
        }
      } catch (error) {
        failures += 1;
        if (failureSamples.length < 12) failureSamples.push(`${seed.id}: discovery: ${safe(error)}`);
      }
    }

    const result = {
      version: ORGANIZATION_PUBLICATION_HISTORY_VERSION,
      totalSeeds: seeds.length,
      batchSeeds: batch.length,
      offset,
      nextOffset,
      capturesDiscovered,
      capturesSelected,
      fetched,
      inserted,
      reused,
      failures,
      failureSamples,
      policy: {
        availability: 'exact Wayback capture timestamp',
        sameDayEligible: false,
        contextOnly: true,
        mechanicallyActionable: false,
        endorsementOrScorecardInfersLegislativeStance: false,
        servingChanged: false,
        productionAction: 'none',
      },
    };
    await pool.query(`UPDATE ingestion_runs SET status='complete',finished_at=now(),source_documents=$2,metadata=metadata||$3::jsonb WHERE id=$1::uuid`, [
      runId,
      fetched,
      JSON.stringify(result),
    ]);
    console.log(JSON.stringify({ organizationPublicationArchiveBackfill: result }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

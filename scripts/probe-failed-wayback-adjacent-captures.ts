import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  FAILED_WAYBACK_ADJACENT_PROBE_VERSION,
  parseFailedWaybackMemberNames,
} from '../src/evidence/failed-wayback-adjacent-probe.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const MAX_MEMBERS = 4;
const MAX_SEEDS_PER_MEMBER = 8;
const MAX_CAPTURES_PER_SEED = 8;
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) {
    console.log(
      '::add-mask::'
      + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'),
    );
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 700);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8_000 });
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
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

type FailureRun = {
  id: string;
  scope: string;
  finished_at: string;
  metadata: Record<string, unknown>;
};

type SeedRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  subtype: string | null;
  source_kind: string;
  source_url: string;
  source_quality: 'official' | 'member_primary' | 'other' | 'unknown';
  campaign_website: string | null;
};

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
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const { discoverWaybackCaptures, fetchWaybackSnapshot } =
    await import('../src/evidence/wayback.js');
  const {
    selectWaybackEvidenceCaptures,
    sessionArchiveWindow,
  } = await import('../src/evidence/wayback-public-evidence-backfill.js');

  try {
    const failedRun = (await pool.query<FailureRun>(`
      SELECT id::text,scope,finished_at::text,metadata
        FROM ingestion_runs
       WHERE source_system='wayback-public-evidence'
         AND status='complete'
         AND metadata->>'failures' ~ '^[0-9]+$'
         AND (metadata->>'failures')::int > 0
       ORDER BY finished_at DESC NULLS LAST
       LIMIT 1
    `)).rows[0];
    if (!failedRun) throw new Error('No completed Wayback public-evidence failure run found');

    const failureSamples = failedRun.metadata.failureSamples;
    const memberNames = parseFailedWaybackMemberNames(failureSamples, MAX_MEMBERS);
    if (memberNames.length === 0) {
      throw new Error('Latest Wayback failure run has no structured member failure samples');
    }

    const results: Array<Record<string, unknown>> = [];

    for (const memberName of memberNames) {
      const rows = (await pool.query<SeedRow>(`
        SELECT DISTINCT ON (
                 m.id,
                 coalesce(ei.metadata->>'subtype',''),
                 coalesce(ei.metadata->>'campaignWebsite',sd.source_url)
               )
               m.id::text AS membership_id,
               m.legislator_id::text AS legislator_id,
               l.name AS member_name,
               s.slug AS session_slug,
               c.slug AS chamber_slug,
               ei.metadata->>'subtype' AS subtype,
               sd.source_kind,
               sd.source_url,
               ei.source_quality,
               ei.metadata->>'campaignWebsite' AS campaign_website
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
          JOIN evidence_items ei ON ei.membership_id=m.id
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE l.name=$1
           AND s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND (
             ei.metadata->>'subtype' IN ('campaign_site_registry','member_primary_registry')
             OR sd.source_kind IN ('campaign_site','member_primary_article')
           )
         ORDER BY
           m.id,
           coalesce(ei.metadata->>'subtype',''),
           coalesce(ei.metadata->>'campaignWebsite',sd.source_url),
           sd.fetched_at DESC
      `, [memberName])).rows;

      const candidates = rows.map(row => ({
        ...row,
        seedKind:
          row.subtype === 'campaign_site_registry' || row.source_kind === 'campaign_site'
            ? 'campaign' as const
            : 'member_primary' as const,
        seedUrl: row.campaign_website || row.source_url,
        prefix:
          row.subtype === 'campaign_site_registry'
          || row.subtype === 'member_primary_registry',
      })).filter(row => /^https?:\/\//i.test(row.seedUrl));

      const byHost = new Map<string, (typeof candidates)[number]>();
      for (const candidate of candidates) {
        let host: string;
        try {
          host = new URL(candidate.seedUrl).hostname.toLowerCase();
        } catch {
          continue;
        }
        const key = candidate.membership_id + '|' + candidate.seedKind + '|' + host;
        const prior = byHost.get(key);
        if (!prior || (!prior.prefix && candidate.prefix)) byHost.set(key, candidate);
      }

      const seeds = [...byHost.values()]
        .sort((a, b) =>
          a.session_slug.localeCompare(b.session_slug)
          || a.seedKind.localeCompare(b.seedKind)
          || a.seedUrl.localeCompare(b.seedUrl))
        .slice(0, MAX_SEEDS_PER_MEMBER);

      const seedResults: Array<Record<string, unknown>> = [];
      for (const seed of seeds) {
        const window = sessionArchiveWindow(seed.session_slug);
        try {
          const captures = await discoverWaybackCaptures({
            url: seed.seedUrl,
            from: window.from,
            to: window.to,
            limit: 400,
            prefix: seed.prefix,
          });
          const selected = selectWaybackEvidenceCaptures(captures, {
            maxCaptures: MAX_CAPTURES_PER_SEED,
          });
          const captureResults: Array<Record<string, unknown>> = [];
          for (const capture of selected) {
            try {
              const page = await fetchWaybackSnapshot(capture);
              captureResults.push({
                originalUrl: capture.original,
                archiveUrl: capture.archiveUrl,
                capturedAt: capture.capturedAt,
                digest: capture.digest,
                fetch: 'readable',
                readableTextChars: page.text.length,
                contentSha256: page.contentSha256,
              });
            } catch (error) {
              captureResults.push({
                originalUrl: capture.original,
                archiveUrl: capture.archiveUrl,
                capturedAt: capture.capturedAt,
                digest: capture.digest,
                fetch: 'failed',
                error: safe(error),
              });
            }
          }
          seedResults.push({
            membershipId: seed.membership_id,
            session: seed.session_slug,
            chamber: seed.chamber_slug,
            seedKind: seed.seedKind,
            seedUrl: seed.seedUrl,
            prefix: seed.prefix,
            capturesDiscovered: captures.length,
            capturesSelected: selected.length,
            captures: captureResults,
          });
        } catch (error) {
          seedResults.push({
            membershipId: seed.membership_id,
            session: seed.session_slug,
            chamber: seed.chamber_slug,
            seedKind: seed.seedKind,
            seedUrl: seed.seedUrl,
            prefix: seed.prefix,
            discoveryError: safe(error),
          });
        }
      }

      results.push({
        memberName,
        seedCount: seeds.length,
        seeds: seedResults,
      });
    }

    console.log(JSON.stringify({
      failedWaybackAdjacentProbe: {
        version: FAILED_WAYBACK_ADJACENT_PROBE_VERSION,
        sourceFailureRun: {
          id: failedRun.id,
          scope: failedRun.scope,
          finishedAt: failedRun.finished_at,
          selectionPass: failedRun.metadata.selectionPass ?? null,
          failures: failedRun.metadata.failures ?? null,
          failureSamples,
        },
        members: results,
        policy: {
          readOnly: true,
          persistence: 'none',
          failedContentInferredFromAdjacentCaptures: false,
          adjacentCapturesAreIndependentCandidatesOnly: true,
          historicalAvailabilityIfLaterPersisted: 'exact Wayback capture timestamp',
          servingChanged: false,
        },
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

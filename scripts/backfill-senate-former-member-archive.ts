import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  generatedSenateFormerMemberCandidateUrls,
  parseBoundedSenateArchiveMembershipIds,
  SENATE_FORMER_MEMBER_ARCHIVE_VERSION,
} from '../src/evidence/senate-former-member-archive.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const MAX_CAPTURES_PER_URL = 2;
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
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 900);
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

function freshness(capturedAt: string) {
  const age = (Date.now() - new Date(capturedAt).getTime()) / 86_400_000;
  return age <= 365 ? 'current' as const : age <= 1095 ? 'recent' as const : 'stale' as const;
}

type TargetRow = {
  membership_id: string;
  legislator_id: string;
  name: string;
  external_key: string;
  session_slug: string;
  party: string;
  district: string;
  coverage_items: number;
};

async function main() {
  const membershipIds = parseBoundedSenateArchiveMembershipIds(
    process.env.VOTEPREDICT_SENATE_FORMER_MEMBER_IDS ?? '',
  );

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
  const { persistDurableEvidence } = await import('../src/evidence/durable-ingestion.js');
  const {
    memberPrimaryProfileMatches,
    senateDflFallbackProfileUrl,
  } = await import('../src/evidence/member-primary.js');
  const {
    discoverWaybackCaptures,
    fetchWaybackSnapshot,
  } = await import('../src/evidence/wayback.js');
  const {
    selectWaybackEvidenceCaptures,
    sessionArchiveWindow,
  } = await import('../src/evidence/wayback-public-evidence-backfill.js');

  let runId: string | undefined;
  try {
    const rows = (await pool.query<TargetRow>(`
      SELECT m.id::text AS membership_id,
             m.legislator_id::text AS legislator_id,
             l.name,
             l.external_key,
             s.slug AS session_slug,
             m.party,
             m.district,
             (
               SELECT count(*)::int
                 FROM evidence_items ei
                 JOIN source_documents sd ON sd.id=ei.source_document_id
                WHERE ei.membership_id=m.id
                  AND sd.source_kind IN (
                    'senate_member_primary_historical_article',
                    'wayback_member_primary',
                    'wayback_campaign_site'
                  )
             ) AS coverage_items
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE m.id=ANY($1::uuid[])
         AND c.slug='senate'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND l.external_key ~ '^lrl:[0-9]+$'
    `, [membershipIds])).rows;

    const byId = new Map(rows.map(row => [row.membership_id.toLowerCase(), row]));
    const targets = membershipIds.map(id => {
      const target = byId.get(id.toLowerCase());
      if (!target) throw new Error(`Requested membership is not an eligible 2021-26 Senate LRL membership: ${id}`);
      return target;
    });

    const started = await pool.query<{ id: string }>(`
      INSERT INTO ingestion_runs(source_system,scope,status,metadata)
      VALUES('senate-former-member-archive',$1,'running',$2::jsonb)
      RETURNING id::text
    `, [
      `members:${targets.length}`,
      JSON.stringify({
        version: SENATE_FORMER_MEMBER_ARCHIVE_VERSION,
        membershipIds,
        maxCapturesPerUrl: MAX_CAPTURES_PER_URL,
        bounded: true,
      }),
    ]);
    runId = started.rows[0].id;

    let candidateUrls = 0;
    let capturesDiscovered = 0;
    let snapshotsFetched = 0;
    let verifiedProfileCaptures = 0;
    let verifiedTargets = 0;
    let inserted = 0;
    let reused = 0;
    let failures = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const target of targets) {
      const priorRegistryRows = (await pool.query<{ url: string }>(`
        SELECT DISTINCT sd.metadata->>'registryPageUrl' AS url
          FROM source_documents sd
          JOIN evidence_items ei ON ei.source_document_id=sd.id
          JOIN memberships source_m ON source_m.id=ei.membership_id
         WHERE source_m.legislator_id=$1::uuid
           AND sd.source_kind IN (
             'senate_member_primary_historical_article',
             'member_primary_article'
           )
           AND COALESCE(sd.metadata->>'registryPageUrl','') ~ '^https?://'
      `, [target.legislator_id])).rows;

      const dflFallback = target.party.trim().toUpperCase() === 'DFL'
        ? senateDflFallbackProfileUrl(target.name)
        : undefined;
      const urls = [...new Set([
        ...priorRegistryRows.map(row => row.url),
        ...generatedSenateFormerMemberCandidateUrls(target, dflFallback),
      ])];
      candidateUrls += urls.length;

      const member = {
        name: target.name,
        chamber_slug: 'senate' as const,
        district: target.district,
        party: target.party,
        external_key: target.external_key,
      };
      const window = sessionArchiveWindow(target.session_slug);
      let targetCaptures = 0;
      let targetFetched = 0;
      let targetVerified = 0;
      let targetInserted = 0;
      let targetReused = 0;
      const verifiedOriginalUrls = new Set<string>();
      const targetFailures: string[] = [];

      for (const url of urls) {
        try {
          const captures = await discoverWaybackCaptures({
            url,
            from: window.from,
            to: window.to,
            limit: 80,
          });
          targetCaptures += captures.length;
          capturesDiscovered += captures.length;
          const selected = selectWaybackEvidenceCaptures(captures, {
            maxCaptures: MAX_CAPTURES_PER_URL,
          });
          for (const capture of selected) {
            try {
              const page = await fetchWaybackSnapshot(capture);
              targetFetched += 1;
              snapshotsFetched += 1;
              if (!memberPrimaryProfileMatches(page, member)) continue;

              targetVerified += 1;
              verifiedProfileCaptures += 1;
              verifiedOriginalUrls.add(capture.original);
              const persisted = await persistDurableEvidence({
                sourceKind: 'wayback_member_primary',
                sourceUrl: capture.archiveUrl,
                contentSha256: page.contentSha256,
                sessionSlug: target.session_slug,
                chamberSlug: 'senate',
                fetchedAt: page.fetchedAt,
                httpStatus: page.httpStatus,
                metadata: {
                  publisher: 'Internet Archive',
                  collectorVersion: SENATE_FORMER_MEMBER_ARCHIVE_VERSION,
                  originalUrl: capture.original,
                  archiveCapturedAt: capture.capturedAt,
                  archiveDigest: capture.digest,
                  availabilityProof: 'independent_archive_capture',
                  availableAt: capture.capturedAt,
                  identityProof: 'archived_profile_member_and_historical_district',
                },
              }, [{
                target: { membershipId: target.membership_id },
                kind: 'context',
                stance: 'neutral',
                claim: `Internet Archive captured a verified Senate member/caucus profile for ${target.name} on ${capture.capturedAt.slice(0, 10)}.`,
                excerpt: page.excerpt,
                publishedAt: capture.capturedAt,
                sourceQuality: 'member_primary',
                relevance: 'medium',
                freshness: freshness(capture.capturedAt),
                extractionMethod: 'deterministic-senate-former-member-archive-profile',
                extractionVersion: SENATE_FORMER_MEMBER_ARCHIVE_VERSION,
                confidence: 1,
                metadata: {
                  contextType: 'member_primary',
                  subtype: 'archived_member_primary_profile',
                  originalUrl: capture.original,
                  archiveUrl: capture.archiveUrl,
                  archiveCapturedAt: capture.capturedAt,
                  archiveDigest: capture.digest,
                  availabilityProof: 'independent_archive_capture',
                  availableAt: capture.capturedAt,
                  identityProof: 'archived_profile_member_and_historical_district',
                  sourceVerified: true,
                  sameDayEligible: false,
                  contextOnly: true,
                  mechanicallyActionable: false,
                  modelWeight: 0,
                  evidenceSeriesKey:
                    `senate-former-member-archive:${target.membership_id}:${capture.original}:${capture.timestamp}`,
                },
              }]);
              inserted += persisted.inserted;
              reused += persisted.reused;
              targetInserted += persisted.inserted;
              targetReused += persisted.reused;
            } catch (error) {
              failures += 1;
              if (targetFailures.length < 3) targetFailures.push('snapshot: ' + safe(error));
            }
          }
        } catch (error) {
          failures += 1;
          if (targetFailures.length < 3) targetFailures.push('discovery: ' + safe(error));
        }
      }

      if (targetVerified > 0) verifiedTargets += 1;
      results.push({
        membershipId: target.membership_id,
        memberName: target.name,
        session: target.session_slug,
        district: target.district,
        coverageItemsBefore: target.coverage_items,
        candidateUrls: urls.length,
        capturesDiscovered: targetCaptures,
        snapshotsFetched: targetFetched,
        verifiedProfileCaptures: targetVerified,
        verifiedOriginalUrls: [...verifiedOriginalUrls],
        inserted: targetInserted,
        reused: targetReused,
        failures: targetFailures.length,
        failureSamples: targetFailures,
      });
    }

    const result = {
      version: SENATE_FORMER_MEMBER_ARCHIVE_VERSION,
      requestedMembershipIds: membershipIds,
      targets: results,
      totals: {
        targets: targets.length,
        candidateUrls,
        capturesDiscovered,
        snapshotsFetched,
        verifiedProfileCaptures,
        verifiedTargets,
        inserted,
        reused,
        failures,
      },
      policy: {
        candidateUrlsAreIdentityProof: false,
        identity: 'archived profile must match member and historical district',
        availability: 'exact Wayback capture timestamp',
        sameDayEligible: false,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        stanceExtraction: false,
        servingChanged: false,
        productionAction: 'bounded_context_persistence_only',
      },
    };
    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete',
             finished_at=now(),
             source_documents=$2,
             metadata=metadata||$3::jsonb
       WHERE id=$1::uuid
    `, [runId, snapshotsFetched, JSON.stringify(result)]);
    console.log(JSON.stringify({ senateFormerMemberArchiveBackfill: result }, null, 2));
  } catch (error) {
    if (runId) {
      await pool.query(`
        UPDATE ingestion_runs
           SET status='failed',finished_at=now(),error_summary=$2
         WHERE id=$1::uuid
      `, [runId, safe(error)]).catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

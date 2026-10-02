import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const TARGET_LIMIT = 18;
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

function slugTokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 1);
}

function generatedCandidateUrls(
  member: { name: string; party: string },
  dflProfileUrl: string | undefined,
): string[] {
  const party = member.party.trim().toUpperCase();
  const tokens = slugTokens(member.name);
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!first || !last) return dflProfileUrl ? [dflProfileUrl] : [];
  const full = tokens.join('-');
  const firstLast = first + '-' + last;
  const slugs = [...new Set([full, firstLast])];

  if (party === 'DFL') {
    const urls = dflProfileUrl ? [dflProfileUrl] : [];
    for (const slug of slugs) {
      urls.push(`https://senatedfl.mn/author/${slug}/`);
      urls.push(`https://senatedfl.mn/author/senator-${slug}/`);
    }
    return [...new Set(urls)];
  }
  if (party === 'R' || party === 'GOP' || party === 'REPUBLICAN') {
    const urls: string[] = [];
    for (const slug of slugs) {
      urls.push(`https://www.mnsenaterepublicans.com/${slug}`);
      urls.push(`https://www.mnsenaterepublicans.com/senator-${slug}`);
    }
    return [...new Set(urls)];
  }
  return [];
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

  try {
    const targets = (await pool.query<TargetRow>(`
      WITH target_memberships AS (
        SELECT m.id,
               m.legislator_id,
               l.name,
               l.external_key,
               s.slug AS session_slug,
               m.party,
               m.district
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE c.slug='senate'
           AND s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND l.external_key ~ '^lrl:[0-9]+$'
      ),
      coverage AS (
        SELECT tm.id AS membership_id,
               count(ei.id) FILTER (
                 WHERE sd.source_kind IN (
                   'senate_member_primary_historical_article',
                   'wayback_member_primary',
                   'wayback_campaign_site'
                 )
               )::int AS coverage_items
          FROM target_memberships tm
          LEFT JOIN evidence_items ei ON ei.membership_id=tm.id
          LEFT JOIN source_documents sd ON sd.id=ei.source_document_id
         GROUP BY tm.id
      )
      SELECT tm.id::text AS membership_id,
             tm.legislator_id::text AS legislator_id,
             tm.name,
             tm.external_key,
             tm.session_slug,
             tm.party,
             tm.district,
             COALESCE(cov.coverage_items,0)::int AS coverage_items
        FROM target_memberships tm
        LEFT JOIN coverage cov ON cov.membership_id=tm.id
       WHERE COALESCE(cov.coverage_items,0) < 5
       ORDER BY
         CASE tm.session_slug
           WHEN '2021-2022' THEN 0
           WHEN '2023-2024' THEN 1
           ELSE 2
         END,
         COALESCE(cov.coverage_items,0),
         tm.name,
         tm.id
       LIMIT $1
    `, [TARGET_LIMIT])).rows;

    const results: Array<Record<string, unknown>> = [];
    let candidateUrls = 0;
    let capturesDiscovered = 0;
    let snapshotsFetched = 0;
    let verifiedProfileCaptures = 0;
    let verifiedTargets = 0;
    let failures = 0;

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
        ...generatedCandidateUrls(target, dflFallback),
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
          const selected = selectWaybackEvidenceCaptures(captures, { maxCaptures: 2 });
          for (const capture of selected) {
            try {
              const page = await fetchWaybackSnapshot(capture);
              targetFetched += 1;
              snapshotsFetched += 1;
              if (!memberPrimaryProfileMatches(page, member)) continue;
              targetVerified += 1;
              verifiedProfileCaptures += 1;
              verifiedOriginalUrls.add(capture.original);
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
        party: target.party,
        district: target.district,
        coverageItemsBefore: target.coverage_items,
        candidateUrls: urls.length,
        capturesDiscovered: targetCaptures,
        snapshotsFetched: targetFetched,
        verifiedProfileCaptures: targetVerified,
        verifiedOriginalUrls: [...verifiedOriginalUrls],
        failures: targetFailures.length,
        failureSamples: targetFailures,
      });
    }

    console.log(JSON.stringify({
      senateFormerMemberArchiveProbe: {
        targets: results,
        totals: {
          targets: targets.length,
          candidateUrls,
          capturesDiscovered,
          snapshotsFetched,
          verifiedProfileCaptures,
          verifiedTargets,
          failures,
        },
        policy: {
          readOnly: true,
          archiveCaptureIsAvailability: true,
          archivedPageMustVerifyMemberAndHistoricalDistrict: true,
          candidateUrlGenerationIsNotIdentityProof: true,
          ambiguousIdentityFailsClosed: true,
          sameDayEligible: false,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(safe(error));
  process.exitCode = 1;
});

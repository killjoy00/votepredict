import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SESSION = '2021-2022';
let secrets: string[] = [];

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

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
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 1800);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');

  async function works(value: string) {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8_000,
    });
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

type CoverageRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  external_key: string;
  party: string;
  district: string;
  legacy_coverage_items: number;
  substantive_publication_items: number;
  native_senate_publication_items: number;
  wayback_publication_items: number;
  profile_anchor_items: number;
  profile_anchor_sources: number;
  earliest_substantive_published_at: string | null;
  latest_substantive_published_at: string | null;
};

type AnchorRow = {
  membership_id: string;
  source_document_id: string;
  archive_url: string;
  original_url: string | null;
  archive_captured_at: string | null;
  identity_proof: string | null;
};

function bucket(value: number): 'zero' | 'low' | 'five_plus' {
  if (value === 0) return 'zero';
  if (value < 5) return 'low';
  return 'five_plus';
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
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');

  try {
    const coverage = (await pool.query<CoverageRow>(`
      WITH target_memberships AS (
        SELECT
          m.id,
          m.legislator_id,
          l.name AS member_name,
          l.external_key,
          m.party,
          m.district
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
        WHERE c.slug='senate'
          AND s.slug=$1
          AND l.external_key ~ '^lrl:[0-9]+$'
      ),
      evidence AS (
        SELECT
          tm.id AS membership_id,
          count(ei.id) FILTER (
            WHERE sd.source_kind IN (
              'senate_member_primary_historical_article',
              'wayback_member_primary',
              'wayback_campaign_site'
            )
          )::int AS legacy_coverage_items,
          count(ei.id) FILTER (
            WHERE (
              sd.source_kind='senate_member_primary_historical_article'
              OR sd.source_kind='wayback_campaign_site'
              OR (
                sd.source_kind='wayback_member_primary'
                AND coalesce(ei.metadata->>'subtype','') <> 'archived_member_primary_profile'
              )
            )
          )::int AS substantive_publication_items,
          count(ei.id) FILTER (
            WHERE sd.source_kind='senate_member_primary_historical_article'
          )::int AS native_senate_publication_items,
          count(ei.id) FILTER (
            WHERE (
              sd.source_kind='wayback_campaign_site'
              OR (
                sd.source_kind='wayback_member_primary'
                AND coalesce(ei.metadata->>'subtype','') <> 'archived_member_primary_profile'
              )
            )
          )::int AS wayback_publication_items,
          count(ei.id) FILTER (
            WHERE sd.source_kind='wayback_member_primary'
              AND ei.metadata->>'subtype'='archived_member_primary_profile'
          )::int AS profile_anchor_items,
          count(DISTINCT sd.id) FILTER (
            WHERE sd.source_kind='wayback_member_primary'
              AND ei.metadata->>'subtype'='archived_member_primary_profile'
          )::int AS profile_anchor_sources,
          min(ei.published_at)::text FILTER (
            WHERE (
              sd.source_kind='senate_member_primary_historical_article'
              OR sd.source_kind='wayback_campaign_site'
              OR (
                sd.source_kind='wayback_member_primary'
                AND coalesce(ei.metadata->>'subtype','') <> 'archived_member_primary_profile'
              )
            )
          ) AS earliest_substantive_published_at,
          max(ei.published_at)::text FILTER (
            WHERE (
              sd.source_kind='senate_member_primary_historical_article'
              OR sd.source_kind='wayback_campaign_site'
              OR (
                sd.source_kind='wayback_member_primary'
                AND coalesce(ei.metadata->>'subtype','') <> 'archived_member_primary_profile'
              )
            )
          ) AS latest_substantive_published_at
        FROM target_memberships tm
        LEFT JOIN evidence_items ei ON ei.membership_id=tm.id
        LEFT JOIN source_documents sd ON sd.id=ei.source_document_id
        GROUP BY tm.id
      )
      SELECT
        tm.id::text AS membership_id,
        tm.legislator_id::text AS legislator_id,
        tm.member_name,
        tm.external_key,
        tm.party,
        tm.district,
        coalesce(e.legacy_coverage_items,0)::int AS legacy_coverage_items,
        coalesce(e.substantive_publication_items,0)::int AS substantive_publication_items,
        coalesce(e.native_senate_publication_items,0)::int AS native_senate_publication_items,
        coalesce(e.wayback_publication_items,0)::int AS wayback_publication_items,
        coalesce(e.profile_anchor_items,0)::int AS profile_anchor_items,
        coalesce(e.profile_anchor_sources,0)::int AS profile_anchor_sources,
        e.earliest_substantive_published_at,
        e.latest_substantive_published_at
      FROM target_memberships tm
      LEFT JOIN evidence e ON e.membership_id=tm.id
      ORDER BY
        coalesce(e.substantive_publication_items,0),
        CASE WHEN coalesce(e.profile_anchor_sources,0)>0 THEN 0 ELSE 1 END,
        tm.member_name,
        tm.id
    `, [SESSION])).rows;

    const anchors = (await pool.query<AnchorRow>(`
      SELECT
        ei.membership_id::text AS membership_id,
        sd.id::text AS source_document_id,
        sd.source_url AS archive_url,
        coalesce(
          sd.metadata->>'originalUrl',
          ei.metadata->>'originalUrl'
        ) AS original_url,
        coalesce(
          sd.metadata->>'archiveCapturedAt',
          ei.metadata->>'archiveCapturedAt'
        ) AS archive_captured_at,
        coalesce(
          sd.metadata->>'identityProof',
          ei.metadata->>'identityProof'
        ) AS identity_proof
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      JOIN memberships m ON m.id=ei.membership_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN chambers c ON c.id=m.chamber_id
      WHERE c.slug='senate'
        AND s.slug=$1
        AND sd.source_kind='wayback_member_primary'
        AND ei.metadata->>'subtype'='archived_member_primary_profile'
      ORDER BY ei.membership_id,archive_captured_at,sd.id
    `, [SESSION])).rows;

    const anchorByMembership = new Map<string, AnchorRow[]>();
    for (const row of anchors) {
      const list = anchorByMembership.get(row.membership_id) ?? [];
      list.push(row);
      anchorByMembership.set(row.membership_id, list);
    }

    const targets = coverage
      .filter((row) => row.substantive_publication_items < 5)
      .map((row) => ({
        membershipId: row.membership_id,
        legislatorId: row.legislator_id,
        memberName: row.member_name,
        externalKey: row.external_key,
        party: row.party,
        district: row.district,
        substantivePublicationItems: row.substantive_publication_items,
        substantiveCoverageBucket: bucket(row.substantive_publication_items),
        legacyCoverageItems: row.legacy_coverage_items,
        legacyCoverageBucket: bucket(row.legacy_coverage_items),
        nativeSenatePublicationItems: row.native_senate_publication_items,
        waybackPublicationItems: row.wayback_publication_items,
        profileAnchorItems: row.profile_anchor_items,
        profileAnchorSources: row.profile_anchor_sources,
        profileAnchors: (anchorByMembership.get(row.membership_id) ?? []).slice(0, 8).map((anchor) => ({
          sourceDocumentId: anchor.source_document_id,
          archiveUrl: anchor.archive_url,
          originalUrl: anchor.original_url,
          archiveCapturedAt: anchor.archive_captured_at,
          identityProof: anchor.identity_proof,
        })),
        earliestSubstantivePublishedAt: row.earliest_substantive_published_at,
        latestSubstantivePublishedAt: row.latest_substantive_published_at,
      }));

    const countBuckets = (selector: (row: CoverageRow) => number) => ({
      zero: coverage.filter((row) => selector(row) === 0).length,
      low: coverage.filter((row) => selector(row) > 0 && selector(row) < 5).length,
      fivePlus: coverage.filter((row) => selector(row) >= 5).length,
    });

    const output = {
      senate2021PublicationRecoveryAudit: {
        schemaVersion: 'senate-2021-publication-recovery-audit-v1',
        session: SESSION,
        memberships: coverage.length,
        coverage: {
          legacyDefinition: countBuckets((row) => row.legacy_coverage_items),
          substantivePublicationDefinition: countBuckets((row) => row.substantive_publication_items),
          membershipsWithVerifiedProfileAnchors: coverage.filter((row) => row.profile_anchor_sources > 0).length,
          zeroSubstantiveWithProfileAnchor: coverage.filter(
            (row) => row.substantive_publication_items === 0 && row.profile_anchor_sources > 0,
          ).length,
          lowSubstantiveWithProfileAnchor: coverage.filter(
            (row) => row.substantive_publication_items > 0
              && row.substantive_publication_items < 5
              && row.profile_anchor_sources > 0,
          ).length,
        },
        targets,
        policy: {
          readOnly: true,
          profilePagesAreIdentityAnchorsNotSubstantivePublications: true,
          targetOrdering: 'substantive publication count, then verified profile anchor availability, then member name',
          historicalAvailability: 'native verified publication metadata or exact archive capture only',
          ambiguousIdentityFailsClosed: true,
          sameDayEligible: false,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    };

    const outputPath = argumentValue('--output');
    if (outputPath) {
      mkdirSync(dirname(resolve(outputPath)), { recursive: true });
      writeFileSync(resolve(outputPath), JSON.stringify(output, null, 2) + '\n', 'utf8');
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

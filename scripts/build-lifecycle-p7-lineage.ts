import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  LIFECYCLE_P7_EXPECTED_BILLS,
  buildLifecycleP7Lineage,
  type LifecycleP7Bill,
  type LifecycleP7BillVersion,
  type LifecycleP7ProcessReference,
} from '../src/evaluation/lifecycle-p7-lineage.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-p7-lineage-v1';
let secretValues: string[] = [];

type BillRow = {
  bill_id: string;
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  current_companion_identifier: string | null;
  current_companion_observed_at: string | null;
  current_companion_source_url: string | null;
  current_companion_source_sha256: string | null;
};

type ProcessRow = {
  event_id: string;
  bill_id: string;
  occurred_on: string;
  source_url: string | null;
  source_document_id: string | null;
  source_content_sha256: string | null;
  action_descriptions: unknown;
  companion_identifiers: unknown;
};

type VersionRow = {
  bill_version_id: string;
  bill_id: string;
  version_key: string;
  published_on: string | null;
  source_url: string | null;
  text_sha256: string | null;
  raw_text: string;
};

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const value of secretValues.filter((value) => value.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]');
}

async function canConnect(value: string): Promise<boolean> {
  const probe = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8_000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function chooseDatabaseUrl(env: Record<string, string | undefined>): Promise<string> {
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await canConnect(value)) return value;
  }
  const cronSecret = env.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + cronSecret },
  });
  if (!response.ok) throw new Error('Authenticated Neon database bridge returned HTTP ' + response.status);
  const value = (await response.text()).trim();
  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('Authenticated Neon database bridge returned an invalid database connection value');
  }
  secretValues.push(value);
  mask(value);
  if (!await canConnect(value)) {
    throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  }
  return value;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function ndjson(rows: readonly unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  for (const value of secretValues) mask(value);

  const databaseUrl = await chooseDatabaseUrl(env);
  secretValues.push(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  try {
    const [billResult, processResult, versionResult] = await Promise.all([
      pool.query<BillRow>(`
        SELECT b.id::text AS bill_id,
               s.slug AS session_slug,
               c.slug AS chamber_slug,
               upper(replace(b.identifier, ' ', '')) AS identifier,
               upper(replace(COALESCE(
                 b.metadata #>> '{revisorIntroduction,currentCompanion,identifier}',
                 b.metadata #>> '{revisor,companionIdentifier}'
               ), ' ', '')) AS current_companion_identifier,
               b.metadata #>> '{revisorIntroduction,currentCompanion,observedAt}' AS current_companion_observed_at,
               COALESCE(
                 b.metadata #>> '{revisorIntroduction,statusXmlUrl}',
                 b.metadata #>> '{revisorIntroduction,statusHtmlUrl}'
               ) AS current_companion_source_url,
               COALESCE(
                 b.metadata #>> '{revisorIntroduction,statusXmlSha256}',
                 b.metadata #>> '{revisorIntroduction,statusHtmlSha256}'
               ) AS current_companion_source_sha256
          FROM bills b
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
          JOIN chambers c ON c.id=b.originating_chamber_id AND c.slug IN ('house','senate')
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
         ORDER BY s.starts_on,c.slug,b.identifier`),
      pool.query<ProcessRow>(`
        SELECT se.id::text AS event_id,
               se.bill_id::text,
               se.occurred_at::date::text AS occurred_on,
               se.source_url,
               se.source_document_id::text,
               sd.content_sha256 AS source_content_sha256,
               se.metadata -> 'actionDescriptions' AS action_descriptions,
               se.metadata -> 'companionIdentifiers' AS companion_identifiers
          FROM legislative_stage_events se
          JOIN bills b ON b.id=se.bill_id
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
          LEFT JOIN source_documents sd ON sd.id=se.source_document_id
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
           AND se.stage_kind='companion_reference'
           AND se.metadata ->> 'parserVersion'='revisor-process-v2'
         ORDER BY se.bill_id,se.occurred_at,se.id`),
      pool.query<VersionRow>(`
        SELECT bv.id::text AS bill_version_id,
               bv.bill_id::text,
               bv.version_key,
               bv.published_at::date::text AS published_on,
               bv.source_url,
               bv.text_hash AS text_sha256,
               bv.raw_text
          FROM bill_versions bv
          JOIN bills b ON b.id=bv.bill_id
          JOIN legislative_sessions s ON s.id=b.session_id
          JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
         WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
           AND b.identifier ~ '^(HF|SF)[0-9]+$'
           AND bv.published_at IS NOT NULL
           AND bv.raw_text IS NOT NULL
           AND length(bv.raw_text) >= 100
         ORDER BY bv.bill_id,bv.published_at,bv.version_key,bv.id`),
    ]);

    if (billResult.rows.length !== LIFECYCLE_P7_EXPECTED_BILLS) {
      throw new Error(
        'Lifecycle P7 population drift: ' + billResult.rows.length + '/' +
        LIFECYCLE_P7_EXPECTED_BILLS + ' frozen bills',
      );
    }

    const bills: LifecycleP7Bill[] = billResult.rows.map((row) => ({
      billId: row.bill_id,
      session: row.session_slug,
      chamber: row.chamber_slug,
      identifier: row.identifier,
      currentCompanionIdentifier: row.current_companion_identifier,
      currentCompanionObservedAt: row.current_companion_observed_at,
      currentCompanionSourceUrl: row.current_companion_source_url,
      currentCompanionSourceSha256: row.current_companion_source_sha256,
    }));
    const processReferences: LifecycleP7ProcessReference[] = processResult.rows.map((row) => ({
      eventId: row.event_id,
      billId: row.bill_id,
      occurredOn: row.occurred_on,
      sourceUrl: row.source_url,
      sourceDocumentId: row.source_document_id,
      sourceContentSha256: row.source_content_sha256,
      descriptions: stringArray(row.action_descriptions),
      companionIdentifiers: stringArray(row.companion_identifiers),
    }));
    const billVersions: LifecycleP7BillVersion[] = versionResult.rows.map((row) => ({
      billVersionId: row.bill_version_id,
      billId: row.bill_id,
      versionKey: row.version_key,
      publishedOn: row.published_on,
      sourceUrl: row.source_url,
      textSha256: row.text_sha256,
      rawText: row.raw_text,
    }));

    const result = buildLifecycleP7Lineage({ bills, processReferences, billVersions });
    const report = {
      ...result.report,
      generatedAt: new Date().toISOString(),
      codeSha: process.env.GITHUB_SHA ?? null,
      databaseReads: [
        'bills: identity/session/chamber and final official companion metadata only',
        'legislative_stage_events: revisor-process-v2 companion_reference rows only',
        'source_documents: hashes for those process references only',
        'bill_versions: dated official text/version lineage only',
      ],
      prohibitedReads: [
        'sourceChamberPassage outcome metadata',
        'vote_events',
        'member_votes',
        'forecast outcomes',
      ],
    };

    const outputDir = process.env.VOTEPREDICT_P7_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    await writeFile(join(outputDir, 'edges.ndjson'), ndjson(result.edges), 'utf8');
    await writeFile(join(outputDir, 'components.ndjson'), ndjson(result.components), 'utf8');
    await writeFile(join(outputDir, 'unresolved.ndjson'), ndjson(result.unresolved), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

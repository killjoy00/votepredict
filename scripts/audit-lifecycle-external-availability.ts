import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR = 'artifacts/lifecycle-external-availability-v1';
let secretValues: string[] = [];

type EvidenceRow = {
  evidence_id: string;
  source_document_id: string;
  bill_id: string | null;
  membership_id: string | null;
  session_slug: string | null;
  source_kind: string;
  evidence_kind: string;
  stance: string | null;
  published_at: string | null;
  fetched_at: string;
  metadata: Record<string, unknown> | null;
  news_publication_date_source: string | null;
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
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]');
}
async function canConnect(value: string): Promise<boolean> {
  const probe = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8_000 });
  try { await probe.query('SELECT 1'); return true; } catch { return false; }
  finally { await probe.end().catch(() => undefined); }
}
async function chooseDatabaseUrl(env: Record<string, string | undefined>): Promise<string> {
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await canConnect(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET is unavailable for authenticated Neon database bridge');
  const response = await fetch(DATABASE_BRIDGE_URL, { method: 'POST', headers: { authorization: 'Bearer ' + secret } });
  if (!response.ok) throw new Error('Authenticated Neon database bridge returned HTTP ' + response.status);
  const value = (await response.text()).trim();
  secretValues.push(value); mask(value);
  if (!await canConnect(value)) throw new Error('Authenticated Neon database bridge returned a non-portable database URL');
  return value;
}
function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

async function main(): Promise<void> {
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');
  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secretValues = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value).filter((value): value is string => typeof value === 'string');
  for (const value of secretValues) mask(value);
  const databaseUrl = await chooseDatabaseUrl(env);
  secretValues.push(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  const {
    LIFECYCLE_EXTERNAL_AVAILABILITY_SCHEMA_VERSION,
    classifyLifecycleExternalAvailability,
    lifecycleExternalAvailabilityContentSha256,
  } = await import('../src/evaluation/lifecycle-external-availability.js');

  try {
    // Outcome-blind by contract: this query does not read passage/vote outcomes or forecast predictions.
    const result = await pool.query<EvidenceRow>(`
      SELECT ei.id::text AS evidence_id,
             ei.source_document_id::text,
             ei.bill_id::text,
             ei.membership_id::text,
             COALESCE(bs.slug,ms.slug) AS session_slug,
             sd.source_kind,
             ei.evidence_kind,
             ei.stance,
             ei.published_at::text,
             sd.fetched_at::text,
             ei.metadata,
             COALESCE(
               ei.metadata->>'publicationDateSource',
               news_context.publication_date_source
             ) AS news_publication_date_source
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        LEFT JOIN bills b ON b.id=ei.bill_id
        LEFT JOIN legislative_sessions bs ON bs.id=b.session_id
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN legislative_sessions ms ON ms.id=m.session_id
        LEFT JOIN LATERAL (
          SELECT nx.metadata->>'publicationDateSource' AS publication_date_source
            FROM evidence_items nx
           WHERE nx.source_document_id=ei.source_document_id
             AND nx.metadata->>'subtype'='news_article'
             AND nx.metadata->>'publicationDateSource' IS NOT NULL
           ORDER BY nx.id
           LIMIT 1
        ) news_context ON true
       WHERE COALESCE(bs.slug,ms.slug) IN ('2021-2022','2023-2024','2025-2026')
       ORDER BY COALESCE(bs.slug,ms.slug),ei.bill_id,ei.membership_id,ei.published_at,ei.id`);

    const accepted = [];
    const rejectedByReason: Record<string, number> = {};
    const acceptedByFamily: Record<string, number> = {};
    const acceptedBySession: Record<string, number> = {};
    const acceptedBillIds = new Set<string>();
    const acceptedMembershipIds = new Set<string>();
    for (const row of result.rows) {
      const decision = classifyLifecycleExternalAvailability({
        evidenceId: row.evidence_id,
        sourceDocumentId: row.source_document_id,
        billId: row.bill_id,
        membershipId: row.membership_id,
        session: row.session_slug,
        sourceKind: row.source_kind,
        evidenceKind: row.evidence_kind,
        stance: row.stance,
        publishedAt: row.published_at,
        fetchedAt: row.fetched_at,
        metadata: row.metadata,
        newsPublicationDateSource: row.news_publication_date_source,
      });
      if (!decision.accepted) {
        increment(rejectedByReason, decision.reason);
        continue;
      }
      accepted.push(decision.row);
      increment(acceptedByFamily, decision.row.family);
      increment(acceptedBySession, decision.row.session ?? 'unknown');
      if (decision.row.billId) acceptedBillIds.add(decision.row.billId);
      if (decision.row.membershipId) acceptedMembershipIds.add(decision.row.membershipId);
    }

    const report = {
      schemaVersion: LIFECYCLE_EXTERNAL_AVAILABILITY_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      codeSha: process.env.GITHUB_SHA ?? null,
      contract: {
        outcomeBlind: true,
        readsPassageOutcomes: false,
        readsMemberVoteOutcomes: false,
        readsForecastPredictions: false,
        sameDayUseAllowed: false,
        availabilityTest: 'availableOn < lifecycle cutoff date',
        campaignFinance: 'excluded until a public disclosure/filing availability date is proved',
        mutableCampaignPages: 'excluded without contemporaneous archive/capture provenance',
        news: 'page-metadata publication dates only',
        memberPrimary: 'verified publication date',
        structuredOfficial: 'official published date',
      },
      population: {
        evidenceRowsAudited: result.rows.length,
        acceptedRows: accepted.length,
        rejectedRows: result.rows.length - accepted.length,
        acceptedBills: acceptedBillIds.size,
        acceptedMemberships: acceptedMembershipIds.size,
      },
      acceptedByFamily: Object.fromEntries(Object.entries(acceptedByFamily).sort(([a],[b]) => a.localeCompare(b))),
      acceptedBySession: Object.fromEntries(Object.entries(acceptedBySession).sort(([a],[b]) => a.localeCompare(b))),
      rejectedByReason: Object.fromEntries(Object.entries(rejectedByReason).sort(([a],[b]) => a.localeCompare(b))),
      acceptedContentSha256: lifecycleExternalAvailabilityContentSha256(accepted),
      policy: {
        retrospectiveDevelopmentOnly: true,
        automaticPromotionAllowed: false,
        servingChanged: false,
        p8ModelChanged: false,
        productionAction: 'none',
      },
    };

    const outputDir = process.env.VOTEPREDICT_EXTERNAL_AVAILABILITY_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    await writeFile(
      join(outputDir, 'accepted.ndjson'),
      accepted.map((row) => JSON.stringify(row)).join('\n') + (accepted.length ? '\n' : ''),
      'utf8',
    );
    console.log(JSON.stringify({ lifecycleExternalAvailability: report }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(safeMessage(error)); process.exitCode = 1; });

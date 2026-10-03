import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1200);
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
  const {
    EVIDENCE_QUALITY_SCHEMA_VERSION,
    EVIDENCE_QUALITY_SOURCE_KINDS,
    EVIDENCE_QUALITY_TEXT_VERSION,
  } = await import('../src/evidence/evidence-quality.js');

  const result = await pool.query<{
    priority_tier: string;
    source_kind: string;
    session_slug: string;
    source_documents: number;
    with_text_snapshot: number;
    with_annotation: number;
    member_linked: number;
    bill_linked: number;
    exact_member_bill: number;
    direct_or_high: number;
    member_primary_quality: number;
    directional_existing_stance: number;
  }>(`
    WITH document_features AS (
      SELECT
        sd.id,
        sd.source_kind,
        coalesce(ls.slug,'unscoped') AS session_slug,
        bool_or(
          ei.membership_id IS NOT NULL
          OR (
            jsonb_typeof(ei.metadata->'mentionedMembers')='array'
            AND jsonb_array_length(ei.metadata->'mentionedMembers') > 0
          )
          OR nullif(trim(coalesce(ei.metadata->>'memberName','')),'') IS NOT NULL
        ) AS has_member,
        bool_or(
          ei.bill_id IS NOT NULL
          OR (
            jsonb_typeof(ei.metadata->'billIdentifiers')='array'
            AND jsonb_array_length(ei.metadata->'billIdentifiers') > 0
          )
          OR nullif(trim(coalesce(ei.metadata->>'exactBillIdentifier','')),'') IS NOT NULL
        ) AS has_bill,
        bool_or(
          ei.relevance IN ('direct','high')
          OR ei.evidence_kind IN ('direct_statement','related_statement')
        ) AS direct_or_high,
        bool_or(ei.source_quality='member_primary') AS member_primary_quality,
        bool_or(ei.stance IN ('supports','opposes','mixed')) AS directional_existing_stance,
        EXISTS (
          SELECT 1
            FROM source_document_texts sdt
           WHERE sdt.source_document_id=sd.id
             AND sdt.extraction_version=$2
        ) AS has_text_snapshot,
        EXISTS (
          SELECT 1
            FROM evidence_quality_annotations eqa
           WHERE eqa.source_document_id=sd.id
             AND eqa.schema_version=$3
        ) AS has_annotation
      FROM source_documents sd
      JOIN evidence_items ei ON ei.source_document_id=sd.id
      LEFT JOIN legislative_sessions ls ON ls.id=sd.session_id
      WHERE sd.source_kind = ANY($1::text[])
      GROUP BY sd.id,sd.source_kind,ls.slug
    ),
    prioritized AS (
      SELECT *,
        CASE
          WHEN has_member AND has_bill THEN 'P1_exact_member_bill'
          WHEN has_member AND direct_or_high THEN 'P2_member_strong'
          WHEN has_bill AND direct_or_high THEN 'P3_bill_strong'
          WHEN has_member OR has_bill THEN 'P4_linked_context'
          ELSE 'P5_generic_context'
        END AS priority_tier
      FROM document_features
    )
    SELECT
      priority_tier,
      source_kind,
      session_slug,
      count(*)::int AS source_documents,
      count(*) FILTER (WHERE has_text_snapshot)::int AS with_text_snapshot,
      count(*) FILTER (WHERE has_annotation)::int AS with_annotation,
      count(*) FILTER (WHERE has_member)::int AS member_linked,
      count(*) FILTER (WHERE has_bill)::int AS bill_linked,
      count(*) FILTER (WHERE has_member AND has_bill)::int AS exact_member_bill,
      count(*) FILTER (WHERE direct_or_high)::int AS direct_or_high,
      count(*) FILTER (WHERE member_primary_quality)::int AS member_primary_quality,
      count(*) FILTER (WHERE directional_existing_stance)::int AS directional_existing_stance
    FROM prioritized
    GROUP BY priority_tier,source_kind,session_slug
    ORDER BY
      CASE priority_tier
        WHEN 'P1_exact_member_bill' THEN 1
        WHEN 'P2_member_strong' THEN 2
        WHEN 'P3_bill_strong' THEN 3
        WHEN 'P4_linked_context' THEN 4
        ELSE 5
      END,
      source_documents DESC,
      source_kind,
      session_slug`, [
    [...EVIDENCE_QUALITY_SOURCE_KINDS],
    EVIDENCE_QUALITY_TEXT_VERSION,
    EVIDENCE_QUALITY_SCHEMA_VERSION,
  ]);

  const tiers = new Map<string, {
    sourceDocuments: number;
    withTextSnapshot: number;
    withAnnotation: number;
    memberLinked: number;
    billLinked: number;
    exactMemberBill: number;
    directOrHigh: number;
  }>();
  for (const row of result.rows) {
    const tier = tiers.get(row.priority_tier) ?? {
      sourceDocuments: 0,
      withTextSnapshot: 0,
      withAnnotation: 0,
      memberLinked: 0,
      billLinked: 0,
      exactMemberBill: 0,
      directOrHigh: 0,
    };
    tier.sourceDocuments += row.source_documents;
    tier.withTextSnapshot += row.with_text_snapshot;
    tier.withAnnotation += row.with_annotation;
    tier.memberLinked += row.member_linked;
    tier.billLinked += row.bill_linked;
    tier.exactMemberBill += row.exact_member_bill;
    tier.directOrHigh += row.direct_or_high;
    tiers.set(row.priority_tier, tier);
  }

  console.log(JSON.stringify({
    evidenceQualityPriorityAudit: {
      schemaVersion: EVIDENCE_QUALITY_SCHEMA_VERSION,
      textVersion: EVIDENCE_QUALITY_TEXT_VERSION,
      rule: {
        P1_exact_member_bill: 'document has deterministic member and bill linkage',
        P2_member_strong: 'member-linked plus direct/high relevance or direct/related statement',
        P3_bill_strong: 'bill-linked plus direct/high relevance or direct/related statement',
        P4_linked_context: 'member-linked or bill-linked context not meeting stronger tiers',
        P5_generic_context: 'no deterministic member or bill linkage',
      },
      byTier: Object.fromEntries(tiers),
      byTierSourceSession: result.rows,
      policy: {
        outcomeUse: 'none',
        readOnly: true,
        noLLMCalls: true,
        servingChanged: false,
        modelWeight: 0,
      },
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

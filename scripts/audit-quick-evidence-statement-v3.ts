import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { extractExplicitBillStatementsV3 } from '../src/evidence/bill-statement-extractor-v3.js';
import {
  compareQuickEvidenceToManual,
  mergeQuickEvidenceManualAnnotationsBySource,
  type QuickEvidenceManualAnnotation,
} from '../src/evidence/quick-evidence-v3-manual-reference.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const V2_VERSION = 'quick-evidence-statement-v2';
const TEXT_VERSION = 'evidence-quality-text-v1';
const MANUAL_PROVIDER = 'manual-openai';
const SCHEMA_VERSION = 'evidence-quality-v1';
let secrets: string[] = [];

type V2Row = {
  evidence_id: string;
  source_document_id: string;
  source_kind: string;
  source_url: string;
  fetched_at: string;
  normalized_text: string;
  membership_id: string;
  member_name: string;
  bill_id: string;
  bill_identifier: string;
  stance: string;
  published_at: string | null;
  source_subtype: string | null;
};

type AnnotationRow = {
  source_document_id: string;
  annotation: QuickEvidenceManualAnnotation;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1400);
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

function bump(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
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

  const v2 = await pool.query<V2Row>(`
    SELECT
      ei.id::text AS evidence_id,
      sd.id::text AS source_document_id,
      sd.source_kind,
      sd.source_url,
      sd.fetched_at::text,
      sdt.normalized_text,
      ei.membership_id::text,
      l.name AS member_name,
      ei.bill_id::text,
      b.identifier AS bill_identifier,
      ei.stance,
      ei.published_at::text,
      nullif(ei.metadata->>'sourceSubtype','') AS source_subtype
    FROM evidence_items ei
    JOIN source_documents sd ON sd.id=ei.source_document_id
    JOIN source_document_texts sdt
      ON sdt.source_document_id=sd.id
     AND sdt.extraction_version=$1
    JOIN memberships m ON m.id=ei.membership_id
    JOIN legislators l ON l.id=m.legislator_id
    JOIN bills b ON b.id=ei.bill_id
    WHERE ei.extraction_version=$2
      AND ei.stance IN ('supports','opposes')
    ORDER BY sd.id,ei.membership_id,ei.id`, [TEXT_VERSION, V2_VERSION]);

  const sourceIds = [...new Set(v2.rows.map((row) => row.source_document_id))];
  const annotations = sourceIds.length === 0
    ? { rows: [] as AnnotationRow[] }
    : await pool.query<AnnotationRow>(`
        SELECT source_document_id::text,annotation
        FROM evidence_quality_annotations
        WHERE source_document_id = ANY($1::uuid[])
          AND schema_version=$2
          AND classifier_provider=$3
          AND content_mode='verified_full_text'`, [sourceIds, SCHEMA_VERSION, MANUAL_PROVIDER]);
  const manualBySource = mergeQuickEvidenceManualAnnotationsBySource(
    annotations.rows.map((row) => ({
      sourceDocumentId: row.source_document_id,
      annotation: row.annotation,
    })),
  );

  const groups = new Map<string, V2Row[]>();
  for (const row of v2.rows) {
    const key = [row.source_document_id, row.membership_id, row.source_subtype ?? '(missing)'].join('|');
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const summary = {
    exactTextSourceDocuments: sourceIds.length,
    sourceMembershipGroups: groups.size,
    v2DirectionalRows: v2.rows.length,
    v3DirectionalRows: 0,
    v2SameStanceRetained: 0,
    v2DroppedByV3: 0,
    v2FlippedByV3: 0,
    groupsSkippedInvalidSourceSubtype: 0,
    v2Manual: { agree: 0, opposite: 0, no_match: 0, unreviewed: 0 } as Record<string, number>,
    v3Manual: { agree: 0, opposite: 0, no_match: 0, unreviewed: 0 } as Record<string, number>,
  };

  const details: Array<Record<string, unknown>> = [];

  for (const rows of groups.values()) {
    const first = rows[0];
    const sourceSubtype = first.source_subtype;
    if (sourceSubtype !== 'member_primary_article' && sourceSubtype !== 'campaign_site_page') {
      summary.groupsSkippedInvalidSourceSubtype += 1;
      continue;
    }

    const bills = [...new Map(rows.map((row) => [
      row.bill_id,
      { id: row.bill_id, identifier: row.bill_identifier },
    ])).values()];

    const v3 = extractExplicitBillStatementsV3({
      membershipId: first.membership_id,
      memberName: first.member_name,
      text: first.normalized_text,
      publishedAt: rows.map((row) => row.published_at).filter((value): value is string => Boolean(value)).sort()[0],
      fetchedAt: first.fetched_at,
      bills,
      sourceSubtype,
    });

    summary.v3DirectionalRows += v3.length;
    const v3ByBill = new Map(v3.map((row) => [row.target?.billId ?? '', row]));

    for (const row of rows) {
      const manual = compareQuickEvidenceToManual(
        manualBySource.get(row.source_document_id),
        row.member_name,
        row.bill_identifier,
        row.stance,
      );
      bump(summary.v2Manual, manual);

      const candidate = v3ByBill.get(row.bill_id);
      if (!candidate) {
        summary.v2DroppedByV3 += 1;
      } else if (candidate.stance === row.stance) {
        summary.v2SameStanceRetained += 1;
      } else {
        summary.v2FlippedByV3 += 1;
      }
    }

    for (const row of v3) {
      const bill = bills.find((candidate) => candidate.id === row.target?.billId);
      if (!bill) continue;
      const manual = compareQuickEvidenceToManual(
        manualBySource.get(first.source_document_id),
        first.member_name,
        bill.identifier,
        row.stance ?? '',
      );
      bump(summary.v3Manual, manual);
    }

    details.push({
      sourceDocumentId: first.source_document_id,
      sourceKind: first.source_kind,
      membershipId: first.membership_id,
      memberName: first.member_name,
      sourceSubtype,
      manualAnnotationAvailable: manualBySource.has(first.source_document_id),
      v2: rows.map((row) => ({
        evidenceId: row.evidence_id,
        billIdentifier: row.bill_identifier,
        stance: row.stance,
        manualComparison: compareQuickEvidenceToManual(
          manualBySource.get(row.source_document_id),
          row.member_name,
          row.bill_identifier,
          row.stance,
        ),
      })),
      v3: v3.map((row) => {
        const bill = bills.find((candidate) => candidate.id === row.target?.billId);
        return {
          billIdentifier: bill?.identifier ?? null,
          stance: row.stance,
          manualComparison: bill
            ? compareQuickEvidenceToManual(manualBySource.get(first.source_document_id), first.member_name, bill.identifier, row.stance ?? '')
            : 'no_match',
          excerpt: row.excerpt,
        };
      }),
    });
  }

  const artifact = {
    auditVersion: 'quick-evidence-statement-v3-comparison-v1',
    generatedAt: new Date().toISOString(),
    sourceTextVersion: TEXT_VERSION,
    v2Version: V2_VERSION,
    v3Version: 'quick-evidence-statement-v3',
    summary,
    details,
    policy: {
      readOnly: true,
      outcomeUse: 'none',
      v3EvaluationOnly: true,
      productionExtractorChanged: false,
      evidenceRowsChanged: false,
      modelOrServingChanged: false,
      manualAnnotationsAreAuditReferenceNotAutomaticGroundTruth: true,
    },
  };

  const output = resolve(process.env.VOTEPREDICT_QUICK_EVIDENCE_V3_AUDIT_OUTPUT
    ?? 'artifacts/quick-evidence-statement-v3-comparison-v1.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    quickEvidenceStatementV3Comparison: {
      ...summary,
      output,
      readOnly: true,
      outcomeUse: 'none',
      productionExtractorChanged: false,
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

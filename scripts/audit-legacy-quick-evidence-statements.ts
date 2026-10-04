import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const LEGACY_VERSION = 'quick-evidence-statement-v2';
const MANUAL_PROVIDER = 'manual-openai';
const SCHEMA_VERSION = 'evidence-quality-v1';
let secrets: string[] = [];

type LegacyRow = {
  evidence_id: string;
  source_document_id: string;
  source_kind: string;
  session_slug: string;
  stance: string | null;
  claim: string;
  excerpt: string | null;
  evidence_kind: string;
  relevance: string;
  member_name: string | null;
  bill_identifier: string | null;
};

type AnnotationRow = {
  source_document_id: string;
  annotation: {
    claims?: Array<{
      memberNames?: string[];
      billIdentifiers?: string[];
      stance?: string;
      normalizedClaim?: string;
      claimType?: string;
    }>;
  };
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

function normBill(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.toUpperCase().replace(/\s+/g, '');
}

function bump(target: Record<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() || '(none)';
  target[normalized] = (target[normalized] ?? 0) + 1;
}

function opposite(a: string, b: string) {
  return (a === 'supports' && b === 'opposes') || (a === 'opposes' && b === 'supports');
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

  const legacy = await pool.query<LegacyRow>(`
    SELECT
      ei.id::text AS evidence_id,
      ei.source_document_id::text,
      sd.source_kind,
      coalesce(ls.slug,'unscoped') AS session_slug,
      ei.stance,
      ei.claim,
      ei.excerpt,
      ei.evidence_kind,
      ei.relevance,
      l.name AS member_name,
      b.identifier AS bill_identifier
    FROM evidence_items ei
    JOIN source_documents sd ON sd.id=ei.source_document_id
    LEFT JOIN legislative_sessions ls ON ls.id=sd.session_id
    LEFT JOIN memberships m ON m.id=ei.membership_id
    LEFT JOIN legislators l ON l.id=m.legislator_id
    LEFT JOIN bills b ON b.id=ei.bill_id
    WHERE ei.extraction_version=$1
    ORDER BY sd.source_kind,sd.id,ei.id`, [LEGACY_VERSION]);

  const sourceIds = [...new Set(legacy.rows.map((row) => row.source_document_id))];
  const annotations = sourceIds.length === 0
    ? { rows: [] as AnnotationRow[] }
    : await pool.query<AnnotationRow>(`
        SELECT source_document_id::text,annotation
        FROM evidence_quality_annotations
        WHERE source_document_id = ANY($1::uuid[])
          AND schema_version=$2
          AND classifier_provider=$3
          AND content_mode='verified_full_text'`, [sourceIds, SCHEMA_VERSION, MANUAL_PROVIDER]);

  const annotationBySource = new Map(annotations.rows.map((row) => [row.source_document_id, row.annotation]));

  const summary = {
    extractionVersion: LEGACY_VERSION,
    totalRows: legacy.rows.length,
    sourceDocuments: sourceIds.length,
    directionalRows: 0,
    supportsRows: 0,
    opposesRows: 0,
    mixedRows: 0,
    nonDirectionalRows: 0,
    manualCoveredRows: 0,
    manualCoveredSourceDocuments: new Set<string>(),
    directionalAgreeRows: 0,
    directionalOppositeRows: 0,
    directionalNoMatchingManualClaimRows: 0,
    manualCoveredNonDirectionalLegacyRows: 0,
    unreviewedDirectionalRows: 0,
    bySourceKind: {} as Record<string, number>,
    bySession: {} as Record<string, number>,
    byStance: {} as Record<string, number>,
  };

  const oppositeConflicts: Array<Record<string, unknown>> = [];
  const noMatch: Array<Record<string, unknown>> = [];

  for (const row of legacy.rows) {
    bump(summary.bySourceKind, row.source_kind);
    bump(summary.bySession, row.session_slug);
    bump(summary.byStance, row.stance);

    const directional = row.stance === 'supports' || row.stance === 'opposes' || row.stance === 'mixed';
    if (directional) {
      summary.directionalRows += 1;
      if (row.stance === 'supports') summary.supportsRows += 1;
      if (row.stance === 'opposes') summary.opposesRows += 1;
      if (row.stance === 'mixed') summary.mixedRows += 1;
    } else {
      summary.nonDirectionalRows += 1;
    }

    const annotation = annotationBySource.get(row.source_document_id);
    if (!annotation) {
      if (directional) summary.unreviewedDirectionalRows += 1;
      continue;
    }

    summary.manualCoveredRows += 1;
    summary.manualCoveredSourceDocuments.add(row.source_document_id);

    if (!directional) {
      summary.manualCoveredNonDirectionalLegacyRows += 1;
      continue;
    }

    const bill = normBill(row.bill_identifier);
    const claims = (annotation.claims ?? []).filter((claim) =>
      claim.stance === 'supports' || claim.stance === 'opposes' || claim.stance === 'mixed');

    const matching = claims.filter((claim) => {
      const members = new Set((claim.memberNames ?? []).map((value) => value.trim()));
      const bills = new Set((claim.billIdentifiers ?? []).map((value) => normBill(value)).filter(Boolean));
      const memberMatches = members.size === 0 || (row.member_name ? members.has(row.member_name) : false);
      const billMatches = bills.size === 0 || (bill ? bills.has(bill) : false);
      return memberMatches && billMatches;
    });

    if (matching.some((claim) => claim.stance === row.stance || claim.stance === 'mixed')) {
      summary.directionalAgreeRows += 1;
      continue;
    }

    if (matching.some((claim) => opposite(claim.stance ?? '', row.stance ?? ''))) {
      summary.directionalOppositeRows += 1;
      oppositeConflicts.push({
        evidenceId: row.evidence_id,
        sourceDocumentId: row.source_document_id,
        sourceKind: row.source_kind,
        sessionSlug: row.session_slug,
        memberName: row.member_name,
        billIdentifier: row.bill_identifier,
        legacyStance: row.stance,
        legacyClaim: row.claim,
        evidenceKind: row.evidence_kind,
        relevance: row.relevance,
        manualClaims: matching.map((claim) => ({
          stance: claim.stance,
          claimType: claim.claimType,
          normalizedClaim: claim.normalizedClaim,
        })),
      });
      continue;
    }

    summary.directionalNoMatchingManualClaimRows += 1;
    noMatch.push({
      evidenceId: row.evidence_id,
      sourceDocumentId: row.source_document_id,
      sourceKind: row.source_kind,
      sessionSlug: row.session_slug,
      memberName: row.member_name,
      billIdentifier: row.bill_identifier,
      legacyStance: row.stance,
      legacyClaim: row.claim,
      evidenceKind: row.evidence_kind,
      relevance: row.relevance,
      manualDirectionalClaims: claims.map((claim) => ({
        memberNames: claim.memberNames,
        billIdentifiers: claim.billIdentifiers,
        stance: claim.stance,
        claimType: claim.claimType,
        normalizedClaim: claim.normalizedClaim,
      })),
    });
  }

  const manualCoveredSourceDocuments = summary.manualCoveredSourceDocuments.size;
  const serializableSummary = {
    ...summary,
    manualCoveredSourceDocuments,
  };
  delete (serializableSummary as { manualCoveredSourceDocuments?: unknown }).manualCoveredSourceDocuments;

  const artifact = {
    auditVersion: 'legacy-quick-evidence-statement-audit-v1',
    generatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    manualProvider: MANUAL_PROVIDER,
    summary: {
      ...summary,
      manualCoveredSourceDocuments,
    },
    oppositeConflicts,
    noMatchingManualClaim: noMatch,
    policy: {
      readOnly: true,
      outcomeUse: 'none',
      manualAnnotationsTreatedAsAuditReferenceNotAutomaticGroundTruth: true,
      servingChanged: false,
      modelWeightChanged: false,
    },
  };

  const output = resolve(process.env.VOTEPREDICT_LEGACY_STATEMENT_AUDIT_OUTPUT
    ?? 'artifacts/legacy-quick-evidence-statement-audit-v1.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, (_key, value) => value instanceof Set ? [...value] : value, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    legacyQuickEvidenceStatementAudit: {
      extractionVersion: LEGACY_VERSION,
      totalRows: legacy.rows.length,
      sourceDocuments: sourceIds.length,
      directionalRows: summary.directionalRows,
      manualCoveredRows: summary.manualCoveredRows,
      manualCoveredSourceDocuments,
      directionalAgreeRows: summary.directionalAgreeRows,
      directionalOppositeRows: summary.directionalOppositeRows,
      directionalNoMatchingManualClaimRows: summary.directionalNoMatchingManualClaimRows,
      unreviewedDirectionalRows: summary.unreviewedDirectionalRows,
      output,
      readOnly: true,
    },
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

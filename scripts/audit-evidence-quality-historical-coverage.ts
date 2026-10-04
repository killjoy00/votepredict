import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
} from '../src/evidence/evidence-quality.js';
import {
  claimHistoricalAvailability,
  sourceDocumentAvailabilityDate,
  type EvidenceQualityAvailabilityContext,
} from '../src/evidence/evidence-quality-historical-availability.js';

const EXPECTED_DOCUMENTS = 226;
const EXPECTED_UNIQUE_SIGNATURES = 180;
const MANUAL_PROVIDER = 'manual-openai';
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

type AnnotationRow = {
  source_document_id: string;
  source_kind: string;
  source_url: string;
  source_content_sha256: string;
  source_metadata: Record<string, unknown> | null;
  annotation: {
    claims: Array<{
      memberNames: string[];
      billIdentifiers: string[];
      linkage: string;
      claimType: string;
      stance: string;
      specificity: string;
      explicitness: string;
      normalizedClaim: string;
      supportingExcerpt: string;
      extractionConfidence: number;
    }>;
  };
  annotation_metadata: Record<string, unknown> | null;
  outcome_blind: boolean;
  context_only: boolean;
  mechanically_actionable: boolean;
  model_weight: number;
};

type ContextRow = {
  evidence_id: string;
  source_document_id: string;
  membership_id: string | null;
  bill_id: string | null;
  member_name: string | null;
  bill_identifier: string | null;
  excerpt: string | null;
  evidence_metadata: Record<string, unknown> | null;
};

type TargetRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

type Signal = {
  fingerprint: string;
  membershipId: string;
  billId: string;
  memberName: string;
  billIdentifier: string;
  sourceKind: string;
  sourceDocumentIds: Set<string>;
  availableDates: Set<string>;
  availabilityMethods: Set<string>;
  availabilityEvidenceItemIds: Set<string>;
  stances: Set<string>;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2400);
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

function stringMeta(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeBill(value: string) {
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

function validDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function earliest(values: Set<string>): string | null {
  return [...values].filter(validDateOnly).sort()[0] ?? null;
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const outputPath = process.env.VOTEPREDICT_EQ_COVERAGE_AUDIT_OUTPUT;
  if (!envFile || !targetPath || !outputPath) throw new Error('Production env, target universe, and output path are required');

  const targets = readFileSync(targetPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as TargetRow);
  const targetByPair = new Map<string, TargetRow[]>();
  for (const row of targets) {
    const key = row.membershipId + '|' + row.billId;
    const values = targetByPair.get(key) ?? [];
    values.push(row);
    targetByPair.set(key, values);
  }

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const annotations = await client.query<AnnotationRow>(`
      SELECT eqa.source_document_id::text,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256 AS source_content_sha256,
             sd.metadata AS source_metadata,
             eqa.annotation,
             eqa.metadata AS annotation_metadata,
             eqa.outcome_blind,
             eqa.context_only,
             eqa.mechanically_actionable,
             eqa.model_weight
        FROM evidence_quality_annotations eqa
        JOIN source_documents sd ON sd.id=eqa.source_document_id
       WHERE eqa.schema_version=$1
         AND eqa.prompt_version=$2
         AND eqa.classifier_provider=$3
         AND eqa.content_mode='verified_full_text'
       ORDER BY eqa.source_document_id`, [
      EVIDENCE_QUALITY_SCHEMA_VERSION,
      EVIDENCE_QUALITY_PROMPT_VERSION,
      MANUAL_PROVIDER,
    ]);

    if (annotations.rows.length !== EXPECTED_DOCUMENTS) throw new Error('Manual annotation document count mismatch');

    const fingerprints = new Set<string>();
    const sourceIds: string[] = [];
    for (const row of annotations.rows) {
      if (!row.outcome_blind || !row.context_only || row.mechanically_actionable || Number(row.model_weight) !== 0) {
        throw new Error('Policy invariant failed for ' + row.source_document_id);
      }
      const fingerprint = stringMeta(row.annotation_metadata, 'semanticFingerprint');
      if (!fingerprint) throw new Error('Missing semantic fingerprint');
      fingerprints.add(fingerprint);
      sourceIds.push(row.source_document_id);
    }
    if (fingerprints.size !== EXPECTED_UNIQUE_SIGNATURES) throw new Error('Semantic signature count mismatch');

    const contexts = await client.query<ContextRow>(`
      SELECT ei.id::text AS evidence_id,
             ei.source_document_id::text,
             ei.membership_id::text,
             ei.bill_id::text,
             l.name AS member_name,
             b.identifier AS bill_identifier,
             ei.excerpt,
             ei.metadata AS evidence_metadata
        FROM evidence_items ei
        LEFT JOIN memberships m ON m.id=ei.membership_id
        LEFT JOIN legislators l ON l.id=m.legislator_id
        LEFT JOIN bills b ON b.id=ei.bill_id
       WHERE ei.source_document_id = ANY($1::uuid[])
       ORDER BY ei.source_document_id,ei.created_at,ei.id`, [sourceIds]);

    const contextsBySource = new Map<string, ContextRow[]>();
    for (const row of contexts.rows) {
      const values = contextsBySource.get(row.source_document_id) ?? [];
      values.push(row);
      contextsBySource.set(row.source_document_id, values);
    }

    const exactSignals = new Map<string, Signal>();
    const unmappedExactClaims: Array<Record<string, unknown>> = [];
    let exactDirectionalClaims = 0;

    for (const row of annotations.rows) {
      const fingerprint = stringMeta(row.annotation_metadata, 'semanticFingerprint')!;
      const sourceAvailableOn = sourceDocumentAvailabilityDate(row.source_metadata);
      const contexts = contextsBySource.get(row.source_document_id) ?? [];
      const availabilityContexts: EvidenceQualityAvailabilityContext[] = contexts.map((context) => ({
        evidenceItemId: context.evidence_id,
        membershipId: context.membership_id,
        billId: context.bill_id,
        excerpt: context.excerpt,
        metadata: context.evidence_metadata,
      }));
      for (const claim of row.annotation.claims) {
        if (!['supports','opposes','mixed'].includes(claim.stance)) continue;
        if (claim.memberNames.length === 0 || claim.billIdentifiers.length === 0) continue;
        exactDirectionalClaims += 1;
        const memberNames = new Set(claim.memberNames.map(normalizeName));
        const billIdentifiers = new Set(claim.billIdentifiers.map(normalizeBill));
        const matches = contexts.filter((context) =>
          Boolean(context.membership_id && context.bill_id && context.member_name && context.bill_identifier)
          && memberNames.has(normalizeName(context.member_name!))
          && billIdentifiers.has(normalizeBill(context.bill_identifier!)));

        const pairs = new Map<string, ContextRow[]>();
        for (const match of matches) {
          const pairKey = match.membership_id + '|' + match.bill_id;
          const values = pairs.get(pairKey) ?? [];
          values.push(match);
          pairs.set(pairKey, values);
        }
        if (pairs.size === 0) {
          unmappedExactClaims.push({
            sourceDocumentId: row.source_document_id,
            sourceKind: row.source_kind,
            availableOn: sourceAvailableOn,
            memberNames: claim.memberNames,
            billIdentifiers: claim.billIdentifiers,
            linkage: claim.linkage,
            claimType: claim.claimType,
            stance: claim.stance,
            specificity: claim.specificity,
            explicitness: claim.explicitness,
            normalizedClaim: claim.normalizedClaim,
            extractionConfidence: claim.extractionConfidence,
          });
          continue;
        }

        for (const pairMatches of pairs.values()) {
          const match = pairMatches[0];
          const availability = claimHistoricalAvailability({
            sourceMetadata: row.source_metadata,
            sourceUrl: row.source_url,
            sourceContentSha256: row.source_content_sha256,
            contexts: availabilityContexts,
            supportingExcerpt: claim.supportingExcerpt,
            membershipId: match.membership_id!,
            billId: match.bill_id!,
          });
          const key = fingerprint + '|' + match.membership_id + '|' + match.bill_id;
          const signal = exactSignals.get(key) ?? {
            fingerprint,
            membershipId: match.membership_id!,
            billId: match.bill_id!,
            memberName: match.member_name!,
            billIdentifier: match.bill_identifier!,
            sourceKind: row.source_kind,
            sourceDocumentIds: new Set<string>(),
            availableDates: new Set<string>(),
            availabilityMethods: new Set<string>(),
            availabilityEvidenceItemIds: new Set<string>(),
            stances: new Set<string>(),
          };
          signal.sourceDocumentIds.add(row.source_document_id);
          if (availability.availableOn) signal.availableDates.add(availability.availableOn);
          if (availability.method !== 'none') signal.availabilityMethods.add(availability.method);
          for (const evidenceItemId of availability.evidenceItemIds) {
            signal.availabilityEvidenceItemIds.add(evidenceItemId);
          }
          signal.stances.add(claim.stance);
          exactSignals.set(key, signal);
        }
      }
    }

    const dispositionCounts: Record<string, number> = {};
    const dispositionBySourceKind: Record<string, Record<string, number>> = {};
    const details: Record<string, Array<Record<string, unknown>>> = {
      pre_event_usable: [],
      same_day_only: [],
      post_event_only: [],
      no_target_event: [],
      missing_availability: [],
    };
    let usableTargetRows = 0;
    const usableTargetEvents = new Set<string>();
    const usableMemberships = new Set<string>();

    for (const signal of exactSignals.values()) {
      const availableOn = earliest(signal.availableDates);
      const targetRows = targetByPair.get(signal.membershipId + '|' + signal.billId) ?? [];
      let disposition: keyof typeof details;
      let preRows: TargetRow[] = [];
      let sameRows: TargetRow[] = [];
      let postRows: TargetRow[] = [];

      if (!availableOn) {
        disposition = 'missing_availability';
      } else if (targetRows.length === 0) {
        disposition = 'no_target_event';
      } else {
        preRows = targetRows.filter((row) => availableOn < row.occurredOn);
        sameRows = targetRows.filter((row) => availableOn === row.occurredOn);
        postRows = targetRows.filter((row) => availableOn > row.occurredOn);
        if (preRows.length > 0) disposition = 'pre_event_usable';
        else if (sameRows.length > 0) disposition = 'same_day_only';
        else disposition = 'post_event_only';
      }

      increment(dispositionCounts, disposition);
      const byKind = dispositionBySourceKind[disposition] ?? {};
      increment(byKind, signal.sourceKind);
      dispositionBySourceKind[disposition] = byKind;

      if (disposition === 'pre_event_usable') {
        usableTargetRows += preRows.length;
        usableMemberships.add(signal.membershipId);
        for (const row of preRows) usableTargetEvents.add(row.voteEventId);
      }

      details[disposition].push({
        fingerprint: signal.fingerprint,
        memberName: signal.memberName,
        membershipId: signal.membershipId,
        billIdentifier: signal.billIdentifier,
        billId: signal.billId,
        sourceKind: signal.sourceKind,
        sourceDocumentIds: [...signal.sourceDocumentIds].sort(),
        availableOn,
        availabilityMethods: [...signal.availabilityMethods].sort(),
        availabilityEvidenceItemIds: [...signal.availabilityEvidenceItemIds].sort(),
        stances: [...signal.stances].sort(),
        targetEvents: targetRows.map((row) => ({
          voteEventId: row.voteEventId,
          session: row.session,
          chamber: row.chamber,
          occurredOn: row.occurredOn,
          identifier: row.identifier,
        })),
        preEventRows: preRows.length,
        sameDayRows: sameRows.length,
        postEventRows: postRows.length,
      });
    }

    for (const values of Object.values(details)) {
      values.sort((a, b) => String(a.memberName).localeCompare(String(b.memberName))
        || String(a.billIdentifier).localeCompare(String(b.billIdentifier))
        || String(a.availableOn ?? '').localeCompare(String(b.availableOn ?? '')));
    }
    unmappedExactClaims.sort((a,b) => String(a.sourceKind).localeCompare(String(b.sourceKind))
      || String(a.sourceDocumentId).localeCompare(String(b.sourceDocumentId)));

    const unmappedBySourceKind: Record<string, number> = {};
    for (const row of unmappedExactClaims) increment(unmappedBySourceKind, String(row.sourceKind));

    const audit = {
      schemaVersion: 'evidence-quality-historical-coverage-audit-v1',
      generatedAt: new Date().toISOString(),
      issue: 579,
      targetUniverse: {
        rows: targets.length,
        events: new Set(targets.map((row) => row.voteEventId)).size,
        memberships: new Set(targets.map((row) => row.membershipId)).size,
      },
      corpus: {
        documents: annotations.rows.length,
        uniqueSemanticSignatures: fingerprints.size,
        exactDirectionalClaims,
        exactClaimsWithoutDeterministicMapping: unmappedExactClaims.length,
        exactMappedSemanticSignals: exactSignals.size,
      },
      mappedSignalDisposition: {
        counts: dispositionCounts,
        bySourceKind: dispositionBySourceKind,
        usableTargetRows,
        usableTargetEvents: usableTargetEvents.size,
        usableMemberships: usableMemberships.size,
      },
      unmappedClaims: {
        bySourceKind: unmappedBySourceKind,
        rows: unmappedExactClaims,
      },
      signalDetails: details,
      recommendationGate: {
        modelFittingReady: false,
        reason: 'Coverage audit only. Model fitting requires an explicit later decision after reviewing pre-event coverage by train/validation session.',
      },
      policy: {
        outcomeUse: 'none',
        targetUniverseOutcomeFieldsPresent: false,
        legacyQuickEvidenceV2Included: false,
        quickEvidenceV3Included: false,
        p2BillInferencePerformed: false,
        availabilityInputs: ['source_documents.metadata', 'evidence_items.metadata'],
        granularAvailabilityScope: 'claim must map to the exact member/bill evidence item and its supporting excerpt must occur in the proven evidence-item excerpt',
        servingChanged: false,
      },
    };

    writeFileSync(resolve(outputPath), JSON.stringify(audit, null, 2) + '\n');
    console.log(JSON.stringify({
      evidenceQualityHistoricalCoverageAudit: {
        exactDirectionalClaims,
        exactClaimsWithoutDeterministicMapping: unmappedExactClaims.length,
        exactMappedSemanticSignals: exactSignals.size,
        dispositionCounts,
        usableTargetRows,
        usableTargetEvents: usableTargetEvents.size,
        usableMemberships: usableMemberships.size,
        outcomeUse: 'none',
        servingChanged: false,
      },
    }, null, 2));

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
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
import {
  EVIDENCE_QUALITY_HISTORICAL_FEATURES,
  evidenceQualityFeaturesAsOf,
  type EvidenceQualityExactSignal,
} from '../src/evaluation/evidence-quality-historical-features.js';

const EXPECTED_DOCUMENTS = 226;
const EXPECTED_UNIQUE_SIGNATURES = 180;
const EXPECTED_ROWS = 135457;
const EXPECTED_EVENTS = 1339;
const EXPECTED_MEMBERSHIPS = 611;
const EXPECTED_ROW_KEY_SHA256 = '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const MANUAL_PROVIDER = 'manual-openai';
const MATRIX_SCHEMA = 'evidence-quality-historical-feature-matrix-v1.2';
const SIGNAL_SCHEMA = 'evidence-quality-historical-exact-signals-v1.2';
const ISSUE_SCHEMA = 'evidence-quality-historical-member-issue-signals-v1.2';
const PLAN_PATH = 'data/evaluation/evidence-quality/evidence-quality-historical-feature-plan-v1.2.json';
const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

type AnnotationRow = {
  annotation_id: string;
  source_document_id: string;
  source_document_text_id: string;
  source_kind: string;
  source_url: string;
  source_content_sha256: string;
  source_session_id: string | null;
  source_chamber_id: string | null;
  source_metadata: Record<string, unknown> | null;
  normalized_text: string;
  extraction_version: string;
  extraction_confidence: number;
  outcome_blind: boolean;
  context_only: boolean;
  mechanically_actionable: boolean;
  model_weight: number;
  annotation: {
    document: {
      topics: string[];
      centrality: string;
      legislativeRelevance: string;
    };
    claims: Array<{
      memberNames: string[];
      billIdentifiers: string[];
      linkage: string;
      claimType: string;
      stance: string;
      specificity: string;
      explicitness: string;
      attributionType: string;
      attributedActor: string | null;
      normalizedClaim: string;
      supportingExcerpt: string;
      extractionConfidence: number;
    }>;
  };
  annotation_metadata: Record<string, unknown> | null;
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

type MembershipIdentityRow = {
  membership_id: string;
  session_id: string;
  chamber_id: string;
  member_name: string;
  member_external_key: string;
};

type BillIdentityRow = {
  bill_id: string;
  session_id: string;
  identifier: string;
};

type TargetRow = {
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  eventStatus: string;
};

type ExactAccumulator = {
  fingerprint: string;
  membershipId: string;
  billId: string;
  sourceDocumentIds: Set<string>;
  availableDates: Set<string>;
  availabilityMethods: Set<string>;
  availabilityEvidenceItemIds: Set<string>;
  supports: boolean;
  opposes: boolean;
  mixed: boolean;
  directQuoteSupport: boolean;
  directQuoteOppose: boolean;
  explicitSupport: boolean;
  explicitOppose: boolean;
  supportConfidence: number;
  opposeConfidence: number;
  mixedConfidence: number;
  claimTypes: Set<string>;
  explicitness: Set<string>;
  mappingMethods: Set<string>;
};

type IssueAccumulator = {
  fingerprint: string;
  membershipId: string;
  sourceDocumentIds: Set<string>;
  availableDates: Set<string>;
  availabilityMethods: Set<string>;
  availabilityEvidenceItemIds: Set<string>;
  stances: Set<string>;
  claimTypes: Set<string>;
  topics: Set<string>;
  maxConfidence: number;
  mappingMethods: Set<string>;
};

function mask(value: string) {
  if (value.length > 3) console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 2000);
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

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
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

function uniqueValue(values: readonly string[]): string | null {
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

function resolveMembershipIdentity(input: {
  source: AnnotationRow;
  claimMemberNames: readonly string[];
  contexts: readonly ContextRow[];
  membershipsBySession: ReadonlyMap<string, readonly MembershipIdentityRow[]>;
}): { membershipId: string; method: string } | null {
  const normalizedNames = new Set(input.claimMemberNames.map(normalizeName));
  const direct = uniqueValue(input.contexts
    .filter((context) => context.membership_id && context.member_name && normalizedNames.has(normalizeName(context.member_name)))
    .map((context) => context.membership_id!));
  if (direct) return { membershipId: direct, method: 'evidence_item_membership' };

  if (input.claimMemberNames.length !== 1 || !input.source.source_session_id) return null;
  const targetName = normalizeName(input.claimMemberNames[0]);
  let candidates = [...(input.membershipsBySession.get(input.source.source_session_id) ?? [])];
  if (input.source.source_chamber_id) {
    candidates = candidates.filter((candidate) => candidate.chamber_id === input.source.source_chamber_id);
  }

  const externalKey = stringMeta(input.source.source_metadata, 'memberExternalKey');
  if (externalKey) {
    const byExternalKey = candidates.filter((candidate) =>
      candidate.member_external_key === externalKey && normalizeName(candidate.member_name) === targetName);
    if (byExternalKey.length === 1) {
      return { membershipId: byExternalKey[0].membership_id, method: 'source_member_external_key' };
    }
    if (byExternalKey.length > 1) return null;
  }

  const byName = candidates.filter((candidate) => normalizeName(candidate.member_name) === targetName);
  return byName.length === 1
    ? { membershipId: byName[0].membership_id, method: 'source_session_exact_member_name' }
    : null;
}

function resolveBillIdentity(input: {
  source: AnnotationRow;
  billIdentifier: string;
  contexts: readonly ContextRow[];
  billsBySession: ReadonlyMap<string, readonly BillIdentityRow[]>;
}): { billId: string; method: string } | null {
  const normalized = normalizeBill(input.billIdentifier);
  const direct = uniqueValue(input.contexts
    .filter((context) => context.bill_id && context.bill_identifier && normalizeBill(context.bill_identifier) === normalized)
    .map((context) => context.bill_id!));
  if (direct) return { billId: direct, method: 'evidence_item_bill' };

  if (!input.source.source_session_id) return null;
  const candidates = (input.billsBySession.get(input.source.source_session_id) ?? [])
    .filter((candidate) => normalizeBill(candidate.identifier) === normalized);
  return candidates.length === 1
    ? { billId: candidates[0].bill_id, method: 'source_session_exact_bill_identifier' }
    : null;
}

function validDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function loadTargets(path: string): TargetRow[] {
  const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as TargetRow & Record<string, unknown>);
  if (rows.length !== EXPECTED_ROWS) throw new Error('Target universe row count mismatch');
  if (rows.some((row) => 'outcome' in row || 'passed' in row || 'actualYes' in row || 'features' in row || 'baseProbability' in row)) {
    throw new Error('Target universe contains outcome/model fields');
  }
  const events = new Set(rows.map((row) => row.voteEventId));
  const memberships = new Set(rows.map((row) => row.membershipId));
  if (events.size !== EXPECTED_EVENTS || memberships.size !== EXPECTED_MEMBERSHIPS) {
    throw new Error('Target universe event/membership count mismatch');
  }
  const rowKeys = rows.map((row) => row.voteEventId + '|' + row.membershipId).sort();
  const digest = sha256(rowKeys.join('\n') + '\n');
  if (digest !== EXPECTED_ROW_KEY_SHA256) throw new Error('Target universe row-key digest mismatch');
  return rows;
}

function earliest(values: Set<string>): string | null {
  const dates = [...values].filter(validDateOnly).sort();
  return dates[0] ?? null;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  const targetPath = process.env.VOTEPREDICT_EQ_TARGET_UNIVERSE_PATH;
  const outputDir = process.env.VOTEPREDICT_EQ_MATRIX_OUTPUT_DIR;
  if (!envFile || !targetPath || !outputDir) throw new Error('Production env, target universe, and output directory are required');

  const plan = JSON.parse(readFileSync(resolve(PLAN_PATH), 'utf8')) as { schemaVersion: string; featureNames: string[] };
  if (plan.schemaVersion !== 'evidence-quality-historical-feature-plan-v1.2'
      || canonicalJson(plan.featureNames) !== canonicalJson([...EVIDENCE_QUALITY_HISTORICAL_FEATURES])) {
    throw new Error('Evidence Quality historical feature plan drifted');
  }

  const targets = loadTargets(targetPath);
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

    const annotationResult = await client.query<AnnotationRow>(`
      SELECT eqa.id::text AS annotation_id,
             eqa.source_document_id::text,
             eqa.source_document_text_id::text,
             sd.source_kind,
             sd.source_url,
             sd.content_sha256 AS source_content_sha256,
             sd.session_id::text AS source_session_id,
             sd.chamber_id::text AS source_chamber_id,
             sd.metadata AS source_metadata,
             sdt.normalized_text,
             sdt.extraction_version,
             eqa.extraction_confidence,
             eqa.outcome_blind,
             eqa.context_only,
             eqa.mechanically_actionable,
             eqa.model_weight,
             eqa.annotation,
             eqa.metadata AS annotation_metadata
        FROM evidence_quality_annotations eqa
        JOIN source_documents sd ON sd.id=eqa.source_document_id
        JOIN source_document_texts sdt ON sdt.id=eqa.source_document_text_id
       WHERE eqa.schema_version=$1
         AND eqa.prompt_version=$2
         AND eqa.classifier_provider=$3
         AND eqa.content_mode='verified_full_text'
       ORDER BY eqa.source_document_id`, [
      EVIDENCE_QUALITY_SCHEMA_VERSION,
      EVIDENCE_QUALITY_PROMPT_VERSION,
      MANUAL_PROVIDER,
    ]);

    if (annotationResult.rows.length !== EXPECTED_DOCUMENTS) {
      throw new Error(`Expected ${EXPECTED_DOCUMENTS} manual annotations, found ${annotationResult.rows.length}`);
    }
    const fingerprints = new Set<string>();
    const sourceIds: string[] = [];
    let sourcesMissingAvailability = 0;
    for (const row of annotationResult.rows) {
      if (!row.outcome_blind || !row.context_only || row.mechanically_actionable || Number(row.model_weight) !== 0) {
        throw new Error('Evidence Quality policy invariant failed for source ' + row.source_document_id);
      }
      if (row.extraction_version !== 'evidence-quality-text-v1') throw new Error('Source text version drift');
      const fingerprint = stringMeta(row.annotation_metadata, 'semanticFingerprint');
      if (!fingerprint || !/^[0-9a-f]{64}$/i.test(fingerprint)) throw new Error('Missing semantic fingerprint');
      fingerprints.add(fingerprint);
      sourceIds.push(row.source_document_id);
      if (!sourceDocumentAvailabilityDate(row.source_metadata)) sourcesMissingAvailability += 1;
    }
    if (fingerprints.size !== EXPECTED_UNIQUE_SIGNATURES) {
      throw new Error(`Expected ${EXPECTED_UNIQUE_SIGNATURES} semantic signatures, found ${fingerprints.size}`);
    }

    const contextResult = await client.query<ContextRow>(`
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
    for (const row of contextResult.rows) {
      const values = contextsBySource.get(row.source_document_id) ?? [];
      values.push(row);
      contextsBySource.set(row.source_document_id, values);
    }

    const sourceSessionIds = [...new Set(annotationResult.rows
      .map((row) => row.source_session_id)
      .filter((value): value is string => Boolean(value)))];

    const membershipIdentityResult = sourceSessionIds.length === 0
      ? { rows: [] as MembershipIdentityRow[] }
      : await client.query<MembershipIdentityRow>(`
          SELECT m.id::text AS membership_id,
                 m.session_id::text,
                 m.chamber_id::text,
                 l.name AS member_name,
                 l.external_key AS member_external_key
            FROM memberships m
            JOIN legislators l ON l.id=m.legislator_id
           WHERE m.session_id = ANY($1::uuid[])
           ORDER BY m.session_id,m.chamber_id,l.normalized_name,m.id`, [sourceSessionIds]);
    const membershipsBySession = new Map<string, MembershipIdentityRow[]>();
    for (const identity of membershipIdentityResult.rows) {
      const values = membershipsBySession.get(identity.session_id) ?? [];
      values.push(identity);
      membershipsBySession.set(identity.session_id, values);
    }

    const billIdentityResult = sourceSessionIds.length === 0
      ? { rows: [] as BillIdentityRow[] }
      : await client.query<BillIdentityRow>(`
          SELECT b.id::text AS bill_id,
                 b.session_id::text,
                 b.identifier
            FROM bills b
           WHERE b.session_id = ANY($1::uuid[])
           ORDER BY b.session_id,b.identifier,b.id`, [sourceSessionIds]);
    const billsBySession = new Map<string, BillIdentityRow[]>();
    for (const identity of billIdentityResult.rows) {
      const values = billsBySession.get(identity.session_id) ?? [];
      values.push(identity);
      billsBySession.set(identity.session_id, values);
    }

    const exact = new Map<string, ExactAccumulator>();
    const issues = new Map<string, IssueAccumulator>();
    let directionalClaims = 0;
    let exactDirectionalClaims = 0;
    let memberIssueDirectionalClaims = 0;
    let exactClaimsWithoutDeterministicMapping = 0;
    let memberIssueClaimsWithoutDeterministicMapping = 0;
    let exactClaimsUsingSourceSessionIdentityResolution = 0;
    let memberIssueClaimsUsingSourceSessionIdentityResolution = 0;

    for (const row of annotationResult.rows) {
      const fingerprint = stringMeta(row.annotation_metadata, 'semanticFingerprint')!;
      const contexts = contextsBySource.get(row.source_document_id) ?? [];
      const availabilityContexts: EvidenceQualityAvailabilityContext[] = contexts.map((context) => ({
        evidenceItemId: context.evidence_id,
        membershipId: context.membership_id,
        billId: context.bill_id,
        excerpt: context.excerpt,
        metadata: context.evidence_metadata,
      }));

      for (const claim of row.annotation.claims) {
        if (!['supports', 'opposes', 'mixed'].includes(claim.stance)) continue;
        directionalClaims += 1;
        const memberNames = new Set(claim.memberNames.map(normalizeName));
        const billIdentifiers = new Set(claim.billIdentifiers.map(normalizeBill));

        if (memberNames.size > 0 && billIdentifiers.size > 0) {
          exactDirectionalClaims += 1;
          const membership = resolveMembershipIdentity({
            source: row,
            claimMemberNames: claim.memberNames,
            contexts,
            membershipsBySession,
          });
          const resolvedBills = claim.billIdentifiers.map((billIdentifier) => ({
            billIdentifier,
            resolution: resolveBillIdentity({ source: row, billIdentifier, contexts, billsBySession }),
          })).filter((entry): entry is { billIdentifier: string; resolution: { billId: string; method: string } } =>
            entry.resolution !== null);

          if (!membership || resolvedBills.length === 0) {
            exactClaimsWithoutDeterministicMapping += 1;
            continue;
          }

          const usesSourceSessionResolution = membership.method !== 'evidence_item_membership'
            || resolvedBills.some((entry) => entry.resolution.method !== 'evidence_item_bill');
          if (usesSourceSessionResolution) exactClaimsUsingSourceSessionIdentityResolution += 1;

          for (const entry of resolvedBills) {
            const key = fingerprint + '|' + membership.membershipId + '|' + entry.resolution.billId;
            const acc = exact.get(key) ?? {
              fingerprint,
              membershipId: membership.membershipId,
              billId: entry.resolution.billId,
              sourceDocumentIds: new Set<string>(),
              availableDates: new Set<string>(),
              availabilityMethods: new Set<string>(),
              availabilityEvidenceItemIds: new Set<string>(),
              supports: false,
              opposes: false,
              mixed: false,
              directQuoteSupport: false,
              directQuoteOppose: false,
              explicitSupport: false,
              explicitOppose: false,
              supportConfidence: 0,
              opposeConfidence: 0,
              mixedConfidence: 0,
              claimTypes: new Set<string>(),
              explicitness: new Set<string>(),
              mappingMethods: new Set<string>(),
            };
            acc.sourceDocumentIds.add(row.source_document_id);
            const availability = claimHistoricalAvailability({
              sourceMetadata: row.source_metadata,
              sourceUrl: row.source_url,
              sourceContentSha256: row.source_content_sha256,
              contexts: availabilityContexts,
              supportingExcerpt: claim.supportingExcerpt,
              membershipId: membership.membershipId,
              billId: entry.resolution.billId,
            });
            if (availability.availableOn) acc.availableDates.add(availability.availableOn);
            if (availability.method !== 'none') acc.availabilityMethods.add(availability.method);
            for (const evidenceItemId of availability.evidenceItemIds) acc.availabilityEvidenceItemIds.add(evidenceItemId);
            acc.claimTypes.add(claim.claimType);
            acc.explicitness.add(claim.explicitness);
            acc.mappingMethods.add(membership.method);
            acc.mappingMethods.add(entry.resolution.method);
            const confidence = Number(claim.extractionConfidence);
            if (claim.stance === 'supports') {
              acc.supports = true;
              acc.supportConfidence = Math.max(acc.supportConfidence, confidence);
              if (claim.explicitness === 'direct_quote') acc.directQuoteSupport = true;
              else acc.explicitSupport = true;
            } else if (claim.stance === 'opposes') {
              acc.opposes = true;
              acc.opposeConfidence = Math.max(acc.opposeConfidence, confidence);
              if (claim.explicitness === 'direct_quote') acc.directQuoteOppose = true;
              else acc.explicitOppose = true;
            } else {
              acc.mixed = true;
              acc.mixedConfidence = Math.max(acc.mixedConfidence, confidence);
            }
            exact.set(key, acc);
          }
        } else if (claim.linkage === 'member_issue' && memberNames.size > 0 && billIdentifiers.size === 0) {
          memberIssueDirectionalClaims += 1;
          const membership = resolveMembershipIdentity({
            source: row,
            claimMemberNames: claim.memberNames,
            contexts,
            membershipsBySession,
          });
          if (!membership) {
            memberIssueClaimsWithoutDeterministicMapping += 1;
            continue;
          }
          if (membership.method !== 'evidence_item_membership') {
            memberIssueClaimsUsingSourceSessionIdentityResolution += 1;
          }
          const key = fingerprint + '|' + membership.membershipId;
          const acc = issues.get(key) ?? {
            fingerprint,
            membershipId: membership.membershipId,
            sourceDocumentIds: new Set<string>(),
            availableDates: new Set<string>(),
            availabilityMethods: new Set<string>(),
            availabilityEvidenceItemIds: new Set<string>(),
            stances: new Set<string>(),
            claimTypes: new Set<string>(),
            topics: new Set<string>(),
            maxConfidence: 0,
            mappingMethods: new Set<string>(),
          };
          acc.sourceDocumentIds.add(row.source_document_id);
          const availability = claimHistoricalAvailability({
            sourceMetadata: row.source_metadata,
            sourceUrl: row.source_url,
            sourceContentSha256: row.source_content_sha256,
            contexts: availabilityContexts,
            supportingExcerpt: claim.supportingExcerpt,
            membershipId: membership.membershipId,
            billId: null,
          });
          if (availability.availableOn) acc.availableDates.add(availability.availableOn);
          if (availability.method !== 'none') acc.availabilityMethods.add(availability.method);
          for (const evidenceItemId of availability.evidenceItemIds) acc.availabilityEvidenceItemIds.add(evidenceItemId);
          acc.stances.add(claim.stance);
          acc.claimTypes.add(claim.claimType);
          acc.mappingMethods.add(membership.method);
          for (const topic of row.annotation.document.topics ?? []) if (topic.trim()) acc.topics.add(topic.trim());
          acc.maxConfidence = Math.max(acc.maxConfidence, Number(claim.extractionConfidence));
          issues.set(key, acc);
        }
      }
    }

    const exactSignals = [...exact.values()].map((acc) => ({
      schemaVersion: SIGNAL_SCHEMA,
      fingerprint: acc.fingerprint,
      membershipId: acc.membershipId,
      billId: acc.billId,
      availableOn: earliest(acc.availableDates),
      availabilityEligible: earliest(acc.availableDates) !== null,
      supports: acc.supports,
      opposes: acc.opposes,
      mixed: acc.mixed,
      directQuoteSupport: acc.directQuoteSupport,
      directQuoteOppose: acc.directQuoteOppose,
      explicitSupport: acc.explicitSupport,
      explicitOppose: acc.explicitOppose,
      supportConfidence: acc.supportConfidence,
      opposeConfidence: acc.opposeConfidence,
      mixedConfidence: acc.mixedConfidence,
      claimTypes: [...acc.claimTypes].sort(),
      explicitness: [...acc.explicitness].sort(),
      mappingMethods: [...acc.mappingMethods].sort(),
      availabilityMethods: [...acc.availabilityMethods].sort(),
      availabilityEvidenceItemIds: [...acc.availabilityEvidenceItemIds].sort(),
      sourceDocumentIds: [...acc.sourceDocumentIds].sort(),
    })).sort((a, b) =>
      a.membershipId.localeCompare(b.membershipId)
      || a.billId.localeCompare(b.billId)
      || a.fingerprint.localeCompare(b.fingerprint));

    const issueSignals = [...issues.values()].map((acc) => ({
      schemaVersion: ISSUE_SCHEMA,
      fingerprint: acc.fingerprint,
      membershipId: acc.membershipId,
      availableOn: earliest(acc.availableDates),
      availabilityEligible: earliest(acc.availableDates) !== null,
      stances: [...acc.stances].sort(),
      claimTypes: [...acc.claimTypes].sort(),
      topics: [...acc.topics].sort(),
      maxConfidence: acc.maxConfidence,
      mappingMethods: [...acc.mappingMethods].sort(),
      availabilityMethods: [...acc.availabilityMethods].sort(),
      availabilityEvidenceItemIds: [...acc.availabilityEvidenceItemIds].sort(),
      sourceDocumentIds: [...acc.sourceDocumentIds].sort(),
      billInference: 'none',
    })).sort((a, b) => a.membershipId.localeCompare(b.membershipId) || a.fingerprint.localeCompare(b.fingerprint));

    const exactByTarget = new Map<string, EvidenceQualityExactSignal[]>();
    for (const signal of exactSignals) {
      const key = signal.membershipId + '|' + signal.billId;
      const values = exactByTarget.get(key) ?? [];
      values.push(signal);
      exactByTarget.set(key, values);
    }

    let nonzeroRows = 0;
    const nonzeroMemberships = new Set<string>();
    const nonzeroEvents = new Set<string>();
    const bySession = new Map<string, { rows: number; nonzeroRows: number }>();
    const matrixLines: string[] = [];
    for (const row of targets) {
      const signals = exactByTarget.get(row.membershipId + '|' + row.billId) ?? [];
      const features = evidenceQualityFeaturesAsOf(signals, row.occurredOn);
      if (features[0] > 0) {
        nonzeroRows += 1;
        nonzeroMemberships.add(row.membershipId);
        nonzeroEvents.add(row.voteEventId);
      }
      const sessionStats = bySession.get(row.session) ?? { rows: 0, nonzeroRows: 0 };
      sessionStats.rows += 1;
      if (features[0] > 0) sessionStats.nonzeroRows += 1;
      bySession.set(row.session, sessionStats);
      matrixLines.push(JSON.stringify({
        schemaVersion: MATRIX_SCHEMA,
        voteEventId: row.voteEventId,
        membershipId: row.membershipId,
        legislatorId: row.legislatorId,
        session: row.session,
        chamber: row.chamber,
        occurredOn: row.occurredOn,
        billId: row.billId,
        identifier: row.identifier,
        eventStatus: row.eventStatus,
        features,
      }));
    }

    mkdirSync(outputDir, { recursive: true });
    const matrixText = matrixLines.join('\n') + '\n';
    const exactText = exactSignals.map((row) => JSON.stringify(row)).join('\n') + '\n';
    const issueText = issueSignals.map((row) => JSON.stringify(row)).join('\n') + '\n';
    const matrixGzip = gzipSync(Buffer.from(matrixText), { level: 9 });
    const exactGzip = gzipSync(Buffer.from(exactText), { level: 9 });
    const issueGzip = gzipSync(Buffer.from(issueText), { level: 9 });

    const matrixPath = resolve(outputDir, 'evidence-quality-historical-feature-matrix-v1.2.ndjson.gz');
    const exactPath = resolve(outputDir, 'evidence-quality-historical-exact-signals-v1.2.ndjson.gz');
    const issuePath = resolve(outputDir, 'evidence-quality-historical-member-issue-signals-v1.2.ndjson.gz');
    writeFileSync(matrixPath, matrixGzip);
    writeFileSync(exactPath, exactGzip);
    writeFileSync(issuePath, issueGzip);

    const manifest = {
      schemaVersion: 'evidence-quality-historical-feature-matrix-v1.2-manifest',
      generatedAt: new Date().toISOString(),
      issue: 579,
      plan: PLAN_PATH,
      annotationCorpus: {
        documents: annotationResult.rows.length,
        uniqueSemanticSignatures: fingerprints.size,
        sourcesMissingHistoricalAvailability: sourcesMissingAvailability,
        sourcesMissingSourceWideAvailability: sourcesMissingAvailability,
        directionalClaims,
        exactDirectionalClaims,
        memberIssueDirectionalClaims,
        exactClaimsWithoutDeterministicMapping,
        memberIssueClaimsWithoutDeterministicMapping,
        exactClaimsUsingSourceSessionIdentityResolution,
        memberIssueClaimsUsingSourceSessionIdentityResolution,
      },
      targetUniverse: {
        rows: targets.length,
        events: new Set(targets.map((row) => row.voteEventId)).size,
        memberships: new Set(targets.map((row) => row.membershipId)).size,
        rowKeySha256: EXPECTED_ROW_KEY_SHA256,
        sourceArtifactId: 11252079484,
        sourceArtifactDigest: 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
        sourceMatrixCanonicalNdjsonSha256: 'c97ac50c8c89ae0548cc48bed65a42c22f332e2977b33173619c9e258c09a4d0',
      },
      features: {
        names: [...EVIDENCE_QUALITY_HISTORICAL_FEATURES],
        count: EVIDENCE_QUALITY_HISTORICAL_FEATURES.length,
        matrixRows: targets.length,
        nonzeroRows,
        membershipsWithExactDirectionalEvidence: nonzeroMemberships.size,
        eventsWithExactDirectionalEvidence: nonzeroEvents.size,
        bySession: Object.fromEntries([...bySession.entries()].sort(([a], [b]) => a.localeCompare(b))),
      },
      signals: {
        exactBillSemanticSignals: exactSignals.length,
        exactBillSignalsWithHistoricalAvailability: exactSignals.filter((row) => row.availabilityEligible).length,
        memberIssueSemanticSignals: issueSignals.length,
        memberIssueSignalsWithHistoricalAvailability: issueSignals.filter((row) => row.availabilityEligible).length,
        p2BillInferencePerformed: false,
      },
      digests: {
        matrixCanonicalNdjsonSha256: sha256(matrixText),
        matrixGzipSha256: sha256(matrixGzip),
        exactSignalsCanonicalNdjsonSha256: sha256(exactText),
        exactSignalsGzipSha256: sha256(exactGzip),
        memberIssueSignalsCanonicalNdjsonSha256: sha256(issueText),
        memberIssueSignalsGzipSha256: sha256(issueGzip),
      },
      policy: {
        readOnly: true,
        outcomeUseDuringFeatureConstruction: 'none',
        strictPreEventAvailability: true,
        sameDayEvidenceExcluded: true,
        availabilitySource: 'source_documents.metadata source-wide proof OR claim-scoped evidence_items.metadata exact-excerpt proof',
        granularAvailabilityRequirements: 'exact source URL/hash + evidence_item_excerpt scope + exact_frozen_excerpt_match + deterministic member/bill identity + supporting excerpt contained in proven evidence excerpt',
        semanticDeduplication: 'semanticFingerprint + deterministic membership/bill identity',
        identityResolution: 'prefer evidence_items IDs; otherwise resolve only the already-reviewed claim member/bill identifiers by unique exact match within source session/chamber; ambiguity fails closed',
        memberIssueBillInference: 'none',
        legacyQuickEvidenceV2Included: false,
        quickEvidenceV3Included: false,
        modelFitting: 'none',
        servingChanged: false,
        modelWeightChanged: false,
      },
    };
    const manifestPath = resolve(outputDir, 'evidence-quality-historical-feature-matrix-v1.2-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    console.log(JSON.stringify({
      evidenceQualityHistoricalFeatureFreeze: {
        documents: manifest.annotationCorpus.documents,
        uniqueSemanticSignatures: manifest.annotationCorpus.uniqueSemanticSignatures,
        exactBillSemanticSignals: manifest.signals.exactBillSemanticSignals,
        memberIssueSemanticSignals: manifest.signals.memberIssueSemanticSignals,
        matrixRows: manifest.features.matrixRows,
        nonzeroRows: manifest.features.nonzeroRows,
        membershipsWithExactDirectionalEvidence: manifest.features.membershipsWithExactDirectionalEvidence,
        eventsWithExactDirectionalEvidence: manifest.features.eventsWithExactDirectionalEvidence,
        sourcesMissingHistoricalAvailability: manifest.annotationCorpus.sourcesMissingHistoricalAvailability,
        exactClaimsWithoutDeterministicMapping: manifest.annotationCorpus.exactClaimsWithoutDeterministicMapping,
        memberIssueClaimsWithoutDeterministicMapping: manifest.annotationCorpus.memberIssueClaimsWithoutDeterministicMapping,
        exactClaimsUsingSourceSessionIdentityResolution: manifest.annotationCorpus.exactClaimsUsingSourceSessionIdentityResolution,
        memberIssueClaimsUsingSourceSessionIdentityResolution: manifest.annotationCorpus.memberIssueClaimsUsingSourceSessionIdentityResolution,
        outcomeUse: 'none',
        modelFitting: 'none',
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

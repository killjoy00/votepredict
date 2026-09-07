import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  evidenceItems,
  evidenceRelationships,
  forecastRevisionEvidence,
  researchRuns,
  researchRunTargets,
} from '../lib/db/feature-evidence-schema';
import type { EvidenceDiagnostics } from './diagnostics';
import type { DeepResearchTarget, EvidenceDraft } from './types';

function requiredDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date/time`);
  return date;
}

export async function createResearchRun(input: {
  forecastId: string;
  baseRevisionId?: string;
  provider: string;
  providerVersion?: string;
  asOf: string;
  targetLimit: number;
  configuration?: Record<string, unknown>;
}): Promise<string> {
  const rows = await db.insert(researchRuns).values({
    forecastId: input.forecastId,
    baseRevisionId: input.baseRevisionId ?? null,
    provider: input.provider,
    providerVersion: input.providerVersion ?? null,
    status: 'running',
    asOf: requiredDate(input.asOf, 'asOf'),
    targetLimit: input.targetLimit,
    configuration: input.configuration ?? {},
  }).returning({ id: researchRuns.id });
  if (!rows[0]) throw new Error('Failed to create research run');
  return rows[0].id;
}

export async function persistResearchTargets(researchRunId: string, targets: readonly DeepResearchTarget[]): Promise<void> {
  if (targets.length === 0) return;
  await db.insert(researchRunTargets).values(targets.map((target) => ({
    researchRunId,
    membershipId: target.membershipId,
    targetRank: target.rank,
    pivotality: target.pivotality,
    uncertainty: target.uncertainty,
    evidenceGap: target.evidenceGap,
    priorityScore: target.priorityScore,
    rationale: target.rationale,
  })));
}

export async function persistEvidenceItem(sourceDocumentId: string, draft: EvidenceDraft): Promise<string> {
  if (!sourceDocumentId) throw new Error('sourceDocumentId is required for every persisted evidence item');
  const rows = await db.insert(evidenceItems).values({
    sourceDocumentId,
    billId: draft.targetBillId ?? null,
    membershipId: draft.targetMembershipId ?? null,
    evidenceKind: draft.kind,
    stance: draft.stance,
    claim: draft.claim,
    excerpt: draft.excerpt ?? null,
    publishedAt: draft.publishedAt ? requiredDate(draft.publishedAt, 'publishedAt') : null,
    sourceQuality: draft.sourceQuality,
    relevance: draft.relevance,
    freshness: draft.freshness,
    extractionMethod: String(draft.metadata?.researchProvider ?? 'manual'),
    extractionVersion: typeof draft.metadata?.researchProviderVersion === 'string' ? draft.metadata.researchProviderVersion : null,
    confidence: draft.confidence ?? null,
    metadata: draft.metadata ?? {},
  }).returning({ id: evidenceItems.id });
  if (!rows[0]) throw new Error('Failed to persist evidence item');
  return rows[0].id;
}

export async function persistEvidenceDiagnostics(evidenceIds: readonly string[], diagnostics: EvidenceDiagnostics): Promise<void> {
  const rows = diagnostics.relationships.map((relationship) => ({
    fromEvidenceId: evidenceIds[relationship.fromIndex],
    toEvidenceId: evidenceIds[relationship.toIndex],
    relationKind: relationship.kind,
    reason: relationship.reason,
  })).filter((row): row is { fromEvidenceId: string; toEvidenceId: string; relationKind: 'contradicts' | 'duplicates'; reason: string } => Boolean(row.fromEvidenceId && row.toEvidenceId));
  if (rows.length === 0) return;
  await db.insert(evidenceRelationships).values(rows);
}

export async function linkEvidenceToRevision(input: {
  revisionId: string;
  evidenceItemId: string;
  membershipId?: string;
  disposition: 'included' | 'excluded' | 'superseded';
  rationale: string;
  probabilityBefore?: number;
  probabilityAfter?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(forecastRevisionEvidence).values({
    revisionId: input.revisionId,
    evidenceItemId: input.evidenceItemId,
    membershipId: input.membershipId ?? null,
    disposition: input.disposition,
    rationale: input.rationale,
    probabilityBefore: input.probabilityBefore ?? null,
    probabilityAfter: input.probabilityAfter ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function completeResearchRun(researchRunId: string, resultRevisionId?: string): Promise<void> {
  await db.update(researchRuns).set({
    status: 'completed',
    resultRevisionId: resultRevisionId ?? null,
    finishedAt: new Date(),
    errorSummary: null,
  }).where(eq(researchRuns.id, researchRunId));
}

export async function failResearchRun(researchRunId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.update(researchRuns).set({
    status: 'failed',
    finishedAt: new Date(),
    errorSummary: message.slice(0, 2000),
  }).where(eq(researchRuns.id, researchRunId));
}

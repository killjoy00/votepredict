import { createHash } from 'node:crypto';
import {
  EVIDENCE_QUALITY_PROMPT_VERSION,
  EVIDENCE_QUALITY_SCHEMA_VERSION,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
  type EvidenceQualityClaim,
  type EvidenceQualityLinkage,
  type EvidenceQualityAttributionType,
} from './evidence-quality.js';

export const SESSION_DAILY_REVIEW_PROVIDER = 'manual-openai' as const;
export const SESSION_DAILY_REVIEW_MODEL = 'GPT-5.6 Sol' as const;
export const SESSION_DAILY_REVIEW_CONTENT_MODE = 'excerpt_only' as const;

export type SessionDailySemanticReviewRow = {
  row: number;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  reviewTextSha256: string;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  frozenReviewText?: string;
  reviewText?: string;
  decision: string;
  memberNames: string[];
  billIdentifiers: string[];
  stance: EvidenceQualityClaim['stance'];
  claimType: EvidenceQualityClaim['claimType'];
  specificity: EvidenceQualityClaim['specificity'];
  normalizedClaim: string;
  supportingExcerpt: string;
  notes: string[];
};

export type SessionDailySemanticReviewFile = {
  batchId: string;
  schemaVersion: string;
  evidenceQualitySchemaVersion?: string;
  evidenceQualityPromptVersion?: string;
  promptVersion?: string;
  provider: string;
  model: string;
  summary: Record<string, unknown>;
  policy: Record<string, unknown>;
  reviews: SessionDailySemanticReviewRow[];
};

function normalizedMembers(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function normalizedBills(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function sessionDailySemanticReviewText(row: SessionDailySemanticReviewRow): string {
  const text = row.frozenReviewText ?? row.reviewText;
  if (!text?.trim()) throw new Error('Session Daily review row lacks frozen review text: ' + row.row);
  return text;
}

function linkage(row: SessionDailySemanticReviewRow): EvidenceQualityLinkage {
  if (row.memberNames.length > 0 && row.billIdentifiers.length > 0) return 'exact_member_bill';
  if (row.memberNames.length > 0 && row.decision === 'member_issue_directional') return 'member_issue';
  if (row.memberNames.length > 0) return 'member_only';
  if (row.billIdentifiers.length > 0) return 'bill_only';
  return 'generic_legislative';
}

function attributionType(row: SessionDailySemanticReviewRow): EvidenceQualityAttributionType {
  if (
    row.memberNames.length > 0
    && ['explicit_position', 'quoted_position'].includes(row.claimType)
  ) return 'target_member';
  if (row.decision === 'third_party_bill_directional_not_member_stance') return 'other';
  if (['sponsorship', 'procedural_action', 'background'].includes(row.claimType)) return 'official_record';
  return 'unclear';
}

function explicitness(row: SessionDailySemanticReviewRow): EvidenceQualityClaim['explicitness'] {
  if (row.claimType === 'quoted_position') return 'direct_quote';
  if (row.claimType === 'explicit_position') return 'attributed_paraphrase';
  if (row.supportingExcerpt.includes('“') || row.supportingExcerpt.includes('"')) return 'direct_quote';
  return 'attributed_paraphrase';
}

function extractionConfidence(row: SessionDailySemanticReviewRow): number {
  return row.decision.includes('human_check') ? 0.5 : 1;
}

export function sessionDailyReviewAnnotation(
  row: SessionDailySemanticReviewRow,
): EvidenceQualityAnnotation {
  const text = sessionDailySemanticReviewText(row);
  const confidence = extractionConfidence(row);
  const attribution = attributionType(row);
  const claim: EvidenceQualityClaim = {
    memberNames: normalizedMembers(row.memberNames),
    billIdentifiers: normalizedBills(row.billIdentifiers),
    linkage: linkage(row),
    claimType: row.claimType,
    stance: row.stance,
    specificity: row.specificity,
    explicitness: explicitness(row),
    attributionType: attribution,
    attributedActor: attribution === 'target_member' && row.memberNames.length === 1
      ? row.memberNames[0]
      : null,
    normalizedClaim: row.normalizedClaim.trim(),
    supportingExcerpt: row.supportingExcerpt.trim(),
    extractionConfidence: confidence,
  };

  const directional = ['supports', 'opposes', 'mixed'].includes(row.stance);
  const annotation: EvidenceQualityAnnotation = {
    document: {
      legislativeRelevance: 'high',
      centrality: directional ? 'substantial' : 'incidental',
      contentType: 'official_reporting',
      novelty: 'unknown',
      corroboration: 'unknown',
      topics: [],
      documentConfidence: confidence,
    },
    claims: [claim],
    notes: [
      ...row.notes.map((value) => value.trim()).filter(Boolean),
      'Imported from frozen archive-verified Session Daily semantic review row ' + row.row + '.',
      row.decision.includes('human_check')
        ? 'Human adjudication remained recommended in the frozen review; this row remains non-directional.'
        : 'Extraction confidence reflects frozen review status only and is not a vote probability.',
    ],
  };

  validateEvidenceQualityAnnotation(annotation, {
    sourceKind: 'house_session_daily',
    sourceUrl: row.sourceUrl,
    contentMode: SESSION_DAILY_REVIEW_CONTENT_MODE,
    text,
    candidateMemberNames: normalizedMembers(row.candidateMemberNames),
    candidateBillIdentifiers: normalizedBills(row.candidateBillIdentifiers),
  });
  return annotation;
}

export function sessionDailyReviewSemanticFingerprint(
  row: SessionDailySemanticReviewRow,
  annotation: EvidenceQualityAnnotation,
): string {
  const claims = annotation.claims.map((claim) => ({
    memberNames: normalizedMembers(claim.memberNames),
    billIdentifiers: normalizedBills(claim.billIdentifiers),
    linkage: claim.linkage,
    claimType: claim.claimType,
    stance: claim.stance,
    specificity: claim.specificity,
    explicitness: claim.explicitness,
    attributionType: claim.attributionType,
    attributedActor: claim.attributedActor?.trim() ?? null,
    normalizedClaim: normalizeText(claim.normalizedClaim),
    supportingExcerpt: normalizeText(claim.supportingExcerpt),
  }));
  const signature = {
    sourceKind: row.sourceKind,
    candidateMemberNames: normalizedMembers(row.candidateMemberNames),
    candidateBillIdentifiers: normalizedBills(row.candidateBillIdentifiers),
    claims,
  };
  return createHash('sha256').update(JSON.stringify(signature)).digest('hex');
}

export function validateSessionDailyReviewFile(file: SessionDailySemanticReviewFile): void {
  const evidenceSchema = file.evidenceQualitySchemaVersion ?? EVIDENCE_QUALITY_SCHEMA_VERSION;
  const promptVersion = file.evidenceQualityPromptVersion ?? file.promptVersion ?? EVIDENCE_QUALITY_PROMPT_VERSION;
  if (evidenceSchema !== EVIDENCE_QUALITY_SCHEMA_VERSION) {
    throw new Error(file.batchId + ': Evidence Quality schema mismatch');
  }
  if (promptVersion !== EVIDENCE_QUALITY_PROMPT_VERSION) {
    throw new Error(file.batchId + ': Evidence Quality prompt mismatch');
  }
  if (file.provider !== 'OpenAI' || file.model !== SESSION_DAILY_REVIEW_MODEL) {
    throw new Error(file.batchId + ': review provider/model mismatch');
  }
  if (file.policy.outcomeBlind !== true || file.policy.contextOnly !== true) {
    throw new Error(file.batchId + ': review policy is not outcome-blind/context-only');
  }
  if (file.policy.mechanicallyActionable !== false || Number(file.policy.modelWeight) !== 0) {
    throw new Error(file.batchId + ': review policy mechanical/model-weight invariant failed');
  }
  if (file.policy.servingChanged !== false) {
    throw new Error(file.batchId + ': review policy serving invariant failed');
  }

  const sourceIds = new Set<string>();
  for (const row of file.reviews) {
    if (sourceIds.has(row.sourceDocumentId)) {
      throw new Error(file.batchId + ': duplicate source document ' + row.sourceDocumentId);
    }
    sourceIds.add(row.sourceDocumentId);
    if (row.sourceKind !== 'house_session_daily') {
      throw new Error(file.batchId + ': unexpected source kind at row ' + row.row);
    }
    sessionDailyReviewAnnotation(row);
  }
}

import { createHash } from 'node:crypto';
import {
  type EvidenceQualityAnnotation,
  type EvidenceQualityAttributionType,
  type EvidenceQualityClaimType,
  type EvidenceQualityExplicitness,
  type EvidenceQualityLinkage,
  type EvidenceQualitySpecificity,
  type EvidenceQualityStance,
} from './evidence-quality.js';

export const SESSION_DAILY_EXCERPT_REVIEW_IMPORT_VERSION = 'session-daily-excerpt-evidence-quality-import-v1' as const;
export const SESSION_DAILY_EXCERPT_REVIEW_CONFIDENCE = 0.95;

export const SESSION_DAILY_HUMAN_CHECK_ROWS: Record<string, readonly number[]> = {
  'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-001-SEMANTIC-REVIEW': [8, 15, 20],
  'EQV1-SESSION-DAILY-ARCHIVE-VERIFIED-002-SEMANTIC-REVIEW': [],
};

export type SessionDailyReviewDecision =
  | 'exact_member_bill_directional'
  | 'member_issue_directional'
  | 'third_party_bill_directional_not_member_stance'
  | 'non_directional'
  | 'non_directional_human_check';

export type SessionDailyReviewRow = {
  row: number;
  sourceDocumentId: string;
  sourceUrl: string;
  sourceKind: 'house_session_daily';
  reviewTextSha256: string;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  frozenReviewText?: string;
  reviewText?: string;
  decision: SessionDailyReviewDecision;
  memberNames: string[];
  billIdentifiers: string[];
  stance: EvidenceQualityStance;
  claimType: EvidenceQualityClaimType;
  specificity: EvidenceQualitySpecificity;
  normalizedClaim: string;
  supportingExcerpt: string;
  notes: string[];
};

function normalized(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function sessionDailyReviewText(row: SessionDailyReviewRow): string {
  const text = row.frozenReviewText ?? row.reviewText ?? '';
  if (!text.trim()) throw new Error('Session Daily review row is missing frozen review text');
  return text;
}

export function sessionDailyReviewTextSha256(row: SessionDailyReviewRow): string {
  return createHash('sha256').update(sessionDailyReviewText(row)).digest('hex');
}

export function isSessionDailyHumanCheck(batchId: string, row: number): boolean {
  return (SESSION_DAILY_HUMAN_CHECK_ROWS[batchId] ?? []).includes(row);
}

export function sessionDailyReviewLinkage(row: SessionDailyReviewRow): EvidenceQualityLinkage {
  if (row.decision === 'member_issue_directional') return 'member_issue';
  if (row.decision === 'third_party_bill_directional_not_member_stance') return 'bill_only';
  if (row.decision === 'exact_member_bill_directional') return 'exact_member_bill';
  if (row.memberNames.length > 0 && row.billIdentifiers.length > 0) return 'exact_member_bill';
  if (row.memberNames.length > 0) return 'member_only';
  if (row.billIdentifiers.length > 0) return 'bill_only';
  return 'generic_legislative';
}

function explicitness(row: SessionDailyReviewRow): EvidenceQualityExplicitness {
  if (row.claimType === 'quoted_position') return 'direct_quote';
  if (row.claimType === 'explicit_position' || row.claimType === 'policy_discussion') return 'attributed_paraphrase';
  return 'none';
}

function attribution(row: SessionDailyReviewRow): {
  attributionType: EvidenceQualityAttributionType;
  attributedActor: string | null;
} {
  if (row.decision === 'third_party_bill_directional_not_member_stance') {
    return { attributionType: 'official_record', attributedActor: null };
  }
  if (['sponsorship', 'procedural_action', 'legislative_action', 'background'].includes(row.claimType)) {
    return { attributionType: 'official_record', attributedActor: null };
  }
  if (row.memberNames.length > 0) {
    return {
      attributionType: 'target_member',
      attributedActor: row.memberNames.length === 1 ? row.memberNames[0] : null,
    };
  }
  return { attributionType: 'official_record', attributedActor: null };
}

export function sessionDailyReviewToAnnotation(row: SessionDailyReviewRow): EvidenceQualityAnnotation {
  const { attributionType, attributedActor } = attribution(row);
  return {
    document: {
      legislativeRelevance: 'high',
      centrality: 'substantial',
      contentType: 'official_reporting',
      novelty: 'unknown',
      corroboration: 'unknown',
      topics: [],
      documentConfidence: SESSION_DAILY_EXCERPT_REVIEW_CONFIDENCE,
    },
    claims: [{
      memberNames: normalized(row.memberNames),
      billIdentifiers: normalized(row.billIdentifiers),
      linkage: sessionDailyReviewLinkage(row),
      claimType: row.claimType,
      stance: row.stance,
      specificity: row.specificity,
      explicitness: explicitness(row),
      attributionType,
      attributedActor,
      normalizedClaim: row.normalizedClaim.trim(),
      supportingExcerpt: row.supportingExcerpt.trim(),
      extractionConfidence: SESSION_DAILY_EXCERPT_REVIEW_CONFIDENCE,
    }],
    notes: [
      ...row.notes,
      'Imported from an archive-verified frozen Session Daily excerpt; this annotation does not claim verified full-text identity.',
    ],
  };
}

export function sessionDailyReviewSemanticFingerprint(row: SessionDailyReviewRow): string {
  const annotation = sessionDailyReviewToAnnotation(row);
  const signature = {
    sourceKind: row.sourceKind,
    candidateMemberNames: normalized(row.candidateMemberNames),
    candidateBillIdentifiers: normalized(row.candidateBillIdentifiers.map((value) => value.toUpperCase())),
    claim: {
      ...annotation.claims[0],
      memberNames: normalized(annotation.claims[0].memberNames),
      billIdentifiers: normalized(annotation.claims[0].billIdentifiers.map((value) => value.toUpperCase())),
      normalizedClaim: normalizeText(annotation.claims[0].normalizedClaim),
      supportingExcerpt: normalizeText(annotation.claims[0].supportingExcerpt),
    },
  };
  return createHash('sha256').update(JSON.stringify(signature)).digest('hex');
}

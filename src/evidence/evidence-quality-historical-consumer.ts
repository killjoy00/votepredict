import { SESSION_DAILY_EXCERPT_REVIEW_IMPORT_VERSION } from './evidence-quality-session-daily-review.js';

export const EVIDENCE_QUALITY_BASELINE_MANUAL_DOCUMENTS = 226 as const;
export const EVIDENCE_QUALITY_BASELINE_UNIQUE_SIGNATURES = 180 as const;
export const EVIDENCE_QUALITY_SESSION_DAILY_EXCERPT_DOCUMENTS = 34 as const;
export const EVIDENCE_QUALITY_SESSION_DAILY_EXCERPT_UNIQUE_SIGNATURES = 34 as const;
export const EVIDENCE_QUALITY_HISTORICAL_CONSUMER_DOCUMENTS =
  EVIDENCE_QUALITY_BASELINE_MANUAL_DOCUMENTS + EVIDENCE_QUALITY_SESSION_DAILY_EXCERPT_DOCUMENTS;

export type EvidenceQualityHistoricalAnnotationCohort =
  | 'baseline_verified_full_text'
  | 'session_daily_archive_verified_excerpt';

export type EvidenceQualityHistoricalAnnotationIdentity = {
  sourceKind: string;
  sourceDocumentTextId: string | null;
  classifierModel: string;
  contentMode: string;
  annotationMetadata: Record<string, unknown> | null;
};

function stringMeta(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanMeta(metadata: Record<string, unknown> | null, key: string): boolean | null {
  const value = metadata?.[key];
  return typeof value === 'boolean' ? value : null;
}

export function evidenceQualityHistoricalAnnotationCohort(
  input: EvidenceQualityHistoricalAnnotationIdentity,
): EvidenceQualityHistoricalAnnotationCohort | null {
  if (input.contentMode === 'verified_full_text') {
    return input.sourceDocumentTextId
      ? 'baseline_verified_full_text'
      : null;
  }

  if (input.contentMode !== 'excerpt_only') return null;
  if (input.sourceKind !== 'house_session_daily') return null;
  if (input.sourceDocumentTextId !== null) return null;
  if (input.classifierModel !== 'GPT-5.6 Sol') return null;

  const metadata = input.annotationMetadata;
  if (stringMeta(metadata, 'importVersion') !== SESSION_DAILY_EXCERPT_REVIEW_IMPORT_VERSION) return null;
  if (stringMeta(metadata, 'contentIdentityScope') !== 'archive_verified_frozen_excerpt') return null;
  if (stringMeta(metadata, 'historicalAvailabilityScope') !== 'evidence_item_excerpt') return null;
  if (booleanMeta(metadata, 'granularAvailabilityRequired') !== true) return null;
  if (booleanMeta(metadata, 'verifiedFullTextClaimed') !== false) return null;
  if (booleanMeta(metadata, 'humanAdjudicationRequired') !== false) return null;
  if (booleanMeta(metadata, 'noVoteOutcomeUse') !== true) return null;
  if (booleanMeta(metadata, 'manualAnnotation') !== true) return null;
  if (stringMeta(metadata, 'manualProviderReported') !== 'OpenAI') return null;

  return 'session_daily_archive_verified_excerpt';
}

export function evidenceQualityHistoricalCohortUsesSourceAvailability(
  cohort: EvidenceQualityHistoricalAnnotationCohort,
): boolean {
  return cohort === 'baseline_verified_full_text';
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_QUALITY_HISTORICAL_CONSUMER_DOCUMENTS,
  evidenceQualityHistoricalAnnotationCohort,
  evidenceQualityHistoricalCohortUsesSourceAvailability,
} from '../src/evidence/evidence-quality-historical-consumer.js';

function excerptMetadata(overrides: Record<string, unknown> = {}) {
  return {
    importVersion: 'session-daily-excerpt-evidence-quality-import-v1',
    contentIdentityScope: 'archive_verified_frozen_excerpt',
    historicalAvailabilityScope: 'evidence_item_excerpt',
    granularAvailabilityRequired: true,
    verifiedFullTextClaimed: false,
    humanAdjudicationRequired: false,
    noVoteOutcomeUse: true,
    manualAnnotation: true,
    manualProviderReported: 'OpenAI',
    ...overrides,
  };
}

test('historical consumer cohort count is frozen at 226 baseline plus 32 Session Daily excerpts', () => {
  assert.equal(EVIDENCE_QUALITY_HISTORICAL_CONSUMER_DOCUMENTS, 258);
});

test('verified full text remains eligible only with a source text identity', () => {
  assert.equal(evidenceQualityHistoricalAnnotationCohort({
    sourceKind: 'member_primary_article',
    sourceDocumentTextId: 'text-id',
    classifierModel: 'GPT-5.6 Sol',
    contentMode: 'verified_full_text',
    annotationMetadata: {},
  }), 'baseline_verified_full_text');

  assert.equal(evidenceQualityHistoricalAnnotationCohort({
    sourceKind: 'member_primary_article',
    sourceDocumentTextId: null,
    classifierModel: 'GPT-5.6 Sol',
    contentMode: 'verified_full_text',
    annotationMetadata: {},
  }), null);
});

test('only exact #661 Session Daily excerpt metadata is admitted', () => {
  assert.equal(evidenceQualityHistoricalAnnotationCohort({
    sourceKind: 'house_session_daily',
    sourceDocumentTextId: null,
    classifierModel: 'GPT-5.6 Sol',
    contentMode: 'excerpt_only',
    annotationMetadata: excerptMetadata(),
  }), 'session_daily_archive_verified_excerpt');

  for (const [key, value] of [
    ['importVersion', 'other-import'],
    ['contentIdentityScope', 'source_document'],
    ['historicalAvailabilityScope', 'source_document'],
    ['granularAvailabilityRequired', false],
    ['verifiedFullTextClaimed', true],
    ['humanAdjudicationRequired', true],
    ['noVoteOutcomeUse', false],
    ['manualAnnotation', false],
    ['manualProviderReported', 'Other'],
  ] as const) {
    assert.equal(evidenceQualityHistoricalAnnotationCohort({
      sourceKind: 'house_session_daily',
      sourceDocumentTextId: null,
      classifierModel: 'GPT-5.6 Sol',
      contentMode: 'excerpt_only',
      annotationMetadata: excerptMetadata({ [key]: value }),
    }), null, key);
  }
});

test('excerpt-only rows fail closed for wrong source, model, or source-text attachment', () => {
  assert.equal(evidenceQualityHistoricalAnnotationCohort({
    sourceKind: 'member_primary_article',
    sourceDocumentTextId: null,
    classifierModel: 'GPT-5.6 Sol',
    contentMode: 'excerpt_only',
    annotationMetadata: excerptMetadata(),
  }), null);
  assert.equal(evidenceQualityHistoricalAnnotationCohort({
    sourceKind: 'house_session_daily',
    sourceDocumentTextId: 'text-id',
    classifierModel: 'GPT-5.6 Sol',
    contentMode: 'excerpt_only',
    annotationMetadata: excerptMetadata(),
  }), null);
  assert.equal(evidenceQualityHistoricalAnnotationCohort({
    sourceKind: 'house_session_daily',
    sourceDocumentTextId: null,
    classifierModel: 'different-model',
    contentMode: 'excerpt_only',
    annotationMetadata: excerptMetadata(),
  }), null);
});

test('only baseline full text may use source-wide availability fallback', () => {
  assert.equal(evidenceQualityHistoricalCohortUsesSourceAvailability('baseline_verified_full_text'), true);
  assert.equal(evidenceQualityHistoricalCohortUsesSourceAvailability('session_daily_archive_verified_excerpt'), false);
});

import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { billVersions, bills, forecastRevisions, forecasts, memberships, sourceDocuments } from './schema';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const billFeatureSets = pgTable('bill_feature_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  billVersionId: uuid('bill_version_id').notNull().references(() => billVersions.id, { onDelete: 'cascade' }),
  featureSchemaVersion: text('feature_schema_version').notNull(),
  extractorKind: text('extractor_kind').notNull(),
  extractorVersion: text('extractor_version').notNull(),
  features: jsonb('features').notNull(),
  confidence: jsonb('confidence').notNull().default({}),
  provenance: jsonb('provenance').notNull().default({}),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('bill_feature_sets_version_extractor_uq').on(table.billVersionId, table.featureSchemaVersion, table.extractorKind, table.extractorVersion),
  index('bill_feature_sets_version_idx').on(table.billVersionId, table.generatedAt),
  index('bill_feature_sets_schema_idx').on(table.featureSchemaVersion, table.extractorKind, table.extractorVersion),
]);

export const evidenceItems = pgTable('evidence_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceDocumentId: uuid('source_document_id').notNull().references(() => sourceDocuments.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id').references(() => bills.id, { onDelete: 'cascade' }),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'cascade' }),
  evidenceKind: text('evidence_kind').notNull(),
  stance: text('stance'),
  claim: text('claim').notNull(),
  excerpt: text('excerpt'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  sourceQuality: text('source_quality').notNull(),
  relevance: text('relevance').notNull(),
  freshness: text('freshness').notNull(),
  extractionMethod: text('extraction_method').notNull(),
  extractionVersion: text('extraction_version'),
  confidence: doublePrecision('confidence'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (table) => [
  index('evidence_items_source_idx').on(table.sourceDocumentId, table.createdAt),
  index('evidence_items_bill_idx').on(table.billId, table.createdAt),
  index('evidence_items_membership_idx').on(table.membershipId, table.createdAt),
]);

export const evidenceRelationships = pgTable('evidence_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromEvidenceId: uuid('from_evidence_id').notNull().references(() => evidenceItems.id, { onDelete: 'cascade' }),
  toEvidenceId: uuid('to_evidence_id').notNull().references(() => evidenceItems.id, { onDelete: 'cascade' }),
  relationKind: text('relation_kind').notNull(),
  reason: text('reason'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('evidence_relationships_unique_uq').on(table.fromEvidenceId, table.toEvidenceId, table.relationKind),
]);

export const sourceDocumentTexts = pgTable('source_document_texts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceDocumentId: uuid('source_document_id').notNull().references(() => sourceDocuments.id, { onDelete: 'cascade' }),
  sourceContentSha256: text('source_content_sha256').notNull(),
  textSha256: text('text_sha256').notNull(),
  normalizedText: text('normalized_text').notNull(),
  extractionMethod: text('extraction_method').notNull(),
  extractionVersion: text('extraction_version').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('source_document_texts_source_version_uq').on(table.sourceDocumentId, table.extractionVersion),
  index('source_document_texts_hash_idx').on(table.textSha256),
]);

export const evidenceQualityAnnotations = pgTable('evidence_quality_annotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceDocumentId: uuid('source_document_id').notNull().references(() => sourceDocuments.id, { onDelete: 'cascade' }),
  sourceDocumentTextId: uuid('source_document_text_id').references(() => sourceDocumentTexts.id, { onDelete: 'set null' }),
  schemaVersion: text('schema_version').notNull(),
  promptVersion: text('prompt_version').notNull(),
  classifierProvider: text('classifier_provider').notNull(),
  classifierModel: text('classifier_model').notNull(),
  contentMode: text('content_mode').notNull(),
  annotation: jsonb('annotation').notNull(),
  extractionConfidence: doublePrecision('extraction_confidence').notNull(),
  outcomeBlind: boolean('outcome_blind').notNull().default(true),
  contextOnly: boolean('context_only').notNull().default(true),
  mechanicallyActionable: boolean('mechanically_actionable').notNull().default(false),
  modelWeight: doublePrecision('model_weight').notNull().default(0),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('evidence_quality_annotations_identity_uq').on(
    table.sourceDocumentId,
    table.schemaVersion,
    table.promptVersion,
    table.classifierProvider,
    table.classifierModel,
    table.contentMode,
  ),
  index('evidence_quality_annotations_source_idx').on(table.sourceDocumentId, table.createdAt),
  index('evidence_quality_annotations_schema_idx').on(table.schemaVersion, table.createdAt),
]);

export const researchRuns = pgTable('research_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastId: uuid('forecast_id').notNull().references(() => forecasts.id, { onDelete: 'cascade' }),
  baseRevisionId: uuid('base_revision_id').references(() => forecastRevisions.id, { onDelete: 'set null' }),
  resultRevisionId: uuid('result_revision_id').references(() => forecastRevisions.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  providerVersion: text('provider_version'),
  status: text('status').notNull(),
  asOf: timestamp('as_of', { withTimezone: true }).notNull(),
  targetLimit: integer('target_limit').notNull(),
  configuration: jsonb('configuration').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  errorSummary: text('error_summary'),
  createdAt: createdAt(),
}, (table) => [index('research_runs_forecast_idx').on(table.forecastId, table.createdAt)]);

export const researchRunTargets = pgTable('research_run_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  researchRunId: uuid('research_run_id').notNull().references(() => researchRuns.id, { onDelete: 'cascade' }),
  membershipId: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'cascade' }),
  targetRank: integer('target_rank').notNull(),
  pivotality: doublePrecision('pivotality').notNull(),
  uncertainty: doublePrecision('uncertainty').notNull(),
  evidenceGap: doublePrecision('evidence_gap').notNull(),
  priorityScore: doublePrecision('priority_score').notNull(),
  rationale: text('rationale').notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('research_run_targets_member_uq').on(table.researchRunId, table.membershipId),
  uniqueIndex('research_run_targets_rank_uq').on(table.researchRunId, table.targetRank),
]);

export const forecastRevisionEvidence = pgTable('forecast_revision_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  revisionId: uuid('revision_id').notNull().references(() => forecastRevisions.id, { onDelete: 'cascade' }),
  evidenceItemId: uuid('evidence_item_id').notNull().references(() => evidenceItems.id, { onDelete: 'cascade' }),
  membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'set null' }),
  disposition: text('disposition').notNull(),
  rationale: text('rationale').notNull(),
  probabilityBefore: doublePrecision('probability_before'),
  probabilityAfter: doublePrecision('probability_after'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('forecast_revision_evidence_uq').on(table.revisionId, table.evidenceItemId, table.membershipId),
  index('forecast_revision_evidence_revision_idx').on(table.revisionId, table.createdAt),
]);

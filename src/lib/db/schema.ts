import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const jurisdictions = pgTable('jurisdictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  createdAt: createdAt(),
});

export const legislativeSessions = pgTable('legislative_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdictions.id),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('legislative_sessions_jurisdiction_slug_uq').on(table.jurisdictionId, table.slug)]);

export const chambers = pgTable('chambers', {
  id: uuid('id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdictions.id),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('chambers_jurisdiction_slug_uq').on(table.jurisdictionId, table.slug)]);

export const legislators = pgTable('legislators', {
  id: uuid('id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdictions.id),
  externalKey: text('external_key').notNull(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('legislators_jurisdiction_external_uq').on(table.jurisdictionId, table.externalKey)]);

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => legislativeSessions.id),
  chamberId: uuid('chamber_id').notNull().references(() => chambers.id),
  legislatorId: uuid('legislator_id').notNull().references(() => legislators.id),
  district: text('district').notNull(),
  party: text('party').notNull(),
  title: text('title').notNull(),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  sourceUrl: text('source_url'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('memberships_session_chamber_legislator_uq').on(table.sessionId, table.chamberId, table.legislatorId),
  index('memberships_legislator_idx').on(table.legislatorId),
  index('memberships_session_chamber_idx').on(table.sessionId, table.chamberId),
]);

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => legislativeSessions.id),
  originatingChamberId: uuid('originating_chamber_id').references(() => chambers.id),
  identifier: text('identifier').notNull(),
  title: text('title').notNull(),
  status: text('status'),
  sourceUrl: text('source_url'),
  introducedAt: timestamp('introduced_at', { withTimezone: true }),
  latestActionAt: timestamp('latest_action_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('bills_session_identifier_uq').on(table.sessionId, table.identifier),
  index('bills_session_idx').on(table.sessionId),
]);

export const billVersions = pgTable('bill_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').notNull().references(() => bills.id),
  versionKey: text('version_key').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  textUrl: text('text_url'),
  textHash: text('text_hash'),
  rawText: text('raw_text'),
  sourceUrl: text('source_url'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('bill_versions_bill_key_uq').on(table.billId, table.versionKey),
  index('bill_versions_bill_published_idx').on(table.billId, table.publishedAt),
]);

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  rawText: text('raw_text'),
  targetChamberId: uuid('target_chamber_id').references(() => chambers.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const forecasts = pgTable('forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id').notNull(),
  targetType: text('target_type').notNull(),
  billId: uuid('bill_id').references(() => bills.id),
  proposalId: uuid('proposal_id').references(() => proposals.id),
  targetChamberId: uuid('target_chamber_id').notNull().references(() => chambers.id),
  status: text('status').notNull().default('draft'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index('forecasts_owner_updated_idx').on(table.ownerUserId, table.updatedAt)]);

export const forecastRevisions = pgTable('forecast_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastId: uuid('forecast_id').notNull().references(() => forecasts.id),
  revisionNumber: integer('revision_number').notNull(),
  researchMode: text('research_mode').notNull(),
  billVersionId: uuid('bill_version_id').references(() => billVersions.id),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  passageProbability: doublePrecision('passage_probability'),
  expectedYes: doublePrecision('expected_yes'),
  yesLow: doublePrecision('yes_low'),
  yesHigh: doublePrecision('yes_high'),
  modelVersion: text('model_version'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('forecast_revisions_forecast_number_uq').on(table.forecastId, table.revisionNumber),
  index('forecast_revisions_forecast_created_idx').on(table.forecastId, table.createdAt),
]);

export const forecastMemberPredictions = pgTable('forecast_member_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  revisionId: uuid('revision_id').notNull().references(() => forecastRevisions.id),
  membershipId: uuid('membership_id').notNull().references(() => memberships.id),
  yesProbability: doublePrecision('yes_probability'),
  probabilityLow: doublePrecision('probability_low'),
  probabilityHigh: doublePrecision('probability_high'),
  evidenceQuality: text('evidence_quality').notNull(),
  cannotPredictReason: text('cannot_predict_reason'),
  reasoningSummary: text('reasoning_summary'),
  facts: jsonb('facts').notNull().default([]),
  inferences: jsonb('inferences').notNull().default([]),
  context: jsonb('context').notNull().default([]),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('forecast_member_predictions_revision_membership_uq').on(table.revisionId, table.membershipId),
  index('forecast_member_predictions_revision_idx').on(table.revisionId),
]);

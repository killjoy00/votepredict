import { doublePrecision, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { forecastRevisions, forecasts, memberships } from './schema';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const forecastScenarios = pgTable('forecast_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastId: uuid('forecast_id').notNull().references(() => forecasts.id, { onDelete: 'cascade' }),
  baseRevisionId: uuid('base_revision_id').notNull().references(() => forecastRevisions.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').notNull(),
  name: text('name').notNull(),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('forecast_scenarios_forecast_idx').on(table.forecastId, table.createdAt),
  index('forecast_scenarios_base_revision_idx').on(table.baseRevisionId, table.createdAt),
]);

export const scenarioOverrides = pgTable('scenario_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  scenarioId: uuid('scenario_id').notNull().references(() => forecastScenarios.id, { onDelete: 'cascade' }),
  membershipId: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'cascade' }),
  yesProbability: doublePrecision('yes_probability').notNull(),
  rationale: text('rationale'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('scenario_overrides_scenario_member_uq').on(table.scenarioId, table.membershipId),
]);

export const forecastSubsets = pgTable('forecast_subsets', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastId: uuid('forecast_id').notNull().references(() => forecasts.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').notNull(),
  name: text('name').notNull(),
  sourceKind: text('source_kind').notNull().default('custom'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('forecast_subsets_forecast_idx').on(table.forecastId, table.createdAt),
]);

export const forecastSubsetMembers = pgTable('forecast_subset_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  subsetId: uuid('subset_id').notNull().references(() => forecastSubsets.id, { onDelete: 'cascade' }),
  membershipId: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('forecast_subset_members_subset_member_uq').on(table.subsetId, table.membershipId),
  index('forecast_subset_members_membership_idx').on(table.membershipId, table.subsetId),
]);

export const forecastShareLinks = pgTable('forecast_share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastId: uuid('forecast_id').notNull().references(() => forecasts.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').notNull().references(() => forecastRevisions.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  label: text('label'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('forecast_share_links_token_hash_uq').on(table.tokenHash),
  index('forecast_share_links_forecast_idx').on(table.forecastId, table.createdAt),
  index('forecast_share_links_revision_idx').on(table.revisionId, table.createdAt),
]);

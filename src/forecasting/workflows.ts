import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import { executeDeepRuntimeForecast, type DeepRuntimeResult } from './deep-runtime';
import { poissonBinomialDistribution, type PassageRule } from './chamber';
import { executeRuntimeForecast, type ForecastRuntimeRequest, type ForecastRuntimeResult, type ForecastRuntimeSubject, type RuntimeResearchMode } from './runtime';

export class ForecastWorkflowError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'INVALID_REVISION' | 'INVALID_MEMBER' | 'INVALID_SCENARIO' | 'INVALID_SUBSET' | 'INVALID_SHARE',
    message: string,
  ) {
    super(message);
  }
}

type ForecastContextRow = {
  forecast_id: string;
  owner_user_id: string;
  target_type: 'bill' | 'proposal';
  bill_id: string | null;
  proposal_id: string | null;
  chamber_id: string;
  chamber_slug: string;
  chamber_name: string;
  session_id: string | null;
  session_slug: string | null;
  bill_identifier: string | null;
  bill_title: string | null;
  bill_source_url: string | null;
  bill_metadata: unknown;
  proposal_title: string | null;
  proposal_text: string | null;
};

type RevisionRow = {
  id: string;
  revision_number: number;
  research_mode: RuntimeResearchMode;
  generated_at: string | null;
  passage_probability: number | null;
  expected_yes: number | null;
  yes_low: number | null;
  yes_high: number | null;
  model_version: string | null;
  metadata: unknown;
  created_at: string;
};

type PredictionRow = {
  membership_id: string;
  member_name: string;
  party: string;
  district: string;
  yes_probability: number | null;
  evidence_quality: string;
  cannot_predict_reason: string | null;
  reasoning_summary: string | null;
};

export type ForecastRevisionSummary = {
  id: string;
  revisionNumber: number;
  researchMode: RuntimeResearchMode;
  generatedAt: string | null;
  passageProbability?: number;
  expectedYes?: number;
  yesLow?: number;
  yesHigh?: number;
  modelVersion?: string;
  cannotPredictCount: number;
};

export type ForecastRevisionDiff = {
  from: ForecastRevisionSummary;
  to: ForecastRevisionSummary;
  passageProbabilityDelta?: number;
  expectedYesDelta?: number;
  memberChanges: Array<{
    membershipId: string;
    memberName: string;
    party: string;
    district: string;
    fromProbability?: number;
    toProbability?: number;
    delta?: number;
    fromCannotPredict: boolean;
    toCannotPredict: boolean;
  }>;
};

export type ForecastUpdateResult = {
  result: ForecastRuntimeResult | DeepRuntimeResult;
  deepError?: string;
};

export type ScenarioOverrideInput = {
  membershipId: string;
  yesProbability: number;
  rationale?: string;
};

export type ScenarioEvaluation = {
  scenarioId: string;
  name: string;
  notes?: string;
  forecastId: string;
  baseRevisionId: string;
  baseRevisionNumber: number;
  base: {
    passageProbability?: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
  };
  scenario: {
    passageProbability?: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
    requiredYes?: number;
    cannotPredictCount: number;
  };
  members: Array<{
    membershipId: string;
    memberName: string;
    party: string;
    district: string;
    baseProbability?: number;
    scenarioProbability?: number;
    overridden: boolean;
    rationale?: string;
  }>;
};

export type SubsetEvaluation = {
  subsetId: string;
  name: string;
  sourceKind: 'custom' | 'committee';
  forecastId: string;
  revisionId: string;
  revisionNumber: number;
  aggregate: {
    memberCount: number;
    predictedMemberCount: number;
    cannotPredictCount: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
    proceduralOutcome: null;
    proceduralNote: string;
  };
  members: Array<{
    membershipId: string;
    memberName: string;
    party: string;
    district: string;
    yesProbability?: number;
    cannotPredictReason?: string;
    evidenceQuality: string;
  }>;
};

export type SharedRevision = {
  targetType: 'bill' | 'proposal';
  targetLabel: string;
  chamberName: string;
  revision: {
    id: string;
    number: number;
    researchMode: RuntimeResearchMode;
    generatedAt: string | null;
    passageProbability?: number;
    expectedYes?: number;
    yesLow?: number;
    yesHigh?: number;
    modelVersion?: string;
  };
  members: Array<{
    memberName: string;
    party: string;
    district: string;
    yesProbability?: number;
    evidenceQuality: string;
    cannotPredictReason?: string;
    reasoningSummary?: string;
  }>;
};

function companionIdentifier(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const revisor = (metadata as Record<string, unknown>).revisor;
  if (!revisor || typeof revisor !== 'object') return undefined;
  const value = (revisor as Record<string, unknown>).companionIdentifier;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function finiteProbability(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isPassageRule(value: unknown): value is PassageRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  if (rule.kind === 'majority-of-cast') return true;
  if (rule.kind === 'absolute-majority') return Number.isInteger(rule.seats) && Number(rule.seats) >= 0;
  if (rule.kind === 'fraction-of-seats') return Number.isInteger(rule.seats) && Number.isInteger(rule.numerator) && Number.isInteger(rule.denominator);
  if (rule.kind === 'fixed') return Number.isInteger(rule.requiredYes) && Number(rule.requiredYes) >= 0;
  return false;
}

function quantile(distribution: readonly number[], q: number): number {
  let cumulative = 0;
  for (let index = 0; index < distribution.length; index += 1) {
    cumulative += distribution[index];
    if (cumulative >= q) return index;
  }
  return distribution.length - 1;
}

function aggregateWithoutThreshold(probabilities: readonly number[]): { expectedYes: number; yesLow: number; yesHigh: number } {
  const distribution = poissonBinomialDistribution(probabilities);
  return {
    expectedYes: probabilities.reduce((sum, probability) => sum + probability, 0),
    yesLow: quantile(distribution, 0.1),
    yesHigh: quantile(distribution, 0.9),
  };
}

async function ownedForecastContext(forecastId: string, ownerUserId: string): Promise<ForecastContextRow> {
  const result = await pool.query<ForecastContextRow>(`
    SELECT f.id AS forecast_id,
           f.owner_user_id,
           f.target_type,
           f.bill_id,
           f.proposal_id,
           f.target_chamber_id AS chamber_id,
           c.slug AS chamber_slug,
           c.name AS chamber_name,
           COALESCE(f.session_id, b.session_id) AS session_id,
           s.slug AS session_slug,
           b.identifier AS bill_identifier,
           b.title AS bill_title,
           b.source_url AS bill_source_url,
           b.metadata AS bill_metadata,
           p.title AS proposal_title,
           p.raw_text AS proposal_text
      FROM forecasts f
      JOIN chambers c ON c.id = f.target_chamber_id
      LEFT JOIN bills b ON b.id = f.bill_id
      LEFT JOIN proposals p ON p.id = f.proposal_id
      LEFT JOIN legislative_sessions s ON s.id = COALESCE(f.session_id, b.session_id)
     WHERE f.id = $1
       AND f.owner_user_id = $2
     LIMIT 1`, [forecastId, ownerUserId]);
  const row = result.rows[0];
  if (!row) throw new ForecastWorkflowError('NOT_FOUND', 'Forecast not found.');
  if (!row.session_id || !row.session_slug) throw new ForecastWorkflowError('NOT_FOUND', 'Forecast session is not available.');
  return row;
}

function runtimeSubject(context: ForecastContextRow): ForecastRuntimeSubject {
  if (!context.session_id || !context.session_slug) throw new ForecastWorkflowError('NOT_FOUND', 'Forecast session is not available.');
  if (context.target_type === 'bill') {
    if (!context.bill_id || !context.bill_identifier || !context.bill_title) throw new ForecastWorkflowError('NOT_FOUND', 'Forecast bill is not available.');
    return {
      kind: 'bill',
      billId: context.bill_id,
      identifier: context.bill_identifier,
      title: context.bill_title,
      sessionId: context.session_id,
      sessionSlug: context.session_slug,
      sourceUrl: context.bill_source_url,
      companionIdentifier: companionIdentifier(context.bill_metadata),
    };
  }
  if (!context.proposal_id || !context.proposal_title || !context.proposal_text) throw new ForecastWorkflowError('NOT_FOUND', 'Forecast proposal is not available.');
  return {
    kind: 'proposal',
    proposalId: context.proposal_id,
    title: context.proposal_title,
    text: context.proposal_text,
    sessionId: context.session_id,
    sessionSlug: context.session_slug,
  };
}

function runtimeRequest(context: ForecastContextRow, researchMode: RuntimeResearchMode): ForecastRuntimeRequest {
  return {
    forecastId: context.forecast_id,
    chamberId: context.chamber_id,
    chamberSlug: context.chamber_slug,
    chamberName: context.chamber_name,
    subject: runtimeSubject(context),
    researchMode,
  };
}

async function assertOwnedRevision(forecastId: string, revisionId: string, ownerUserId: string): Promise<RevisionRow> {
  const result = await pool.query<RevisionRow>(`
    SELECT r.id,
           r.revision_number,
           r.research_mode,
           r.generated_at::text,
           r.passage_probability,
           r.expected_yes,
           r.yes_low,
           r.yes_high,
           r.model_version,
           r.metadata,
           r.created_at::text
      FROM forecast_revisions r
      JOIN forecasts f ON f.id = r.forecast_id
     WHERE r.id = $1
       AND r.forecast_id = $2
       AND f.owner_user_id = $3
     LIMIT 1`, [revisionId, forecastId, ownerUserId]);
  const row = result.rows[0];
  if (!row) throw new ForecastWorkflowError('INVALID_REVISION', 'Revision does not belong to this forecast.');
  return row;
}

async function revisionPredictions(revisionId: string): Promise<PredictionRow[]> {
  const result = await pool.query<PredictionRow>(`
    SELECT p.membership_id,
           l.name AS member_name,
           m.party,
           m.district,
           p.yes_probability,
           p.evidence_quality,
           p.cannot_predict_reason,
           p.reasoning_summary
      FROM forecast_member_predictions p
      JOIN memberships m ON m.id = p.membership_id
      JOIN legislators l ON l.id = m.legislator_id
     WHERE p.revision_id = $1
     ORDER BY m.district, l.name`, [revisionId]);
  return result.rows;
}

async function revisionSummary(row: RevisionRow): Promise<ForecastRevisionSummary> {
  const countResult = await pool.query<{ cannot_predict_count: number }>(`
    SELECT count(*) FILTER (WHERE yes_probability IS NULL)::int AS cannot_predict_count
      FROM forecast_member_predictions
     WHERE revision_id = $1`, [row.id]);
  return {
    id: row.id,
    revisionNumber: Number(row.revision_number),
    researchMode: row.research_mode,
    generatedAt: row.generated_at,
    passageProbability: finiteProbability(row.passage_probability),
    expectedYes: finiteProbability(row.expected_yes),
    yesLow: finiteProbability(row.yes_low),
    yesHigh: finiteProbability(row.yes_high),
    modelVersion: row.model_version ?? undefined,
    cannotPredictCount: Number(countResult.rows[0]?.cannot_predict_count ?? 0),
  };
}

export async function updateForecast(forecastId: string, ownerUserId: string, researchMode: RuntimeResearchMode): Promise<ForecastUpdateResult> {
  const context = await ownedForecastContext(forecastId, ownerUserId);
  const baseRequest = runtimeRequest(context, 'quick');
  const quick = await executeRuntimeForecast(baseRequest);
  if (researchMode === 'quick') return { result: quick };
  try {
    const deep = await executeDeepRuntimeForecast({ ...runtimeRequest(context, 'deep'), asOf: quick.asOf }, quick);
    return { result: deep };
  } catch (error) {
    return { result: quick, deepError: errorMessage(error) };
  }
}

export async function listForecastRevisions(forecastId: string, ownerUserId: string): Promise<ForecastRevisionSummary[]> {
  await ownedForecastContext(forecastId, ownerUserId);
  const result = await pool.query<RevisionRow>(`
    SELECT id,
           revision_number,
           research_mode,
           generated_at::text,
           passage_probability,
           expected_yes,
           yes_low,
           yes_high,
           model_version,
           metadata,
           created_at::text
      FROM forecast_revisions
     WHERE forecast_id = $1
     ORDER BY revision_number DESC`, [forecastId]);
  return Promise.all(result.rows.map((row) => revisionSummary(row)));
}

export async function diffForecastRevisions(
  forecastId: string,
  ownerUserId: string,
  fromRevisionId: string,
  toRevisionId: string,
): Promise<ForecastRevisionDiff> {
  if (fromRevisionId === toRevisionId) throw new ForecastWorkflowError('INVALID_REVISION', 'Choose two different revisions to compare.');
  const [fromRow, toRow] = await Promise.all([
    assertOwnedRevision(forecastId, fromRevisionId, ownerUserId),
    assertOwnedRevision(forecastId, toRevisionId, ownerUserId),
  ]);
  const [from, to, fromPredictions, toPredictions] = await Promise.all([
    revisionSummary(fromRow),
    revisionSummary(toRow),
    revisionPredictions(fromRevisionId),
    revisionPredictions(toRevisionId),
  ]);
  const fromByMember = new Map(fromPredictions.map((row) => [row.membership_id, row]));
  const toByMember = new Map(toPredictions.map((row) => [row.membership_id, row]));
  const membershipIds = [...new Set([...fromByMember.keys(), ...toByMember.keys()])];
  const memberChanges = membershipIds.map((membershipId) => {
    const before = fromByMember.get(membershipId);
    const after = toByMember.get(membershipId);
    const fromProbability = finiteProbability(before?.yes_probability);
    const toProbability = finiteProbability(after?.yes_probability);
    return {
      membershipId,
      memberName: after?.member_name ?? before?.member_name ?? 'Unknown member',
      party: after?.party ?? before?.party ?? 'UNKNOWN',
      district: after?.district ?? before?.district ?? '',
      fromProbability,
      toProbability,
      delta: fromProbability !== undefined && toProbability !== undefined ? toProbability - fromProbability : undefined,
      fromCannotPredict: fromProbability === undefined,
      toCannotPredict: toProbability === undefined,
    };
  }).filter((row) => row.delta !== 0 || row.fromCannotPredict !== row.toCannotPredict)
    .sort((a, b) => Math.abs(b.delta ?? 1) - Math.abs(a.delta ?? 1) || a.memberName.localeCompare(b.memberName));

  return {
    from,
    to,
    passageProbabilityDelta: from.passageProbability !== undefined && to.passageProbability !== undefined ? to.passageProbability - from.passageProbability : undefined,
    expectedYesDelta: from.expectedYes !== undefined && to.expectedYes !== undefined ? to.expectedYes - from.expectedYes : undefined,
    memberChanges,
  };
}

async function insertOverrides(client: PoolClient, scenarioId: string, overrides: readonly ScenarioOverrideInput[]): Promise<void> {
  for (const override of overrides) {
    await client.query(`
      INSERT INTO scenario_overrides (scenario_id, membership_id, yes_probability, rationale)
      VALUES ($1, $2, $3, $4)`, [scenarioId, override.membershipId, override.yesProbability, override.rationale?.trim() || null]);
  }
}

export async function createScenario(input: {
  forecastId: string;
  ownerUserId: string;
  baseRevisionId: string;
  name: string;
  notes?: string;
  overrides: ScenarioOverrideInput[];
}): Promise<ScenarioEvaluation> {
  const name = input.name.trim();
  if (!name) throw new ForecastWorkflowError('INVALID_SCENARIO', 'Scenario name is required.');
  if (input.overrides.length === 0) throw new ForecastWorkflowError('INVALID_SCENARIO', 'Add at least one member override.');
  const uniqueMembers = new Set<string>();
  for (const override of input.overrides) {
    if (!Number.isFinite(override.yesProbability) || override.yesProbability < 0 || override.yesProbability > 1) {
      throw new ForecastWorkflowError('INVALID_SCENARIO', 'Scenario probabilities must be between 0 and 1.');
    }
    if (uniqueMembers.has(override.membershipId)) throw new ForecastWorkflowError('INVALID_SCENARIO', 'Each member can be overridden only once per scenario.');
    uniqueMembers.add(override.membershipId);
  }
  await assertOwnedRevision(input.forecastId, input.baseRevisionId, input.ownerUserId);
  const baseMembers = await revisionPredictions(input.baseRevisionId);
  const validMembers = new Set(baseMembers.map((row) => row.membership_id));
  for (const membershipId of uniqueMembers) {
    if (!validMembers.has(membershipId)) throw new ForecastWorkflowError('INVALID_MEMBER', 'A scenario override does not belong to the base revision.');
  }

  const client = await pool.connect();
  let scenarioId: string;
  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string }>(`
      INSERT INTO forecast_scenarios (forecast_id, base_revision_id, owner_user_id, name, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`, [input.forecastId, input.baseRevisionId, input.ownerUserId, name.slice(0, 160), input.notes?.trim() || null]);
    scenarioId = result.rows[0].id;
    await insertOverrides(client, scenarioId, input.overrides);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return evaluateScenario(scenarioId, input.ownerUserId);
}

export async function listScenarios(forecastId: string, ownerUserId: string) {
  await ownedForecastContext(forecastId, ownerUserId);
  const result = await pool.query<{
    id: string;
    name: string;
    notes: string | null;
    base_revision_id: string;
    base_revision_number: number;
    override_count: number;
    created_at: string;
  }>(`
    SELECT s.id,
           s.name,
           s.notes,
           s.base_revision_id,
           r.revision_number AS base_revision_number,
           count(o.id)::int AS override_count,
           s.created_at::text
      FROM forecast_scenarios s
      JOIN forecast_revisions r ON r.id = s.base_revision_id AND r.forecast_id = s.forecast_id
      LEFT JOIN scenario_overrides o ON o.scenario_id = s.id
     WHERE s.forecast_id = $1
       AND s.owner_user_id = $2
     GROUP BY s.id, r.revision_number
     ORDER BY s.created_at DESC`, [forecastId, ownerUserId]);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes ?? undefined,
    baseRevisionId: row.base_revision_id,
    baseRevisionNumber: Number(row.base_revision_number),
    overrideCount: Number(row.override_count),
    createdAt: row.created_at,
  }));
}

export async function evaluateScenario(scenarioId: string, ownerUserId: string): Promise<ScenarioEvaluation> {
  const scenarioResult = await pool.query<{
    id: string;
    name: string;
    notes: string | null;
    forecast_id: string;
    base_revision_id: string;
    revision_number: number;
    passage_probability: number | null;
    expected_yes: number | null;
    yes_low: number | null;
    yes_high: number | null;
    metadata: unknown;
  }>(`
    SELECT s.id,
           s.name,
           s.notes,
           s.forecast_id,
           s.base_revision_id,
           r.revision_number,
           r.passage_probability,
           r.expected_yes,
           r.yes_low,
           r.yes_high,
           r.metadata
      FROM forecast_scenarios s
      JOIN forecasts f ON f.id = s.forecast_id
      JOIN forecast_revisions r ON r.id = s.base_revision_id AND r.forecast_id = s.forecast_id
     WHERE s.id = $1
       AND s.owner_user_id = $2
       AND f.owner_user_id = $2
     LIMIT 1`, [scenarioId, ownerUserId]);
  const scenario = scenarioResult.rows[0];
  if (!scenario) throw new ForecastWorkflowError('NOT_FOUND', 'Scenario not found.');

  const [baseMembers, overridesResult] = await Promise.all([
    revisionPredictions(scenario.base_revision_id),
    pool.query<{ membership_id: string; yes_probability: number; rationale: string | null }>(`
      SELECT membership_id, yes_probability, rationale
        FROM scenario_overrides
       WHERE scenario_id = $1`, [scenarioId]),
  ]);
  const overrides = new Map(overridesResult.rows.map((row) => [row.membership_id, row]));
  const members = baseMembers.map((member) => {
    const override = overrides.get(member.membership_id);
    return {
      membershipId: member.membership_id,
      memberName: member.member_name,
      party: member.party,
      district: member.district,
      baseProbability: finiteProbability(member.yes_probability),
      scenarioProbability: override ? finiteProbability(override.yes_probability) : finiteProbability(member.yes_probability),
      overridden: Boolean(override),
      rationale: override?.rationale ?? undefined,
    };
  });
  const cannotPredictCount = members.filter((member) => member.scenarioProbability === undefined).length;
  const metadata = asObject(scenario.metadata);
  const passageRule = isPassageRule(metadata.passageRule) ? metadata.passageRule : undefined;
  let scenarioAggregate: ScenarioEvaluation['scenario'] = { cannotPredictCount };
  if (cannotPredictCount === 0 && passageRule) {
    const { simulateChamber } = await import('./chamber');
    const simulation = simulateChamber(members.map((member) => member.scenarioProbability as number), passageRule);
    scenarioAggregate = {
      passageProbability: simulation.passageProbability,
      expectedYes: simulation.expectedYes,
      yesLow: simulation.yesLow,
      yesHigh: simulation.yesHigh,
      requiredYes: simulation.requiredYes,
      cannotPredictCount,
    };
  }

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    notes: scenario.notes ?? undefined,
    forecastId: scenario.forecast_id,
    baseRevisionId: scenario.base_revision_id,
    baseRevisionNumber: Number(scenario.revision_number),
    base: {
      passageProbability: finiteProbability(scenario.passage_probability),
      expectedYes: finiteProbability(scenario.expected_yes),
      yesLow: finiteProbability(scenario.yes_low),
      yesHigh: finiteProbability(scenario.yes_high),
    },
    scenario: scenarioAggregate,
    members,
  };
}

export async function createSubset(input: {
  forecastId: string;
  ownerUserId: string;
  revisionId: string;
  name: string;
  membershipIds: string[];
  sourceKind?: 'custom' | 'committee';
  metadata?: Record<string, unknown>;
}): Promise<SubsetEvaluation> {
  const name = input.name.trim();
  if (!name) throw new ForecastWorkflowError('INVALID_SUBSET', 'Subset name is required.');
  const membershipIds = [...new Set(input.membershipIds)];
  if (membershipIds.length === 0) throw new ForecastWorkflowError('INVALID_SUBSET', 'Select at least one member.');
  await assertOwnedRevision(input.forecastId, input.revisionId, input.ownerUserId);
  const baseMembers = await revisionPredictions(input.revisionId);
  const validMembers = new Set(baseMembers.map((row) => row.membership_id));
  for (const membershipId of membershipIds) {
    if (!validMembers.has(membershipId)) throw new ForecastWorkflowError('INVALID_MEMBER', 'A selected subset member does not belong to the selected revision.');
  }

  const client = await pool.connect();
  let subsetId: string;
  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string }>(`
      INSERT INTO forecast_subsets (forecast_id, owner_user_id, name, source_kind, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id`, [
      input.forecastId,
      input.ownerUserId,
      name.slice(0, 160),
      input.sourceKind ?? 'custom',
      JSON.stringify({ ...(input.metadata ?? {}), createdFromRevisionId: input.revisionId }),
    ]);
    subsetId = result.rows[0].id;
    for (const membershipId of membershipIds) {
      await client.query(`INSERT INTO forecast_subset_members (subset_id, membership_id) VALUES ($1, $2)`, [subsetId, membershipId]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return evaluateSubset(subsetId, input.ownerUserId, input.revisionId);
}

export async function listSubsets(forecastId: string, ownerUserId: string) {
  await ownedForecastContext(forecastId, ownerUserId);
  const result = await pool.query<{
    id: string;
    name: string;
    source_kind: 'custom' | 'committee';
    metadata: unknown;
    member_count: number;
    created_at: string;
  }>(`
    SELECT s.id,
           s.name,
           s.source_kind,
           s.metadata,
           count(sm.id)::int AS member_count,
           s.created_at::text
      FROM forecast_subsets s
      LEFT JOIN forecast_subset_members sm ON sm.subset_id = s.id
     WHERE s.forecast_id = $1
       AND s.owner_user_id = $2
     GROUP BY s.id
     ORDER BY s.created_at DESC`, [forecastId, ownerUserId]);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    sourceKind: row.source_kind,
    memberCount: Number(row.member_count),
    metadata: asObject(row.metadata),
    createdAt: row.created_at,
  }));
}

export async function evaluateSubset(subsetId: string, ownerUserId: string, revisionId: string): Promise<SubsetEvaluation> {
  const subsetResult = await pool.query<{
    id: string;
    name: string;
    source_kind: 'custom' | 'committee';
    forecast_id: string;
  }>(`
    SELECT s.id, s.name, s.source_kind, s.forecast_id
      FROM forecast_subsets s
      JOIN forecasts f ON f.id = s.forecast_id
     WHERE s.id = $1
       AND s.owner_user_id = $2
       AND f.owner_user_id = $2
     LIMIT 1`, [subsetId, ownerUserId]);
  const subset = subsetResult.rows[0];
  if (!subset) throw new ForecastWorkflowError('NOT_FOUND', 'Subset not found.');
  const revision = await assertOwnedRevision(subset.forecast_id, revisionId, ownerUserId);
  const membersResult = await pool.query<PredictionRow>(`
    SELECT p.membership_id,
           l.name AS member_name,
           m.party,
           m.district,
           p.yes_probability,
           p.evidence_quality,
           p.cannot_predict_reason,
           p.reasoning_summary
      FROM forecast_subset_members sm
      JOIN forecast_member_predictions p ON p.membership_id = sm.membership_id AND p.revision_id = $2
      JOIN memberships m ON m.id = p.membership_id
      JOIN legislators l ON l.id = m.legislator_id
     WHERE sm.subset_id = $1
     ORDER BY m.district, l.name`, [subsetId, revisionId]);
  const members = membersResult.rows.map((member) => ({
    membershipId: member.membership_id,
    memberName: member.member_name,
    party: member.party,
    district: member.district,
    yesProbability: finiteProbability(member.yes_probability),
    cannotPredictReason: member.cannot_predict_reason ?? undefined,
    evidenceQuality: member.evidence_quality,
  }));
  const probabilities = members.map((member) => member.yesProbability).filter((value): value is number => value !== undefined);
  const cannotPredictCount = members.length - probabilities.length;
  const aggregate = cannotPredictCount === 0
    ? aggregateWithoutThreshold(probabilities)
    : undefined;
  return {
    subsetId: subset.id,
    name: subset.name,
    sourceKind: subset.source_kind,
    forecastId: subset.forecast_id,
    revisionId,
    revisionNumber: Number(revision.revision_number),
    aggregate: {
      memberCount: members.length,
      predictedMemberCount: probabilities.length,
      cannotPredictCount,
      expectedYes: aggregate?.expectedYes,
      yesLow: aggregate?.yesLow,
      yesHigh: aggregate?.yesHigh,
      proceduralOutcome: null,
      proceduralNote: 'No procedural threshold is inferred for subsets. This is an aggregate distribution over the selected members only.',
    },
    members,
  };
}

export async function createShare(input: {
  forecastId: string;
  ownerUserId: string;
  revisionId: string;
  label?: string;
}): Promise<{ id: string; token: string; path: string }> {
  await assertOwnedRevision(input.forecastId, input.revisionId, input.ownerUserId);
  const token = randomBytes(24).toString('base64url');
  const hash = tokenHash(token);
  const result = await pool.query<{ id: string }>(`
    INSERT INTO forecast_share_links (forecast_id, revision_id, owner_user_id, token_hash, label)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id`, [input.forecastId, input.revisionId, input.ownerUserId, hash, input.label?.trim() || null]);
  return { id: result.rows[0].id, token, path: `/share/${token}` };
}

export async function listShares(forecastId: string, ownerUserId: string) {
  await ownedForecastContext(forecastId, ownerUserId);
  const result = await pool.query<{
    id: string;
    revision_id: string;
    revision_number: number;
    label: string | null;
    revoked_at: string | null;
    created_at: string;
  }>(`
    SELECT sh.id,
           sh.revision_id,
           r.revision_number,
           sh.label,
           sh.revoked_at::text,
           sh.created_at::text
      FROM forecast_share_links sh
      JOIN forecast_revisions r ON r.id = sh.revision_id AND r.forecast_id = sh.forecast_id
     WHERE sh.forecast_id = $1
       AND sh.owner_user_id = $2
     ORDER BY sh.created_at DESC`, [forecastId, ownerUserId]);
  return result.rows.map((row) => ({
    id: row.id,
    revisionId: row.revision_id,
    revisionNumber: Number(row.revision_number),
    label: row.label ?? undefined,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export async function revokeShare(shareId: string, ownerUserId: string): Promise<void> {
  const result = await pool.query(`
    UPDATE forecast_share_links sh
       SET revoked_at = now()
      FROM forecasts f
     WHERE sh.id = $1
       AND sh.owner_user_id = $2
       AND f.id = sh.forecast_id
       AND f.owner_user_id = $2
       AND sh.revoked_at IS NULL`, [shareId, ownerUserId]);
  if (result.rowCount === 0) throw new ForecastWorkflowError('INVALID_SHARE', 'Active share link not found.');
}

export async function loadSharedRevision(token: string): Promise<SharedRevision | null> {
  if (!token || token.length < 20 || token.length > 80) return null;
  const hash = tokenHash(token);
  const shareResult = await pool.query<{
    revision_id: string;
    target_type: 'bill' | 'proposal';
    target_label: string;
    chamber_name: string;
    revision_number: number;
    research_mode: RuntimeResearchMode;
    generated_at: string | null;
    passage_probability: number | null;
    expected_yes: number | null;
    yes_low: number | null;
    yes_high: number | null;
    model_version: string | null;
  }>(`
    SELECT sh.revision_id,
           f.target_type,
           CASE WHEN f.target_type = 'bill'
                THEN concat(b.identifier, ' · ', b.title)
                ELSE p.title END AS target_label,
           c.name AS chamber_name,
           r.revision_number,
           r.research_mode,
           r.generated_at::text,
           r.passage_probability,
           r.expected_yes,
           r.yes_low,
           r.yes_high,
           r.model_version
      FROM forecast_share_links sh
      JOIN forecasts f ON f.id = sh.forecast_id
      JOIN forecast_revisions r ON r.id = sh.revision_id AND r.forecast_id = sh.forecast_id
      JOIN chambers c ON c.id = f.target_chamber_id
      LEFT JOIN bills b ON b.id = f.bill_id
      LEFT JOIN proposals p ON p.id = f.proposal_id
     WHERE sh.token_hash = $1
       AND sh.revoked_at IS NULL
     LIMIT 1`, [hash]);
  const share = shareResult.rows[0];
  if (!share) return null;
  const members = await revisionPredictions(share.revision_id);
  return {
    targetType: share.target_type,
    targetLabel: share.target_label,
    chamberName: share.chamber_name,
    revision: {
      id: share.revision_id,
      number: Number(share.revision_number),
      researchMode: share.research_mode,
      generatedAt: share.generated_at,
      passageProbability: finiteProbability(share.passage_probability),
      expectedYes: finiteProbability(share.expected_yes),
      yesLow: finiteProbability(share.yes_low),
      yesHigh: finiteProbability(share.yes_high),
      modelVersion: share.model_version ?? undefined,
    },
    members: members.map((member) => ({
      memberName: member.member_name,
      party: member.party,
      district: member.district,
      yesProbability: finiteProbability(member.yes_probability),
      evidenceQuality: member.evidence_quality,
      cannotPredictReason: member.cannot_predict_reason ?? undefined,
      reasoningSummary: member.reasoning_summary ?? undefined,
    })),
  };
}

export async function getForecastDetail(forecastId: string, ownerUserId: string) {
  const context = await ownedForecastContext(forecastId, ownerUserId);
  const revisions = await listForecastRevisions(forecastId, ownerUserId);
  const latestRevisionId = revisions[0]?.id;
  const latestMembers = latestRevisionId ? await revisionPredictions(latestRevisionId) : [];
  return {
    forecastId,
    targetType: context.target_type,
    targetLabel: context.target_type === 'bill'
      ? `${context.bill_identifier ?? 'Bill'} · ${context.bill_title ?? ''}`
      : context.proposal_title ?? 'Proposal',
    chamberName: context.chamber_name,
    revisions,
    latestMembers: latestMembers.map((member) => ({
      membershipId: member.membership_id,
      memberName: member.member_name,
      party: member.party,
      district: member.district,
      yesProbability: finiteProbability(member.yes_probability),
      evidenceQuality: member.evidence_quality,
      cannotPredictReason: member.cannot_predict_reason ?? undefined,
      reasoningSummary: member.reasoning_summary ?? undefined,
    })),
  };
}

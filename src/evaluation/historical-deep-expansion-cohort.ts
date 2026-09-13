import type { Pool } from 'pg';
import { HISTORICAL_DEEP_PILOT_CASES, historicalDeepPilotCaseKey } from './historical-deep-pilot';
import { HISTORICAL_DEEP_TARGET_LIMIT } from './historical-deep-targets';
import {
  selectHistoricalDeepTargetsByStrategy,
} from './historical-deep-target-strategies';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';
import { evaluateHistoricalQuickReplay } from './historical-quick-runtime';

export const HISTORICAL_DEEP_EXPANSION_COHORT_SCHEMA = 'historical-deep-expansion-cohort-v1' as const;
export const HISTORICAL_DEEP_EXPANSION_SESSIONS = ['2021-2022', '2023-2024'] as const;
export const HISTORICAL_DEEP_EXPANSION_CHAMBER = 'house' as const;
export const HISTORICAL_DEEP_EXPANSION_PER_SESSION_PER_TRANCHE = 6;

export type HistoricalDeepExpansionTranche = 'deterministic-uniform' | 'selector-disagreement';

export interface HistoricalDeepExpansionMetadataRow {
  voteEventId: string;
  externalKey: string;
  identifier: string;
  title: string;
  session: string;
  chamber: string;
  occurredOn: string;
}

export interface HistoricalDeepExpansionCandidate extends HistoricalDeepExpansionMetadataRow {
  /** Source-derived event identity; unique within the historical vote store. */
  stableKey: string;
  /** Bill/date key retained for pilot exclusion and human-readable lineage. */
  caseKey: string;
  targetVersionId: string;
  quickModelVersion: string;
  activeMembers: number;
  currentDeepTargetIds: string[];
  needOnlyTargetIds: string[];
  targetOverlap: number;
  targetDisagreementRate: number;
}

export interface HistoricalDeepExpansionSelectedCase extends HistoricalDeepExpansionCandidate {
  tranche: HistoricalDeepExpansionTranche;
  trancheRankWithinSession: number;
}

export interface HistoricalDeepExpansionCohort {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_COHORT_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    databaseSource: string | null;
    purpose: string;
    selectionGuard: string;
    holdoutPolicy: string;
    sessions: readonly string[];
    chamber: typeof HISTORICAL_DEEP_EXPANSION_CHAMBER;
    targetLimit: number;
    perSessionPerTranche: number;
    totalSelected: number;
    pilotCasesExcluded: number;
    poolBySession: Record<string, number>;
  };
  cases: HistoricalDeepExpansionSelectedCase[];
}

type EventMetadataRow = {
  vote_event_id: string;
  external_key: string;
  identifier: string;
  title: string;
  session_slug: string;
  chamber_slug: string;
  occurred_on: string;
};

function runtimeEvents(result: Record<string, unknown>): HistoricalQuickReplayEventResult[] {
  if (!Array.isArray(result.events)) throw new Error('Historical Quick replay did not return an events array');
  return result.events as HistoricalQuickReplayEventResult[];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function outcomeBlindMember(
  member: HistoricalQuickReplayMemberPrediction,
): HistoricalQuickReplayMemberPrediction {
  const { actualOutcome: _actualOutcome, ...preVote } = member;
  return preVote;
}

/**
 * Build the selector input from pre-vote Quick fields only. Historical Quick returns
 * outcomes because the same artifact is also a scorer, but expansion cohort selection
 * never passes those outcomes to either target selector.
 */
export function outcomeBlindExpansionEvent(
  event: HistoricalQuickReplayEventResult,
): HistoricalQuickReplayEventResult {
  return {
    ...event,
    actualYes: 0,
    passed: false,
    memberPredictions: event.memberPredictions.map(outcomeBlindMember),
  };
}

export function historicalDeepExpansionEventKey(
  value: Pick<HistoricalDeepExpansionMetadataRow, 'session' | 'chamber' | 'externalKey'>,
): string {
  const externalKey = value.externalKey.trim();
  if (!externalKey) throw new Error('Historical Deep expansion external key is required');
  return `${value.session}|${value.chamber}|${externalKey}`;
}

function normalizedMetadata(row: EventMetadataRow): HistoricalDeepExpansionMetadataRow {
  return {
    voteEventId: row.vote_event_id,
    externalKey: row.external_key,
    identifier: row.identifier,
    title: row.title,
    session: row.session_slug,
    chamber: row.chamber_slug,
    occurredOn: row.occurred_on,
  };
}

export function buildHistoricalDeepExpansionCandidate(
  event: HistoricalQuickReplayEventResult,
  metadata: HistoricalDeepExpansionMetadataRow,
  targetLimit = HISTORICAL_DEEP_TARGET_LIMIT,
): HistoricalDeepExpansionCandidate {
  if (event.status !== 'replayable') throw new Error(`Expansion event ${event.voteEventId} is not replayable`);
  if (metadata.voteEventId !== event.voteEventId) throw new Error('Expansion metadata vote ID mismatch');
  if (metadata.session !== event.session || metadata.chamber !== event.chamber || metadata.occurredOn !== event.occurredOn) {
    throw new Error(`Expansion metadata natural-key mismatch for ${event.voteEventId}`);
  }
  const selectorEvent = outcomeBlindExpansionEvent(event);
  const currentDeepTargetIds = selectHistoricalDeepTargetsByStrategy(selectorEvent, 'live-current', targetLimit);
  const needOnlyTargetIds = selectHistoricalDeepTargetsByStrategy(selectorEvent, 'need-only', targetLimit);
  if (currentDeepTargetIds.length === 0 || needOnlyTargetIds.length === 0) {
    throw new Error(`Expansion event ${event.voteEventId} produced an empty target set`);
  }
  const current = new Set(currentDeepTargetIds);
  const targetOverlap = needOnlyTargetIds.filter((membershipId) => current.has(membershipId)).length;
  const comparisonSize = Math.min(currentDeepTargetIds.length, needOnlyTargetIds.length);
  return {
    ...metadata,
    stableKey: historicalDeepExpansionEventKey(metadata),
    caseKey: historicalDeepPilotCaseKey(metadata),
    targetVersionId: event.targetVersionId,
    quickModelVersion: event.modelVersion,
    activeMembers: event.activeMembers,
    currentDeepTargetIds,
    needOnlyTargetIds,
    targetOverlap,
    targetDisagreementRate: comparisonSize === 0 ? 0 : 1 - targetOverlap / comparisonSize,
  };
}

export interface HistoricalDeepExpansionSelectionOptions {
  sessions?: readonly string[];
  chamber?: string;
  perSessionPerTranche?: number;
  targetLimit?: number;
}

export function selectHistoricalDeepExpansionCases(
  candidates: readonly HistoricalDeepExpansionCandidate[],
  options: HistoricalDeepExpansionSelectionOptions = {},
): {
  cases: HistoricalDeepExpansionSelectedCase[];
  poolBySession: Record<string, number>;
} {
  const sessions = options.sessions ?? HISTORICAL_DEEP_EXPANSION_SESSIONS;
  const chamber = options.chamber ?? HISTORICAL_DEEP_EXPANSION_CHAMBER;
  const perSession = options.perSessionPerTranche ?? HISTORICAL_DEEP_EXPANSION_PER_SESSION_PER_TRANCHE;
  const targetLimit = options.targetLimit ?? HISTORICAL_DEEP_TARGET_LIMIT;
  if (sessions.length === 0) throw new Error('Expansion sessions must be non-empty');
  if (!Number.isInteger(perSession) || perSession <= 0) throw new Error('perSessionPerTranche must be positive');
  if (!Number.isInteger(targetLimit) || targetLimit <= 0) throw new Error('targetLimit must be positive');

  const pilotKeys = new Set(HISTORICAL_DEEP_PILOT_CASES.map(historicalDeepPilotCaseKey));
  const seenKeys = new Set<string>();
  for (const candidate of candidates) {
    if (seenKeys.has(candidate.stableKey)) throw new Error(`Duplicate expansion event key: ${candidate.stableKey}`);
    seenKeys.add(candidate.stableKey);
  }

  const eligible = candidates.filter((candidate) =>
    sessions.includes(candidate.session)
    && candidate.chamber === chamber
    && !pilotKeys.has(candidate.caseKey)
    && candidate.currentDeepTargetIds.length === Math.min(targetLimit, candidate.activeMembers)
    && candidate.needOnlyTargetIds.length === Math.min(targetLimit, candidate.activeMembers));

  const selected: HistoricalDeepExpansionSelectedCase[] = [];
  const poolBySession: Record<string, number> = {};
  for (const session of sessions) {
    const sessionPool = eligible.filter((candidate) => candidate.session === session);
    poolBySession[session] = sessionPool.length;
    if (sessionPool.length < perSession * 2) {
      throw new Error(`Expansion session ${session} has only ${sessionPool.length} eligible cases`);
    }

    // Freeze the representative sample first so the stress-test tranche cannot bias it.
    const uniform = [...sessionPool]
      .sort((left, right) => stableHash(`uniform-v1|${left.stableKey}`) - stableHash(`uniform-v1|${right.stableKey}`)
        || left.stableKey.localeCompare(right.stableKey))
      .slice(0, perSession);
    const uniformKeys = new Set(uniform.map((candidate) => candidate.stableKey));
    const disagreement = sessionPool
      .filter((candidate) => !uniformKeys.has(candidate.stableKey))
      .sort((left, right) => right.targetDisagreementRate - left.targetDisagreementRate
        || stableHash(`disagreement-v1|${left.stableKey}`) - stableHash(`disagreement-v1|${right.stableKey}`)
        || left.stableKey.localeCompare(right.stableKey))
      .slice(0, perSession);

    selected.push(
      ...uniform.map((candidate, index) => ({
        ...candidate,
        tranche: 'deterministic-uniform' as const,
        trancheRankWithinSession: index + 1,
      })),
      ...disagreement.map((candidate, index) => ({
        ...candidate,
        tranche: 'selector-disagreement' as const,
        trancheRankWithinSession: index + 1,
      })),
    );
  }

  return { cases: selected, poolBySession };
}

export async function evaluateHistoricalDeepExpansionCohort(
  pool: Pool,
  options: { codeSha?: string | null; databaseSource?: string | null } = {},
): Promise<HistoricalDeepExpansionCohort> {
  const quick = await evaluateHistoricalQuickReplay(pool, {
    includeMembers: true,
    codeSha: options.codeSha ?? null,
    databaseSource: options.databaseSource ?? null,
  });
  const replayable = runtimeEvents(quick).filter((event) =>
    event.status === 'replayable'
    && HISTORICAL_DEEP_EXPANSION_SESSIONS.includes(event.session as typeof HISTORICAL_DEEP_EXPANSION_SESSIONS[number])
    && event.chamber === HISTORICAL_DEEP_EXPANSION_CHAMBER);
  if (replayable.length === 0) throw new Error('Historical Deep expansion has no replayable development events');

  // Deliberately query no passed/yea/nay/member-choice columns here. `external_key` is the
  // source-derived non-outcome event discriminator enforced unique by the historical store.
  const metadataResult = await pool.query<EventMetadataRow>(`
    SELECT ve.id AS vote_event_id,
           ve.external_key,
           b.identifier,
           b.title,
           s.slug AS session_slug,
           c.slug AS chamber_slug,
           ve.occurred_on::text
      FROM vote_events ve
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
     WHERE ve.id = ANY($1::uuid[])
       AND s.slug = ANY($2::text[])
       AND c.slug = $3`, [
    replayable.map((event) => event.voteEventId),
    [...HISTORICAL_DEEP_EXPANSION_SESSIONS],
    HISTORICAL_DEEP_EXPANSION_CHAMBER,
  ]);
  const metadataByEvent = new Map(metadataResult.rows.map((row) => [row.vote_event_id, normalizedMetadata(row)]));
  const candidates = replayable.map((event) => {
    const metadata = metadataByEvent.get(event.voteEventId);
    if (!metadata) throw new Error(`Expansion event is missing stable metadata: ${event.voteEventId}`);
    return buildHistoricalDeepExpansionCandidate(event, metadata);
  });
  const selection = selectHistoricalDeepExpansionCases(candidates);

  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_COHORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'evaluation-only predeclared archive expansion cohort for historical Deep; freezes cases before any new source discovery, evidence extraction, or outcome scoring',
      selectionGuard: 'Only replayable pre-vote Quick fields plus stable bill/session/chamber/date identifiers and the source-derived external_key enter selection. Member actualOutcome is stripped before both target selectors, the metadata query loads no outcome columns, and the emitted artifact contains no floor outcome.',
      holdoutPolicy: 'The first expansion is restricted to 2021-22 and 2023-24 development sessions. 2025-26 is excluded from archive expansion/tuning at this stage.',
      sessions: HISTORICAL_DEEP_EXPANSION_SESSIONS,
      chamber: HISTORICAL_DEEP_EXPANSION_CHAMBER,
      targetLimit: HISTORICAL_DEEP_TARGET_LIMIT,
      perSessionPerTranche: HISTORICAL_DEEP_EXPANSION_PER_SESSION_PER_TRANCHE,
      totalSelected: selection.cases.length,
      pilotCasesExcluded: HISTORICAL_DEEP_PILOT_CASES.length,
      poolBySession: selection.poolBySession,
    },
    cases: selection.cases,
  };
}

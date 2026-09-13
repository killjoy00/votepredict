import type { Pool } from 'pg';
import {
  buildHistoricalDeepExpansionCandidate,
  selectHistoricalDeepExpansionCases,
  type HistoricalDeepExpansionCandidate,
  type HistoricalDeepExpansionSelectedCase,
  type HistoricalDeepExpansionMetadataRow,
} from './historical-deep-expansion-cohort';
import type { HistoricalQuickReplayEventResult } from './historical-quick-replay';
import { evaluateHistoricalQuickReplay } from './historical-quick-runtime';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_COHORT_SCHEMA = 'historical-deep-house-journal-holdout-cohort-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SESSIONS = ['2025-2026'] as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_CHAMBER = 'house' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE = 12;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_TOTAL = 24;

export interface HistoricalDeepHouseJournalHoldoutCohort {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_COHORT_SCHEMA;
  generatedAt: string;
  metadata: {
    codeSha: string | null;
    databaseSource: string | null;
    purpose: string;
    selectionGuard: string;
    outcomeRevealPolicy: string;
    sessions: readonly string[];
    chamber: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_CHAMBER;
    perSessionPerTranche: number;
    totalSelected: number;
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

export function selectHistoricalDeepHouseJournalHoldoutCases(
  candidates: readonly HistoricalDeepExpansionCandidate[],
): {
  cases: HistoricalDeepExpansionSelectedCase[];
  poolBySession: Record<string, number>;
} {
  const result = selectHistoricalDeepExpansionCases(candidates, {
    sessions: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SESSIONS,
    chamber: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_CHAMBER,
    perSessionPerTranche: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE,
  });
  if (result.cases.length !== HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_TOTAL) {
    throw new Error(`Expected ${HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_TOTAL} holdout cases, got ${result.cases.length}`);
  }
  const uniform = result.cases.filter((item) => item.tranche === 'deterministic-uniform').length;
  const disagreement = result.cases.filter((item) => item.tranche === 'selector-disagreement').length;
  if (
    uniform !== HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE
    || disagreement !== HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE
  ) {
    throw new Error(`Unexpected holdout tranche counts: uniform=${uniform}, disagreement=${disagreement}`);
  }
  return result;
}

export async function evaluateHistoricalDeepHouseJournalHoldoutCohort(
  pool: Pool,
  options: { codeSha?: string | null; databaseSource?: string | null } = {},
): Promise<HistoricalDeepHouseJournalHoldoutCohort> {
  const quick = await evaluateHistoricalQuickReplay(pool, {
    includeMembers: true,
    codeSha: options.codeSha ?? null,
    databaseSource: options.databaseSource ?? null,
  });
  const replayable = runtimeEvents(quick).filter((event) =>
    event.status === 'replayable'
    && HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SESSIONS.includes(event.session as typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SESSIONS[number])
    && event.chamber === HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_CHAMBER);
  if (replayable.length === 0) throw new Error('House Journal holdout has no replayable 2025-2026 House events');

  // Deliberately query stable event metadata only. No outcome, passed, YEA/NAY,
  // member-choice, Journal-source, or Journal-mechanic field is loaded here.
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
    [...HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SESSIONS],
    HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_CHAMBER,
  ]);
  const metadataByEvent = new Map(metadataResult.rows.map((row) => [row.vote_event_id, normalizedMetadata(row)]));
  const candidates = replayable.map((event) => {
    const metadata = metadataByEvent.get(event.voteEventId);
    if (!metadata) throw new Error(`House Journal holdout event is missing stable metadata: ${event.voteEventId}`);
    // buildHistoricalDeepExpansionCandidate strips actualOutcome before either
    // target selector runs, so target disagreement remains outcome-blind.
    return buildHistoricalDeepExpansionCandidate(event, metadata);
  });
  const selection = selectHistoricalDeepHouseJournalHoldoutCases(candidates);

  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_COHORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    metadata: {
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      purpose: 'independent 2025-2026 House validation cohort for the predeclared House Journal mechanics hypotheses; freezes case identity before any holdout Journal collection, mechanic extraction, or outcome reveal',
      selectionGuard: 'Selection reuses the predeclared expansion selector on 2025-2026 only. It uses replayable pre-vote Quick fields plus stable identifiers; actualOutcome is stripped before target selectors; the metadata query reads no outcome fields; and neither Journal availability nor mechanic presence can replace or rank cases.',
      outcomeRevealPolicy: 'This artifact contains no member vote outcome and no selected-event passed/failed value. Holdout outcomes may be joined only by a later workflow after this cohort, its Journal sources, and its mechanics have each been frozen immutably.',
      sessions: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SESSIONS,
      chamber: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_CHAMBER,
      perSessionPerTranche: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE,
      totalSelected: selection.cases.length,
      poolBySession: selection.poolBySession,
    },
    cases: selection.cases,
  };
}

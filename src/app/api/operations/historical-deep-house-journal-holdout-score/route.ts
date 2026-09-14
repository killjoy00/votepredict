import { NextResponse } from 'next/server';
import { evaluateHistoricalDeepExpansionDiscoveryManifest } from '@/evaluation/historical-deep-expansion-discovery';
import type { HistoricalDeepHouseJournalHoldoutCohort } from '@/evaluation/historical-deep-house-journal-holdout-cohort';
import type { HistoricalDeepHouseJournalHoldoutMechanicsArtifact } from '@/evaluation/historical-deep-house-journal-holdout-mechanics';
import {
  HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_OUTCOME_SCHEMA,
  historicalDeepHouseJournalHoldoutAsExpansionCohort,
  scoreHistoricalDeepHouseJournalHoldout,
  type HistoricalDeepHouseJournalHoldoutOutcomeCase,
  type HistoricalDeepHouseJournalHoldoutOutcomeSnapshot,
  type HistoricalDeepHouseJournalHoldoutPlan,
  type HistoricalDeepHouseJournalHoldoutScoreLineage,
} from '@/evaluation/historical-deep-house-journal-holdout-score';
import { pool } from '@/lib/db';

export const maxDuration = 300;

type RequestBody = {
  cohort: HistoricalDeepHouseJournalHoldoutCohort;
  mechanics: HistoricalDeepHouseJournalHoldoutMechanicsArtifact;
  plan: HistoricalDeepHouseJournalHoldoutPlan;
  lineage: HistoricalDeepHouseJournalHoldoutScoreLineage;
};

type EventRow = {
  vote_event_id: string;
  external_key: string;
  identifier: string;
  session_slug: string;
  chamber_slug: string;
  occurred_on: string;
  is_passage: boolean;
  passed: boolean | null;
};

type MemberRow = {
  vote_event_id: string;
  membership_id: string;
  legislator_id: string;
  choice: 'yea' | 'nay';
};

function preflight(body: RequestBody): void {
  if (body.cohort?.schemaVersion !== 'historical-deep-house-journal-holdout-cohort-v1' || body.cohort.cases?.length !== 24) {
    throw new Error('Frozen 24-case House Journal holdout cohort is required');
  }
  if (body.mechanics?.schemaVersion !== 'historical-deep-house-journal-holdout-mechanics-v1' || body.mechanics.cases?.length !== 24) {
    throw new Error('Frozen 24-case House Journal holdout mechanics artifact is required');
  }
  if (body.plan?.schemaVersion !== 'historical-deep-house-journal-holdout-plan-v1') {
    throw new Error('Frozen House Journal holdout plan is required');
  }
  if (body.lineage?.schemaVersion !== 'historical-deep-house-journal-holdout-score-lineage-v1') {
    throw new Error('Frozen House Journal holdout score lineage is required');
  }
  if (body.cohort.metadata.codeSha !== body.lineage.cohortArtifact.headSha) {
    throw new Error('Holdout cohort does not match pinned cohort lineage');
  }
  if (body.mechanics.metadata.parser !== 'deterministic-house-journal-mechanics-v1'
    || body.mechanics.metadata.outcomeUse !== 'none'
    || body.mechanics.metadata.probabilityAction !== 'none'
    || body.mechanics.observations.some((item) => item.mechanicallyActionable !== false || item.finalPassageInference !== 'none')) {
    throw new Error('Holdout mechanics are not the frozen non-actionable parser output');
  }
  if (body.lineage.policy.outcomeUse !== 'single-post-freeze-holdout-reveal'
    || body.lineage.policy.probabilityAction !== 'none'
    || body.lineage.policy.actionabilityDecision !== 'none') {
    throw new Error('Holdout score lineage policy drifted');
  }
  const cohortKeys = new Set(body.cohort.cases.map((item) => item.stableKey));
  const mechanicsKeys = new Set(body.mechanics.cases.map((item) => item.stableKey));
  if (cohortKeys.size !== 24 || mechanicsKeys.size !== 24 || [...cohortKeys].some((key) => !mechanicsKeys.has(key))) {
    throw new Error('Holdout cohort/mechanics stable-key lineage differs');
  }
  if (body.cohort.cases.some((item) => item.session !== '2025-2026' || item.chamber !== 'house')) {
    throw new Error('Holdout score supports only the frozen 2025-2026 House cohort');
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  try {
    const body = await request.json() as RequestBody;
    preflight(body);
    const runtimeCodeSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

    const discovery = await evaluateHistoricalDeepExpansionDiscoveryManifest(
      pool,
      historicalDeepHouseJournalHoldoutAsExpansionCohort(body.cohort),
      {
        codeSha: runtimeCodeSha,
        databaseSource: process.env.DATABASE_URL
          ? 'DATABASE_URL'
          : process.env.POSTGRES_URL
            ? 'POSTGRES_URL'
            : process.env.DATABASE_URL_UNPOOLED
              ? 'DATABASE_URL_UNPOOLED'
              : process.env.POSTGRES_URL_NON_POOLING
                ? 'POSTGRES_URL_NON_POOLING'
                : null,
      },
    );

    const voteIds = body.cohort.cases.map((item) => item.voteEventId);
    const eventResult = await pool.query<EventRow>(`
      SELECT ve.id AS vote_event_id,
             ve.external_key,
             b.identifier,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             ve.occurred_on::text,
             ve.is_passage,
             ve.passed
        FROM vote_events ve
        JOIN bills b ON b.id = ve.bill_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
       WHERE ve.id = ANY($1::uuid[])`, [voteIds]);
    const eventById = new Map(eventResult.rows.map((row) => [row.vote_event_id, row]));
    if (eventById.size !== 24) throw new Error(`Holdout outcome reveal resolved ${eventById.size}/24 vote events`);

    const memberResult = await pool.query<MemberRow>(`
      SELECT mv.vote_event_id,
             mv.membership_id,
             m.legislator_id,
             mv.choice
        FROM member_votes mv
        JOIN memberships m ON m.id = mv.membership_id
       WHERE mv.vote_event_id = ANY($1::uuid[])
         AND mv.choice IN ('yea', 'nay')
       ORDER BY mv.vote_event_id, m.legislator_id, mv.membership_id`, [voteIds]);
    const membersByVote = new Map<string, MemberRow[]>();
    for (const row of memberResult.rows) {
      const rows = membersByVote.get(row.vote_event_id) ?? [];
      rows.push(row);
      membersByVote.set(row.vote_event_id, rows);
    }

    const cases: HistoricalDeepHouseJournalHoldoutOutcomeCase[] = body.cohort.cases.map((spec) => {
      const event = eventById.get(spec.voteEventId);
      if (!event) throw new Error(`Missing holdout vote event ${spec.stableKey}`);
      if (event.external_key !== spec.externalKey || event.identifier !== spec.identifier
        || event.session_slug !== spec.session || event.chamber_slug !== spec.chamber || event.occurred_on !== spec.occurredOn) {
        throw new Error(`Holdout outcome lineage mismatch for ${spec.stableKey}`);
      }
      if (!event.is_passage || event.passed === null) throw new Error(`Holdout event is not a completed passage vote: ${spec.stableKey}`);
      const rows = membersByVote.get(spec.voteEventId) ?? [];
      if (rows.length === 0) throw new Error(`No decisive member outcomes for ${spec.stableKey}`);
      const seenLegislators = new Set<string>();
      for (const row of rows) {
        if (seenLegislators.has(row.legislator_id)) throw new Error(`Duplicate decisive legislator outcome for ${spec.stableKey}|${row.legislator_id}`);
        seenLegislators.add(row.legislator_id);
      }
      return {
        stableKey: spec.stableKey,
        caseKey: spec.caseKey,
        externalKey: spec.externalKey,
        tranche: spec.tranche,
        session: spec.session,
        chamber: spec.chamber,
        identifier: spec.identifier,
        occurredOn: spec.occurredOn,
        voteEventId: spec.voteEventId,
        passed: event.passed,
        members: rows.map((row) => ({
          membershipId: row.membership_id,
          legislatorId: row.legislator_id,
          actualOutcome: row.choice === 'yea' ? 1 as const : 0 as const,
        })),
      };
    });

    const outcomes: HistoricalDeepHouseJournalHoldoutOutcomeSnapshot = {
      schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_OUTCOME_SCHEMA,
      generatedAt: new Date().toISOString(),
      codeSha: runtimeCodeSha,
      purpose: 'single post-freeze holdout outcome reveal for the immutable 2025-2026 House Journal validation cohort; exact frozen vote-event IDs and source-derived external keys are revalidated; decisive YEA/NAY labels and selected-event passage result only; no forecast writes or serving changes',
      cases,
    };

    return NextResponse.json(scoreHistoricalDeepHouseJournalHoldout({
      cohort: body.cohort,
      mechanics: body.mechanics,
      discovery,
      outcomes,
      plan: body.plan,
      lineage: body.lineage,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical Deep House Journal holdout score failed', message);
    return NextResponse.json({ error: 'Historical Deep House Journal holdout score failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import type { HistoricalDeepDiscoveryCandidateBundle } from '@/evaluation/historical-deep-discovery-extractor';
import {
  scoreHistoricalDeepDiscoveryCandidates,
  validateHistoricalDeepDiscoveryCandidateBundle,
  type HistoricalDeepDiscoveryScoringCase,
} from '@/evaluation/historical-deep-discovery-score';
import {
  HISTORICAL_DEEP_PILOT_CASES,
  historicalDeepPilotCaseKey,
} from '@/evaluation/historical-deep-pilot';
import type { HistoricalQuickReplayEventResult } from '@/evaluation/historical-quick-replay';
import { evaluateHistoricalQuickReplay } from '@/evaluation/historical-quick-runtime';
import { pool } from '@/lib/db';

export const maxDuration = 300;

type EventMetadataRow = {
  vote_event_id: string;
  identifier: string;
  session_slug: string;
  chamber_slug: string;
  occurred_on: string;
};

function runtimeEvents(result: Record<string, unknown>): HistoricalQuickReplayEventResult[] {
  if (!Array.isArray(result.events)) throw new Error('Historical Quick replay did not return an events array');
  return result.events as HistoricalQuickReplayEventResult[];
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
    const bundle = await request.json() as HistoricalDeepDiscoveryCandidateBundle;
    validateHistoricalDeepDiscoveryCandidateBundle(bundle);

    const quick = await evaluateHistoricalQuickReplay(pool, {
      includeMembers: true,
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      databaseSource: process.env.DATABASE_URL
        ? 'DATABASE_URL'
        : process.env.POSTGRES_URL
          ? 'POSTGRES_URL'
          : process.env.DATABASE_URL_UNPOOLED
            ? 'DATABASE_URL_UNPOOLED'
            : process.env.POSTGRES_URL_NON_POOLING
              ? 'POSTGRES_URL_NON_POOLING'
              : null,
    });
    const replayById = new Map(runtimeEvents(quick).map((event) => [event.voteEventId, event]));

    const sessions = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.session))];
    const chambers = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.chamber))];
    const identifiers = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.identifier))];
    const occurredOn = [...new Set(HISTORICAL_DEEP_PILOT_CASES.map((spec) => spec.occurredOn))];
    const metadataResult = await pool.query<EventMetadataRow>(`
      SELECT ve.id AS vote_event_id,
             b.identifier,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             ve.occurred_on::text
        FROM vote_events ve
        JOIN bills b ON b.id = ve.bill_id
        JOIN legislative_sessions s ON s.id = ve.session_id
        JOIN chambers c ON c.id = ve.chamber_id
       WHERE ve.is_passage = true
         AND ve.passed IS NOT NULL
         AND s.slug = ANY($1::text[])
         AND c.slug = ANY($2::text[])
         AND b.identifier = ANY($3::text[])
         AND ve.occurred_on = ANY($4::date[])`, [sessions, chambers, identifiers, occurredOn]);

    const rowsByKey = new Map<string, EventMetadataRow[]>();
    for (const row of metadataResult.rows) {
      const key = historicalDeepPilotCaseKey({
        session: row.session_slug,
        chamber: row.chamber_slug,
        identifier: row.identifier,
        occurredOn: row.occurred_on,
      });
      const rows = rowsByKey.get(key) ?? [];
      rows.push(row);
      rowsByKey.set(key, rows);
    }

    const scoringCases: HistoricalDeepDiscoveryScoringCase[] = HISTORICAL_DEEP_PILOT_CASES.map((spec) => {
      const key = historicalDeepPilotCaseKey(spec);
      const rows = rowsByKey.get(key) ?? [];
      if (rows.length === 0) throw new Error(`Discovery scoring case is missing official passage metadata: ${key}`);
      if (rows.length > 1) throw new Error(`Discovery scoring case is ambiguous across official passage rows: ${key}`);
      const replay = replayById.get(rows[0].vote_event_id);
      if (!replay) throw new Error(`Discovery scoring case is missing from historical Quick replay: ${key}`);
      return { spec, replay };
    });

    const result = scoreHistoricalDeepDiscoveryCandidates(bundle, scoringCases);
    return NextResponse.json({
      runtime: {
        codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        databaseSource: quick.metadata && typeof quick.metadata === 'object'
          ? (quick.metadata as Record<string, unknown>).databaseSource ?? null
          : null,
      },
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical Deep discovery score failed', message);
    return NextResponse.json({ error: 'Historical Deep discovery score failed' }, { status: 500 });
  }
}

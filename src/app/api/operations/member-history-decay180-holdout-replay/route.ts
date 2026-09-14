import { NextResponse } from 'next/server';
import type { HistoricalDeepHouseJournalHoldoutCohort } from '@/evaluation/historical-deep-house-journal-holdout-cohort';
import type { HistoricalDeepHouseJournalHoldoutScoreArtifact } from '@/evaluation/historical-deep-house-journal-holdout-score';
import { evaluateMemberHistoryDecay180HoldoutReplay } from '@/evaluation/member-history-decay180-holdout-replay';
import { pool } from '@/lib/db';

export const maxDuration = 300;

type RequestBody = {
  cohort: HistoricalDeepHouseJournalHoldoutCohort;
  frozenScore: HistoricalDeepHouseJournalHoldoutScoreArtifact;
};

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
    const result = await evaluateMemberHistoryDecay180HoldoutReplay(pool, {
      cohort: body.cohort,
      frozenScore: body.frozenScore,
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Member history decay-180 holdout replay failed', message);
    return NextResponse.json({ error: 'Member history decay-180 holdout replay failed' }, { status: 500 });
  }
}

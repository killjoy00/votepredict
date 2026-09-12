import { NextResponse } from 'next/server';
import { evaluateHistoricalDeepExpansionCohort } from '@/evaluation/historical-deep-expansion-cohort';
import { pool } from '@/lib/db';

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  try {
    const result = await evaluateHistoricalDeepExpansionCohort(pool, {
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
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical Deep expansion cohort failed', message);
    return NextResponse.json({ error: 'Historical Deep expansion cohort failed' }, { status: 500 });
  }
}

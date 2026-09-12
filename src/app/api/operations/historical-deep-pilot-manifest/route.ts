import { NextResponse } from 'next/server';
import { evaluateHistoricalDeepPilotManifest } from '@/evaluation/historical-deep-pilot';
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
    const result = await evaluateHistoricalDeepPilotManifest(pool, {
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
    console.error('Historical Deep pilot manifest failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Historical Deep pilot manifest failed' }, { status: 500 });
  }
}

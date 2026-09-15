import { NextResponse } from 'next/server';
import { evaluateProcessHistoryResearchRuntime } from '@/evaluation/process-history-research-runtime';
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
    return NextResponse.json(await evaluateProcessHistoryResearchRuntime(pool, {
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
    }));
  } catch (error) {
    console.error('Process-history model research failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Process-history model research failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { evaluateMemberHistoryCapGrid } from '@/evaluation/member-history-cap-grid';
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
    const result = await evaluateMemberHistoryCapGrid(pool, {
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Member history cap drift evaluation failed', message);
    return NextResponse.json({ error: 'Member history cap drift evaluation failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { evaluateMemberHistoryDecay180PassageSafety } from '@/evaluation/member-history-decay180-passage-safety';
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
    const result = await evaluateMemberHistoryDecay180PassageSafety(pool, {
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Member history decay-180 passage safety audit failed', message);
    return NextResponse.json({ error: 'Member history decay-180 passage safety audit failed' }, { status: 500 });
  }
}

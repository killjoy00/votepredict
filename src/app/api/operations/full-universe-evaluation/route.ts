import { NextResponse } from 'next/server';
import { evaluateAuthoritativeFullUniverse } from '@/evaluation/full-universe';
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
    const result = await evaluateAuthoritativeFullUniverse(pool, process.env.VERCEL_GIT_COMMIT_SHA ?? null);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Full-universe evaluation failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Full-universe evaluation failed' }, { status: 500 });
  }
}

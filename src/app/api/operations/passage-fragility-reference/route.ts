import { NextResponse } from 'next/server';
import { materializePassageFragilityReference } from '@/evaluation/passage-fragility-reference';
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
    return NextResponse.json(await materializePassageFragilityReference(pool));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Passage fragility reference materialization failed', message);
    return NextResponse.json({ error: 'Passage fragility reference materialization failed' }, { status: 500 });
  }
}

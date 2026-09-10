import { NextResponse } from 'next/server';
import { runRevisorUniverseRefresh } from '@/operations/revisor-universe-refresh';

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
    const result = await runRevisorUniverseRefresh();
    return NextResponse.json({ generatedAt: new Date().toISOString(), ...result });
  } catch (error) {
    console.error('Revisor bill-universe refresh failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Revisor bill-universe refresh failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { runRevisorActionHistoryAudit } from '@/operations/revisor-action-audit';

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
    const result = await runRevisorActionHistoryAudit();
    return NextResponse.json({ generatedAt: new Date().toISOString(), ...result });
  } catch (error) {
    console.error('Revisor action-history audit failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Revisor action-history audit failed' }, { status: 500 });
  }
}

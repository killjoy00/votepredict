import { NextResponse } from 'next/server';
import {
  backfillRevisorProcessBatch,
  verifyRevisorProcessBackfill,
} from '@/operations/revisor-process-backfill';

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

function productionRuntime(): boolean {
  return !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production';
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!productionRuntime()) return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('verify') === '1') {
      return NextResponse.json(await verifyRevisorProcessBackfill());
    }
    const requested = Number(url.searchParams.get('limit') ?? 12);
    return NextResponse.json(await backfillRevisorProcessBatch(requested));
  } catch (error) {
    console.error('Revisor process backfill failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Revisor process backfill failed' }, { status: 500 });
  }
}

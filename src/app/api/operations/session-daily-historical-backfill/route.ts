import { NextResponse } from 'next/server';
import {
  backfillSessionDailyHistoricalBatch,
  verifySessionDailyHistoricalBackfill,
} from '@/operations/session-daily-historical-backfill';

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('verify') === '1') {
      return NextResponse.json(await verifySessionDailyHistoricalBackfill());
    }
    const pages = Number(url.searchParams.get('pages') ?? 3);
    return NextResponse.json(await backfillSessionDailyHistoricalBatch(pages));
  } catch (error) {
    console.error('Session Daily historical backfill failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({
      error: 'Session Daily historical backfill failed',
      failure: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
      },
    }, { status: 500 });
  }
}

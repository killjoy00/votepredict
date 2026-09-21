import { NextResponse } from 'next/server';
import {
  backfillHistoricalHouseResearchSummaryBatch,
  verifyHistoricalHouseResearchSummaryBackfill,
} from '@/operations/historical-house-research-summary-backfill';

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
      return NextResponse.json(await verifyHistoricalHouseResearchSummaryBackfill());
    }

    const session = url.searchParams.get('session');
    if (session !== '2021-2022' && session !== '2023-2024') {
      return NextResponse.json({ error: 'session must be 2021-2022 or 2023-2024' }, { status: 400 });
    }

    const limit = Number(url.searchParams.get('limit') ?? 6);
    return NextResponse.json(await backfillHistoricalHouseResearchSummaryBatch(session, limit));
  } catch (error) {
    console.error('Historical House Research summary backfill failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({
      error: 'Historical House Research summary backfill failed',
      failure: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
      },
    }, { status: 500 });
  }
}

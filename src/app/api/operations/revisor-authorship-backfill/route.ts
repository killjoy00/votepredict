import { NextResponse } from 'next/server';
import {
  backfillRevisorAuthorshipBatch,
  verifyRevisorAuthorshipBackfill,
} from '@/operations/revisor-authorship-backfill';

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
      return NextResponse.json(await verifyRevisorAuthorshipBackfill());
    }
    const limit = Number(url.searchParams.get('limit') ?? 12);
    return NextResponse.json(await backfillRevisorAuthorshipBatch(limit));
  } catch (error) {
    console.error('Revisor authorship backfill failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({
      error: 'Revisor authorship backfill failed',
      failure: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
      },
    }, { status: 500 });
  }
}

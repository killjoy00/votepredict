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

function safeFailure(error: unknown): { name: string; message: string } {
  const name = error instanceof Error ? error.name : 'Error';
  let message = error instanceof Error ? error.message : 'Unknown process backfill failure';
  message = message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(?:password|secret|token)=\S+/gi, '$1=[redacted]')
    .slice(0, 1000);
  return { name, message };
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
    const failure = safeFailure(error);
    console.error('Revisor process backfill failed', failure.name, failure.message);
    return NextResponse.json({ error: 'Revisor process backfill failed', failure }, { status: 500 });
  }
}

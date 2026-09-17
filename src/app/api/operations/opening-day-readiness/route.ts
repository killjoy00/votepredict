import { NextResponse } from 'next/server';
import { runOpeningDayReadiness } from '@/operations/opening-day-readiness';

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runOpeningDayReadiness();
    return NextResponse.json(result, { status: result.sourceReadiness.failClosed ? 409 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Opening Day readiness failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { ScorecardError } from '@/operations/scorecard';
import { listSafeOutcomeCandidates, resolveSafeForecastOutcome } from '@/operations/safe-resolution';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ forecastId: string }> };
type ResolveBody = { voteEventId?: string };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  try {
    const candidates = await listSafeOutcomeCandidates(forecastId, user.id);
    return NextResponse.json({ forecastId, candidates });
  } catch (error) {
    if (error instanceof ScorecardError) {
      return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
    }
    console.error('Outcome candidates failed', error);
    return NextResponse.json({ error: 'Could not load outcome candidates.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  const body = await request.json().catch(() => null) as ResolveBody | null;
  if (!body?.voteEventId) return NextResponse.json({ error: 'Choose an official passage vote.' }, { status: 400 });
  try {
    await resolveSafeForecastOutcome({ forecastId, ownerUserId: user.id, voteEventId: body.voteEventId });
    return NextResponse.json({ resolved: true });
  } catch (error) {
    if (error instanceof ScorecardError) {
      return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
    }
    console.error('Outcome reconciliation failed', error);
    return NextResponse.json({ error: 'Could not reconcile forecast outcome.' }, { status: 500 });
  }
}

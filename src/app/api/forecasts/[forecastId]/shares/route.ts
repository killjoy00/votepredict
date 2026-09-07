import { NextResponse } from 'next/server';
import { createShare, ForecastWorkflowError, listShares } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ forecastId: string }> };

type ShareBody = { revisionId?: string; label?: string };

function errorResponse(error: unknown) {
  if (error instanceof ForecastWorkflowError) {
    return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
  console.error('Share workflow failed', error);
  return NextResponse.json({ error: 'Share workflow failed.' }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  try {
    return NextResponse.json({ forecastId, shares: await listShares(forecastId, user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  const body = await request.json().catch(() => null) as ShareBody | null;
  if (!body?.revisionId) return NextResponse.json({ error: 'Choose a revision to share.' }, { status: 400 });
  try {
    const share = await createShare({
      forecastId,
      ownerUserId: user.id,
      revisionId: body.revisionId,
      label: body.label,
    });
    return NextResponse.json({ forecastId, share }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guard';
import { ForecastWorkflowError, listForecastRevisions, updateForecast } from '@/forecasting/workflows';

type RouteContext = { params: Promise<{ forecastId: string }> };

type UpdateBody = { researchMode?: 'quick' | 'deep' };

function workflowError(error: unknown) {
  if (error instanceof ForecastWorkflowError) {
    return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
  console.error('Forecast workflow request failed', error);
  return NextResponse.json({ error: 'Forecast workflow request failed.' }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  try {
    const revisions = await listForecastRevisions(forecastId, user.id);
    return NextResponse.json({ forecastId, revisions });
  } catch (error) {
    return workflowError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  const body = await request.json().catch(() => null) as UpdateBody | null;
  if (!body || (body.researchMode !== 'quick' && body.researchMode !== 'deep')) {
    return NextResponse.json({ error: 'Choose Quick or Deep mode.' }, { status: 400 });
  }
  try {
    const updated = await updateForecast(forecastId, user.id, body.researchMode);
    return NextResponse.json({
      forecastId,
      status: 'complete',
      researchMode: body.researchMode,
      result: updated.result,
      deepError: updated.deepError,
    }, { status: 201 });
  } catch (error) {
    return workflowError(error);
  }
}

import { NextResponse } from 'next/server';
import { diffForecastRevisions, ForecastWorkflowError } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ forecastId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'Choose two revisions to compare.' }, { status: 400 });

  try {
    const diff = await diffForecastRevisions(forecastId, user.id, from, to);
    return NextResponse.json({ forecastId, diff });
  } catch (error) {
    if (error instanceof ForecastWorkflowError) {
      return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
    }
    console.error('Revision diff failed', error);
    return NextResponse.json({ error: 'Revision diff failed.' }, { status: 500 });
  }
}

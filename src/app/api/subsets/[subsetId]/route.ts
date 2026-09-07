import { NextResponse } from 'next/server';
import { evaluateSubset, ForecastWorkflowError } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ subsetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { subsetId } = await context.params;
  const revisionId = new URL(request.url).searchParams.get('revisionId');
  if (!revisionId) return NextResponse.json({ error: 'revisionId is required.' }, { status: 400 });
  try {
    return NextResponse.json({ subset: await evaluateSubset(subsetId, user.id, revisionId) });
  } catch (error) {
    if (error instanceof ForecastWorkflowError) {
      return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
    }
    console.error('Subset evaluation failed', error);
    return NextResponse.json({ error: 'Subset evaluation failed.' }, { status: 500 });
  }
}

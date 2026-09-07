import { NextResponse } from 'next/server';
import { createSubset, ForecastWorkflowError, listSubsets } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ forecastId: string }> };

type SubsetBody = {
  revisionId?: string;
  name?: string;
  sourceKind?: 'custom' | 'committee';
  membershipIds?: string[];
  metadata?: Record<string, unknown>;
};

function errorResponse(error: unknown) {
  if (error instanceof ForecastWorkflowError) {
    return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
  console.error('Subset workflow failed', error);
  return NextResponse.json({ error: 'Subset workflow failed.' }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  try {
    return NextResponse.json({ forecastId, subsets: await listSubsets(forecastId, user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  const body = await request.json().catch(() => null) as SubsetBody | null;
  if (!body?.revisionId || !body.name?.trim() || !Array.isArray(body.membershipIds)) {
    return NextResponse.json({ error: 'Revision, subset name, and member selection are required.' }, { status: 400 });
  }
  try {
    const subset = await createSubset({
      forecastId,
      ownerUserId: user.id,
      revisionId: body.revisionId,
      name: body.name,
      membershipIds: body.membershipIds,
      sourceKind: body.sourceKind,
      metadata: body.metadata,
    });
    return NextResponse.json({ forecastId, subset }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

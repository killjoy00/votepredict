import { NextResponse } from 'next/server';
import { createScenario, ForecastWorkflowError, listScenarios } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ forecastId: string }> };

type ScenarioBody = {
  baseRevisionId?: string;
  name?: string;
  notes?: string;
  overrides?: Array<{ membershipId?: string; yesProbability?: number; rationale?: string }>;
};

function errorResponse(error: unknown) {
  if (error instanceof ForecastWorkflowError) {
    return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
  console.error('Scenario workflow failed', error);
  return NextResponse.json({ error: 'Scenario workflow failed.' }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  try {
    return NextResponse.json({ forecastId, scenarios: await listScenarios(forecastId, user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { forecastId } = await context.params;
  const body = await request.json().catch(() => null) as ScenarioBody | null;
  if (!body?.baseRevisionId || !body.name?.trim() || !Array.isArray(body.overrides)) {
    return NextResponse.json({ error: 'Base revision, scenario name, and overrides are required.' }, { status: 400 });
  }
  const overrides = body.overrides.map((override) => ({
    membershipId: override.membershipId ?? '',
    yesProbability: override.yesProbability ?? Number.NaN,
    rationale: override.rationale,
  }));
  if (overrides.some((override) => !override.membershipId)) {
    return NextResponse.json({ error: 'Every override must identify a member.' }, { status: 400 });
  }
  try {
    const scenario = await createScenario({
      forecastId,
      ownerUserId: user.id,
      baseRevisionId: body.baseRevisionId,
      name: body.name,
      notes: body.notes,
      overrides,
    });
    return NextResponse.json({ forecastId, scenario }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

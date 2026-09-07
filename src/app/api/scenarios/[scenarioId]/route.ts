import { NextResponse } from 'next/server';
import { evaluateScenario, ForecastWorkflowError } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ scenarioId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { scenarioId } = await context.params;
  try {
    return NextResponse.json({ scenario: await evaluateScenario(scenarioId, user.id) });
  } catch (error) {
    if (error instanceof ForecastWorkflowError) {
      return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
    }
    console.error('Scenario evaluation failed', error);
    return NextResponse.json({ error: 'Scenario evaluation failed.' }, { status: 500 });
  }
}

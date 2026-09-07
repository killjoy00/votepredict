import { NextResponse } from 'next/server';
import { ForecastWorkflowError, revokeShare } from '@/forecasting/workflows';
import { requireOwner } from '@/lib/auth/guard';

type RouteContext = { params: Promise<{ shareId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireOwner();
  const { shareId } = await context.params;
  try {
    await revokeShare(shareId, user.id);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    if (error instanceof ForecastWorkflowError) {
      return NextResponse.json({ error: error.message, errorCode: error.code }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
    }
    console.error('Share revocation failed', error);
    return NextResponse.json({ error: 'Share revocation failed.' }, { status: 500 });
  }
}

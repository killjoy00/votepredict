import { NextResponse } from 'next/server';
import { forecastSourceChamberPassageAtIntroduction } from '@/forecasting/introduction-runtime';
import { requireOwner } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = {
  billId?: string;
};

export async function POST(request: Request) {
  await requireOwner();
  const body = await request.json().catch(() => null) as Body | null;
  const billId = body?.billId?.trim();
  if (!billId) return NextResponse.json({ error: 'Choose an official bill.' }, { status: 400 });

  try {
    const result = await forecastSourceChamberPassageAtIntroduction(billId);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Introduction forecast failed.';
    console.error('Introduction forecast failed', { billId, message });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

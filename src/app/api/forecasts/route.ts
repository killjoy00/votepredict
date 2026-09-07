import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { bills, chambers, forecasts, legislativeSessions, proposals } from '@/lib/db/schema';

type CreateForecastBody = {
  sourceMode?: 'official' | 'proposal';
  billId?: string;
  proposalTitle?: string;
  proposalText?: string;
  chamberId?: string;
  researchMode?: 'quick' | 'deep';
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const user = await requireOwner();
  const body = await request.json().catch(() => null) as CreateForecastBody | null;

  if (!body) return badRequest('Invalid request body.');
  if (body.sourceMode !== 'official' && body.sourceMode !== 'proposal') return badRequest('Choose an official bill or proposed text.');
  if (body.researchMode !== 'quick' && body.researchMode !== 'deep') return badRequest('Choose Quick or Deep mode.');
  if (!body.chamberId) return badRequest('Choose a target chamber.');

  const [session] = await db
    .select({ id: legislativeSessions.id, jurisdictionId: legislativeSessions.jurisdictionId })
    .from(legislativeSessions)
    .where(eq(legislativeSessions.isCurrent, true))
    .limit(1);

  if (!session) return NextResponse.json({ error: 'No current legislative session is configured.' }, { status: 409 });

  const [targetChamber] = await db
    .select({ id: chambers.id })
    .from(chambers)
    .where(and(eq(chambers.id, body.chamberId), eq(chambers.jurisdictionId, session.jurisdictionId)))
    .limit(1);

  if (!targetChamber) return badRequest('The target chamber is not part of the current jurisdiction.');

  let billId: string | null = null;
  let proposalId: string | null = null;

  if (body.sourceMode === 'official') {
    if (!body.billId) return badRequest('Choose an official bill.');

    const [bill] = await db
      .select({ id: bills.id })
      .from(bills)
      .where(and(eq(bills.id, body.billId), eq(bills.sessionId, session.id)))
      .limit(1);

    if (!bill) return badRequest('The selected bill is not in the current session.');
    billId = bill.id;
  } else {
    const rawText = body.proposalText?.trim() ?? '';
    if (rawText.length < 20) return badRequest('Proposed text must be at least 20 characters.');

    const title = body.proposalTitle?.trim() || 'Untitled proposal';
    const [proposal] = await db
      .insert(proposals)
      .values({
        ownerUserId: user.id,
        title: title.slice(0, 240),
        rawText,
        targetChamberId: targetChamber.id,
      })
      .returning({ id: proposals.id });

    proposalId = proposal.id;
  }

  const [forecast] = await db
    .insert(forecasts)
    .values({
      ownerUserId: user.id,
      targetType: body.sourceMode === 'official' ? 'bill' : 'proposal',
      billId,
      proposalId,
      targetChamberId: targetChamber.id,
      status: 'draft',
    })
    .returning({ id: forecasts.id });

  return NextResponse.json({
    forecastId: forecast.id,
    status: 'draft',
    researchMode: body.researchMode,
  }, { status: 201 });
}

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { executeDeepRuntimeForecast } from '@/forecasting/deep-runtime';
import { executeRuntimeForecast, ForecastRuntimeError, type ForecastRuntimeSubject } from '@/forecasting/runtime';
import { floorTargetForChamber, forecastTargetDefinition } from '@/forecasting/targets';
import { requireOwner } from '@/lib/auth/guard';
import { db, pool } from '@/lib/db';
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

function metadataCompanionIdentifier(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const revisor = (metadata as Record<string, unknown>).revisor;
  if (!revisor || typeof revisor !== 'object') return undefined;
  const value = (revisor as Record<string, unknown>).companionIdentifier;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Forecast execution failed.';
}

export async function POST(request: Request) {
  const user = await requireOwner();
  const body = await request.json().catch(() => null) as CreateForecastBody | null;

  if (!body) return badRequest('Invalid request body.');
  if (body.sourceMode !== 'official' && body.sourceMode !== 'proposal') return badRequest('Choose an official bill or proposed text.');
  if (body.researchMode !== 'quick' && body.researchMode !== 'deep') return badRequest('Choose Quick or Deep mode.');
  if (!body.chamberId) return badRequest('Choose a target chamber.');

  const [session] = await db
    .select({
      id: legislativeSessions.id,
      slug: legislativeSessions.slug,
      jurisdictionId: legislativeSessions.jurisdictionId,
    })
    .from(legislativeSessions)
    .where(eq(legislativeSessions.isCurrent, true))
    .limit(1);

  if (!session) return NextResponse.json({ error: 'No current legislative session is configured.' }, { status: 409 });

  const [targetChamber] = await db
    .select({ id: chambers.id, slug: chambers.slug, name: chambers.name })
    .from(chambers)
    .where(and(eq(chambers.id, body.chamberId), eq(chambers.jurisdictionId, session.jurisdictionId)))
    .limit(1);

  if (!targetChamber) return badRequest('The target chamber is not part of the current jurisdiction.');

  let billId: string | null = null;
  let proposalId: string | null = null;
  let subject: ForecastRuntimeSubject;

  if (body.sourceMode === 'official') {
    if (!body.billId) return badRequest('Choose an official bill.');

    const [bill] = await db
      .select({
        id: bills.id,
        identifier: bills.identifier,
        title: bills.title,
        sourceUrl: bills.sourceUrl,
        metadata: bills.metadata,
      })
      .from(bills)
      .where(and(eq(bills.id, body.billId), eq(bills.sessionId, session.id)))
      .limit(1);

    if (!bill) return badRequest('The selected bill is not in the current session.');
    billId = bill.id;
    subject = {
      kind: 'bill',
      billId: bill.id,
      identifier: bill.identifier,
      title: bill.title,
      sessionId: session.id,
      sessionSlug: session.slug,
      sourceUrl: bill.sourceUrl,
      companionIdentifier: metadataCompanionIdentifier(bill.metadata),
    };
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
      .returning({ id: proposals.id, title: proposals.title, rawText: proposals.rawText });

    proposalId = proposal.id;
    subject = {
      kind: 'proposal',
      proposalId: proposal.id,
      title: proposal.title,
      text: proposal.rawText ?? rawText,
      sessionId: session.id,
      sessionSlug: session.slug,
    };
  }

  const targetKind = floorTargetForChamber(targetChamber.slug);
  const [forecast] = await db
    .insert(forecasts)
    .values({
      ownerUserId: user.id,
      targetType: body.sourceMode === 'official' ? 'bill' : 'proposal',
      targetKind,
      conditionalOn: forecastTargetDefinition(targetKind).conditionalOn,
      billId,
      proposalId,
      targetChamberId: targetChamber.id,
      status: 'draft',
    })
    .returning({ id: forecasts.id });

  // PR 9 pins every forecast identity to the session in which it was created so proposal
  // updates remain reproducible after the jurisdiction's current session changes.
  await pool.query(`UPDATE forecasts SET session_id = $2 WHERE id = $1`, [forecast.id, session.id]);

  const baseRequest = {
    forecastId: forecast.id,
    chamberId: targetChamber.id,
    chamberSlug: targetChamber.slug,
    chamberName: targetChamber.name,
    subject,
  };

  try {
    const quick = await executeRuntimeForecast({
      ...baseRequest,
      researchMode: 'quick',
    });

    if (body.researchMode === 'quick') {
      return NextResponse.json({
        forecastId: forecast.id,
        detailPath: `/dashboard/forecasts/${forecast.id}`,
        status: 'ready',
        researchMode: 'quick',
        result: quick,
      }, { status: 201 });
    }

    try {
      const deep = await executeDeepRuntimeForecast({
        ...baseRequest,
        researchMode: 'deep',
        asOf: quick.asOf,
      }, quick);
      return NextResponse.json({
        forecastId: forecast.id,
        detailPath: `/dashboard/forecasts/${forecast.id}`,
        status: 'ready',
        researchMode: 'deep',
        result: deep,
      }, { status: 201 });
    } catch (error) {
      return NextResponse.json({
        forecastId: forecast.id,
        detailPath: `/dashboard/forecasts/${forecast.id}`,
        status: 'ready',
        researchMode: 'deep',
        result: quick,
        deepError: errorMessage(error),
      }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof ForecastRuntimeError) {
      return NextResponse.json({
        forecastId: forecast.id,
        detailPath: `/dashboard/forecasts/${forecast.id}`,
        status: 'draft',
        researchMode: body.researchMode,
        errorCode: error.code,
        error: error.message,
      }, { status: 409 });
    }

    console.error('Forecast execution failed', error);
    return NextResponse.json({
      forecastId: forecast.id,
      detailPath: `/dashboard/forecasts/${forecast.id}`,
      status: 'draft',
      researchMode: body.researchMode,
      error: 'Forecast execution failed before a valid revision could be produced.',
    }, { status: 500 });
  }
}

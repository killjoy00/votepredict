import { NextResponse } from 'next/server';
import {
  backfillRevisorIntroductionBatch,
  verifyRevisorIntroductionBackfill,
  type IntroductionBackfillChamber,
} from '@/operations/revisor-introduction-backfill';

export const maxDuration = 300;

type BatchRequest = {
  action: 'batch';
  session: string;
  chamber: IntroductionBackfillChamber;
  afterBillNumber?: number;
  limit?: number;
};

type VerifyRequest = { action: 'verify' };
type RequestBody = BatchRequest | VerifyRequest;

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 500);
}

function isChamber(value: unknown): value is IntroductionBackfillChamber {
  return value === 'house' || value === 'senate';
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (body.action === 'verify') {
      return NextResponse.json(await verifyRevisorIntroductionBackfill());
    }
    if (body.action !== 'batch' || typeof body.session !== 'string' || !isChamber(body.chamber)) {
      return NextResponse.json({ error: 'Expected batch action with a supported session and chamber' }, { status: 400 });
    }
    const result = await backfillRevisorIntroductionBatch({
      session: body.session,
      chamber: body.chamber,
      afterBillNumber: body.afterBillNumber,
      limit: body.limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Revisor introduction backfill request failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

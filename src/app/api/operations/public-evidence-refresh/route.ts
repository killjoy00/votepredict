import { NextResponse } from 'next/server';
import { runPublicEvidenceRefresh } from '@/evidence/public-evidence-refresh';

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  const url = new URL(request.url);
  const requestedBatch = Number(url.searchParams.get('batch') ?? '12');
  const batchSize = Number.isFinite(requestedBatch) ? requestedBatch : 12;
  const forceCampaignFinance = url.searchParams.get('forceFinance') === '1';

  try {
    const result = await runPublicEvidenceRefresh({ batchSize, forceCampaignFinance });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Public evidence refresh failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({
      error: 'Public evidence refresh failed',
      failure: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600),
      },
    }, { status: 500 });
  }
}

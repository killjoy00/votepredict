import { runLiveCampaignFinanceRefresh } from '@/evidence/live-campaign-finance-refresh';
import { runProductionEvidenceRefresh } from '@/evidence/production-refresh';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  try {
    const result = await runProductionEvidenceRefresh();
    const liveCampaignFinance = await runLiveCampaignFinanceRefresh();
    return NextResponse.json({ generatedAt: new Date().toISOString(), ...result, liveCampaignFinance });
  } catch (error) {
    console.error('Production evidence refresh failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Evidence refresh failed' }, { status: 500 });
  }
}

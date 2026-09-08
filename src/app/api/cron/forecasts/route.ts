import { NextResponse } from 'next/server';
import { runScheduledForecasts } from '@/operations/scheduled-forecasts';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runScheduledForecasts(Number(process.env.FORECAST_BATCH_SIZE ?? 10));
  return NextResponse.json({ generatedAt: new Date().toISOString(), ...result });
}

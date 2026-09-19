import { NextResponse } from 'next/server';
import { evaluateQuickEvidenceLegislativeScreen } from '@/evaluation/quick-evidence-legislative-screen';
import { pool } from '@/lib/db';

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
    const result = await evaluateQuickEvidenceLegislativeScreen(pool, {
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Quick Evidence legislative screen failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({
      error: 'Quick Evidence legislative screen failed',
      failure: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
      },
    }, { status: 500 });
  }
}

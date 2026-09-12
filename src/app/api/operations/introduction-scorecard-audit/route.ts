import { NextResponse } from 'next/server';
import { getIntroductionServingScorecard } from '@/operations/introduction-scorecard';

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  const startedAt = Date.now();
  try {
    const scorecard = await getIntroductionServingScorecard();
    return NextResponse.json({
      runtimeCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      durationMs: Date.now() - startedAt,
      scorecard,
    });
  } catch (error) {
    console.error('Introduction serving scorecard audit failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Introduction serving scorecard audit failed' }, { status: 500 });
  }
}

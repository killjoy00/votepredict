import { NextResponse } from 'next/server';
import { auditHistoricalDeepTargetSelection } from '@/evaluation/historical-deep-target-audit';
import type { HistoricalQuickReplayEventResult } from '@/evaluation/historical-quick-replay';
import { evaluateHistoricalQuickReplay } from '@/evaluation/historical-quick-runtime';
import { pool } from '@/lib/db';

export const maxDuration = 300;

function runtimeEvents(result: Record<string, unknown>): HistoricalQuickReplayEventResult[] {
  if (!Array.isArray(result.events)) throw new Error('Historical Quick replay did not return an events array');
  return result.events as HistoricalQuickReplayEventResult[];
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  try {
    const quick = await evaluateHistoricalQuickReplay(pool, {
      includeMembers: true,
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      databaseSource: process.env.DATABASE_URL
        ? 'DATABASE_URL'
        : process.env.POSTGRES_URL
          ? 'POSTGRES_URL'
          : process.env.DATABASE_URL_UNPOOLED
            ? 'DATABASE_URL_UNPOOLED'
            : process.env.POSTGRES_URL_NON_POOLING
              ? 'POSTGRES_URL_NON_POOLING'
              : null,
    });
    const audit = auditHistoricalDeepTargetSelection(runtimeEvents(quick));
    return NextResponse.json({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        databaseSource: quick.metadata && typeof quick.metadata === 'object'
          ? (quick.metadata as Record<string, unknown>).databaseSource ?? null
          : null,
        purpose: audit.metadata.purpose,
        targetLimit: audit.metadata.targetLimit,
        highConfidenceThreshold: audit.metadata.highConfidenceThreshold,
      },
      quickReadiness: quick.readiness ?? null,
      quickScore: quick.score ?? null,
      overall: audit.overall,
      events: audit.events,
      missedHighConfidenceErrors: audit.missedHighConfidenceErrors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical Deep target audit failed', message);
    return NextResponse.json({ error: 'Historical Deep target audit failed' }, { status: 500 });
  }
}

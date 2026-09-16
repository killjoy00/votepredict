import { NextResponse } from 'next/server';
import { evaluatePublicEvidenceQuickScreen } from '@/evaluation/public-evidence-quick-screen';
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
    const raw = await evaluatePublicEvidenceQuickScreen(pool, {
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });

    // CFB bulk rows contain transaction dates, but ordinary periodic-report rows do
    // not provide a universal item-level timestamp proving when each transaction first
    // became public. Therefore this retrospective screen is useful only as an upper-bound
    // signal check. It must never become promotion-eligible or nominate a shadow model.
    const result = {
      ...raw,
      purpose: 'exploratory retrospective sensitivity screen of non-directional campaign-finance activity as an incremental offset to serving Quick member probabilities; historical public-availability timing is not reconstructed, so results are hypothesis-only',
      metadata: {
        ...raw.metadata,
        evaluationStatus: 'exploratory_not_promotion_eligible',
        availabilityBoundary: 'features use official CFB transaction dates strictly before each target vote; periodic filing/public-availability timestamps are not available at item level in the bulk rows, so this is not a leakage-safe as-of replay',
        promotionEligible: false,
        shadowNominationEligible: false,
      },
      conclusion: {
        ...raw.conclusion,
        productionAction: 'none',
        servingQuickChanged: false,
        prospectiveShadowNomination: false,
        hypothesisSignal: raw.conclusion.prospectiveShadowNomination,
        note: 'Any retrospective finance improvement is hypothesis-generating only because transaction date does not prove public availability on that date. Finance must be captured prospectively with fetched-at provenance before it can qualify for a Quick shadow or serving change.',
      },
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Public evidence Quick screen failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({
      error: 'Public evidence Quick screen failed',
      failure: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
      },
    }, { status: 500 });
  }
}
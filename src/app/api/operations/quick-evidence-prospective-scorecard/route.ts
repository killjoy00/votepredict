import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guard';
import { pool } from '@/lib/db';
import { getQuickEvidenceProspectiveScorecard } from '@/operations/quick-evidence-prospective-scorecard';

export async function GET() {
  await requireOwner();
  try {
    const scorecard = await getQuickEvidenceProspectiveScorecard(pool);
    return NextResponse.json(scorecard);
  } catch (error) {
    console.error('Quick Evidence prospective scorecard failed', error);
    return NextResponse.json({ error: 'Could not load Quick Evidence prospective scorecard.' }, { status: 500 });
  }
}

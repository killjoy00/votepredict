import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guard';
import { getProspectiveShadowCaptureHealth } from '@/operations/prospective-shadow-health';
import { captureHealth } from '@/operations/forecast-capture-observability';
import { pool } from '@/lib/db';

export async function GET() {
  await requireOwner();
  try {
    const capture = await getProspectiveShadowCaptureHealth();
    return NextResponse.json({...capture,captureIntegrity:await captureHealth(pool)});
  } catch (error) {
    console.error('Prospective shadow health failed', error);
    return NextResponse.json({ error: 'Could not load prospective shadow capture health.' }, { status: 500 });
  }
}

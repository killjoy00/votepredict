import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guard';
import { getProspectiveShadowCaptureHealth } from '@/operations/prospective-shadow-health';

export async function GET() {
  await requireOwner();
  try {
    const capture = await getProspectiveShadowCaptureHealth();
    return NextResponse.json(capture);
  } catch (error) {
    console.error('Prospective shadow health failed', error);
    return NextResponse.json({ error: 'Could not load prospective shadow capture health.' }, { status: 500 });
  }
}

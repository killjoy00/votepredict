import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { bills, legislativeSessions } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await requireOwner();

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ bills: [] });
  }

  const [currentSession] = await db
    .select({ id: legislativeSessions.id })
    .from(legislativeSessions)
    .where(eq(legislativeSessions.isCurrent, true))
    .limit(1);

  if (!currentSession) {
    return NextResponse.json({ bills: [] });
  }

  const pattern = `%${query}%`;
  const matches = await db
    .select({
      id: bills.id,
      identifier: bills.identifier,
      title: bills.title,
      status: bills.status,
      sourceUrl: bills.sourceUrl,
    })
    .from(bills)
    .where(and(
      eq(bills.sessionId, currentSession.id),
      or(ilike(bills.identifier, pattern), ilike(bills.title, pattern)),
    ))
    .orderBy(asc(bills.identifier))
    .limit(8);

  return NextResponse.json({ bills: matches });
}

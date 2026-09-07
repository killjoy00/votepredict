import { asc, eq } from 'drizzle-orm';
import { requireOwner } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { chambers, legislativeSessions } from '@/lib/db/schema';
import { ForecastWorkspace } from './forecast-workspace';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireOwner();

  const [session] = await db
    .select({
      id: legislativeSessions.id,
      name: legislativeSessions.name,
      jurisdictionId: legislativeSessions.jurisdictionId,
    })
    .from(legislativeSessions)
    .where(eq(legislativeSessions.isCurrent, true))
    .limit(1);

  const chamberOptions = session
    ? await db
      .select({ id: chambers.id, name: chambers.name, kind: chambers.kind })
      .from(chambers)
      .where(eq(chambers.jurisdictionId, session.jurisdictionId))
      .orderBy(asc(chambers.kind), asc(chambers.name))
    : [];

  return (
    <ForecastWorkspace
      ownerEmail={user.email ?? 'Owner'}
      session={session ? { id: session.id, name: session.name } : null}
      chambers={chamberOptions}
    />
  );
}

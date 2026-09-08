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

  const deskLinkStyle = {
    border: '1px solid #ccd6cf',
    borderRadius: 999,
    padding: '8px 12px',
    color: '#315342',
    background: 'rgba(250, 252, 249, .96)',
    boxShadow: '0 6px 22px rgb(31 55 42 / 12%)',
    fontSize: 10,
    fontWeight: 760,
    textDecoration: 'none',
  } as const;

  return (
    <>
      <nav
        aria-label="Private workspace tools"
        style={{
          position: 'fixed',
          right: 14,
          bottom: 14,
          zIndex: 30,
          display: 'flex',
          gap: 7,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        <a href="/dashboard/gambling" style={deskLinkStyle}>Gambling</a>
        <a href="/dashboard/legislators" style={deskLinkStyle}>Legislators</a>
        <a href="/dashboard/operations" style={deskLinkStyle}>Health + scorecard</a>
        <a href="/dashboard/forecasts" style={deskLinkStyle}>Forecast history →</a>
      </nav>
      <ForecastWorkspace
        ownerEmail={user.email ?? 'Owner'}
        session={session ? { id: session.id, name: session.name } : null}
        chambers={chamberOptions}
      />
    </>
  );
}

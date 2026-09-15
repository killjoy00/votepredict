import { NextResponse } from 'next/server';
import { floorTargetForChamber, forecastTargetDefinition } from '@/forecasting/targets';
import { requireOwner } from '@/lib/auth/guard';
import { pool } from '@/lib/db';

const FIXTURE_PREFIX = '[VotePredict release smoke]';
const FIXTURE_TEXT = [
  'Release-smoke fixture only.',
  'This proposal would require state agencies to publish a quarterly public inventory of active administrative rules, implementation status, and the date of the most recent review.',
  'The fixture exists only to validate authenticated production forecast workflows and is not a policy recommendation or a real legislative forecast.',
].join(' ');

type SessionRow = {
  id: string;
  slug: string;
  name: string;
  jurisdiction_id: string;
};

type ChamberRow = {
  id: string;
  slug: string;
  name: string;
  member_count: number;
};

type FixtureRow = {
  forecast_id: string;
  proposal_id: string;
  chamber_id: string;
  chamber_slug: string;
  chamber_name: string;
  member_count: number;
};

async function currentSession(): Promise<SessionRow | undefined> {
  const result = await pool.query<SessionRow>(`
    SELECT id, slug, name, jurisdiction_id
      FROM legislative_sessions
     WHERE is_current = true
     ORDER BY starts_on DESC NULLS LAST, created_at DESC
     LIMIT 1`);
  return result.rows[0];
}

async function currentFixture(ownerUserId: string, sessionId: string): Promise<FixtureRow | undefined> {
  const result = await pool.query<FixtureRow>(`
    SELECT f.id AS forecast_id,
           p.id AS proposal_id,
           c.id AS chamber_id,
           c.slug AS chamber_slug,
           c.name AS chamber_name,
           count(m.id)::int AS member_count
      FROM forecasts f
      JOIN proposals p ON p.id = f.proposal_id
      JOIN chambers c ON c.id = f.target_chamber_id
      LEFT JOIN memberships m ON m.chamber_id = c.id AND m.session_id = f.session_id
     WHERE f.owner_user_id = $1
       AND f.session_id = $2
       AND f.target_type = 'proposal'
       AND f.status = 'release-smoke'
       AND f.archived_at IS NOT NULL
       AND p.title LIKE $3
     GROUP BY f.id, p.id, c.id, c.slug, c.name
     ORDER BY f.created_at DESC
     LIMIT 1`, [ownerUserId, sessionId, `${FIXTURE_PREFIX}%`]);
  return result.rows[0];
}

async function cheapestSupportedChamber(session: SessionRow): Promise<ChamberRow | undefined> {
  const result = await pool.query<ChamberRow>(`
    SELECT c.id,
           c.slug,
           c.name,
           count(m.id)::int AS member_count
      FROM chambers c
      JOIN memberships m ON m.chamber_id = c.id AND m.session_id = $1
     WHERE c.jurisdiction_id = $2
       AND c.slug IN ('house', 'senate')
     GROUP BY c.id, c.slug, c.name
    HAVING count(m.id) > 0
     ORDER BY count(m.id) ASC, c.slug ASC
     LIMIT 1`, [session.id, session.jurisdiction_id]);
  return result.rows[0];
}

export async function POST() {
  const user = await requireOwner();
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: 'No current legislative session is configured.' }, { status: 409 });

  const existing = await currentFixture(user.id, session.id);
  if (existing) {
    return NextResponse.json({
      forecastId: existing.forecast_id,
      proposalId: existing.proposal_id,
      session: { id: session.id, slug: session.slug, name: session.name },
      chamber: { id: existing.chamber_id, slug: existing.chamber_slug, name: existing.chamber_name, memberCount: Number(existing.member_count) },
      reused: true,
    });
  }

  const chamber = await cheapestSupportedChamber(session);
  if (!chamber) return NextResponse.json({ error: 'No supported current-session chamber with members is available for release smoke.' }, { status: 409 });

  const targetKind = floorTargetForChamber(chamber.slug);
  const target = forecastTargetDefinition(targetKind);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const proposalResult = await client.query<{ id: string }>(`
      INSERT INTO proposals (owner_user_id, title, description, raw_text, target_chamber_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`, [
      user.id,
      `${FIXTURE_PREFIX} ${session.name}`.slice(0, 240),
      'Archived production fixture used only by the owner-only Operations release smoke harness.',
      FIXTURE_TEXT,
      chamber.id,
    ]);
    const proposalId = proposalResult.rows[0]?.id;
    if (!proposalId) throw new Error('Release smoke proposal could not be created.');

    const forecastResult = await client.query<{ id: string }>(`
      INSERT INTO forecasts (
        owner_user_id, target_type, target_kind, conditional_on, proposal_id,
        target_chamber_id, session_id, status, archived_at
      ) VALUES ($1, 'proposal', $2, $3, $4, $5, $6, 'release-smoke', now())
      RETURNING id`, [
      user.id,
      targetKind,
      target.conditionalOn ?? null,
      proposalId,
      chamber.id,
      session.id,
    ]);
    const forecastId = forecastResult.rows[0]?.id;
    if (!forecastId) throw new Error('Release smoke forecast could not be created.');
    await client.query('COMMIT');

    return NextResponse.json({
      forecastId,
      proposalId,
      session: { id: session.id, slug: session.slug, name: session.name },
      chamber: { id: chamber.id, slug: chamber.slug, name: chamber.name, memberCount: Number(chamber.member_count) },
      reused: false,
    }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Release smoke fixture setup failed', error);
    return NextResponse.json({ error: 'Release smoke fixture setup failed.' }, { status: 500 });
  } finally {
    client.release();
  }
}

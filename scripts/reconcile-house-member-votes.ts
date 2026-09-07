import { Pool, type PoolClient } from 'pg';
import { reconcileHouseMemberName, type MembershipCandidate } from '../src/sources/minnesota/member-reconciliation.js';
import { getMinnesotaHouseSession, MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '../src/sources/minnesota/sessions.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function loadCandidates(client: PoolClient, sessionId: string, chamberId: string): Promise<MembershipCandidate[]> {
  const memberships = await client.query<{
    membership_id: string;
    legislator_id: string;
    name: string;
    normalized_name: string;
  }>(
    `SELECT m.id AS membership_id, l.id AS legislator_id, l.name, l.normalized_name
       FROM memberships m
       JOIN legislators l ON l.id = m.legislator_id
      WHERE m.session_id = $1 AND m.chamber_id = $2`,
    [sessionId, chamberId],
  );

  const aliases = await client.query<{
    membership_id: string;
    source_name: string;
  }>(
    `SELECT a.membership_id, a.source_name
       FROM membership_source_aliases a
       JOIN memberships m ON m.id = a.membership_id
      WHERE m.session_id = $1 AND m.chamber_id = $2`,
    [sessionId, chamberId],
  );
  const aliasesByMembership = new Map<string, string[]>();
  for (const row of aliases.rows) {
    const values = aliasesByMembership.get(row.membership_id) ?? [];
    values.push(row.source_name);
    aliasesByMembership.set(row.membership_id, values);
  }

  return memberships.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    name: row.name,
    normalizedName: row.normalized_name,
    aliases: aliasesByMembership.get(row.membership_id),
  }));
}

async function resolveSession(client: PoolClient, sessionSlug: string): Promise<{ sessionId: string; chamberId: string } | undefined> {
  const result = await client.query<{ session_id: string; chamber_id: string }>(
    `SELECT s.id AS session_id, c.id AS chamber_id
       FROM legislative_sessions s
       JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       JOIN chambers c ON c.jurisdiction_id = j.id AND c.slug = 'house'
      WHERE s.slug = $1`,
    [sessionSlug],
  );
  return result.rows[0] ? { sessionId: result.rows[0].session_id, chamberId: result.rows[0].chamber_id } : undefined;
}

async function reconcileSession(client: PoolClient, sessionSlug: string): Promise<{ matched: number; ambiguous: number; unmatched: number }> {
  const context = await resolveSession(client, sessionSlug);
  if (!context) {
    console.log(`[${sessionSlug}] no persisted House session; skipping`);
    return { matched: 0, ambiguous: 0, unmatched: 0 };
  }

  const candidates = await loadCandidates(client, context.sessionId, context.chamberId);
  const unresolved = await client.query<{ id: string; source_member_name: string }>(
    `SELECT mv.id, mv.source_member_name
       FROM member_votes mv
       JOIN vote_events ve ON ve.id = mv.vote_event_id
      WHERE ve.session_id = $1
        AND ve.chamber_id = $2
        AND mv.membership_id IS NULL
      ORDER BY mv.id`,
    [context.sessionId, context.chamberId],
  );

  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;
  for (const row of unresolved.rows) {
    const resolution = reconcileHouseMemberName(row.source_member_name, candidates);
    if (resolution.status === 'matched') {
      await client.query(
        `UPDATE member_votes
            SET membership_id = $2,
                metadata = metadata || $3::jsonb
          WHERE id = $1`,
        [row.id, resolution.membershipId, JSON.stringify({ reconciliation: resolution, reconciledAt: new Date().toISOString() })],
      );
      matched += 1;
    } else if (resolution.status === 'ambiguous') {
      ambiguous += 1;
    } else {
      unmatched += 1;
    }
  }

  console.log(`[${sessionSlug}] candidates=${candidates.length} unresolved=${unresolved.rowCount ?? unresolved.rows.length} matched=${matched} ambiguous=${ambiguous} unmatched=${unmatched}`);
  return { matched, ambiguous, unmatched };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requestedSession = argumentValue(args, '--session');
  const sessions = requestedSession
    ? [getMinnesotaHouseSession(requestedSession)]
    : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];
  const strict = args.includes('--strict');
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const pool = new Pool({ connectionString, max: 2 });
  let unresolved = 0;
  try {
    const client = await pool.connect();
    try {
      for (const session of sessions) {
        const result = await reconcileSession(client, session.slug);
        unresolved += result.ambiguous + result.unmatched;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  if (strict && unresolved > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

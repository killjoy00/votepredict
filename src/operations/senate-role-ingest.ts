import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import { normalizeMemberName } from '@/sources/minnesota/house-votes';
import type { RawSenateRole, SenateRoleCollection } from '@/sources/minnesota/senate-roles';

interface SenateMembership {
  id: string;
  external_key: string;
  name: string;
  district: string | null;
  aliases: string[];
}

function matchingMembership(role: RawSenateRole, members: SenateMembership[]): string | null {
  if (role.lrlId) {
    const direct = members.find((member) => member.external_key === `lrl:${role.lrlId}`);
    if (direct) return direct.id;
  }
  const normalized = normalizeMemberName(role.senatorName);
  const exact = members.filter((member) => [member.name, ...member.aliases].some((name) => normalizeMemberName(name) === normalized));
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1 && role.district) {
    const district = exact.filter((member) => member.district === role.district);
    return district.length === 1 ? district[0].id : null;
  }
  // The Senate sometimes drops initials on committee rosters. Only accept a
  // unique surname within the same district, never a guessed name match.
  if (role.district) {
    const lastName = normalized.split(' ').at(-1);
    const district = members.filter((member) => member.district === role.district && normalizeMemberName(member.name).split(' ').at(-1) === lastName);
    if (district.length === 1) return district[0].id;
  }
  // PDF assignment sheets often print only a surname. A globally unique
  // session surname is sufficient; collisions are preserved as unmatched.
  if (!role.district) {
    const surnameCandidates = members.filter((member) => {
      const full = normalizeMemberName(member.name);
      return full === normalized || full.endsWith(' ' + normalized);
    });
    if (surnameCandidates.length === 1) return surnameCandidates[0].id;
  }
  return null;
}

async function fetchSenateMemberships(client: PoolClient, sessionId: string): Promise<SenateMembership[]> {
  const result = await client.query<Omit<SenateMembership, 'aliases'>>(
    `SELECT m.id, l.external_key, l.name, m.district
       FROM memberships m
       JOIN chambers c ON c.id=m.chamber_id
       JOIN legislators l ON l.id=m.legislator_id
      WHERE m.session_id=$1 AND c.slug='senate'`,
    [sessionId],
  );
  const aliases = await client.query<{ membership_id: string; source_name: string }>(
    `SELECT msa.membership_id, msa.source_name
       FROM membership_source_aliases msa
       JOIN memberships m ON m.id=msa.membership_id
       JOIN chambers c ON c.id=m.chamber_id
      WHERE m.session_id=$1 AND c.slug='senate'`,
    [sessionId],
  );
  const byMembership = new Map<string, string[]>();
  for (const alias of aliases.rows) byMembership.set(alias.membership_id, [...(byMembership.get(alias.membership_id) ?? []), alias.source_name]);
  return result.rows.map((member) => ({ ...member, aliases: byMembership.get(member.id) ?? [] }));
}

export async function persistSenateRoleCollection(collection: SenateRoleCollection): Promise<{ stored: number; matched: number; unmatched: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      const session = await client.query<{ id: string }>(
        `SELECT ls.id FROM legislative_sessions ls
         JOIN jurisdictions j ON j.id=ls.jurisdiction_id
         WHERE ls.slug=$1 AND j.slug='us-mn'`,
        [collection.session],
      );
      if (session.rows.length !== 1) throw new Error(`Existing Minnesota legislative session missing: ${collection.session}`);
      const sessionId = session.rows[0].id;
      const members = await fetchSenateMemberships(client, sessionId);
      let matched = 0;
      let stored = 0;
      for (const entry of collection.sources) {
        const snapshot = await client.query<{ id: string }>(
          `INSERT INTO senate_role_source_snapshots
             (session_id, source_url, fetched_at, source_session, source_date, content_type, raw_content, content_sha256)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (session_id, source_url, content_sha256) DO UPDATE
             SET fetched_at=LEAST(senate_role_source_snapshots.fetched_at,EXCLUDED.fetched_at)
           RETURNING id`,
          [sessionId, entry.sourceUrl, entry.fetchedAt, entry.sourceSession, entry.sourceDate, entry.contentType, entry.rawContent, entry.contentSha256],
        );
        for (const [ordinal, role] of entry.roles.entries()) {
          const membershipId = matchingMembership(role, members);
          if (membershipId) matched += 1;
          await client.query(
            `INSERT INTO senate_role_observations
               (session_id, source_snapshot_id, source_ordinal, membership_id, senator_name, role, committee,
                starts_on, ends_on, source_url, fetched_at, source_session, source_date, raw_content)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (source_snapshot_id, source_ordinal) DO UPDATE SET
               membership_id=EXCLUDED.membership_id, senator_name=EXCLUDED.senator_name,
               role=EXCLUDED.role, committee=EXCLUDED.committee,
               starts_on=EXCLUDED.starts_on, ends_on=EXCLUDED.ends_on,
               fetched_at=LEAST(senate_role_observations.fetched_at,EXCLUDED.fetched_at), raw_content=EXCLUDED.raw_content`,
            [sessionId, snapshot.rows[0].id, ordinal, membershipId, role.senatorName, role.role, role.committee,
              role.startsOn, role.endsOn, entry.sourceUrl, entry.fetchedAt, entry.sourceSession, entry.sourceDate, role.rawContent],
          );
          stored += 1;
        }
      }
      await client.query('COMMIT');
      return { stored, matched, unmatched: stored - matched };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); }
}

import type { PoolClient } from 'pg';
import { assert2027OpeningRosterIntegrity } from './2027-opening-roster-audit';
import { pool } from '@/lib/db';
import {
  listLrlMemberships,
  type HistoricalMembershipRecord,
} from '@/sources/minnesota/lrl-members';
import { officialMembershipAliasesForLrlId } from '@/sources/minnesota/official-member-aliases';
import {
  isMinnesotaHouseSessionCurrent,
  minnesotaLocalDate,
  type MinnesotaHouseSession,
} from '@/sources/minnesota/sessions';

type SessionContext = {
  jurisdictionId: string;
  sessionId: string;
  houseId: string;
  senateId: string;
};

export type LrlMembershipIngestResult = {
  session: string;
  records: number;
  house: number;
  senate: number;
};

async function ensureSession(
  client: PoolClient,
  session: MinnesotaHouseSession,
  checkedAt: Date,
): Promise<SessionContext> {
  const jurisdiction = await client.query<{ id: string }>(
    `INSERT INTO jurisdictions (slug,name,country_code) VALUES ('us-mn','Minnesota','US')
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
  );
  const jurisdictionId = jurisdiction.rows[0].id;
  const newer = await client.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM legislative_sessions WHERE jurisdiction_id=$1 AND starts_on>$2::date AND is_current=true) AS exists',
    [jurisdictionId, session.startsOn],
  );
  const isCurrent = isMinnesotaHouseSessionCurrent(session, checkedAt) && !newer.rows[0].exists;
  if (isCurrent) {
    await client.query(
      `UPDATE legislative_sessions SET is_current=false WHERE jurisdiction_id=$1 AND slug<>$2 AND is_current=true`,
      [jurisdictionId, session.slug],
    );
  }
  const legislativeSession = await client.query<{ id: string }>(
    `INSERT INTO legislative_sessions (jurisdiction_id,slug,name,starts_on,ends_on,is_current)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,is_current=(legislative_sessions.is_current OR EXCLUDED.is_current)
     RETURNING id`,
    [jurisdictionId, session.slug, session.name, session.startsOn, session.endsOn, isCurrent],
  );
  const house = await client.query<{ id: string }>(
    `INSERT INTO chambers (jurisdiction_id,slug,name,kind) VALUES ($1,'house','Minnesota House of Representatives','lower')
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind RETURNING id`,
    [jurisdictionId],
  );
  const senate = await client.query<{ id: string }>(
    `INSERT INTO chambers (jurisdiction_id,slug,name,kind) VALUES ($1,'senate','Minnesota Senate','upper')
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind RETURNING id`,
    [jurisdictionId],
  );
  return {
    jurisdictionId,
    sessionId: legislativeSession.rows[0].id,
    houseId: house.rows[0].id,
    senateId: senate.rows[0].id,
  };
}

async function persistRecord(
  client: PoolClient,
  context: SessionContext,
  record: HistoricalMembershipRecord,
): Promise<void> {
  const legislator = await client.query<{ id: string }>(
    `INSERT INTO legislators (jurisdiction_id,external_key,name,normalized_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (jurisdiction_id,external_key) DO UPDATE SET name=EXCLUDED.name,normalized_name=EXCLUDED.normalized_name
     RETURNING id`,
    [context.jurisdictionId, `lrl:${record.lrlId}`, record.name, record.normalizedName],
  );
  const chamberId = record.chamber === 'house' ? context.houseId : context.senateId;
  const membership = await client.query<{ id: string }>(
    `INSERT INTO memberships (session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on,source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (session_id,chamber_id,legislator_id) DO UPDATE SET
       district=EXCLUDED.district,party=EXCLUDED.party,title=EXCLUDED.title,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,source_url=EXCLUDED.source_url
     RETURNING id`,
    [
      context.sessionId,
      chamberId,
      legislator.rows[0].id,
      record.district,
      record.party,
      record.chamber === 'house' ? 'Representative' : 'Senator',
      record.startsOn ?? null,
      record.endsOn ?? null,
      record.sourceUrl,
    ],
  );
  await client.query(
    `INSERT INTO membership_source_aliases (membership_id,source_system,source_name,normalized_name,source_url,metadata)
     VALUES ($1,'mn_lrl_legdb',$2,$3,$4,$5::jsonb)
     ON CONFLICT (membership_id,source_system,normalized_name) DO UPDATE SET source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,metadata=EXCLUDED.metadata`,
    [
      membership.rows[0].id,
      record.name,
      record.normalizedName,
      record.sourceUrl,
      JSON.stringify({ electedOn: record.electedOn, oathOn: record.oathOn }),
    ],
  );
  for (const alias of officialMembershipAliasesForLrlId(record.lrlId)) {
    if (record.chamber !== 'house') continue;
    await client.query(
      `INSERT INTO membership_source_aliases (membership_id,source_system,source_name,normalized_name,source_url,metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (membership_id,source_system,normalized_name) DO UPDATE SET source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,metadata=EXCLUDED.metadata`,
      [
        membership.rows[0].id,
        alias.sourceSystem,
        alias.sourceName,
        alias.normalizedName,
        alias.sourceUrl,
        JSON.stringify(alias.metadata),
      ],
    );
  }
}

export async function ingestLrlMembershipSession(
  session: MinnesotaHouseSession,
  checkedAt = new Date(),
): Promise<LrlMembershipIngestResult> {
  const records = await listLrlMemberships(session);
  // Validate the actual distinct persistence identities before any database write.
  // Multiple source term blocks for one legislator/chamber cannot fill missing seats.
  const house = new Set(records.filter((record) => record.chamber === 'house').map((record) => record.lrlId)).size;
  const senate = new Set(records.filter((record) => record.chamber === 'senate').map((record) => record.lrlId)).size;
  if (house < 130 || senate < 65) {
    throw new Error(`[${session.slug}] implausible membership coverage: House=${house}, Senate=${senate}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      // The jurisdiction upsert serializes initial verification with rollover.
      await client.query(`INSERT INTO jurisdictions (slug,name,country_code) VALUES ('us-mn','Minnesota','US')
        ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name`);
      let openingImport = false;
      if (session.slug === '2027-2028') {
        const existing = await client.query<{ is_current: boolean }>(
          `SELECT s.is_current FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id
           WHERE j.slug='us-mn' AND s.slug=$1`, [session.slug]);
        // Gate initial staging/activation. Later session refreshes must account
        // for real replacements rather than freezing the opening cohort.
        openingImport = !existing.rows[0]?.is_current;
        if (openingImport) assert2027OpeningRosterIntegrity(records, minnesotaLocalDate(checkedAt));
      }
      // Session rollover, legislator, membership and alias changes are atomic.
      const context = await ensureSession(client, session, checkedAt);
      for (const record of records) await persistRecord(client, context, record);
      if (openingImport) {
        // A previously staged stale identity must not survive an otherwise valid
        // incoming roster. Verify persisted identities before committing; never
        // silently delete historical membership records.
        const persisted = await client.query<{ chamber: string; external_key: string; district: string }>(
          `SELECT c.slug AS chamber, l.external_key, m.district
             FROM memberships m JOIN chambers c ON c.id=m.chamber_id
             JOIN legislators l ON l.id=m.legislator_id
            WHERE m.session_id=$1`, [context.sessionId]);
        const expected = new Set(records.map((r) => JSON.stringify([r.chamber, `lrl:${r.lrlId}`, r.district])));
        if (persisted.rows.length !== expected.size ||
            persisted.rows.some((r) => !expected.has(JSON.stringify([r.chamber, r.external_key, r.district])))) {
          throw new Error('2027 opening roster persistence differs from verified source identities');
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
  return {
    session: session.slug,
    records: records.length,
    house,
    senate,
  };
}

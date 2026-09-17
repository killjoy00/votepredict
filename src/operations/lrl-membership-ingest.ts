import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import {
  listLrlMemberships,
  type HistoricalMembershipRecord,
} from '@/sources/minnesota/lrl-members';
import { officialMembershipAliasesForLrlId } from '@/sources/minnesota/official-member-aliases';
import {
  isMinnesotaHouseSessionCurrent,
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
  const isCurrent = isMinnesotaHouseSessionCurrent(session, checkedAt);
  if (isCurrent) {
    await client.query(
      `UPDATE legislative_sessions SET is_current=false WHERE jurisdiction_id=$1 AND slug<>$2 AND is_current=true`,
      [jurisdictionId, session.slug],
    );
  }
  const legislativeSession = await client.query<{ id: string }>(
    `INSERT INTO legislative_sessions (jurisdiction_id,slug,name,starts_on,ends_on,is_current)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,is_current=EXCLUDED.is_current
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
  const client = await pool.connect();
  try {
    const context = await ensureSession(client, session, checkedAt);
    await client.query('BEGIN');
    try {
      for (const record of records) await persistRecord(client, context, record);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }

  const house = records.filter((record) => record.chamber === 'house').length;
  const senate = records.filter((record) => record.chamber === 'senate').length;
  if (house < 130 || senate < 65) {
    throw new Error(`[${session.slug}] implausible membership coverage: House=${house}, Senate=${senate}`);
  }
  return {
    session: session.slug,
    records: records.length,
    house,
    senate,
  };
}

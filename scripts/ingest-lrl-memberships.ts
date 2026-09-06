import { Pool, type PoolClient } from 'pg';
import { listLrlMemberships, type HistoricalMembershipRecord } from '../src/sources/minnesota/lrl-members.js';
import { getMinnesotaHouseSession, MINNESOTA_HOUSE_HISTORICAL_SESSIONS, type MinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function ensureSession(client: PoolClient, session: MinnesotaHouseSession): Promise<{ jurisdictionId: string; sessionId: string; houseId: string; senateId: string }> {
  const jurisdiction = await client.query<{ id: string }>(
    `INSERT INTO jurisdictions (slug,name,country_code) VALUES ('us-mn','Minnesota','US')
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
  );
  const jurisdictionId = jurisdiction.rows[0].id;
  const legislativeSession = await client.query<{ id: string }>(
    `INSERT INTO legislative_sessions (jurisdiction_id,slug,name,starts_on,ends_on,is_current)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,is_current=EXCLUDED.is_current
     RETURNING id`,
    [jurisdictionId, session.slug, session.name, session.startsOn, session.endsOn, session.isCurrent],
  );
  const house = await client.query<{ id: string }>(
    `INSERT INTO chambers (jurisdiction_id,slug,name,kind) VALUES ($1,'house','Minnesota House of Representatives','lower')
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind RETURNING id`, [jurisdictionId]);
  const senate = await client.query<{ id: string }>(
    `INSERT INTO chambers (jurisdiction_id,slug,name,kind) VALUES ($1,'senate','Minnesota Senate','upper')
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind RETURNING id`, [jurisdictionId]);
  return { jurisdictionId, sessionId: legislativeSession.rows[0].id, houseId: house.rows[0].id, senateId: senate.rows[0].id };
}

async function persistRecord(client: PoolClient, context: Awaited<ReturnType<typeof ensureSession>>, record: HistoricalMembershipRecord): Promise<void> {
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
    [context.sessionId, chamberId, legislator.rows[0].id, record.district, record.party, record.chamber === 'house' ? 'Representative' : 'Senator', record.startsOn ?? null, record.endsOn ?? null, record.sourceUrl],
  );
  await client.query(
    `INSERT INTO membership_source_aliases (membership_id,source_system,source_name,normalized_name,source_url,metadata)
     VALUES ($1,'mn_lrl_legdb',$2,$3,$4,$5::jsonb)
     ON CONFLICT (membership_id,source_system,normalized_name) DO UPDATE SET source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,metadata=EXCLUDED.metadata`,
    [membership.rows[0].id, record.name, record.normalizedName, record.sourceUrl, JSON.stringify({ electedOn: record.electedOn, oathOn: record.oathOn })],
  );
}

async function ingestSession(client: PoolClient, session: MinnesotaHouseSession): Promise<void> {
  console.log(`[${session.slug}] fetching authoritative membership records from Minnesota LRL`);
  const records = await listLrlMemberships(session);
  const context = await ensureSession(client, session);
  await client.query('BEGIN');
  try {
    for (const record of records) await persistRecord(client, context, record);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  const house = records.filter((record) => record.chamber === 'house').length;
  const senate = records.filter((record) => record.chamber === 'senate').length;
  console.log(`[${session.slug}] persisted ${records.length} membership records (${house} House, ${senate} Senate)`);
  if (house < 130 || senate < 65) throw new Error(`[${session.slug}] implausible membership coverage: House=${house}, Senate=${senate}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requested = argumentValue(args, '--session');
  const sessions = requested ? [getMinnesotaHouseSession(requested)] : [...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const client = await pool.connect();
    try { for (const session of sessions) await ingestSession(client, session); }
    finally { client.release(); }
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });

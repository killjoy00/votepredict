import type { PoolClient } from 'pg';
import type { MinnesotaHouseSession } from '@/sources/minnesota/sessions';

/**
 * Vote ingestion may provision a historical or staged session, but may not
 * select the active legislature. Validated roster ingestion owns rollover.
 */
export async function ensureVoteIngestSessionMetadata(
  client: Pick<PoolClient, 'query'>,
  jurisdictionId: string,
  session: MinnesotaHouseSession,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO legislative_sessions (jurisdiction_id,slug,name,starts_on,ends_on,is_current)
     VALUES ($1,$2,$3,$4,$5,false)
     ON CONFLICT (jurisdiction_id,slug) DO UPDATE SET
       name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on
     RETURNING id`,
    [jurisdictionId, session.slug, session.name, session.startsOn, session.endsOn],
  );
  if (result.rows.length !== 1) throw new Error('Vote ingestion could not resolve session metadata');
  return result.rows[0].id;
}

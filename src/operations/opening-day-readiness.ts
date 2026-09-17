import { pool } from '@/lib/db';
import { fetchLrlLegislatorRefs } from '@/sources/minnesota/lrl-members';
import { fetchRevisorBillSearchRangeDocument, revisorSearchSessionValue } from '@/sources/minnesota/revisor-bill-search';
import { getMinnesotaHouseSession } from '@/sources/minnesota/sessions';
import { assessOpeningDaySources, OPENING_DAY_SESSION } from './opening-day-plan';

export type OpeningDayReadinessResult = {
  generatedAt: string;
  sessionMetadata: {
    sessionId: string;
    slug: typeof OPENING_DAY_SESSION;
    legislature: number;
    revisorSession: string;
    isCurrent: boolean;
  };
  sourceReadiness: ReturnType<typeof assessOpeningDaySources>;
};

export async function ensureOpeningDaySessionMetadata(checkedAt = new Date()): Promise<OpeningDayReadinessResult['sessionMetadata']> {
  const session = getMinnesotaHouseSession(OPENING_DAY_SESSION);
  const checkedDate = checkedAt.toISOString().slice(0, 10);
  const shouldBeCurrent = checkedDate >= session.startsOn && checkedDate <= session.endsOn;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jurisdiction = await client.query<{ id: string }>(`
      INSERT INTO jurisdictions (slug, name, country_code)
      VALUES ('us-mn', 'Minnesota', 'US')
      ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name
      RETURNING id`);
    const jurisdictionId = jurisdiction.rows[0].id;

    await client.query(`
      INSERT INTO chambers (jurisdiction_id, slug, name, kind)
      VALUES
        ($1, 'house', 'Minnesota House of Representatives', 'lower'),
        ($1, 'senate', 'Minnesota Senate', 'upper')
      ON CONFLICT (jurisdiction_id, slug) DO UPDATE SET
        name=EXCLUDED.name,
        kind=EXCLUDED.kind`, [jurisdictionId]);

    if (shouldBeCurrent) {
      await client.query(`
        UPDATE legislative_sessions
           SET is_current=false
         WHERE jurisdiction_id=$1
           AND slug <> $2
           AND is_current=true`, [jurisdictionId, session.slug]);
    }

    const persisted = await client.query<{ id: string; is_current: boolean }>(`
      INSERT INTO legislative_sessions (jurisdiction_id, slug, name, starts_on, ends_on, is_current)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (jurisdiction_id, slug) DO UPDATE SET
        name=EXCLUDED.name,
        starts_on=EXCLUDED.starts_on,
        ends_on=EXCLUDED.ends_on,
        is_current=EXCLUDED.is_current
      RETURNING id::text, is_current`, [
      jurisdictionId,
      session.slug,
      session.name,
      session.startsOn,
      session.endsOn,
      shouldBeCurrent,
    ]);
    await client.query('COMMIT');
    return {
      sessionId: persisted.rows[0].id,
      slug: OPENING_DAY_SESSION,
      legislature: session.legislature,
      revisorSession: revisorSearchSessionValue(session.slug),
      isCurrent: Boolean(persisted.rows[0].is_current),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function probeOpeningDaySources(checkedAt = new Date()): Promise<ReturnType<typeof assessOpeningDaySources>> {
  const session = getMinnesotaHouseSession(OPENING_DAY_SESSION);
  const [lrlRefs, house, senate] = await Promise.all([
    fetchLrlLegislatorRefs(session),
    fetchRevisorBillSearchRangeDocument({ sessionKey: session.slug, body: 'House', firstBill: 1, lastBill: 500 }),
    fetchRevisorBillSearchRangeDocument({ sessionKey: session.slug, body: 'Senate', firstBill: 1, lastBill: 500 }),
  ]);
  return assessOpeningDaySources({
    checkedAt,
    lrlLegislatorRefs: lrlRefs.length,
    revisorHouseBillsInFirst500: house.results.length,
    revisorSenateBillsInFirst500: senate.results.length,
  });
}

export async function runOpeningDayReadiness(checkedAt = new Date()): Promise<OpeningDayReadinessResult> {
  const [sessionMetadata, sourceReadiness] = await Promise.all([
    ensureOpeningDaySessionMetadata(checkedAt),
    probeOpeningDaySources(checkedAt),
  ]);
  return {
    generatedAt: checkedAt.toISOString(),
    sessionMetadata,
    sourceReadiness,
  };
}

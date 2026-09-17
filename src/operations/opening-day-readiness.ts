import { pool } from '@/lib/db';
import { fetchLrlLegislatorRefs } from '@/sources/minnesota/lrl-members';
import { fetchRevisorBillSearchRangeDocument, revisorSearchSessionValue } from '@/sources/minnesota/revisor-bill-search';
import { getMinnesotaHouseSession, isMinnesotaHouseSessionCurrent } from '@/sources/minnesota/sessions';
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
  const shouldBeCurrent = isMinnesotaHouseSessionCurrent(session, checkedAt);
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

function sourceError(label: string, reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  return `${label} probe failed: ${message.slice(0, 500)}`;
}

export async function probeOpeningDaySources(checkedAt = new Date()): Promise<ReturnType<typeof assessOpeningDaySources>> {
  const session = getMinnesotaHouseSession(OPENING_DAY_SESSION);
  const [lrlResult, houseResult, senateResult] = await Promise.allSettled([
    fetchLrlLegislatorRefs(session),
    fetchRevisorBillSearchRangeDocument({ sessionKey: session.slug, body: 'House', firstBill: 1, lastBill: 500 }),
    fetchRevisorBillSearchRangeDocument({ sessionKey: session.slug, body: 'Senate', firstBill: 1, lastBill: 500 }),
  ]);
  const sourceErrors: string[] = [];
  if (lrlResult.status === 'rejected') sourceErrors.push(sourceError('Minnesota LRL', lrlResult.reason));
  if (houseResult.status === 'rejected') sourceErrors.push(sourceError('Minnesota Revisor House', houseResult.reason));
  if (senateResult.status === 'rejected') sourceErrors.push(sourceError('Minnesota Revisor Senate', senateResult.reason));

  return assessOpeningDaySources({
    checkedAt,
    lrlLegislatorRefs: lrlResult.status === 'fulfilled' ? lrlResult.value.length : 0,
    revisorHouseBillsInFirst500: houseResult.status === 'fulfilled' ? houseResult.value.results.length : 0,
    revisorSenateBillsInFirst500: senateResult.status === 'fulfilled' ? senateResult.value.results.length : 0,
    sourceErrors,
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

import { pool } from '@/lib/db';
import { resolveForecastOutcome, ScorecardError, type ForecastOutcomeCandidate } from './scorecard';

export async function listSafeOutcomeCandidates(forecastId: string, ownerUserId: string): Promise<ForecastOutcomeCandidate[]> {
  const result = await pool.query<{
    id: string;
    occurred_on: string;
    yea_count: number;
    nay_count: number;
    passed: boolean | null;
    motion_text: string;
    external_key: string;
  }>(`
    SELECT ve.id,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed,
           ve.motion_text,
           ve.external_key
      FROM forecasts f
      JOIN vote_events ve
        ON ve.bill_id = f.bill_id
       AND ve.chamber_id = f.target_chamber_id
       AND ve.is_passage = true
       AND ve.occurred_on > f.created_at::date
     WHERE f.id = $1
       AND f.owner_user_id = $2
       AND f.target_type = 'bill'
     ORDER BY ve.occurred_on DESC, ve.id DESC`, [forecastId, ownerUserId]);
  return result.rows.map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    yeaCount: Number(row.yea_count),
    nayCount: Number(row.nay_count),
    passed: row.passed,
    motionText: row.motion_text,
    externalKey: row.external_key,
  }));
}

export async function resolveSafeForecastOutcome(input: {
  forecastId: string;
  ownerUserId: string;
  voteEventId: string;
}): Promise<void> {
  const validation = await pool.query<{ valid: boolean }>(`
    SELECT true AS valid
      FROM forecasts f
      JOIN vote_events ve
        ON ve.id = $3
       AND ve.bill_id = f.bill_id
       AND ve.chamber_id = f.target_chamber_id
       AND ve.is_passage = true
       AND ve.occurred_on > f.created_at::date
     WHERE f.id = $1
       AND f.owner_user_id = $2
       AND f.target_type = 'bill'
     LIMIT 1`, [input.forecastId, input.ownerUserId, input.voteEventId]);
  if (!validation.rows[0]) {
    throw new ScorecardError(
      'INVALID_OUTCOME',
      'The selected vote must be an official matching passage event on a later calendar date than the frozen forecast.',
    );
  }
  await resolveForecastOutcome(input);
}

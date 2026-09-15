import { pool } from '@/lib/db';
import {
  PROSPECTIVE_EVIDENCE_CADENCE_HOURS,
  PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
  PROSPECTIVE_EVIDENCE_PLAN_VERSION,
  PROSPECTIVE_EVIDENCE_RESEARCH_MODE,
  PROSPECTIVE_EVIDENCE_SEED_LIMIT,
  PROSPECTIVE_EVIDENCE_SESSION,
} from './prospective-evidence-plan';

type SeededForecastRow = {
  forecast_id: string;
  identifier: string;
  chamber_slug: 'house' | 'senate';
};

export type ProspectiveEvidenceSeedResult = {
  schemaVersion: typeof PROSPECTIVE_EVIDENCE_PLAN_VERSION;
  session: typeof PROSPECTIVE_EVIDENCE_SESSION;
  ownerUserId: typeof PROSPECTIVE_EVIDENCE_OWNER_USER_ID;
  seededForecasts: number;
  forecasts: Array<{
    forecastId: string;
    identifier: string;
    chamber: 'house' | 'senate';
  }>;
};

/**
 * Create a small, outcome-blind system cohort of real future-session bills.
 *
 * The cohort is deliberately hard-gated to the frozen 2027-2028 Minnesota
 * session and to bills whose official status has advanced to an engrossment.
 * Nothing from the resolved 2025-2026 corpus can enter this cohort.
 */
export async function ensureProspectiveEvidenceForecasts(
  limit = PROSPECTIVE_EVIDENCE_SEED_LIMIT,
): Promise<ProspectiveEvidenceSeedResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Prospective evidence seed limit must be an integer between 1 and 100');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [PROSPECTIVE_EVIDENCE_OWNER_USER_ID]);

    const seeded = await client.query<SeededForecastRow>(`
      WITH candidates AS (
        SELECT b.id AS bill_id,
               b.session_id,
               b.originating_chamber_id AS chamber_id,
               b.identifier,
               c.slug AS chamber_slug
          FROM bills b
          JOIN legislative_sessions s
            ON s.id = b.session_id
           AND s.is_current = true
           AND s.slug = $1
          JOIN chambers c
            ON c.id = b.originating_chamber_id
           AND c.slug IN ('house', 'senate')
         WHERE b.metadata ? 'revisorUniverse'
           AND b.status ILIKE '%Engrossment%'
           AND b.metadata #>> '{sourceChamberPassage,outcome}' IS NULL
           AND EXISTS (
             SELECT 1
               FROM memberships m
              WHERE m.session_id = b.session_id
                AND m.chamber_id = b.originating_chamber_id
           )
           AND NOT EXISTS (
             SELECT 1
               FROM vote_events ve
              WHERE ve.bill_id = b.id
                AND ve.chamber_id = b.originating_chamber_id
                AND ve.is_passage = true
           )
           AND NOT EXISTS (
             SELECT 1
               FROM legislative_stage_events se
              WHERE se.bill_id = b.id
                AND se.session_id = b.session_id
                AND se.stage_kind = 'session_expiration'
           )
           AND NOT EXISTS (
             SELECT 1
               FROM forecasts f
              WHERE f.owner_user_id = $2
                AND f.target_type = 'bill'
                AND f.bill_id = b.id
                AND f.target_chamber_id = b.originating_chamber_id
           )
         ORDER BY COALESCE(b.latest_action_at, b.introduced_at, b.created_at), b.identifier
         LIMIT $3
      ), inserted AS (
        INSERT INTO forecasts (
          owner_user_id, target_type, target_kind, conditional_on,
          bill_id, target_chamber_id, session_id, status
        )
        SELECT $2,
               'bill',
               CASE c.chamber_slug
                 WHEN 'house' THEN 'house_floor_passage'
                 ELSE 'senate_floor_passage'
               END,
               CASE c.chamber_slug
                 WHEN 'house' THEN 'a House floor vote'
                 ELSE 'a Senate floor vote'
               END,
               c.bill_id,
               c.chamber_id,
               c.session_id,
               'draft'
          FROM candidates c
        RETURNING id, bill_id, target_chamber_id
      ), scheduled AS (
        INSERT INTO forecast_schedules (
          forecast_id, enabled, cadence_hours, research_mode, next_run_at
        )
        SELECT i.id, true, $4, $5, now()
          FROM inserted i
        ON CONFLICT (forecast_id) DO NOTHING
        RETURNING forecast_id
      )
      SELECT i.id::text AS forecast_id,
             b.identifier,
             c.slug AS chamber_slug
        FROM inserted i
        JOIN scheduled sc ON sc.forecast_id = i.id
        JOIN bills b ON b.id = i.bill_id
        JOIN chambers c ON c.id = i.target_chamber_id
       ORDER BY b.identifier`, [
      PROSPECTIVE_EVIDENCE_SESSION,
      PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
      limit,
      PROSPECTIVE_EVIDENCE_CADENCE_HOURS,
      PROSPECTIVE_EVIDENCE_RESEARCH_MODE,
    ]);

    await client.query('COMMIT');
    return {
      schemaVersion: PROSPECTIVE_EVIDENCE_PLAN_VERSION,
      session: PROSPECTIVE_EVIDENCE_SESSION,
      ownerUserId: PROSPECTIVE_EVIDENCE_OWNER_USER_ID,
      seededForecasts: seeded.rowCount ?? 0,
      forecasts: seeded.rows.map((row) => ({
        forecastId: row.forecast_id,
        identifier: row.identifier,
        chamber: row.chamber_slug,
      })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

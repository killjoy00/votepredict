import { Pool } from 'pg';
import { evaluateChronologicalGamblingModel, scoreGamblingModel, type GamblingModelObservation } from '../src/evaluation/gambling-member-model.js';
import type { GamblingTopic } from '../src/gambling/policy.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query<{
      observation_id: string; vote_event_id: string; member_id: string; party: string;
      occurred_at: string; outcome: 0 | 1; topic: GamblingTopic; design_key: string;
    }>(`
      SELECT mv.id AS observation_id, ve.id AS vote_event_id, m.legislator_id AS member_id,
             COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
             ve.occurred_on::text || 'T00:00:00Z' AS occurred_at,
             CASE mv.choice WHEN 'yea' THEN 1 ELSE 0 END AS outcome,
             bfs.features #>> '{gambling,topic}' AS topic,
             concat_ws(':', bfs.features #>> '{gambling,topic}', bfs.features #>> '{gambling,licenseModel}',
               bfs.features #>> '{gambling,racetrackRole}', bfs.features #>> '{gambling,mobileAllowed}') AS design_key
        FROM member_votes mv
        JOIN vote_events ve ON ve.id = mv.vote_event_id AND ve.is_passage = true
        JOIN memberships m ON m.id = mv.membership_id
        JOIN LATERAL (
          SELECT fs.features
            FROM bill_versions bv JOIN bill_feature_sets fs ON fs.bill_version_id = bv.id
           WHERE bv.bill_id = ve.bill_id AND bv.published_at < ve.occurred_on + interval '1 day'
             AND fs.feature_schema_version = 'bill-features-v2' AND fs.features ? 'gambling'
           ORDER BY bv.published_at DESC, fs.generated_at DESC LIMIT 1
        ) bfs ON true
       WHERE mv.choice IN ('yea', 'nay')
       ORDER BY ve.occurred_on, ve.id, mv.id`);
    const observations = result.rows.map((row): GamblingModelObservation => ({
      observationId: row.observation_id, voteEventId: row.vote_event_id, memberId: row.member_id,
      party: row.party, occurredAt: row.occurred_at, outcome: Number(row.outcome) as 0 | 1,
      topic: row.topic, designKey: row.design_key,
    }));
    if (observations.length === 0) throw new Error('No v2-featured gambling passage votes found; run features:bills:backfill first');
    const predictions = evaluateChronologicalGamblingModel(observations);
    console.log(JSON.stringify({
      metadata: { generatedAt: new Date().toISOString(), model: 'gambling-hierarchical-v1-candidate', leakageGuard: 'same-time outcomes enter history only after scoring the complete group' },
      scorecard: scoreGamblingModel(predictions),
    }, null, 2));
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });

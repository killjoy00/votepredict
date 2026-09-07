import { pool } from '@/lib/db';

export async function listResolutionQueue(ownerUserId: string) {
  const result = await pool.query<{
    forecast_id: string;
    target_label: string;
    chamber_name: string;
    latest_revision_number: number | null;
    latest_passage_probability: number | null;
    created_at: string;
    candidate_votes: number;
  }>(`
    SELECT f.id AS forecast_id,
           concat(b.identifier, ' · ', b.title) AS target_label,
           c.name AS chamber_name,
           latest.revision_number AS latest_revision_number,
           latest.passage_probability AS latest_passage_probability,
           f.created_at::text,
           count(DISTINCT ve.id)::int AS candidate_votes
      FROM forecasts f
      JOIN bills b ON b.id = f.bill_id
      JOIN chambers c ON c.id = f.target_chamber_id
      LEFT JOIN forecast_resolutions resolved ON resolved.forecast_id = f.id
      LEFT JOIN LATERAL (
        SELECT revision_number, passage_probability
          FROM forecast_revisions r
         WHERE r.forecast_id = f.id
         ORDER BY revision_number DESC
         LIMIT 1
      ) latest ON true
      LEFT JOIN vote_events ve
        ON ve.bill_id = f.bill_id
       AND ve.chamber_id = f.target_chamber_id
       AND ve.is_passage = true
       AND ve.occurred_on > f.created_at::date
     WHERE f.owner_user_id = $1
       AND f.target_type = 'bill'
       AND f.archived_at IS NULL
       AND resolved.id IS NULL
     GROUP BY f.id, b.identifier, b.title, c.name, latest.revision_number, latest.passage_probability
     ORDER BY f.created_at DESC`, [ownerUserId]);

  return result.rows.map((row) => ({
    forecastId: row.forecast_id,
    targetLabel: row.target_label,
    chamberName: row.chamber_name,
    latestRevisionNumber: row.latest_revision_number === null ? undefined : Number(row.latest_revision_number),
    latestPassageProbability: row.latest_passage_probability === null ? undefined : Number(row.latest_passage_probability),
    createdAt: row.created_at,
    candidateVotes: Number(row.candidate_votes),
  }));
}

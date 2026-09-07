import { pool } from '@/lib/db';

export async function listOwnedForecasts(ownerUserId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const result = await pool.query<{
    id: string;
    target_type: 'bill' | 'proposal';
    target_label: string;
    chamber_name: string;
    status: string;
    updated_at: string;
    revision_count: number;
    latest_revision_number: number | null;
    latest_passage_probability: number | null;
    latest_research_mode: 'quick' | 'deep' | null;
  }>(`
    SELECT f.id,
           f.target_type,
           CASE WHEN f.target_type = 'bill'
                THEN concat(b.identifier, ' · ', b.title)
                ELSE p.title END AS target_label,
           c.name AS chamber_name,
           f.status,
           f.updated_at::text,
           count(r.id)::int AS revision_count,
           max(r.revision_number)::int AS latest_revision_number,
           latest.passage_probability AS latest_passage_probability,
           latest.research_mode AS latest_research_mode
      FROM forecasts f
      JOIN chambers c ON c.id = f.target_chamber_id
      LEFT JOIN bills b ON b.id = f.bill_id
      LEFT JOIN proposals p ON p.id = f.proposal_id
      LEFT JOIN forecast_revisions r ON r.forecast_id = f.id
      LEFT JOIN LATERAL (
        SELECT passage_probability, research_mode
          FROM forecast_revisions lr
         WHERE lr.forecast_id = f.id
         ORDER BY lr.revision_number DESC
         LIMIT 1
      ) latest ON true
     WHERE f.owner_user_id = $1
       AND f.archived_at IS NULL
     GROUP BY f.id, b.identifier, b.title, p.title, c.name, latest.passage_probability, latest.research_mode
     ORDER BY f.updated_at DESC
     LIMIT ${safeLimit}`, [ownerUserId]);

  return result.rows.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetLabel: row.target_label,
    chamberName: row.chamber_name,
    status: row.status,
    updatedAt: row.updated_at,
    revisionCount: Number(row.revision_count),
    latestRevisionNumber: row.latest_revision_number === null ? undefined : Number(row.latest_revision_number),
    latestPassageProbability: row.latest_passage_probability === null ? undefined : Number(row.latest_passage_probability),
    latestResearchMode: row.latest_research_mode ?? undefined,
  }));
}

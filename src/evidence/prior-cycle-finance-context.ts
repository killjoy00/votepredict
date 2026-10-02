import { pool } from '@/lib/db';

export interface PriorCycleProvenFinanceContext {
  sourceSession: string;
  contributionRows: number;
  contributionAmount: number;
  expenditureRows: number;
  expenditureAmount: number;
  independentExpenditureRows: number;
  independentExpenditureAmount: number;
  earliestProvenAvailableOn?: string;
  latestProvenAvailableOn?: string;
}

type PriorCycleFinanceDbRow = {
  source_session: string;
  contribution_rows: number;
  contribution_amount: number;
  expenditure_rows: number;
  expenditure_amount: number;
  independent_expenditure_rows: number;
  independent_expenditure_amount: number;
  earliest_proven_available_on: string | null;
  latest_proven_available_on: string | null;
};

export function priorCycleFinanceContextFromRows(
  rows: readonly PriorCycleFinanceDbRow[],
): PriorCycleProvenFinanceContext[] {
  return rows.map((row) => ({
    sourceSession: row.source_session,
    contributionRows: Number(row.contribution_rows) || 0,
    contributionAmount: Number(row.contribution_amount) || 0,
    expenditureRows: Number(row.expenditure_rows) || 0,
    expenditureAmount: Number(row.expenditure_amount) || 0,
    independentExpenditureRows: Number(row.independent_expenditure_rows) || 0,
    independentExpenditureAmount: Number(row.independent_expenditure_amount) || 0,
    earliestProvenAvailableOn: row.earliest_proven_available_on ?? undefined,
    latestProvenAvailableOn: row.latest_proven_available_on ?? undefined,
  }));
}

/**
 * Load prior-session candidate-finance and independent-expenditure rows that were
 * independently proven public before a target cutoff for the same stable legislator.
 *
 * Important boundaries:
 * - evidence stays attached to its original membership/session;
 * - only asOfEligible=true rows with a non-null proven published_at are considered;
 * - date-granular replay excludes same-day availability;
 * - prior-cycle rows are returned separately and are never merged into current-cycle totals;
 * - this loader is context-only and does not apply evidence/model weights.
 */
export async function loadPriorCycleProvenFinanceContext(input: {
  membershipId: string;
  asOf: string;
}): Promise<PriorCycleProvenFinanceContext[]> {
  const asOf = new Date(input.asOf);
  if (Number.isNaN(asOf.getTime())) throw new Error('Prior-cycle finance asOf must be a valid date/time');

  const result = await pool.query<PriorCycleFinanceDbRow>(`
    WITH target AS (
      SELECT m.id AS membership_id,
             m.legislator_id,
             s.starts_on::date AS session_starts_on
        FROM memberships m
        JOIN legislative_sessions s ON s.id=m.session_id
       WHERE m.id=$1::uuid
       LIMIT 1
    ), eligible AS (
      SELECT DISTINCT ON (ei.metadata->>'rowKey', sd.source_kind)
             s.slug AS source_session,
             sd.source_kind,
             ei.metadata->>'subtype' AS subtype,
             ei.metadata->>'rowKey' AS row_key,
             ei.published_at::date AS available_on,
             CASE
               WHEN ei.metadata->>'subtype'='candidate_contribution_record'
                 THEN COALESCE(NULLIF(ei.metadata->>'amount','')::numeric,0)::float8
               WHEN ei.metadata->>'subtype'='candidate_expenditure_record'
                 THEN COALESCE(
                   NULLIF(ei.metadata->>'totalAmount','')::numeric,
                   NULLIF(ei.metadata->>'amount','')::numeric,
                   0
                 )::float8
               WHEN ei.metadata->>'subtype'='independent_expenditure_record'
                 THEN COALESCE(
                   NULLIF(ei.metadata->>'totalAmount','')::numeric,
                   NULLIF(ei.metadata->>'amount','')::numeric,
                   0
                 )::float8
               ELSE 0::float8
             END AS amount
        FROM target t
        JOIN memberships m ON m.legislator_id=t.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN evidence_items ei ON ei.membership_id=m.id
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE m.id<>t.membership_id
         AND s.starts_on::date < t.session_starts_on
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND ei.metadata->>'asOfEligible'='true'
         AND ei.published_at IS NOT NULL
         AND ei.published_at::date < $2::timestamptz::date
         AND (
           (
             sd.source_kind IN (
               'campaign_finance_candidate_contribution_bulk',
               'campaign_finance_candidate_expenditure_bulk'
             )
             AND ei.metadata->>'subtype' IN (
               'candidate_contribution_record',
               'candidate_expenditure_record'
             )
             AND ei.metadata->>'transactionDateIsAvailability'='false'
           )
           OR (
             sd.source_kind='campaign_finance_independent_expenditure_bulk'
             AND ei.metadata->>'subtype'='independent_expenditure_record'
             AND ei.metadata->>'transactionDateIsAvailability'='false'
           )
         )
       ORDER BY
         ei.metadata->>'rowKey',
         sd.source_kind,
         ei.published_at,
         ei.id
    )
    SELECT source_session,
           count(*) FILTER (
             WHERE subtype='candidate_contribution_record'
           )::int AS contribution_rows,
           COALESCE(sum(amount) FILTER (
             WHERE subtype='candidate_contribution_record'
           ),0)::float8 AS contribution_amount,
           count(*) FILTER (
             WHERE subtype='candidate_expenditure_record'
           )::int AS expenditure_rows,
           COALESCE(sum(amount) FILTER (
             WHERE subtype='candidate_expenditure_record'
           ),0)::float8 AS expenditure_amount,
           count(*) FILTER (
             WHERE subtype='independent_expenditure_record'
           )::int AS independent_expenditure_rows,
           COALESCE(sum(amount) FILTER (
             WHERE subtype='independent_expenditure_record'
           ),0)::float8 AS independent_expenditure_amount,
           min(available_on)::text AS earliest_proven_available_on,
           max(available_on)::text AS latest_proven_available_on
      FROM eligible
     GROUP BY source_session
     ORDER BY source_session DESC
  `, [input.membershipId, asOf.toISOString()]);

  return priorCycleFinanceContextFromRows(result.rows);
}

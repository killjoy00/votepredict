import type { PoolClient } from 'pg';

export const CFB_BULK_AVAILABILITY_REPAIR_VERSION = 'cfb-bulk-availability-repair-v1';

const REPAIR_SQL = `
  WITH candidates AS (
    SELECT ei.id
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id = ei.source_document_id
     WHERE sd.source_kind = 'campaign_finance_bulk'
       AND (
         ei.published_at IS NOT NULL
         OR ei.metadata->>'asOfEligible' IS DISTINCT FROM 'false'
         OR ei.metadata->>'availabilityStatus' IS DISTINCT FROM 'awaiting_regulatory_disclosure_proof'
         OR ei.metadata->>'transactionDateIsAvailability' IS DISTINCT FROM 'false'
         OR ei.metadata->>'cfbBulkAvailabilityRepairVersion' IS DISTINCT FROM $2
       )
     ORDER BY ei.id
     LIMIT $1
     FOR UPDATE OF ei SKIP LOCKED
  )
  UPDATE evidence_items ei
     SET published_at = NULL,
         metadata = ei.metadata || jsonb_build_object(
           'asOfEligible', false,
           'availabilityStatus', 'awaiting_regulatory_disclosure_proof',
           'transactionDateIsAvailability', false,
           'cfbBulkAvailabilityRepairVersion', $2::text
         )
    FROM candidates
   WHERE ei.id = candidates.id
  RETURNING ei.id::text`;

export interface CfbBulkAvailabilityRepairResult {
  repaired: number;
  batches: number;
}

export async function repairLegacyCfbBulkAvailability(
  client: Pick<PoolClient, 'query'>,
  batchSize = 500,
): Promise<CfbBulkAvailabilityRepairResult> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error('CFB bulk availability repair batch size must be an integer between 1 and 5000');
  }

  let repaired = 0;
  let batches = 0;
  while (true) {
    const result = await client.query<{ id: string }>(REPAIR_SQL, [
      batchSize,
      CFB_BULK_AVAILABILITY_REPAIR_VERSION,
    ]);
    const count = result.rowCount ?? result.rows.length;
    if (count === 0) break;
    repaired += count;
    batches += 1;
  }

  return { repaired, batches };
}

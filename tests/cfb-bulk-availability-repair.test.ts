import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import {
  CFB_BULK_AVAILABILITY_REPAIR_VERSION,
  repairLegacyCfbBulkAvailability,
} from '../src/evidence/cfb-bulk-availability-repair';

test('legacy CFB availability repair is bounded, resumable, and fail-closed', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const batches = [
    [{ id: '1' }, { id: '2' }],
    [{ id: '3' }],
    [],
  ];
  const client = {
    async query(text: string, values: unknown[]) {
      calls.push({ text, values });
      const rows = batches.shift() ?? [];
      return { rows, rowCount: rows.length };
    },
  } as unknown as Pick<PoolClient, 'query'>;

  const result = await repairLegacyCfbBulkAvailability(client, 2);
  assert.deepEqual(result, { repaired: 3, batches: 2 });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].values, [2, CFB_BULK_AVAILABILITY_REPAIR_VERSION]);

  const sql = calls[0].text;
  assert.match(sql, /sd\.source_kind = 'campaign_finance_bulk'/);
  assert.match(sql, /ei\.published_at IS NOT NULL/);
  assert.match(sql, /SET published_at = NULL/);
  assert.match(sql, /'asOfEligible', false/);
  assert.match(sql, /'availabilityStatus', 'awaiting_regulatory_disclosure_proof'/);
  assert.match(sql, /'transactionDateIsAvailability', false/);
  assert.match(sql, /metadata = ei\.metadata \|\| jsonb_build_object/);
  assert.match(sql, /LIMIT \$1/);
  assert.match(sql, /SKIP LOCKED/);
});

test('legacy CFB availability repair rejects unsafe batch sizes', async () => {
  const client = { query: async () => { throw new Error('must not query'); } } as unknown as Pick<PoolClient, 'query'>;
  await assert.rejects(() => repairLegacyCfbBulkAvailability(client, 0), /between 1 and 5000/);
  await assert.rejects(() => repairLegacyCfbBulkAvailability(client, 5001), /between 1 and 5000/);
  await assert.rejects(() => repairLegacyCfbBulkAvailability(client, 1.5), /between 1 and 5000/);
});

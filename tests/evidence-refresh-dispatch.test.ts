import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceRefreshRunners } from '../src/evidence/refresh';

test('refresh entrypoint preserves each distinct source job, its inputs and its records', async () => {
  const calls: unknown[] = [];
  const production = { campaignFinance: { inserted: 3 }, bills: { inserted: 1 }, curated: {}, legislatorContext: {} };
  const publicResult = { pipelineVersion: 'public-evidence-v4', membershipsProcessed: 5, warnings: [] };
  const structured = { election: { attempted: 2 }, conference: { attempted: 1 } };
  const finance = { sourceMode: 'snapshot', inserted: 2, unresolved: 0 };
  const refresh = createEvidenceRefreshRunners({
    production: async () => { calls.push(['production']); return production; },
    public: async (options) => { calls.push(['public', options]); return publicResult; },
    structured: async (options) => { calls.push(['structured', options]); return structured; },
    campaignFinance: async () => { calls.push(['campaign-finance']); return finance; },
  });
  assert.deepEqual(await refresh.production(), production);
  assert.deepEqual(await refresh.public({ batchSize: 8, forceCampaignFinance: true }), publicResult);
  assert.deepEqual(await refresh.structured({ billBatchSize: 3 }), structured);
  assert.deepEqual(await refresh.campaignFinance(), finance);
  assert.deepEqual(calls, [
    ['production'],
    ['public', { batchSize: 8, forceCampaignFinance: true }],
    ['structured', { billBatchSize: 3 }],
    ['campaign-finance'],
  ]);
});

test('refresh entrypoint retains default options and propagates failures unchanged', async () => {
  const calls: unknown[] = [];
  const failure = new Error('source unavailable');
  const refresh = createEvidenceRefreshRunners({
    production: async () => ({ status: 'ok' }),
    public: async (options) => { calls.push(options); throw failure; },
    structured: async (options) => { calls.push(options); return { attempted: 0 }; },
    campaignFinance: async () => ({ inserted: 0 }),
  });
  assert.deepEqual(await refresh.structured(), { attempted: 0 });
  await assert.rejects(refresh.public(), (error: unknown) => error === failure);
  assert.deepEqual(calls, [{}, {}]);
});

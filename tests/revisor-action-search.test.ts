import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisorActionSearchUrl,
  filterRevisorSourceChamberBills,
  REVISOR_SOURCE_PASSAGE_ACTIONS,
  REVISOR_SOURCE_REPASS_ACTIONS,
} from '../src/sources/minnesota/revisor-action-search.js';
import type { RevisorBillSearchResult } from '../src/sources/minnesota/revisor-bill-search.js';

test('uses the verified source-chamber passage action categories', () => {
  assert.deepEqual(REVISOR_SOURCE_PASSAGE_ACTIONS.House, ['1283', '1284']);
  assert.deepEqual(REVISOR_SOURCE_PASSAGE_ACTIONS.Senate, ['2137', '2268', '2269']);
  assert.deepEqual(REVISOR_SOURCE_REPASS_ACTIONS.House, ['1287', '1288']);
  assert.deepEqual(REVISOR_SOURCE_REPASS_ACTIONS.Senate, ['2231', '2241', '2296']);
});

test('builds Revisor action searches with canonical session keys and one action per request', () => {
  const url = new URL(buildRevisorActionSearchUrl({
    sessionKey: '2025-2026',
    body: 'House',
    actionId: '1283',
  }));
  assert.equal(url.origin, 'https://www.revisor.mn.gov');
  assert.equal(url.pathname, '/bills/status_result.php');
  assert.equal(url.searchParams.get('body'), 'House');
  assert.equal(url.searchParams.get('search'), 'action');
  assert.equal(url.searchParams.get('session'), '0942025');
  assert.equal(url.searchParams.get('format'), 'xml');
  assert.deepEqual(url.searchParams.getAll('action[]'), ['1283']);
});

test('rejects nonnumeric action IDs', () => {
  assert.throws(() => buildRevisorActionSearchUrl({
    sessionKey: '2023-2024',
    body: 'Senate',
    actionId: 'passed',
  }), /must be numeric/);
});

test('filters House action results to HF and Senate action results to SF', () => {
  const rows: RevisorBillSearchResult[] = [
    { identifier: 'HF10', fileType: 'HF', fileNumber: 10, statusXmlUrl: 'https://api.revisor.mn.gov/HF10' },
    { identifier: 'SF20', fileType: 'SF', fileNumber: 20, statusXmlUrl: 'https://api.revisor.mn.gov/SF20' },
  ];
  assert.deepEqual(filterRevisorSourceChamberBills('House', rows).map((row) => row.identifier), ['HF10']);
  assert.deepEqual(filterRevisorSourceChamberBills('Senate', rows).map((row) => row.identifier), ['SF20']);
});

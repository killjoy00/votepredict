import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORICAL_DEEP_PILOT_CASES,
  historicalDeepPilotCaseKey,
  resolveHistoricalDeepPilotMetadata,
} from '../src/evaluation/historical-deep-pilot.js';

function row(overrides: Partial<{
  vote_event_id: string;
  bill_id: string;
  identifier: string;
  title: string;
  session_slug: string;
  chamber_id: string;
  chamber_slug: string;
  occurred_on: string;
  yea_count: number;
  nay_count: number;
  passed: boolean;
}> = {}) {
  return {
    vote_event_id: '11111111-1111-4111-8111-111111111111',
    bill_id: '22222222-2222-4222-8222-222222222222',
    identifier: 'HF1',
    title: 'Pilot bill',
    session_slug: '2023-2024',
    chamber_id: '33333333-3333-4333-8333-333333333333',
    chamber_slug: 'house',
    occurred_on: '2023-01-19',
    yea_count: 69,
    nay_count: 65,
    passed: true,
    ...overrides,
  };
}

test('Deep pilot cohort is pinned by stable legislative natural keys, not ingestion UUIDs', () => {
  assert.equal(HISTORICAL_DEEP_PILOT_CASES.length, 6);
  const keys = HISTORICAL_DEEP_PILOT_CASES.map(historicalDeepPilotCaseKey);
  assert.equal(new Set(keys).size, keys.length);
  for (const spec of HISTORICAL_DEEP_PILOT_CASES) {
    assert.match(spec.session, /^\d{4}-\d{4}$/);
    assert.match(spec.identifier, /^HF\d+$/);
    assert.match(spec.occurredOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal('voteEventId' in spec, false);
  }
});

test('Deep pilot metadata resolution maps a stable case to the current passage row UUID', () => {
  const resolved = resolveHistoricalDeepPilotMetadata(
    [{ session: '2023-2024', chamber: 'house', identifier: 'hf 1', occurredOn: '2023-01-19' }],
    [row({ vote_event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })],
  );
  assert.equal(resolved[0].vote_event_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});

test('Deep pilot metadata resolution fails closed on missing or ambiguous passage rows', () => {
  const spec = [{ session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19' }];
  assert.throws(() => resolveHistoricalDeepPilotMetadata(spec, []), /missing official passage metadata/i);
  assert.throws(() => resolveHistoricalDeepPilotMetadata(spec, [
    row({ vote_event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    row({ vote_event_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
  ]), /ambiguous/i);
});

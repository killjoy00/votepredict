import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_REVISOR_MAX_BILL_NUMBER,
  LIVE_REVISOR_SESSION,
  shouldStopLiveRevisorScan,
} from '../src/operations/live-revisor-universe.js';

test('live Revisor sync is pinned to the 2027-2028 prospective session', () => {
  assert.equal(LIVE_REVISOR_SESSION, '2027-2028');
  assert.equal(LIVE_REVISOR_MAX_BILL_NUMBER, 8_000);
});

test('live Revisor scanning stops at the first empty sequential bill-number block', () => {
  assert.equal(shouldStopLiveRevisorScan(500), false);
  assert.equal(shouldStopLiveRevisorScan(1), false);
  assert.equal(shouldStopLiveRevisorScan(0), true);
});

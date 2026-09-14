import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEMBER_HISTORY_CAP20_PROSPECTIVE_CAP,
  MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT,
  estimateMemberHistoryCap20ProspectiveShadow,
  shouldCaptureMemberHistoryCap20ProspectiveShadow,
} from '../src/forecasting/member-history-cap20-prospective-shadow.js';
import { estimateMemberProbability, MEMBER_MODEL_VERSION } from '../src/forecasting/member-model.js';

test('prospective cap-20 capture is limited to 2027-2028 Quick House and Senate forecasts', () => {
  assert.equal(shouldCaptureMemberHistoryCap20ProspectiveShadow({ sessionSlug: '2027-2028', chamberSlug: 'house', researchMode: 'quick' }), true);
  assert.equal(shouldCaptureMemberHistoryCap20ProspectiveShadow({ sessionSlug: '2027-2028', chamberSlug: 'senate', researchMode: 'quick' }), true);
  assert.equal(shouldCaptureMemberHistoryCap20ProspectiveShadow({ sessionSlug: '2025-2026', chamberSlug: 'house', researchMode: 'quick' }), false);
  assert.equal(shouldCaptureMemberHistoryCap20ProspectiveShadow({ sessionSlug: '2027-2028', chamberSlug: 'house', researchMode: 'deep' }), false);
  assert.equal(shouldCaptureMemberHistoryCap20ProspectiveShadow({ sessionSlug: '2027-2028', chamberSlug: 'other', researchMode: 'quick' }), false);
});

test('prospective shadow changes only the maximum member-history weight and never serves traffic', () => {
  const input = {
    memberId: 'member-1',
    party: 'A',
    global: { yes: 70, total: 100 },
    partyHistory: { yes: 30, total: 40 },
    memberHistory: { yes: 88, total: 100 },
    analogueYesRate: 0.6,
    analogueEffectiveWeight: 4,
  };
  const baseline = estimateMemberProbability(input);
  const shadow = estimateMemberHistoryCap20ProspectiveShadow(input);
  assert.ok(shadow);
  assert.equal(shadow.experiment, MEMBER_HISTORY_CAP20_PROSPECTIVE_EXPERIMENT);
  assert.equal(shadow.modelVersion, MEMBER_MODEL_VERSION);
  assert.equal(shadow.maximumMemberHistoryWeight, MEMBER_HISTORY_CAP20_PROSPECTIVE_CAP);
  assert.equal(shadow.servesTraffic, false);
  assert.equal(shadow.outcomeUseAtCapture, 'none');
  assert.notEqual(shadow.yesProbability, baseline.probability);
  assert.equal(
    shadow.yesProbability,
    estimateMemberProbability(input, { maximumMemberHistoryWeight: 20 }).probability,
  );
});

test('prospective shadow preserves fail-closed cannot-predict behavior', () => {
  const shadow = estimateMemberHistoryCap20ProspectiveShadow({
    memberId: 'member-2',
    party: 'A',
    global: { yes: 1, total: 1 },
  });
  assert.equal(shadow, undefined);
});

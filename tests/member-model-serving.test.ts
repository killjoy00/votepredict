import assert from 'node:assert/strict';
import test from 'node:test';
import { MEMBER_MODEL_VERSION } from '../src/forecasting/member-model';
import {
  DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS,
  DECAY180_MEMBER_MODEL_VERSION,
  MEMBER_MODEL_ROLLBACK_ENV,
  resolveServingMemberModelConfig,
} from '../src/forecasting/member-model-serving';

test('decay-180 is the serving default and legacy v1.1 remains the rollback shadow', () => {
  const config = resolveServingMemberModelConfig({ [MEMBER_MODEL_ROLLBACK_ENV]: undefined });
  assert.equal(MEMBER_MODEL_VERSION, 'member-eb-v1.1');
  assert.equal(config.modelVersion, DECAY180_MEMBER_MODEL_VERSION);
  assert.equal(config.memberHistoryHalfLifeDays, DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS);
  assert.equal(config.shadowModelVersion, MEMBER_MODEL_VERSION);
  assert.equal(config.shadowMemberHistoryHalfLifeDays, null);
  assert.equal(config.rollbackActive, false);
});

test('explicit rollback restores v1.1 and keeps decay-180 as a non-serving shadow', () => {
  for (const value of ['1', 'true', 'TRUE', 'yes', 'YES']) {
    const config = resolveServingMemberModelConfig({ [MEMBER_MODEL_ROLLBACK_ENV]: value });
    assert.equal(config.modelVersion, MEMBER_MODEL_VERSION);
    assert.equal(config.memberHistoryHalfLifeDays, null);
    assert.equal(config.shadowModelVersion, DECAY180_MEMBER_MODEL_VERSION);
    assert.equal(config.shadowMemberHistoryHalfLifeDays, DECAY180_MEMBER_HISTORY_HALF_LIFE_DAYS);
    assert.equal(config.rollbackActive, true);
  }
});

test('rollback requires an explicit truthy value', () => {
  for (const value of ['', '0', 'false', 'no', 'anything-else']) {
    const config = resolveServingMemberModelConfig({ [MEMBER_MODEL_ROLLBACK_ENV]: value });
    assert.equal(config.modelVersion, DECAY180_MEMBER_MODEL_VERSION);
    assert.equal(config.rollbackActive, false);
  }
});

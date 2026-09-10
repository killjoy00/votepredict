import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinaryMinnesotaPassageRule } from '../src/forecasting/minnesota-rules.js';
import { requiredYesForRule } from '../src/forecasting/chamber.js';
test('ordinary thresholds do not shrink when imported rosters omit members', () => {
  assert.equal(requiredYesForRule(ordinaryMinnesotaPassageRule('house'),130),68);
  assert.equal(requiredYesForRule(ordinaryMinnesotaPassageRule('senate'),65),34);
  assert.throws(()=>ordinaryMinnesotaPassageRule('committee'));
});

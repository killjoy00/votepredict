import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAMBER_HISTORICAL_RESIDUAL_SIGMA } from '../src/forecasting/chamber';
import { passageFragilityFeatures } from '../src/evaluation/passage-fragility-screen';

test('passage fragility features are computed only from pre-vote inputs', () => {
  const features = passageFragilityFeatures({
    members: [
      { probability: 0.6, party: 'A', analogueEffectiveWeight: 0 },
      { probability: 0.6, party: 'A', analogueEffectiveWeight: 1 },
      { probability: 0.9, party: 'B', analogueEffectiveWeight: 2 },
      { probability: 0.1, party: 'B', analogueEffectiveWeight: 0 },
    ],
    expectedYes: 2.2,
    requiredYes: 3,
    directAnalogueMembers: 2,
    activeMembers: 4,
    selectedAnalogues: 5,
  });

  assert.ok(Math.abs(features.marginRisk - (0.8 / CHAMBER_HISTORICAL_RESIDUAL_SIGMA)) < 1e-12);
  assert.ok(features.meanEntropy > 0 && features.meanEntropy < 1);
  assert.equal(features.swingShare40to60, 0.5);
  assert.ok(Math.abs(features.softYesExpectedShare - (1.2 / 2.2)) < 1e-12);
  assert.equal(features.analogueCoverageGap, 0.5);
  assert.equal(features.analogueCountGap, 0.5);
  assert.ok(Math.abs(features.analogueWeightRisk - (1 / 1.75)) < 1e-12);
  assert.ok(Math.abs(features.partyExpectedYesConcentration - ((1.2 / 2.2) ** 2 + (1 / 2.2) ** 2)) < 1e-12);
});

test('maximum member uncertainty has entropy one', () => {
  const features = passageFragilityFeatures({
    members: [
      { probability: 0.5, party: 'A', analogueEffectiveWeight: 1 },
      { probability: 0.5, party: 'B', analogueEffectiveWeight: 1 },
    ],
    expectedYes: 1,
    requiredYes: 2,
    directAnalogueMembers: 2,
    activeMembers: 2,
    selectedAnalogues: 10,
  });
  assert.equal(features.meanEntropy, 1);
  assert.equal(features.swingShare40to60, 1);
  assert.equal(features.analogueCoverageGap, 0);
  assert.equal(features.analogueCountGap, 0);
});

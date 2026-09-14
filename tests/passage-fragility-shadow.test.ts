import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAMBER_HISTORICAL_RESIDUAL_SIGMA, simulateChamber } from '../src/forecasting/chamber';
import {
  computePassageFragilityShadow,
  passageFragilityReferencePercentile,
  PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ID,
  PASSAGE_FRAGILITY_SHADOW_VERSION,
} from '../src/forecasting/passage-fragility-shadow';

test('frozen reference percentile preserves tie midpoints and interpolates unseen values', () => {
  assert.equal(passageFragilityReferencePercentile([0, 1, 1, 3], 1), 0.5);
  assert.ok(Math.abs(passageFragilityReferencePercentile([0, 2, 4], 3) - 0.75) < 1e-12);
  assert.equal(passageFragilityReferencePercentile([0, 2, 4], -1), 0);
  assert.equal(passageFragilityReferencePercentile([0, 2, 4], 5), 1);
});

test('strong analogue evidence leaves the shadow equal to serving', () => {
  const probabilities = Array.from({ length: 134 }, () => 0.72);
  const passageRule = { kind: 'fixed' as const, requiredYes: 68 };
  const serving = simulateChamber(probabilities, passageRule).passageProbability;
  const shadow = computePassageFragilityShadow({
    memberProbabilities: probabilities,
    analogueEffectiveWeights: Array.from({ length: 134 }, () => 10),
    selectedAnalogues: 10,
    passageRule,
    servingPassageProbability: serving,
  });

  assert.equal(shadow.version, PASSAGE_FRAGILITY_SHADOW_VERSION);
  assert.equal(shadow.flagged, false);
  assert.equal(shadow.shadowPassageProbability, serving);
  assert.equal(shadow.servesTraffic, false);
  assert.equal(shadow.outcomeUseAtCapture, 'none');
  assert.equal(shadow.reference.artifactId, PASSAGE_FRAGILITY_REFERENCE_ARTIFACT_ID);
});

test('weak analogue evidence flags and widens only the non-serving shadow', () => {
  const probabilities = Array.from({ length: 134 }, () => 0.58);
  const passageRule = { kind: 'fixed' as const, requiredYes: 68 };
  const serving = simulateChamber(probabilities, passageRule, {
    systematicSigmaVotes: CHAMBER_HISTORICAL_RESIDUAL_SIGMA,
  }).passageProbability;
  const shadow = computePassageFragilityShadow({
    memberProbabilities: probabilities,
    analogueEffectiveWeights: Array.from({ length: 134 }, () => 0),
    selectedAnalogues: 1,
    passageRule,
    servingPassageProbability: serving,
  });

  assert.equal(shadow.flagged, true);
  assert.equal(shadow.evidenceRiskPercentile, 1);
  assert.equal(shadow.sigmaMultiplier, 1.25);
  assert.equal(shadow.servingPassageProbability, serving);
  assert.notEqual(shadow.shadowPassageProbability, serving);
  assert.equal(shadow.servesTraffic, false);
  assert.equal(shadow.outcomeUseAtCapture, 'none');
});

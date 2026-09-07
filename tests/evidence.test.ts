import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEvidenceSignals, evidenceLogitDelta } from '../src/evidence/impact.js';
import { memberEvidenceGap, memberPivotality, memberUncertainty, selectDeepResearchTargets } from '../src/evidence/targeting.js';
import type { EvidenceSignal } from '../src/evidence/types.js';

test('uncertainty is maximal near 50 percent and for cannot-predict probabilities', () => {
  assert.equal(memberUncertainty(0.5), 1);
  assert.ok(Math.abs(memberUncertainty(0.9) - 0.2) < 1e-12);
  assert.equal(memberUncertainty(undefined), 1);
});

test('evidence gap is larger when evidence is thin or stale', () => {
  const strong = memberEvidenceGap({ evidenceQuality: 0.9, evidenceAgeDays: 7 });
  const weak = memberEvidenceGap({ evidenceQuality: 0.2, evidenceAgeDays: 365 });
  const missing = memberEvidenceGap({});
  assert.ok(strong < weak);
  assert.ok(weak < missing || Math.abs(weak - missing) < 1e-12);
  assert.equal(missing, 1);
});

test('Deep targeting prioritizes an equally pivotal uncertain member with the bigger evidence gap', () => {
  const candidates = [
    { membershipId: 'well-covered-swing', yesProbability: 0.5, evidenceQuality: 0.95, evidenceAgeDays: 2 },
    { membershipId: 'thin-evidence-swing', yesProbability: 0.5, evidenceQuality: 0.1, evidenceAgeDays: 365 },
    { membershipId: 'likely-yes', yesProbability: 0.95, evidenceQuality: 0.95, evidenceAgeDays: 2 },
  ];
  const rule = { kind: 'fixed' as const, requiredYes: 2 };
  assert.ok(Math.abs(memberPivotality(candidates, 'well-covered-swing', rule) - memberPivotality(candidates, 'thin-evidence-swing', rule)) < 1e-12);
  const targets = selectDeepResearchTargets(candidates, rule, { limit: 2 });
  assert.equal(targets[0].membershipId, 'thin-evidence-swing');
  assert.equal(targets[0].rank, 1);
  assert.ok(targets[0].priorityScore > targets[1].priorityScore);
});

test('cannot-predict members remain eligible for targeted research', () => {
  const targets = selectDeepResearchTargets([
    { membershipId: 'unknown', cannotPredictReason: 'insufficient historical support' },
    { membershipId: 'likely-no', yesProbability: 0.05, evidenceQuality: 0.9, evidenceAgeDays: 1 },
    { membershipId: 'likely-yes', yesProbability: 0.95, evidenceQuality: 0.9, evidenceAgeDays: 1 },
  ], { kind: 'fixed', requiredYes: 2 }, { limit: 1 });
  assert.equal(targets[0].membershipId, 'unknown');
  assert.match(targets[0].rationale, /insufficient historical support/);
});

const directSupport: EvidenceSignal = {
  evidenceId: 'direct',
  kind: 'direct_statement',
  stance: 'supports',
  sourceQuality: 'member_primary',
  relevance: 'direct',
  freshness: 'current',
  confidence: 0.95,
};

const relatedSupport: EvidenceSignal = {
  evidenceId: 'related',
  kind: 'related_statement',
  stance: 'supports',
  sourceQuality: 'member_primary',
  relevance: 'direct',
  freshness: 'current',
  confidence: 0.95,
};

test('direct statements move probability more than related statements without creating certainty', () => {
  assert.ok(evidenceLogitDelta(directSupport) > evidenceLogitDelta(relatedSupport));
  const direct = applyEvidenceSignals(0.5, [directSupport]);
  const related = applyEvidenceSignals(0.5, [relatedSupport]);
  assert.ok(direct.probability > related.probability);
  assert.ok(direct.probability < 1);
  assert.ok(direct.probability > 0.5);
});

test('opposing direct evidence moves in the opposite direction and remains bounded', () => {
  const opposition = { ...directSupport, evidenceId: 'oppose', stance: 'opposes' as const };
  const result = applyEvidenceSignals(0.5, [opposition]);
  assert.ok(result.probability < 0.5);
  assert.ok(result.probability > 0);
});

test('neutral or unclear evidence is stored but does not mechanically move the model', () => {
  const neutral = { ...directSupport, evidenceId: 'neutral', stance: 'neutral' as const };
  const result = applyEvidenceSignals(0.63, [neutral]);
  assert.ok(Math.abs(result.probability - 0.63) < 1e-12);
  assert.equal(result.totalLogitDelta, 0);
});

test('many same-direction signals remain bounded away from literal certainty', () => {
  const result = applyEvidenceSignals(0.5, Array.from({ length: 20 }, (_, index) => ({ ...directSupport, evidenceId: `d${index}` })));
  assert.equal(result.probability, 0.995);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEvidenceSignals } from '../src/evidence/impact.js';
import { evidenceImpactPolicy } from '../src/evidence/policy.js';

test('verified exact direct statement moves a neutral prior toward the documented high-confidence range', () => {
  const result = applyEvidenceSignals(0.5, [{
    kind: 'direct_statement',
    stance: 'supports',
    sourceQuality: 'member_primary',
    relevance: 'direct',
    freshness: 'current',
    confidence: 0.95,
  }]);
  assert.ok(result.probability > 0.97);
  assert.ok(result.probability < 0.99);
});

test('low-confidence evidence is retained but excluded from mechanical impact', () => {
  const decision = evidenceImpactPolicy({
    sourceUrl: 'https://example.test/noisy',
    kind: 'direct_statement',
    stance: 'supports',
    claim: 'Potential support.',
    sourceQuality: 'reputable_secondary',
    relevance: 'high',
    freshness: 'recent',
    confidence: 0.3,
    targetMembershipId: 'm1',
  });
  assert.equal(decision.mechanicallyActionable, false);
  assert.match(decision.rationale, /confidence/i);
});

test('model inference cannot recursively become probability-moving evidence', () => {
  const decision = evidenceImpactPolicy({
    sourceUrl: 'internal://model',
    kind: 'inference',
    stance: 'supports',
    claim: 'Model thinks the member is likely supportive.',
    sourceQuality: 'official',
    relevance: 'direct',
    freshness: 'current',
    confidence: 0.99,
    targetMembershipId: 'm1',
  });
  assert.equal(decision.mechanicallyActionable, false);
  assert.match(decision.rationale, /cannot feed itself back/i);
});

test('unknown-source directional evidence requires verification before impact', () => {
  const decision = evidenceImpactPolicy({
    sourceUrl: 'https://example.test/rumor',
    kind: 'related_statement',
    stance: 'opposes',
    claim: 'Unverified opposition claim.',
    sourceQuality: 'unknown',
    relevance: 'high',
    freshness: 'current',
    confidence: 0.9,
    targetMembershipId: 'm1',
  });
  assert.equal(decision.mechanicallyActionable, false);
  assert.match(decision.rationale, /verification/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseEvidence } from '../src/evidence/diagnostics.js';

test('diagnostics identify duplicate normalized claims for the same member', () => {
  const result = diagnoseEvidence([
    {
      sourceUrl: 'https://example.test/a',
      kind: 'direct_statement',
      stance: 'supports',
      claim: 'I will vote YES.',
      sourceQuality: 'member_primary',
      relevance: 'direct',
      freshness: 'current',
      targetMembershipId: 'm1',
    },
    {
      sourceUrl: 'https://example.test/b',
      kind: 'direct_statement',
      stance: 'supports',
      claim: '  i will vote yes.  ',
      sourceQuality: 'reputable_secondary',
      relevance: 'direct',
      freshness: 'recent',
      targetMembershipId: 'm1',
    },
  ]);
  assert.equal(result.relationships.length, 1);
  assert.equal(result.relationships[0].kind, 'duplicates');
});

test('diagnostics surface contradictory directional statements without deciding which is true', () => {
  const result = diagnoseEvidence([
    {
      sourceUrl: 'https://example.test/old',
      kind: 'direct_statement',
      stance: 'supports',
      claim: 'I support the proposal.',
      sourceQuality: 'member_primary',
      relevance: 'direct',
      freshness: 'recent',
      targetMembershipId: 'm1',
    },
    {
      sourceUrl: 'https://example.test/new',
      kind: 'direct_statement',
      stance: 'opposes',
      claim: 'I now oppose the proposal.',
      sourceQuality: 'member_primary',
      relevance: 'direct',
      freshness: 'current',
      targetMembershipId: 'm1',
    },
  ]);
  assert.equal(result.relationships.length, 1);
  assert.equal(result.relationships[0].kind, 'contradicts');
});

test('diagnostics count unscoped and low-confidence evidence', () => {
  const result = diagnoseEvidence([
    {
      sourceUrl: 'https://example.test/context',
      kind: 'context',
      stance: 'neutral',
      claim: 'General context.',
      sourceQuality: 'reputable_secondary',
      relevance: 'medium',
      freshness: 'recent',
      confidence: 0.4,
    },
  ]);
  assert.equal(result.unscopedItems, 1);
  assert.equal(result.lowConfidenceItems, 1);
});

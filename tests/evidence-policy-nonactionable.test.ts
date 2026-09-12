import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceImpactPolicy } from '../src/evidence/policy.js';

test('durably context-only evidence cannot mechanically affect a forecast', () => {
  const decision = evidenceImpactPolicy({
    sourceUrl: 'https://www.revisor.mn.gov/bills/bill.php?b=House&f=HF1842&ssn=0&y=2025',
    kind: 'fact',
    stance: 'supports',
    claim: 'Member is listed as a bill author.',
    sourceQuality: 'official',
    relevance: 'medium',
    freshness: 'recent',
    confidence: 1,
    targetMembershipId: 'm1',
    metadata: { mechanicallyActionable: false, durableIngestion: true },
  });
  assert.equal(decision.mechanicallyActionable, false);
  assert.match(decision.rationale, /explicitly marked|context-only|non-actionable/i);
});

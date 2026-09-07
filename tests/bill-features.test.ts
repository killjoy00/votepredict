import test from 'node:test';
import assert from 'node:assert/strict';
import { billFeatureSimilarity, classifyBillRelationship, extractDeterministicBillFeatures, retrieveHistoricalAnalogues, selectVersionAsOf, type BillFeatureIdentity, type HistoricalAnalogueCandidate } from '../src/features/bills.js';

const healthText = `Section 1. A health care grant program is established. The commissioner shall award grants to hospitals. $5,000,000 is appropriated for the program. Section 2. Hospitals must submit a report.`;
const taxText = `Section 1. The individual income tax rate is increased. A surcharge applies to taxable income. The commissioner of revenue shall administer the tax.`;

test('deterministic bill features are inspectable and stable', () => {
  const features = extractDeterministicBillFeatures({ title: 'Health care grant program', text: healthText });
  assert.match(features.bodyHash, /^[a-f0-9]{64}$/);
  assert.ok(features.policyAreas.includes('health'));
  assert.ok(features.actionTypes.includes('grant'));
  assert.ok(features.actionTypes.includes('appropriation'));
  assert.ok(features.affectedEntities.includes('health_providers'));
  assert.equal(features.fiscal.direction, 'expansionary');
  assert.ok(features.tokenCount > 20);
});

test('feature similarity rewards substantively similar bills', () => {
  const health = extractDeterministicBillFeatures({ title: 'Hospital grant program', text: healthText });
  const similar = extractDeterministicBillFeatures({ title: 'Medical provider grants', text: `${healthText} Additional reporting is required.` });
  const tax = extractDeterministicBillFeatures({ title: 'Income tax surcharge', text: taxText });
  assert.ok(billFeatureSimilarity(health, similar) > billFeatureSimilarity(health, tax));
});

test('version selection never uses a version published after the cutoff', () => {
  const versions = [
    { publishedAt: '2025-01-10T00:00:00Z', key: 'intro' },
    { publishedAt: '2025-02-10T00:00:00Z', key: 'first' },
    { publishedAt: '2025-03-10T00:00:00Z', key: 'second' },
  ];
  assert.equal(selectVersionAsOf(versions, '2025-02-15T00:00:00Z')?.key, 'first');
  assert.equal(selectVersionAsOf(versions, '2025-01-01T00:00:00Z'), undefined);
});

test('official companions and cross-session identical text are classified conservatively', () => {
  const features = extractDeterministicBillFeatures({ title: 'Health bill', text: healthText });
  const a: BillFeatureIdentity = { billId: 'a', billVersionId: 'av', identifier: 'HF1', companionIdentifier: 'SF2', session: '2025-2026', title: 'Health bill', publishedAt: '2025-01-01', features };
  const companion: BillFeatureIdentity = { ...a, billId: 'b', billVersionId: 'bv', identifier: 'SF2', companionIdentifier: undefined };
  const reintroduced: BillFeatureIdentity = { ...a, billId: 'c', billVersionId: 'cv', identifier: 'HF99', companionIdentifier: undefined, session: '2023-2024' };
  assert.equal(classifyBillRelationship(a, companion), 'official-companion');
  assert.equal(classifyBillRelationship(a, reintroduced), 'reintroduced');
});

test('analogue retrieval excludes future votes and versions unavailable on the vote date', () => {
  const targetFeatures = extractDeterministicBillFeatures({ title: 'Health grants', text: healthText });
  const target: BillFeatureIdentity = { billId: 'target', billVersionId: 'target-v', identifier: 'HF10', session: '2025-2026', title: 'Health grants', publishedAt: '2025-03-01T00:00:00Z', features: targetFeatures };
  const candidateBase: Omit<HistoricalAnalogueCandidate, 'voteEventId' | 'occurredAt' | 'publishedAt'> = {
    billId: 'old', billVersionId: 'old-v', identifier: 'HF20', session: '2023-2024', title: 'Hospital grant program', chamber: 'house', yeaCount: 80, nayCount: 50, passed: true,
    features: extractDeterministicBillFeatures({ title: 'Hospital grant program', text: `${healthText} A study is required.` }),
  };
  const candidates: HistoricalAnalogueCandidate[] = [
    { ...candidateBase, voteEventId: 'good', publishedAt: '2024-01-01T00:00:00Z', occurredAt: '2024-02-01T23:59:59Z' },
    { ...candidateBase, voteEventId: 'future', publishedAt: '2025-03-01T00:00:00Z', occurredAt: '2025-05-01T23:59:59Z' },
    { ...candidateBase, voteEventId: 'late-version', publishedAt: '2024-03-01T00:00:00Z', occurredAt: '2024-02-01T23:59:59Z' },
  ];
  const results = retrieveHistoricalAnalogues(target, candidates, '2025-04-01T00:00:00Z');
  assert.deepEqual(results.map((result) => result.candidate.voteEventId), ['good']);
  assert.ok(results[0].reasons.some((reason) => reason.startsWith('policy:')));
});

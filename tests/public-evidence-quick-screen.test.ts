import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFinanceOffset,
  fitOffsetRidge,
  fitStandardization,
  publicFinanceFeatures,
  publicFinanceMemberMatchKey,
  standardizeVector,
} from '../src/evaluation/public-evidence-quick-screen';
import { normalizeFinanceDate, type PublicFinanceTransaction } from '../src/evaluation/public-finance-data';

test('finance dates normalize without using future records', () => {
  assert.equal(normalizeFinanceDate('5/19/2026'), '2026-05-19');
  assert.equal(normalizeFinanceDate('2024-02-03T00:00:00'), '2024-02-03');
  assert.equal(normalizeFinanceDate('not-a-date'), undefined);
});

test('member finance identity uses stable first/last matching', () => {
  assert.equal(publicFinanceMemberMatchKey('Bianca Ward Virnig'), 'bianca|virnig');
  assert.equal(publicFinanceMemberMatchKey('John A. Smith Jr.'), 'john|smith');
});

test('public finance features are strictly pre-vote and session bounded', () => {
  const rows: PublicFinanceTransaction[] = [
    { chamber: 'house', matchKey: 'a|b', candidateName: 'A B', occurredOn: '2025-01-01', kind: 'receipts', amount: 100 },
    { chamber: 'house', matchKey: 'a|b', candidateName: 'A B', occurredOn: '2025-02-01', kind: 'spending', amount: 50 },
    { chamber: 'house', matchKey: 'a|b', candidateName: 'A B', occurredOn: '2025-03-01', kind: 'independent', amount: -25 },
    { chamber: 'house', matchKey: 'a|b', candidateName: 'A B', occurredOn: '2025-04-01', kind: 'receipts', amount: 9999 },
    { chamber: 'house', matchKey: 'a|b', candidateName: 'A B', occurredOn: '2024-12-31', kind: 'receipts', amount: 9999 },
  ];
  const features = publicFinanceFeatures(rows, '2025-2026', '2025-04-01');
  assert.ok(features);
  assert.ok(Math.abs(features[0] - Math.log1p(100)) < 1e-12);
  assert.ok(Math.abs(features[1] - Math.log1p(50)) < 1e-12);
  assert.ok(Math.abs(features[2] - Math.log1p(25)) < 1e-12);
  assert.ok(Math.abs(features[3] - Math.log1p(3)) < 1e-12);
});

test('ridge offset learns incremental signal without changing zero-feature average', () => {
  const raw = Array.from({ length: 200 }, (_, index) => [index % 2 ? 2 : -2, 0, 0, 0] as [number, number, number, number]);
  const standardization = fitStandardization(raw);
  const observations = raw.map((features, index) => ({
    baseProbability: 0.5,
    outcome: (index % 2 ? 1 : 0) as 0 | 1,
    features: standardizeVector(features, standardization),
  }));
  const beta = fitOffsetRidge(observations, 1);
  assert.ok(beta[0] > 0.5);
  const positive = applyFinanceOffset(0.5, standardizeVector([2, 0, 0, 0], standardization), beta);
  const negative = applyFinanceOffset(0.5, standardizeVector([-2, 0, 0, 0], standardization), beta);
  assert.ok(positive > 0.5);
  assert.ok(negative < 0.5);
});

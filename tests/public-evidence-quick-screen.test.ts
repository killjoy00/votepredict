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
import {
  normalizeFinanceDate,
  parsePublicFinanceCsvTransactions,
  type PublicFinanceTransaction,
} from '../src/evaluation/public-finance-data';

test('finance dates normalize without using future records', () => {
  assert.equal(normalizeFinanceDate('5/19/2026'), '2026-05-19');
  assert.equal(normalizeFinanceDate('2024-02-03T00:00:00'), '2024-02-03');
  assert.equal(normalizeFinanceDate('not-a-date'), undefined);
  assert.equal(normalizeFinanceDate('2025-02-30'), undefined);
  assert.equal(normalizeFinanceDate('2/30/2025'), undefined);
});

test('member finance identity uses stable first/last matching', () => {
  assert.equal(publicFinanceMemberMatchKey('Bianca Ward Virnig'), 'bianca|virnig');
  assert.equal(publicFinanceMemberMatchKey('John A. Smith Jr.'), 'john|smith');
});

test('public finance features use disclosure time and carry pre-session disclosures forward', () => {
  const rows: PublicFinanceTransaction[] = [
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2024-10-01', availableOn: '2024-10-28', availabilitySource: 'direct_disclosure',
      kind: 'receipts', amount: 100,
    },
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2025-02-01', availableOn: '2025-02-10', availabilitySource: 'direct_disclosure',
      kind: 'spending', amount: 50,
    },
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2025-03-01', availableOn: '2025-03-15', availabilitySource: 'direct_disclosure',
      kind: 'independent', amount: -25,
    },
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2025-01-15', availableOn: '2025-04-01', availabilitySource: 'direct_disclosure',
      kind: 'receipts', amount: 9999,
    },
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2025-01-10', availableOn: null, availabilitySource: null,
      kind: 'receipts', amount: 9999,
    },
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2025-02-01', availableOn: '2025-02-10',
      statutoryNotBeforeOn: '2025-02-10',
      availabilitySource: 'filed_due_statutory_release',
      kind: 'spending', amount: 9999,
    },
    {
      chamber: 'house', matchKey: 'a|b', candidateName: 'A B',
      occurredOn: '2025-02-10', availableOn: '2025-02-09', availabilitySource: 'direct_disclosure',
      kind: 'spending', amount: 9999,
    },
  ];
  const features = publicFinanceFeatures(rows, '2025-2026', '2025-04-01');
  assert.ok(features);
  assert.ok(Math.abs(features[0] - Math.log1p(100)) < 1e-12);
  assert.ok(Math.abs(features[1] - Math.log1p(50)) < 1e-12);
  assert.ok(Math.abs(features[2] - Math.log1p(25)) < 1e-12);
  assert.ok(Math.abs(features[3] - Math.log1p(3)) < 1e-12);
});

test('source-labelled statutory release floors remain audit debt, never a public-by date', () => {
  const csv = [
    'Recipient,Receipt date,Amount,Filed date,Report due date,Disclosure date',
    '"Murphy, Erin Senate Committee",10/10/2025,125,10/22/2025,10/28/2025,',
    '"Murphy, Erin Senate Committee",10/11/2025,200,10/22/2025,10/28/2025,11/01/2025',
    '"Murphy, Erin Senate Committee",10/12/2025,500,10/22/2025,10/28/2025,10/01/2025',
  ].join('\n');
  const result = parsePublicFinanceCsvTransactions(csv, 'receipts');
  assert.equal(result.rawRows, 3);
  assert.equal(result.datedRows, 3);
  assert.equal(result.availabilityDatedRows, 1);
  assert.equal(result.statutoryFloorOnlyRows, 2);
  assert.equal(result.transactions.length, 3);
  const [floorOnly, published, impossible] = result.transactions;
  assert.equal(floorOnly?.chamber, 'senate');
  assert.equal(floorOnly?.availableOn, null);
  assert.equal(floorOnly?.availabilitySource, null);
  assert.equal(floorOnly?.statutoryNotBeforeOn, '2025-10-29');
  assert.equal(published?.availableOn, '2025-11-01');
  assert.equal(published?.availabilitySource, 'direct_disclosure');
  assert.equal(impossible?.availableOn, null, 'disclosure before the transaction must not qualify');
  const matched = publicFinanceFeatures(result.transactions, '2025-2026', '2025-11-03');
  assert.ok(matched);
  assert.ok(Math.abs(matched[0] - Math.log1p(200)) < 1e-12);
  assert.ok(Math.abs(matched[3] - Math.log1p(1)) < 1e-12);
  assert.equal(publicFinanceFeatures(result.transactions, '2025-2026', '2025-10-30'), undefined);
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

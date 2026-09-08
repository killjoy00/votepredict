import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGamblingBill, extractGamblingBillFeatures, scoreTribalGamingAlignment, type TribalAlignmentSignal } from '../src/gambling/policy.js';

test('gambling classifier does not confuse emerging technologies with gaming', () => {
  assert.equal(classifyGamblingBill('Uniform Commercial Code amendments adopted to accommodate emerging technologies.'), undefined);
});

test('sports betting titles classify as direct gambling legislation', () => {
  const result = classifyGamblingBill('Sports betting provided for and authorized, licenses established, and taxation provided.');
  assert.equal(result?.scope, 'direct');
  assert.equal(result?.topic, 'sports_betting');
});

test('gambling provisions inside an omnibus bill classify as embedded', () => {
  const result = classifyGamblingBill(
    'Omnibus tax bill.',
    'Lawful gambling taxes are modified. Gambling receipts and pull-tabs are addressed in this article.',
  );
  assert.equal(result?.scope, 'embedded');
  assert.equal(result?.topic, 'charitable_gambling');
  assert.ok((result?.termHits ?? 0) >= 3);
});

test('structured gambling features preserve coalition-defining policy choices', () => {
  const features = extractGamblingBillFeatures(
    'Sports wagering authorization',
    'Tribal nations may offer mobile sports wagering. Racetracks receive a revenue distribution. A 20 percent tax supports problem gambling. A person must be at least 21 years of age.',
  );
  assert.equal(features?.topic, 'sports_betting');
  assert.equal(features?.licenseModel, 'tribal_exclusive');
  assert.equal(features?.mobileAllowed, true);
  assert.equal(features?.racetrackRole, 'revenue_share');
  assert.deepEqual(features?.taxRatesPercent, [20]);
  assert.equal(features?.minimumAge, 21);
  assert.ok(features?.revenueRecipients.includes('problem_gambling'));
});

test('one aligned benchmark signal shrinks toward neutral instead of scoring 100', () => {
  const signals: TribalAlignmentSignal[] = [{
    benchmarkKey: 'a',
    label: 'Test vote',
    kind: 'vote',
    aligned: true,
    weight: 2,
    sourceUrl: 'https://example.com/source',
    sourceOrganization: 'Test source',
    detail: 'Test',
  }];
  const result = scoreTribalGamingAlignment(signals);
  assert.equal(result.score, 75);
  assert.equal(result.confidence, 'low');
});

test('stronger vote signal replaces sponsorship for the same benchmark', () => {
  const signals: TribalAlignmentSignal[] = [
    {
      benchmarkKey: 'same-bill',
      label: 'Sponsored',
      kind: 'sponsorship',
      aligned: true,
      weight: 0.75,
      sourceUrl: 'https://example.com/sponsor',
      sourceOrganization: 'Test',
      detail: 'Sponsored',
    },
    {
      benchmarkKey: 'same-bill',
      label: 'Voted no',
      kind: 'vote',
      aligned: false,
      weight: 2,
      sourceUrl: 'https://example.com/vote',
      sourceOrganization: 'Test',
      detail: 'Vote',
    },
  ];
  const result = scoreTribalGamingAlignment(signals);
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0]?.kind, 'vote');
  assert.equal(result.score, 25);
});

test('no evidence produces no tribal gaming alignment rating', () => {
  const result = scoreTribalGamingAlignment([]);
  assert.equal(result.score, undefined);
  assert.equal(result.confidence, 'none');
});

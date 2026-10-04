import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVIDENCE_QUALITY_HISTORICAL_FEATURES,
  evidenceQualityFeaturesAsOf,
  type EvidenceQualityExactSignal,
} from '../src/evaluation/evidence-quality-historical-features.js';

function signal(input: Partial<EvidenceQualityExactSignal> & Pick<EvidenceQualityExactSignal, 'fingerprint' | 'availableOn'>): EvidenceQualityExactSignal {
  return {
    fingerprint: input.fingerprint,
    membershipId: input.membershipId ?? 'm1',
    billId: input.billId ?? 'b1',
    availableOn: input.availableOn,
    supports: input.supports ?? false,
    opposes: input.opposes ?? false,
    mixed: input.mixed ?? false,
    directQuoteSupport: input.directQuoteSupport ?? false,
    directQuoteOppose: input.directQuoteOppose ?? false,
    explicitSupport: input.explicitSupport ?? false,
    explicitOppose: input.explicitOppose ?? false,
    supportConfidence: input.supportConfidence ?? 0,
    opposeConfidence: input.opposeConfidence ?? 0,
    mixedConfidence: input.mixedConfidence ?? 0,
  };
}

test('Evidence Quality historical features use strict pre-event availability', () => {
  const features = evidenceQualityFeaturesAsOf([
    signal({ fingerprint: 'a', availableOn: '2023-01-01', supports: true, explicitSupport: true, supportConfidence: 0.9 }),
    signal({ fingerprint: 'b', availableOn: '2023-02-01', opposes: true, explicitOppose: true, opposeConfidence: 0.8 }),
  ], '2023-02-01');

  assert.equal(features.length, EVIDENCE_QUALITY_HISTORICAL_FEATURES.length);
  assert.deepEqual(features.slice(0, 4), [1, 1, 0, 0]);
});

test('Evidence Quality historical features deduplicate repeated semantic fingerprints', () => {
  const features = evidenceQualityFeaturesAsOf([
    signal({ fingerprint: 'same', availableOn: '2022-01-01', supports: true, directQuoteSupport: true, supportConfidence: 0.91 }),
    signal({ fingerprint: 'same', availableOn: '2022-02-01', supports: true, directQuoteSupport: true, supportConfidence: 0.91 }),
  ], '2022-03-01');

  assert.equal(features[1], 1);
  assert.equal(features[4], 1);
  assert.equal(features[8], 0.91);
});

test('Evidence Quality historical features expose exact-bill conflict without resolving it', () => {
  const features = evidenceQualityFeaturesAsOf([
    signal({ fingerprint: 'support', availableOn: '2024-01-01', supports: true, explicitSupport: true, supportConfidence: 0.95 }),
    signal({ fingerprint: 'oppose', availableOn: '2024-01-02', opposes: true, directQuoteOppose: true, opposeConfidence: 0.97 }),
  ], '2024-02-01');

  assert.equal(features[1], 1);
  assert.equal(features[2], 1);
  assert.equal(features[11], 1);
});

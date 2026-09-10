import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditBillFeature } from '../src/features/feature-audit.js';

test('feature repair uses repository extraction and hashes the actual source text', () => {
  const source = { id: 'v', bill_id: 'b', identifier: 'HF1', session_slug: '2025-2026', title: 'Sports wagering', version_key: '0', published_at: '2025-01-01', raw_text: 'Tribal sports wagering and mobile betting licensing.', source_url: 'https://www.revisor.mn.gov/', stored_features: {} };
  const result = auditBillFeature(source);
  assert.equal(result.changed, true);
  assert.equal(result.provenance.sourceTextHash, createHash('sha256').update(source.raw_text).digest('hex'));
  assert.equal(result.provenance.extractionMethod, 'repository-typescript-extractor');
  assert.equal(auditBillFeature({ ...source, stored_features: result.features }).changed, false);
  assert.equal(source.stored_features && Object.keys(source.stored_features).length, 0);
});

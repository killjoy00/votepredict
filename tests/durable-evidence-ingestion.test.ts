import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceIngestionKey, type DurableEvidenceDraft } from '../src/evidence/durable-ingestion';

const draft: DurableEvidenceDraft = {
  kind: 'context',
  stance: 'neutral',
  claim: 'Official campaign-finance aggregate.',
  publishedAt: '2026-07-01T00:00:00.000Z',
  sourceQuality: 'official',
  relevance: 'low',
  freshness: 'current',
  extractionMethod: 'deterministic-test',
  extractionVersion: 'v1',
  metadata: { ignoredByKey: true },
};

const base = {
  sourceUrl: 'https://example.test/source.csv',
  contentSha256: 'a'.repeat(64),
  membershipId: '11111111-1111-1111-1111-111111111111',
  billId: '22222222-2222-2222-2222-222222222222',
  draft,
};

test('durable evidence ingestion key is deterministic and SHA-256 shaped', () => {
  const first = evidenceIngestionKey(base);
  const second = evidenceIngestionKey({ ...base, draft: { ...draft, metadata: { differentMetadata: true } } });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('durable evidence ingestion key changes when source content changes', () => {
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, contentSha256: 'b'.repeat(64) }),
  );
});

test('durable evidence ingestion key is scoped to the resolved member and bill', () => {
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, membershipId: '33333333-3333-3333-3333-333333333333' }),
  );
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, billId: '44444444-4444-4444-4444-444444444444' }),
  );
});

test('durable evidence ingestion key changes for a materially different claim', () => {
  assert.notEqual(
    evidenceIngestionKey(base),
    evidenceIngestionKey({ ...base, draft: { ...draft, claim: 'A different sourced claim.' } }),
  );
});

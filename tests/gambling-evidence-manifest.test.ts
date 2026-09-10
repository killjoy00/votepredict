import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync('data/evidence/gambling-curated-v1.json', 'utf8')) as {
  sourceSystem: string;
  version: string;
  jurisdictionSlug: string;
  records: Array<{
    source: { sourceKind: string; sourceUrl: string; publisher?: string };
    target?: { memberName?: string; memberNames?: string[]; billIdentifier?: string; sessionSlug?: string };
    kind: string;
    claim: string;
    sourceQuality: string;
    relevance: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  }>;
};

test('curated gambling evidence manifest is source-complete and non-mechanical', () => {
  assert.equal(manifest.sourceSystem, 'mn-gambling-curated');
  assert.equal(manifest.version, 'mn-gambling-curated-v1');
  assert.equal(manifest.jurisdictionSlug, 'us-mn');
  assert.ok(manifest.records.length >= 10);

  for (const record of manifest.records) {
    assert.match(record.source.sourceUrl, /^https:\/\//);
    assert.ok(record.source.sourceKind.length > 0);
    assert.ok(record.claim.length > 20);
    assert.ok(record.sourceQuality.length > 0);
    assert.ok(record.relevance.length > 0);
    assert.equal(record.metadata?.mechanicallyActionable, false);
    if (record.confidence !== undefined) assert.ok(record.confidence >= 0 && record.confidence <= 1);
    const hasTarget = Boolean(record.target?.memberName || record.target?.memberNames?.length || record.target?.billIdentifier);
    assert.equal(hasTarget, true);
  }
});

test('multi-member curated records do not contain duplicate names', () => {
  for (const record of manifest.records) {
    const names = record.target?.memberNames ?? [];
    assert.equal(new Set(names).size, names.length);
  }
});

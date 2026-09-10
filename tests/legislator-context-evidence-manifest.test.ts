import test from 'node:test';
import assert from 'node:assert/strict';
import manifestJson from '../data/evidence/legislator-context-v1.json';

type RecordShape = {
  source: { sourceKind: string; sourceUrl: string; sessionSlug?: string; chamberSlug?: string; publisher?: string };
  target?: { legislatorExternalKey?: string; sessionSlug?: string; chamberSlug?: string };
  kind: string;
  stance?: string;
  sourceQuality: string;
  relevance: string;
  freshness?: string;
  metadata?: Record<string, unknown>;
};

type ManifestShape = {
  sourceSystem: string;
  version: string;
  jurisdictionSlug?: string;
  records: RecordShape[];
};

const manifest = manifestJson as ManifestShape;

const expectedLrlKeys = new Set([
  'lrl:15544',
  'lrl:15576',
  'lrl:15647',
  'lrl:15603',
  'lrl:15525',
  'lrl:15473',
  'lrl:15245',
  'lrl:15653',
  'lrl:15286',
]);

test('legislator context manifest is official, stable-targeted, and non-mechanical', () => {
  assert.equal(manifest.sourceSystem, 'mn-legislator-context');
  assert.equal(manifest.version, 'mn-legislator-context-v1');
  assert.equal(manifest.jurisdictionSlug, 'us-mn');
  assert.ok(manifest.records.length >= expectedLrlKeys.size);

  const seen = new Set<string>();
  for (const record of manifest.records) {
    assert.match(record.source.sourceUrl, /^https:\/\//);
    assert.ok(['official_member_profile', 'official_committee_roster'].includes(record.source.sourceKind));
    assert.equal(record.source.sessionSlug, '2025-2026');
    assert.ok(record.source.chamberSlug === 'house' || record.source.chamberSlug === 'senate');
    assert.equal(record.kind, 'context');
    assert.equal(record.stance, 'neutral');
    assert.equal(record.sourceQuality, 'official');
    assert.equal(record.freshness, 'current');
    assert.equal(record.metadata?.contextOnly, true);
    assert.equal(record.metadata?.mechanicallyActionable, false);
    assert.match(record.target?.legislatorExternalKey ?? '', /^lrl:\d+$/);
    seen.add(record.target!.legislatorExternalKey!);
  }

  assert.deepEqual([...expectedLrlKeys].filter((key) => !seen.has(key)), []);
});

test('gambling-process committee context is tagged without asserting a vote stance', () => {
  const tagged = manifest.records.filter((record) => record.metadata?.gamblingProcessRelevance);
  assert.ok(tagged.length >= 3);
  for (const record of tagged) {
    assert.equal(record.kind, 'context');
    assert.equal(record.stance, 'neutral');
    assert.equal(record.metadata?.mechanicallyActionable, false);
  }
});

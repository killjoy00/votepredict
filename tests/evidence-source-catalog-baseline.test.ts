import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LOCAL_TRADE_NEWS_SEEDS, selectLocalTradeNewsBatch } from '../src/evidence/local-trade-news-history';
import { ORGANIZATION_PUBLICATION_SEEDS, selectOrganizationPublicationBatch } from '../src/evidence/organization-publication-history';

interface SeedFingerprint {
  count: number;
  sha256: string;
  firstId: string;
  lastId: string;
}
const baseline = JSON.parse(readFileSync('tests/fixtures/evidence-source-catalog-baseline-v1.json', 'utf8')) as {
  schemaVersion: string;
  catalogs: { local_trade_news: SeedFingerprint; organization_publication: SeedFingerprint };
};

test('the 2026 evidence source catalogs retain their complete original ordered record bytes', () => {
  assert.equal(baseline.schemaVersion, 'evidence-source-catalog-baseline-v1');
  for (const [name, seeds] of [
    ['local_trade_news', LOCAL_TRADE_NEWS_SEEDS],
    ['organization_publication', ORGANIZATION_PUBLICATION_SEEDS],
  ] as const) {
    const pinned = baseline.catalogs[name];
    assert.equal(seeds.length, pinned.count, name);
    assert.equal(createHash('sha256').update(JSON.stringify(seeds)).digest('hex'), pinned.sha256, name);
    assert.equal(seeds[0]?.id, pinned.firstId, name);
    assert.equal(seeds.at(-1)?.id, pinned.lastId, name);
  }
});
test('research source rotation and targeted retry preserve source identity and ordering', () => {
  const local = selectLocalTradeNewsBatch({ priorNextOffset: 43, batchSize: 2 });
  assert.deepEqual(local.batch.map(x => x.id), [
    LOCAL_TRADE_NEWS_SEEDS[43].id, LOCAL_TRADE_NEWS_SEEDS[0].id,
  ]);
  const publication = selectOrganizationPublicationBatch({ priorNextOffset: 23, batchSize: 3 });
  assert.deepEqual(publication.batch.map(x => x.id), [
    ORGANIZATION_PUBLICATION_SEEDS[23].id, ORGANIZATION_PUBLICATION_SEEDS[0].id, ORGANIZATION_PUBLICATION_SEEDS[1].id,
  ]);
});

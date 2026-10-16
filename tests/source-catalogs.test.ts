import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { loadPublicSourceCatalog, type PublicSourceCatalogKind } from '../src/evidence/source-catalog';
import { LOCAL_TRADE_NEWS_SEEDS } from '../src/evidence/local-trade-news-history';
import { ORGANIZATION_PUBLICATION_SEEDS } from '../src/evidence/organization-publication-history';
import schema from '../data/sources/source-catalog.schema.json';

type JsonSeed = { id: string; url: string; [field: string]: unknown };
type JsonCatalog = { schemaVersion: string; kind: PublicSourceCatalogKind; sources: JsonSeed[] };
const sourceRoot = resolve('data/sources');
const catalogFilenames = readdirSync(sourceRoot)
  .filter(name => name.endsWith('.json') && !name.endsWith('.schema.json'))
  .sort();
const readCatalog = (file: string): JsonCatalog =>
  JSON.parse(readFileSync(join(sourceRoot, file), 'utf8')) as JsonCatalog;
const clone = (data: JsonCatalog): JsonCatalog => JSON.parse(JSON.stringify(data)) as JsonCatalog;

test('every versioned source JSON is checked against its runtime JSON schema', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(catalogFilenames, ['local-trade-news-v1.json', 'organization-publication-v1.json']);
  assert.equal(schema.oneOf.length, 2);
  const kinds = new Set<string>();
  const allUrls = new Set<string>();
  for (const filename of catalogFilenames) {
    const catalog = readCatalog(filename);
    assert.equal(catalog.schemaVersion, 'source-catalog-v1');
    assert.ok(!kinds.has(catalog.kind), 'duplicate source catalog kind');
    kinds.add(catalog.kind);
    const validated = loadPublicSourceCatalog<JsonSeed>(catalog, catalog.kind);
    assert.deepEqual(validated, catalog.sources);
    assert.ok(validated.length > 0);
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    for (const seed of validated) {
      const url = new URL(seed.url).href;
      assert.ok(!seenIds.has(seed.id), 'duplicate id in ' + filename);
      assert.ok(!seenUrls.has(url), 'duplicate URL in ' + filename);
      assert.ok(!allUrls.has(url), 'duplicate URL across all catalog files: ' + url);
      seenIds.add(seed.id);
      seenUrls.add(url);
      allUrls.add(url);
    }
  }
  assert.deepEqual([...kinds].sort(), ['local_trade_news', 'organization_publication']);
  assert.equal(allUrls.size, 68);
});

test('imported live source exports match the validated records and retain original order', () => {
  assert.deepEqual(LOCAL_TRADE_NEWS_SEEDS, readCatalog('local-trade-news-v1.json').sources);
  assert.deepEqual(ORGANIZATION_PUBLICATION_SEEDS, readCatalog('organization-publication-v1.json').sources);
});

test('catalog validation rejects malformed or duplicated URLs, unknown fields and bad windows', () => {
  const input = readCatalog('local-trade-news-v1.json');
  const invalids: Array<[string, (value: JsonCatalog) => void]> = [
    ['duplicate-id', x => { x.sources[1].id = x.sources[0].id; }],
    ['duplicate-url', x => { x.sources[1].url = x.sources[0].url; }],
    ['normalized-duplicate-url', x => { x.sources[1].url = x.sources[0].url.replace('startribune.com', 'STARTRIBUNE.COM'); }],
    ['non-https', x => { x.sources[0].url = 'http://example.com'; }],
    ['missing-source-field', x => { delete x.sources[0].publisher; }],
    ['unknown-field', x => { x.sources[0].newUnapprovedField = 'metadata'; }],
    ['unknown-kind', x => { x.kind = 'unknown-kind' as PublicSourceCatalogKind; }],
    ['wrong-version', x => { x.schemaVersion = 'source-catalog-v2'; }],
    ['reversed-window', x => { x.sources[0].from = '20270101'; }],
    ['invalid-calendar-day', x => { x.sources[0].from = '20210230'; }],
    ['invalid-publisher-kind', x => { x.sources[0].publisherKind = 'not_a_valid_kind'; }],
    ['non-prefix', x => { x.sources[0].prefix = false; }],
    ['repeated-path-hint', x => { x.sources[0].pathHints = ['a', 'a']; }],
    ['empty-seeds', x => { x.sources = []; }],
  ];
  for (const [label, mutate] of invalids) {
    const invalid = clone(input);
    mutate(invalid);
    assert.throws(() => loadPublicSourceCatalog(invalid, 'local_trade_news'), /Invalid public source catalog/, label);
  }
});

test('organization catalog uses its own strict publication-kind and sector schema', () => {
  const input = readCatalog('organization-publication-v1.json');
  const wrongPublication = clone(input);
  wrongPublication.sources[0].publicationKind = 'unapproved';
  assert.throws(() => loadPublicSourceCatalog(wrongPublication, 'organization_publication'), /Invalid public source catalog/);
  const wrongSector = clone(input);
  wrongSector.sources[0].sector = 'other';
  assert.throws(() => loadPublicSourceCatalog(wrongSector, 'organization_publication'), /Invalid public source catalog/);
  const injectedLocalField = clone(input);
  injectedLocalField.sources[0].prefix = true;
  assert.throws(() => loadPublicSourceCatalog(injectedLocalField, 'organization_publication'), /Invalid public source catalog/);
  assert.throws(() => loadPublicSourceCatalog(input, 'local_trade_news'), /Invalid public source catalog/);
});

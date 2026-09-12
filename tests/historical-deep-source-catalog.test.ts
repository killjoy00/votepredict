import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
  buildHistoricalDeepSourceBundle,
  collectedHistoricalDeepSource,
  historicalDeepSourceCatalogErrors,
  type HistoricalDeepSourceCatalog,
  type HistoricalDeepSourceCatalogEntry,
} from '../src/evaluation/historical-deep-source-catalog.js';

const catalog = JSON.parse(
  readFileSync('data/evaluation/historical-deep-pilot-sources-v1.json', 'utf8'),
) as HistoricalDeepSourceCatalog;

function cloneCatalog(): HistoricalDeepSourceCatalog {
  return JSON.parse(JSON.stringify(catalog)) as HistoricalDeepSourceCatalog;
}

function entry(overrides: Partial<HistoricalDeepSourceCatalogEntry> = {}): HistoricalDeepSourceCatalogEntry {
  return {
    case: { session: '2023-2024', chamber: 'house', identifier: 'HF1', occurredOn: '2023-01-19' },
    id: 'test-source',
    sourceClass: 'house_committee_record',
    url: 'https://www.house.mn.gov/committees/minutes/93010/89889',
    title: 'Test historical source',
    publishedAt: '2023-01-05T00:00:00.000Z',
    expectedMarkers: ['HF1', 'Kotyza-Witthuhn'],
    ...overrides,
  };
}

test('checked-in historical source catalog is valid and covers every pilot case', () => {
  assert.equal(catalog.schemaVersion, HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA);
  assert.deepEqual(historicalDeepSourceCatalogErrors(catalog), []);
  const caseKeys = new Set(catalog.sources.map((source) => [
    source.case.session,
    source.case.chamber,
    source.case.identifier,
    source.case.occurredOn,
  ].join('|')));
  assert.equal(caseKeys.size, 6);
  for (const key of caseKeys) {
    assert.ok(catalog.sources.filter((source) => [
      source.case.session,
      source.case.chamber,
      source.case.identifier,
      source.case.occurredOn,
    ].join('|') === key).length >= 2);
  }
});

test('catalog rejects mutable or generic historical source URLs', () => {
  const mutableRevisor = cloneCatalog();
  mutableRevisor.sources[0].url = 'https://www.revisor.mn.gov/bills/93/2023/0/HF/1/';
  assert.match(historicalDeepSourceCatalogErrors(mutableRevisor).join('\n'), /exact Revisor bill-version URL/);

  const genericHouseArchive = cloneCatalog();
  const committee = genericHouseArchive.sources.find((source) => source.sourceClass === 'house_committee_record');
  assert.ok(committee);
  committee.url = 'https://www.house.mn.gov/Committees/archives/93010';
  assert.match(historicalDeepSourceCatalogErrors(genericHouseArchive).join('\n'), /exact House committee-minutes URL/);
});

test('catalog rejects same-day, unknown-host, duplicate, and unknown-case sources', () => {
  const sameDay = cloneCatalog();
  sameDay.sources[0].publishedAt = '2023-01-19T00:00:00.000Z';
  assert.match(historicalDeepSourceCatalogErrors(sameDay).join('\n'), /strictly before the vote date/);

  const unknownHost = cloneCatalog();
  unknownHost.sources[0].url = 'https://example.com/bills/93/2023/0/HF/1/versions/0/';
  assert.match(historicalDeepSourceCatalogErrors(unknownHost).join('\n'), /unapproved host/);

  const duplicate = cloneCatalog();
  duplicate.sources.push({ ...duplicate.sources[0] });
  assert.match(historicalDeepSourceCatalogErrors(duplicate).join('\n'), /duplicate source id/);

  const unknownCase = cloneCatalog();
  unknownCase.sources[0].case.identifier = 'HF9999';
  assert.match(historicalDeepSourceCatalogErrors(unknownCase).join('\n'), /unknown pilot case/);
});

test('collected source validation requires expected page identity markers', () => {
  const valid = entry();
  const source = collectedHistoricalDeepSource(valid, {
    fetchedAt: '2026-09-12T00:00:00.000Z',
    status: 200,
    finalUrl: valid.url,
    contentType: 'text/html; charset=utf-8',
    bytes: Buffer.from('<html><body><h1>HF1</h1><p>Kotyza-Witthuhn</p></body></html>'),
  });
  assert.match(source.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(source.httpStatus, 200);
  assert.equal(source.bytes > 0, true);

  assert.throws(() => collectedHistoricalDeepSource(valid, {
    fetchedAt: '2026-09-12T00:00:00.000Z',
    status: 200,
    finalUrl: valid.url,
    contentType: 'text/html',
    bytes: Buffer.from('<html><body>wrong page</body></html>'),
  }), /missing expected marker/i);
});

test('source bundle requires exact catalog source coverage', () => {
  const minimalCatalog: HistoricalDeepSourceCatalog = {
    schemaVersion: HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA,
    jurisdictionSlug: 'us-mn',
    sources: [],
  };
  assert.throws(() => buildHistoricalDeepSourceBundle(minimalCatalog, []), /source catalog is empty/);
});

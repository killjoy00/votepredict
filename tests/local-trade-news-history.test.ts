import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOCAL_TRADE_NEWS_SEEDS,
  archiveSessionSlug,
  extractLocalTradeNewsBillIdentifiers,
  localTradeNewsTextIsTargeted,
  selectLocalTradeNewsBatch,
  selectLocalTradeNewsCaptures,
  validateLocalTradeNewsSeeds,
} from '../src/evidence/local-trade-news-history.js';
import type { WaybackCapture } from '../src/evidence/wayback.js';

function capture(original: string, timestamp: string): WaybackCapture {
  const capturedAt = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}.000Z`;
  return {
    timestamp,
    original,
    mimetype: 'text/html',
    statuscode: '200',
    digest: `digest-${timestamp}`,
    length: 1000,
    capturedAt,
    archiveUrl: `https://web.archive.org/web/${timestamp}id_/${original}`,
  };
}

test('local/trade news seeds are unique HTTPS prefixes bounded to the research window', () => {
  validateLocalTradeNewsSeeds();
  assert.equal(LOCAL_TRADE_NEWS_SEEDS.length, 14);
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.every(seed => seed.url.startsWith('https://')));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.every(seed => seed.prefix));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.every(seed => seed.from === '20210101' && seed.to === '20261231'));
  assert.deepEqual(
    LOCAL_TRADE_NEWS_SEEDS.slice(0, 2).map(seed => [seed.id, seed.publisherKind]),
    [
      ['star-tribune-minnesota-politics-archive', 'local_news'],
      ['axios-twin-cities-archive', 'local_news'],
    ],
  );
  assert.deepEqual(
    LOCAL_TRADE_NEWS_SEEDS.slice(-3).map(seed => [seed.id, seed.publisherKind]),
    [
      ['mankato-free-press-local-news-archive', 'local_news'],
      ['post-bulletin-local-news-archive', 'local_news'],
      ['agweek-policy-archive', 'trade_news'],
    ],
  );
});

test('targeted local/trade runs preserve the durable rotation cursor', () => {
  const rotation = selectLocalTradeNewsBatch({
    priorNextOffset: 9,
    batchSize: 1,
  });
  assert.equal(rotation.targeted, false);
  assert.equal(rotation.offset, 9);
  assert.equal(rotation.nextOffset, 10);
  assert.deepEqual(rotation.batch.map(seed => seed.id), ['minnpost-state-government-archive']);

  const targeted = selectLocalTradeNewsBatch({
    priorNextOffset: 9,
    batchSize: 1,
    requestedSeedIds: [
      'mankato-free-press-local-news-archive',
      'agweek-policy-archive',
    ],
  });
  assert.equal(targeted.targeted, true);
  assert.equal(targeted.offset, 9);
  assert.equal(targeted.nextOffset, 9);
  assert.deepEqual(targeted.batch.map(seed => seed.id), [
    'mankato-free-press-local-news-archive',
    'agweek-policy-archive',
  ]);
});

test('targeted local/trade selection fails closed on invalid requests', () => {
  assert.throws(
    () => selectLocalTradeNewsBatch({
      priorNextOffset: 9,
      batchSize: 1,
      requestedSeedIds: ['not-registered'],
    }),
    /Unknown local\/trade news seed id/,
  );
  assert.throws(
    () => selectLocalTradeNewsBatch({
      priorNextOffset: 9,
      batchSize: 1,
      requestedSeedIds: [
        'mankato-free-press-local-news-archive',
        'mankato-free-press-local-news-archive',
      ],
    }),
    /must be unique/,
  );
  assert.throws(
    () => selectLocalTradeNewsBatch({
      priorNextOffset: 9,
      batchSize: 1,
      requestedSeedIds: [
        'mankato-free-press-local-news-archive',
        'post-bulletin-local-news-archive',
        'agweek-policy-archive',
      ],
    }),
    /at most 2/,
  );
});

test('capture selection is deterministic, topical, and keeps only the latest capture per URL/year', () => {
  const topicalOld = capture('https://example.com/2024/minnesota-legislature-budget-bill', '20240301120000');
  const topicalNew = capture('https://example.com/2024/minnesota-legislature-budget-bill', '20240401120000');
  const irrelevant = capture('https://example.com/2024/sports-championship', '20240501120000');
  const selected = selectLocalTradeNewsCaptures([irrelevant, topicalOld, topicalNew]);
  assert.deepEqual(selected.map(row => row.timestamp), ['20240401120000']);
});

test('targeting requires legislative text or an explicit Minnesota bill identifier', () => {
  assert.equal(localTradeNewsTextIsTargeted('The Minnesota Legislature returned to the State Capitol.'), true);
  assert.equal(localTradeNewsTextIsTargeted('Lawmakers debated HF 1234 before adjournment.'), true);
  assert.equal(localTradeNewsTextIsTargeted('A local sports team won its game.'), false);
});

test('bill identifiers are normalized without inventing labels', () => {
  assert.deepEqual(
    extractLocalTradeNewsBillIdentifiers('HF 12, sf-0042, and HF#12 were discussed. No vote label is implied.'),
    ['HF 12', 'SF 42'],
  );
});

test('archive session mapping is bounded to the documented 2021-26 research window', () => {
  assert.equal(archiveSessionSlug('2022-05-01T12:00:00.000Z'), '2021-2022');
  assert.equal(archiveSessionSlug('2024-05-01T12:00:00.000Z'), '2023-2024');
  assert.equal(archiveSessionSlug('2026-05-01T12:00:00.000Z'), '2025-2026');
  assert.equal(archiveSessionSlug('2020-05-01T12:00:00.000Z'), undefined);
});

test('seed validation fails closed on duplicates, insecure URLs, and invalid windows', () => {
  const first = LOCAL_TRADE_NEWS_SEEDS[0];
  assert.throws(
    () => validateLocalTradeNewsSeeds([first, { ...first, url: 'https://example.com/other' }]),
    /Duplicate or empty/,
  );
  assert.throws(
    () => validateLocalTradeNewsSeeds([{ ...first, id: 'bad-http', url: 'http://example.com/202' }]),
    /must use HTTPS/,
  );
  assert.throws(
    () => validateLocalTradeNewsSeeds([{ ...first, id: 'bad-window', from: '20270101', to: '20261231' }]),
    /Invalid archive window/,
  );
});

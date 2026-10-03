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
  assert.equal(LOCAL_TRADE_NEWS_SEEDS.length, 44);
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
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'pioneer-press-dated-archive' && seed.publisherKind === 'local_news'));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'sahan-journal-democracy-politics-archive' && seed.publisherKind === 'local_news'));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'msp-business-journal-government-archive' && seed.publisherKind === 'trade_news'));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'mn-spokesman-recorder-dated-archive' && seed.publisherKind === 'local_news'));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'tpt-almanac-capitol-archive' && seed.pathHints?.includes('/almanac-at-the-capitol/video/')));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'mshale-politics-archive' && seed.publisherKind === 'local_news'));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'north-news-stories-archive' && seed.pathHints?.includes('/stories/')));
  assert.ok(LOCAL_TRADE_NEWS_SEEDS.some(seed =>
    seed.id === 'roseau-times-region-story-archive' && seed.publisherKind === 'local_news'));
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
      "star-tribune-minnesota-politics-archive",
      "axios-twin-cities-archive",
      "cbs-minnesota-news-archive",
      "kstp-news-archive",
      "fox9-minnesota-news-archive",
      "duluth-news-tribune-minnesota-archive",
      "minnesota-lawyer-article-archive",
      "mpr-news-story-archive",
      "minnesota-reformer-article-archive",
      "minnpost-state-government-archive",
      "finance-commerce-article-archive",
      "mankato-free-press-local-news-archive",
      "post-bulletin-local-news-archive"
],
    }),
    /at most 12/,
  );
});

test('capture selection is deterministic, topical, and keeps only the latest capture per URL/year', () => {
  const topicalOld = capture('https://example.com/2024/minnesota-legislature-budget-bill', '20240301120000');
  const topicalNew = capture('https://example.com/2024/minnesota-legislature-budget-bill', '20240401120000');
  const irrelevant = capture('https://example.com/2024/sports-championship', '20240501120000');
  const selected = selectLocalTradeNewsCaptures([irrelevant, topicalOld, topicalNew]);
  assert.deepEqual(selected.map(row => row.timestamp), ['20240401120000']);
});

test('capture selection can use a narrow source-specific path hint without weakening text verification', () => {
  const hinted = capture('https://example.com/almanac-at-the-capitol/video/week-4', '20240401120000');
  const unrelated = capture('https://example.com/sports/championship', '20240501120000');
  const selected = selectLocalTradeNewsCaptures([unrelated, hinted], {
    pathHints: ['/almanac-at-the-capitol/video/'],
  });
  assert.deepEqual(selected.map(row => row.original), [hinted.original]);
});

test('deep archive review honors the hard 40-capture ceiling', () => {
  const rows = Array.from({ length: 55 }, (_, index) =>
    capture(
      `https://example.com/2024/minnesota-legislature-budget-${index}`,
      `2024${String((index % 12) + 1).padStart(2, '0')}15${String(index % 24).padStart(2, '0')}0000`,
    ));
  assert.equal(selectLocalTradeNewsCaptures(rows, { maxCaptures: 40 }).length, 40);
  assert.equal(selectLocalTradeNewsCaptures(rows, { maxCaptures: 999 }).length, 40);
});

test('targeting recognizes broader statehouse language while rejecting unrelated local coverage', () => {
  assert.equal(localTradeNewsTextIsTargeted('The Minnesota Legislature returned to the State Capitol.'), true);
  assert.equal(localTradeNewsTextIsTargeted('Minnesota lawmakers negotiated through the night.'), true);
  assert.equal(localTradeNewsTextIsTargeted('The state senate opened its legislative session Tuesday.'), true);
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

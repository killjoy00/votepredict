import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverCompleteWaybackPdfPrefix,
  houseAttachmentWaybackMatchKey,
  parseWaybackPdfPrefixPage,
  planHouseAttachmentPrefixShards,
} from '../src/evidence/house-committee-attachment-wayback-bulk.js';

test('normalizes scheme for House attachment matching while preserving official host and path', () => {
  assert.equal(
    houseAttachmentWaybackMatchKey('http://www.house.mn.gov/comm/docs/HF0400_Summary.pdf'),
    'https://www.house.mn.gov/comm/docs/HF0400_Summary.pdf',
  );
  assert.equal(
    houseAttachmentWaybackMatchKey('https://www.house.mn.gov/comm/docs/HF0400_Summary.pdf#page=2'),
    'https://www.house.mn.gov/comm/docs/HF0400_Summary.pdf',
  );
  assert.throws(
    () => houseAttachmentWaybackMatchKey('https://example.com/HF0400.pdf'),
    /official Minnesota House host/,
  );
});

test('plans bounded prefix shards from unique attachment URLs', () => {
  const shards = planHouseAttachmentPrefixShards([
    { sessionSlug: '2023-2024', originalUrl: 'https://www.house.mn.gov/comm/docs/HF0100_alpha.pdf' },
    { sessionSlug: '2023-2024', originalUrl: 'https://www.house.mn.gov/comm/docs/HF0101_beta.pdf' },
    { sessionSlug: '2023-2024', originalUrl: 'https://www.house.mn.gov/comm/docs/HF0200_gamma.pdf' },
    { sessionSlug: '2023-2024', originalUrl: 'https://www.house.mn.gov/comm/docs/HF0100_alpha.pdf' },
  ], {
    maxCandidatesPerShard: 1,
    minBasenameChars: 4,
  });

  assert.equal(shards.reduce((sum, shard) => sum + shard.candidateKeys.length, 0), 3);
  assert.ok(shards.every(shard => shard.candidateKeys.length === 1));
  assert.ok(shards.every(shard => shard.prefix.startsWith('https://www.house.mn.gov/comm/docs/')));
});

test('parses Wayback JSON resumption keys without treating them as captures', () => {
  const page = parseWaybackPdfPrefixPage([
    ['timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
    ['20240315010101', 'http://www.house.mn.gov/comm/docs/HF0400.pdf', 'application/pdf', '200', 'ABC', '1234'],
    [],
    ['resume-key-1'],
  ]);

  assert.equal(page.captures.length, 1);
  assert.equal(page.captures[0]?.capturedAt, '2024-03-15T01:01:01.000Z');
  assert.equal(page.resumeKey, 'resume-key-1');
});

test('walks Wayback resume keys until a complete prefix result is proven', async () => {
  const seen: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    seen.push(url.searchParams.get('resumeKey') ?? '');
    if (!url.searchParams.get('resumeKey')) {
      return new Response(JSON.stringify([
        ['timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
        ['20240315010101', 'http://www.house.mn.gov/comm/docs/HF0400.pdf', 'application/pdf', '200', 'ABC', '1234'],
        [],
        ['resume-key-1'],
      ]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify([
      ['timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
      ['20240316010101', 'http://www.house.mn.gov/comm/docs/HF0401.pdf', 'application/pdf', '200', 'DEF', '2345'],
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await discoverCompleteWaybackPdfPrefix({
    prefix: 'https://www.house.mn.gov/comm/docs/HF04',
    from: '20230101',
    to: '20241231',
    pageLimit: 1,
    fetchImpl,
  });

  assert.deepEqual(seen, ['', 'resume-key-1']);
  assert.equal(result.pages, 2);
  assert.equal(result.captures.length, 2);
});

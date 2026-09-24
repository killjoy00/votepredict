import test from 'node:test';
import assert from 'node:assert/strict';
import { dateExclusiveAvailable,historicalAvailabilityErrors,isHistoricallyAvailableBefore } from '../src/evidence/historical-public-availability.js';
import { capturesStrictlyBefore,parseWaybackCdxJson,waybackSnapshotUrl } from '../src/evidence/wayback.js';

const base={
  proof:'independent_archive_capture' as const,
  availableAt:'2024-02-03T04:05:06.000Z',
  canonicalUrl:'https://example.org/issues',
  archiveUrl:'https://web.archive.org/web/20240203040506id_/https://example.org/issues',
  capturedAt:'2024-02-03T04:05:06.000Z',
  contentSha256:'a'.repeat(64),
};

const regulatoryBase={
  proof:'regulatory_filing_or_disclosure_timestamp' as const,
  availableAt:'2024-07-23T00:00:00.000Z',
  canonicalUrl:'https://register.cfb.mn.gov/reports/example',
  filingAt:'2024-07-22T00:00:00.000Z',
  contentSha256:'b'.repeat(64),
};

const officialPublicationBase={
  proof:'official_publication_timestamp' as const,
  availableAt:'2024-03-15T15:30:00.000Z',
  canonicalUrl:'https://www.house.mn.gov/committees/example',
  publishedAt:'2024-03-15T15:30:00.000Z',
  contentSha256:'c'.repeat(64),
};

const publisherMetadataBase={
  proof:'publisher_page_metadata' as const,
  availableAt:'2024-04-10T13:00:00.000Z',
  canonicalUrl:'https://example.org/news/article',
  publishedAt:'2024-04-10T12:00:00.000Z',
  contentSha256:'d'.repeat(64),
};

test('archive availability is capture time and must be strictly before cutoff',()=>{
  assert.deepEqual(historicalAvailabilityErrors(base),[]);
  assert.equal(isHistoricallyAvailableBefore(base,'2024-02-03T04:05:07Z'),true);
  assert.equal(isHistoricallyAvailableBefore(base,'2024-02-03T04:05:06Z'),false);
  assert.equal(dateExclusiveAvailable(base,'2024-02-04'),true);
  assert.equal(dateExclusiveAvailable(base,'2024-02-03'),false);
});

test('archive availability fails closed when capture and availableAt differ',()=>{
  assert.match(historicalAvailabilityErrors({...base,availableAt:'2024-02-02T00:00:00Z'}).join(' '),/must equal capturedAt/);
});

test('regulatory availability accepts disclosure at or after the proven filing time',()=>{
  assert.deepEqual(historicalAvailabilityErrors(regulatoryBase),[]);
});

test('regulatory availability rejects an event date before the proven filing time',()=>{
  const row={...regulatoryBase,availableAt:'2024-07-20T00:00:00.000Z'};
  assert.match(historicalAvailabilityErrors(row).join(' '),/cannot precede filingAt/);
  assert.equal(isHistoricallyAvailableBefore(row,'2024-07-21T00:00:00.000Z'),false);
});

test('regulatory availability rejects malformed filing timestamps',()=>{
  assert.match(historicalAvailabilityErrors({...regulatoryBase,filingAt:'not-a-date'}).join(' '),/filingAt must be a valid timestamp/);
});

test('official publication availability accepts the proven publication time',()=>{
  assert.deepEqual(historicalAvailabilityErrors(officialPublicationBase),[]);
});

test('official publication availability cannot predate the proven publication time',()=>{
  const row={...officialPublicationBase,availableAt:'2024-03-15T15:29:59.000Z'};
  assert.match(historicalAvailabilityErrors(row).join(' '),/official publication availableAt cannot precede publishedAt/);
  assert.equal(isHistoricallyAvailableBefore(row,'2024-03-15T15:30:00.000Z'),false);
});

test('publisher metadata availability cannot predate the proven publication time',()=>{
  const row={...publisherMetadataBase,availableAt:'2024-04-10T11:59:59.000Z'};
  assert.match(historicalAvailabilityErrors(row).join(' '),/publisher metadata availableAt cannot precede publishedAt/);
});

test('publication availability rejects malformed publication timestamps',()=>{
  assert.match(historicalAvailabilityErrors({...officialPublicationBase,publishedAt:'not-a-date'}).join(' '),/publishedAt must be a valid timestamp/);
  assert.match(historicalAvailabilityErrors({...publisherMetadataBase,publishedAt:'not-a-date'}).join(' '),/publishedAt must be a valid timestamp/);
});

test('Wayback CDX parser retains only successful text captures',()=>{
  const rows=parseWaybackCdxJson([
    ['timestamp','original','mimetype','statuscode','digest','length'],
    ['20240102030405','https://example.org/a','text/html','200','ABC','1234'],
    ['20240103030405','https://example.org/a','image/png','200','DEF','100'],
    ['20240104030405','https://example.org/a','text/html','404','GHI','100'],
  ]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].capturedAt,'2024-01-02T03:04:05.000Z');
  assert.equal(rows[0].archiveUrl,waybackSnapshotUrl(rows[0].timestamp,rows[0].original));
  assert.equal(capturesStrictlyBefore(rows,'2024-01-03T00:00:00Z').length,1);
});

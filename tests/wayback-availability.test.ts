import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWaybackAvailabilityCapture,
} from '../src/evidence/wayback-availability.js';

test('parses a Wayback availability capture for the exact frozen resource', () => {
  const capture = parseWaybackAvailabilityCapture({
    archived_snapshots: {
      closest: {
        available: true,
        status: '200',
        timestamp: '20230325102301',
        url: 'http://web.archive.org/web/20230325102301/https://www.house.mn.gov/SessionDaily/Story/17757',
      },
    },
  }, 'https://www.house.mn.gov/SessionDaily/Story/17757');

  assert.ok(capture);
  assert.equal(capture.timestamp, '20230325102301');
  assert.equal(capture.capturedAt, '2023-03-25T10:23:01.000Z');
  assert.equal(
    capture.archiveUrl,
    'https://web.archive.org/web/20230325102301id_/https://www.house.mn.gov/SessionDaily/Story/17757',
  );
});

test('availability proof may differ only by source scheme, not host or path', () => {
  const capture = parseWaybackAvailabilityCapture({
    archived_snapshots: {
      closest: {
        available: true,
        status: '200',
        timestamp: '20230325102301',
        url: 'https://web.archive.org/web/20230325102301/http://www.house.mn.gov/SessionDaily/Story/17757',
      },
    },
  }, 'https://www.house.mn.gov/SessionDaily/Story/17757');
  assert.ok(capture);

  assert.throws(() => parseWaybackAvailabilityCapture({
    archived_snapshots: {
      closest: {
        available: true,
        status: '200',
        timestamp: '20230325102301',
        url: 'https://web.archive.org/web/20230325102301/https://house.mn.gov/SessionDaily/Story/17757',
      },
    },
  }, 'https://www.house.mn.gov/SessionDaily/Story/17757'), /does not match/);
});

test('returns null when no successful closest snapshot exists', () => {
  assert.equal(parseWaybackAvailabilityCapture({ archived_snapshots: {} }, 'https://www.house.mn.gov/SessionDaily/Story/17757'), null);
  assert.equal(parseWaybackAvailabilityCapture({
    archived_snapshots: {
      closest: {
        available: false,
        status: '404',
      },
    },
  }, 'https://www.house.mn.gov/SessionDaily/Story/17757'), null);
});

test('rejects replay URLs outside web.archive.org', () => {
  assert.throws(() => parseWaybackAvailabilityCapture({
    archived_snapshots: {
      closest: {
        available: true,
        status: '200',
        timestamp: '20230325102301',
        url: 'https://example.com/web/20230325102301/https://www.house.mn.gov/SessionDaily/Story/17757',
      },
    },
  }, 'https://www.house.mn.gov/SessionDaily/Story/17757'), /unexpected replay host/);
});

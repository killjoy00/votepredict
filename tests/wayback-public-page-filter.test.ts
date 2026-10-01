import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWaybackCdxJson } from '../src/evidence/wayback.js';

test('Wayback public-page discovery excludes archived CSS and XML assets', () => {
  const payload = [
    ['timestamp','original','mimetype','statuscode','digest','length'],
    ['20240101010101','https://example.com/issues','text/html','200','HTML1','1200'],
    ['20240101010202','https://example.com/styles.css','text/css','200','CSS1','500'],
    ['20240101010303','https://example.com/sitemap.xml','text/xml','200','XML1','700'],
    ['20240101010404','https://example.com/platform.txt','text/plain','200','TXT1','900'],
    ['20240101010505','https://example.com/about','application/xhtml+xml','200','XHTML1','1100'],
  ];

  const captures = parseWaybackCdxJson(payload);
  assert.deepEqual(captures.map((row) => row.original), [
    'https://example.com/issues',
    'https://example.com/platform.txt',
    'https://example.com/about',
  ]);
});

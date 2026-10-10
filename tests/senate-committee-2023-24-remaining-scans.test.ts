import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SENATE_2023_24_CATCHUP_ORIGINALS as sources,
  SENATE_2023_24_CATCHUP_ORIGINAL_TOTAL,
  SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES,
  SENATE_2023_24_CATCHUP_ORIGINAL_MAX_PAGES,
  SENATE_2023_24_CATCHUP_SOURCE_RUN,
  SENATE_2023_24_CATCHUP_SOURCE_ARTIFACT_IDS,
  SENATE_2023_24_CATCHUP_YEAR_COUNTS,
  verifySenate2023_24CatchupOriginals,
} from '../src/evidence/senate-committee-2023-24-scanned-catchup.js';
import { SENATE_SIX_SCANNED_ORIGINALS } from
  '../src/evidence/senate-committee-scanned-ocr-pilot.js';

const earlier24 = JSON.parse(readFileSync(new URL(
  '../docs/evaluation/source-proof/senate-committee-24-scanned-originals-source-manifest.json',
  import.meta.url,
), 'utf8')) as { originals: Array<{ url: string; year: number }> };

test('all 25 remaining 2023 and 2024 original scanned Senate URLs are fixed and source bounded', () => {
  assert.equal(verifySenate2023_24CatchupOriginals(), true);
  assert.equal(SENATE_2023_24_CATCHUP_SOURCE_RUN, 38066441841);
  assert.deepEqual(SENATE_2023_24_CATCHUP_SOURCE_ARTIFACT_IDS,
    { 2023: 11674568363, 2024: 11675315164 });
  assert.deepEqual(SENATE_2023_24_CATCHUP_YEAR_COUNTS, { 2023: 17, 2024: 8 });
  assert.equal(sources.length, SENATE_2023_24_CATCHUP_ORIGINAL_TOTAL);
  assert.deepEqual(sources.map(s => s.year).filter(y => y === 2023).length, 17);
  assert.deepEqual(sources.map(s => s.year).filter(y => y === 2024).length, 8);
  assert.equal(SENATE_2023_24_CATCHUP_ORIGINAL_MAX_BYTES, 8_000_000);
  assert.equal(SENATE_2023_24_CATCHUP_ORIGINAL_MAX_PAGES, 8);
});

test('remaining original URL list is immutable, ordered and excludes all 30 prior scanned-source proofs', () => {
  const joined = sources.map(s => s.url).join('\n');
  assert.equal(createHash('sha256').update(joined).digest('hex'),
    'cd3e4b1a21c18df68b1014c08628a4ca4438d401b00cd9fee42965f292da8108');
  const previous = new Set([
    ...SENATE_SIX_SCANNED_ORIGINALS.map(s => s.url),
    ...earlier24.originals.map(s => s.url),
  ]);
  assert.equal(previous.size, 30);
  assert.equal(sources.filter(s => previous.has(s.url)).length, 0);
  assert.equal(new Set(sources.map(s => s.url)).size, 25);
  assert.ok(sources.every(s => s.committeeName === 'Higher Education'));
  assert.equal(sources[0]?.meetingDate, '2023-01-12');
  assert.equal(sources.at(-1)?.meetingDate, '2024-04-16');
});

test('exact source URL agrees with hearing day and 2023-24 Senate chamber; no extension to print 2021', () => {
  for (const s of sources) {
    const parsed = new URL(s.url);
    const day = s.meetingDate.replaceAll('-', '');
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.hostname, 'www.lrl.mn.gov');
    assert.equal(parsed.search, '');
    assert.equal(parsed.hash, '');
    assert.equal(parsed.pathname,
      '/archive/minutes/senate/' + s.year + '/highered/' + day +
      '/highered_' + day + '_minutes.pdf');
    assert.match(s.meetingDate, /^202[34]-\d{2}-\d{2}$/);
  }
});

test('fills source extraction cohort only, not missing minutes links or complete vote universe', () => {
  const prior2023 = earlier24.originals.filter(s => s.year === 2023).length + 1;
  const prior2024 = earlier24.originals.filter(s => s.year === 2024).length + 1;
  assert.equal(prior2023, 5);
  assert.equal(prior2024, 5);
  assert.equal(prior2023 + SENATE_2023_24_CATCHUP_YEAR_COUNTS[2023], 22);
  assert.equal(prior2024 + SENATE_2023_24_CATCHUP_YEAR_COUNTS[2024], 13);
  assert.deepEqual([...new Set(sources.map(s => s.year))], [2023, 2024]);
});

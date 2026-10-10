import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES,
  SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES,
  SENATE_SIX_SCANNED_ORIGINALS,
  isPinnedScannedSenateOriginalPdfUrl,
} from '../src/evidence/senate-committee-scanned-ocr-pilot.js';

const manifestFile = new URL(
  '../docs/evaluation/source-proof/senate-committee-24-scanned-originals-source-manifest.json',
  import.meta.url,
);
const raw = readFileSync(manifestFile, 'utf8');
const manifest = JSON.parse(raw);

test('24 follow-up originals are exactly scoped to four historic Senate years, from actual source failure artifacts', () => {
  assert.equal(manifest.schemaVersion, 'senate-committee-2022-25-original-scan-24-stratified-v1');
  assert.equal(manifest.issue, 864);
  assert.equal(manifest.independentSourceRunId, 38066441841);
  assert.deepEqual(manifest.years, [2022, 2023, 2024, 2025]);
  assert.deepEqual(manifest.sourceArtifactIds, {
    '2022': 11674729430,
    '2023': 11674568363,
    '2024': 11675315164,
    '2025': 11675014092,
  });
  assert.equal(manifest.originals.length, 24);
  for (const [year, count] of [[2022,8],[2023,4],[2024,4],[2025,8]]) {
    assert.equal(manifest.originals.filter((x:any)=>x.year === year).length, count);
  }
  assert.equal(manifest.noProductionDatabaseAccess, true);
  assert.equal(manifest.notCompleteOfficialSourceUniverse, true);
});

test('second scanned sample pins original official URL exact hearing day and chamber, not a crawl or redirection', () => {
  const seen = new Set<string>();
  for (const row of manifest.originals) {
    assert.equal(typeof row.committeeName, 'string');
    assert.ok(row.committeeName.trim().length > 0);
    const url = new URL(row.url);
    assert.equal(url.hostname, 'www.lrl.mn.gov');
    assert.equal(url.protocol, 'https:');
    assert.equal(url.search, '');
    assert.match(url.pathname, /^\/archive\/minutes\/senate\/202[2-5]\//);
    const match = url.pathname.match(
      /^\/archive\/minutes\/senate\/(202[2-5])\/[^/]+\/(20\d{6})\/[^/]+_minutes\.pdf$/i,
    );
    assert.ok(match);
    assert.equal(Number(match![1]), row.year);
    assert.equal(row.meetingDate,
      match![2].slice(0, 4) + '-' + match![2].slice(4, 6) + '-' + match![2].slice(6, 8));
    assert.equal(seen.has(row.url), false, 'no duplicate original sample URLs');
    assert.equal(isPinnedScannedSenateOriginalPdfUrl(row.url), false, 'prior six pilot cannot be retried');
    seen.add(row.url);
  }
  assert.equal(new Set(SENATE_SIX_SCANNED_ORIGINALS.map(x=>x.url)).size, 6);
  assert.equal(new Set([...seen, ...SENATE_SIX_SCANNED_ORIGINALS.map(x=>x.url)]).size, 30);
  assert.equal(new Set(manifest.originals.map((x:any)=>x.year)).has(2021), false);
});

test('cohort is immutable across a routine CI run and retains hard original source size/page bounds', () => {
  // Git blob hash binds the exact independently reviewed source selection file.
  const gitBlob = createHash('sha1')
    .update('blob ' + Buffer.byteLength(raw, 'utf8') + '\0')
    .update(raw)
    .digest('hex');
  assert.equal(gitBlob, '70211898f4f885002b31de594ffd352a8c20d652');
  assert.equal(manifest.maxOriginalBytes, SENATE_SIX_SCANNED_ORIGINAL_MAX_BYTES);
  assert.equal(manifest.maxPdfPages, SENATE_SIX_SCANNED_ORIGINAL_MAX_PAGES);
  assert.equal(manifest.maxOriginalBytes, 8_000_000);
  assert.equal(manifest.maxPdfPages, 8);
  assert.equal(manifest.originals.filter((x:any)=>x.committeeName==='Finance').length, 2);
  assert.equal(manifest.originals.filter((x:any)=>x.committeeName==='Higher Education').length, 10);
  assert.equal(manifest.originals.filter((x:any)=>x.committeeName==='Judiciary and Public Safety').length, 3);
  assert.equal(manifest.originals.filter((x:any)=>x.meetingDate==='2025-09-25').length, 1);
});

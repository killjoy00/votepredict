import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WaybackCapture } from '../src/evidence/wayback.js';
import { planWaybackCampaignVersionCaptures } from '../src/evidence/wayback-campaign-version-plan.js';
import { selectWaybackEvidenceCaptures } from '../src/evidence/wayback-public-evidence-backfill.js';

function capture(timestamp: string, original: string, digest: string, overrides: Partial<WaybackCapture> = {}): WaybackCapture {
  const at = timestamp.slice(0, 4) + '-' + timestamp.slice(4, 6) + '-' + timestamp.slice(6, 8)
    + 'T' + timestamp.slice(8, 10) + ':' + timestamp.slice(10, 12) + ':' + timestamp.slice(12, 14) + '.000Z';
  return {
    timestamp, original, digest, mimetype: 'text/html', statuscode: '200', length: 200,
    capturedAt: at, archiveUrl: 'https://web.archive.org/web/' + timestamp + 'id_/' + original, ...overrides,
  };
}
const issue = 'https://campaign.example/issues/education';
const news = 'https://campaign.example/news/2021';

test('version-aware plan exposes same-year changed positions that v3 latest-only loses', () => {
  const earlier = capture('20210301000000', issue, 'old-content');
  const newer = capture('20211101000000', issue, 'new-content');
  const v3 = selectWaybackEvidenceCaptures([earlier, newer], { maxCaptures: 40 });
  const plan = planWaybackCampaignVersionCaptures([earlier, newer], { maxCaptures: 40 });
  assert.deepEqual(v3.map(c => c.timestamp), [newer.timestamp]);
  assert.deepEqual(plan.selectedCaptures.map(c => c.timestamp), [earlier.timestamp, newer.timestamp]);
  assert.equal(plan.distinctVersionCandidates, 2);
  assert.equal(plan.unselectedDistinctVersions, 0);
  assert.equal(plan.completenessCertified, false);
});

test('repeated same-digest snapshots collapse to earliest attesting capture, not latest', () => {
  const x = capture('20210501000000', issue, 'same-content');
  const y = capture('20210601000000', issue, 'same-content');
  const result = planWaybackCampaignVersionCaptures([y, x]);
  assert.deepEqual(result.selectedCaptures.map(c => c.timestamp), [x.timestamp]);
  assert.equal(result.duplicateDigestCapturesCollapsed, 1);
});

test('two issue URLs each receive a slot before extra versions from one URL', () => {
  const rows = [
    capture('20210101000000', issue, 'a1'),
    capture('20210201000000', issue, 'a2'),
    capture('20210301000000', issue, 'a3'),
    capture('20210401000000', 'https://campaign.example/issues/housing', 'b1'),
  ];
  const plan = planWaybackCampaignVersionCaptures(rows, { maxCaptures: 2 });
  assert.equal(plan.selectedCaptures.length, 2);
  assert.equal(new Set(plan.selectedCaptures.map(c => c.original)).size, 2);
  assert.equal(plan.unselectedDistinctVersions, 2);
  assert.equal(plan.groups.reduce((n, g) => n + g.unselectedDueToCap, 0), 2);
});

test('under a cap, issue/platform pages beat generic news before any extra versions', () => {
  const plan = planWaybackCampaignVersionCaptures([
    capture('20210501000000', news, 'news'),
    capture('20210502000000', issue, 'issue'),
  ], { maxCaptures: 1 });
  assert.deepEqual(plan.selectedCaptures.map(c => c.original), [issue]);
  assert.equal(plan.groups.find(g => g.originalUrl === news)?.unselectedDueToCap, 1);
});

test('different capture years count as different groups even with the same digest', () => {
  const plan = planWaybackCampaignVersionCaptures([
    capture('20210101000000', issue, 'same'),
    capture('20220101000000', issue, 'same'),
  ]);
  assert.equal(plan.groups.length, 2);
  assert.equal(plan.selectedCaptures.length, 2);
});

test('unknown digest does not silently collapse two captures', () => {
  const plan = planWaybackCampaignVersionCaptures([
    capture('20210101000000', issue, ''),
    capture('20210201000000', issue, ''),
  ]);
  assert.equal(plan.missingDigestCaptures, 2);
  assert.equal(plan.distinctVersionCandidates, 2);
});

test('CSS, non-success pages and CDN challenge paths cannot crowd out valid campaign pages', () => {
  const plan = planWaybackCampaignVersionCaptures([
    capture('20210101000000', 'https://campaign.example/site.css', 'css', { mimetype: 'text/css' }),
    capture('20210101000000', 'https://campaign.example/cdn-cgi/challenge', 'challenge'),
    capture('20210101000000', issue, 'error', { statuscode: '500' }),
    capture('20210102000000', issue, 'issue'),
  ]);
  assert.equal(plan.discardedNonPageRecords, 3);
  assert.deepEqual(plan.selectedCaptures.map(c => c.digest), ['issue']);
});

test('selection is deterministic independent of input order and bounded by maximum 50', () => {
  const rows = Array.from({ length: 80 }, (_, i) =>
    capture('2021' + String(1 + Math.floor(i / 28)).padStart(2, '0')
      + String(1 + i % 28).padStart(2, '0') + '000000',
    'https://campaign.example/issues/' + (i % 4), 'digest-' + i));
  const a = planWaybackCampaignVersionCaptures(rows, { maxCaptures: 200 });
  const b = planWaybackCampaignVersionCaptures([...rows].reverse(), { maxCaptures: 200 });
  assert.equal(a.selectedCaptures.length, 50);
  assert.equal(a.unselectedDistinctVersions, 30);
  assert.deepEqual(a.selectedCaptures.map(c => c.archiveUrl), b.selectedCaptures.map(c => c.archiveUrl));
});

test('offline CDX CLI emits version gap findings without network and preserves the source manifest', () => {
  const folder = mkdtempSync(join(tmpdir(), 'campaign-cdx-version-plan-'));
  try {
    const file = join(folder, 'source.json'), output = join(folder, 'report.json');
    const source = [
      ['timestamp','original','mimetype','statuscode','digest','length'],
      ['20210101000000',issue,'text/html','200','early','200'],
      ['20211201000000',issue,'text/html','200','late','220'],
    ];
    writeFileSync(file, JSON.stringify(source));
    execFileSync('node', ['--import','tsx','scripts/plan-campaign-wayback-versions-offline.ts',
      '--cdx',file,'--output',output,'--max-captures','40'], { timeout: 15_000, stdio: 'pipe' });
    const report = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(report.selectedCaptures.length, 2);
    assert.equal(report.oldV3SelectionCount, 1);
    assert.equal(report.selectedNotInV3.length, 1);
    assert.equal(report.completenessCertified, false);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).length, 3);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

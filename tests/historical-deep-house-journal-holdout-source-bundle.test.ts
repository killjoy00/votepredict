import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalDeepHouseJournalHoldoutCohort } from '../src/evaluation/historical-deep-house-journal-holdout-cohort';
import { buildHistoricalDeepHouseJournalHoldoutSourceBundle } from '../src/evaluation/historical-deep-house-journal-holdout-source-bundle';
import {
  collectHistoricalDeepHouseJournalSource,
  matchHistoricalDeepHouseJournalCases,
  parseHistoricalDeepHouseJournalIndex,
} from '../src/evaluation/historical-deep-house-journal-source-bundle';

const indexHtml = `
<html><body>
<h1>Journals for the 2025 - 2026 Regular Session</h1>
<div>Friday, January 2, 2026</div><div>10th Legislative Day</div>
<a href="/cco/journals/2025-26/J0102010.htm">HTML</a>
<div>Thursday, January 1, 2026</div><div>9th Legislative Day</div>
<a href="https://www.house.mn.gov/cco/journals/2025-26/J0101009.htm">HTML</a>
</body></html>`;

const journalHtml = `
<html><body>
<h1>Journal of the House - 10th Day - Friday, January 2, 2026</h1>
<p>STATE OF MINNESOTA</p>
<p>Saint Paul, Minnesota, Friday, January 2, 2026</p>
<p>H. F. No. 1 was reported to the House.</p>
</body></html>`;

function cohortFixture(): HistoricalDeepHouseJournalHoldoutCohort {
  return {
    schemaVersion: 'historical-deep-house-journal-holdout-cohort-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      codeSha: 'code',
      databaseSource: 'fixture',
      purpose: 'fixture',
      selectionGuard: 'fixture',
      outcomeRevealPolicy: 'fixture',
      sessions: ['2025-2026'],
      chamber: 'house',
      perSessionPerTranche: 12,
      totalSelected: 24,
      poolBySession: { '2025-2026': 24 },
    },
    cases: Array.from({ length: 24 }, (_, index) => {
      const ordinal = index + 1;
      return {
        stableKey: `2025-2026|house|event-${ordinal}`,
        caseKey: `2025-2026|house|HF${ordinal}|2026-01-03`,
        voteEventId: `v${ordinal}`,
        externalKey: `event-${ordinal}`,
        identifier: `HF${ordinal}`,
        title: `Fixture ${ordinal}`,
        session: '2025-2026',
        chamber: 'house',
        occurredOn: '2026-01-03',
        targetVersionId: 'target',
        quickModelVersion: 'quick',
        activeMembers: 2,
        currentDeepTargetIds: ['m1', 'm2'],
        needOnlyTargetIds: ['m1', 'm2'],
        targetOverlap: 2,
        targetDisagreementRate: 0,
        tranche: index < 12 ? 'deterministic-uniform' as const : 'selector-disagreement' as const,
        trancheRankWithinSession: index < 12 ? ordinal : ordinal - 12,
      };
    }),
  };
}

test('parses exact 2025-2026 Journal HTML links from the official current-session index shape', () => {
  const parsed = parseHistoricalDeepHouseJournalIndex(indexHtml, '2025-2026');
  assert.equal(parsed.sessionMatched, true);
  assert.deepEqual(parsed.links.map((item) => [item.journalDate, item.legislativeDay, item.fileName]), [
    ['2026-01-01', 9, 'J0101009.htm'],
    ['2026-01-02', 10, 'J0102010.htm'],
  ]);
  assert.ok(parsed.links.every((item) => item.url.startsWith('https://www.house.mn.gov/cco/journals/2025-26/')));
});

test('builds a source-only holdout bundle without replacing uncovered frozen cases', () => {
  const cohort = cohortFixture();
  const matches = matchHistoricalDeepHouseJournalCases(cohort.cases, {
    session: '2025-2026',
    journalDate: '2026-01-02',
    html: journalHtml,
  });
  assert.deepEqual(matches.map((item) => item.identifier), ['HF1']);

  const source = collectHistoricalDeepHouseJournalSource({
    session: '2025-2026',
    journalDate: '2026-01-02',
    legislativeDay: 10,
    url: 'https://www.house.mn.gov/cco/journals/2025-26/J0102010.htm',
    finalUrl: 'https://www.house.mn.gov/cco/journals/2025-26/J0102010.htm',
    fetchedAt: '2026-01-04T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: Buffer.from(journalHtml),
    matchedCases: matches,
  });

  const bundle = buildHistoricalDeepHouseJournalHoldoutSourceBundle({
    cohort,
    codeSha: 'code',
    cohortHeadSha: 'head',
    cohortArtifactId: 1,
    cohortArtifactDigest: 'digest',
    sessionIndexUrl: 'https://www.house.mn.gov/Journals',
    sessionIndexesAttempted: 1,
    journalLinksDiscovered: 2,
    journalPagesEligibleByIndexDate: 2,
    journalPagesFetched: 2,
    sources: [source],
    diagnostics: [],
    generatedAt: '2026-01-05T00:00:00.000Z',
  });

  assert.equal(bundle.schemaVersion, 'historical-deep-house-journal-holdout-source-bundle-v1');
  assert.equal(bundle.summary.casesWithSources, 1);
  assert.equal(bundle.summary.casesWithoutSources, 23);
  assert.equal(bundle.cases.length, 24);
  assert.equal(bundle.cases.find((item) => item.identifier === 'HF1')?.sourceIds.length, 1);
  assert.equal(bundle.cases.find((item) => item.identifier === 'HF2')?.sourceIds.length, 0);
  assert.match(bundle.metadata.outcomeRevealGuard, /forbidden/i);
});

test('fails closed if a source match does not belong to the frozen holdout lineage', () => {
  const cohort = cohortFixture();
  const matches = matchHistoricalDeepHouseJournalCases(cohort.cases, {
    session: '2025-2026',
    journalDate: '2026-01-02',
    html: journalHtml,
  });
  const source = collectHistoricalDeepHouseJournalSource({
    session: '2025-2026',
    journalDate: '2026-01-02',
    legislativeDay: 10,
    url: 'https://www.house.mn.gov/cco/journals/2025-26/J0102010.htm',
    finalUrl: 'https://www.house.mn.gov/cco/journals/2025-26/J0102010.htm',
    fetchedAt: '2026-01-04T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: Buffer.from(journalHtml),
    matchedCases: [{ ...matches[0], voteEventId: 'wrong' }],
  });

  assert.throws(() => buildHistoricalDeepHouseJournalHoldoutSourceBundle({
    cohort,
    codeSha: 'code',
    cohortHeadSha: 'head',
    cohortArtifactId: 1,
    cohortArtifactDigest: 'digest',
    sessionIndexUrl: 'https://www.house.mn.gov/Journals',
    sessionIndexesAttempted: 1,
    journalLinksDiscovered: 2,
    journalPagesEligibleByIndexDate: 2,
    journalPagesFetched: 2,
    sources: [source],
    diagnostics: [],
  }), /lineage mismatch/);
});

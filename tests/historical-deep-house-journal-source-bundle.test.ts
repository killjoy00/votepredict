import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalDeepExpansionCohort } from '../src/evaluation/historical-deep-expansion-cohort';
import {
  buildHistoricalDeepHouseJournalSourceBundle,
  collectHistoricalDeepHouseJournalSource,
  matchHistoricalDeepHouseJournalCases,
  parseHistoricalDeepHouseJournalDate,
  parseHistoricalDeepHouseJournalIndex,
} from '../src/evaluation/historical-deep-house-journal-source-bundle';

const indexHtml = `
<html><body>
<h1>Journals for the 2021 - 2022 Regular Session</h1>
<div>Tuesday, May 10, 2022</div><div>106th Legislative Day</div>
<a href="/cco/journals/2021-22/J0510106.htm">HTML</a> or <a href="/cco/journals/2021-22/J0510106.pdf">PDF</a>
<div>Monday, May 9, 2022</div><div>105th Legislative Day</div>
<a href="https://www.house.mn.gov/cco/journals/2021-22/J0509105.htm">HTML</a>
</body></html>`;

const journalHtml = `
<html><body>
<h1>Journal of the House - 106th Day - Tuesday, May 10, 2022</h1>
<p>STATE OF MINNESOTA</p>
<p>Saint Paul, Minnesota, Tuesday, May 10, 2022</p>
<p>S. F. No. 3008 was reported to the House.</p>
</body></html>`;

function cohortFixture(): HistoricalDeepExpansionCohort {
  return {
    schemaVersion: 'historical-deep-expansion-cohort-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      codeSha: 'code',
      databaseSource: 'fixture',
      purpose: 'fixture',
      selectionGuard: 'fixture',
      holdoutPolicy: 'fixture',
      sessions: ['2021-2022'],
      chamber: 'house',
      targetLimit: 12,
      perSessionPerTranche: 1,
      totalSelected: 2,
      pilotCasesExcluded: 0,
      poolBySession: { '2021-2022': 2 },
    },
    cases: [
      {
        stableKey: '2021-2022|house|event-1',
        caseKey: '2021-2022|house|SF3008|2022-05-11',
        voteEventId: 'v1',
        externalKey: 'event-1',
        identifier: 'SF3008',
        title: 'Fixture one',
        session: '2021-2022',
        chamber: 'house',
        occurredOn: '2022-05-11',
        targetVersionId: 'target',
        quickModelVersion: 'quick',
        activeMembers: 2,
        currentDeepTargetIds: ['m1', 'm2'],
        needOnlyTargetIds: ['m1', 'm2'],
        targetOverlap: 2,
        targetDisagreementRate: 0,
        tranche: 'deterministic-uniform',
        trancheRankWithinSession: 1,
      },
      {
        stableKey: '2021-2022|house|event-2',
        caseKey: '2021-2022|house|HF1|2022-05-10',
        voteEventId: 'v2',
        externalKey: 'event-2',
        identifier: 'HF1',
        title: 'Fixture two',
        session: '2021-2022',
        chamber: 'house',
        occurredOn: '2022-05-10',
        targetVersionId: 'target',
        quickModelVersion: 'quick',
        activeMembers: 2,
        currentDeepTargetIds: ['m1', 'm2'],
        needOnlyTargetIds: ['m1', 'm2'],
        targetOverlap: 2,
        targetDisagreementRate: 0,
        tranche: 'selector-disagreement',
        trancheRankWithinSession: 1,
      },
    ],
  };
}

test('parses dated official House Journal HTML links from a session archive index', () => {
  const result = parseHistoricalDeepHouseJournalIndex(indexHtml, '2021-2022');
  assert.equal(result.sessionMatched, true);
  assert.deepEqual(result.links, [
    {
      session: '2021-2022',
      journalDate: '2022-05-09',
      legislativeDay: 105,
      url: 'https://www.house.mn.gov/cco/journals/2021-22/J0509105.htm',
      fileName: 'J0509105.htm',
    },
    {
      session: '2021-2022',
      journalDate: '2022-05-10',
      legislativeDay: 106,
      url: 'https://www.house.mn.gov/cco/journals/2021-22/J0510106.htm',
      fileName: 'J0510106.htm',
    },
  ]);
});

test('proves the exact journal page date and enforces previous-day cutoff', () => {
  assert.equal(parseHistoricalDeepHouseJournalDate(journalHtml), '2022-05-10');
  const matches = matchHistoricalDeepHouseJournalCases(cohortFixture().cases, {
    session: '2021-2022',
    journalDate: '2022-05-10',
    html: journalHtml,
  });
  assert.deepEqual(matches.map((item) => item.identifier), ['SF3008']);
});

test('collects content-bound journal sources and builds immutable case coverage', () => {
  const cohort = cohortFixture();
  const matches = matchHistoricalDeepHouseJournalCases(cohort.cases, {
    session: '2021-2022',
    journalDate: '2022-05-10',
    html: journalHtml,
  });
  const source = collectHistoricalDeepHouseJournalSource({
    session: '2021-2022',
    journalDate: '2022-05-10',
    legislativeDay: 106,
    url: 'https://www.house.mn.gov/cco/journals/2021-22/J0510106.htm',
    finalUrl: 'https://www.house.mn.gov/cco/journals/2021-22/J0510106.htm',
    fetchedAt: '2026-01-02T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: Buffer.from(journalHtml),
    matchedCases: matches,
  });
  assert.equal(source.sourceClass, 'house_journal_record');
  assert.equal(source.publishedAt, '2022-05-10T23:59:59.999Z');
  assert.equal(source.matchedCases[0].identifier, 'SF3008');
  assert.match(source.contentSha256, /^[a-f0-9]{64}$/);

  const bundle = buildHistoricalDeepHouseJournalSourceBundle({
    cohort,
    codeSha: 'code',
    cohortHeadSha: 'head',
    cohortArtifactId: 1,
    cohortArtifactDigest: 'digest',
    archiveIndexesAttempted: 1,
    journalLinksDiscovered: 2,
    journalPagesEligibleByIndexDate: 2,
    journalPagesFetched: 2,
    sources: [source],
    diagnostics: [],
    generatedAt: '2026-01-03T00:00:00.000Z',
  });
  assert.equal(bundle.summary.casesWithSources, 1);
  assert.equal(bundle.summary.casesWithoutSources, 1);
  assert.equal(bundle.summary.sfCasesWithSources, 1);
  assert.equal(bundle.summary.hfCasesWithSources, 0);
  assert.equal(bundle.cases.find((item) => item.identifier === 'SF3008')?.sourceIds.length, 1);
});

test('fails closed on journal page/index date mismatch', () => {
  assert.throws(() => collectHistoricalDeepHouseJournalSource({
    session: '2021-2022',
    journalDate: '2022-05-09',
    legislativeDay: 105,
    url: 'https://www.house.mn.gov/cco/journals/2021-22/J0509105.htm',
    finalUrl: 'https://www.house.mn.gov/cco/journals/2021-22/J0509105.htm',
    fetchedAt: '2026-01-02T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html',
    bytes: Buffer.from(journalHtml),
    matchedCases: [{
      stableKey: '2021-2022|house|event-1',
      caseKey: '2021-2022|house|SF3008|2022-05-11',
      voteEventId: 'v1',
      externalKey: 'event-1',
      identifier: 'SF3008',
      occurredOn: '2022-05-11',
      tranche: 'deterministic-uniform',
    }],
  }), /index\/page date mismatch/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistoricalDeepExpansionSourceBundle,
  collectHistoricalDeepExpansionSource,
  historicalDeepMinuteContainsIdentifier,
  matchHistoricalDeepExpansionCases,
  parseHistoricalDeepCommitteeHome,
  parseHistoricalDeepMinuteDate,
} from '../src/evaluation/historical-deep-expansion-source-bundle.js';
import type {
  HistoricalDeepExpansionCohort,
  HistoricalDeepExpansionSelectedCase,
} from '../src/evaluation/historical-deep-expansion-cohort.js';

function selectedCase(
  identifier: string,
  occurredOn: string,
  suffix: string,
  tranche: 'deterministic-uniform' | 'selector-disagreement' = 'deterministic-uniform',
): HistoricalDeepExpansionSelectedCase {
  const session = occurredOn.startsWith('2022') ? '2021-2022' : '2023-2024';
  const externalKey = `fixture:${identifier}:${occurredOn}:${suffix}`;
  return {
    voteEventId: `vote-${suffix}`,
    externalKey,
    identifier,
    title: `${identifier} fixture`,
    session,
    chamber: 'house',
    occurredOn,
    stableKey: `${session}|house|${externalKey}`,
    caseKey: `${session}|house|${identifier}|${occurredOn}`,
    targetVersionId: `version-${suffix}`,
    quickModelVersion: 'member-eb-v1.1',
    activeMembers: 134,
    currentDeepTargetIds: Array.from({ length: 12 }, (_, index) => `current-${suffix}-${index}`),
    needOnlyTargetIds: Array.from({ length: 12 }, (_, index) => `need-${suffix}-${index}`),
    targetOverlap: 0,
    targetDisagreementRate: 1,
    tranche,
    trancheRankWithinSession: 1,
  };
}

function cohort(cases: HistoricalDeepExpansionSelectedCase[]): HistoricalDeepExpansionCohort {
  return {
    schemaVersion: 'historical-deep-expansion-cohort-v1',
    generatedAt: '2026-09-12T00:00:00.000Z',
    metadata: {
      codeSha: 'cohort-sha',
      databaseSource: 'test',
      purpose: 'test',
      selectionGuard: 'test',
      holdoutPolicy: 'test',
      sessions: ['2021-2022', '2023-2024'],
      chamber: 'house',
      targetLimit: 12,
      perSessionPerTranche: 6,
      totalSelected: cases.length,
      pilotCasesExcluded: 6,
      poolBySession: { '2021-2022': 100, '2023-2024': 100 },
    },
    cases,
  };
}

test('enumerates exact minute identities from a fixed historical committee home page', () => {
  const html = `
    <html><body>
      <h1>Health Finance and Policy</h1>
      <h4>2023-2024 Regular Session</h4>
      <h3>Meeting Minutes</h3>
      <ul>
        <li><a href="/cmte/minutes/minutes.aspx?comm=93010&amp;id=100947&amp;ls_year=93">FIFTY-SECOND MEETING</a> - 5/7/2024</li>
        <li><a href="/Committees/minutes/93010/89889">FIRST MEETING</a> - 1/5/2023</li>
        <li><a href="/Committees/minutes/93011/99999">OTHER COMMITTEE</a> - 1/6/2023</li>
      </ul>
    </body></html>`;
  const parsed = parseHistoricalDeepCommitteeHome(html, '2023-2024', '93010');
  assert.equal(parsed.sessionMatched, true);
  assert.deepEqual(parsed.links, [
    {
      committeeId: '93010',
      meetingId: '89889',
      indexDate: '2023-01-05',
      url: 'https://www.house.mn.gov/committees/minutes/93010/89889',
    },
    {
      committeeId: '93010',
      meetingId: '100947',
      indexDate: '2024-05-07',
      url: 'https://www.house.mn.gov/committees/minutes/93010/100947',
    },
  ]);
  assert.deepEqual(parseHistoricalDeepCommitteeHome(html, '2021-2022', '93010'), {
    sessionMatched: false,
    links: [],
  });
});

test('proves the session date from the minute page and matches exact bill identifiers', () => {
  const html = `
    <h3>2023-2024 Regular Session - Thursday, January 5, 2023</h3>
    <p>House File HF 1370 was before the committee.</p>
    <p>HF13700 is a different longer identifier.</p>`;
  assert.equal(parseHistoricalDeepMinuteDate(html, '2023-2024'), '2023-01-05');
  assert.equal(parseHistoricalDeepMinuteDate(html, '2021-2022'), undefined);
  assert.equal(historicalDeepMinuteContainsIdentifier(html, 'HF1370'), true);
  assert.equal(historicalDeepMinuteContainsIdentifier(html, 'HF137'), false);
  assert.equal(historicalDeepMinuteContainsIdentifier('<p>S.F. 10 was discussed.</p>', 'SF10'), true);
});

test('only a strictly pre-vote official minute can match a frozen cohort event', () => {
  const before = selectedCase('HF1370', '2023-03-30', 'before');
  const sameDay = selectedCase('HF1370', '2023-03-29', 'same-day');
  const otherBill = selectedCase('HF2609', '2024-05-02', 'other');
  const html = '<p>HF 1370 recommended to pass.</p>';
  const matches = matchHistoricalDeepExpansionCases([before, sameDay, otherBill], {
    session: '2023-2024',
    meetingDate: '2023-03-29',
    html,
  });
  assert.deepEqual(matches.map((item) => item.stableKey), [before.stableKey]);
});

test('freezes hashes and preserves selected cases with zero discovered sources', () => {
  const matched = selectedCase('HF1370', '2023-03-30', 'matched');
  const unmatched = selectedCase('HF2609', '2024-05-02', 'unmatched', 'selector-disagreement');
  const html = '<h3>2023-2024 Regular Session - Tuesday, March 28, 2023</h3><p>HF1370 recommended to pass.</p>';
  const bytes = Buffer.from(html, 'utf8');
  const sourceMatches = matchHistoricalDeepExpansionCases([matched, unmatched], {
    session: '2023-2024',
    meetingDate: '2023-03-28',
    html,
  });
  const source = collectHistoricalDeepExpansionSource({
    session: '2023-2024',
    committeeId: '93010',
    meetingId: '90123',
    indexDate: '2023-03-28',
    meetingDate: '2023-03-28',
    url: 'https://www.house.mn.gov/committees/minutes/93010/90123',
    finalUrl: 'https://www.house.mn.gov/Committees/minutes/93010/90123',
    fetchedAt: '2026-09-12T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    bytes,
    matchedCases: sourceMatches,
  });
  const bundle = buildHistoricalDeepExpansionSourceBundle({
    cohort: cohort([matched, unmatched]),
    codeSha: 'source-sha',
    cohortHeadSha: 'cohort-sha',
    cohortArtifactId: 123,
    cohortArtifactDigest: 'abc123',
    committeeHomeIdsAttempted: 198,
    committeesDiscovered: 20,
    minuteLinksDiscovered: 500,
    minutePagesEligibleByIndexDate: 400,
    minutePagesFetched: 400,
    sources: [source],
    diagnostics: [],
    generatedAt: '2026-09-12T01:00:00.000Z',
  });
  assert.equal(bundle.summary.matchedSourcePages, 1);
  assert.equal(bundle.summary.sourceCaseMatches, 1);
  assert.equal(bundle.summary.casesWithSources, 1);
  assert.equal(bundle.summary.casesWithoutSources, 1);
  assert.equal(bundle.cases.find((item) => item.stableKey === unmatched.stableKey)?.sourceIds.length, 0);
  assert.match(source.contentSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(source.expectedMarkers, ['2023-03-28', 'HF1370']);
});

test('fails closed on minute-page/index date mismatch', () => {
  const matched = selectedCase('HF1370', '2023-03-30', 'mismatch');
  assert.throws(() => collectHistoricalDeepExpansionSource({
    session: '2023-2024',
    committeeId: '93010',
    meetingId: '90123',
    indexDate: '2023-03-27',
    meetingDate: '2023-03-28',
    url: 'https://www.house.mn.gov/committees/minutes/93010/90123',
    finalUrl: 'https://www.house.mn.gov/committees/minutes/93010/90123',
    fetchedAt: '2026-09-12T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html',
    bytes: Buffer.from('<p>HF1370</p>'),
    matchedCases: [{
      stableKey: matched.stableKey,
      caseKey: matched.caseKey,
      voteEventId: matched.voteEventId,
      externalKey: matched.externalKey,
      identifier: matched.identifier,
      occurredOn: matched.occurredOn,
      tranche: matched.tranche,
    }],
  }), /date mismatch/);
});

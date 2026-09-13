import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoricalDeepHouseJournalMechanicsArtifact } from '../src/evaluation/historical-deep-house-journal-mechanics.js';

function hash(value: string): string {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function sourceBundleFixture() {
  const senateHtml = `<html><body>
    <p>REPORTS OF CHIEF CLERK</p>
    <p>S. F. No. 3008 and H. F. No. 2767, which had been referred to the Chief Clerk for comparison, were examined and found to be not identical.</p>
    <p>Stephenson moved that S. F. No. 3008 be substituted for H. F. No. 2767 and that the House File be indefinitely postponed. The motion prevailed.</p>
    <p>SECOND READING OF SENATE BILLS S. F. No. 3008 was read for the second time.</p>
    <p>Long from the Committee on Rules and Legislative Administration, pursuant to rules 1.21 and 3.33, designated the following bills to be placed on the Calendar for the Day for Wednesday, May 11, 2022 and established a prefiling requirement for amendments offered to the following bills: S. F. No. 3008.</p>
    <p>CALENDAR FOR THE DAY H. F. No. 999 was reported to the House.</p>
  </body></html>`;
  const houseHtml = `<html><body>
    <p>Nelson from the Committee on State Government Finance and Elections to which was referred: H. F. No. 1, A bill for an act relating to a fixture. Reported the same back with the recommendation that the bill be placed on the General Register.</p>
    <p>The report was adopted.</p>
    <p>H. F. No. 1 was reported to the House.</p>
    <p>Long moved that H. F. No. 1 be laid on the table. The motion prevailed.</p>
    <p>H. F. No. 1, A bill for an act relating to a fixture. The bill was read for the third time and placed upon its final passage. The question was taken on passage and the roll was called. There were 99 yeas and 1 nay.</p>
  </body></html>`;
  return {
    schemaVersion: 'historical-deep-house-journal-source-bundle-v1',
    generatedAt: '2026-09-13T00:00:00.000Z',
    metadata: {
      codeSha: 'source-head',
      cohortHeadSha: 'cohort-head',
      cohortArtifactId: 1,
      cohortArtifactDigest: 'cohort-digest',
      sourcePolicy: 'house-journal-archive-enumeration-v1',
      purpose: 'fixture',
      selectionGuard: 'fixture',
      availabilityGuard: 'fixture',
    },
    input: {
      selectedCases: 2,
      sessions: ['2021-2022'],
      chamber: 'house',
      archiveIndexesAttempted: 1,
    },
    summary: {
      journalLinksDiscovered: 2,
      journalPagesEligibleByIndexDate: 2,
      journalPagesFetched: 2,
      matchedSourcePages: 2,
      sourceCaseMatches: 2,
      casesWithSources: 2,
      casesWithoutSources: 0,
      hfCasesWithSources: 1,
      sfCasesWithSources: 1,
    },
    cases: [
      {
        stableKey: 'case-sf',
        caseKey: 'case-sf-key',
        voteEventId: 'vote-sf',
        externalKey: 'external-sf',
        identifier: 'SF3008',
        session: '2021-2022',
        occurredOn: '2022-05-11',
        tranche: 'deterministic-uniform',
        sourceIds: ['journal-sf'],
      },
      {
        stableKey: 'case-hf',
        caseKey: 'case-hf-key',
        voteEventId: 'vote-hf',
        externalKey: 'external-hf',
        identifier: 'HF1',
        session: '2021-2022',
        occurredOn: '2022-05-20',
        tranche: 'selector-disagreement',
        sourceIds: ['journal-hf'],
      },
    ],
    sources: [
      {
        id: 'journal-sf',
        sourceClass: 'house_journal_record',
        session: '2021-2022',
        journalDate: '2022-05-09',
        legislativeDay: 105,
        publishedAt: '2022-05-09T23:59:59.999Z',
        title: 'fixture sf',
        url: 'https://www.house.mn.gov/cco/journals/2021-22/J0509105.htm',
        finalUrl: 'https://www.house.mn.gov/cco/journals/2021-22/J0509105.htm',
        fetchedAt: '2026-09-13T00:00:00.000Z',
        httpStatus: 200,
        contentType: 'text/html',
        bytes: Buffer.byteLength(senateHtml),
        contentSha256: hash(senateHtml),
        expectedMarkers: ['SF3008'],
        matchedCases: [{
          stableKey: 'case-sf',
          caseKey: 'case-sf-key',
          voteEventId: 'vote-sf',
          externalKey: 'external-sf',
          identifier: 'SF3008',
          occurredOn: '2022-05-11',
          tranche: 'deterministic-uniform',
        }],
        content: senateHtml,
      },
      {
        id: 'journal-hf',
        sourceClass: 'house_journal_record',
        session: '2021-2022',
        journalDate: '2022-05-10',
        legislativeDay: 106,
        publishedAt: '2022-05-10T23:59:59.999Z',
        title: 'fixture hf',
        url: 'https://www.house.mn.gov/cco/journals/2021-22/J0510106.htm',
        finalUrl: 'https://www.house.mn.gov/cco/journals/2021-22/J0510106.htm',
        fetchedAt: '2026-09-13T00:00:00.000Z',
        httpStatus: 200,
        contentType: 'text/html',
        bytes: Buffer.byteLength(houseHtml),
        contentSha256: hash(houseHtml),
        expectedMarkers: ['HF1'],
        matchedCases: [{
          stableKey: 'case-hf',
          caseKey: 'case-hf-key',
          voteEventId: 'vote-hf',
          externalKey: 'external-hf',
          identifier: 'HF1',
          occurredOn: '2022-05-20',
          tranche: 'selector-disagreement',
        }],
        content: houseHtml,
      },
    ],
    diagnostics: [],
  };
}

test('extracts deterministic House Journal process mechanics without actionability or outcomes', () => {
  const result = buildHistoricalDeepHouseJournalMechanicsArtifact({
    sourceBundle: sourceBundleFixture() as never,
    sourceArtifactId: 123,
    sourceArtifactDigest: `sha256:${'a'.repeat(64)}`,
    sourceHeadSha: 'source-head',
    generatedAt: '2026-09-13T01:00:00.000Z',
  });

  assert.equal(result.schemaVersion, 'historical-deep-house-journal-mechanics-v1');
  assert.equal(result.metadata.parser, 'deterministic-house-journal-mechanics-v1');
  assert.equal(result.metadata.outcomeUse, 'none');
  assert.equal(result.metadata.holdoutUse, 'none');
  assert.equal(result.metadata.probabilityAction, 'none');
  assert.equal(result.summary.casesWithMechanics, 2);
  assert.equal(result.summary.casesWithoutMechanics, 0);
  assert.equal(result.summary.unclassifiedSourceCasePairs, 0);
  assert.ok(result.observations.every((item) => item.mechanicallyActionable === false));
  assert.ok(result.observations.every((item) => item.finalPassageInference === 'none'));

  const sf = result.cases.find((item) => item.identifier === 'SF3008');
  assert.deepEqual(sf?.mechanics, ['second_reading', 'calendar_designation', 'companion_substitution']);
  const hf = result.cases.find((item) => item.identifier === 'HF1');
  assert.deepEqual(hf?.mechanics, [
    'committee_advances_to_general_register',
    'reported_to_house',
    'laid_on_table',
    'reaches_final_passage_stage',
  ]);

  const finalStage = result.observations.find((item) => item.mechanic === 'reaches_final_passage_stage');
  assert.ok(finalStage);
  assert.doesNotMatch(finalStage.evidenceText, /99 yeas/i);
  assert.doesNotMatch(finalStage.evidenceText, /roll was called/i);
});

test('calendar extraction stops at the next Journal section', () => {
  const fixture = sourceBundleFixture();
  const source = fixture.sources[0];
  source.content = `<html><body>
    <p>Long designated the following bill to be placed on the Calendar for the Day for Wednesday, May 11, 2022 and established a prefiling requirement for amendments offered to the following bill: H. F. No. 7.</p>
    <p>CALENDAR FOR THE DAY S. F. No. 3008 was reported to the House.</p>
  </body></html>`;
  source.bytes = Buffer.byteLength(source.content);
  source.contentSha256 = hash(source.content);

  const result = buildHistoricalDeepHouseJournalMechanicsArtifact({
    sourceBundle: fixture as never,
    sourceArtifactId: 123,
    sourceArtifactDigest: `sha256:${'b'.repeat(64)}`,
    sourceHeadSha: 'source-head',
  });
  const sf = result.cases.find((item) => item.identifier === 'SF3008');
  assert.equal(sf?.mechanics.includes('calendar_designation'), false);
  assert.equal(sf?.mechanics.includes('reported_to_house'), true);
});

test('fails closed if frozen source content no longer matches its SHA-256 binding', () => {
  const fixture = sourceBundleFixture();
  fixture.sources[0].content += '<p>changed</p>';
  assert.throws(() => buildHistoricalDeepHouseJournalMechanicsArtifact({
    sourceBundle: fixture as never,
    sourceArtifactId: 123,
    sourceArtifactDigest: `sha256:${'c'.repeat(64)}`,
    sourceHeadSha: 'source-head',
  }), /content hash changed/);
});

test('fails closed if a source is not strictly before the frozen floor-vote date', () => {
  const fixture = sourceBundleFixture();
  fixture.sources[0].journalDate = '2022-05-11';
  assert.throws(() => buildHistoricalDeepHouseJournalMechanicsArtifact({
    sourceBundle: fixture as never,
    sourceArtifactId: 123,
    sourceArtifactDigest: `sha256:${'d'.repeat(64)}`,
    sourceHeadSha: 'source-head',
  }), /not strictly pre-vote/);
});

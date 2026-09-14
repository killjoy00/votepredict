import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalDeepHouseJournalHoldoutCohort } from '../src/evaluation/historical-deep-house-journal-holdout-cohort';
import { buildHistoricalDeepHouseJournalHoldoutMechanicsArtifact } from '../src/evaluation/historical-deep-house-journal-holdout-mechanics';
import { buildHistoricalDeepHouseJournalHoldoutSourceBundle } from '../src/evaluation/historical-deep-house-journal-holdout-source-bundle';
import {
  buildHistoricalDeepHouseJournalMechanicsArtifact,
} from '../src/evaluation/historical-deep-house-journal-mechanics';
import {
  collectHistoricalDeepHouseJournalSource,
  matchHistoricalDeepHouseJournalCases,
  type HistoricalDeepHouseJournalSourceBundle,
} from '../src/evaluation/historical-deep-house-journal-source-bundle';

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
      codeSha: 'cohort-head',
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

function holdoutSourceFixture() {
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
    matchedCases: matches,
  });
  const bundle = buildHistoricalDeepHouseJournalHoldoutSourceBundle({
    cohort,
    codeSha: 'source-head',
    cohortHeadSha: 'cohort-head',
    cohortArtifactId: 1,
    cohortArtifactDigest: 'cohort-digest',
    sessionIndexUrl: 'https://www.house.mn.gov/Journals',
    sessionIndexesAttempted: 1,
    journalLinksDiscovered: 2,
    journalPagesEligibleByIndexDate: 2,
    journalPagesFetched: 2,
    sources: [source],
    diagnostics: [],
    generatedAt: '2026-01-05T00:00:00.000Z',
  });
  return { bundle, source };
}

test('applies the frozen development parser to covered holdout cases and restores source-less cases with zero mechanics', () => {
  const { bundle } = holdoutSourceFixture();
  const result = buildHistoricalDeepHouseJournalHoldoutMechanicsArtifact({
    sourceBundle: bundle,
    sourceArtifactId: 2,
    sourceArtifactDigest: `sha256:${'b'.repeat(64)}`,
    sourceHeadSha: 'source-head',
    parserReference: {
      developmentMechanicsArtifactId: 3,
      developmentMechanicsArtifactDigest: `sha256:${'a'.repeat(64)}`,
      developmentMechanicsHeadSha: 'development-head',
      parserSourceBlobSha: 'c'.repeat(40),
    },
    generatedAt: '2026-01-06T00:00:00.000Z',
  });

  assert.equal(result.schemaVersion, 'historical-deep-house-journal-holdout-mechanics-v1');
  assert.equal(result.metadata.parser, 'deterministic-house-journal-mechanics-v1');
  assert.equal(result.metadata.outcomeUse, 'none');
  assert.equal(result.input.selectedCases, 24);
  assert.equal(result.cases.length, 24);
  assert.equal(result.summary.observations, 1);
  assert.equal(result.summary.casesWithMechanics, 1);
  assert.equal(result.summary.casesWithoutMechanics, 23);
  assert.equal(result.observations[0].mechanic, 'reported_to_house');
  assert.equal(result.observations[0].mechanicallyActionable, false);
  assert.equal(result.observations[0].finalPassageInference, 'none');
  assert.equal(result.cases.find((item) => item.identifier === 'HF1')?.mechanics[0], 'reported_to_house');
  assert.deepEqual(result.cases.find((item) => item.identifier === 'HF2')?.mechanics, []);
});

test('holdout observations are byte-for-byte parser-equivalent to the frozen development parser output for the covered source slice', () => {
  const { bundle } = holdoutSourceFixture();
  const holdout = buildHistoricalDeepHouseJournalHoldoutMechanicsArtifact({
    sourceBundle: bundle,
    sourceArtifactId: 2,
    sourceArtifactDigest: `sha256:${'b'.repeat(64)}`,
    sourceHeadSha: 'source-head',
    parserReference: {
      developmentMechanicsArtifactId: 3,
      developmentMechanicsArtifactDigest: `sha256:${'a'.repeat(64)}`,
      developmentMechanicsHeadSha: 'development-head',
      parserSourceBlobSha: 'c'.repeat(40),
    },
    generatedAt: '2026-01-06T00:00:00.000Z',
  });

  const coveredCases = bundle.cases.filter((item) => item.sourceIds.length > 0);
  const compatibility: HistoricalDeepHouseJournalSourceBundle = {
    schemaVersion: 'historical-deep-house-journal-source-bundle-v1',
    generatedAt: bundle.generatedAt,
    metadata: {
      codeSha: bundle.metadata.codeSha,
      cohortHeadSha: bundle.metadata.cohortHeadSha,
      cohortArtifactId: bundle.metadata.cohortArtifactId,
      cohortArtifactDigest: bundle.metadata.cohortArtifactDigest,
      sourcePolicy: 'house-journal-archive-enumeration-v1',
      purpose: 'fixture compatibility',
      selectionGuard: 'fixture',
      availabilityGuard: 'fixture',
    },
    input: {
      selectedCases: coveredCases.length,
      sessions: bundle.input.sessions,
      chamber: bundle.input.chamber,
      archiveIndexesAttempted: 1,
    },
    summary: {
      ...bundle.summary,
      casesWithSources: coveredCases.length,
      casesWithoutSources: 0,
      hfCasesWithSources: coveredCases.length,
      sfCasesWithSources: 0,
    },
    cases: coveredCases,
    sources: bundle.sources,
    diagnostics: bundle.diagnostics,
  };
  const direct = buildHistoricalDeepHouseJournalMechanicsArtifact({
    sourceBundle: compatibility,
    sourceArtifactId: 2,
    sourceArtifactDigest: `sha256:${'b'.repeat(64)}`,
    sourceHeadSha: 'source-head',
    generatedAt: '2026-01-06T00:00:00.000Z',
  });

  assert.deepEqual(holdout.observations, direct.observations);
});

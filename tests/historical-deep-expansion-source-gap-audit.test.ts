import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalDeepExpansionDiscoveryCandidateBundleV2 } from '../src/evaluation/historical-deep-expansion-extractor-v2';
import { auditHistoricalDeepExpansionSourceGaps } from '../src/evaluation/historical-deep-expansion-source-gap-audit';
import type { HistoricalDeepExpansionSourceBundle } from '../src/evaluation/historical-deep-expansion-source-bundle';

function sourceFixture(): HistoricalDeepExpansionSourceBundle {
  return {
    schemaVersion: 'historical-deep-expansion-source-bundle-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      sourcePolicy: 'house-committee-archive-enumeration-v1',
      codeSha: 'code',
      cohortHeadSha: 'cohort',
      cohortArtifactId: 1,
      cohortArtifactDigest: 'digest',
      purpose: 'fixture',
      selectionGuard: 'fixture',
    },
    input: {
      selectedCases: 3,
      sessions: ['2021-2022', '2023-2024'],
      chamber: 'house',
      committeeHomeIdsAttempted: 1,
    },
    summary: {
      committeesDiscovered: 1,
      minuteLinksDiscovered: 2,
      minutePagesEligibleByIndexDate: 2,
      minutePagesFetched: 2,
      matchedSourcePages: 2,
      sourceCaseMatches: 2,
      casesWithSources: 2,
      casesWithoutSources: 1,
    },
    cases: [
      {
        stableKey: 's1', caseKey: 'c1', voteEventId: 'v1', externalKey: 'e1', identifier: 'HF1', session: '2021-2022', occurredOn: '2022-01-10', tranche: 'deterministic-uniform', sourceIds: ['source-1'],
      },
      {
        stableKey: 's2', caseKey: 'c2', voteEventId: 'v2', externalKey: 'e2', identifier: 'SF2', session: '2021-2022', occurredOn: '2022-01-11', tranche: 'deterministic-uniform', sourceIds: [],
      },
      {
        stableKey: 's3', caseKey: 'c3', voteEventId: 'v3', externalKey: 'e3', identifier: 'SF3', session: '2023-2024', occurredOn: '2024-01-10', tranche: 'selector-disagreement', sourceIds: ['source-3'],
      },
    ],
    sources: [],
    diagnostics: [],
  } as HistoricalDeepExpansionSourceBundle;
}

function candidateFixture(): HistoricalDeepExpansionDiscoveryCandidateBundleV2 {
  return {
    schemaVersion: 'historical-deep-expansion-discovery-candidates-v2',
    generatedAt: '2026-01-02T00:00:00.000Z',
    purpose: 'fixture',
    metadata: {
      parser: 'deterministic-house-committee-roll-call-v2',
      baselineParser: 'deterministic-house-committee-roll-call-v1',
      outcomeUse: 'none',
      designGuard: 'fixture',
    },
    input: {
      discoveryCases: 3,
      discoveryMemberCasePairs: 3,
      sourcePages: 2,
      sourceCaseMatches: 2,
      casesWithSources: 2,
      casesWithoutSources: 1,
    },
    summary: {
      candidateCount: 1,
      v1BaselineCandidateCount: 1,
      supplementalCandidateCount: 0,
      memberCasePairsWithCandidates: 1,
      casesWithCandidates: 1,
      sourcesWithCandidates: 1,
      sourceCaseMatchesWithCandidates: 1,
      ayeCandidates: 1,
      nayCandidates: 0,
      currentDeepTargetCandidates: 1,
      candidateDeepTargetCandidates: 0,
      bothTargetCandidates: 0,
      outsideBothTargetCandidates: 0,
      generalRegisterCandidates: 0,
      alternateRollTriggerCandidates: 0,
      directNamedRollListCandidates: 0,
    },
    candidates: [
      {
        case: {
          stableKey: 's1', caseKey: 'c1', voteEventId: 'v1', externalKey: 'e1', tranche: 'deterministic-uniform', session: '2021-2022', chamber: 'house', identifier: 'HF1', occurredOn: '2022-01-10', asOf: '2022-01-09T23:59:59.999Z',
        },
        source: { sourceId: 'source-1' },
        selectedForCurrentDeep: true,
        selectedForCandidateDeep: false,
      },
    ],
    diagnostics: [],
  } as unknown as HistoricalDeepExpansionDiscoveryCandidateBundleV2;
}

test('source-gap audit separates missing sources from source-present extraction gaps', () => {
  const audit = auditHistoricalDeepExpansionSourceGaps(
    sourceFixture(),
    candidateFixture(),
    '2026-01-03T00:00:00.000Z',
  );

  assert.equal(audit.summary.cases, 3);
  assert.equal(audit.summary.casesWithOfficialSources, 2);
  assert.equal(audit.summary.casesWithoutOfficialSources, 1);
  assert.equal(audit.summary.casesWithCandidates, 1);
  assert.equal(audit.summary.casesWithSourcesButNoCandidates, 1);
  assert.equal(audit.summary.sourceCoverageRate, 2 / 3);
  assert.equal(audit.summary.candidateCoverageRate, 1 / 3);
  assert.equal(audit.summary.candidateCoverageAmongSourceCoveredCases, 1 / 2);
  assert.equal(audit.summary.byBillPrefix.HF.candidateCovered, 1);
  assert.equal(audit.summary.byBillPrefix.SF.missingOfficialSource, 1);
  assert.equal(audit.summary.byBillPrefix.SF.sourceWithoutCandidate, 1);

  const statuses = Object.fromEntries(audit.rows.map((row) => [row.identifier, row.status]));
  assert.deepEqual(statuses, {
    HF1: 'candidate_covered',
    SF2: 'missing_official_source',
    SF3: 'source_without_candidate',
  });
});

test('source-gap audit fails closed when a candidate source is outside the frozen case source set', () => {
  const candidates = candidateFixture();
  candidates.candidates[0].source.sourceId = 'unknown-source';
  assert.throws(
    () => auditHistoricalDeepExpansionSourceGaps(sourceFixture(), candidates),
    /is not frozen for c1/,
  );
});
